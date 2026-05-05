import React, { useState, useEffect, useRef, useCallback } from "react";
import MovieCard from "../components/movies/MovieCard.jsx";
import NavBar from "../components/layout/NavBar.jsx";
import { useLocation } from "react-router-dom";
import {
  fetchTrending,
  fetchTopRatedMovies,
  fetchRecentMovies,
  fetchByGenre,
} from "../services/api.js";
import {
  Home,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Flame,
  Star,
  Sparkles,
  Film,
  Tv,
  Grid3X3,
  TrendingUp,
  Clock,
  Zap,
} from "lucide-react";

// ── Genre map ─────────────────────────────────────────────────────────────────
const GENRES = [
  { name: "Action",      id: 28 },
  { name: "Adventure",   id: 12 },
  { name: "Animation",   id: 16 },
  { name: "Comedy",      id: 35 },
  { name: "Crime",       id: 80 },
  { name: "Documentary", id: 99 },
  { name: "Drama",       id: 18 },
  { name: "Family",      id: 10751 },
  { name: "Fantasy",     id: 14 },
  { name: "History",     id: 36 },
  { name: "Horror",      id: 27 },
  { name: "Music",       id: 10402 },
  { name: "Mystery",     id: 9648 },
  { name: "Romance",     id: 10749 },
  { name: "Sci-Fi",      id: 878 },
  { name: "Thriller",    id: 53 },
  { name: "War",         id: 10752 },
  { name: "Western",     id: 37 },
  { name: "Kids & TV",   id: 10762 },
  { name: "Reality",     id: 10764 },
];

const dedup = (arr) => {
  const seen = new Set();
  return arr.filter((item) => (seen.has(item.id) ? false : seen.add(item.id)));
};

// ── Skeleton Card ─────────────────────────────────────────────────────────────
const SkeletonCard = () => (
  <div
    className="skeleton-card rounded-xl overflow-hidden"
    style={{ aspectRatio: "2/3" }}
  />
);

// ── Section Header ─────────────────────────────────────────────────────────────
const SectionHeader = ({ icon: Icon, label, accent }) => (
  <div className="flex items-center gap-3 mb-5">
    <div
      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
      style={{ background: accent + "18", border: `1px solid ${accent}35` }}
    >
      <Icon size={14} style={{ color: accent }} />
    </div>
    <div>
      <p className="text-[8px] uppercase tracking-[0.4em] font-semibold"
        style={{ color: accent + "80" }}>
        Collection
      </p>
      <h2 className="text-[13px] font-bold uppercase tracking-widest text-white/80">
        {label}
      </h2>
    </div>
    <div className="flex-1 h-px ml-2" style={{ background: `linear-gradient(90deg, ${accent}25, transparent)` }} />
  </div>
);

// ── Movie Row ─────────────────────────────────────────────────────────────────
const MovieRow = ({ title, icon, accent, data, loading }) => {
  const scrollRef = useRef(null);
  const scroll = (dir) =>
    scrollRef.current?.scrollBy({ left: dir * 360, behavior: "smooth" });

  return (
    <div className="space-y-0 group/row">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: accent + "15", border: `1px solid ${accent}30` }}
          >
            {icon}
          </div>
          <div className="flex items-center gap-2.5">
            <div className="w-0.5 h-4 rounded-full flex-shrink-0" style={{ background: accent }} />
            <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/70">
              {title}
            </h2>
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity duration-300">
          <button
            onClick={() => scroll(-1)}
            className="row-nav-btn"
          >
            <ChevronLeft size={12} />
          </button>
          <button
            onClick={() => scroll(1)}
            className="row-nav-btn"
          >
            <ChevronRight size={12} />
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto pb-2 no-scrollbar snap-x snap-mandatory"
      >
        {loading
          ? Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="flex-none snap-start" style={{ width: 148 }}>
                <SkeletonCard />
              </div>
            ))
          : data.map((item, i) => (
              <div
                key={`${item.id}-${i}`}
                className="flex-none snap-start row-card-wrap"
                style={{ width: 148 }}
              >
                <MovieCard {...item} />
              </div>
            ))}
      </div>
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────
const MovieGrid = ({ type }) => {
  const location = useLocation();
  const mediaType = type || location.state?.filterType || "all";

  const [trending, setTrending]           = useState([]);
  const [topRated, setTopRated]           = useState([]);
  const [recentlyAdded, setRecentlyAdded] = useState([]);
  const [loading, setLoading]             = useState(true);

  const [selectedGenre, setSelectedGenre] = useState(null);
  const [genreMovies, setGenreMovies]     = useState([]);
  const [isFiltering, setIsFiltering]     = useState(false);
  const [currentPage, setCurrentPage]     = useState(1);
  const [hasMore, setHasMore]             = useState(true);
  const [loadingMore, setLoadingMore]     = useState(false);

  const sentinelRef  = useRef(null);
  const observerRef  = useRef(null);
  const loadingRef   = useRef(false);

  useEffect(() => { resetToHome(); }, [mediaType]);

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
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
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
                const genre = GENRES.find((g) => g.name === prevGenre);
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
        } catch {
          loadingRef.current = false;
          setLoadingMore(false);
        }
      },
      { rootMargin: "300px" },
    );
    if (sentinelRef.current) observerRef.current.observe(sentinelRef.current);
  }, [mediaType]);

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
    try {
      const data = await fetchByGenre(genre.id, 1, mediaType);
      setGenreMovies(data);
      setHasMore(data.length >= 20);
    } catch (e) {
      console.error(e);
    } finally {
      setIsFiltering(false);
    }
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

  const rows = [
    { title: "Trending Now",    icon: <Flame size={13} style={{ color: "#f87171" }} />,   accent: "#f87171", data: trending,       key: "trending" },
    { title: "Top Rated",       icon: <Star  size={13} style={{ color: "#d4a853" }} />,    accent: "#d4a853", data: topRated,       key: "toprated" },
    { title: "Recently Added",  icon: <Clock size={13} style={{ color: "#60a5fa" }} />,    accent: "#60a5fa", data: recentlyAdded,  key: "recent" },
  ];

  return (
    <div
      className="min-h-screen bg-[#080808] text-white overflow-x-hidden"
      style={{ fontFamily: "'Sora', sans-serif" }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=Playfair+Display:ital,wght@0,700;0,900;1,400;1,700&display=swap');

        :root {
          --gold: #d4a853;
          --gold-dim: rgba(212,168,83,0.12);
          --glass: rgba(255,255,255,0.03);
          --glass2: rgba(255,255,255,0.06);
          --border: rgba(255,255,255,0.07);
          --border2: rgba(255,255,255,0.13);
        }

        .font-display { font-family: 'Playfair Display', serif; }

        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

        .thin-scroll::-webkit-scrollbar { width: 2px; }
        .thin-scroll::-webkit-scrollbar-track { background: transparent; }
        .thin-scroll::-webkit-scrollbar-thumb { background: var(--gold); border-radius: 9px; }

        /* Animations */
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes shimmer {
          0%   { background-position: -500px 0; }
          100% { background-position:  500px 0; }
        }
        @keyframes ping-soft {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50%       { opacity: 0.7; transform: scale(1.05); }
        }

        .a1 { animation: fadeUp .55s ease .05s both; }
        .a2 { animation: fadeUp .55s ease .15s both; }
        .a3 { animation: fadeUp .55s ease .25s both; }
        .a4 { animation: fadeUp .55s ease .35s both; }
        .grid-in { animation: fadeUp .45s ease both; }

        /* Skeleton */
        .skeleton-card {
          background: linear-gradient(
            90deg,
            rgba(255,255,255,0.03) 25%,
            rgba(255,255,255,0.065) 50%,
            rgba(255,255,255,0.03) 75%
          );
          background-size: 500px 100%;
          animation: shimmer 1.5s infinite linear;
          border: 1px solid rgba(255,255,255,0.05);
        }

        /* Genre pills */
        .genre-pill {
          display: inline-flex;
          align-items: center;
          padding: 7px 15px;
          border-radius: 30px;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: .07em;
          text-transform: uppercase;
          transition: all .22s cubic-bezier(.4,0,.2,1);
          white-space: nowrap;
          flex-shrink: 0;
          cursor: pointer;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          color: rgba(255,255,255,0.38);
        }
        .genre-pill:hover {
          background: rgba(255,255,255,0.07);
          border-color: rgba(255,255,255,0.15);
          color: rgba(255,255,255,0.75);
          transform: translateY(-1px);
        }
        .genre-pill-active {
          background: rgba(212,168,83,0.15) !important;
          border-color: rgba(212,168,83,0.45) !important;
          color: #d4a853 !important;
          box-shadow: 0 4px 18px rgba(212,168,83,0.2);
          transform: translateY(-1px) !important;
        }

        /* Row nav buttons */
        .row-nav-btn {
          width: 28px; height: 28px;
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          color: rgba(255,255,255,0.35);
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          transition: all .2s ease;
          cursor: pointer;
        }
        .row-nav-btn:hover {
          color: white;
          background: rgba(255,255,255,0.09);
          border-color: rgba(255,255,255,0.16);
        }

        /* Row card hover lift */
        .row-card-wrap {
          transition: transform .3s cubic-bezier(.4,0,.2,1);
        }
        .row-card-wrap:hover { transform: translateY(-4px); }

        /* Genre grid cards */
        .genre-grid-card {
          border-radius: 14px;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,0.06);
          transition: all .32s cubic-bezier(.4,0,.2,1);
          cursor: pointer;
        }
        .genre-grid-card:hover {
          border-color: rgba(212,168,83,0.3);
          transform: translateY(-4px);
          box-shadow: 0 16px 44px rgba(0,0,0,0.5);
        }

        /* Section divider */
        .section-divider {
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.07) 30%, rgba(255,255,255,0.07) 70%, transparent);
        }

        /* Stat badge */
        .stat-badge {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 4px 10px; border-radius: 20px;
          font-size: 9px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          color: rgba(255,255,255,0.35);
        }

        /* Back button */
        .back-btn {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 7px 14px; border-radius: 30px;
          font-size: 10px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.09);
          color: rgba(255,255,255,0.35);
          transition: all .2s ease;
          cursor: pointer;
        }
        .back-btn:hover {
          background: rgba(255,255,255,0.08);
          border-color: rgba(255,255,255,0.15);
          color: rgba(255,255,255,0.7);
        }

        /* End-of-results button */
        .browse-btn {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 10px 22px; border-radius: 30px;
          font-size: 10px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase;
          background: rgba(212,168,83,0.09);
          border: 1px solid rgba(212,168,83,0.25);
          color: rgba(212,168,83,0.75);
          transition: all .25s ease;
          cursor: pointer;
        }
        .browse-btn:hover {
          background: rgba(212,168,83,0.16);
          border-color: rgba(212,168,83,0.45);
          color: #d4a853;
          transform: translateY(-1px);
          box-shadow: 0 8px 24px rgba(212,168,83,0.15);
        }

        /* Gold spinner */
        .gold-spinner {
          width: 32px; height: 32px;
          border-radius: 50%;
          border: 1.5px solid transparent;
          border-top-color: #d4a853;
          animation: spin 0.85s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* Noise overlay */
        .noise {
          position: fixed; inset: 0; pointer-events: none; z-index: 0; opacity: .025;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
          background-size: 180px;
        }

        /* Subtle ambient glow */
        .ambient-glow {
          position: fixed; top: -30%; left: -10%; width: 60%; height: 60%;
          background: radial-gradient(ellipse, rgba(212,168,83,0.04) 0%, transparent 65%);
          pointer-events: none; z-index: 0;
        }
      `}</style>

      {/* Ambient background layers */}
      <div className="noise" />
      <div className="ambient-glow" />

      {/* ── NavBar ───────────────────────────────────────────────────────── */}
      <div className="relative z-10 px-5 md:px-14 lg:px-20 pt-6">
        <NavBar />
      </div>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <main className="relative z-10 px-5 md:px-14 lg:px-20 pb-24 space-y-12 pt-10">

        {/* ── Page header ──────────────────────────────────────────────── */}
        <div className="a1 flex flex-col sm:flex-row sm:items-end justify-between gap-5">
          <div className="space-y-2">
            <p className="text-[8px] uppercase tracking-[0.45em] font-semibold text-white/22">
              {mediaType === "tv" ? "Television" : mediaType === "movie" ? "Cinema" : "Everything"}
            </p>
            <h1
              className="font-display font-bold text-white leading-none"
              style={{ fontSize: "clamp(2rem, 4.5vw, 3.2rem)", fontStyle: "italic", textShadow: "0 2px 24px rgba(0,0,0,0.6)" }}
            >
              {selectedGenre ?? (
                mediaType === "tv" ? "TV Shows" : mediaType === "movie" ? "Movies" : "Discover"
              )}
            </h1>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {selectedGenre && (
              <button onClick={resetToHome} className="back-btn a2">
                <ArrowLeft size={11} /> All Genres
              </button>
            )}
            {selectedGenre && (
              <span className="stat-badge">
                <Grid3X3 size={9} style={{ color: "#d4a853" }} />
                {genreMovies.length} titles loaded
              </span>
            )}
          </div>
        </div>

        {/* ── Genre pills ──────────────────────────────────────────────── */}
        <div className="a2 -mx-5 md:mx-0">
          <div
            className="flex gap-2 overflow-x-auto no-scrollbar pb-1 px-5 md:px-0 md:flex-wrap"
          >
            {GENRES.map((genre) => {
              const active = selectedGenre === genre.name;
              return (
                <button
                  key={genre.name}
                  onClick={() => handleGenreClick(genre)}
                  className={`genre-pill ${active ? "genre-pill-active" : ""}`}
                >
                  {genre.name}
                </button>
              );
            })}
          </div>
        </div>

        <div className="section-divider" />

        {/* ── Content ──────────────────────────────────────────────────── */}
        {selectedGenre ? (
          /* Genre grid view */
          <div className="space-y-8 a3">
            {/* Genre header */}
            <div className="flex items-center gap-3">
              <div className="w-0.5 h-5 rounded-full bg-[#d4a853]" />
              <h2 className="text-[13px] font-bold uppercase tracking-[0.18em] text-white/70">
                {selectedGenre}
              </h2>
            </div>

            {isFiltering ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3">
                {Array.from({ length: 21 }).map((_, i) => (
                  <div key={i} className="skeleton-card rounded-xl" style={{ aspectRatio: "2/3" }} />
                ))}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3 grid-in">
                  {genreMovies.map((item, i) => (
                    <div key={`${item.id}-${i}`} className="genre-grid-card">
                      <MovieCard {...item} />
                    </div>
                  ))}
                </div>

                {/* Infinite scroll sentinel */}
                {hasMore && (
                  <div ref={sentinelRef} className="flex flex-col items-center gap-3 py-8">
                    {loadingMore && (
                      <>
                        <div className="relative">
                          <div className="absolute inset-0 rounded-full border border-amber-400/15 animate-ping" />
                          <div className="gold-spinner" />
                        </div>
                        <p className="text-[8px] uppercase tracking-[0.4em] text-white/20 font-medium animate-pulse mt-1">
                          Loading more…
                        </p>
                      </>
                    )}
                  </div>
                )}

                {!hasMore && genreMovies.length > 0 && (
                  <div className="flex flex-col items-center gap-5 py-10">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(212,168,83,0.4))" }} />
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-400/40" />
                      <div className="w-10 h-px" style={{ background: "linear-gradient(90deg, rgba(212,168,83,0.4), transparent)" }} />
                    </div>
                    <p className="text-[8px] uppercase tracking-[0.45em] text-white/20 font-semibold">
                      All {genreMovies.length} results loaded
                    </p>
                    <button onClick={resetToHome} className="browse-btn">
                      <Home size={11} /> Browse other genres
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          /* Home rows view */
          <div className="space-y-12">
            {rows.map((row, idx) => (
              <div key={row.key} style={{ animation: `fadeUp .55s ease ${0.1 + idx * 0.1}s both` }}>
                <MovieRow
                  title={row.title}
                  icon={row.icon}
                  accent={row.accent}
                  data={row.data}
                  loading={loading}
                />
                {idx < rows.length - 1 && <div className="section-divider mt-10" />}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default MovieGrid;