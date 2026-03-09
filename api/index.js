import express from 'express';
import puppeteer from 'puppeteer-extra';
import AdblockerPlugin from 'puppeteer-extra-plugin-adblocker';
import StealthPlugin from 'puppeteer-extra-plugin-stealth'; 
import chromium from '@sparticuz/chromium'; 
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

// Standard CORS configuration
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json()); 

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// --- THE FIX FOR "chrome.app" ERROR ---
const stealth = StealthPlugin();
// We delete 'chrome.app' because it tries to access a file path that doesn't exist on Vercel
stealth.enabledEvasions.delete('chrome.app'); 
puppeteer.use(stealth);

puppeteer.use(AdblockerPlugin({ blockTrackers: true }));

let isBusy = false;

// --- SCRAPER ROUTE ---
app.get('/api/scrape-stream', async (req, res) => { 
    if (isBusy) return res.status(429).json({ error: "Server busy." });

    const { id, type, s, e } = req.query; 
    if (!id || !type) return res.status(400).json({ error: "Missing ID/Type" });

    isBusy = true; 
    let browser;

    try {
        const isLocal = process.env.NODE_ENV === 'development' || !process.env.VERCEL;
        
        console.log(`[SCRAPER] Environment: ${isLocal ? 'LOCAL (ThinkPad)' : 'PRODUCTION (Cloud)'}`);

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
        
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            if (['image', 'font', 'stylesheet'].includes(req.resourceType())) {
                req.abort();
            } else {
                req.continue();
            }
        });

        let videoUrl = null;
        page.on('request', (request) => {
            const url = request.url();
            if ((url.includes('.m3u8') || url.includes('.mp4')) && !url.includes('ads')) {
                videoUrl = url;
            }
        });

        let target = `https://vidlink.pro/${type}/${id}`;
        if (type === 'tv' && s && e) target = `https://vidlink.pro/tv/${id}/${s}/${e}`;

        await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

        // Note: Using the duration from your vercel.json (60s)
        await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 35000 });
        await page.mouse.click(640, 360); 

        let attempts = 0;
        while (!videoUrl && attempts < 40) { 
            await new Promise(r => setTimeout(r, 500));
            attempts++;
        }

        if (videoUrl) {
            res.json({ success: true, url: videoUrl });
        } else {
            res.status(404).json({ success: false, message: "Stream not found." });
        }

    } catch (err) {
        console.error("[CRITICAL ERROR]:", err.message);
        res.status(500).json({ success: false, error: err.message });
    } finally {
        if (browser) await browser.close();
        isBusy = false; 
    }
});

// --- SUPABASE ROUTES ---
app.post('/api/save-progress', async (req, res) => {
    const { userId, mediaId, time, title, poster, type, season, episode } = req.body;
    try {
        const { error } = await supabase.from('user_progress').upsert({ 
            user_id: userId, media_id: mediaId, time, title, poster, type, season, episode, last_updated: new Date().toISOString() 
        }, { onConflict: 'user_id,media_id' });
        if (error) throw error;
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/add-to-watchlist', async (req, res) => {
    const { userId, mediaId, title, poster, type, year } = req.body;
    try {
        const { error } = await supabase.from('watchlist').upsert({ 
            user_id: userId, media_id: String(mediaId), title, poster, type, year 
        }, { onConflict: 'user_id,media_id' });
        if (error) throw error;
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

export default app;