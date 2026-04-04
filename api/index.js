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

if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

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
let _osTokenCache = { token: null, expiresAt: 0 };
let _osTokenPending = null;

async function getOsToken(osHeaders) {
  const now = Date.now();
  if (_osTokenCache.token && now < _osTokenCache.expiresAt) {
    return _osTokenCache.token;
  }
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
        _osTokenCache.expiresAt = Date.now() + 55 * 60 * 1000;
      }
      return loginData.token || null;
    })
    .finally(() => {
      _osTokenPending = null;
    });
  return _osTokenPending;
}

// --- PERF: fetchWithRetry helper (increased retries for transient 502s) ---
async function fetchWithRetry(url, options, retries = 2) {
  try {
    const response = await fetch(url, options);
    if (response.status >= 500 && retries > 0) {
      await new Promise(r => setTimeout(r, 500));
      return fetchWithRetry(url, options, retries - 1);
    }
    return response;
  } catch (err) {
    if (retries > 0 && err.name !== 'AbortError') {
      await new Promise(r => setTimeout(r, 500));
      return fetchWithRetry(url, options, retries - 1);
    }
    throw err;
  }
}

// --- 1. PROXY ROUTE ---
app.get('/api/proxy', async (req, res) => {
  const key = req.query.key;
  let targetUrl = req.query.url;
  let cookieString = null;

  if (key && supabase) {
    const { data: cacheData } = await supabase
      .from('streams')
      .select('url')
      .eq('key', key)
      .single();

    if (cacheData && cacheData.url) {
      let stored = cacheData.url;
      if (typeof stored === 'string' && stored.trim().startsWith('{') && stored.trim().endsWith('}')) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed.cookie && typeof parsed.cookie === 'string') {
            cookieString = parsed.cookie;
          }
          if (!targetUrl) targetUrl = parsed.url;
        } catch (e) {
          if (!targetUrl) targetUrl = stored;
        }
      } else if (!targetUrl) {
        targetUrl = stored;
      }
    } else if (!targetUrl) {
      return res.status(404).send("Stream not found in cache.");
    }
  }

  if (!targetUrl) return res.status(400).send("No target URL resolved");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s internal timeout (safe under Vercel 60s)

  try {
    const forwardedHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Referer': 'https://vidlink.pro/',
      'Origin': 'https://vidlink.pro/',
    };
    if (cookieString) {
      forwardedHeaders['Cookie'] = cookieString;
    }
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
          const proxyUrl = key
            ? `/api/proxy?url=${encodeURIComponent(absoluteUrl)}&key=${encodeURIComponent(key)}`
            : `/api/proxy?url=${encodeURIComponent(absoluteUrl)}`;
          line = proxyUrl;
        } else if (line.startsWith('#EXT-X-MEDIA') && (line.includes('TYPE=AUDIO') || line.includes('TYPE=SUBTITLES'))) {
          const uriMatch = line.match(/URI\s*=\s*(["']?)([^"'\s]+)\1/);
          if (uriMatch) {
            const uri = uriMatch[2];
            const absoluteUri = uri.startsWith('http') ? uri : new URL(uri, providerBase).href;
            const proxyUri = key
              ? `/api/proxy?url=${encodeURIComponent(absoluteUri)}&key=${encodeURIComponent(key)}`
              : `/api/proxy?url=${encodeURIComponent(absoluteUri)}`;
            line = line.replace(uriMatch[0], `URI="${proxyUri}"`);
          }
        }
        rewrittenText += line + '\n';
      }
      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      return res.send(rewrittenText);
    }

    res.on('error', () => {});
    response.body.on('error', (err) => {
      if (!res.destroyed && !res.headersSent) {
        res.status(502).end();
      } else if (!res.destroyed) {
        res.destroy(err);
      }
    });
    req.on('close', () => {
      if (response.body && !response.body.destroyed) {
        response.body.destroy();
      }
    });
    response.body.pipe(res);

  } catch (err) {
    clearTimeout(timeoutId);
    console.error(err);
    if (err.name === 'AbortError') {
      if (!res.headersSent) return res.status(504).send("Upstream timed out.");
      return;
    }
    if (!res.headersSent) res.status(502).send("Proxy failed to reach provider.");
  }
});

// --- 2. SECURE ENCRYPTED SCRAPER ROUTE ---
app.post('/api/scrape-stream', async (req, res) => {
  const encryptedPayload = req.body.data;
  if (!encryptedPayload) return res.status(400).json({ error: "Invalid request payload." });

  let browser = null;
  let page = null;
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedPayload, SECRET_KEY);
    const decryptedString = bytes.toString(CryptoJS.enc.Utf8);
    if (!decryptedString) throw new Error("Decryption failed");

    const { id, type, s, e } = JSON.parse(decryptedString);
    if (!id || !type) return res.status(400).json({ error: "Invalid request payload." });
    if (!supabase) return res.status(500).json({ error: "Service unavailable." });

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

      let attempts = 0;
      while (!capturedUrl && attempts < 40) {
        await new Promise(r => setTimeout(r, 500));
        attempts++;
      }

      videoUrl = capturedUrl;
      if (!videoUrl) {
        return res.status(404).json({ success: false, message: "Stream not found." });
      }

      const cookies = await page.cookies();
      const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');

      const expiresAt = new Date(Date.now() + 3600000).toISOString();
      await supabase.from('streams').upsert({
        key: cacheKey,
        url: JSON.stringify({ url: videoUrl, cookie: cookieString }),
        expires_at: expiresAt
      }, { onConflict: 'key' });
    }

    res.json({ success: true, url: `/api/proxy?key=${encodeURIComponent(cacheKey)}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "An unexpected server error occurred." });
  } finally {
    if (page) await page.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
  }
});

// --- 3. SECURE ENCRYPTED SUBTITLES ROUTE ---
app.post('/api/subs', async (req, res) => {
  const OS_BASE = "https://api.opensubtitles.com/api/v1";
  try {
    const encryptedPayload = req.body.data;
    if (!encryptedPayload) return res.status(400).json({ error: "Invalid request payload." });

    const bytes = CryptoJS.AES.decrypt(encryptedPayload, SECRET_KEY);
    const decryptedString = bytes.toString(CryptoJS.enc.Utf8);
    if (!decryptedString) return res.status(400).json({ error: "Invalid request payload." });

    const { imdbId, type, season, episode } = JSON.parse(decryptedString);

    const subsController = new AbortController();
    const subsTimeoutId = setTimeout(() => subsController.abort(), 8000);

    const osHeaders = {
      "Api-Key": process.env.OPENSUBTITLES_API_KEY,
      "Content-Type": "application/json",
      "Accept": "application/json",
      "User-Agent": process.env.OPENSUBTITLES_USER_AGENT
    };

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
    console.error(error);
    if (error.name === 'AbortError') {
      return res.status(504).json({ error: "Service temporarily unavailable." });
    }
    res.status(500).json({ error: "An unexpected server error occurred." });
  }
});

// --- 4. DATABASE ROUTES (UNTOUCHED) ---
app.post('/api/save-progress', async (req, res) => {
  if (!supabase) return res.json({ success: false });
});
app.post('/api/add-to-watchlist', async (req, res) => {
  if (!supabase) return res.json({ success: false });
});

// --- 5. THE UNIFIED PIECE: SERVE FRONTEND + LISTEN ---
app.use(express.static(path.join(__dirname, '../dist')));
app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0');

export default app;