import React, { useState, useEffect, useRef, useCallback } from "react";
import MovieCard from "../../components/movies/MovieCard.jsx";
import NavBar from "../../components/layout/NavBar.jsx";
import { useLocation } from "react-router-dom";
import {
  fetchTrending,
  fetchTopRatedMovies,
  fetchRecentMovies,
  fetchByGenre,
  fetchGenres,
} from "../../services/api.js";
import {
  Home, ArrowLeft, ChevronLeft, ChevronRight,
  Flame, Star, Clock, LayoutGrid, List, SlidersHorizontal, X
} from "lucide-react";

// ─────────────────────────────────────────────────────────────
//  Utilities
// ─────────────────────────────────────────────────────────────
const dedup = (arr) => {
  const seen = new Set();
  return arr.filter((item) => (seen.has(item.id) ? false : seen.add(item.id)));
};

const PILL_WIDTHS = [68, 82, 56, 90, 74, 64, 88, 60, 78, 70, 84, 66, 92, 58, 76, 72];

// ─────────────────────────────────────────────────────────────
//  Skeleton
// ─────────────────────────────────────────────────────────────
const SkeletonCard = ({ layout }) => (
  <div
    className="mg-sk-card"
    style={{
      aspectRatio: layout === "list" ? "unset" : "2/3",
      height: layout === "list" ? 90 : "auto",
      borderRadius: 6,
    }}
  />
);

// ─────────────────────────────────────────────────────────────
//  Section Label (rotated vertical text — editorial style)
// ─────────────────────────────────────────────────────────────
const SectionLabel = ({ text, accent }) => (
  <div className="mg-section-label" aria-hidden="true">
    <span style={{ color: accent }}>{text}</span>
  </div>
);

// ─────────────────────────────────────────────────────────────
//  Row — editorial horizontal strip (tighter, denser)
// ─────────────────────────────────────────────────────────────
const MovieRow = ({ title, icon, accent, data, loading, index }) => {
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
    scrollRef.current?.scrollBy({ left: dir * 500, behavior: "smooth" });
    setTimeout(syncEdges, 420);
  };

  return (
    <div className="mg-row">
      {/* ── Left gutter: rotated index + title ── */}
      <div className="mg-row-gutter">
        <span className="mg-row-index" style={{ color: accent }}>
          {String(index + 1).padStart(2, "0")}
        </span>
        <div className="mg-row-meta">
          <span className="mg-row-icon" style={{ color: accent }}>{icon}</span>
          <h2 className="mg-row-title">{title}</h2>
        </div>
        <div className="mg-row-accent-line" style={{ background: accent }} />
      </div>

      {/* ── Track ── */}
      <div className="mg-track-wrap">
        <div className="mg-fade mg-fade-l" style={{ opacity: atStart ? 0 : 1 }} />
        <div className="mg-fade mg-fade-r" style={{ opacity: atEnd   ? 0 : 1 }} />
        {!atStart && (
          <button onClick={() => scroll(-1)} className="mg-arr mg-arr-l" aria-label="Scroll left">
            <ChevronLeft size={18} />
          </button>
        )}
        {!atEnd && (
          <button onClick={() => scroll(1)} className="mg-arr mg-arr-r" aria-label="Scroll right">
            <ChevronRight size={18} />
          </button>
        )}
        <div ref={scrollRef} className="mg-track">
          {loading
            ? Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="mg-slot"><SkeletonCard /></div>
              ))
            : data.map((item, i) => (
                <div key={`${item.id}-${i}`} className="mg-slot mg-slot-hover">
                  <MovieCard {...item} />
                </div>
              ))}
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
//  Main Component
// ─────────────────────────────────────────────────────────────
const MovieGrid = ({ type }) => {
  const location  = useLocation();
  const mediaType = type || location.state?.filterType || "all";

  const [genres,       setGenres      ] = useState([]);
  const [genresReady,  setGenresReady ] = useState(false);
  const [trending,      setTrending     ] = useState([]);
  const [topRated,      setTopRated     ] = useState([]);
  const [recentlyAdded, setRecentlyAdded] = useState([]);
  const [loading,       setLoading      ] = useState(true);
  const [selectedGenre, setSelectedGenre] = useState(null);
  const [genreMovies,   setGenreMovies  ] = useState([]);
  const [isFiltering,   setIsFiltering  ] = useState(false);
  const [currentPage,   setCurrentPage  ] = useState(1);
  const [hasMore,       setHasMore      ] = useState(true);
  const [loadingMore,   setLoadingMore  ] = useState(false);
  const [layout,        setLayout       ] = useState("grid"); // "grid" | "list"
  const [filterOpen,    setFilterOpen   ] = useState(false);

  const sentinelRef = useRef(null);
  const observerRef = useRef(null);
  const loadingRef  = useRef(false);

  useEffect(() => { resetToHome(); }, [mediaType]);

  useEffect(() => {
    setGenresReady(false);
    (async () => {
      try {
        const data = await fetchGenres(mediaType);
        setGenres(data);
      } catch (e) { console.error(e); setGenres([]); }
      finally { setGenresReady(true); }
    })();
  }, [mediaType]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [t, tr, r] = await Promise.all([
          fetchTrending(mediaType),
          fetchTopRatedMovies(mediaType),
          fetchRecentMovies(mediaType),
        ]);
        setTrending(dedup(t));
        setTopRated(dedup(tr));
        setRecentlyAdded(dedup(r));
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, [mediaType]);

  const setupObserver = useCallback(() => {
    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new IntersectionObserver(
      async (entries) => {
        if (!entries[0].isIntersecting || loadingRef.current) return;
        loadingRef.current = true;
        setLoadingMore(true);
        try {
          setCurrentPage((prev) => {
            const nextPage = prev + 1;
            setGenreMovies((prevMovies) => {
              const existingIds = new Set(prevMovies.map((m) => m.id));
              setSelectedGenre((prevGenre) => {
                const genre = genres.find((g) => g.name === prevGenre);
                if (!genre) return prevGenre;
                fetchByGenre(genre.id, nextPage, mediaType)
                  .then((data) => {
                    const fresh = data.filter((m) => !existingIds.has(m.id));
                    if (!fresh.length) setHasMore(false);
                    else setGenreMovies((pm) => [...pm, ...fresh]);
                    loadingRef.current = false;
                    setLoadingMore(false);
                  })
                  .catch(() => { loadingRef.current = false; setLoadingMore(false); });
                return prevGenre;
              });
              return prevMovies;
            });
            return nextPage;
          });
        } catch { loadingRef.current = false; setLoadingMore(false); }
      },
      { rootMargin: "300px" }
    );
    if (sentinelRef.current) observerRef.current.observe(sentinelRef.current);
  }, [mediaType, genres]);

  useEffect(() => {
    if (selectedGenre && hasMore && !isFiltering) setupObserver();
    else observerRef.current?.disconnect();
    return () => observerRef.current?.disconnect();
  }, [selectedGenre, hasMore, isFiltering, setupObserver]);

  const handleGenreClick = async (genre) => {
    if (selectedGenre === genre.name) { resetToHome(); return; }
    observerRef.current?.disconnect();
    loadingRef.current = false;
    setSelectedGenre(genre.name);
    setIsFiltering(true);
    setCurrentPage(1);
    setGenreMovies([]);
    setHasMore(true);
    setFilterOpen(false);
    try {
      const data = await fetchByGenre(genre.id, 1, mediaType);
      setGenreMovies(data);
      setHasMore(data.length >= 20);
    } catch (e) { console.error(e); }
    finally { setIsFiltering(false); }
  };

  const resetToHome = () => {
    observerRef.current?.disconnect();
    loadingRef.current = false;
    setSelectedGenre(null);
    setGenreMovies([]);
    setCurrentPage(1);
    setHasMore(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const ROWS = [
    { key: "trending", title: "Trending",      icon: <Flame size={13}/>, accent: "#f87171", data: trending      },
    { key: "toprated", title: "Top Rated",      icon: <Star  size={13}/>, accent: "#d4a853", data: topRated      },
    { key: "recent",   title: "New Releases",   icon: <Clock size={13}/>, accent: "#60a5fa", data: recentlyAdded },
  ];

  const pageLabel =
    mediaType === "tv" ? "Television" : mediaType === "movie" ? "Cinema" : "Catalogue";
  const pageTitle =
    selectedGenre ?? (mediaType === "tv" ? "TV Shows" : mediaType === "movie" ? "Movies" : "All Titles");

  // ─────────────────────────────────────────────────────────
  //  Render
  // ─────────────────────────────────────────────────────────
  return (
    <div className="mg-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Mono:wght@400;500&family=Outfit:wght@300;400;500;600;700&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        /* ── Root ─────────────────────────────────────── */
        .mg-root {
          min-height: 100vh;
          background: #0a0a0a;
          color: #fff;
          font-family: 'Outfit', sans-serif;
          overflow-x: hidden;
        }

        /* ── Texture overlay ──────────────────────────── */
        .mg-texture {
          position: fixed; inset: 0; z-index: 0;
          pointer-events: none; opacity: 0.018;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
          background-size: 200px;
        }

        /* ── Vertical accent rule (left side) ─────────── */
        .mg-spine {
          position: fixed; left: 0; top: 0; bottom: 0;
          width: 3px; z-index: 5; pointer-events: none;
          background: linear-gradient(
            to bottom,
            transparent 0%,
            #d4a853 20%,
            #f87171 50%,
            #60a5fa 80%,
            transparent 100%
          );
          opacity: 0.35;
        }

        /* ── NavBar wrapper ───────────────────────────── */
        .mg-nav { position: relative; z-index: 10; }

        /* ── Page masthead ────────────────────────────── */
        .mg-masthead {
          position: relative; z-index: 2;
          padding: 3rem 5% 0;
          display: flex; align-items: flex-end;
          justify-content: space-between;
          gap: 20px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          padding-bottom: 1.5rem;
        }
        .mg-masthead-left { display: flex; flex-direction: column; gap: 4px; }
        .mg-masthead-label {
          font-family: 'DM Mono', monospace;
          font-size: 9px; letter-spacing: 0.32em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.22);
        }
        .mg-masthead-title {
          font-family: 'DM Serif Display', serif;
          font-style: italic;
          font-size: clamp(2.8rem, 6vw, 5rem);
          line-height: 0.92;
          color: #fff;
          letter-spacing: -0.02em;
        }
        .mg-masthead-title .mg-accent { color: #d4a853; }

        /* Masthead right — controls */
        .mg-masthead-right {
          display: flex; align-items: center; gap: 10px;
          padding-bottom: 6px; flex-shrink: 0;
        }
        .mg-ctrl-btn {
          display: flex; align-items: center; gap: 6px;
          padding: 7px 14px; border-radius: 4px;
          font-size: 9px; font-weight: 600;
          letter-spacing: 0.1em; text-transform: uppercase;
          font-family: 'DM Mono', monospace;
          cursor: pointer; transition: all 0.18s ease;
          background: transparent;
          border: 1px solid rgba(255,255,255,0.1);
          color: rgba(255,255,255,0.35);
        }
        .mg-ctrl-btn:hover { border-color: rgba(255,255,255,0.22); color: rgba(255,255,255,0.7); }
        .mg-ctrl-btn-on {
          background: rgba(212,168,83,0.1) !important;
          border-color: rgba(212,168,83,0.4) !important;
          color: #d4a853 !important;
        }

        /* ── Filter drawer ────────────────────────────── */
        .mg-filter-backdrop {
          position: fixed; inset: 0; z-index: 19;
          background: rgba(0,0,0,0.6);
          backdrop-filter: blur(4px);
          animation: mg-fade-in 0.2s ease forwards;
        }
        .mg-filter-panel {
          position: fixed; top: 0; right: 0; bottom: 0;
          width: min(360px, 90vw); z-index: 20;
          background: #111;
          border-left: 1px solid rgba(255,255,255,0.07);
          overflow-y: auto; overscroll-behavior: contain;
          animation: mg-slide-in 0.28s cubic-bezier(.4,0,.2,1) forwards;
          padding: 2rem 0 3rem;
        }
        @keyframes mg-slide-in {
          from { transform: translateX(100%); }
          to   { transform: translateX(0); }
        }
        @keyframes mg-fade-in {
          from { opacity: 0; } to { opacity: 1; }
        }
        .mg-filter-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 24px 1.5rem;
          border-bottom: 1px solid rgba(255,255,255,0.07);
          margin-bottom: 1.5rem;
        }
        .mg-filter-title {
          font-family: 'DM Serif Display', serif;
          font-style: italic; font-size: 1.4rem; color: #fff;
        }
        .mg-filter-close {
          width: 30px; height: 30px; border-radius: 4px;
          display: flex; align-items: center; justify-content: center;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.09);
          color: rgba(255,255,255,0.4); cursor: pointer;
          transition: all 0.15s ease;
        }
        .mg-filter-close:hover { color: #fff; background: rgba(255,255,255,0.1); }

        .mg-filter-section-label {
          font-family: 'DM Mono', monospace;
          font-size: 8px; letter-spacing: 0.3em;
          text-transform: uppercase; color: rgba(255,255,255,0.2);
          padding: 0 24px 10px;
        }
        .mg-filter-genre {
          display: flex; align-items: center;
          padding: 11px 24px;
          font-size: 12px; font-weight: 500;
          color: rgba(255,255,255,0.45);
          cursor: pointer; transition: all 0.15s ease;
          border-left: 2px solid transparent;
          letter-spacing: 0.02em;
        }
        .mg-filter-genre:hover { color: rgba(255,255,255,0.8); background: rgba(255,255,255,0.03); }
        .mg-filter-genre-active {
          color: #d4a853 !important;
          border-left-color: #d4a853 !important;
          background: rgba(212,168,83,0.06) !important;
        }
        .mg-filter-genre-dot {
          width: 5px; height: 5px; border-radius: 50%;
          background: currentColor; margin-right: 12px; flex-shrink: 0;
          opacity: 0.5; transition: opacity 0.15s;
        }
        .mg-filter-genre:hover .mg-filter-genre-dot,
        .mg-filter-genre-active .mg-filter-genre-dot { opacity: 1; }

        /* ── Genre pill bar (compact, under masthead) ──── */
        .mg-pill-bar {
          position: relative; z-index: 2;
          padding: 14px 5%;
          display: flex; align-items: center; gap: 8px;
          border-bottom: 1px solid rgba(255,255,255,0.04);
          overflow: hidden;
        }
        .mg-pill-bar-inner {
          display: flex; gap: 6px; overflow-x: auto;
          scrollbar-width: none; padding-bottom: 2px;
          flex: 1;
        }
        .mg-pill-bar-inner::-webkit-scrollbar { display: none; }

        .mg-pill {
          flex-shrink: 0;
          padding: 5px 13px; border-radius: 3px;
          font-family: 'DM Mono', monospace;
          font-size: 9px; font-weight: 500;
          letter-spacing: 0.08em; text-transform: uppercase;
          cursor: pointer; white-space: nowrap;
          transition: all 0.18s ease;
          border: 1px solid rgba(255,255,255,0.07);
          background: transparent;
          color: rgba(255,255,255,0.3);
        }
        .mg-pill:hover:not(.mg-pill-active) {
          border-color: rgba(255,255,255,0.16);
          color: rgba(255,255,255,0.65);
        }
        .mg-pill-active {
          background: rgba(212,168,83,0.12) !important;
          border-color: rgba(212,168,83,0.5) !important;
          color: #d4a853 !important;
        }

        @keyframes mg-shimmer {
          0%   { background-position: -400px 0; }
          100% { background-position:  400px 0; }
        }
        .mg-sk-pill {
          height: 26px; border-radius: 3px; flex-shrink: 0;
          background: linear-gradient(90deg, rgba(255,255,255,0.02) 25%, rgba(255,255,255,0.05) 50%, rgba(255,255,255,0.02) 75%);
          background-size: 400px 100%;
          animation: mg-shimmer 1.6s infinite linear;
          border: 1px solid rgba(255,255,255,0.04);
        }

        /* ── Main layout: rows view ───────────────────── */
        .mg-main { position: relative; z-index: 2; padding-bottom: 6rem; }

        /* ── Row ──────────────────────────────────────── */
        .mg-row {
          display: flex;
          border-bottom: 1px solid rgba(255,255,255,0.04);
          padding: 2rem 0;
        }

        /* Left gutter */
        .mg-row-gutter {
          width: 88px; flex-shrink: 0;
          display: flex; flex-direction: column;
          align-items: center; gap: 10px;
          padding: 4px 0 0 5%;
        }
        .mg-row-index {
          font-family: 'DM Serif Display', serif;
          font-style: italic;
          font-size: 2.2rem; line-height: 1;
          opacity: 0.9;
        }
        .mg-row-meta {
          display: flex; flex-direction: column;
          align-items: center; gap: 5px;
        }
        .mg-row-icon { display: flex; }
        .mg-row-title {
          font-family: 'DM Mono', monospace;
          font-size: 7px; font-weight: 500;
          letter-spacing: 0.22em; text-transform: uppercase;
          color: rgba(255,255,255,0.3);
          writing-mode: vertical-rl;
          text-orientation: mixed;
          transform: rotate(180deg);
          white-space: nowrap;
        }
        .mg-row-accent-line {
          width: 1px; flex: 1; min-height: 20px;
          opacity: 0.35; border-radius: 1px;
        }

        /* Track */
        .mg-track-wrap { flex: 1; min-width: 0; position: relative; overflow: hidden; }
        .mg-fade {
          position: absolute; top: 0; bottom: 10px; z-index: 2;
          pointer-events: none; transition: opacity 0.3s; width: 80px;
        }
        .mg-fade-l { left: 0;  background: linear-gradient(90deg,  #0a0a0a 0%, transparent 100%); }
        .mg-fade-r { right: 0; background: linear-gradient(-90deg, #0a0a0a 0%, transparent 100%); }

        .mg-arr {
          position: absolute; top: 50%; transform: translateY(-50%);
          z-index: 3; background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1); border-radius: 3px;
          width: 28px; height: 28px;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; color: rgba(255,255,255,0.4);
          opacity: 0; transition: opacity 0.22s, color 0.15s;
        }
        .mg-track-wrap:hover .mg-arr { opacity: 1; }
        .mg-arr:hover { color: #fff; background: rgba(255,255,255,0.1); }
        .mg-arr-l { left: 6px; }
        .mg-arr-r { right: 6px; }

        .mg-track {
          display: flex; gap: 8px;
          overflow-x: auto; scrollbar-width: none;
          padding: 4px 24px 10px 8px;
        }
        .mg-track::-webkit-scrollbar { display: none; }

        .mg-slot { flex-shrink: 0; width: 130px; }
        .mg-slot-hover { transition: transform 0.25s cubic-bezier(.4,0,.2,1); }
        .mg-slot-hover:hover { transform: translateY(-4px) scale(1.03); }

        .mg-sk-card {
          background: linear-gradient(90deg, rgba(255,255,255,0.025) 25%, rgba(255,255,255,0.055) 50%, rgba(255,255,255,0.025) 75%);
          background-size: 400px 100%;
          animation: mg-shimmer 1.6s infinite linear;
          border: 1px solid rgba(255,255,255,0.04);
        }

        /* ── Genre grid view ──────────────────────────── */
        .mg-genre-masthead {
          position: relative; z-index: 2;
          padding: 2.5rem 5% 1.5rem;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          display: flex; align-items: flex-end; justify-content: space-between; gap: 20px;
        }
        .mg-genre-masthead-left { display: flex; flex-direction: column; gap: 5px; }
        .mg-genre-count {
          font-family: 'DM Mono', monospace;
          font-size: 8px; letter-spacing: 0.3em;
          text-transform: uppercase; color: rgba(255,255,255,0.2);
        }
        .mg-genre-title {
          font-family: 'DM Serif Display', serif;
          font-style: italic;
          font-size: clamp(2rem, 5vw, 3.8rem);
          line-height: 0.95; color: #fff; letter-spacing: -0.02em;
        }
        .mg-genre-title .mg-accent { color: #d4a853; }

        .mg-back-btn {
          display: flex; align-items: center; gap: 7px;
          padding: 8px 16px; border-radius: 4px;
          font-family: 'DM Mono', monospace;
          font-size: 9px; font-weight: 500;
          letter-spacing: 0.1em; text-transform: uppercase;
          cursor: pointer; transition: all 0.18s ease;
          background: transparent;
          border: 1px solid rgba(255,255,255,0.1);
          color: rgba(255,255,255,0.3);
          flex-shrink: 0;
        }
        .mg-back-btn:hover { border-color: rgba(255,255,255,0.22); color: rgba(255,255,255,0.7); }

        /* Layout toggle toolbar */
        .mg-toolbar {
          padding: 12px 5%;
          display: flex; align-items: center; gap: 10px;
          border-bottom: 1px solid rgba(255,255,255,0.04);
        }
        .mg-toolbar-spacer { flex: 1; }

        /* Grid layout */
        .mg-grid {
          padding: 24px 5%;
          display: grid;
          gap: 10px;
        }
        .mg-grid-dense {
          grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
        }
        .mg-grid-comfortable {
          grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
          gap: 14px;
        }

        .mg-grid-card {
          border-radius: 5px; overflow: hidden;
          border: 1px solid rgba(255,255,255,0.05);
          transition: all 0.25s cubic-bezier(.4,0,.2,1);
          cursor: pointer;
        }
        .mg-grid-card:hover {
          border-color: rgba(212,168,83,0.3);
          transform: translateY(-3px);
          box-shadow: 0 14px 36px rgba(0,0,0,0.7);
        }

        /* List layout */
        .mg-list { padding: 8px 5%; display: flex; flex-direction: column; gap: 2px; }
        .mg-list-card {
          display: flex; align-items: center; gap: 14px;
          padding: 10px 12px; border-radius: 4px;
          border: 1px solid transparent;
          transition: all 0.18s ease; cursor: pointer;
        }
        .mg-list-card:hover {
          background: rgba(255,255,255,0.03);
          border-color: rgba(255,255,255,0.07);
        }
        .mg-list-thumb {
          width: 44px; height: 66px; border-radius: 4px;
          overflow: hidden; flex-shrink: 0;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.07);
        }
        .mg-list-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .mg-list-info { flex: 1; min-width: 0; }
        .mg-list-title {
          font-size: 13px; font-weight: 600;
          color: rgba(255,255,255,0.82);
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
          margin-bottom: 4px;
        }
        .mg-list-meta {
          font-family: 'DM Mono', monospace;
          font-size: 9px; color: rgba(255,255,255,0.28);
          letter-spacing: 0.06em; text-transform: uppercase;
        }
        .mg-list-rating {
          font-family: 'DM Mono', monospace;
          font-size: 11px; color: #d4a853; font-weight: 500;
          flex-shrink: 0;
        }

        /* Spinner */
        .mg-spinner {
          width: 24px; height: 24px; border-radius: 50%;
          border: 1.5px solid rgba(212,168,83,0.15);
          border-top-color: #d4a853;
          animation: mg-spin 0.9s linear infinite;
        }
        @keyframes mg-spin { to { transform: rotate(360deg); } }

        /* End of results */
        .mg-end {
          display: flex; flex-direction: column;
          align-items: center; gap: 14px;
          padding: 4rem 0;
        }
        .mg-end-rule {
          display: flex; align-items: center; gap: 12px;
        }
        .mg-end-line {
          width: 48px; height: 1px;
          background: rgba(212,168,83,0.3);
        }
        .mg-end-diamond {
          width: 6px; height: 6px;
          background: rgba(212,168,83,0.5);
          transform: rotate(45deg);
        }
        .mg-end-text {
          font-family: 'DM Mono', monospace;
          font-size: 8px; letter-spacing: 0.4em;
          text-transform: uppercase; color: rgba(255,255,255,0.18);
        }
        .mg-browse-btn {
          display: flex; align-items: center; gap: 8px;
          padding: 9px 20px; border-radius: 4px;
          font-family: 'DM Mono', monospace;
          font-size: 9px; font-weight: 500;
          letter-spacing: 0.1em; text-transform: uppercase;
          cursor: pointer; transition: all 0.22s ease;
          background: rgba(212,168,83,0.08);
          border: 1px solid rgba(212,168,83,0.28);
          color: rgba(212,168,83,0.7);
        }
        .mg-browse-btn:hover {
          background: rgba(212,168,83,0.14);
          border-color: rgba(212,168,83,0.5);
          color: #d4a853;
        }

        /* Animations */
        @keyframes mg-fadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .mg-anim { animation: mg-fadeUp 0.42s cubic-bezier(.4,0,.2,1) both; }
      `}</style>

      {/* Texture + spine */}
      <div className="mg-texture" aria-hidden="true" />
      <div className="mg-spine"  aria-hidden="true" />

      {/* NavBar */}
      <div className="mg-nav"><NavBar /></div>

      {/* ── Masthead ──────────────────────────────────── */}
      <div className="mg-masthead">
        <div className="mg-masthead-left">
          <span className="mg-masthead-label">{pageLabel} / Crystal.</span>
          <h1 className="mg-masthead-title">
            {pageTitle.length > 0 ? (
              <><span className="mg-accent">{pageTitle[0]}</span>{pageTitle.slice(1)}</>
            ) : pageTitle}
          </h1>
        </div>
        <div className="mg-masthead-right">
          <button
            className={`mg-ctrl-btn ${layout === "grid" ? "mg-ctrl-btn-on" : ""}`}
            onClick={() => setLayout("grid")}
            title="Grid view"
          >
            <LayoutGrid size={12} />
          </button>
          <button
            className={`mg-ctrl-btn ${layout === "list" ? "mg-ctrl-btn-on" : ""}`}
            onClick={() => setLayout("list")}
            title="List view"
          >
            <List size={12} />
          </button>
          <button
            className={`mg-ctrl-btn ${filterOpen ? "mg-ctrl-btn-on" : ""}`}
            onClick={() => setFilterOpen(true)}
          >
            <SlidersHorizontal size={12} /> Genres
          </button>
          {selectedGenre && (
            <button className="mg-ctrl-btn" onClick={resetToHome}>
              <X size={11} /> Clear
            </button>
          )}
        </div>
      </div>

      {/* ── Pill bar (quick genre access) ─────────────── */}
      <div className="mg-pill-bar">
        <div className="mg-pill-bar-inner">
          {!genresReady
            ? PILL_WIDTHS.map((w, i) => (
                <div key={i} className="mg-sk-pill" style={{ width: w }} />
              ))
            : genres.map((genre) => (
                <button
                  key={genre.id}
                  onClick={() => handleGenreClick(genre)}
                  className={`mg-pill${selectedGenre === genre.name ? " mg-pill-active" : ""}`}
                >
                  {genre.name}
                </button>
              ))}
        </div>
      </div>

      {/* ── Filter drawer ──────────────────────────────── */}
      {filterOpen && (
        <>
          <div className="mg-filter-backdrop" onClick={() => setFilterOpen(false)} />
          <div className="mg-filter-panel">
            <div className="mg-filter-header">
              <span className="mg-filter-title">Genres</span>
              <button className="mg-filter-close" onClick={() => setFilterOpen(false)}>
                <X size={13} />
              </button>
            </div>
            <div className="mg-filter-section-label">Select a genre</div>
            {!genresReady ? (
              <div style={{ padding: "0 24px" }}>
                {PILL_WIDTHS.map((w, i) => (
                  <div key={i} className="mg-sk-pill" style={{ width: "100%", marginBottom: 8, height: 38, borderRadius: 3 }} />
                ))}
              </div>
            ) : genres.map((genre) => (
              <div
                key={genre.id}
                onClick={() => handleGenreClick(genre)}
                className={`mg-filter-genre${selectedGenre === genre.name ? " mg-filter-genre-active" : ""}`}
              >
                <span className="mg-filter-genre-dot" />
                {genre.name}
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Main content ───────────────────────────────── */}
      <main className="mg-main">
        {selectedGenre ? (

          /* ── Genre grid / list view ── */
          <div className="mg-anim">
            <div className="mg-genre-masthead">
              <div className="mg-genre-masthead-left">
                <span className="mg-genre-count">{genreMovies.length} titles</span>
                <h2 className="mg-genre-title">
                  <span className="mg-accent">{selectedGenre[0]}</span>{selectedGenre.slice(1)}
                </h2>
              </div>
              <button onClick={resetToHome} className="mg-back-btn">
                <ArrowLeft size={11} /> All
              </button>
            </div>

            {/* Toolbar */}
            <div className="mg-toolbar">
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.18)" }}>
                View
              </span>
              <button className={`mg-ctrl-btn ${layout === "grid" ? "mg-ctrl-btn-on" : ""}`} onClick={() => setLayout("grid")}>
                <LayoutGrid size={11} /> Grid
              </button>
              <button className={`mg-ctrl-btn ${layout === "list" ? "mg-ctrl-btn-on" : ""}`} onClick={() => setLayout("list")}>
                <List size={11} /> List
              </button>
            </div>

            {isFiltering ? (
              <div className={`mg-grid mg-grid-dense`}>
                {Array.from({ length: 20 }).map((_, i) => (
                  <div key={i} className="mg-sk-card" style={{ aspectRatio: "2/3", borderRadius: 5 }} />
                ))}
              </div>
            ) : layout === "list" ? (
              /* ── List layout ── */
              <div className="mg-list">
                {genreMovies.map((item, i) => (
                  <div key={`${item.id}-${i}`} className="mg-list-card">
                    <div className="mg-list-thumb">
                      {item.poster && <img src={item.poster} alt={item.title} loading="lazy" />}
                    </div>
                    <div className="mg-list-info">
                      <p className="mg-list-title">{item.title}</p>
                      <p className="mg-list-meta">
                        {item.mediaType === "tv" ? "Series" : "Film"}
                        {item.year ? ` · ${item.year}` : ""}
                      </p>
                    </div>
                    {item.rating && (
                      <span className="mg-list-rating">
                        ★ {parseFloat(item.rating).toFixed(1)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              /* ── Grid layout ── */
              <div className="mg-grid mg-grid-dense">
                {genreMovies.map((item, i) => (
                  <div key={`${item.id}-${i}`} className="mg-grid-card">
                    <MovieCard {...item} />
                  </div>
                ))}
              </div>
            )}

            {/* Sentinel */}
            {hasMore && (
              <div ref={sentinelRef} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "2.5rem 0" }}>
                {loadingMore && (
                  <>
                    <div className="mg-spinner" />
                    <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 8, letterSpacing: "0.35em", textTransform: "uppercase", color: "rgba(255,255,255,0.18)", marginTop: 4 }}>
                      Loading…
                    </p>
                  </>
                )}
              </div>
            )}

            {/* End of results */}
            {!hasMore && genreMovies.length > 0 && (
              <div className="mg-end">
                <div className="mg-end-rule">
                  <div className="mg-end-line" />
                  <div className="mg-end-diamond" />
                  <div className="mg-end-line" />
                </div>
                <p className="mg-end-text">All {genreMovies.length} results</p>
                <button onClick={resetToHome} className="mg-browse-btn">
                  <Home size={10} /> Browse genres
                </button>
              </div>
            )}
          </div>

        ) : (

          /* ── Home rows view ── */
          <div>
            {ROWS.map((row, idx) => (
              <div key={row.key} className="mg-anim" style={{ animationDelay: `${0.06 + idx * 0.1}s` }}>
                <MovieRow
                  title={row.title}
                  icon={row.icon}
                  accent={row.accent}
                  data={row.data}
                  loading={loading}
                  index={idx}
                />
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default MovieGrid;