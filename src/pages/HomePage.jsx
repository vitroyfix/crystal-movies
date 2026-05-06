import React, { useState, useEffect, useRef, useCallback } from "react";
import NavBar from "../components/layout/NavBar.jsx";
import Footer from "../components/layout/Footer.jsx";
import HeroBanner from "../components/HeroBanner.jsx";
import MovieCard from "../components/movies/MovieCard.jsx";
import {
  fetchTrending,
  fetchTopRatedMovies,
  fetchRecentMovies,
  fetchByGenre,
} from "../services/api.js";
import {
  Flame, Star, Clock, Globe, Gem, Swords, Heart,
  Skull, Calendar, Trophy, ChevronRight, ChevronLeft,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────
//  Utilities
// ─────────────────────────────────────────────────────────────
const dedup = (arr) => {
  const seen = new Set();
  return arr.filter((item) => (seen.has(item.id) ? false : seen.add(item.id)));
};

// ─────────────────────────────────────────────────────────────
//  Skeleton Card
// ─────────────────────────────────────────────────────────────
const SkeletonCard = () => (
  <div className="hp-sk-card" style={{ aspectRatio: "2/3", borderRadius: 10 }} />
);

// ─────────────────────────────────────────────────────────────
//  Movie Row
// ─────────────────────────────────────────────────────────────
const MovieRow = ({ title, icon, accent, data, loading, badge }) => {
  const scrollRef = useRef(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd,   setAtEnd  ] = useState(false);

  const syncEdges = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setAtStart(el.scrollLeft < 24);
    setAtEnd(el.scrollLeft >= el.scrollWidth - el.clientWidth - 24);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", syncEdges, { passive: true });
    syncEdges();
    return () => el.removeEventListener("scroll", syncEdges);
  }, [data, syncEdges]);

  const scroll = (dir) => {
    scrollRef.current?.scrollBy({ left: dir * 450, behavior: "smooth" });
    setTimeout(syncEdges, 420);
  };

  return (
    <div className="hp-row">
      <div className="hp-row-header">
        <div className="hp-row-title-group">
          <span className="hp-row-accent-bar" style={{ background: accent }} />
          <span className="hp-row-icon" style={{ color: accent }}>{icon}</span>
          <h2 className="hp-row-title">{title}</h2>
          {badge && (
            <span
              className="hp-row-badge"
              style={{ background: accent + "1a", color: accent, border: `1px solid ${accent}40` }}
            >
              {badge}
            </span>
          )}
          <span className="hp-row-explore" style={{ color: accent }}>
            Explore All <ChevronRight size={9} />
          </span>
        </div>
      </div>

      <div className="hp-track-wrap">
        <div className="hp-edge hp-edge-l" style={{ opacity: atStart ? 0 : 1 }} aria-hidden="true" />
        <div className="hp-edge hp-edge-r" style={{ opacity: atEnd   ? 0 : 1 }} aria-hidden="true" />

        {!atStart && (
          <button onClick={() => scroll(-1)} className="hp-arrow hp-arrow-l" aria-label="Scroll left">
            <ChevronLeft size={22} />
          </button>
        )}
        {!atEnd && (
          <button onClick={() => scroll(1)} className="hp-arrow hp-arrow-r" aria-label="Scroll right">
            <ChevronRight size={22} />
          </button>
        )}

        <div ref={scrollRef} className="hp-track">
          {loading
            ? Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="hp-slot"><SkeletonCard /></div>
              ))
            : data.map((item, i) => (
                <div key={`${item.id}-${i}`} className="hp-slot hp-slot-hover">
                  <MovieCard {...item} />
                </div>
              ))}
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
//  Section Divider
// ─────────────────────────────────────────────────────────────
const SectionDivider = ({ label }) => (
  <div className="hp-divider">
    <span className="hp-divider-label">{label}</span>
    <div className="hp-divider-line" />
  </div>
);

// ─────────────────────────────────────────────────────────────
//  TMDB Genre IDs
// ─────────────────────────────────────────────────────────────
const GENRE = { action: 28, romance: 10749, thriller: 53, drama: 18 };

// ─────────────────────────────────────────────────────────────
//  HomePage
// ─────────────────────────────────────────────────────────────
const HomePage = () => {
  // Core
  const [trending,      setTrending     ] = useState([]);
  const [topRated,      setTopRated     ] = useState([]);
  const [recentlyAdded, setRecentlyAdded] = useState([]);
  const [coreLoading,   setCoreLoading  ] = useState(true);

  // Genre
  const [actionMovies,   setActionMovies  ] = useState([]);
  const [romanceMovies,  setRomanceMovies ] = useState([]);
  const [thrillerMovies, setThrillerMovies] = useState([]);
  const [genreLoading,   setGenreLoading  ] = useState(true);

  // Special
  const [popularKenya,   setPopularKenya  ] = useState([]);
  const [hiddenGems,     setHiddenGems    ] = useState([]);
  const [awardWinners,   setAwardWinners  ] = useState([]);
  const [decadeMovies,   setDecadeMovies  ] = useState([]);
  const [specialLoading, setSpecialLoading] = useState(true);

  // ── Fetch core ───────────────────────────────────────────
  useEffect(() => {
    (async () => {
      setCoreLoading(true);
      try {
        const [t, tr, r] = await Promise.all([
          fetchTrending("all"),
          fetchTopRatedMovies("movie"),
          fetchRecentMovies("all"),
        ]);
        setTrending(dedup(t));
        setTopRated(dedup(tr));
        setRecentlyAdded(dedup(r));
      } catch (e) { console.error(e); }
      finally { setCoreLoading(false); }
    })();
  }, []);

  // ── Fetch genre rows ─────────────────────────────────────
  useEffect(() => {
    (async () => {
      setGenreLoading(true);
      try {
        const [a, ro, th] = await Promise.all([
          fetchByGenre(GENRE.action,   1, "movie"),
          fetchByGenre(GENRE.romance,  1, "movie"),
          fetchByGenre(GENRE.thriller, 1, "movie"),
        ]);
        setActionMovies(dedup(a));
        setRomanceMovies(dedup(ro));
        setThrillerMovies(dedup(th));
      } catch (e) { console.error(e); }
      finally { setGenreLoading(false); }
    })();
  }, []);

  // ── Fetch special rows ───────────────────────────────────
  // These use existing API functions as proxies for now.
  // To make them accurate, swap in TMDB Discover endpoints:
  //   Popular in Kenya  → /discover/movie?region=KE&sort_by=popularity.desc
  //   Hidden Gems       → /discover/movie?vote_average.gte=7.5&vote_count.lte=800
  //   Award Winners     → /discover/movie?with_genres=18&sort_by=vote_average.desc
  useEffect(() => {
    (async () => {
      setSpecialLoading(true);
      try {
        const [kenya, gems, awards, decade] = await Promise.all([
          fetchTrending("all"),
          fetchTopRatedMovies("tv"),
          fetchByGenre(GENRE.drama, 1, "movie"),
          fetchRecentMovies("movie"),
        ]);
        setPopularKenya(dedup(kenya).slice(4, 24)); // offset from main Trending row
        setHiddenGems(dedup(gems));
        setAwardWinners(dedup(awards));
        setDecadeMovies(dedup(decade));
      } catch (e) { console.error(e); }
      finally { setSpecialLoading(false); }
    })();
  }, []);

  // ── Row definitions ──────────────────────────────────────
  const CORE_ROWS = [
    { key: "trending", title: "Trending Now",      icon: <Flame    size={14}/>, accent: "#f87171", data: trending,       loading: coreLoading    },
    { key: "toprated", title: "Top Rated",          icon: <Star     size={14}/>, accent: "#d4a853", data: topRated,       loading: coreLoading    },
    { key: "recent",   title: "Recently Added",     icon: <Clock    size={14}/>, accent: "#60a5fa", data: recentlyAdded,  loading: coreLoading    },
  ];

  const SPECIAL_ROWS = [
    { key: "kenya",   title: "Popular",    icon: <Globe    size={14}/>, accent: "#34d399", data: popularKenya,   loading: specialLoading    },
    { key: "gems",    title: "Hidden Gems",         icon: <Gem      size={14}/>, accent: "#a78bfa", data: hiddenGems,     loading: specialLoading, badge: "Underrated"           },
    { key: "awards",  title: "Award Winners",       icon: <Trophy   size={14}/>, accent: "#fbbf24", data: awardWinners,   loading: specialLoading, badge: "Critically Acclaimed" },
    { key: "decade",  title: "Best of the 2020s",   icon: <Calendar size={14}/>, accent: "#fb923c", data: decadeMovies,   loading: specialLoading },
  ];

  const GENRE_ROWS = [
    { key: "action",   title: "Action & Adventure",  icon: <Swords  size={14}/>, accent: "#f43f5e", data: actionMovies,   loading: genreLoading },
    { key: "romance",  title: "Romance",             icon: <Heart   size={14}/>, accent: "#ec4899", data: romanceMovies,  loading: genreLoading },
    { key: "thriller", title: "Thriller & Suspense", icon: <Skull   size={14}/>, accent: "#94a3b8", data: thrillerMovies, loading: genreLoading },
  ];

  // ──────────────────────────────────────────────────────────
  //  Render
  // ──────────────────────────────────────────────────────────
  return (
    <div className="hp-root">

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }

        .hp-root {
          min-height: 100vh;
          background: #080808;
          color: #fff;
          font-family: 'Sora', sans-serif;
          overflow-x: hidden;
        }

        /* ── Section divider ──────────────────────────────── */
        .hp-divider {
          display: flex; align-items: center; gap: 14px;
          padding: 0 5%; margin: 3rem 0 0.5rem;
        }
        .hp-divider-label {
          font-size: 8px; font-weight: 700;
          letter-spacing: 0.38em; text-transform: uppercase;
          color: rgba(255,255,255,0.2); white-space: nowrap; flex-shrink: 0;
        }
        .hp-divider-line {
          flex: 1; height: 1px;
          background: linear-gradient(90deg, rgba(255,255,255,0.08), transparent);
        }

        /* ── Row ──────────────────────────────────────────── */
        .hp-row { margin-bottom: 2.5rem; }
        .hp-row-header { padding: 0 5%; margin-bottom: 0.85rem; }
        .hp-row-title-group { display: flex; align-items: center; gap: 10px; }
        .hp-row-accent-bar {
          display: block; width: 2px; height: 16px;
          border-radius: 2px; flex-shrink: 0;
        }
        .hp-row-icon  { display: flex; flex-shrink: 0; }
        .hp-row-title {
          font-size: 12px; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.18em;
          color: rgba(255,255,255,0.7); margin: 0;
        }
        .hp-row-badge {
          font-size: 8px; font-weight: 700;
          letter-spacing: 0.09em; text-transform: uppercase;
          padding: 3px 9px; border-radius: 20px; flex-shrink: 0;
        }
        .hp-row-explore {
          font-size: 9px; font-weight: 700; letter-spacing: 0.1em;
          text-transform: uppercase;
          display: flex; align-items: center; gap: 3px;
          opacity: 0; transition: opacity 0.28s ease; cursor: pointer;
        }
        .hp-row:hover .hp-row-explore { opacity: 1; }

        /* Track */
        .hp-track-wrap { position: relative; overflow: hidden; }
        .hp-edge {
          position: absolute; top: 0; bottom: 12px; z-index: 2;
          pointer-events: none; transition: opacity 0.35s ease; width: 110px;
        }
        .hp-edge-l { left: 0;  background: linear-gradient(90deg,  #080808 0%, rgba(8,8,8,0.8) 40%, transparent 100%); }
        .hp-edge-r { right: 0; background: linear-gradient(-90deg, #080808 0%, rgba(8,8,8,0.8) 40%, transparent 100%); }

        .hp-arrow {
          position: absolute; top: 0; bottom: 12px; z-index: 3;
          display: flex; align-items: center; padding: 0 14px;
          background: transparent; border: none; cursor: pointer;
          color: rgba(255,255,255,0.55);
          opacity: 0; transition: opacity 0.28s ease, color 0.18s ease;
        }
        .hp-track-wrap:hover .hp-arrow { opacity: 1; }
        .hp-arrow:hover { color: #fff; }
        .hp-arrow-l { left: 0; }
        .hp-arrow-r { right: 0; }

        .hp-track {
          display: flex; gap: 10px;
          overflow-x: auto; scrollbar-width: none;
          padding: 6px 5% 14px;
        }
        .hp-track::-webkit-scrollbar { display: none; }

        .hp-slot { flex-shrink: 0; width: 148px; }
        .hp-slot-hover { transition: transform 0.3s cubic-bezier(.4,0,.2,1); }
        .hp-slot-hover:hover { transform: translateY(-5px) scale(1.04); }

        /* Skeleton */
        @keyframes hp-shimmer {
          0%   { background-position: -400px 0; }
          100% { background-position:  400px 0; }
        }
        .hp-sk-card {
          background: linear-gradient(
            90deg,
            rgba(255,255,255,0.03) 25%,
            rgba(255,255,255,0.065) 50%,
            rgba(255,255,255,0.03) 75%
          );
          background-size: 400px 100%;
          animation: hp-shimmer 1.5s infinite linear;
          border: 1px solid rgba(255,255,255,0.05);
        }

        /* Fade-up animation */
        @keyframes hp-fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .hp-anim { animation: hp-fadeUp 0.5s cubic-bezier(.4,0,.2,1) both; }
      `}</style>

      {/* ── Your existing components, untouched ───────────── */}
      <NavBar />
      <HeroBanner />

      {/* ── Rows ──────────────────────────────────────────── */}
      <div style={{ paddingBottom: "5rem" }}>

        {/* Core — flows straight out of the hero */}
        {CORE_ROWS.map((row, idx) => (
          <div key={row.key} className="hp-anim" style={{ animationDelay: `${0.05 + idx * 0.1}s` }}>
            <MovieRow {...row} />
          </div>
        ))}

        {/* Special Picks */}
        <SectionDivider label="Special Picks" />
        {SPECIAL_ROWS.map((row, idx) => (
          <div key={row.key} className="hp-anim" style={{ animationDelay: `${0.05 + idx * 0.08}s` }}>
            <MovieRow {...row} />
          </div>
        ))}

        {/* Browse by Genre */}
        <SectionDivider label="Browse by Genre" />
        {GENRE_ROWS.map((row, idx) => (
          <div key={row.key} className="hp-anim" style={{ animationDelay: `${0.05 + idx * 0.08}s` }}>
            <MovieRow {...row} />
          </div>
        ))}

      </div>

      {/* ── Your existing Footer, untouched ───────────────── */}
      <Footer />
    </div>
  );
};

export default HomePage;