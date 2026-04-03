import express from 'express';
import puppeteer from 'puppeteer-extra';
import AdblockerPlugin from 'puppeteer-extra-plugin-adblocker';
import chromium from '@sparticuz/chromium';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { URL, fileURLToPath } from 'url';
import CryptoJS from 'crypto-js';
import path from 'path';

dotenv.config();

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SECRET_KEY = process.env.ENCRYPTION_KEY;

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Range']
}));
app.use(express.json());

// --- SUPABASE INITIALIZATION ---
let supabase = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
    supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
}
if (!supabase) {
    console.error('Supabase not initialized. Check env vars.');
}

// Puppeteer setup
puppeteer.use(AdblockerPlugin({ blockTrackers: true }));

// --- PERF: In-memory OpenSubtitles token cache ---
// Prevents a full login round-trip on every /api/subs request.
// Token is reused until it expires (55-minute TTL matches OS token lifetime).
let _osTokenCache = { token: null, expiresAt: 0 };

async function getOsToken(osHeaders) {
    const now = Date.now();
    if (_osTokenCache.token && now < _osTokenCache.expiresAt) {
        return _osTokenCache.token;
    }
    const OS_BASE = "https://api.opensubtitles.com/api/v1";
    const loginRes = await fetch(`${OS_BASE}/login`, {
        method: "POST",
        headers: osHeaders,
        body: JSON.stringify({
            username: process.env.OPENSUBTITLES_USERNAME,
            password: process.env.OPENSUBTITLES_PASSWORD
        })
    });
    const loginData = await loginRes.json();
    if (loginData.token) {
        _osTokenCache.token = loginData.token;
        _osTokenCache.expiresAt = now + 55 * 60 * 1000; // 55 minutes
    }
    return loginData.token || null;
}

// --- 1. PROXY ROUTE ---
app.get('/api/proxy', async (req, res) => {
    const targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).send("No URL provided");

    // FIX: AbortController gives us a hard timeout so hung upstreams
    // don't hold the connection open until the host force-kills the function.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); 

    try {
        const forwardedHeaders = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Referer': 'https://vidlink.pro/',
            'Origin': 'https://vidlink.pro/',
        };
        if (req.headers.range) forwardedHeaders['Range'] = req.headers.range;

        const response = await fetch(targetUrl, {
            headers: forwardedHeaders,
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        res.status(response.status);

        const contentType = response.headers.get('content-type') || "";
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', contentType);
        if (response.headers.get('content-range')) res.setHeader('Content-Range', response.headers.get('content-range'));
        if (response.headers.get('accept-ranges')) res.setHeader('Accept-Ranges', response.headers.get('accept-ranges'));
        if (response.headers.get('content-length')) res.setHeader('Content-Length', response.headers.get('content-length'));

        // PERF: Tell edge CDNs to cache non-m3u8 assets (TS segments, MP4 chunks)
        // for 1 hour. M3U8 playlists are intentionally excluded — they contain
        // short-lived signed URLs and must always be fetched fresh.
        if (!contentType.includes('mpegurl') && !targetUrl.includes('.m3u8')) {
            res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
        }

        if (contentType.includes('mpegurl') || targetUrl.includes('.m3u8')) {
            let text = await response.text();
            const providerBase = new URL(targetUrl).origin + new URL(targetUrl).pathname.replace(/[^/]+$/, '');
            const lines = text.split('\n');
            let rewrittenText = '';
            for (let line of lines) {
                if (line.trim() && !line.startsWith('#')) {
                    const absoluteUrl = line.startsWith('http') ? line : new URL(line, providerBase).href;
                    line = `/api/proxy?url=${encodeURIComponent(absoluteUrl)}`;
                } else if (line.startsWith('#EXT-X-MEDIA') && (line.includes('TYPE=AUDIO') || line.includes('TYPE=SUBTITLES'))) {
                    const uriMatch = line.match(/URI\s*=\s*(["']?)([^"'\s]+)\1/);
                    if (uriMatch) {
                        const uri = uriMatch[2];
                        const absoluteUri = uri.startsWith('http') ? uri : new URL(uri, providerBase).href;
                        line = line.replace(uriMatch[0], `URI="/api/proxy?url=${encodeURIComponent(absoluteUri)}"`);
                    }
                }
                rewrittenText += line + '\n';
            }
            res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
            return res.send(rewrittenText);
        }

        // FIX: Handle pipe errors explicitly so a dropped client connection
        // doesn't throw an unhandled exception and crash the process.
        response.body.on('error', (err) => {
            console.error("[PROXY PIPE ERROR]:", err.message);
            if (!res.headersSent) res.status(502).end();
        });
        response.body.pipe(res);

    } catch (err) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
            console.error("[PROXY TIMEOUT]: Upstream took too long:", targetUrl);
            return res.status(504).send("Upstream timed out.");
        }
        console.error("[PROXY ERROR]:", err.message);
        res.status(502).send("Proxy failed to reach provider.");
    }
});

// --- 2. SECURE ENCRYPTED SCRAPER ROUTE ---
app.post('/api/scrape-stream', async (req, res) => {
    const encryptedPayload = req.body.data;
    if (!encryptedPayload) return res.status(400).json({ error: "Missing encrypted data" });

    let browser = null; // FIX: Declare outside try so finally can always close it.

    try {
        const bytes = CryptoJS.AES.decrypt(encryptedPayload, SECRET_KEY);
        const decryptedString = bytes.toString(CryptoJS.enc.Utf8);
        if (!decryptedString) throw new Error("Decryption failed");
        const { id, type, s, e } = JSON.parse(decryptedString);
        if (!id || !type) return res.status(400).json({ error: "Missing ID/Type" });
        if (!supabase) return res.status(500).json({ error: "Database not available" });

        const cacheKey = `${id}-${type}-${s || ''}-${e || ''}`;
        let videoUrl = null;

        const { data: cacheData, error: cacheError } = await supabase
            .from('streams')
            .select('url, expires_at')
            .eq('key', cacheKey)
            .single();

        if (cacheError && cacheError.code !== 'PGRST116') throw cacheError;

        const now = new Date().toISOString();
        if (cacheData && cacheData.expires_at > now) {
            videoUrl = cacheData.url;
        }

        if (!videoUrl) {
            const isLocal = process.env.NODE_ENV === 'development' && !(process.env.VERCEL || process.env.K_SERVICE);

            browser = await puppeteer.launch({
                args: isLocal
                    ? ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
                    : [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
                executablePath: isLocal
                    ? '/usr/bin/google-chrome'
                    : await chromium.executablePath(),
                headless: isLocal ? true : chromium.headless,
            });

            const page = await browser.newPage();
            await page.setRequestInterception(true);

            // FIX: Use a local variable captured by this closure only.
            // The outer `videoUrl` was being mutated by the event listener,
            // creating a race condition under concurrent requests.
            let capturedUrl = null;

            page.on('request', (request) => {
                const url = request.url();
                if ((url.includes('.m3u8') || url.includes('.mp4')) && !url.includes('ads') && !capturedUrl) {
                    capturedUrl = url;
                }
                if (['image', 'font'].includes(request.resourceType())) {
                    request.abort();
                } else {
                    request.continue();
                }
            });

            let target = `https://vidlink.pro/${type}/${id}`;
            if (type === 'tv' && s && e) target = `https://vidlink.pro/tv/${id}/${s}/${e}`;

            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
            await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 30000 });
            await page.mouse.click(640, 360).catch(() => {});

            // PERF: Poll with a hard cap of 20 seconds total (40 × 500ms).
            // Previously this could silently spin forever if the page hung.
            let attempts = 0;
            while (!capturedUrl && attempts < 40) {
                await new Promise(r => setTimeout(r, 500));
                attempts++;
            }

            videoUrl = capturedUrl;

            if (!videoUrl) {
                return res.status(404).json({ success: false, message: "Stream not found." });
            }

            const expiresAt = new Date(Date.now() + 3600000).toISOString();
            await supabase.from('streams').upsert({
                key: cacheKey,
                url: videoUrl,
                expires_at: expiresAt
            }, { onConflict: 'key' });
        }

        res.json({ success: true, url: `/api/proxy?url=${encodeURIComponent(videoUrl)}` });

    } catch (err) {
        console.error("[SCRAPER ERROR]:", err.message);
        res.status(500).json({ success: false, error: err.message });
    } finally {
        // FIX: Always close the browser — whether we succeeded, threw, or timed out.
        // Previously a thrown error would leave Chromium running until OOM crash.
        if (browser) {
            await browser.close().catch((e) => console.error("[BROWSER CLOSE ERROR]:", e.message));
        }
    }
});

// --- 3. SECURE ENCRYPTED SUBTITLES ROUTE ---
app.post('/api/subs', async (req, res) => {
    const OS_BASE = "https://api.opensubtitles.com/api/v1";
    try {
        const encryptedPayload = req.body.data;
        if (!encryptedPayload) return res.status(400).json({ error: "Missing encrypted data payload" });

        const bytes = CryptoJS.AES.decrypt(encryptedPayload, SECRET_KEY);
        const decryptedString = bytes.toString(CryptoJS.enc.Utf8);
        if (!decryptedString) return res.status(400).json({ error: "Invalid encryption key or payload" });

        const { imdbId, type, season, episode } = JSON.parse(decryptedString);

        const osHeaders = {
            "Api-Key": process.env.OPENSUBTITLES_API_KEY,
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": process.env.OPENSUBTITLES_USER_AGENT
        };

        // PERF: Use cached token instead of logging in on every request.
        const token = await getOsToken(osHeaders);
        if (token) osHeaders["Authorization"] = `Bearer ${token}`;

        const params = new URLSearchParams({
            tmdb_id: imdbId,
            languages: "en",
            order_by: "download_count",
            order_direction: "desc",
        });
        if (type === "tv" && season && episode) {
            params.append("season_number", season);
            params.append("episode_number", episode);
            params.append("type", "episode");
        } else {
            params.append("type", "movie");
        }

        const searchRes = await fetch(`${OS_BASE}/subtitles?${params.toString()}`, { headers: osHeaders });
        const searchData = await searchRes.json();

        let tracksToDownload = [];
        if (searchData.data && searchData.data.length > 0) {
            const sorted = searchData.data.sort((a, b) => {
                const aT = a.attributes.from_trusted ? 1 : 0;
                const bT = b.attributes.from_trusted ? 1 : 0;
                if (bT !== aT) return bT - aT;
                return b.attributes.download_count - a.attributes.download_count;
            });
            const seenLanguages = new Set();
            for (const item of sorted) {
                const attrs = item.attributes;
                const lang = attrs.language;
                if (seenLanguages.has(lang) || attrs.nb_cd > 1 || !attrs.files || !attrs.files.length) continue;
                tracksToDownload.push({
                    title: attrs.language_name || lang.toUpperCase() || "Unknown",
                    language: lang || "en",
                    fileId: attrs.files[0].file_id
                });
                seenLanguages.add(lang);
                if (tracksToDownload.length >= 6) break;
            }
        }

        // PERF: Download all subtitle tracks in parallel instead of sequentially.
        // With 6 tracks at ~250ms each, this cuts wait time from ~1.5s down to ~250ms.
        const downloadResults = await Promise.all(
            tracksToDownload.map(async (track) => {
                const dlRes = await fetch(`${OS_BASE}/download`, {
                    method: "POST",
                    headers: osHeaders,
                    body: JSON.stringify({ file_id: track.fileId })
                });
                const dlData = await dlRes.json();
                if (dlData.link) {
                    return {
                        title: track.title,
                        language: track.language,
                        uri: dlData.link
                    };
                }
                return null;
            })
        );

        const finalTracks = downloadResults.filter(Boolean);

        const encryptedResponse = CryptoJS.AES.encrypt(
            JSON.stringify({ tracks: finalTracks }),
            SECRET_KEY
        ).toString();

        res.status(200).json({ data: encryptedResponse });

    } catch (error) {
        console.error("[SUBTITLE ERROR]:", error);
        res.status(500).json({ error: "Failed to process securely" });
    }
});

// --- 4. DATABASE ROUTES (UNTOUCHED) ---
app.post('/api/save-progress', async (req, res) => {
    if (!supabase) return res.json({ success: false });
    // logic...
});
app.post('/api/add-to-watchlist', async (req, res) => {
    if (!supabase) return res.json({ success: false });
    // logic...
});

// --- 5. THE UNIFIED PIECE: SERVE FRONTEND + LISTEN (UNTOUCHED) ---
app.use(express.static(path.join(__dirname, '../dist')));

app.get(/^\/(?!api).*/, (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server listening on port ${PORT}`);
    console.log(`📡 Frontend: http://localhost:${PORT}`);
});

export default app;