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

// --- PERF: In-memory OpenSubtitles token cache with a pending-promise lock. ---
// Without the lock, two simultaneous cold requests both see token: null and race
// to fire login requests in parallel, burning through the OS rate limit.
let _osTokenCache = { token: null, expiresAt: 0 };
let _osTokenPending = null;

async function getOsToken(osHeaders) {
    const now = Date.now();
    if (_osTokenCache.token && now < _osTokenCache.expiresAt) {
        return _osTokenCache.token;
    }
    // FIX: If a login request is already in-flight, return the same promise
    // instead of firing a second one. All concurrent callers share one login call.
    if (_osTokenPending) {
        return _osTokenPending;
    }
    const OS_BASE = "https://api.opensubtitles.com/api/v1";
    _osTokenPending = fetch(`${OS_BASE}/login`, {
        method: "POST",
        headers: osHeaders,
        body: JSON.stringify({
            username: process.env.OPENSUBTITLES_USERNAME,
            password: process.env.OPENSUBTITLES_PASSWORD
        })
    })
    .then(res => res.json())
    .then(loginData => {
        if (loginData.token) {
            _osTokenCache.token = loginData.token;
            _osTokenCache.expiresAt = Date.now() + 55 * 60 * 1000; // 55 minutes
        }
        return loginData.token || null;
    })
    .finally(() => {
        // Always clear the lock so future calls after expiry can re-authenticate.
        _osTokenPending = null;
    });
    return _osTokenPending;
}

// --- PERF: fetchWithRetry helper ---
// Retries once on 5xx upstream errors with a 300ms back-off to smooth transient
// upstream latency spikes. Explicitly does NOT retry on AbortError (our own
// timeout) — doing so would double the wait time before responding with a 504.
async function fetchWithRetry(url, options, retries = 1) {
    try {
        const response = await fetch(url, options);
        if (response.status >= 500 && retries > 0) {
            console.warn(`[PROXY RETRY]: Upstream returned ${response.status}, retrying in 300ms.`);
            await new Promise(r => setTimeout(r, 300));
            return fetchWithRetry(url, options, retries - 1);
        }
        return response;
    } catch (err) {
        // Do not retry on our own AbortController signal — the timeout already fired.
        if (retries > 0 && err.name !== 'AbortError') {
            console.warn(`[PROXY RETRY]: Fetch threw "${err.message}", retrying in 300ms.`);
            await new Promise(r => setTimeout(r, 300));
            return fetchWithRetry(url, options, retries - 1);
        }
        throw err;
    }
}

// --- 1. PROXY ROUTE ---
app.get('/api/proxy', async (req, res) => {
    const targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).send("No URL provided");

    // Hard timeout set to 8s — safely under Vercel Hobby's 10s kill limit.
    // The 2s buffer lets our catch block run and return a clean 504 before
    // Vercel force-kills the function and issues its own opaque 502.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
        const forwardedHeaders = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Referer': 'https://vidlink.pro/',
            'Origin': 'https://vidlink.pro/',
        };
        if (req.headers.range) forwardedHeaders['Range'] = req.headers.range;

        const response = await fetchWithRetry(targetUrl, {
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

        // PERF: Smart CDN caching — two explicit exclusions:
        // 1. M3U8 playlists contain short-lived signed segment URLs and must always
        //    be fetched fresh. Caching them causes "segment not found" playback errors.
        // 2. 206 Partial Content (Range/seek requests) are uncacheable by CDN spec.
        //    This was the root cause of the 100% Cache MISS rate in the logs — Range
        //    requests make up the bulk of HLS traffic. Applying cache headers to them
        //    is ignored by edge networks and adds noise. Only full 200 responses for
        //    non-playlist assets (TS segments, MP4 chunks) are eligible for caching.
        const isPlaylist = contentType.includes('mpegurl') || targetUrl.includes('.m3u8');
        const isPartialContent = response.status === 206;
        if (!isPlaylist && !isPartialContent) {
            res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=600');
        }

        if (isPlaylist) {
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

        // FIX: Robust stream pipe error handling.
        // Three distinct failure scenarios are handled here:
        // 1. The upstream drops the connection mid-stream (network blip).
        // 2. The response body exceeds Vercel's 4.5MB serverless payload limit,
        //    causing the runtime to kill the write stream.
        // 3. The client (video player) disconnects while buffering (common on seek).
        // In all cases, we check res.destroyed before attempting to write to avoid
        // a "write after end" exception that would crash the Node process.
        res.on('error', (err) => {
            console.error("[PROXY RES ERROR]: Client-side stream failed:", err.message);
            // res is already destroyed at this point; no further action needed.
        });

        response.body.on('error', (err) => {
            console.error("[PROXY UPSTREAM ERROR]: Upstream stream failed:", err.message);
            if (!res.destroyed && !res.headersSent) {
                res.status(502).end();
            } else if (!res.destroyed) {
                res.destroy(err);
            }
        });

        req.on('close', () => {
            // Client disconnected early (e.g. user scrubbed the video timeline).
            // Destroy the upstream response body to release the socket and prevent
            // the upstream fetch from continuing to consume bandwidth into /dev/null.
            if (response.body && !response.body.destroyed) {
                response.body.destroy();
            }
        });

        response.body.pipe(res);

    } catch (err) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
            console.error("[PROXY TIMEOUT]: Upstream exceeded 8s limit:", targetUrl);
            if (!res.headersSent) return res.status(504).send("Upstream timed out.");
            return;
        }
        console.error("[PROXY ERROR]:", err.message);
        if (!res.headersSent) res.status(502).send("Proxy failed to reach provider.");
    }
});

// --- 2. SECURE ENCRYPTED SCRAPER ROUTE ---
app.post('/api/scrape-stream', async (req, res) => {
    const encryptedPayload = req.body.data;
    if (!encryptedPayload) return res.status(400).json({ error: "Missing encrypted data" });

    // FIX: Declared outside try so the finally block can always close it,
    // even if Puppeteer launch itself throws. Previously any thrown error
    // left a Chromium process running until OOM crash on the serverless instance.
    let browser = null;
    let page = null;

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

            page = await browser.newPage();
            await page.setRequestInterception(true);

            // FIX: `capturedUrl` is local to this closure. The original code mutated
            // an outer-scope `videoUrl` variable from inside the event listener,
            // creating a race condition when concurrent scrape requests shared state.
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

            // Poll with a hard cap of 20 seconds (40 × 500ms).
            let attempts = 0;
            while (!capturedUrl && attempts < 40) {
                await new Promise(r => setTimeout(r, 500));
                attempts++;
            }

            videoUrl = capturedUrl;

            if (!videoUrl) {
                return res.status(404).json({ success: false, message: "Stream not found." });
            }

            // FIX: Only write to Supabase cache after we have confirmed a valid URL.
            // Previously the upsert ran even if videoUrl was null or if the downstream
            // pipe had already failed, which would cache a useless empty value.
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
        // FIX: Always close the page before the browser. Skipping page.close()
        // causes Puppeteer to leak the page context on Vercel's frozen runtime,
        // where the process is suspended (not terminated) between invocations.
        if (page) {
            await page.close().catch((e) => console.error("[PAGE CLOSE ERROR]:", e.message));
        }
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

        // FIX: Subtitle fetch AbortController — previously subtitle downloads had no
        // timeout at all. A hung OpenSubtitles response would hold the serverless
        // function open until Vercel force-killed it, producing a 502 with no log.
        const subsController = new AbortController();
        const subsTimeoutId = setTimeout(() => subsController.abort(), 8000);

        const osHeaders = {
            "Api-Key": process.env.OPENSUBTITLES_API_KEY,
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": process.env.OPENSUBTITLES_USER_AGENT
        };

        // PERF: Reuse cached token instead of logging in on every request.
        // The promise-lock in getOsToken prevents parallel burst requests from
        // each firing their own login call and burning the OS rate limit.
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

        const searchRes = await fetch(`${OS_BASE}/subtitles?${params.toString()}`, {
            headers: osHeaders,
            signal: subsController.signal,
        });
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
        // With 6 tracks at ~250ms each, this cuts wait time from ~1.5s to ~250ms.
        // Each individual download also shares the same AbortController so the
        // entire batch is cancelled cleanly if the overall timeout fires.
        const downloadResults = await Promise.all(
            tracksToDownload.map(async (track) => {
                try {
                    const dlRes = await fetch(`${OS_BASE}/download`, {
                        method: "POST",
                        headers: osHeaders,
                        body: JSON.stringify({ file_id: track.fileId }),
                        signal: subsController.signal,
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
                } catch (dlErr) {
                    // FIX: A single failed subtitle track should not crash the entire
                    // request. Log it and return null so Promise.all continues for
                    // the remaining tracks.
                    console.error(`[SUBTITLE DOWNLOAD ERROR] Track ${track.fileId}:`, dlErr.message);
                    return null;
                }
            })
        );

        clearTimeout(subsTimeoutId);

        const finalTracks = downloadResults.filter(Boolean);

        const encryptedResponse = CryptoJS.AES.encrypt(
            JSON.stringify({ tracks: finalTracks }),
            SECRET_KEY
        ).toString();

        res.status(200).json({ data: encryptedResponse });

    } catch (error) {
        console.error("[SUBTITLE ERROR]:", error);
        if (error.name === 'AbortError') {
            return res.status(504).json({ error: "Subtitle service timed out." });
        }
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

// --- 5. THE UNIFIED PIECE: SERVE FRONTEND + LISTEN ---
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