import React, { useState, useEffect, useRef, useCallback } from "react";
import MovieCard from "../components/movies/MovieCard.jsx";
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
} from "lucide-react";

const GENRES = [
  { name: "Action", id: 28 },
  { name: "Adventure", id: 12 },
  { name: "Animation", id: 16 },
  { name: "Comedy", id: 35 },
  { name: "Crime", id: 80 },
  { name: "Documentary", id: 99 },
  { name: "Drama", id: 18 },
  { name: "Family", id: 10751 },
  { name: "Fantasy", id: 14 },
  { name: "History", id: 36 },
  { name: "Horror", id: 27 },
  { name: "Music", id: 10402 },
  { name: "Mystery", id: 9648 },
  { name: "Romance", id: 10749 },
  { name: "Sci-Fi", id: 878 },
  { name: "Sport", id: 9805 },
  { name: "Superhero", id: 10767 },
  { name: "Thriller", id: 53 },
  { name: "War", id: 10752 },
  { name: "Western", id: 37 },
  { name: "Kids & TV", id: 10762 },
  { name: "Reality", id: 10764 },
  { name: "Talk Show", id: 10767 },
];

const dedup = (arr) => {
  const seen = new Set();
  return arr.filter((item) =>
    seen.has(item.id) ? false : seen.add(item.id)
  );
};

const SkeletonCard = () => (
  <div
    className="rounded-lg overflow-hidden animate-pulse"
    style={{
      aspectRatio: "2/3",
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.05)",
    }}
  >
    <div className="w-full h-full bg-gradient-to-br from-white/5 to-transparent" />
  </div>
);

const MovieRow = ({ title, data, loading }) => {
  const scrollRef = useRef(null);
  const scroll = (dir) =>
    scrollRef.current?.scrollBy({ left: dir * 340, behavior: "smooth" });

  return (
    <div className="space-y-4 group/row">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-3 text-sm md:text-base font-black uppercase tracking-widest text-white">
          <span className="w-[3px] h-5 rounded-full bg-red-600 flex-shrink-0" />
          {title}
        </h2>
        <div className="flex items-center gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity duration-200">
          <button
            onClick={() => scroll(-1)}
            className="w-7 h-7 rounded-full flex items-center justify-center text-white/30 hover:text-white hover:bg-white/10 transition-all"
            style={{ border: "1px solid rgba(255,255,255,0.07)" }}
          >
            <ChevronLeft size={13} />
          </button>
          <button
            onClick={() => scroll(1)}
            className="w-7 h-7 rounded-full flex items-center justify-center text-white/30 hover:text-white hover:bg-white/10 transition-all"
            style={{ border: "1px solid rgba(255,255,255,0.07)" }}
          >
            <ChevronRight size={13} />
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto pb-3 snap-x snap-mandatory"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {loading
          ? Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="flex-none snap-start" style={{ width: 148 }}>
                <SkeletonCard />
              </div>
            ))
          : data.map((item, i) => (
              <div key={`${item.id}-${i}`} className="flex-none snap-start" style={{ width: 148 }}>
                <MovieCard {...item} />
              </div>
            ))}
      </div>
    </div>
  );
};

const MovieGrid = () => {
  const [trending, setTrending] = useState([]);
  const [topRated, setTopRated] = useState([]);
  const [recentlyAdded, setRecentlyAdded] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedGenre, setSelectedGenre] = useState(null);
  const [genreMovies, setGenreMovies] = useState([]);
  const [isFiltering, setIsFiltering] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const sentinelRef = useRef(null);
  const observerRef = useRef(null);
  const loadingRef = useRef(false);

  // ── Initial rows — uses the correct dedicated API functions ────────────────
  useEffect(() => {
    (async () => {
      try {
        const [t, tr, r] = await Promise.all([
          fetchTrending(),
          fetchTopRatedMovies(),   // ← was fetchMovies("top_rated")
          fetchRecentMovies(),     // ← was fetchMovies("now_playing")
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
  }, []);

  // ── IntersectionObserver ───────────────────────────────────────────────────
  const setupObserver = useCallback(() => {
    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver(
      async (entries) => {
        if (!entries[0].isIntersecting) return;
        if (loadingRef.current) return;

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

                fetchByGenre(genre.id, nextPage)
                  .then((data) => {
                    const fresh = data.filter((m) => !existingIds.has(m.id));
                    if (!fresh.length) {
                      setHasMore(false);
                    } else {
                      setGenreMovies((pm) => [...pm, ...fresh]);
                    }
                    loadingRef.current = false;
                    setLoadingMore(false);
                  })
                  .catch(() => {
                    loadingRef.current = false;
                    setLoadingMore(false);
                  });
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
  }, []);

  useEffect(() => {
    if (selectedGenre && hasMore && !isFiltering) {
      setupObserver();
    } else {
      observerRef.current?.disconnect();
    }
    return () => observerRef.current?.disconnect();
  }, [selectedGenre, hasMore, isFiltering, setupObserver]);

  // ── Genre click ────────────────────────────────────────────────────────────
  const handleGenreClick = async (genre) => {
    if (selectedGenre === genre.name) {
      resetToHome();
      return;
    }

    observerRef.current?.disconnect();
    loadingRef.current = false;

    setSelectedGenre(genre.name);
    setIsFiltering(true);
    setCurrentPage(1);
    setGenreMovies([]);
    setHasMore(true);

    try {
      const data = await fetchByGenre(genre.id, 1);
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

  return (
    <section
      className="px-6 md:px-14 lg:px-20 py-12 bg-[#070707] text-white space-y-12"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;700;900&display=swap');
        @keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        .grid-in { animation: fadeUp 0.4s ease forwards; }
        .no-sb::-webkit-scrollbar { display:none }
        .no-sb { -ms-overflow-style:none; scrollbar-width:none }
        @keyframes shimmer {
          0%   { background-position: -400px 0 }
          100% { background-position:  400px 0 }
        }
        .skeleton-shine {
          background: linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.07) 50%, rgba(255,255,255,0.03) 75%);
          background-size: 400px 100%;
          animation: shimmer 1.4s infinite linear;
        }
      `}</style>

      {/* ── Section header ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="text-[9px] uppercase tracking-[0.35em] text-white/20 font-black">
            {selectedGenre ? `Genre · ${genreMovies.length} titles loaded` : "Discover"}
          </p>
          <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight text-white flex items-center gap-3">
            <span className="w-[3px] h-6 rounded-full bg-red-600" />
            {selectedGenre ?? "Browse by Genre"}
          </h2>
        </div>

        {selectedGenre && (
          <button
            onClick={resetToHome}
            className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white/30 hover:text-red-500 transition-colors"
          >
            <ArrowLeft size={12} /> All Genres
          </button>
        )}
      </div>

      {/* ── Genre pills ────────────────────────────────────────────────────── */}
      <div className="flex gap-2 overflow-x-auto no-sb pb-1 -mx-6 px-6 md:mx-0 md:px-0 md:flex-wrap">
        {GENRES.map((genre) => {
          const active = selectedGenre === genre.name;
          return (
            <button
              key={genre.name}
              onClick={() => handleGenreClick(genre)}
              className="flex-none flex items-center gap-1.5 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all duration-200"
              style={{
                background: active ? "#e50914" : "rgba(255,255,255,0.04)",
                border: active ? "1px solid #e50914" : "1px solid rgba(255,255,255,0.08)",
                color: active ? "#fff" : "rgba(255,255,255,0.4)",
                boxShadow: active ? "0 4px 18px rgba(229,9,20,0.35)" : "none",
                transform: active ? "scale(1.05)" : "scale(1)",
              }}
            >
              {genre.name}
            </button>
          );
        })}
      </div>

      {/* ── Content area ──────────────────────────────────────────────────── */}
      {selectedGenre ? (
        <div className="space-y-8">
          {isFiltering ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3 md:gap-4">
              {Array.from({ length: 21 }).map((_, i) => (
                <div key={i} className="skeleton-shine rounded-lg" style={{ aspectRatio: "2/3" }} />
              ))}
            </div>
          ) : (
            <>
              <div className="grid-in grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3 md:gap-4">
                {genreMovies.map((item, i) => (
                  <MovieCard key={`${item.id}-${i}`} {...item} />
                ))}
              </div>

              {hasMore && (
                <div ref={sentinelRef} className="flex flex-col items-center gap-3 py-8">
                  {loadingMore && (
                    <>
                      <div className="w-8 h-8 rounded-full border-2 border-t-red-600 border-r-transparent border-b-transparent border-l-transparent animate-spin" />
                      <p className="text-[9px] uppercase tracking-[0.3em] text-white/20 font-black">
                        Loading more…
                      </p>
                    </>
                  )}
                </div>
              )}

              {!hasMore && genreMovies.length > 0 && (
                <div className="flex flex-col items-center gap-4 py-10">
                  <div className="w-12 h-px bg-red-600/40" />
                  <p className="text-[9px] uppercase tracking-[0.35em] text-white/20 font-black">
                    All {genreMovies.length} results loaded
                  </p>
                  <button
                    onClick={resetToHome}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-white transition-all"
                    style={{
                      border: "1px solid rgba(255,255,255,0.08)",
                      background: "rgba(255,255,255,0.03)",
                    }}
                  >
                    <Home size={11} /> Browse other genres
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="space-y-14">
          <MovieRow title="Trending Now" data={trending} loading={loading} />
          <MovieRow title="Top Rated" data={topRated} loading={loading} />
          <MovieRow title="Recently Added" data={recentlyAdded} loading={loading} />
        </div>
      )}
    </section>
  );
};

export default MovieGrid;