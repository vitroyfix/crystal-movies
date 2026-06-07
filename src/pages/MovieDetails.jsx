import React, { useState, useEffect, useRef, useCallback, useId } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { fetchMovieDetails, fetchSeasonDetails } from "../services/api";
import {
  Play,
  X,
  Plus,
  Check,
  Star,
  Calendar,
  Globe,
  ShieldCheck,
  Loader2,
  ArrowLeft,
  FileText,
  User,
  Volume2,
  VolumeX,
  Maximize,
  ChevronRight,
  ChevronLeft,
  Clock,
  Film,
  Tv,
  Zap,
  Pause,
  SkipForward,
  Settings,
  Minimize,
  TrendingUp,
  Award,
  Users,
  Info,
  BookOpen,
  ChevronDown,
  ExternalLink,
  Heart,
  Share2,
  Bookmark,
} from "lucide-react";
import useTrailer from "../hooks/useTrailer";
import Hls from "hls.js";
import { auth } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { supabase } from "../../src/services/supabaseClient";
import languages from "../data/langs.json";

// ─── Constants ────────────────────────────────────────────────────────────────
const BACKEND_URL = "https://matched-radio-implies-was.trycloudflare.com/api/fetch-stream";
const SUBS_URL    = "https://matched-radio-implies-was.trycloudflare.com/api/subs";
const API_KEY = import.meta.env.VITE_API_KEY;
const TMDB_KEY = import.meta.env.VITE_TMDB_API_KEY;
const TMDB_BASE = "https://api.themoviedb.org/3";
const IMG = "https://image.tmdb.org/t/p";
const backendBase = BACKEND_URL.replace("/api/fetch-stream", "");

const WATCHDOG_MANIFEST_MS = 25_000;
const WATCHDOG_BUFFER_MS = 20_000;
const ALT_POLL_INTERVAL_MS = 3_000;
const ALT_POLL_MAX_ATTEMPTS = 10;
const MAX_AUTO_RETRIES = 8;
const RETRY_DELAY_MS = 3_000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const NEXT_EP_SHOW_BEFORE_END_S = 90;
const AUTO_NEXT_COUNTDOWN_S = 15;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const getLanguageName = (code, langList) => {
  if (!code) return "—";
  const lang = langList.find((l) => l.iso_639_1 === code.toLowerCase());
  return lang ? lang.english_name : code.toUpperCase();
};

const fmtTime = (secs) => {
  if (!secs || isNaN(secs)) return "0:00";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  if (h > 0)
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
};

const srtToVtt = (srtText) =>
  "WEBVTT\n\n" +
  srtText
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2");

function parseProxyUrl(proxyUrl) {
  try {
    const params = new URLSearchParams(proxyUrl.split("?")[1] || "");
    const keyParam = params.get("key") || "";
    if (keyParam.startsWith("mapi:"))
      return { cacheKey: keyParam.slice(5), source: "mapi" };
    return { cacheKey: keyParam, source: "vidapi" };
  } catch {
    return { cacheKey: "", source: "vidapi" };
  }
}

// ─── Cast Filmography Modal ───────────────────────────────────────────────────
const CastModal = ({ member, onClose, navigate }) => {
  const [credits, setCredits] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("movies");

  useEffect(() => {
    const fetchCredits = async () => {
      try {
        const [detRes, credRes] = await Promise.all([
          fetch(`${TMDB_BASE}/person/${member.id}?language=en-US`, {
            headers: {
              Authorization: `Bearer ${TMDB_KEY}`,
              accept: "application/json",
            },
          }),
          fetch(
            `${TMDB_BASE}/person/${member.id}/combined_credits?language=en-US`,
            {
              headers: {
                Authorization: `Bearer ${TMDB_KEY}`,
                accept: "application/json",
              },
            },
          ),
        ]);
        const [det, cred] = await Promise.all([detRes.json(), credRes.json()]);
        setCredits({ ...det, ...cred });
      } catch {
      } finally {
        setLoading(false);
      }
    };
    fetchCredits();
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [member.id]);

  const movies =
    credits?.cast
      ?.filter((c) => c.media_type === "movie" && c.poster_path)
      .sort((a, b) => (b.vote_count || 0) - (a.vote_count || 0))
      .slice(0, 18) || [];
  const shows =
    credits?.cast
      ?.filter((c) => c.media_type === "tv" && c.poster_path)
      .sort((a, b) => (b.vote_count || 0) - (a.vote_count || 0))
      .slice(0, 18) || [];
  const items = activeTab === "movies" ? movies : shows;

  return (
    <div
      className="fixed inset-0 z-[500] flex items-end sm:items-center justify-center p-0 sm:p-6"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      <div
        className="relative w-full sm:max-w-2xl max-h-[92svh] sm:max-h-[85vh] rounded-t-3xl sm:rounded-2xl overflow-hidden flex flex-col cast-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4 p-5 sm:p-6 border-b border-white/[0.07] bg-[#0f0f0f]">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden flex-shrink-0 border border-white/10">
            {member.profile_path ? (
              <img
                src={`${IMG}/w185${member.profile_path}`}
                alt={member.name}
                className="w-full h-full object-cover object-top"
              />
            ) : (
              <div className="w-full h-full bg-neutral-800 flex items-center justify-center">
                <User size={24} className="text-neutral-500" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0 pt-1">
            <h3 className="text-lg sm:text-xl font-bold text-white truncate">
              {member.name}
            </h3>
            {member.character && (
              <p className="text-[11px] text-amber-400/70 font-medium tracking-wide mt-0.5">
                as {member.character}
              </p>
            )}
            {credits?.birthday && (
              <p className="text-[10px] text-white/30 mt-1.5 flex items-center gap-1.5">
                <Calendar size={9} />
                {new Date(credits.birthday).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
                {credits.place_of_birth && ` · ${credits.place_of_birth}`}
              </p>
            )}
            {credits?.biography && (
              <p className="text-[11px] text-white/40 mt-2 line-clamp-2 leading-relaxed">
                {credits.biography}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all hover:bg-white/10"
            style={{ border: "1px solid rgba(255,255,255,0.1)" }}
          >
            <X size={14} className="text-white/50" />
          </button>
        </div>

        {credits && (
          <div className="flex divide-x divide-white/[0.06] bg-[#0d0d0d] px-5 sm:px-6">
            {[
              {
                label: "Movies",
                val:
                  credits.cast?.filter((c) => c.media_type === "movie")
                    .length || 0,
              },
              {
                label: "TV Shows",
                val:
                  credits.cast?.filter((c) => c.media_type === "tv").length ||
                  0,
              },
              {
                label: "Known For",
                val: credits.known_for_department || "Acting",
              },
            ].map(({ label, val }) => (
              <div key={label} className="flex-1 py-3 text-center">
                <p className="text-sm font-bold text-white/80">{val}</p>
                <p className="text-[9px] uppercase tracking-widest text-white/25 mt-0.5 font-medium">
                  {label}
                </p>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-1 px-5 sm:px-6 pt-4 pb-2 bg-[#0f0f0f]">
          {[
            { key: "movies", label: `Movies (${movies.length})` },
            { key: "tv", label: `TV Shows (${shows.length})` },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`tab-pill flex-shrink-0 ${activeTab === t.key ? "tab-pill-active" : "tab-pill-inactive"}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto thin-scroll bg-[#0f0f0f] p-4 sm:p-5">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 rounded-full border-t-amber-400 border-r-transparent border-b-transparent border-l-transparent border-[1.5px] animate-spin" />
             </div>
          ) : items.length === 0 ? (
            <div className="text-center py-12 text-white/25 text-sm">
              No {activeTab} found
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
              {items.map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    onClose();
                    navigate(
                      `/details/${item.media_type || (activeTab === "movies" ? "movie" : "tv")}/${item.id}`,
                    );
                    window.scrollTo({ top: 0 });
                  }}
                  className="group cursor-pointer rounded-xl overflow-hidden filmography-card"
                >
                  <div className="relative aspect-[2/3]">
                    <img
                      src={`${IMG}/w342${item.poster_path}`}
                      alt={item.title || item.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <div className="absolute bottom-0 left-0 right-0 p-2 translate-y-1 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                      <p className="text-[9px] font-bold text-white truncate leading-tight">
                        {item.title || item.name}
                      </p>
                      {item.vote_average > 0 && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <Star
                            size={7}
                            className="text-amber-400 fill-amber-400"
                          />
                          <span className="text-[8px] text-amber-400 font-bold">
                            {item.vote_average.toFixed(1)}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center"
                        style={{ background: "rgba(212,168,83,0.85)" }}
                      >
                        <Play
                          size={12}
                          fill="black"
                          className="text-black ml-0.5"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Score Ring ───────────────────────────────────────────────────────────────
const ScoreRing = ({ score, size = 52 }) => {
  const uid = useId().replace(/[#:]/g, "");
  const gradientId = `sg-${uid}`;
  const num = parseFloat(score) || 0;
  const pct = (num / 10) * 100;
  const r = 18;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  if (!num) return null;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg
        className="rotate-[-90deg]"
        viewBox="0 0 44 44"
        width={size}
        height={size}
      >
        <circle
          cx="22"
          cy="22"
          r={r}
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="3"
          fill="none"
        />
        <circle
          cx="22"
          cy="22"
          r={r}
          stroke={`url(#${gradientId})`}
          strokeWidth="3"
          fill="none"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          style={{
            transition: "stroke-dasharray 1.4s cubic-bezier(0.4,0,0.2,1)",
          }}
        />
        <defs>
          <linearGradient
            id={gradientId}
            x1="0%"
            y1="0%"
            x2="100%"
            y2="0%"
          >
            <stop offset="0%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#ef4444" />
          </linearGradient>
        </defs>
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-white">
        {num.toFixed(1)}
      </span>
    </div>
  );
};

// ─── Related Card ─────────────────────────────────────────────────────────────
const RelatedCard = ({ item, onClick }) => {
  const title = item.title || item.name;
  const year = (item.release_date || item.first_air_date)?.split("-")[0];
  return (
    <div
      onClick={() => onClick(item)}
      className="related-card group cursor-pointer rounded-xl overflow-hidden aspect-[2/3] bg-neutral-900"
    >
      {item.poster_path ? (
        <img
          src={`${IMG}/w342${item.poster_path}`}
          alt={title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-neutral-900">
          <Film size={24} className="text-neutral-700" />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-400" />
      <div className="absolute bottom-0 left-0 right-0 p-2.5 translate-y-1 group-hover:translate-y-0 opacity-0 group-hover:opacity-100 transition-all duration-300">
        <p className="text-[10px] font-bold text-white truncate">{title}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          {year && <span className="text-[9px] text-white/40">{year}</span>}
          {item.vote_average > 0 && (
            <span className="flex items-center gap-0.5 text-[9px] text-amber-400 font-bold">
              <Star size={7} fill="currentColor" />
              {item.vote_average.toFixed(1)}
            </span>
          )}
        </div>
      </div>
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center"
          style={{ background: "rgba(212,168,83,0.85)" }}
        >
          <Play size={10} fill="black" className="text-black ml-0.5" />
        </div>
      </div>
    </div>
  );
};

// ─── Subtitle Style Menu ──────────────────────────────────────────────────────
const SubtitleStyleMenu = ({ subtitleStyle }) => (
  <div className="menu-popup absolute bottom-full right-0 mb-2 w-60">
    <p className="menu-label">Subtitle Style</p>
    <div className="p-4 space-y-3.5">
      {[
        {
          label: "Size",
          items: ["Small", "Medium", "Large", "XL"],
          val: subtitleStyle.size,
          set: subtitleStyle.setSize,
        },
        {
          label: "Background",
          items: ["None", "Box", "Shadow"],
          val: subtitleStyle.bg,
          set: subtitleStyle.setBg,
        },
      ].map(({ label, items, val, set }) => (
        <div key={label} className="space-y-1.5">
          <p className="text-[9px] text-white/25 uppercase tracking-widest font-semibold">
            {label}
          </p>
          <div className="flex gap-1">
            {items.map((it) => (
              <button
                key={it}
                onClick={() => set(it)}
                className={`flex-1 py-1.5 rounded-lg text-[9px] font-bold uppercase transition-all ${val === it ? "style-btn-active" : "style-btn"}`}
              >
                {it}
              </button>
            ))}
          </div>
        </div>
      ))}
      <div className="space-y-1.5">
        <p className="text-[9px] text-white/25 uppercase tracking-widest font-semibold">
          Color
        </p>
        <div className="flex gap-1.5">
          {[
            { n: "White", v: "#ffffff" },
            { n: "Yellow", v: "#fde047" },
            { n: "Cyan", v: "#67e8f9" },
          ].map((c) => (
            <button
              key={c.n}
              onClick={() => subtitleStyle.setColor(c.v)}
              className="flex-1 py-1.5 rounded-lg text-[9px] font-bold uppercase flex items-center justify-center gap-1 transition-all"
              style={{
                background:
                  subtitleStyle.color === c.v
                    ? c.v + "20"
                    : "rgba(255,255,255,0.04)",
                border: `1px solid ${subtitleStyle.color === c.v ? c.v + "60" : "rgba(255,255,255,0.08)"}`,
                color: c.v,
              }}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: c.v }}
              />
              {c.n}
            </button>
          ))}
        </div>
      </div>
    </div>
  </div>
);

// ─── Player Controls ──────────────────────────────────────────────────────────
const PlayerControls = ({
  videoRef,
  playerRef,
  isMuted,
  setIsMuted,
  subtitleTracks,
  selectedSubtitle,
  selectSubtitle,
  qualityLevels,
  selectedQuality,
  selectQuality,
  audioTracks,
  selectedAudio,
  toggleAudio,
  activeMenu,
  setActiveMenu,
  controlsRef,
  displayTitle,
  resolvedMediaType,
  selectedSeason,
  selectedEpisode,
  episodes,
  handleEpisodeSelect,
  activeStream,
  languages: langList,
  getLanguageName: getLangName,
  currentTime,
  duration,
  setCurrentTime,
  isPlaying,
  setIsPlaying,
  showNextEpBtn,
  nextEpisode,
  autoNextCountdown,
  cancelAutoNext,
  subtitleStyle,
}) => {
  const [showControls, setShowControls] = useState(true);
  const [volume, setVolume] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hoverTime, setHoverTime] = useState(null);
  const [hoverPct, setHoverPct] = useState(0);
  const seekBarRef = useRef(null);
  const hideTimer = useRef(null);

  const resetHideTimer = () => {
    setShowControls(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShowControls(false), 3500);
  };

  useEffect(() => {
    resetHideTimer();
    return () => clearTimeout(hideTimer.current);
  }, []);
  useEffect(() => {
    const fn = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", fn);
    return () => document.removeEventListener("fullscreenchange", fn);
  }, []);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().catch(() => {});
      setIsPlaying(true);
    } else {
      v.pause();
      setIsPlaying(false);
    }
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else playerRef.current?.requestFullscreen();
  };

  const handleVolumeChange = (e) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
      setIsMuted(val === 0);
    }
  };

  const handleMuteToggle = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setIsMuted(v.muted);
    if (!v.muted && volume === 0) {
      setVolume(0.5);
      v.volume = 0.5;
    }
  };

  const handleSeekClick = (e) => {
    const rect = seekBarRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const newTime = pct * (duration || 0);
    if (videoRef.current) videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleSeekHover = (e) => {
    const rect = seekBarRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverPct(pct * 100);
    setHoverTime(pct * (duration || 0));
  };

  const skip = (secs) => {
    if (videoRef.current)
      videoRef.current.currentTime = Math.max(
        0,
        Math.min(duration, videoRef.current.currentTime + secs),
      );
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      className="absolute inset-0 z-[200]"
      onMouseMove={resetHideTimer}
      onMouseLeave={() => {
        clearTimeout(hideTimer.current);
        hideTimer.current = setTimeout(() => setShowControls(false), 1200);
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) togglePlay();
      }}
    >
      {!isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{
              background: "rgba(0,0,0,0.5)",
              backdropFilter: "blur(8px)",
            }}
          >
            <Play size={28} fill="white" className="text-white ml-1" />
          </div>
        </div>
      )}

      <div
        className={`absolute top-0 left-0 right-0 px-5 md:px-10 pt-5 pb-20 transition-all duration-300 ${showControls ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        style={{
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0.88) 0%, transparent 100%)",
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-0.5 h-4 rounded-full bg-amber-400" />
            <div>
              <h2 className="text-xs md:text-sm font-semibold text-white tracking-wide truncate max-w-[55vw]">
                {displayTitle}
              </h2>
              {activeStream && resolvedMediaType === "tv" && (
                <p className="text-[10px] text-amber-400/60 font-medium mt-0.5">
                  Season {selectedSeason} · Episode {selectedEpisode}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {showNextEpBtn && nextEpisode && (
        <div className="absolute bottom-28 right-5 md:right-10 z-[210] flex flex-col items-end gap-2">
          {autoNextCountdown !== null && (
            <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs text-white/70 next-ep-badge">
              <div className="relative w-7 h-7">
                <svg className="rotate-[-90deg] w-7 h-7" viewBox="0 0 28 28">
                  <circle
                    cx="14"
                    cy="14"
                    r="11"
                    stroke="rgba(255,255,255,0.1)"
                    strokeWidth="2.5"
                    fill="none"
                  />
                  <circle
                    cx="14"
                    cy="14"
                    r="11"
                    stroke="#f59e0b"
                    strokeWidth="2.5"
                    fill="none"
                    strokeDasharray={`${(autoNextCountdown / AUTO_NEXT_COUNTDOWN_S) * 69.1} 69.1`}
                    strokeLinecap="round"
                    style={{ transition: "stroke-dasharray 1s linear" }}
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-[9px] font-black text-white">
                  {autoNextCountdown}
                </span>
              </div>
              <span className="text-[11px] font-medium">
                Up next in {autoNextCountdown}s
              </span>
              <button
                onClick={cancelAutoNext}
                className="text-[10px] uppercase tracking-widest text-white/30 hover:text-white/70 transition-colors ml-1"
              >
                Cancel
              </button>
            </div>
          )}
          <button
            onClick={() => handleEpisodeSelect(nextEpisode.episode_number)}
            className="flex items-center gap-2.5 px-5 py-3 rounded-xl text-[11px] font-bold text-black next-ep-btn uppercase tracking-wider"
          >
            <SkipForward size={14} fill="black" /> Next: E
            {nextEpisode.episode_number} · {nextEpisode.name}
          </button>
        </div>
      )}

      <div
        ref={controlsRef}
        className={`absolute bottom-0 left-0 right-0 px-4 md:px-8 pb-4 pt-20 transition-all duration-300 ${showControls ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        style={{
          background:
            "linear-gradient(to top, rgba(0,0,0,0.95) 0%, transparent 100%)",
        }}
      >
        <div
          className="mb-3.5 relative group cursor-pointer"
          ref={seekBarRef}
          onClick={handleSeekClick}
          onMouseMove={handleSeekHover}
          onMouseLeave={() => setHoverTime(null)}
        >
          {hoverTime !== null && (
            <div
              className="absolute -top-8 px-2 py-1 rounded-md text-[10px] font-mono text-white font-bold pointer-events-none"
              style={{
                left: `clamp(20px, calc(${hoverPct}% - 20px), calc(100% - 44px))`,
                background: "rgba(0,0,0,0.85)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              {fmtTime(hoverTime)}
            </div>
          )}
          <div className="relative h-[3px] group-hover:h-1.5 transition-all duration-150 rounded-full overflow-hidden">
            <div className="absolute inset-0 bg-white/10 rounded-full" />
            <div
              className="absolute top-0 left-0 h-full bg-white/15 rounded-full"
              style={{ width: `${hoverPct}%` }}
            />
            <div
              className="absolute top-0 left-0 h-full rounded-full seek-fill"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-amber-400 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
            style={{
              left: `calc(${progress}% - 7px)`,
              boxShadow: "0 0 8px rgba(212,168,83,0.7)",
            }}
          />
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 md:gap-2">
            <button
              onClick={togglePlay}
              className="ctrl-btn p-2.5 rounded-full"
            >
              {isPlaying ? (
                <Pause size={18} fill="white" className="text-white" />
              ) : (
                <Play size={18} fill="white" className="text-white" />
              )}
            </button>

            <button
              onClick={() => skip(-10)}
              className="ctrl-btn-sm hidden md:flex items-center justify-center w-8 h-8 rounded-full"
              title="-10s"
            >
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="white"
                opacity="0.7"
              >
                <path d="M12.5 3a9 9 0 1 0 9 9h-2a7 7 0 1 1-7-7V3z" />
                <path d="M15 3H9l3-3 3 3z" />
                <text
                  x="12"
                  y="16.5"
                  textAnchor="middle"
                  fontSize="6.5"
                  fill="white"
                  fontWeight="700"
                >
                  10
                </text>
              </svg>
            </button>
            <button
              onClick={() => skip(10)}
              className="ctrl-btn-sm hidden md:flex items-center justify-center w-8 h-8 rounded-full"
              title="+10s"
            >
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="white"
                opacity="0.7"
                style={{ transform: "scaleX(-1)" }}
              >
                <path d="M12.5 3a9 9 0 1 0 9 9h-2a7 7 0 1 1-7-7V3z" />
                <path d="M15 3H9l3-3 3 3z" />
                <text
                  x="12"
                  y="16.5"
                  textAnchor="middle"
                  fontSize="6.5"
                  fill="white"
                  fontWeight="700"
                >
                  10
                </text>
              </svg>
            </button>

            <div className="flex items-center gap-1.5 group/vol">
              <button
                onClick={handleMuteToggle}
                className="ctrl-btn-sm w-8 h-8 flex items-center justify-center rounded-full text-white/70 hover:text-white"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX size={16} />
                ) : (
                  <Volume2 size={16} />
                )}
              </button>
              <div className="w-0 overflow-hidden group-hover/vol:w-20 transition-all duration-300">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-20 vol-slider cursor-pointer"
                />
              </div>
            </div>

            <span className="text-[11px] text-white/40 font-mono hidden sm:block tracking-wider">
              {fmtTime(currentTime)} <span className="text-white/20">/</span>{" "}
              {fmtTime(duration)}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {audioTracks.length > 1 && (
              <button
                onClick={toggleAudio}
                className="ctrl-pill text-[9px] uppercase font-bold tracking-widest"
              >
                {selectedAudio}
              </button>
            )}

            {activeStream && qualityLevels.length > 0 && (
              <div className="relative">
                <button
                  onClick={() =>
                    setActiveMenu((p) => (p === "quality" ? null : "quality"))
                  }
                  className={`ctrl-pill text-[9px] uppercase font-bold tracking-widest ${activeMenu === "quality" ? "ctrl-pill-active" : ""}`}
                >
                  {selectedQuality === -1 || !qualityLevels[selectedQuality]
                    ? "Auto"
                    : `${qualityLevels[selectedQuality].height}p`}
                </button>
                {activeMenu === "quality" && (
                  <div className="menu-popup absolute bottom-full right-0 mb-2 min-w-[120px]">
                    <p className="menu-label">Quality</p>
                    {[
                      { label: "Auto", idx: -1 },
                      ...qualityLevels.map((l, i) => ({
                        label: `${l.height}p`,
                        idx: i,
                      })),
                    ].map(({ label, idx }) => (
                      <button
                        key={idx}
                        onClick={() => selectQuality(idx)}
                        className={`menu-item ${selectedQuality === idx ? "menu-item-active" : ""}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {subtitleTracks.length > 0 && (
              <div className="relative">
                <button
                  onClick={() =>
                    setActiveMenu((p) => (p === "subs" ? null : "subs"))
                  }
                  className={`ctrl-pill text-[9px] font-bold tracking-widest ${activeMenu === "subs" ? "ctrl-pill-active" : ""} ${selectedSubtitle !== -1 ? "ctrl-pill-on" : ""}`}
                >
                  CC
                  {selectedSubtitle !== -1 && (
                    <span className="hidden sm:inline opacity-60 ml-1 text-[8px] uppercase">
                      {getLangName(
                        subtitleTracks[selectedSubtitle]?.language,
                        langList,
                      )}
                    </span>
                  )}
                </button>
                {activeMenu === "subs" && (
                  <div className="menu-popup absolute bottom-full right-0 mb-2 min-w-[170px] max-h-64 overflow-y-auto thin-scroll">
                    <p className="menu-label">Subtitles</p>
                    <button
                      onClick={() => selectSubtitle(-1)}
                      className={`menu-item ${selectedSubtitle === -1 ? "menu-item-active" : ""}`}
                    >
                      Off
                    </button>
                    {subtitleTracks.map((t, i) => (
                      <button
                        key={i}
                        onClick={() => selectSubtitle(i)}
                        className={`menu-item ${selectedSubtitle === i ? "menu-item-active" : ""}`}
                      >
                        {getLangName(t.language, langList)}
                        {t.title ? ` · ${t.title}` : ""}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {subtitleTracks.length > 0 && (
              <div className="relative">
                <button
                  onClick={() =>
                    setActiveMenu((p) => (p === "subStyle" ? null : "subStyle"))
                  }
                  className={`ctrl-pill ${activeMenu === "subStyle" ? "ctrl-pill-active" : ""}`}
                >
                  <Settings size={11} />
                </button>
                {activeMenu === "subStyle" && (
                  <SubtitleStyleMenu subtitleStyle={subtitleStyle} />
                )}
              </div>
            )}

            <button onClick={toggleFullscreen} className="ctrl-pill">
              {isFullscreen ? <Minimize size={11} /> : <Maximize size={11} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────────
const MovieDetails = () => {
  const params = useParams();
  const navigate = useNavigate();
  const id = params.id;
  const resolvedMediaType = params.mediaType === "tv" ? "tv" : "movie";

  const [movie, setMovie] = useState(null);
  const [loading, setLoading] = useState(true);
  const [episodes, setEpisodes] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [isInList, setIsInList] = useState(false);
  const [isSavingList, setIsSavingList] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [selectedEpisode, setSelectedEpisode] = useState(1);
  const [resumeData, setResumeData] = useState(null);
  const [ageRating, setAgeRating] = useState("NR");
  const [cast, setCast] = useState([]);
  const [related, setRelated] = useState([]);
  const [relatedPage, setRelatedPage] = useState(1);
  const [relatedTotal, setRelatedTotal] = useState(0);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("episodes");
  const [episodeProgress, setEpisodeProgress] = useState({});
  const [selectedCastMember, setSelectedCastMember] = useState(null);
  const [expandedPlot, setExpandedPlot] = useState(false);
  const [keywords, setKeywords] = useState([]);
  const [collection, setCollection] = useState(null);

  const [activeStream, setActiveStream] = useState(null);
  const [cleanUrl, setCleanUrl] = useState(null);
  const [isCleaning, setIsCleaning] = useState(false);
  const [audioTracks, setAudioTracks] = useState([]);
  const [selectedAudio, setSelectedAudio] = useState("original");
  const [subtitleTracks, setSubtitleTracks] = useState([]);
  const [selectedSubtitle, setSelectedSubtitle] = useState(-1);
  const [qualityLevels, setQualityLevels] = useState([]);
  const [selectedQuality, setSelectedQuality] = useState(-1);
  const [activeMenu, setActiveMenu] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showNextEpBtn, setShowNextEpBtn] = useState(false);
  const [autoNextCountdown, setAutoNextCountdown] = useState(null);

  const autoNextRef = useRef(null);
  const autoNextCancelled = useRef(false);
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const progressInterval = useRef(null);
  const controlsRef = useRef(null);
  const castScrollRef = useRef(null);
  const playerRef = useRef(null);
  const blobUrlsRef = useRef([]);
  const fetchAbortRef = useRef(null);
  const watchdogManifestTimer = useRef(null);
  const watchdogBufferTimer = useRef(null);
  const watchdogFired = useRef(false);

  const [subSize, setSubSize] = useState("Medium");
  const [subBg, setSubBg] = useState("Box");
  const [subColor, setSubColor] = useState("#ffffff");
  const subtitleStyle = {
    size: subSize,
    setSize: setSubSize,
    bg: subBg,
    setBg: setSubBg,
    color: subColor,
    setColor: setSubColor,
  };

  const nextEpisode =
    resolvedMediaType === "tv"
      ? episodes.find((ep) => ep.episode_number === selectedEpisode + 1) || null
      : null;

  const getSubCss = () => {
    const sizes = {
      Small: "0.85rem",
      Medium: "1.1rem",
      Large: "1.4rem",
      XL: "1.8rem",
    };
    let bg = "";
    if (subBg === "Box")
      bg = `background-color: rgba(0,0,0,0.82); padding: 3px 10px; border-radius: 3px;`;
    if (subBg === "Shadow")
      bg = `text-shadow: 2px 2px 6px rgba(0,0,0,1), -1px -1px 4px rgba(0,0,0,1);`;
    return `video::cue { color: ${subColor}; font-size: ${sizes[subSize] || "1.1rem"}; font-family: 'Sora', sans-serif; ${bg} }
    video::-webkit-media-text-track-container { overflow: visible !important; z-index: 9999 !important; }`;
  };

  // ── Plumbing: watchdog, destroy, close ────────────────────────────────────
  const revokeBlobUrls = () => {
    blobUrlsRef.current.forEach(URL.revokeObjectURL);
    blobUrlsRef.current = [];
  };

  const clearWatchdog = () => {
    clearTimeout(watchdogManifestTimer.current);
    clearTimeout(watchdogBufferTimer.current);
    watchdogManifestTimer.current = null;
    watchdogBufferTimer.current = null;
  };

  const destroyVideo = useCallback(() => {
    clearWatchdog();
    watchdogFired.current = false;
    if (progressInterval.current) {
      clearInterval(progressInterval.current);
      progressInterval.current = null;
    }
    if (hlsRef.current) {
      hlsRef.current.stopLoad();
      hlsRef.current.detachMedia();
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    const v = videoRef.current;
    if (v) {
      try {
        v.pause();
      } catch (e) {}
    }
    revokeBlobUrls();
  }, []);

  const saveProgress = async (ct) => {
    if (!currentUser || !movie || !videoRef.current) return;
    const key =
      resolvedMediaType === "tv"
        ? `tv_${id}_s${selectedSeason}_e${selectedEpisode}`
        : `movie_${id}`;
    try {
      await supabase.from("user_progress").upsert(
        {
          user_id: currentUser.uid,
          media_id: key,
          time: ct,
          title: movie?.title || movie?.name,
          poster: movie?.backdrop_path || movie?.poster_path,
          type: resolvedMediaType,
          season: resolvedMediaType === "tv" ? selectedSeason : null,
          episode: resolvedMediaType === "tv" ? selectedEpisode : null,
          last_updated: new Date().toISOString(),
        },
        { onConflict: "user_id, media_id" },
      );
    } catch {}
  };

  const {
    trailerUrl,
    isPlaying: isTrailerPlaying,
    playTrailer,
    stopTrailer,
  } = useTrailer(
    id,
    resolvedMediaType,
    false,
    selectedSeason,
    movie?.title || movie?.name || "",
  );

  const closePlayer = useCallback(() => {
    if (fetchAbortRef.current) fetchAbortRef.current.abort();
    if (videoRef.current) saveProgress(videoRef.current.currentTime);
    stopTrailer();
    destroyVideo();
    setActiveStream(null);
    setCleanUrl(null);
    setActiveMenu(null);
    setShowNextEpBtn(false);
    setAutoNextCountdown(null);
    if (autoNextRef.current) clearInterval(autoNextRef.current);
  }, [destroyVideo, saveProgress, stopTrailer]);

  // ── Auth / Supabase ───────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) {
        setCurrentUser(u);
        checkIfInWatchlist(u.uid);
        fetchResumePoint(u.uid);
        fetchAllProgress(u.uid);
      }
    });
    return () => unsub();
  }, [id]);

  const fetchResumePoint = async (uid) => {
    try {
      const key = resolvedMediaType === "tv" ? `tv_${id}_%` : `movie_${id}`;
      const { data } = await supabase
        .from("user_progress")
        .select("*")
        .eq("user_id", uid)
        .ilike("media_id", key);
      if (!data?.length) return;
      if (resolvedMediaType === "tv") {
        const best = data.reduce(
          (p, c) =>
            c.season > p.season ||
            (c.season === p.season && c.episode > p.episode)
              ? c
              : p,
          data[0],
        );
        setResumeData({
          season: best.season,
          episode: best.episode,
          time: best.time,
        });
      } else setResumeData({ time: data[0].time });
    } catch {}
  };

  const fetchAllProgress = async (uid) => {
    try {
      const { data } = await supabase
        .from("user_progress")
        .select("media_id,time")
        .eq("user_id", uid)
        .ilike("media_id", `tv_${id}_%`);
      if (!data?.length) return;
      const map = {};
      data.forEach((r) => {
        const m = r.media_id.match(/s(\d+)_e(\d+)/);
        if (m) map[`s${m[1]}e${m[2]}`] = r.time;
      });
      setEpisodeProgress(map);
    } catch {}
  };

  const checkIfInWatchlist = async (uid) => {
    try {
      const { data } = await supabase
        .from("watchlist")
        .select("*")
        .eq("user_id", uid)
        .eq("media_id", id.toString())
        .maybeSingle();
      setIsInList(!!data);
    } catch {
      setIsInList(false);
    }
  };

  const handleWatchlistToggle = async () => {
    if (!currentUser) return alert("Please login to manage your list");
    setIsSavingList(true);
    try {
      if (isInList) {
        await supabase
          .from("watchlist")
          .delete()
          .eq("user_id", currentUser.uid)
          .eq("media_id", id.toString());
        setIsInList(false);
      } else {
        await supabase.from("watchlist").insert([
          {
            user_id: currentUser.uid,
            media_id: id.toString(),
            title: movie?.title || movie?.name,
            poster: movie?.poster_path || movie?.backdrop_path,
            type: resolvedMediaType,
            year:
              (movie?.release_date || movie?.first_air_date)?.split("-")[0] ||
              "N/A",
          },
        ]);
        setIsInList(true);
      }
    } catch {
    } finally {
      setIsSavingList(false);
    }
  };

  const getSavedProgress = async () => {
    if (!currentUser) return 0;
    const key =
      resolvedMediaType === "tv"
        ? `tv_${id}_s${selectedSeason}_e${selectedEpisode}`
        : `movie_${id}`;
    try {
      const { data } = await supabase
        .from("user_progress")
        .select("time")
        .eq("user_id", currentUser.uid)
        .eq("media_id", key)
        .maybeSingle();
      return data ? data.time : 0;
    } catch {
      return 0;
    }
  };

  // ── Auto-next ─────────────────────────────────────────────────────────────
  const startAutoNextCountdown = useCallback(() => {
    if (!nextEpisode || autoNextCancelled.current) return;
    setAutoNextCountdown(AUTO_NEXT_COUNTDOWN_S);
    let count = AUTO_NEXT_COUNTDOWN_S;
    autoNextRef.current = setInterval(() => {
      count -= 1;
      setAutoNextCountdown(count);
      if (count <= 0) {
        clearInterval(autoNextRef.current);
        if (!autoNextCancelled.current)
          handleEpisodeSelect(nextEpisode.episode_number);
      }
    }, 1000);
  }, [nextEpisode]);

  const cancelAutoNext = () => {
    autoNextCancelled.current = true;
    if (autoNextRef.current) clearInterval(autoNextRef.current);
    setAutoNextCountdown(null);
  };

  // ── Time update ───────────────────────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !cleanUrl) return;
    const onTimeUpdate = () => {
      const ct = video.currentTime,
        dur = video.duration || 0;
      setCurrentTime(ct);
      setDuration(dur);
      if (resolvedMediaType === "tv" && nextEpisode && dur > 0) {
        const rem = dur - ct;
        setShowNextEpBtn(rem <= NEXT_EP_SHOW_BEFORE_END_S && rem > 0);
        if (
          rem <= AUTO_NEXT_COUNTDOWN_S &&
          rem > 0 &&
          autoNextCountdown === null &&
          !autoNextCancelled.current
        )
          startAutoNextCountdown();
      }
    };
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("play", () => setIsPlaying(true));
    video.addEventListener("pause", () => setIsPlaying(false));
    video.addEventListener("durationchange", () =>
      setDuration(video.duration || 0),
    );
    return () => {
      video.removeEventListener("timeupdate", onTimeUpdate);
    };
  }, [cleanUrl, nextEpisode, autoNextCountdown, startAutoNextCountdown]);

  // ── rotateToAlt / swapHlsSource ───────────────────────────────────────────
  const rotateToAlt = useCallback(
    async (stalledUrl) => {
      if (watchdogFired.current) return;
      watchdogFired.current = true;
      clearWatchdog();
      const { cacheKey, source } = parseProxyUrl(stalledUrl);
      if (!cacheKey) {
        triggerBackendFetch(
          id,
          resolvedMediaType,
          selectedSeason,
          selectedEpisode,
        );
        return;
      }
      const resumeAt = videoRef.current?.currentTime || 0;
      for (let i = 0; i < ALT_POLL_MAX_ATTEMPTS; i++) {
        try {
          const res = await fetch(
            `${backendBase}/api/stream-alt/${encodeURIComponent(cacheKey)}?current=${source}`,
            { headers: { "X-API-Key": API_KEY } },
          );
          const data = await res.json();
          if (data.ready && data.url) {
            swapHlsSource(`${backendBase}${data.url}`, resumeAt);
            return;
          }
        } catch {}
        await sleep(ALT_POLL_INTERVAL_MS);
      }
      triggerBackendFetch(
        id,
        resolvedMediaType,
        selectedSeason,
        selectedEpisode,
      );
    },
    [id, resolvedMediaType, selectedSeason, selectedEpisode],
  );

  const swapHlsSource = useCallback((newUrl, resumeAt = 0) => {
    const video = videoRef.current;
    if (!video) return;
    if (hlsRef.current) {
      hlsRef.current.stopLoad();
      hlsRef.current.detachMedia();
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    setCleanUrl(newUrl);
    const onReady = () => {
      if (resumeAt > 0 && videoRef.current)
        videoRef.current.currentTime = resumeAt;
    };
    video.addEventListener("canplay", onReady, { once: true });
  }, []);

  // ── triggerBackendFetch ───────────────────────────────────────────────────
  const triggerBackendFetch = useCallback(
    async (mId, mType, s, e) => {
      if (fetchAbortRef.current) fetchAbortRef.current.abort();
      const ctrl = new AbortController();
      fetchAbortRef.current = ctrl;

      setIsCleaning(true);
      setCleanUrl(null);
      setActiveMenu(null);
      setSubtitleTracks([]);
      setSelectedSubtitle(-1);
      setShowNextEpBtn(false);
      setAutoNextCountdown(null);
      autoNextCancelled.current = false;
      if (autoNextRef.current) clearInterval(autoNextRef.current);
      clearWatchdog();
      revokeBlobUrls();
      destroyVideo();

      const payload = { id: mId, type: mType, s, e };

      for (let attempt = 0; attempt <= MAX_AUTO_RETRIES; attempt++) {
        if (ctrl.signal.aborted) return;
        if (attempt > 0) {
          await sleep(RETRY_DELAY_MS);
          if (ctrl.signal.aborted) return;
        }
        try {
          const res = await fetch(BACKEND_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-API-Key": API_KEY,
            },
            body: JSON.stringify(payload),
            signal: ctrl.signal,
          });
          if (!res.ok) {
            if (res.status === 401) return;
            if (res.status === 429) {
              await sleep(10_000);
              continue;
            }
            continue;
          }
          const data = await res.json();
          if (data.success && data.url) {
            if (ctrl.signal.aborted) return;
            setCleanUrl(`${backendBase}${data.url}`);
            fetchSubtitles(mId, mType, s, e);
            if (!ctrl.signal.aborted) setIsCleaning(false);
            return;
          }
          if (data.queued && data.jobId) {
            const streamUrl = await pollJobStatus(data.jobId, ctrl.signal);
            if (ctrl.signal.aborted) return;
            if (streamUrl) {
              setCleanUrl(`${backendBase}${streamUrl}`);
              fetchSubtitles(mId, mType, s, e);
              if (!ctrl.signal.aborted) setIsCleaning(false);
              return;
            }
          }
        } catch (err) {
          if (err.name === "AbortError") return;
        }
      }

      if (!ctrl.signal.aborted) setIsCleaning(false);
    },
    [destroyVideo],
  );

  const pollJobStatus = async (jobId, signal) => {
    for (let i = 0; i < 60; i++) {
      if (signal.aborted) return null;
      await sleep(2_000);
      if (signal.aborted) return null;
      try {
        const res = await fetch(
          `${backendBase}/api/fetch-status/${encodeURIComponent(jobId)}`,
          { headers: { "X-API-Key": API_KEY }, signal },
        );
        if (!res.ok) continue;
        const data = await res.json();
        if (data.success && data.url) return data.url;
        if (data.state === "failed") return null;
      } catch (err) {
        if (err.name === "AbortError") return null;
      }
    }
    return null;
  };

  const fetchSubtitles = async (mId, mType, s, e) => {
    try {
      const res = await fetch(SUBS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": API_KEY },
        body: JSON.stringify({
          imdbId: mId,
          type: mType,
          season: s,
          episode: e,
        }),
      });
      if (!res.ok) return;
      const result = await res.json();
      const converted = await Promise.allSettled(
        (result.tracks || []).map(async (track) => {
          const subRes = await fetch(`${backendBase}${track.uri}`, {
            headers: { "X-API-Key": API_KEY },
          });
          if (!subRes.ok) throw new Error();
          const vttText = srtToVtt(await subRes.text());
          const blob = new Blob([vttText], { type: "text/vtt" });
          const blobUrl = URL.createObjectURL(blob);
          blobUrlsRef.current.push(blobUrl);
          return { title: track.title, language: track.language, src: blobUrl };
        }),
      );
      const tracks = converted
        .filter((r) => r.status === "fulfilled")
        .map((r) => r.value);
      setSubtitleTracks(tracks);
      const enIdx = tracks.findIndex((t) => t.language === "en");
      setSelectedSubtitle(enIdx !== -1 ? enIdx : tracks.length > 0 ? 0 : -1);
    } catch {}
  };

  // ── HLS init ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!cleanUrl || !videoRef.current) return;
    let isCancelled = false;
    const video = videoRef.current;
    clearWatchdog();
    watchdogFired.current = false;

    const handlePlaying = () => {
      clearTimeout(watchdogBufferTimer.current);
      clearTimeout(watchdogManifestTimer.current);
    };

    const handlePause = () => saveProgress(video.currentTime);

    const handleEnded = () => {
      saveProgress(0);
      setIsPlaying(false);
      if (resolvedMediaType === "tv" && nextEpisode) {
        handleEpisodeSelect(nextEpisode.episode_number);
      } else {
        setActiveStream(null);
      }
    };

    const handleStalled = () => {
      console.warn("Video stalled — HLS.js nudger will recover");
    };

    const handleWaiting = () => {
      // Normal buffering pause — do nothing
    };

    const initPlayer = async () => {
      const savedTimePromise = getSavedProgress();

      watchdogManifestTimer.current = setTimeout(
        () => rotateToAlt(cleanUrl),
        WATCHDOG_MANIFEST_MS,
      );

      try {
        const res = await fetch(cleanUrl, { method: "HEAD" });
        if (isCancelled) return;
        
        const ct = res.headers.get("content-type") || "";

        // Intercept 403/404 errors AND invalid content types (like JSON API errors or GIF anti-bot traps) 
        if (!res.ok || ct.includes("application/json") || ct.includes("text/html") || ct.includes("image/")) {
          console.warn(`[initPlayer] Stream invalid (Status: ${res.status}, Type: ${ct}). Invalidating cache...`);
          clearWatchdog();
          const { cacheKey, source } = parseProxyUrl(cleanUrl);
          if (cacheKey) {
            // Tell backend to purge this dead stream
            await fetch(`${backendBase}/api/validate-stream`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "X-API-Key": API_KEY },
              body: JSON.stringify({ cacheKey, source }),
            }).catch(() => {});
          }
          
          if (isCancelled) return;

          await new Promise(r => setTimeout(r, 600));
          if (isCancelled) return;

          rotateToAlt(cleanUrl);
          return;
        }

        if (ct.includes("mpegurl") || cleanUrl.includes(".m3u8")) {
          if (Hls.isSupported()) {
            if (hlsRef.current) hlsRef.current.destroy();

            hlsRef.current = new Hls({
              xhrSetup: (xhr) => {
                xhr.withCredentials = false;
              },
              enableWorker: true,
              startLevel: -1,
              capLevelToPlayerSize: true,
              maxBufferLength: 30,
              maxMaxBufferLength: 60,
              maxBufferSize: 60 * 1000 * 1000,
              backBufferLength: 15,
              abrEwmaDefaultEstimate: 1_000_000,
              abrBandWidthFactor: 0.85,
              abrBandWidthUpFactor: 0.6,
              manifestLoadingMaxRetry: 4,
              manifestLoadingRetryDelay: 1000,
              fragLoadingMaxRetry: 6,
              fragLoadingRetryDelay: 1000,
              levelLoadingMaxRetry: 4,
              levelLoadingRetryDelay: 1000,
              nudgeMaxRetry: 5,
              nudgeOffset: 0.2,
              lowLatencyMode: false,
            });

            hlsRef.current.loadSource(cleanUrl);
            hlsRef.current.attachMedia(video);

            hlsRef.current.on(Hls.Events.MANIFEST_PARSED, async () => {
              clearTimeout(watchdogManifestTimer.current);
              setAudioTracks(hlsRef.current.audioTracks);
              setQualityLevels(hlsRef.current.levels || []);
              setSelectedQuality(-1);

              const savedTime = await savedTimePromise;
              if (savedTime > 0) video.currentTime = savedTime;
              video.play().catch(() => {});
              setIsPlaying(true);

              watchdogBufferTimer.current = setTimeout(() => {
                if (!video || video.readyState >= 3 || video.paused) return;
                rotateToAlt(cleanUrl);
              }, WATCHDOG_BUFFER_MS);
            });

            hlsRef.current.on(Hls.Events.ERROR, (_, data) => {
              if (!data.fatal) return;

              if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
                console.warn("HLS media error — attempting auto-recovery");
                hlsRef.current?.recoverMediaError();
                return;
              }

              clearWatchdog();

              if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
                hlsRef.current?.startLoad();
                setTimeout(() => {
                  if (
                    videoRef.current &&
                    videoRef.current.readyState < 3 &&
                    !videoRef.current.paused &&
                    !watchdogFired.current
                  ) {
                    rotateToAlt(cleanUrl);
                  }
                }, 12_000);
              } else {
                rotateToAlt(cleanUrl);
              }
            });
          } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
            // Safari native HLS
            video.src = cleanUrl;
            video.addEventListener(
              "loadedmetadata",
              async () => {
                clearTimeout(watchdogManifestTimer.current);
                const savedTime = await savedTimePromise;
                if (savedTime > 0) video.currentTime = savedTime;
                video.play().catch(() => {});
                setIsPlaying(true);
              },
              { once: true },
            );
          }
        } else {
          // Direct MP4
          clearWatchdog();
          video.src = cleanUrl;
          video.type = "video/mp4";
          video.addEventListener(
            "loadedmetadata",
            async () => {
              const savedTime = await savedTimePromise;
              if (savedTime > 0) video.currentTime = savedTime;
              video.play().catch(() => {});
              setIsPlaying(true);
            },
            { once: true },
          );
        }
      } catch (err) {
        if (!isCancelled && err.name !== 'AbortError') {
           console.warn("[initPlayer] Network error during stream check:", err);
           clearWatchdog();
           rotateToAlt(cleanUrl);
        }
      }

      // Attach event listeners (handlers defined at useEffect scope level)
      video.addEventListener("playing", handlePlaying);
      video.addEventListener("pause", handlePause);
      video.addEventListener("ended", handleEnded);
      video.addEventListener("stalled", handleStalled);
      video.addEventListener("waiting", handleWaiting);
    };

    initPlayer();

    progressInterval.current = setInterval(() => {
      if (video && !video.paused && !video.ended)
        saveProgress(video.currentTime);
    }, 15_000);

    return () => {
      isCancelled = true;
      video.removeEventListener("playing", handlePlaying);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("ended", handleEnded);
      video.removeEventListener("stalled", handleStalled);
      video.removeEventListener("waiting", handleWaiting);
      clearWatchdog();
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
        progressInterval.current = null;
      }
    };
  }, [cleanUrl]);

  // ── Subtitle track sync ───────────────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const apply = () => {
      const t = video.textTracks;
      if (!t) return;
      for (let i = 0; i < t.length; i++)
        t[i].mode = i === selectedSubtitle ? "showing" : "hidden";
    };
    apply();
    const timer = setTimeout(apply, 200);
    return () => clearTimeout(timer);
  }, [selectedSubtitle, subtitleTracks, cleanUrl]);

  // ── Global key events ────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeStream) return;
    const fn = (e) => {
      const v = videoRef.current;
      if (!v || ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName))
        return;
      switch (e.key) {
        case " ":
        case "k":
          e.preventDefault();
          v.paused ? v.play().catch(()=>{}) : v.pause();
          setIsPlaying(!v.paused);
          break;
        case "ArrowRight":
          v.currentTime = Math.min(v.duration, v.currentTime + 10);
          break;
        case "ArrowLeft":
          v.currentTime = Math.max(0, v.currentTime - 10);
          break;
        case "ArrowUp":
          v.volume = Math.min(1, v.volume + 0.1);
          break;
        case "ArrowDown":
          v.volume = Math.max(0, v.volume - 0.1);
          break;
        case "m":
          v.muted = !v.muted;
          setIsMuted(v.muted);
          break;
        case "f":
          document.fullscreenElement
            ? document.exitFullscreen()
            : playerRef.current?.requestFullscreen();
          break;
      }
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [activeStream]);

  // ── Menu close on outside click ───────────────────────────────────────────
  useEffect(() => {
    const fn = (e) => {
      if (controlsRef.current && !controlsRef.current.contains(e.target))
        setActiveMenu(null);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  // ── Unhandled rejection suppressor ───────────────────────────────────────
  useEffect(() => {
    const fn = (e) => {
      const r = e.reason;
      if (
        r instanceof DOMException &&
        (r.message.includes("aborted") ||
          r.message.includes("Invalid URI") ||
          r.message.includes("media resource") ||
          r.message.includes("The fetching process"))
      ) {
        e.preventDefault();
      }
    };
    window.addEventListener("unhandledrejection", fn);
    return () => window.removeEventListener("unhandledrejection", fn);
  }, []);

  // ── Data loading ──────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await fetchMovieDetails(id, resolvedMediaType);
        setMovie(data);
        if (resolvedMediaType === "tv" && data.seasons?.length) {
          const first =
            data.seasons.find((s) => s.season_number > 0) || data.seasons[0];
          setSelectedSeason(first.season_number);
          setSelectedEpisode(1);
        }
        try {
          const certEndpoint =
            resolvedMediaType === "movie" ? "release_dates" : "content_ratings";
          const certRes = await fetch(
            `${TMDB_BASE}/${resolvedMediaType}/${id}/${certEndpoint}`,
            {
              headers: {
                Authorization: `Bearer ${TMDB_KEY}`,
                accept: "application/json",
              },
            },
          );
          const certData = await certRes.json();
          let cert = "NR";
          if (resolvedMediaType === "movie" && certData.results) {
            const us = certData.results.find((r) => r.iso_3166_1 === "US");
            const vc = us?.release_dates?.find((rd) => rd.certification);
            if (vc) cert = vc.certification;
          } else if (resolvedMediaType === "tv" && certData.results) {
            const us = certData.results.find((r) => r.iso_3166_1 === "US");
            if (us?.rating) cert = us.rating;
          }
          setAgeRating(cert || "NR");
        } catch {
          setAgeRating("NR");
        }
        try {
          const kwRes = await fetch(
            `${TMDB_BASE}/${resolvedMediaType}/${id}/keywords`,
            {
              headers: {
                Authorization: `Bearer ${TMDB_KEY}`,
                accept: "application/json",
              },
            },
          );
          const kwData = await kwRes.json();
          setKeywords((kwData.keywords || kwData.results || []).slice(0, 12));
        } catch {}
        if (resolvedMediaType === "movie" && data?.belongs_to_collection) {
          try {
            const colRes = await fetch(
              `${TMDB_BASE}/collection/${data.belongs_to_collection.id}`,
              {
                headers: {
                  Authorization: `Bearer ${TMDB_KEY}`,
                  accept: "application/json",
                },
              },
            );
            setCollection(await colRes.json());
          } catch {}
        }
      } catch {
      } finally {
        setLoading(false);
      }
    }
    load();
    fetchCastData();
    fetchRelated();
  }, [id, resolvedMediaType]);

  useEffect(() => {
    if (resolvedMediaType === "tv" && selectedSeason)
      fetchSeasonDetails(id, selectedSeason).then((eps) =>
        setEpisodes(eps || []),
      );
  }, [selectedSeason, id, resolvedMediaType]);

  const fetchCastData = async () => {
    try {
      const res = await fetch(
        `${TMDB_BASE}/${resolvedMediaType}/${id}/credits`,
        {
          headers: {
            Authorization: `Bearer ${TMDB_KEY}`,
            accept: "application/json",
          },
        },
      );
      const data = await res.json();
      setCast((data.cast || []).slice(0, 24));
    } catch {}
  };

  const fetchRelated = async (page = 1) => {
    setRelatedLoading(true);
    try {
      const res = await fetch(
        `${TMDB_BASE}/${resolvedMediaType}/${id}/recommendations?page=${page}`,
        {
          headers: {
            Authorization: `Bearer ${TMDB_KEY}`,
            accept: "application/json",
          },
        },
      );
      const data = await res.json();
      setRelated((data.results || []).filter((r) => r.poster_path));
      setRelatedTotal(data.total_pages || 1);
      setRelatedPage(page);
    } catch {
    } finally {
      setRelatedLoading(false);
    }
  };

  const handleEpisodeSelect = (epNum) => {
    if (isTrailerPlaying) stopTrailer();
    if (videoRef.current) saveProgress(videoRef.current.currentTime);
    autoNextCancelled.current = false;
    if (autoNextRef.current) clearInterval(autoNextRef.current);
    setAutoNextCountdown(null);
    setShowNextEpBtn(false);
    setSelectedEpisode(epNum);
    setActiveStream(true);
    setActiveMenu(null);
    triggerBackendFetch(id, resolvedMediaType, selectedSeason, epNum);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleResumeClick = () => {
    if (isTrailerPlaying) stopTrailer();
    if (resolvedMediaType === "tv" && resumeData) {
      setSelectedSeason(resumeData.season);
      setSelectedEpisode(resumeData.episode);
      setActiveStream(true);
      triggerBackendFetch(id, "tv", resumeData.season, resumeData.episode);
    } else {
      if (resolvedMediaType === "tv") {
        setSelectedEpisode(1);
        triggerBackendFetch(id, "tv", selectedSeason, 1);
      } else
        triggerBackendFetch(
          id,
          resolvedMediaType,
          selectedSeason,
          selectedEpisode,
        );
      setActiveStream(true);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleRelatedClick = (item) => {
    closePlayer();
    const type = item.media_type || (item.title ? "movie" : "tv");
    navigate(`/details/${type}/${item.id}`);
    window.scrollTo({ top: 0 });
  };

  const toggleAudio = () => {
    if (audioTracks.length > 1 && hlsRef.current) {
      const next = (hlsRef.current.audioTrack + 1) % audioTracks.length;
      hlsRef.current.audioTrack = next;
      setSelectedAudio(next === 0 ? "original" : "english");
    }
  };

  const selectSubtitle = (i) => {
    setSelectedSubtitle(i);
    setActiveMenu(null);
  };
  const selectQuality = (i) => {
    setSelectedQuality(i);
    if (hlsRef.current) hlsRef.current.currentLevel = i;
    setActiveMenu(null);
  };
  const scrollCast = (dir) => {
    if (!castScrollRef.current) return;
    castScrollRef.current.scrollBy({ left: dir * 280, behavior: "smooth" });
  };

  useEffect(
    () => () => {
      if (fetchAbortRef.current) fetchAbortRef.current.abort();
      destroyVideo();
      if (autoNextRef.current) clearInterval(autoNextRef.current);
    },
    [],
  );

  // ── Loading / null states ─────────────────────────────────────────────────
  if (loading)
    return (
      <div className="min-h-screen bg-[#080808] flex items-center justify-center">
        <div className="flex flex-col items-center gap-5">
          <div className="relative w-14 h-14">
            <div className="absolute inset-0 rounded-full border border-amber-400/20 animate-ping" />
            <div className="w-14 h-14 rounded-full border-t-amber-400 border-r-transparent border-b-transparent border-l-transparent border-[1.5px] animate-spin" />
          </div>
          <p className="text-[10px] uppercase tracking-[0.4em] text-white/20 font-medium">
            Loading
          </p>
        </div>
      </div>
    );
  if (!movie) return null;

  const {
    title,
    name,
    badgeYear,
    rating,
    runtime,
    plot,
    backdrop_path,
    poster_path,
    director,
    writer,
    release_date,
    first_air_date,
    votes,
    genres,
    original_language,
    production_companies,
  } = movie;
  const displayTitle = title || name;
  const heroImage = backdrop_path
    ? `${IMG}/original${backdrop_path}`
    : `${IMG}/original${poster_path}`;
  const posterImage = poster_path ? `${IMG}/w500${poster_path}` : heroImage;
  const language = original_language?.toUpperCase() || "EN";
  const genre = genres?.map((g) => g.name).join(" · ") || "";

  const tabs = [
    ...(resolvedMediaType === "tv"
      ? [{ key: "episodes", label: "Episodes", Icon: Tv }]
      : []),
    ...(cast.length
      ? [{ key: "cast", label: "Cast & Crew", Icon: Users }]
      : []),
    ...(related.length
      ? [{ key: "related", label: "More Like This", Icon: Film }]
      : []),
  ];

  return (
    <div
      className="relative min-h-screen bg-[#080808] text-white overflow-x-hidden"
      style={{ fontFamily: "'Sora', sans-serif" }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=Playfair+Display:ital,wght@0,700;0,900;1,400;1,700&display=swap');
        :root { --gold:#d4a853; --gold-dim:rgba(212,168,83,0.12); --glass:rgba(255,255,255,0.03); --glass2:rgba(255,255,255,0.06); --border:rgba(255,255,255,0.07); --border2:rgba(255,255,255,0.13); }
        .font-display { font-family:'Playfair Display',serif; }
        .no-scrollbar::-webkit-scrollbar{display:none;}.no-scrollbar{-ms-overflow-style:none;scrollbar-width:none;}
        .thin-scroll::-webkit-scrollbar{width:2px;}.thin-scroll::-webkit-scrollbar-track{background:transparent;}.thin-scroll::-webkit-scrollbar-thumb{background:var(--gold);border-radius:9px;}
        @keyframes fadeUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        .a1{animation:fadeUp .55s ease .05s both}.a2{animation:fadeUp .55s ease .15s both}.a3{animation:fadeUp .55s ease .25s both}.a4{animation:fadeUp .55s ease .35s both}.a5{animation:fadeUp .55s ease .45s both}.aL{animation:fadeUp .55s ease .1s both}
        .play-btn{background:linear-gradient(135deg,#d4a853 0%,#b8892f 100%);box-shadow:0 8px 32px rgba(212,168,83,0.3),inset 0 1px 0 rgba(255,255,255,0.2);transition:all .25s cubic-bezier(.4,0,.2,1);}
        .play-btn:hover{box-shadow:0 14px 44px rgba(212,168,83,0.48),inset 0 1px 0 rgba(255,255,255,0.2);transform:translateY(-1px);}
        .play-btn:active{transform:scale(.98);}
        .btn-glass{background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);backdrop-filter:blur(20px);transition:all .2s ease;}
        .btn-glass:hover{background:rgba(255,255,255,0.09);border-color:rgba(255,255,255,0.18);}
        .watchlist-on{background:rgba(212,168,83,0.12);border:1px solid rgba(212,168,83,0.35);color:#d4a853;}
        .poster-glow{box-shadow:0 32px 80px rgba(0,0,0,0.75),0 0 0 1px rgba(255,255,255,0.05),0 0 60px rgba(212,168,83,0.04);}
        .ep-card{background:var(--glass);border:1px solid var(--border);transition:all .3s cubic-bezier(.4,0,.2,1);}
        .ep-card:hover{background:var(--glass2);border-color:var(--border2);transform:translateY(-2px);box-shadow:0 14px 40px rgba(0,0,0,0.4);}
        .ep-card-on{border-color:rgba(212,168,83,0.5)!important;box-shadow:0 0 0 1px rgba(212,168,83,0.2),0 14px 40px rgba(0,0,0,0.5);}
        .ep-prog{position:absolute;bottom:0;left:0;height:2px;background:linear-gradient(90deg,#d4a853,#f0c070);border-radius:0;}
        .stat-card{background:var(--glass);border:1px solid var(--border);border-radius:14px;transition:background .2s;}
        .stat-card:hover{background:var(--glass2);}
        .related-card{position:relative;border:1px solid rgba(255,255,255,0.06);transition:all .35s cubic-bezier(.4,0,.2,1);}
        .related-card:hover{border-color:rgba(212,168,83,0.3);transform:translateY(-4px);box-shadow:0 16px 40px rgba(0,0,0,0.5);}
        .filmography-card{border:1px solid rgba(255,255,255,0.06);transition:all .3s ease;}
        .filmography-card:hover{border-color:rgba(212,168,83,0.3);}
        .cast-modal{background:#0f0f0f;border:1px solid rgba(255,255,255,0.08);box-shadow:0 40px 100px rgba(0,0,0,0.8);}
        .cast-item{background:var(--glass);border:1px solid var(--border);transition:all .25s ease;cursor:pointer;}
        .cast-item:hover{background:var(--glass2);border-color:rgba(212,168,83,0.3);transform:translateY(-1px);}
        .kw-tag{display:inline-flex;align-items:center;padding:5px 12px;border-radius:20px;font-size:10px;font-weight:500;letter-spacing:.04em;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);color:rgba(255,255,255,0.4);transition:all .2s;}
        .kw-tag:hover{background:rgba(212,168,83,0.1);border-color:rgba(212,168,83,0.3);color:#d4a853;}
        .tab-pill{padding:8px 18px;border-radius:30px;font-size:11px;font-weight:600;letter-spacing:.05em;transition:all .2s;white-space:nowrap;flex-shrink:0;}
        .tab-pill-active{background:rgba(212,168,83,0.15);color:#d4a853;border:1px solid rgba(212,168,83,0.35);}
        .tab-pill-inactive{color:rgba(255,255,255,0.35);border:1px solid transparent;}
        .tab-pill-inactive:hover{color:rgba(255,255,255,0.65);background:rgba(255,255,255,0.04);}
        .season-sel{appearance:none;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:8px 14px;font-size:11px;font-weight:600;letter-spacing:.06em;color:rgba(255,255,255,0.75);cursor:pointer;outline:none;transition:all .2s;font-family:'Sora',sans-serif;}
        .season-sel:hover{background:rgba(255,255,255,0.07);}
        .divider{height:1px;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.07) 30%,rgba(255,255,255,0.07) 70%,transparent);}
        .ctrl-btn{background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.1);transition:all .2s;}
        .ctrl-btn:hover{background:rgba(255,255,255,0.14);transform:scale(1.06);}
        .ctrl-btn-sm{background:transparent;transition:all .2s;}
        .ctrl-btn-sm:hover{background:rgba(255,255,255,0.08);}
        .ctrl-pill{display:inline-flex;align-items:center;justify-content:center;gap:4px;padding:5px 10px;border-radius:8px;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.65);transition:all .2s;cursor:pointer;font-size:9px;}
        .ctrl-pill:hover{background:rgba(255,255,255,0.13);color:white;}
        .ctrl-pill-active{background:rgba(212,168,83,0.2)!important;border-color:rgba(212,168,83,0.5)!important;color:#d4a853!important;}
        .ctrl-pill-on{background:rgba(255,255,255,0.12)!important;border-color:rgba(255,255,255,0.22)!important;color:white!important;}
        .seek-fill{background:linear-gradient(90deg,#d4a853,#f0c070);}
        .vol-slider{-webkit-appearance:none;appearance:none;height:3px;border-radius:9px;background:rgba(255,255,255,0.2);cursor:pointer;}
        .vol-slider::-webkit-slider-thumb{-webkit-appearance:none;width:11px;height:11px;border-radius:50%;background:white;cursor:pointer;}
        .menu-popup{border-radius:14px;overflow:hidden;background:rgba(10,10,10,0.98);border:1px solid rgba(255,255,255,0.1);backdrop-filter:blur(24px);box-shadow:0 24px 60px rgba(0,0,0,0.75);}
        .menu-label{padding:10px 16px 8px;font-size:9px;text-transform:uppercase;letter-spacing:.12em;color:rgba(255,255,255,0.22);font-weight:600;border-bottom:1px solid rgba(255,255,255,0.06);}
        .menu-item{display:block;width:100%;padding:10px 16px;font-size:11px;text-align:left;color:rgba(255,255,255,0.5);transition:all .15s;cursor:pointer;}
        .menu-item:hover{background:rgba(212,168,83,0.12);color:white;}
        .menu-item-active{color:#d4a853!important;background:rgba(212,168,83,0.1)!important;font-weight:700;}
        .style-btn{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);color:rgba(255,255,255,0.35);transition:all .2s;}
        .style-btn:hover{color:white;background:rgba(255,255,255,0.08);}
        .style-btn-active{background:rgba(212,168,83,0.18);border:1px solid rgba(212,168,83,0.5);color:#d4a853;}
        .next-ep-badge{background:rgba(10,10,10,0.9);border:1px solid rgba(255,255,255,0.1);backdrop-filter:blur(16px);}
        .next-ep-btn{background:#d4a853;box-shadow:0 8px 24px rgba(212,168,83,0.4);transition:all .2s;}
        .next-ep-btn:hover{transform:translateY(-1px);box-shadow:0 12px 32px rgba(212,168,83,0.55);}
        .rating-badge{font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;padding:3px 7px;border-radius:5px;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.13);color:rgba(255,255,255,0.55);}
        .collection-card{background:var(--glass);border:1px solid var(--border);border-radius:14px;overflow:hidden;transition:all .3s ease;cursor:pointer;}
        .collection-card:hover{border-color:rgba(212,168,83,0.35);transform:translateY(-2px);box-shadow:0 12px 36px rgba(0,0,0,0.45);}
        ${getSubCss()}
      `}</style>

      <button
        onClick={() => {
          closePlayer();
          navigate(-1);
        }}
        className="fixed top-5 left-4 md:top-7 md:left-7 z-[60] flex items-center gap-2 px-3.5 py-2 rounded-full transition-all group"
        style={{
          background: "rgba(8,8,8,0.7)",
          backdropFilter: "blur(24px)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <ArrowLeft
          size={13}
          className="text-white/50 group-hover:text-white group-hover:-translate-x-0.5 transition-all"
        />
        <span className="text-[10px] font-semibold uppercase tracking-widest text-white/35 group-hover:text-white/70 hidden sm:inline transition-colors">
          Back
        </span>
      </button>

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div
        className="relative w-full overflow-hidden"
        style={{ height: "100svh", minHeight: 580, maxHeight: 920 }}
      >
        <img
          src={heroImage}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover object-center"
          style={{
            transform: "scale(1.07)",
            filter: "brightness(0.38) saturate(1.1)",
          }}
        />
        <div
          className="absolute inset-0 z-[1]"
          style={{
            background:
              "linear-gradient(105deg, rgba(8,8,8,0.98) 0%, rgba(8,8,8,0.78) 45%, rgba(8,8,8,0.15) 100%)",
          }}
        />
        <div
          className="absolute inset-0 z-[1]"
          style={{
            background:
              "linear-gradient(to top, #080808 0%, rgba(8,8,8,0.6) 30%, transparent 60%)",
          }}
        />
        <div
          className="absolute inset-0 z-[1]"
          style={{
            background:
              "radial-gradient(ellipse at 15% 65%, rgba(212,168,83,0.05) 0%, transparent 50%)",
          }}
        />
        <div
          className="absolute inset-0 z-[1] opacity-[0.03]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
            backgroundSize: "180px",
          }}
        />

        <div className="relative z-[3] h-full flex items-end md:items-center px-5 md:px-14 lg:px-20 pb-12 md:pb-0">
          {/* Mobile hero */}
          <div className="w-full flex flex-col md:hidden gap-5 a1">
            <div className="flex items-end gap-4">
              <div
                className="rounded-xl overflow-hidden poster-glow flex-shrink-0"
                style={{ width: 96, height: 144 }}
              >
                <img
                  src={posterImage}
                  alt={displayTitle}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0 pb-1">
                <div className="flex flex-wrap gap-1.5 mb-2">
                  <span className="kw-tag" style={{ fontSize: 9 }}>
                    {resolvedMediaType === "tv" ? "Series" : "Film"}
                  </span>
                  {genres?.slice(0, 1).map((g) => (
                    <span key={g.id} className="kw-tag" style={{ fontSize: 9 }}>
                      {g.name}
                    </span>
                  ))}
                </div>
                <h1
                  className="font-display font-bold text-white leading-tight"
                  style={{
                    fontSize: "clamp(1.7rem, 7vw, 2.4rem)",
                    fontStyle: "italic",
                    textShadow: "0 2px 20px rgba(0,0,0,0.8)",
                  }}
                >
                  {displayTitle}
                </h1>
                <div className="flex flex-wrap items-center gap-2 mt-2 text-[10px] text-white/40">
                  <span className="font-semibold text-white/60">
                    {badgeYear ||
                      (release_date || first_air_date)?.split("-")[0]}
                  </span>
                  <span className="rating-badge">{ageRating}</span>
                  {runtime && (
                    <span className="flex items-center gap-1">
                      <Clock size={9} />
                      {runtime}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {parseFloat(rating) > 0 && (
              <div className="flex items-center gap-3">
                <ScoreRing score={parseFloat(rating)} size={46} />
                <div>
                  <span className="text-sm font-bold text-white/80">
                    {parseFloat(rating).toFixed(1)}
                  </span>
                  <span className="text-[10px] text-white/25 ml-1">/ 10</span>
                  <p className="text-[9px] text-white/25 mt-0.5">
                    {votes?.toLocaleString()} ratings
                  </p>
                </div>
              </div>
            )}

            <p className="text-[13px] leading-relaxed text-white/50 line-clamp-3">
              {plot}
            </p>

            <div className="flex items-center gap-2">
              <button
                onClick={handleResumeClick}
                className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl text-[11px] font-bold uppercase tracking-wider text-black play-btn"
              >
                <Play size={14} fill="black" />
                {resumeData
                  ? resolvedMediaType === "tv"
                    ? `Resume S${resumeData.season}E${resumeData.episode}`
                    : "Resume"
                  : resolvedMediaType === "tv"
                    ? "Play S1 E1"
                    : "Stream Now"}
              </button>
              <button
                onClick={handleWatchlistToggle}
                disabled={isSavingList}
                className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${isInList ? "watchlist-on" : "btn-glass"}`}
              >
                {isSavingList ? (
                  <Loader2 size={15} className="animate-spin text-white/50" />
                ) : isInList ? (
                  <Check size={15} className="text-[#d4a853]" />
                ) : (
                  <Plus size={15} className="text-white/60" />
                )}
              </button>
              <button
                onClick={() => {
                  closePlayer();
                  playTrailer();
                }}
                className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 btn-glass"
              >
                <Play
                  size={13}
                  fill="rgba(255,255,255,0.45)"
                  className="text-white/45 ml-0.5"
                />
              </button>
            </div>
          </div>

          {/* Desktop hero */}
          <div className="hidden md:flex gap-12 lg:gap-16 items-end w-full max-w-5xl">
            <div
              className="flex-shrink-0 aL rounded-2xl overflow-hidden poster-glow"
              style={{ width: 210 }}
            >
              <img
                src={posterImage}
                alt={displayTitle}
                className="w-full aspect-[2/3] object-cover"
              />
            </div>

            <div className="flex-1 space-y-4 pb-8">
              <div className="flex flex-wrap gap-2 a1">
                <span
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-semibold uppercase tracking-widest"
                  style={{
                    background: "rgba(212,168,83,0.1)",
                    border: "1px solid rgba(212,168,83,0.25)",
                    color: "#d4a853",
                  }}
                >
                  <ShieldCheck size={9} /> Protected
                </span>
                <span className="kw-tag">
                  {resolvedMediaType === "tv" ? "Series" : "Film"}
                </span>
                {genres?.slice(0, 3).map((g) => (
                  <span key={g.id} className="kw-tag">
                    {g.name}
                  </span>
                ))}
              </div>

              <h1
                className="font-display font-bold text-white leading-[1.03] a2"
                style={{
                  fontSize: "clamp(2.8rem, 4.8vw, 4.4rem)",
                  fontStyle: "italic",
                  textShadow: "0 4px 30px rgba(0,0,0,0.5)",
                }}
              >
                {displayTitle}
              </h1>

              <div
                className="flex flex-wrap items-center gap-3 a2"
                style={{ fontSize: 11 }}
              >
                <span className="font-semibold text-white/70">
                  {badgeYear || (release_date || first_air_date)?.split("-")[0]}
                </span>
                <span className="w-px h-3 bg-white/15" />
                <span className="rating-badge">{ageRating}</span>
                {runtime && (
                  <>
                    <span className="w-px h-3 bg-white/15" />
                    <span className="flex items-center gap-1.5 text-white/40">
                      <Clock size={10} />
                      {runtime}
                    </span>
                  </>
                )}
                <span className="w-px h-3 bg-white/15" />
                <span className="text-white/30 uppercase tracking-wider">
                  {language}
                </span>
                {votes > 0 && (
                  <>
                    <span className="w-px h-3 bg-white/15" />
                    <span className="text-white/30">
                      {votes?.toLocaleString()} ratings
                    </span>
                  </>
                )}
              </div>

              {parseFloat(rating) > 0 && (
                <div className="flex items-center gap-4 a3">
                  <ScoreRing score={parseFloat(rating)} size={54} />
                  <div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-base font-bold text-white/90">
                        {parseFloat(rating).toFixed(1)}
                      </span>
                      <span className="text-[11px] text-white/30">/ 10</span>
                    </div>
                    <p className="text-[9px] text-white/25 mt-0.5">
                      Community Score
                    </p>
                  </div>
                  <div className="flex gap-1">
                    {Array.from({ length: 5 }, (_, i) => (
                      <Star
                        key={i}
                        size={12}
                        className={
                          i < Math.floor(parseFloat(rating) / 2)
                            ? "text-amber-400 fill-amber-400"
                            : "text-white/10"
                        }
                      />
                    ))}
                  </div>
                </div>
              )}

              <div className="a4">
                <p
                  className={`text-[13px] leading-relaxed text-white/55 max-w-[520px] ${expandedPlot ? "" : "line-clamp-3"}`}
                >
                  {plot}
                </p>
                {plot?.length > 180 && (
                  <button
                    onClick={() => setExpandedPlot((p) => !p)}
                    className="flex items-center gap-1 mt-1.5 text-[10px] font-semibold text-amber-400/60 hover:text-amber-400 transition-colors"
                  >
                    {expandedPlot ? "Show less" : "Read more"}{" "}
                    <ChevronDown
                      size={11}
                      className={`transition-transform ${expandedPlot ? "rotate-180" : ""}`}
                    />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2.5 a5">
                <button
                  onClick={handleResumeClick}
                  className="flex items-center gap-2.5 px-6 py-3.5 rounded-xl text-[11px] font-bold uppercase tracking-wider text-black play-btn"
                >
                  <Play size={14} fill="black" />
                  {resumeData
                    ? resolvedMediaType === "tv"
                      ? `Resume S${resumeData.season} · E${resumeData.episode}`
                      : "Resume"
                    : resolvedMediaType === "tv"
                      ? "Play S1 · E1"
                      : "Stream Now"}
                </button>
                <button
                  onClick={handleWatchlistToggle}
                  disabled={isSavingList}
                  className={`flex items-center gap-2 px-5 py-3.5 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all ${isInList ? "watchlist-on" : "btn-glass text-white/50"}`}
                >
                  {isSavingList ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : isInList ? (
                    <Check size={14} />
                  ) : (
                    <Plus size={14} />
                  )}
                  {isInList ? "Saved" : "My List"}
                </button>
                <button
                  onClick={() => {
                    closePlayer();
                    playTrailer();
                  }}
                  className="flex items-center gap-2 px-5 py-3.5 rounded-xl text-[11px] font-semibold uppercase tracking-wider btn-glass text-white/40 hover:text-white/70"
                >
                  <Play size={12} fill="currentColor" /> Trailer
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Details section ─────────────────────────────────────────────── */}
      <div className="px-5 md:px-14 lg:px-20 pt-10 pb-24 space-y-10">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            {
              Icon: Calendar,
              label: "Released",
              value: release_date || first_air_date || badgeYear,
            },
            { Icon: Globe, label: "Language", value: language },
            {
              Icon: User,
              label: resolvedMediaType === "tv" ? "Created by" : "Director",
              value: director,
            },
            { Icon: FileText, label: "Writer", value: writer },
          ].map(({ Icon, label, value }) => (
            <div key={label} className="stat-card p-4">
              <p className="flex items-center gap-1.5 text-[9px] uppercase tracking-widest text-white/22 font-medium mb-2.5">
                <Icon size={9} className="text-amber-400/60" />
                {label}
              </p>
              <p className="text-[11px] font-semibold text-white/65 truncate">
                {value || "—"}
              </p>
            </div>
          ))}
        </div>

        {movie.production_companies?.length > 0 && (
          <div className="space-y-3">
            <p className="text-[9px] uppercase tracking-widest text-white/22 font-medium flex items-center gap-1.5">
              <Award size={9} className="text-amber-400/50" />
              Production
            </p>
            <div className="flex flex-wrap gap-2">
              {movie.production_companies.slice(0, 6).map((c) => (
                <span key={c.id} className="kw-tag">
                  {c.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {keywords.length > 0 && (
          <div className="space-y-3">
            <p className="text-[9px] uppercase tracking-widest text-white/22 font-medium flex items-center gap-1.5">
              <BookOpen size={9} className="text-amber-400/50" />
              Keywords
            </p>
            <div className="flex flex-wrap gap-2">
              {keywords.map((k) => (
                <span key={k.id} className="kw-tag">
                  {k.name}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="divider" />

        {tabs.length > 0 && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar -mx-1 px-1 pb-0.5">
              {tabs.map(({ key, label, Icon }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`tab-pill flex items-center gap-1.5 ${activeTab === key ? "tab-pill-active" : "tab-pill-inactive"}`}
                >
                  <Icon size={11} />
                  {label}
                </button>
              ))}
            </div>

            {/* Episodes */}
            {activeTab === "episodes" && resolvedMediaType === "tv" && (
              <div className="space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <p className="text-[11px] text-white/22 uppercase tracking-widest font-medium">
                    {episodes.length} Episodes
                  </p>
                  <select
                    value={selectedSeason}
                    onChange={(e) => {
                      setSelectedSeason(Number(e.target.value));
                      setSelectedEpisode(1);
                    }}
                    className="season-sel w-full sm:w-auto uppercase tracking-wider"
                  >
                    {movie.seasons
                      ?.filter((s) => s.season_number > 0)
                      .map((s) => (
                        <option
                          key={s.id}
                          value={s.season_number}
                          style={{ background: "#111" }}
                        >
                          Season {s.season_number} · {s.episode_count} Episodes
                        </option>
                      ))}
                  </select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
                  {episodes.map((ep) => {
                    const pk = `s${selectedSeason}e${ep.episode_number}`;
                    const prog = episodeProgress[pk];
                    const pct =
                      prog && ep.runtime
                        ? Math.min(100, (prog / (ep.runtime * 60)) * 100)
                        : 0;
                    const isOn =
                      selectedEpisode === ep.episode_number && activeStream;
                    return (
                      <div
                        key={`${selectedSeason}-${ep.episode_number}`}
                        onClick={() => handleEpisodeSelect(ep.episode_number)}
                        className={`ep-card group cursor-pointer rounded-2xl overflow-hidden ${isOn ? "ep-card-on" : ""}`}
                      >
                        <div className="relative aspect-video overflow-hidden">
                          <img
                            src={ep.still_path ? ep.still_path : heroImage}
                            alt={ep.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                          />
                          <div
                            className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                            style={{ background: "rgba(0,0,0,0.42)" }}
                          >
                            <div
                              className="w-11 h-11 rounded-full flex items-center justify-center"
                              style={{
                                background: "rgba(212,168,83,0.92)",
                                boxShadow: "0 4px 20px rgba(212,168,83,0.45)",
                              }}
                            >
                              <Play
                                size={16}
                                fill="black"
                                className="text-black ml-0.5"
                              />
                            </div>
                          </div>
                          <div
                            className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md text-[9px] font-bold text-white/80 tracking-wider"
                            style={{
                              background: "rgba(0,0,0,0.65)",
                              backdropFilter: "blur(8px)",
                              border: "1px solid rgba(255,255,255,0.1)",
                            }}
                          >
                            E{ep.episode_number}
                          </div>
                          {ep.air_date && (
                            <div
                              className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-md text-[9px] text-white/40"
                              style={{
                                background: "rgba(0,0,0,0.55)",
                                backdropFilter: "blur(6px)",
                              }}
                            >
                              {ep.air_date?.split("-")[0]}
                            </div>
                          )}
                          {pct > 0 && (
                            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/10">
                              <div
                                className="ep-prog"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          )}
                        </div>
                        <div className="p-4">
                          <h4
                            className={`text-xs font-bold truncate mb-1.5 transition-colors ${isOn ? "text-[#d4a853]" : "text-white group-hover:text-[#d4a853]"}`}
                          >
                            {ep.episode_number}. {ep.name}
                          </h4>
                          <p className="text-[10px] text-white/40 leading-relaxed line-clamp-2">
                            {ep.overview || "No description available."}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Cast & Crew */}
            {activeTab === "cast" && cast.length > 0 && (
              <div className="relative group/cast">
                <div
                  ref={castScrollRef}
                  className="flex gap-3 md:gap-4 overflow-x-auto thin-scroll pb-6 pt-2 px-1 -mx-1"
                >
                  {cast.map((member) => (
                    <div
                      key={member.id}
                      onClick={() => setSelectedCastMember(member)}
                      className="cast-item w-[110px] md:w-[130px] rounded-xl overflow-hidden flex-shrink-0"
                    >
                      <div className="aspect-[2/2.5] bg-[#111]">
                        {member.profile_path ? (
                          <img
                            src={`${IMG}/w185${member.profile_path}`}
                            alt={member.name}
                            className="w-full h-full object-cover object-top"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-white/20">
                            <User size={28} />
                          </div>
                        )}
                      </div>
                      <div className="p-3">
                        <p className="text-[10px] font-bold text-white truncate">
                          {member.name}
                        </p>
                        <p className="text-[9px] text-white/40 truncate mt-0.5">
                          {member.character}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => scrollCast(-1)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/80 border border-white/10 flex items-center justify-center opacity-0 group-hover/cast:opacity-100 transition-opacity disabled:opacity-0 hidden md:flex"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={() => scrollCast(1)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/80 border border-white/10 flex items-center justify-center opacity-0 group-hover/cast:opacity-100 transition-opacity disabled:opacity-0 hidden md:flex"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}

            {/* Related */}
            {activeTab === "related" && (
              <div className="space-y-6">
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                  {related.map((item) => (
                    <RelatedCard
                      key={item.id}
                      item={item}
                      onClick={handleRelatedClick}
                    />
                  ))}
                </div>
                {relatedPage < relatedTotal && (
                  <div className="flex justify-center pt-4">
                    <button
                      onClick={() => fetchRelated(relatedPage + 1)}
                      disabled={relatedLoading}
                      className="px-6 py-2.5 rounded-full text-[10px] font-bold uppercase tracking-widest bg-white/5 border border-white/10 hover:bg-white/10 transition-colors flex items-center gap-2"
                    >
                      {relatedLoading ? (
                        <Loader2 size={14} className="animate-spin text-amber-400" />
                      ) : (
                        <Plus size={14} />
                      )}
                      Load More
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Player Overlay */}
      {activeStream && (
        <div
          ref={playerRef}
          className="fixed inset-0 z-[400] bg-black flex items-center justify-center player-container"
        >
          <button
            onClick={closePlayer}
            className="absolute top-5 left-5 z-[500] w-10 h-10 rounded-full flex items-center justify-center bg-black/50 hover:bg-black/80 border border-white/10 transition-all"
          >
            <ArrowLeft size={18} className="text-white" />
          </button>

          {isCleaning && (
            <div className="absolute inset-0 z-[150] flex flex-col items-center justify-center bg-black">
              <div className="relative w-16 h-16 mb-4">
                <div className="absolute inset-0 rounded-full border border-amber-400/20 animate-ping" />
                <div className="w-16 h-16 rounded-full border-t-amber-400 border-r-transparent border-b-transparent border-l-transparent border-[2px] animate-spin" />
              </div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-white/50 font-medium animate-pulse">
                Finding best source...
              </p>
            </div>
          )}

          <video
            ref={videoRef}
            className="w-full h-full object-contain"
            playsInline
            crossOrigin="anonymous"
          >
            {subtitleTracks.map((t, i) => (
              <track
                key={i}
                kind="subtitles"
                src={t.src}
                srcLang={t.language}
                label={t.title || getLanguageName(t.language, languages)}
                default={selectedSubtitle === i}
              />
            ))}
          </video>

          {!isCleaning && cleanUrl && (
            <PlayerControls
              videoRef={videoRef}
              playerRef={playerRef}
              isMuted={isMuted}
              setIsMuted={setIsMuted}
              subtitleTracks={subtitleTracks}
              selectedSubtitle={selectedSubtitle}
              selectSubtitle={selectSubtitle}
              qualityLevels={qualityLevels}
              selectedQuality={selectedQuality}
              selectQuality={selectQuality}
              audioTracks={audioTracks}
              selectedAudio={selectedAudio}
              toggleAudio={toggleAudio}
              activeMenu={activeMenu}
              setActiveMenu={setActiveMenu}
              controlsRef={controlsRef}
              displayTitle={displayTitle}
              resolvedMediaType={resolvedMediaType}
              selectedSeason={selectedSeason}
              selectedEpisode={selectedEpisode}
              episodes={episodes}
              handleEpisodeSelect={handleEpisodeSelect}
              activeStream={activeStream}
              languages={languages}
              getLanguageName={getLanguageName}
              currentTime={currentTime}
              duration={duration}
              setCurrentTime={setCurrentTime}
              isPlaying={isPlaying}
              setIsPlaying={setIsPlaying}
              showNextEpBtn={showNextEpBtn}
              nextEpisode={nextEpisode}
              autoNextCountdown={autoNextCountdown}
              cancelAutoNext={cancelAutoNext}
              subtitleStyle={subtitleStyle}
            />
          )}
        </div>
      )}

      {/* Cast Modal */}
      {selectedCastMember && (
        <CastModal
          member={selectedCastMember}
          onClose={() => setSelectedCastMember(null)}
          navigate={navigate}
        />
      )}
    </div>
  );
};

export default MovieDetails;
