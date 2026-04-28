import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { fetchMovieDetails, fetchSeasonDetails } from "../services/api";
import {
  Play, X, RefreshCw, Plus, Check, Star, Calendar, Globe,
  ShieldCheck, Loader2, AlertCircle, ArrowLeft, FileText, User,
  Volume2, VolumeX, Maximize, ChevronRight, ChevronLeft,
  Clock, Film, Tv, Heart, Share2, Download, Info, Zap,
} from "lucide-react";
import useTrailer from "../hooks/useTrailer";
import Hls from "hls.js";
import { auth } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import CryptoJS from "crypto-js";
import { supabase } from "../../src/services/supabaseClient";
import languages from "../data/langs.json";

// ─── Constants ────────────────────────────────────────────────────────────────
const BACKEND_URL = "https://lifetime-measure-yields-monitored.trycloudflare.com/api/scrape-stream";
const SUBS_URL    = "https://lifetime-measure-yields-monitored.trycloudflare.com/api/subs";
const SECRET_KEY  = import.meta.env.VITE_ENCRYPTION_KEY;
const API_KEY     = import.meta.env.VITE_API_KEY;        // ← NEW: matches server API_KEY env var
const TMDB_KEY    = import.meta.env.VITE_TMDB_API_KEY;
const TMDB_BASE   = "https://api.themoviedb.org/3";
const IMG         = "https://image.tmdb.org/t/p";

// The base server URL, used to prefix proxy paths returned by the server.
const backendBase = BACKEND_URL.replace("/api/scrape-stream", "");

// ─── Helpers ──────────────────────────────────────────────────────────────────
const getLanguageName = (code, langList) => {
  if (!code) return "—";
  const lang = langList.find(l => l.iso_639_1 === code.toLowerCase());
  return lang ? lang.english_name : code.toUpperCase();
};

const encryptData = (payload) =>
  CryptoJS.AES.encrypt(JSON.stringify(payload), SECRET_KEY).toString();

const fmtRuntime = (mins) => {
  if (!mins) return null;
  const h = Math.floor(mins / 60), m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

// WHAT: SRT → WebVTT converter, runs entirely in the browser.
// WHY:  The HTML5 <track> element only parses WebVTT. OpenSubtitles serves
//       SRT. Two transforms needed:
//         1. Prepend the mandatory "WEBVTT" header.
//         2. Replace comma decimal separators in timestamps with dots.
//            e.g.  00:01:23,456  →  00:01:23.456
//       Doing this on the frontend means the server never buffers subtitle
//       bodies — it just streams raw bytes straight through the proxy.
const srtToVtt = (srtText) =>
  "WEBVTT\n\n" +
  srtText
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2");

// ─── Sub-components ────────────────────────────────────────────────────────────
const Badge = ({ children, className = "" }) => (
  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${className}`}>
    {children}
  </span>
);

const CastCard = ({ member }) => (
  <div className="flex-shrink-0 w-24 group cursor-default">
    <div className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-white/10 group-hover:border-red-500 transition-all duration-300">
      {member.profile_path
        ? <img src={`${IMG}/w185${member.profile_path}`} alt={member.name} className="w-full h-full object-cover object-top group-hover:scale-110 transition-transform duration-500" />
        : <div className="w-full h-full bg-zinc-800 flex items-center justify-center"><User size={28} className="text-zinc-600" /></div>
      }
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
    <p className="mt-2 text-[10px] font-bold text-center truncate text-white/80 group-hover:text-white transition-colors">{member.name}</p>
    <p className="text-[9px] text-center truncate text-white/40">{member.character}</p>
  </div>
);

const RelatedCard = ({ item, mediaType, onClick }) => {
  const title  = item.title || item.name;
  const year   = (item.release_date || item.first_air_date)?.split("-")[0];
  const rating = item.vote_average?.toFixed(1);
  return (
    <div onClick={() => onClick(item)} className="group cursor-pointer relative rounded-lg overflow-hidden aspect-[2/3] bg-zinc-900 border border-white/5 hover:border-red-500/50 transition-all duration-300 hover:scale-[1.03] hover:shadow-xl hover:shadow-red-600/10">
      {item.poster_path
        ? <img src={`${IMG}/w342${item.poster_path}`} alt={title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        : <div className="w-full h-full flex items-center justify-center"><Film size={32} className="text-zinc-700" /></div>
      }
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      <div className="absolute bottom-0 left-0 right-0 p-3 translate-y-2 group-hover:translate-y-0 opacity-0 group-hover:opacity-100 transition-all duration-300">
        <p className="text-[10px] font-black uppercase tracking-wide truncate text-white">{title}</p>
        <div className="flex items-center gap-2 mt-1">
          {year && <span className="text-[9px] text-white/50">{year}</span>}
          {rating && (
            <span className="flex items-center gap-0.5 text-[9px] text-amber-400 font-bold">
              <Star size={8} fill="currentColor" /> {rating}
            </span>
          )}
        </div>
      </div>
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="p-1.5 bg-red-600 rounded-full shadow-lg"><Play size={10} fill="white" className="text-white" /></div>
      </div>
    </div>
  );
};

const StatTile = ({ icon: Icon, label, value }) => (
  <div className="flex flex-col gap-1 p-4 rounded-lg bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] transition-colors">
    <p className="text-[9px] uppercase tracking-widest opacity-40 flex items-center gap-1.5"><Icon size={10} />{label}</p>
    <p className="text-xs font-bold text-white">{value || "N/A"}</p>
  </div>
);

const ScoreRing = ({ score }) => {
  const num = parseFloat(score) || 0;
  const pct = (num / 10) * 100;
  const r = 20, circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  const color = pct >= 70 ? "#ef4444" : pct >= 50 ? "#f59e0b" : "#6b7280";
  if (!num) return null;
  return (
    <div className="relative w-14 h-14">
      <svg className="rotate-[-90deg]" viewBox="0 0 50 50" width="56" height="56">
        <circle cx="25" cy="25" r={r} stroke="rgba(255,255,255,0.08)" strokeWidth="4" fill="none" />
        <circle cx="25" cy="25" r={r} stroke={color} strokeWidth="4" fill="none"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          style={{ transition: "stroke-dasharray 1s ease" }} />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[11px] font-black text-white">{num.toFixed(1)}</span>
    </div>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────────
const MovieDetails = () => {
  const params = useParams();
  const navigate = useNavigate();
  const id = params.id;
  const typeFromPath = params.mediaType;
  const resolvedMediaType = typeFromPath === "tv" ? "tv" : "movie";

  // Core state
  const [movie,           setMovie]           = useState(null);
  const [loading,         setLoading]         = useState(true);
  const [episodes,        setEpisodes]        = useState([]);
  const [currentUser,     setCurrentUser]     = useState(null);
  const [isInList,        setIsInList]        = useState(false);
  const [isSavingList,    setIsSavingList]    = useState(false);
  const [selectedSeason,  setSelectedSeason]  = useState(1);
  const [selectedEpisode, setSelectedEpisode] = useState(1);
  const [resumeData,      setResumeData]      = useState(null);

  // Player state
  const [activeStream,    setActiveStream]    = useState(null);
  const [cleanUrl,        setCleanUrl]        = useState(null);
  const [isCleaning,      setIsCleaning]      = useState(false);
  const [error,           setError]           = useState(null);
  const [audioTracks,     setAudioTracks]     = useState([]);
  const [selectedAudio,   setSelectedAudio]   = useState("original");
  const [subtitleTracks,  setSubtitleTracks]  = useState([]);   // shape: [{ title, language, src: blobUrl }]
  const [selectedSubtitle,setSelectedSubtitle]= useState(-1);
  const [qualityLevels,   setQualityLevels]   = useState([]);
  const [selectedQuality, setSelectedQuality] = useState(-1);
  const [activeMenu,      setActiveMenu]      = useState(null);
  const [isMuted,         setIsMuted]         = useState(false);

  // Rich content state
  const [cast,            setCast]            = useState([]);
  const [related,         setRelated]         = useState([]);
  const [relatedPage,     setRelatedPage]     = useState(1);
  const [relatedTotal,    setRelatedTotal]    = useState(0);
  const [relatedLoading,  setRelatedLoading]  = useState(false);
  const [castPage,        setCastPage]        = useState(0);
  const [activeTab,       setActiveTab]       = useState("episodes");
  const [episodeProgress, setEpisodeProgress] = useState({});
  const [heroParallax,    setHeroParallax]    = useState(0);

  const videoRef         = useRef(null);
  const hlsRef           = useRef(null);
  const progressInterval = useRef(null);
  const controlsRef      = useRef(null);
  const castScrollRef    = useRef(null);
  const playerRef        = useRef(null);

  // WHAT: blobUrlsRef stores all active blob: URLs for subtitle tracks.
  // WHY:  Blob URLs hold a reference to an in-memory ArrayBuffer. If we
  //       don't call URL.revokeObjectURL() when the stream changes or the
  //       component unmounts, those buffers leak — each subtitle set is
  //       roughly 100–500KB sitting permanently in the tab's heap.
  const blobUrlsRef = useRef([]);

  // Helper: revoke all current blob URLs and clear the ref
  const revokeBlobUrls = () => {
    blobUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
    blobUrlsRef.current = [];
  };

  // ── Parallax ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const onScroll = () => setHeroParallax(window.scrollY * 0.35);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // ── Outside click ─────────────────────────────────────────────────────────
  useEffect(() => {
    const fn = (e) => {
      if (controlsRef.current && !controlsRef.current.contains(e.target)) setActiveMenu(null);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  // ── Silence aborted media errors ─────────────────────────────────────────
  useEffect(() => {
    const fn = (e) => {
      const r = e.reason;
      if (r && (r instanceof DOMException) &&
        (r.message.includes("aborted") || r.message.includes("AbortError") ||
         r.message.includes("Invalid URI") || r.message.includes("media resource"))
      ) { e.preventDefault(); return true; }
    };
    window.addEventListener("unhandledrejection", fn);
    return () => window.removeEventListener("unhandledrejection", fn);
  }, []);

  // ── Keyboard shortcuts ───────────────────────────────────────────────────
  useEffect(() => {
    if (!activeStream) return;
    const fn = (e) => {
      const v = videoRef.current;
      if (!v) return;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) return;
      switch (e.key) {
        case " ": case "k": e.preventDefault(); v.paused ? v.play() : v.pause(); break;
        case "ArrowRight": v.currentTime = Math.min(v.duration, v.currentTime + 10); break;
        case "ArrowLeft":  v.currentTime = Math.max(0, v.currentTime - 10); break;
        case "ArrowUp":    v.volume = Math.min(1, v.volume + 0.1); break;
        case "ArrowDown":  v.volume = Math.max(0, v.volume - 0.1); break;
        case "m":          v.muted = !v.muted; setIsMuted(v.muted); break;
        case "f":          document.fullscreenElement ? document.exitFullscreen() : playerRef.current?.requestFullscreen(); break;
        default: break;
      }
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [activeStream]);

  // ── Auth ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(user);
        checkIfInWatchlist(user.uid);
        fetchResumePoint(user.uid);
        fetchAllProgress(user.uid);
      }
    });
    return () => unsub();
  }, [id]);

  const fetchResumePoint = async (uid) => {
    try {
      const key = resolvedMediaType === "tv" ? `tv_${id}_%` : `movie_${id}`;
      const { data } = await supabase.from("user_progress").select("*").eq("user_id", uid).ilike("media_id", key);
      if (!data?.length) return;
      if (resolvedMediaType === "tv") {
        const best = data.reduce((p, c) => c.season > p.season || (c.season === p.season && c.episode > p.episode) ? c : p, data[0]);
        setResumeData({ season: best.season, episode: best.episode, time: best.time });
      } else {
        setResumeData({ time: data[0].time });
      }
    } catch {}
  };

  const fetchAllProgress = async (uid) => {
    try {
      const { data } = await supabase.from("user_progress").select("media_id,time").eq("user_id", uid).ilike("media_id", `tv_${id}_%`);
      if (!data?.length) return;
      const map = {};
      data.forEach(row => {
        const match = row.media_id.match(/s(\d+)_e(\d+)/);
        if (match) map[`s${match[1]}e${match[2]}`] = row.time;
      });
      setEpisodeProgress(map);
    } catch {}
  };

  const checkIfInWatchlist = async (uid) => {
    try {
      const { data } = await supabase.from("watchlist").select("*").eq("user_id", uid).eq("media_id", id.toString()).maybeSingle();
      setIsInList(!!data);
    } catch { setIsInList(false); }
  };

  const handleWatchlistToggle = async () => {
    if (!currentUser) return alert("Please login to manage your list");
    setIsSavingList(true);
    try {
      if (isInList) {
        await supabase.from("watchlist").delete().eq("user_id", currentUser.uid).eq("media_id", id.toString());
        setIsInList(false);
      } else {
        await supabase.from("watchlist").insert([{
          user_id: currentUser.uid, media_id: id.toString(),
          title: movie?.title || movie?.name,
          poster: movie?.poster_path || movie?.backdrop_path,
          type: resolvedMediaType,
          year: (movie?.release_date || movie?.first_air_date)?.split("-")[0] || "N/A",
        }]);
        setIsInList(true);
      }
    } catch {} finally { setIsSavingList(false); }
  };

  // ── Progress ──────────────────────────────────────────────────────────────
  const saveProgress = async (currentTime) => {
    if (!currentUser || !movie || !videoRef.current) return;
    const key = resolvedMediaType === "tv" ? `tv_${id}_s${selectedSeason}_e${selectedEpisode}` : `movie_${id}`;
    try {
      await supabase.from("user_progress").upsert({
        user_id: currentUser.uid, media_id: key, time: currentTime,
        title: movie?.title || movie?.name,
        poster: movie?.backdrop_path || movie?.poster_path,
        type: resolvedMediaType,
        season:  resolvedMediaType === "tv" ? selectedSeason  : null,
        episode: resolvedMediaType === "tv" ? selectedEpisode : null,
        last_updated: new Date().toISOString(),
      }, { onConflict: "user_id, media_id" });
    } catch {}
  };

  const getSavedProgress = async () => {
    if (!currentUser) return 0;
    const key = resolvedMediaType === "tv" ? `tv_${id}_s${selectedSeason}_e${selectedEpisode}` : `movie_${id}`;
    try {
      const { data } = await supabase.from("user_progress").select("time").eq("user_id", currentUser.uid).eq("media_id", key).maybeSingle();
      return data ? data.time : 0;
    } catch { return 0; }
  };

  // ── Trailer ───────────────────────────────────────────────────────────────
  const { trailerUrl, isPlaying, playTrailer, stopTrailer } = useTrailer(id, resolvedMediaType, false, selectedSeason, movie?.title || movie?.name || "");

  // ── Scraping ──────────────────────────────────────────────────────────────
  const triggerBackendScrape = async (mId, mType, s, e) => {
    setIsCleaning(true); setCleanUrl(null); setError(null); setActiveMenu(null);
    setSubtitleTracks([]);
    setSelectedSubtitle(-1);
    revokeBlobUrls(); // Clean up previous subtitle blob URLs before starting fresh
    try {
      const encrypted = encryptData({ id: mId, type: mType, s, e });
      // WHAT: X-API-Key header added to every protected route call.
      // WHY:  The server middleware rejects any request missing this header
      //       with a 401, so even if someone finds the URL they can't use it.
      const res = await fetch(BACKEND_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": API_KEY },
        body: JSON.stringify({ data: encrypted }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.success && data.url) {
        setCleanUrl(`${backendBase}${data.url}`);
        fetchSubtitles(mId, mType, s, e);
      } else {
        setError("Stream could not be found.");
      }
    } catch {
      setError("Server is offline or encountered an error.");
    } finally { setIsCleaning(false); }
  };

  // WHAT: fetchSubtitles now does the full SRT→VTT conversion in the browser.
  // WHY:  The server returns raw proxy paths (not pre-fetched content).
  //       We fetch each subtitle file here with the API key header,
  //       run srtToVtt() on the response text, wrap it in a Blob,
  //       and store the resulting blob: URL in state.
  //       The <track src> then points to a local blob — zero additional
  //       server calls are made when the browser loads the track.
  const fetchSubtitles = async (mId, mType, s, e) => {
    try {
      const encrypted = encryptData({ imdbId: mId, type: mType, season: s, episode: e });
      const res = await fetch(SUBS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": API_KEY },
        body: JSON.stringify({ data: encrypted }),
      });
      const result = await res.json();
      if (!result.data) return;

      const bytes = CryptoJS.AES.decrypt(result.data, SECRET_KEY);
      const dec   = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
      const rawTracks = dec.tracks || [];

      // Fetch each raw subtitle through the proxy (API key required),
      // convert, and create a blob URL. allSettled so one failed track
      // doesn't block the others.
      const converted = await Promise.allSettled(
        rawTracks.map(async (track) => {
          // track.uri is "/api/proxy?url=...&type=sub" — prepend base, no re-wrapping.
          const proxyUrl = `${backendBase}${track.uri}`;
          const subRes   = await fetch(proxyUrl, { headers: { "X-API-Key": API_KEY } });
          if (!subRes.ok) throw new Error(`HTTP ${subRes.status}`);
          const rawText = await subRes.text();
          const vttText = srtToVtt(rawText);
          const blob    = new Blob([vttText], { type: "text/vtt" });
          const blobUrl = URL.createObjectURL(blob);
          blobUrlsRef.current.push(blobUrl); // Track for later cleanup
          return { title: track.title, language: track.language, src: blobUrl };
        })
      );

      const tracks = converted
        .filter(r => r.status === "fulfilled")
        .map(r => r.value);

      setSubtitleTracks(tracks);
      const enIdx = tracks.findIndex(t => t.language === "en");
      setSelectedSubtitle(enIdx !== -1 ? enIdx : -1);
    } catch {}
  };

  // ── HLS Player ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!cleanUrl || !videoRef.current) return;
    const video = videoRef.current;

    const initPlayer = async () => {
      const savedTime = await getSavedProgress();
      const attemptSeekAndPlay = () => {
        if (savedTime > 0) video.currentTime = savedTime;
        video.play().catch(() => {});
      };
      try {
        const res = await fetch(cleanUrl, { method: "HEAD" });
        const ct  = res.headers.get("content-type");
        if (ct?.includes("mpegurl") || cleanUrl.includes(".m3u8")) {
          if (Hls.isSupported()) {
            if (hlsRef.current) hlsRef.current.destroy();
            hlsRef.current = new Hls({ xhrSetup: xhr => { xhr.withCredentials = false; }, enableWorker: true });
            hlsRef.current.loadSource(cleanUrl);
            hlsRef.current.attachMedia(video);
            hlsRef.current.on(Hls.Events.MANIFEST_PARSED, () => {
              setAudioTracks(hlsRef.current.audioTracks);
              setQualityLevels(hlsRef.current.levels || []);
              setSelectedQuality(-1);
              attemptSeekAndPlay();
            });
          } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
            video.src = cleanUrl;
            video.addEventListener("loadedmetadata", attemptSeekAndPlay, { once: true });
          }
        } else {
          video.src = cleanUrl; video.type = "video/mp4";
          video.addEventListener("loadedmetadata", attemptSeekAndPlay, { once: true });
        }
      } catch { video.src = cleanUrl; }

      video.onpause = () => saveProgress(video.currentTime);
      video.onended = () => { saveProgress(0); handleAutoPlayNext(); };
    };

    initPlayer();
    progressInterval.current = setInterval(() => {
      if (video && !video.paused && !video.ended) saveProgress(video.currentTime);
    }, 10000);

    return () => {
      video.pause(); video.src = ""; video.removeAttribute("src"); video.load();
      if (hlsRef.current) { hlsRef.current.detachMedia(); hlsRef.current.destroy(); hlsRef.current = null; }
      if (progressInterval.current) { clearInterval(progressInterval.current); progressInterval.current = null; }
      // WHAT: Revoke blob URLs on stream cleanup.
      // WHY:  Each call to URL.createObjectURL() pins ~100–500KB of subtitle
      //       text in memory. Without revocation, every episode switch leaks
      //       that memory for the lifetime of the tab.
      revokeBlobUrls();
    };
  }, [cleanUrl, selectedEpisode, selectedSeason]);

  // ── Subtitle track sync via textTracks API ────────────────────────────────
  // WHAT: Uses video.textTracks (live NodeList) to set track modes.
  // WHY:  Since <track src> now points to a blob: URL the browser loads
  //       near-instantly. We still use a small timeout to let React finish
  //       adding the <track> elements to the DOM before reading textTracks.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const apply = () => {
      const tracks = video.textTracks;
      if (!tracks || tracks.length === 0) return;
      for (let i = 0; i < tracks.length; i++)
        tracks[i].mode = i === selectedSubtitle ? "showing" : "hidden";
    };
    const timer = setTimeout(apply, 150);
    return () => clearTimeout(timer);
  }, [selectedSubtitle, subtitleTracks]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const handleTrackAdded = () => {
      const tracks = video.textTracks;
      if (!tracks) return;
      for (let i = 0; i < tracks.length; i++)
        tracks[i].mode = i === selectedSubtitle ? "showing" : "hidden";
    };
    video.textTracks?.addEventListener("addtrack", handleTrackAdded);
    return () => video.textTracks?.removeEventListener("addtrack", handleTrackAdded);
  }, [selectedSubtitle, cleanUrl]);

  // ── Data loading ──────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await fetchMovieDetails(id, resolvedMediaType);
        setMovie(data);
        if (resolvedMediaType === "tv" && data.seasons?.length) {
          const first = data.seasons.find(s => s.season_number > 0) || data.seasons[0];
          setSelectedSeason(first.season_number);
        }
      } catch {} finally { setLoading(false); }
    }
    load();
    fetchCast();
    fetchRelated();
  }, [id, resolvedMediaType]);

  useEffect(() => {
    if (resolvedMediaType === "tv" && selectedSeason)
      fetchSeasonDetails(id, selectedSeason).then(setEpisodes);
  }, [selectedSeason, id, resolvedMediaType]);

  const fetchCast = async () => {
    try {
      const res  = await fetch(`${TMDB_BASE}/${resolvedMediaType}/${id}/credits?api_key=${TMDB_KEY}`);
      const data = await res.json();
      setCast((data.cast || []).slice(0, 20));
    } catch {}
  };

  const fetchRelated = async (page = 1) => {
    setRelatedLoading(true);
    try {
      const res     = await fetch(`${TMDB_BASE}/${resolvedMediaType}/${id}/recommendations?api_key=${TMDB_KEY}&page=${page}`);
      const data    = await res.json();
      const results = (data.results || []).filter(r => r.poster_path);
      setRelated(results);
      setRelatedTotal(data.total_pages || 1);
      setRelatedPage(page);
    } catch {} finally { setRelatedLoading(false); }
  };

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleAutoPlayNext = () => {
    if (resolvedMediaType !== "tv") return;
    const next = episodes.find(ep => ep.episode_number === selectedEpisode + 1);
    if (next) handleEpisodeSelect(next.episode_number);
    else setActiveStream(null);
  };

  const handleEpisodeSelect = (epNum) => {
    if (isPlaying) stopTrailer();
    if (videoRef.current) saveProgress(videoRef.current.currentTime);
    setSelectedEpisode(epNum);
    setActiveStream(true);
    setActiveMenu(null);
    triggerBackendScrape(id, resolvedMediaType, selectedSeason, epNum);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleResumeClick = () => {
    if (isPlaying) stopTrailer();
    if (resolvedMediaType === "tv" && resumeData) {
      setSelectedSeason(resumeData.season);
      setSelectedEpisode(resumeData.episode);
      setActiveStream(true);
      triggerBackendScrape(id, "tv", resumeData.season, resumeData.episode);
    } else {
      setActiveStream(true);
      triggerBackendScrape(id, resolvedMediaType, selectedSeason, selectedEpisode);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleRelatedClick = (item) => {
    const type = item.media_type || (item.title ? "movie" : "tv");
    navigate(`/details/${type}/${item.id}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const toggleAudio = () => {
    if (audioTracks.length > 1 && hlsRef.current) {
      const next = (hlsRef.current.audioTrack + 1) % audioTracks.length;
      hlsRef.current.audioTrack = next;
      setSelectedAudio(next === 0 ? "original" : "english");
    }
  };

  const getQualityLabel = (idx) => {
    if (idx === -1 || !qualityLevels[idx]) return "Auto";
    return `${qualityLevels[idx].height}p`;
  };

  const selectSubtitle = (i) => { setSelectedSubtitle(i); setActiveMenu(null); };
  const selectQuality  = (i) => {
    setSelectedQuality(i);
    if (hlsRef.current) hlsRef.current.currentLevel = i;
    setActiveMenu(null);
  };

  const scrollCast = (dir) => {
    if (!castScrollRef.current) return;
    castScrollRef.current.scrollBy({ left: dir * 300, behavior: "smooth" });
  };

  // ── Loading / null ────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="w-16 h-16 rounded-full border-2 border-red-600/30 animate-ping absolute inset-0" />
          <div className="w-16 h-16 rounded-full border-2 border-t-red-600 border-r-transparent border-b-transparent border-l-transparent animate-spin" />
        </div>
        <p className="text-[10px] uppercase tracking-widest text-white/30 font-bold animate-pulse">Loading</p>
      </div>
    </div>
  );
  if (!movie) return null;

  const { title, name, badgeYear, rating, runtime, plot, backdrop_path, poster_path, director, writer, release_date, first_air_date, votes } = movie;
  const genre        = movie.genres?.map(g => g.name).join(" · ") || "";
  const language     = movie.original_language?.toUpperCase() || "EN";
  const displayTitle = title || name;
  const heroImage    = backdrop_path ? `${IMG}/original${backdrop_path}` : `${IMG}/original${poster_path}`;
  const posterImage  = poster_path   ? `${IMG}/w500${poster_path}`       : heroImage;

  const tabs = [
    ...(resolvedMediaType === "tv" ? [{ key: "episodes", label: "Episodes", icon: Tv }] : []),
    ...(cast.length    ? [{ key: "cast",    label: "Cast",    icon: User }] : []),
    ...(related.length ? [{ key: "related", label: "Related", icon: Film }] : []),
  ];

  return (
    <div className="relative min-h-screen bg-[#070707] text-white selection:bg-red-600 selection:text-white overflow-x-hidden" style={{ fontFamily: "'DM Sans', sans-serif" }}>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,700;0,9..40,900;1,9..40,300&family=Playfair+Display:wght@400;700;900&display=swap');
        :root { --red: #e50914; --red-dim: rgba(229,9,20,0.15); --glass: rgba(255,255,255,0.035); --glass-border: rgba(255,255,255,0.07); }
        .font-display { font-family: 'Playfair Display', serif; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .thin-scroll::-webkit-scrollbar { width: 3px; }
        .thin-scroll::-webkit-scrollbar-track { background: transparent; }
        .thin-scroll::-webkit-scrollbar-thumb { background: var(--red); border-radius: 9px; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
        .fade-up { animation: fadeUp 0.7s ease forwards; }
        .fade-up-d1 { opacity: 0; animation: fadeUp 0.7s ease 0.1s forwards; }
        .fade-up-d2 { opacity: 0; animation: fadeUp 0.7s ease 0.2s forwards; }
        .fade-up-d3 { opacity: 0; animation: fadeUp 0.7s ease 0.3s forwards; }
        .fade-up-d4 { opacity: 0; animation: fadeUp 0.7s ease 0.4s forwards; }
        .fade-up-d5 { opacity: 0; animation: fadeUp 0.7s ease 0.5s forwards; }
        .fade-up-d6 { opacity: 0; animation: fadeUp 0.7s ease 0.6s forwards; }
        .scanlines::before { content: ''; position: absolute; inset: 0; background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px); pointer-events: none; z-index: 1; }
        video::cue { background-color: rgba(0,0,0,0.82); color: #fff; font-size: 1rem; font-family: 'DM Sans', sans-serif; padding: 3px 10px; border-radius: 3px; }
        video::-webkit-media-text-track-container { overflow: visible !important; z-index: 9999 !important; }
        video::-webkit-media-text-track-display { overflow: visible !important; }
        .ep-progress { position: absolute; bottom: 0; left: 0; height: 2px; background: var(--red); border-radius: 0 0 0 8px; }
      `}</style>

      {/* Back button */}
      <button onClick={() => navigate(-1)}
        className="fixed top-6 left-4 md:top-8 md:left-8 z-[60] flex items-center gap-2 px-3 py-2 md:px-4 md:py-2.5 rounded-full transition-all group"
        style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.08)" }}>
        <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform text-white/70 group-hover:text-white" />
        <span className="text-[9px] font-black uppercase tracking-widest text-white/60 group-hover:text-white hidden sm:inline">Back</span>
      </button>

      {/* Hero */}
      <div className="relative h-screen min-h-[600px] max-h-[900px] overflow-hidden">
        <div className="absolute inset-0 w-full h-full scanlines">
          <img src={heroImage} alt={displayTitle} className="w-full h-full object-cover object-center"
            style={{ transform: `translateY(${heroParallax}px) scale(1.15)`, transition: "transform 0.05s linear" }} />
          <div className="absolute inset-0" style={{ background: "linear-gradient(to right, rgba(7,7,7,0.97) 30%, rgba(7,7,7,0.4) 70%, transparent)" }} />
          <div className="absolute inset-0" style={{ background: "linear-gradient(to top, #070707 0%, transparent 50%)" }} />
          <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 20% 50%, rgba(229,9,20,0.06) 0%, transparent 60%)" }} />
        </div>

        <div className="relative z-10 h-full flex items-center px-6 md:px-16 lg:px-24">
          <div className="flex gap-10 items-end w-full max-w-6xl">
            <div className="hidden md:block flex-shrink-0 fade-up" style={{ width: 180 }}>
              <div className="relative rounded-xl overflow-hidden shadow-2xl" style={{ border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 40px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.05)" }}>
                <img src={posterImage} alt={displayTitle} className="w-full aspect-[2/3] object-cover" />
                <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(7,7,7,0.6) 0%, transparent 50%)" }} />
              </div>
            </div>

            <div className="flex-1 space-y-5 pb-8">
              <div className="flex flex-wrap gap-2 fade-up">
                <Badge className="bg-red-600/20 border border-red-600/60 text-red-400"><ShieldCheck size={10} /> Protected</Badge>
                {resolvedMediaType === "tv"
                  ? <Badge className="bg-white/5 border border-white/10 text-white/50"><Tv size={10} /> Series</Badge>
                  : <Badge className="bg-white/5 border border-white/10 text-white/50"><Film size={10} /> Film</Badge>
                }
                {genre.split(" · ").slice(0, 2).map(g => (
                  <Badge key={g} className="bg-white/5 border border-white/10 text-white/40">{g}</Badge>
                ))}
              </div>

              <h1 className="font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.05] tracking-tight text-white fade-up-d1">
                {displayTitle}
              </h1>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] tracking-wider text-white/50 fade-up-d2">
                <span className="font-bold text-white/70">{badgeYear || (release_date || first_air_date)?.split("-")[0]}</span>
                <span className="w-px h-3 bg-white/20" />
                <span className="bg-red-600/80 text-white px-1.5 py-0.5 rounded text-[9px] font-black uppercase">12+</span>
                {runtime && <><span className="w-px h-3 bg-white/20" /><span className="flex items-center gap-1"><Clock size={10} />{runtime}</span></>}
                <span className="w-px h-3 bg-white/20" />
                <span className="uppercase">{language}</span>
              </div>

              {parseFloat(rating) > 0 && (() => { const r = parseFloat(rating); return (
                <div className="flex items-center gap-4 fade-up-d2">
                  <ScoreRing score={r} />
                  <div>
                    <p className="text-xs font-bold text-white/80">{r.toFixed(1)} / 10</p>
                    <p className="text-[10px] text-white/30">{votes?.toLocaleString()} ratings</p>
                  </div>
                  <div className="flex gap-0.5 ml-2">
                    {Array.from({ length: 5 }, (_, i) => (
                      <Star key={i} size={13} className={i < Math.floor(r / 2) ? "fill-red-500 text-red-500" : "text-white/15"} />
                    ))}
                  </div>
                </div>
              ); })()}

              <p className="text-sm leading-relaxed text-white/60 max-w-lg line-clamp-3 fade-up-d3">{plot}</p>

              <div className="flex flex-wrap items-center gap-3 fade-up-d4">
                <button onClick={handleResumeClick}
                  className="flex items-center gap-2.5 px-7 py-3.5 rounded-lg text-xs font-black uppercase tracking-widest text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
                  style={{ background: "var(--red)", boxShadow: "0 8px 32px rgba(229,9,20,0.4)" }}>
                  <Play size={16} fill="white" />
                  {resumeData
                    ? (resolvedMediaType === "tv" ? `Resume S${resumeData.season}:E${resumeData.episode}` : "Resume")
                    : "Start Streaming"}
                </button>

                <button onClick={handleWatchlistToggle} disabled={isSavingList}
                  className={`flex items-center gap-2 px-5 py-3.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-[0.98] ${isInList ? "bg-white text-black" : "text-white"}`}
                  style={!isInList ? { background: "var(--glass)", border: "1px solid var(--glass-border)", backdropFilter: "blur(16px)" } : {}}>
                  {isSavingList ? <Loader2 size={15} className="animate-spin" /> : isInList ? <Check size={15} /> : <Plus size={15} />}
                  {isInList ? "In My List" : "My List"}
                </button>

                <button onClick={() => { setActiveStream(null); playTrailer(); }}
                  className="flex items-center gap-2 px-5 py-3.5 rounded-lg text-xs font-black uppercase tracking-widest text-white/60 hover:text-white transition-all"
                  style={{ background: "var(--glass)", border: "1px solid var(--glass-border)", backdropFilter: "blur(16px)" }}>
                  <Play size={14} fill="currentColor" /> Trailer
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none" style={{ background: "linear-gradient(to bottom, transparent, #070707)" }} />
      </div>

      {/* Details section */}
      <div className="px-6 md:px-16 lg:px-24 py-12 space-y-10">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 fade-up-d5">
          <StatTile icon={Calendar} label="Release"  value={badgeYear || first_air_date || release_date} />
          <StatTile icon={Globe}    label="Language" value={language} />
          <StatTile icon={User}     label={resolvedMediaType === "tv" ? "Created by" : "Director"} value={director} />
          <StatTile icon={FileText} label="Writer"   value={writer} />
        </div>

        {tabs.length > 0 && (
          <div className="space-y-6">
            <div className="flex items-center gap-1 border-b" style={{ borderColor: "var(--glass-border)" }}>
              {tabs.map(({ key, label, icon: Icon }) => (
                <button key={key} onClick={() => setActiveTab(key)}
                  className={`flex items-center gap-2 px-5 py-3 text-[11px] font-black uppercase tracking-widest transition-all border-b-2 -mb-px ${activeTab === key ? "border-red-600 text-white" : "border-transparent text-white/30 hover:text-white/60"}`}>
                  <Icon size={12} />{label}
                </button>
              ))}
            </div>

            {/* Episodes tab */}
            {activeTab === "episodes" && resolvedMediaType === "tv" && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <p className="text-xs text-white/30 uppercase tracking-widest">{episodes.length} Episodes</p>
                  <select value={selectedSeason} onChange={e => { setSelectedSeason(Number(e.target.value)); setSelectedEpisode(1); }}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-lg text-[10px] uppercase tracking-widest font-bold text-white outline-none cursor-pointer appearance-none"
                    style={{ background: "var(--glass)", border: "1px solid var(--glass-border)" }}>
                    {movie.seasons?.filter(s => s.season_number > 0).map(s => (
                      <option key={s.id} value={s.season_number} style={{ background: "#1a1a1a" }}>Season {s.season_number}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {episodes.map(ep => {
                    const progressKey = `s${selectedSeason}e${ep.episode_number}`;
                    const progress    = episodeProgress[progressKey];
                    const pct         = progress && ep.runtime ? Math.min(100, (progress / (ep.runtime * 60)) * 100) : 0;
                    const isActive    = selectedEpisode === ep.episode_number && activeStream;
                    return (
                      <div key={`${selectedSeason}-${ep.episode_number}`} onClick={() => handleEpisodeSelect(ep.episode_number)}
                        className={`group cursor-pointer rounded-xl overflow-hidden transition-all duration-300 ${isActive ? "ring-2 ring-red-600 shadow-lg shadow-red-600/20 scale-[1.02]" : "hover:scale-[1.02]"}`}
                        style={{ background: "var(--glass)", border: `1px solid ${isActive ? "transparent" : "var(--glass-border)"}` }}>
                        <div className="relative aspect-video overflow-hidden">
                          <img src={ep.still_path ? `${IMG}/w500${ep.still_path}` : heroImage} alt={ep.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <div className="p-3 rounded-full" style={{ background: "var(--red)", boxShadow: "0 0 20px rgba(229,9,20,0.5)" }}>
                              <Play size={18} fill="white" />
                            </div>
                          </div>
                          <div className="absolute top-2 left-2 px-2 py-0.5 rounded text-[9px] font-black text-white/80"
                            style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.1)" }}>
                            E{ep.episode_number}
                          </div>
                          {pct > 0 && <div className="ep-progress" style={{ width: `${pct}%` }} />}
                          {isActive && (
                            <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-black text-white"
                              style={{ background: "var(--red)" }}>
                              <Zap size={8} fill="white" /> Now Playing
                            </div>
                          )}
                        </div>
                        <div className="p-3 space-y-1">
                          <h3 className="text-[11px] font-bold uppercase tracking-wide truncate text-white/90 group-hover:text-white transition-colors">{ep.name}</h3>
                          {ep.runtime && <p className="text-[9px] text-white/30 flex items-center gap-1"><Clock size={8} />{ep.runtime}m</p>}
                          {ep.overview && <p className="text-[10px] leading-relaxed line-clamp-2 text-white/40">{ep.overview}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Cast tab */}
            {activeTab === "cast" && cast.length > 0 && (
              <div className="relative">
                <button onClick={() => scrollCast(-1)} className="absolute left-0 top-8 -translate-x-3 z-10 p-2 rounded-full bg-black border border-white/10 hover:border-white/30 hover:bg-white/10 transition-all">
                  <ChevronLeft size={16} />
                </button>
                <div ref={castScrollRef} className="flex gap-6 overflow-x-auto no-scrollbar pb-4 px-2">
                  {cast.map(m => <CastCard key={m.id} member={m} />)}
                </div>
                <button onClick={() => scrollCast(1)} className="absolute right-0 top-8 translate-x-3 z-10 p-2 rounded-full bg-black border border-white/10 hover:border-white/30 hover:bg-white/10 transition-all">
                  <ChevronRight size={16} />
                </button>
              </div>
            )}

            {/* Related tab */}
            {activeTab === "related" && (
              <div className="space-y-6">
                {relatedLoading ? (
                  <div className="flex items-center justify-center py-20">
                    <div className="w-10 h-10 rounded-full border-2 border-t-red-600 border-r-transparent border-b-transparent border-l-transparent animate-spin" />
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 md:gap-4">
                      {related.map(item => (
                        <RelatedCard key={item.id} item={item} mediaType={resolvedMediaType} onClick={handleRelatedClick} />
                      ))}
                    </div>
                    {relatedTotal > 1 && (
                      <div className="flex items-center justify-center gap-2 pt-4">
                        <button onClick={() => fetchRelated(relatedPage - 1)} disabled={relatedPage === 1}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest text-white disabled:opacity-20 transition-all hover:bg-white/10 disabled:cursor-not-allowed"
                          style={{ background: "var(--glass)", border: "1px solid var(--glass-border)" }}>
                          <ChevronLeft size={12} /> Prev
                        </button>
                        <div className="flex items-center gap-1">
                          {Array.from({ length: Math.min(relatedTotal, 7) }, (_, i) => {
                            const pg = relatedTotal <= 7 ? i + 1
                              : relatedPage <= 4 ? i + 1
                              : relatedPage >= relatedTotal - 3 ? relatedTotal - 6 + i
                              : relatedPage - 3 + i;
                            return (
                              <button key={pg} onClick={() => fetchRelated(pg)}
                                className={`w-8 h-8 rounded-lg text-[10px] font-black transition-all ${pg === relatedPage ? "bg-red-600 text-white" : "text-white/40 hover:text-white hover:bg-white/10"}`}
                                style={pg !== relatedPage ? { border: "1px solid var(--glass-border)" } : {}}>
                                {pg}
                              </button>
                            );
                          })}
                        </div>
                        <button onClick={() => fetchRelated(relatedPage + 1)} disabled={relatedPage >= relatedTotal}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest text-white disabled:opacity-20 transition-all hover:bg-white/10 disabled:cursor-not-allowed"
                          style={{ background: "var(--glass)", border: "1px solid var(--glass-border)" }}>
                          Next <ChevronRight size={12} />
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Full-screen Player */}
      {(activeStream || isPlaying) && (
        <div ref={playerRef} className="fixed inset-0 z-[100] bg-black flex flex-col">
          <div className="absolute top-0 w-full px-4 md:px-8 py-4 flex items-center justify-between z-[110] pointer-events-none"
            style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.8), transparent)" }}>
            <div className="flex items-center gap-3 pointer-events-auto">
              <div className="w-1 h-5 rounded-full bg-red-600" />
              <h2 className="text-[10px] md:text-xs uppercase tracking-widest font-black text-white/80 truncate max-w-[50vw]">
                {displayTitle}
                {activeStream && resolvedMediaType === "tv" && (
                  <span className="text-red-500 ml-2">S{selectedSeason} · E{selectedEpisode}</span>
                )}
              </h2>
            </div>
            <button onClick={() => {
              if (videoRef.current) saveProgress(videoRef.current.currentTime);
              setActiveStream(null); stopTrailer(); setCleanUrl(null); setActiveMenu(null);
              revokeBlobUrls(); // Clean up on manual close too
            }} className="pointer-events-auto p-2 md:p-2.5 rounded-full transition-all hover:scale-110"
              style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <X size={18} className="text-white/70 hover:text-white" />
            </button>
          </div>

          <div className="flex-grow w-full relative">
            {isCleaning ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black gap-4">
                <div className="relative w-20 h-20">
                  <div className="absolute inset-0 rounded-full border-2 border-red-600/20 animate-ping" />
                  <div className="absolute inset-0 rounded-full border-2 border-t-red-600 border-r-transparent border-b-transparent border-l-transparent animate-spin" />
                </div>
                <p className="text-[10px] uppercase tracking-[0.3em] text-white/30 font-bold animate-pulse">Fetching Stream…</p>
              </div>
            ) : error ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black text-center px-6 gap-5">
                <div className="p-4 rounded-full bg-red-600/10 border border-red-600/30">
                  <AlertCircle className="text-red-500" size={32} />
                </div>
                <div>
                  <p className="text-sm font-bold text-white/80 mb-1">{error}</p>
                  <p className="text-[10px] text-white/30">The source may be temporarily unavailable.</p>
                </div>
                <button onClick={() => triggerBackendScrape(id, resolvedMediaType, selectedSeason, selectedEpisode)}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-[10px] uppercase font-black tracking-widest text-white transition-all hover:bg-red-600"
                  style={{ border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.05)" }}>
                  <RefreshCw size={12} /> Retry Connection
                </button>
              </div>
            ) : cleanUrl ? (
              <div className="relative w-full h-full">
                <video
                  ref={videoRef}
                  controls
                  autoPlay
                  playsInline
                  crossOrigin="anonymous"
                  className="w-full h-full object-contain bg-black"
                >
                  {/*
                    WHAT: <track src> now uses track.src which is a blob: URL.
                    WHY:  The blob URL points to in-memory VTT content that
                          was already fetched and converted by fetchSubtitles().
                          The browser loads it instantly with zero network calls,
                          and crossOrigin restrictions don't apply to blob: URLs.
                  */}
                  {subtitleTracks.map((track, idx) => (
                    <track
                      key={`${cleanUrl}-${idx}`}
                      kind="subtitles"
                      src={track.src}
                      label={getLanguageName(track.language, languages)}
                      srcLang={track.language}
                    />
                  ))}
                </video>

                {/* Controls overlay */}
                <div ref={controlsRef}
                  className="absolute bottom-20 md:bottom-24 right-4 md:right-8 flex flex-wrap justify-end gap-2 z-[9999] pointer-events-auto">

                  <button onClick={() => { if (videoRef.current) { videoRef.current.muted = !videoRef.current.muted; setIsMuted(v => !v); } }}
                    className="p-2 rounded-lg text-white transition-all hover:bg-white/10"
                    style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.12)" }}>
                    {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                  </button>

                  <button onClick={() => document.fullscreenElement ? document.exitFullscreen() : playerRef.current?.requestFullscreen()}
                    className="p-2 rounded-lg text-white transition-all hover:bg-white/10"
                    style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.12)" }}>
                    <Maximize size={14} />
                  </button>

                  {audioTracks.length > 1 && (
                    <button onClick={toggleAudio}
                      className="px-3 py-2 rounded-lg text-[10px] uppercase font-black text-white transition-all hover:bg-red-600"
                      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.12)" }}>
                      Audio: {selectedAudio}
                    </button>
                  )}

                  {activeStream && (
                    <div className="relative">
                      <button onClick={() => setActiveMenu(p => p === "quality" ? null : "quality")}
                        className={`px-3 py-2 rounded-lg text-[10px] uppercase font-black text-white transition-all ${activeMenu === "quality" ? "bg-red-600" : "hover:bg-white/10"}`}
                        style={activeMenu !== "quality" ? { background: "rgba(0,0,0,0.7)", backdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.12)" } : {}}>
                        {getQualityLabel(selectedQuality)}
                      </button>
                      {activeMenu === "quality" && (
                        <div className="absolute bottom-full right-0 mb-2 rounded-lg overflow-hidden min-w-[140px] shadow-2xl thin-scroll"
                          style={{ background: "rgba(10,10,10,0.97)", border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(20px)" }}>
                          <p className="px-4 py-2 text-[8px] uppercase tracking-widest text-white/20 border-b border-white/5">Quality</p>
                          {[{ label: "Auto", idx: -1 }, ...qualityLevels.map((l, i) => ({ label: `${l.height}p`, idx: i }))].map(({ label, idx }) => (
                            <button key={idx} onClick={() => selectQuality(idx)}
                              className={`w-full px-4 py-2.5 text-[10px] uppercase text-left hover:bg-red-600/80 transition-colors ${selectedQuality === idx ? "text-red-400 font-black bg-red-600/20" : "text-white/60"}`}>
                              {label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {subtitleTracks.length > 0 && (
                    <div className="relative">
                      <button onClick={() => setActiveMenu(p => p === "subs" ? null : "subs")}
                        className={`px-3 py-2 rounded-lg text-[10px] uppercase font-black text-white transition-all ${activeMenu === "subs" ? "bg-red-600" : "hover:bg-white/10"}`}
                        style={activeMenu !== "subs" ? { background: "rgba(0,0,0,0.7)", backdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.12)" } : {}}>
                        CC: {selectedSubtitle === -1 ? "Off" : getLanguageName(subtitleTracks[selectedSubtitle]?.language, languages)}
                      </button>
                      {activeMenu === "subs" && (
                        <div className="absolute bottom-full right-0 mb-2 rounded-lg overflow-hidden min-w-[160px] max-h-56 shadow-2xl thin-scroll overflow-y-auto"
                          style={{ background: "rgba(10,10,10,0.97)", border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(20px)" }}>
                          <p className="px-4 py-2 text-[8px] uppercase tracking-widest text-white/20 border-b border-white/5">Subtitles</p>
                          <button onClick={() => selectSubtitle(-1)}
                            className={`w-full px-4 py-2.5 text-[10px] uppercase text-left hover:bg-red-600/80 transition-colors ${selectedSubtitle === -1 ? "text-red-400 font-black bg-red-600/20" : "text-white/60"}`}>
                            Off
                          </button>
                          {subtitleTracks.map((t, i) => (
                            <button key={i} onClick={() => selectSubtitle(i)}
                              className={`w-full px-4 py-2.5 text-[10px] uppercase text-left hover:bg-red-600/80 transition-colors ${selectedSubtitle === i ? "text-red-400 font-black bg-red-600/20" : "text-white/60"}`}>
                              {getLanguageName(t.language, languages)}{t.title ? ` · ${t.title}` : ""}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 hidden md:flex items-center gap-4 text-[9px] text-white/20 uppercase tracking-widest pointer-events-none select-none">
                  <span>Space · Play/Pause</span>
                  <span className="w-px h-3 bg-white/10" />
                  <span>← → · Seek 10s</span>
                  <span className="w-px h-3 bg-white/10" />
                  <span>M · Mute</span>
                  <span className="w-px h-3 bg-white/10" />
                  <span>F · Fullscreen</span>
                </div>
              </div>
            ) : isPlaying ? (
              <iframe src={trailerUrl} className="w-full h-full border-none" allowFullScreen title="Trailer" />
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};

export default MovieDetails;
