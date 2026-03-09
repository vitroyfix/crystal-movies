import express from 'express';
import puppeteer from 'puppeteer-extra';
import AdblockerPlugin from 'puppeteer-extra-plugin-adblocker';
import chromium from '@sparticuz/chromium';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { URL } from 'url'; // Built-in for URL parsing
dotenv.config();
const app = express();
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
// Ensure Supabase is initialized
if (!supabase) {
    console.error('Supabase not initialized. Check env vars.');
}
// Puppeteer setup
puppeteer.use(AdblockerPlugin({ blockTrackers: true }));
// --- 1. ENHANCED PROXY ROUTE (Handles Manifest Rewriting and Header Forwarding, with Audio Track Support) ---
app.get('/api/proxy', async (req, res) => {
    const targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).send("No URL provided");
    try {
        // Forward relevant client headers (e.g., Range for partial content)
        const forwardedHeaders = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Referer': 'https://vidlink.pro/',
            'Origin': 'https://vidlink.pro/',
        };
        if (req.headers.range) {
            forwardedHeaders['Range'] = req.headers.range;
        }
        const response = await fetch(targetUrl, {
            headers: forwardedHeaders
        });
        if (!response.ok) {
            return res.status(response.status).send(await response.text());
        }
        const contentType = response.headers.get('content-type') || "";
        // Forward important response headers (e.g., for partial content)
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', contentType);
        if (response.headers.get('content-range')) {
            res.setHeader('Content-Range', response.headers.get('content-range'));
        }
        if (response.headers.get('accept-ranges')) {
            res.setHeader('Accept-Ranges', response.headers.get('accept-ranges'));
        }
        res.status(response.status);
        // IF MANIFEST: Rewrite URLs to stay inside the proxy, including audio URIs in #EXT-X-MEDIA
        if (contentType.includes('mpegurl') || targetUrl.includes('.m3u8')) {
            let text = await response.text();
            const providerBase = new URL(targetUrl).origin + new URL(targetUrl).pathname.replace(/[^/]+$/, '');
            const lines = text.split('\n');
            let rewrittenText = '';
            for (let line of lines) {
                if (line.trim() && !line.startsWith('#')) {
                    // Rewrite segment/playlist lines
                    const absoluteUrl = line.startsWith('http') ? line : new URL(line, providerBase).href;
                    line = `/api/proxy?url=${encodeURIComponent(absoluteUrl)}`;
                } else if (line.startsWith('#EXT-X-MEDIA') && (line.includes('TYPE=AUDIO') || line.includes('TYPE=SUBTITLES'))) {
                    // Preserve #EXT-X-MEDIA but rewrite URI if present (for separate audio/subtitle manifests), handling different quote styles
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
        // IF VIDEO SEGMENT (.ts, .m4s): Stream binary data
        response.body.pipe(res);
    } catch (err) {
        console.error("[PROXY ERROR]:", err.message);
        res.status(502).send("Proxy failed to reach provider.");
    }
});
// --- 2. OPTIMIZED SCRAPER ROUTE WITH SUPABASE CACHING ---
app.get('/api/scrape-stream', async (req, res) => {
    const { id, type, s, e } = req.query;
    if (!id || !type) return res.status(400).json({ error: "Missing ID/Type" });
    if (!supabase) return res.status(500).json({ error: "Database not available" });
    const cacheKey = `${id}-${type}-${s || ''}-${e || ''}`;
    let videoUrl = null;
    try {
        // Check cache first
        const { data: cacheData, error: cacheError } = await supabase
            .from('streams')
            .select('url, expires_at')
            .eq('key', cacheKey)
            .single();
        if (cacheError && cacheError.code !== 'PGRST116') { // Ignore "no row" error
            throw cacheError;
        }
        const now = new Date().toISOString();
        if (cacheData && cacheData.expires_at > now) {
            videoUrl = cacheData.url;
        }
        if (!videoUrl) {
            // Scrape if no valid cache
            let browser;
            const isLocal = process.env.NODE_ENV === 'development' || !process.env.VERCEL;
            browser = await puppeteer.launch({
                args: isLocal
                    ? ['--no-sandbox', '--disable-setuid-sandbox']
                    : [...chromium.args, '--hide-scrollbars', '--disable-web-security'],
                executablePath: isLocal
                    ? '/usr/bin/google-chrome'
                    : await chromium.executablePath(),
                headless: isLocal ? true : chromium.headless,
            });
            const page = await browser.newPage();
            // Intercept requests to find the master m3u8
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
            // Trigger play button to start network activity
            await page.mouse.click(640, 360).catch(() => {});
            let attempts = 0;
            while (!videoUrl && attempts < 30) {
                await new Promise(r => setTimeout(r, 500));
                attempts++;
            }
            if (browser) await browser.close();
            if (!videoUrl) {
                return res.status(404).json({ success: false, message: "Stream not found." });
            }
            // Cache the URL (e.g., 1 hour expiry)
            const expiresAt = new Date(Date.now() + 3600000).toISOString();
            await supabase.from('streams').upsert({
                key: cacheKey,
                url: videoUrl,
                expires_at: expiresAt
            }, { onConflict: 'key' });
        }
        // Return proxied URL
        const proxiedUrl = `/api/proxy?url=${encodeURIComponent(videoUrl)}`;
        res.json({ success: true, url: proxiedUrl });
    } catch (err) {
        console.error("[SCRAPER ERROR]:", err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});
// --- DATABASE ROUTES (STAY THE SAME) ---
app.post('/api/save-progress', async (req, res) => {
if (!supabase) return res.json({ success: false });
// ... logic same as your provided code
});
app.post('/api/add-to-watchlist', async (req, res) => {
if (!supabase) return res.json({ success: false });
// ... logic same as your provided code
});
export default app;