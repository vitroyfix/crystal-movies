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

// Use the same key across your entire app (Mobile .env and Vercel Dashboard)
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

// --- 1. PROXY ROUTE ---
app.get('/api/proxy', async (req, res) => {
    const targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).send("No URL provided");
    try {
        const forwardedHeaders = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Referer': 'https://vidlink.pro/',
            'Origin': 'https://vidlink.pro/',
        };
        if (req.headers.range) forwardedHeaders['Range'] = req.headers.range;
       
        const response = await fetch(targetUrl, { headers: forwardedHeaders });
        if (!response.ok) return res.status(response.status).send(await response.text());

        const contentType = response.headers.get('content-type') || "";
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', contentType);
        if (response.headers.get('content-range')) res.setHeader('Content-Range', response.headers.get('content-range'));
        if (response.headers.get('accept-ranges')) res.setHeader('Accept-Ranges', response.headers.get('accept-ranges'));

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
        response.body.pipe(res);
    } catch (err) {
        console.error("[PROXY ERROR]:", err.message);
        res.status(502).send("Proxy failed to reach provider.");
    }
});

// --- 2. SECURE ENCRYPTED SCRAPER ROUTE ---
app.post('/api/scrape-stream', async (req, res) => {
    const encryptedPayload = req.body.data;
    if (!encryptedPayload) return res.status(400).json({ error: "Missing encrypted data" });

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
            // Check if we are running locally or on a cloud provider
            const isLocal = process.env.NODE_ENV === 'development' || !process.env.K_SERVICE;
            
            let browser = await puppeteer.launch({
                args: isLocal
                    ? ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
                    : [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
                executablePath: isLocal
                    ? '/usr/bin/google-chrome' // Common path for Linux Mint/Ubuntu
                    : await chromium.executablePath(),
                headless: isLocal ? true : chromium.headless,
            });

            const page = await browser.newPage();
            await page.setRequestInterception(true);
            page.on('request', (request) => {
                const url = request.url();
                if ((url.includes('.m3u8') || url.includes('.mp4')) && !url.includes('ads') && !videoUrl) {
                    videoUrl = url;
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

            let attempts = 0;
            while (!videoUrl && attempts < 40) {
                await new Promise(r => setTimeout(r, 500));
                attempts++;
            }

            await browser.close();

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

        const loginRes = await fetch(`${OS_BASE}/login`, {
            method: "POST",
            headers: osHeaders,
            body: JSON.stringify({
                username: process.env.OPENSUBTITLES_USERNAME,
                password: process.env.OPENSUBTITLES_PASSWORD
            })
        });
        const loginData = await loginRes.json();
        if (loginData.token) osHeaders["Authorization"] = `Bearer ${loginData.token}`;

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

        const finalTracks = [];
        for (const track of tracksToDownload) {
            const dlRes = await fetch(`${OS_BASE}/download`, {
                method: "POST",
                headers: osHeaders,
                body: JSON.stringify({ file_id: track.fileId })
            });
            const dlData = await dlRes.json();
            if (dlData.link) {
                finalTracks.push({
                    title: track.title,
                    language: track.language,
                    uri: dlData.link
                });
            }
        }

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

// --- 4. DATABASE ROUTES (Placeholders for your logic) ---
app.post('/api/save-progress', async (req, res) => {
    if (!supabase) return res.json({ success: false });
    // logic...
});
app.post('/api/add-to-watchlist', async (req, res) => {
    if (!supabase) return res.json({ success: false });
    // logic...
});

// --- 5. THE UNIFIED PIECE: SERVE FRONTEND + LISTEN ---

// Serve Vite's static "dist" folder
app.use(express.static(path.join(__dirname, '../dist')));

// Handle Single Page Application (SPA) Routing
// Using '/*' ensures compatibility with Express 5 routing
app.get('/*', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// Bind to Port 8080 (Required for Google Cloud Run)
const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server listening on port ${PORT}`);
    console.log(`📡 Frontend: http://localhost:${PORT}`);
});

export default app;
