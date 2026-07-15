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
  ChevronRight,
  ChevronLeft,
  Clock,
  Film,
  Tv,
  Award,
  Users,
  BookOpen,
  ChevronDown,
  SkipForward,
} from "lucide-react";
import useTrailer from "../hooks/useTrailer";
import { auth } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { supabase } from "../../src/services/supabaseClient";

// ─── Constants ────────────────────────────────────────────────────────────────
const API_KEY_HEADER = import.meta.env.VITE_API_KEY;
const SUBS_URL = "https://extend-females-unlikely-during.trycloudflare.com/api/subs";
const backendBase = SUBS_URL.replace("/api/subs", "");
const TMDB_KEY = import.meta.env.VITE_TMDB_API_KEY;
const TMDB_BASE = "https://api.themoviedb.org/3";
const IMG = "https://image.tmdb.org/t/p";

const VIDAPI_BASE = "https://vaplayer.ru";
const AUTO_NEXT_COUNTDOWN_S = 15;

// ─── Popup / redirect protection ──────────────────────────────────────────────
const AD_DOMAINS = [
  "whitebit.com",
  "go.oclasrv.com",
  "adspyglass.com",
  "adf.ly",
  "shorte.st",
  "clicksfly.com",
  "clkrevenue.com",
  "clickadu.com",
  "adcash.com",
  "popcash.net",
  "propellerads.com",
  "trafficjunky.com",
  "exoclick.com",
  "juicyads.com",
  "plugrush.com",
  "hilltopads.net",
  "adsterra.com",
  "realsrv.com",
  "oclasrv.com",
  "bitmedia.io",
  "coinzilla.io",
  "cointraffic.io",
  "betmentor.com",
  "refpa32010.com",
  "hummerleaked.cyou",
  "us.effic.pro",
];

const isAdUrl = (url = "") => {
  const lowerUrl = url.toLowerCase();
  
  // 1. Check if it directly matches an ad domain
  const matchesDirect = AD_DOMAINS.some((d) => lowerUrl.includes(d));
  if (matchesDirect) return true;

  // 2. Check if it's a Google Search redirecting to an ad keyword
  if (lowerUrl.includes("google.com/search")) {
    const suspiciousKeywords = ["betmentor", "whitebit", "predictions"];
    return suspiciousKeywords.some((keyword) => lowerUrl.includes(keyword));
  }

  return false;
};

const installPopupGuard = () => {
  const origOpen = window.open;
  window.open = (...args) => {
    console.warn("[PopupGuard] Blocked window.open()", args[0]);
    return null;
  };

  const onClick = (e) => {
    const link = e.target.closest("a");
    if (!link) return;
    const href = link.href || "";
    const isInternal =
      !href ||
      href.startsWith(window.location.origin) ||
      href.startsWith("/") ||
      href.startsWith("#");
    if (!isInternal || link.target === "_blank" || isAdUrl(href)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      console.warn("[PopupGuard] Blocked link redirect:", href);
    }
  };
  document.addEventListener("click", onClick, true);

  const onMessage = (e) => {
    try {
      const msg = typeof e.data === "string" ? e.data : JSON.stringify(e.data || "");
      if (
        msg.includes("redirect") ||
        msg.includes("navigate") ||
        AD_DOMAINS.some((d) => msg.includes(d))
      ) {
        e.stopImmediatePropagation();
        console.warn("[PopupGuard] Blocked suspicious postMessage");
      }
    } catch {}
  };
  window.addEventListener("message", onMessage, true);

  return () => {
    window.open = origOpen;
    document.removeEventListener("click", onClick, true);
    window.removeEventListener("message", onMessage, true);
  };
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function buildVidApiEmbedUrl({
  tmdbId,
  mediaType,
  season,
  episode,
  resumeAt,
  title,
  poster,
  subUrl,
  subLang,
}) {
  const base =
    mediaType === "tv"
      ? `${VIDAPI_BASE}/embed/tv/${tmdbId}/${season}/${episode}`
      : `${VIDAPI_BASE}/embed/movie/${tmdbId}`;

  const params = new URLSearchParams();
  if (title) params.set("title", title);
  if (poster) params.set("poster", poster);
  if (resumeAt && resumeAt > 0) params.set("resumeAt", String(Math.floor(resumeAt)));
  if (subUrl) {
    // Use the prefetched track if we have it — instant, no player-side lookup delay
    params.set("sub_url", subUrl);
    if (subLang) params.set("sub_lang", subLang);
  } else {
    // Fall back to VidAPI's own server-side OpenSubtitles auto-search
    params.set("ds_lang", "en");
  }
  params.set("primaryColor", "d4a853");
  params.set("autoplay", "1");

  return `${base}?${params.toString()}`;
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
            headers: { Authorization: `Bearer ${TMDB_KEY}`, accept: "application/json" },
          }),
          fetch(`${TMDB_BASE}/person/${member.id}/combined_credits?language=en-US`, {
            headers: { Authorization: `Bearer ${TMDB_KEY}`, accept: "application/json" },
          }),
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
            <h3 className="text-lg sm:text-xl font-bold text-white truncate">{member.name}</h3>
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
                val: credits.cast?.filter((c) => c.media_type === "movie").length || 0,
              },
              {
                label: "TV Shows",
                val: credits.cast?.filter((c) => c.media_type === "tv").length || 0,
              },
              { label: "Known For", val: credits.known_for_department || "Acting" },
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
            <div className="text-center py-12 text-white/25 text-sm">No {activeTab} found</div>
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
                          <Star size={7} className="text-amber-400 fill-amber-400" />
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
                        <Play size={12} fill="black" className="text-black ml-0.5" />
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
      <svg className="rotate-[-90deg]" viewBox="0 0 44 44" width={size} height={size}>
        <circle cx="22" cy="22" r={r} stroke="rgba(255,255,255,0.06)" strokeWidth="3" fill="none" />
        <circle
          cx="22"
          cy="22"
          r={r}
          stroke={`url(#${gradientId})`}
          strokeWidth="3"
          fill="none"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 1.4s cubic-bezier(0.4,0,0.2,1)" }}
        />
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
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

  const [activeStream, setActiveStream] = useState(false);
  const [embedUrl, setEmbedUrl] = useState(null);
  const [iframeLoading, setIframeLoading] = useState(false);
  const [playerVisible, setPlayerVisible] = useState(false); // drives fade-in
  const [showNextEpBtn, setShowNextEpBtn] = useState(false);
  const [autoNextCountdown, setAutoNextCountdown] = useState(null);

  const autoNextRef = useRef(null);
  const autoNextCancelled = useRef(false);
  const castScrollRef = useRef(null);
  const playerRef = useRef(null);
  const popupGuardCleanupRef = useRef(null);

  // Cache of prefetched subtitle tracks, keyed by "movie" or "s{season}e{episode}"
  const subCacheRef = useRef(new Map());

  const nextEpisode =
    resolvedMediaType === "tv"
      ? episodes.find((ep) => ep.episode_number === selectedEpisode + 1) || null
      : null;

  // ── Install popup/redirect guard on mount ──────────────────────────────────
  useEffect(() => {
    popupGuardCleanupRef.current = installPopupGuard();
    return () => popupGuardCleanupRef.current?.();
  }, []);

  // ── Block unexpected redirects while streaming ─────────────────────────────
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (activeStream) {
        // This forces the browser to show a "Leave site? Changes you made may not be saved" prompt
        // effectively pausing the automated redirect in its tracks.
        e.preventDefault();
        e.returnValue = ""; 
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [activeStream]);

  const saveProgress = useCallback(
    async (ct) => {
      if (!currentUser || !movie) return;
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
    },
    [currentUser, movie, resolvedMediaType, id, selectedSeason, selectedEpisode],
  );

  const {
    trailerUrl,
    isPlaying: isTrailerPlaying,
    playTrailer,
    stopTrailer,
  } = useTrailer(id, resolvedMediaType, false, selectedSeason, movie?.title || movie?.name || "");

  const closePlayer = useCallback(() => {
    stopTrailer();
    setPlayerVisible(false);
    // Let the fade-out finish before unmounting the iframe
    setTimeout(() => {
      setActiveStream(false);
      setEmbedUrl(null);
    }, 180);
    setShowNextEpBtn(false);
    setAutoNextCountdown(null);
    if (autoNextRef.current) clearInterval(autoNextRef.current);
  }, [stopTrailer]);

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
          (p, c) => (c.season > p.season || (c.season === p.season && c.episode > p.episode) ? c : p),
          data[0],
        );
        setResumeData({ season: best.season, episode: best.episode, time: best.time });
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
            year: (movie?.release_date || movie?.first_air_date)?.split("-")[0] || "N/A",
          },
        ]);
        setIsInList(true);
      }
    } catch {
    } finally {
      setIsSavingList(false);
    }
  };

  // ── Background subtitle prefetch ────────────────────────────────────────────
  // Runs silently in the background as soon as we know what the user is likely
  // to click next, so by the time they click Play the track is already cached
  // and openEmbed can attach it with zero added latency.
  const prefetchSubs = useCallback(
    async (season, episode) => {
      const cacheKey = resolvedMediaType === "tv" ? `s${season}e${episode}` : "movie";
      if (subCacheRef.current.has(cacheKey)) return;
      subCacheRef.current.set(cacheKey, null); // mark in-flight so we don't double-fetch

      try {
        const res = await fetch(SUBS_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-API-Key": API_KEY_HEADER },
          body: JSON.stringify({
            imdbId: id,
            type: resolvedMediaType,
            season: resolvedMediaType === "tv" ? season : undefined,
            episode: resolvedMediaType === "tv" ? episode : undefined,
          }),
        });
        if (!res.ok) return;
        const result = await res.json();
        const en = (result.tracks || []).find((t) => t.language === "en") || result.tracks?.[0];
        if (en) {
          subCacheRef.current.set(cacheKey, { url: `${backendBase}${en.uri}`, lang: en.language });
        }
      } catch {
        // silent — falls back to VidAPI's own ds_lang auto-search at play time
      }
    },
    [id, resolvedMediaType],
  );

  // Prefetch subs for the default episode / movie as soon as we have the data
  useEffect(() => {
    if (!movie) return;
    if (resolvedMediaType === "movie") {
      prefetchSubs();
    } else if (selectedSeason) {
      prefetchSubs(selectedSeason, selectedEpisode);
    }
  }, [movie, resolvedMediaType, selectedSeason, selectedEpisode, prefetchSubs]);

  // Prefetch subs for every episode in the currently loaded season, staggered
  // so it doesn't hammer your /api/subs rate limiter.
  useEffect(() => {
    if (resolvedMediaType !== "tv" || !episodes.length) return;
    let cancelled = false;
    (async () => {
      for (const ep of episodes) {
        if (cancelled) return;
        await prefetchSubs(selectedSeason, ep.episode_number);
        await new Promise((r) => setTimeout(r, 400));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [episodes, selectedSeason, resolvedMediaType, prefetchSubs]);

  // ── Build + open the embed for a given episode/movie (synchronous — instant) ─
  const openEmbed = useCallback(
    ({ season, episode }) => {
      setShowNextEpBtn(false);
      setAutoNextCountdown(null);
      autoNextCancelled.current = false;
      if (autoNextRef.current) clearInterval(autoNextRef.current);

      const resumeAt =
        resolvedMediaType === "tv"
          ? episodeProgress[`s${season}e${episode}`] || 0
          : resumeData?.time || 0;

      const poster = movie?.backdrop_path ? `${IMG}/original${movie.backdrop_path}` : undefined;
      const title = movie?.title || movie?.name;

      const cacheKey = resolvedMediaType === "tv" ? `s${season}e${episode}` : "movie";
      const cachedSub = subCacheRef.current.get(cacheKey);

      const url = buildVidApiEmbedUrl({
        tmdbId: id,
        mediaType: resolvedMediaType,
        season,
        episode,
        resumeAt,
        title,
        poster,
        subUrl: cachedSub?.url,
        subLang: cachedSub?.lang,
      });

      setIframeLoading(true);
      setEmbedUrl(url);
      setActiveStream(true);
      // Fade in on next paint — avoids the overlay popping in instantly/jarringly
      requestAnimationFrame(() => requestAnimationFrame(() => setPlayerVisible(true)));
    },
    [id, resolvedMediaType, movie, episodeProgress, resumeData],
  );

  const handleEpisodeSelect = useCallback(
    (epNum) => {
      if (isTrailerPlaying) stopTrailer();
      setSelectedEpisode(epNum);
      openEmbed({ season: selectedSeason, episode: epNum });
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [isTrailerPlaying, stopTrailer, selectedSeason, openEmbed],
  );

  const handleResumeClick = useCallback(() => {
    if (isTrailerPlaying) stopTrailer();
    if (resolvedMediaType === "tv") {
      const season = resumeData?.season || selectedSeason;
      const episode = resumeData?.episode || 1;
      setSelectedSeason(season);
      setSelectedEpisode(episode);
      openEmbed({ season, episode });
    } else {
      openEmbed({});
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [isTrailerPlaying, stopTrailer, resolvedMediaType, resumeData, selectedSeason, openEmbed]);

  // ── postMessage listener — progress, resume, auto-next ──────────────────────
  useEffect(() => {
    if (!activeStream) return;

    const onMessage = (e) => {
      if (e.data?.type !== "PLAYER_EVENT") return;
      const { player_status, player_progress, player_duration } = e.data.data || {};

      if (player_status === "playing" || player_status === "paused" || player_status === "seeked") {
        if (typeof player_progress === "number") saveProgress(player_progress);
      }

      if (
        resolvedMediaType === "tv" &&
        nextEpisode &&
        player_status === "playing" &&
        player_duration > 0 &&
        player_progress > 0
      ) {
        const remaining = player_duration - player_progress;
        setShowNextEpBtn(remaining <= 90 && remaining > 0);
        if (
          remaining <= AUTO_NEXT_COUNTDOWN_S &&
          remaining > 0 &&
          autoNextCountdown === null &&
          !autoNextCancelled.current
        ) {
          startAutoNextCountdown();
        }
      }

      if (player_status === "completed") {
        saveProgress(0);
        if (resolvedMediaType === "tv" && nextEpisode) {
          handleEpisodeSelect(nextEpisode.episode_number);
        } else {
          closePlayer();
        }
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStream, resolvedMediaType, nextEpisode, autoNextCountdown]);

  const startAutoNextCountdown = () => {
    if (!nextEpisode || autoNextCancelled.current) return;
    setAutoNextCountdown(AUTO_NEXT_COUNTDOWN_S);
    let count = AUTO_NEXT_COUNTDOWN_S;
    autoNextRef.current = setInterval(() => {
      count -= 1;
      setAutoNextCountdown(count);
      if (count <= 0) {
        clearInterval(autoNextRef.current);
        if (!autoNextCancelled.current) handleEpisodeSelect(nextEpisode.episode_number);
      }
    }, 1000);
  };

  const cancelAutoNext = () => {
    autoNextCancelled.current = true;
    if (autoNextRef.current) clearInterval(autoNextRef.current);
    setAutoNextCountdown(null);
  };

  // ── Data loading ──────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await fetchMovieDetails(id, resolvedMediaType);
        setMovie(data);
        if (resolvedMediaType === "tv" && data.seasons?.length) {
          const first = data.seasons.find((s) => s.season_number > 0) || data.seasons[0];
          setSelectedSeason(first.season_number);
          setSelectedEpisode(1);
        }
        try {
          const certEndpoint = resolvedMediaType === "movie" ? "release_dates" : "content_ratings";
          const certRes = await fetch(`${TMDB_BASE}/${resolvedMediaType}/${id}/${certEndpoint}`, {
            headers: { Authorization: `Bearer ${TMDB_KEY}`, accept: "application/json" },
          });
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
          const kwRes = await fetch(`${TMDB_BASE}/${resolvedMediaType}/${id}/keywords`, {
            headers: { Authorization: `Bearer ${TMDB_KEY}`, accept: "application/json" },
          });
          const kwData = await kwRes.json();
          setKeywords((kwData.keywords || kwData.results || []).slice(0, 12));
        } catch {}
      } catch {
      } finally {
        setLoading(false);
      }
    }
    load();
    fetchCastData();
    fetchRelated();
    subCacheRef.current.clear();
  }, [id, resolvedMediaType]);

  useEffect(() => {
    if (resolvedMediaType === "tv" && selectedSeason)
      fetchSeasonDetails(id, selectedSeason).then((eps) => setEpisodes(eps || []));
  }, [selectedSeason, id, resolvedMediaType]);

  const fetchCastData = async () => {
    try {
      const res = await fetch(`${TMDB_BASE}/${resolvedMediaType}/${id}/credits`, {
        headers: { Authorization: `Bearer ${TMDB_KEY}`, accept: "application/json" },
      });
      const data = await res.json();
      setCast((data.cast || []).slice(0, 24));
    } catch {}
  };

  const fetchRelated = async (page = 1) => {
    setRelatedLoading(true);
    try {
      const res = await fetch(
        `${TMDB_BASE}/${resolvedMediaType}/${id}/recommendations?page=${page}`,
        { headers: { Authorization: `Bearer ${TMDB_KEY}`, accept: "application/json" } },
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

  const handleRelatedClick = (item) => {
    closePlayer();
    const type = item.media_type || (item.title ? "movie" : "tv");
    navigate(`/details/${type}/${item.id}`);
    window.scrollTo({ top: 0 });
  };

  const scrollCast = (dir) => {
    if (!castScrollRef.current) return;
    castScrollRef.current.scrollBy({ left: dir * 280, behavior: "smooth" });
  };

  useEffect(
    () => () => {
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
          <p className="text-[10px] uppercase tracking-[0.4em] text-white/20 font-medium">Loading</p>
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
  } = movie;
  const displayTitle = title || name;
  const heroImage = backdrop_path ? `${IMG}/original${backdrop_path}` : `${IMG}/original${poster_path}`;
  const posterImage = poster_path ? `${IMG}/w500${poster_path}` : heroImage;
  const language = original_language?.toUpperCase() || "EN";

  const tabs = [
    ...(resolvedMediaType === "tv" ? [{ key: "episodes", label: "Episodes", Icon: Tv }] : []),
    ...(cast.length ? [{ key: "cast", label: "Cast & Crew", Icon: Users }] : []),
    ...(related.length ? [{ key: "related", label: "More Like This", Icon: Film }] : []),
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
        .next-ep-badge{background:rgba(10,10,10,0.9);border:1px solid rgba(255,255,255,0.1);backdrop-filter:blur(16px);}
        .next-ep-btn{background:#d4a853;box-shadow:0 8px 24px rgba(212,168,83,0.4);transition:all .2s;}
        .next-ep-btn:hover{transform:translateY(-1px);box-shadow:0 12px 32px rgba(212,168,83,0.55);}
        .rating-badge{font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;padding:3px 7px;border-radius:5px;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.13);color:rgba(255,255,255,0.55);}
        .player-overlay{opacity:0;transition:opacity .28s ease;}
        .player-overlay.visible{opacity:1;}
        .player-spinner-fade{animation:fadeUp .3s ease both;}
      `}</style>

      <button
        onClick={() => {
          closePlayer();
          navigate(-1);
        }}
        className="fixed top-5 left-4 md:top-7 md:left-7 z-[60] flex items-center gap-2 px-3.5 py-2 rounded-full transition-all group"
        style={{ background: "rgba(8,8,8,0.7)", backdropFilter: "blur(24px)", border: "1px solid rgba(255,255,255,0.08)" }}
      >
        <ArrowLeft size={13} className="text-white/50 group-hover:text-white group-hover:-translate-x-0.5 transition-all" />
        <span className="text-[10px] font-semibold uppercase tracking-widest text-white/35 group-hover:text-white/70 hidden sm:inline transition-colors">
          Back
        </span>
      </button>

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div className="relative w-full overflow-hidden" style={{ height: "100svh", minHeight: 580, maxHeight: 920 }}>
        <img
          src={heroImage}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover object-center"
          style={{ transform: "scale(1.07)", filter: "brightness(0.38) saturate(1.1)" }}
        />
        <div className="absolute inset-0 z-[1]" style={{ background: "linear-gradient(105deg, rgba(8,8,8,0.98) 0%, rgba(8,8,8,0.78) 45%, rgba(8,8,8,0.15) 100%)" }} />
        <div className="absolute inset-0 z-[1]" style={{ background: "linear-gradient(to top, #080808 0%, rgba(8,8,8,0.6) 30%, transparent 60%)" }} />
        <div className="absolute inset-0 z-[1]" style={{ background: "radial-gradient(ellipse at 15% 65%, rgba(212,168,83,0.05) 0%, transparent 50%)" }} />

        <div className="relative z-[3] h-full flex items-end md:items-center px-5 md:px-14 lg:px-20 pb-12 md:pb-0">
          {/* Mobile hero */}
          <div className="w-full flex flex-col md:hidden gap-5 a1">
            <div className="flex items-end gap-4">
              <div className="rounded-xl overflow-hidden poster-glow flex-shrink-0" style={{ width: 96, height: 144 }}>
                <img src={posterImage} alt={displayTitle} className="w-full h-full object-cover" />
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
                  style={{ fontSize: "clamp(1.7rem, 7vw, 2.4rem)", fontStyle: "italic", textShadow: "0 2px 20px rgba(0,0,0,0.8)" }}
                >
                  {displayTitle}
                </h1>
                <div className="flex flex-wrap items-center gap-2 mt-2 text-[10px] text-white/40">
                  <span className="font-semibold text-white/60">
                    {badgeYear || (release_date || first_air_date)?.split("-")[0]}
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
                  <span className="text-sm font-bold text-white/80">{parseFloat(rating).toFixed(1)}</span>
                  <span className="text-[10px] text-white/25 ml-1">/ 10</span>
                  <p className="text-[9px] text-white/25 mt-0.5">{votes?.toLocaleString()} ratings</p>
                </div>
              </div>
            )}

            <p className="text-[13px] leading-relaxed text-white/50 line-clamp-3">{plot}</p>

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
                <Play size={13} fill="rgba(255,255,255,0.45)" className="text-white/45 ml-0.5" />
              </button>
            </div>
          </div>

          {/* Desktop hero */}
          <div className="hidden md:flex gap-12 lg:gap-16 items-end w-full max-w-5xl">
            <div className="flex-shrink-0 aL rounded-2xl overflow-hidden poster-glow" style={{ width: 210 }}>
              <img src={posterImage} alt={displayTitle} className="w-full aspect-[2/3] object-cover" />
            </div>

            <div className="flex-1 space-y-4 pb-8">
              <div className="flex flex-wrap gap-2 a1">
                <span
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-semibold uppercase tracking-widest"
                  style={{ background: "rgba(212,168,83,0.1)", border: "1px solid rgba(212,168,83,0.25)", color: "#d4a853" }}
                >
                  <ShieldCheck size={9} /> Protected
                </span>
                <span className="kw-tag">{resolvedMediaType === "tv" ? "Series" : "Film"}</span>
                {genres?.slice(0, 3).map((g) => (
                  <span key={g.id} className="kw-tag">
                    {g.name}
                  </span>
                ))}
              </div>

              <h1
                className="font-display font-bold text-white leading-[1.03] a2"
                style={{ fontSize: "clamp(2.8rem, 4.8vw, 4.4rem)", fontStyle: "italic", textShadow: "0 4px 30px rgba(0,0,0,0.5)" }}
              >
                {displayTitle}
              </h1>

              <div className="flex flex-wrap items-center gap-3 a2" style={{ fontSize: 11 }}>
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
                <span className="text-white/30 uppercase tracking-wider">{language}</span>
                {votes > 0 && (
                  <>
                    <span className="w-px h-3 bg-white/15" />
                    <span className="text-white/30">{votes?.toLocaleString()} ratings</span>
                  </>
                )}
              </div>

              {parseFloat(rating) > 0 && (
                <div className="flex items-center gap-4 a3">
                  <ScoreRing score={parseFloat(rating)} size={54} />
                  <div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-base font-bold text-white/90">{parseFloat(rating).toFixed(1)}</span>
                      <span className="text-[11px] text-white/30">/ 10</span>
                    </div>
                    <p className="text-[9px] text-white/25 mt-0.5">Community Score</p>
                  </div>
                  <div className="flex gap-1">
                    {Array.from({ length: 5 }, (_, i) => (
                      <Star
                        key={i}
                        size={12}
                        className={i < Math.floor(parseFloat(rating) / 2) ? "text-amber-400 fill-amber-400" : "text-white/10"}
                      />
                    ))}
                  </div>
                </div>
              )}

              <div className="a4">
                <p className={`text-[13px] leading-relaxed text-white/55 max-w-[520px] ${expandedPlot ? "" : "line-clamp-3"}`}>
                  {plot}
                </p>
                {plot?.length > 180 && (
                  <button
                    onClick={() => setExpandedPlot((p) => !p)}
                    className="flex items-center gap-1 mt-1.5 text-[10px] font-semibold text-amber-400/60 hover:text-amber-400 transition-colors"
                  >
                    {expandedPlot ? "Show less" : "Read more"}{" "}
                    <ChevronDown size={11} className={`transition-transform ${expandedPlot ? "rotate-180" : ""}`} />
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
                  {isSavingList ? <Loader2 size={14} className="animate-spin" /> : isInList ? <Check size={14} /> : <Plus size={14} />}
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
            { Icon: Calendar, label: "Released", value: release_date || first_air_date || badgeYear },
            { Icon: Globe, label: "Language", value: language },
            { Icon: User, label: resolvedMediaType === "tv" ? "Created by" : "Director", value: director },
            { Icon: FileText, label: "Writer", value: writer },
          ].map(({ Icon, label, value }) => (
            <div key={label} className="stat-card p-4">
              <p className="flex items-center gap-1.5 text-[9px] uppercase tracking-widest text-white/22 font-medium mb-2.5">
                <Icon size={9} className="text-amber-400/60" />
                {label}
              </p>
              <p className="text-[11px] font-semibold text-white/65 truncate">{value || "—"}</p>
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
                    {movie.seasons?.filter((s) => s.season_number > 0).map((s) => (
                      <option key={s.id} value={s.season_number} style={{ background: "#111" }}>
                        Season {s.season_number} · {s.episode_count} Episodes
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
                  {episodes.map((ep) => {
                    const pk = `s${selectedSeason}e${ep.episode_number}`;
                    const prog = episodeProgress[pk];
                    const pct = prog && ep.runtime ? Math.min(100, (prog / (ep.runtime * 60)) * 100) : 0;
                    const isOn = selectedEpisode === ep.episode_number && activeStream;
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
                              style={{ background: "rgba(212,168,83,0.92)", boxShadow: "0 4px 20px rgba(212,168,83,0.45)" }}
                            >
                              <Play size={16} fill="black" className="text-black ml-0.5" />
                            </div>
                          </div>
                          <div
                            className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md text-[9px] font-bold text-white/80 tracking-wider"
                            style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.1)" }}
                          >
                            E{ep.episode_number}
                          </div>
                          {ep.air_date && (
                            <div
                              className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-md text-[9px] text-white/40"
                              style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)" }}
                            >
                              {ep.air_date?.split("-")[0]}
                            </div>
                          )}
                          {pct > 0 && (
                            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/10">
                              <div className="ep-prog" style={{ width: `${pct}%` }} />
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
                <div ref={castScrollRef} className="flex gap-3 md:gap-4 overflow-x-auto thin-scroll pb-6 pt-2 px-1 -mx-1">
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
                        <p className="text-[10px] font-bold text-white truncate">{member.name}</p>
                        <p className="text-[9px] text-white/40 truncate mt-0.5">{member.character}</p>
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
                    <RelatedCard key={item.id} item={item} onClick={handleRelatedClick} />
                  ))}
                </div>
                {relatedPage < relatedTotal && (
                  <div className="flex justify-center pt-4">
                    <button
                      onClick={() => fetchRelated(relatedPage + 1)}
                      disabled={relatedLoading}
                      className="px-6 py-2.5 rounded-full text-[10px] font-bold uppercase tracking-widest bg-white/5 border border-white/10 hover:bg-white/10 transition-colors flex items-center gap-2"
                    >
                      {relatedLoading ? <Loader2 size={14} className="animate-spin text-amber-400" /> : <Plus size={14} />}
                      Load More
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Player Overlay (VidAPI embed) ───────────────────────────────── */}
      {activeStream && embedUrl && (
        <div
          ref={playerRef}
          className={`fixed inset-0 z-[400] bg-black flex items-center justify-center player-overlay ${playerVisible ? "visible" : ""}`}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              closePlayer();
            }}
            className="absolute top-5 left-5 z-[500] w-10 h-10 rounded-full flex items-center justify-center bg-black/50 hover:bg-black/80 border border-white/10 transition-all"
          >
            <ArrowLeft size={18} className="text-white" />
          </button>

          {iframeLoading && (
            <div className="absolute inset-0 z-[150] flex flex-col items-center justify-center bg-black player-spinner-fade">
              <div className="relative w-16 h-16 mb-4">
                <div className="absolute inset-0 rounded-full border border-amber-400/20 animate-ping" />
                <div className="w-16 h-16 rounded-full border-t-amber-400 border-r-transparent border-b-transparent border-l-transparent border-[2px] animate-spin" />
              </div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-white/50 font-medium animate-pulse">
                Loading player…
              </p>
            </div>
          )}

          <iframe
            key={embedUrl}
            src={embedUrl}
            onLoad={() => setIframeLoading(false)}
            className="w-full h-full border-none"
            allowFullScreen
            allow="autoplay; fullscreen; picture-in-picture"
            referrerPolicy="no-referrer"
            title="Stream"
          />

          {showNextEpBtn && nextEpisode && (
            <div className="absolute bottom-10 right-5 md:right-10 z-[420] flex flex-col items-end gap-2">
              {autoNextCountdown !== null && (
                <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs text-white/70 next-ep-badge">
                  <span className="text-[11px] font-medium">Up next in {autoNextCountdown}s</span>
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
                <SkipForward size={14} fill="black" /> Next: E{nextEpisode.episode_number} · {nextEpisode.name}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Cast Modal */}
      {selectedCastMember && (
        <CastModal member={selectedCastMember} onClose={() => setSelectedCastMember(null)} navigate={navigate} />
      )}
    </div>
  );
};

export default MovieDetails;
