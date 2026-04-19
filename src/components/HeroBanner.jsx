import React, { useState, useEffect, useRef, useCallback } from "react";
import { fetchTrending, fetchMovieDetails } from "../services/api";
import { Play, Info, Star, ChevronLeft, ChevronRight, Volume2, VolumeX } from "lucide-react";
import { useNavigate } from "react-router-dom";

const IMG = "https://image.tmdb.org/t/p";

const HeroBanner = () => {
  const [trendingItems,  setTrendingItems]  = useState([]);
  const [activeIndex,    setActiveIndex]    = useState(0);
  const [prevIndex,      setPrevIndex]      = useState(null);
  const [loading,        setLoading]        = useState(true);
  const [transitioning,  setTransitioning]  = useState(false);
  const [isPaused,       setIsPaused]       = useState(false);
  const [progress,       setProgress]       = useState(0);

  const intervalRef   = useRef(null);
  const progressRef   = useRef(null);
  const progressStart = useRef(null);
  const navigate      = useNavigate();

  const DURATION = 8000; // ms per slide

  // ── Data loading ──────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const data = await fetchTrending();
        const firstFive = data.slice(0, 5);
        const enriched = await Promise.all(
          firstFive.map(async (item) => {
            const details = await fetchMovieDetails(item.id, item.mediaType);
            if (details?.plot) {
              const words = details.plot.split(" ");
              if (words.length > 22) details.plot = words.slice(0, 22).join(" ") + "…";
            }
            return details || item;
          })
        );
        setTrendingItems(enriched);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ── Transition helper ─────────────────────────────────────────────────────
  const goTo = useCallback((nextIdx) => {
    if (transitioning) return;
    setTransitioning(true);
    setPrevIndex(activeIndex);
    setTimeout(() => {
      setActiveIndex(nextIdx);
      setPrevIndex(null);
      setTransitioning(false);
    }, 600);
    setProgress(0);
    progressStart.current = performance.now();
  }, [transitioning, activeIndex]);

  // ── Auto-rotation ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!trendingItems.length || isPaused) return;
    intervalRef.current = setInterval(() => {
      goTo((activeIndex + 1) % trendingItems.length);
    }, DURATION);
    return () => clearInterval(intervalRef.current);
  }, [trendingItems, activeIndex, isPaused, goTo]);

  // ── Progress bar animation ─────────────────────────────────────────────────
  useEffect(() => {
    if (isPaused || !trendingItems.length) return;
    setProgress(0);
    progressStart.current = performance.now();

    const tick = (now) => {
      const elapsed = now - (progressStart.current || now);
      setProgress(Math.min((elapsed / DURATION) * 100, 100));
      progressRef.current = requestAnimationFrame(tick);
    };
    progressRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(progressRef.current);
  }, [activeIndex, isPaused, trendingItems.length]);

  const handleNavigate = (movie) => navigate(`/movie/${movie.id}/${movie.mediaType}`);

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#070707]">
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 rounded-full border-2 border-red-600/20 animate-ping" />
        <div className="absolute inset-0 rounded-full border-2 border-t-red-600 border-r-transparent border-b-transparent border-l-transparent animate-spin" />
      </div>
    </div>
  );

  if (!trendingItems.length) return null;

  const current = trendingItems[activeIndex];
  const prev    = prevIndex !== null ? trendingItems[prevIndex] : null;
  const rating  = parseFloat(current.rating) || 0;

  return (
    <section
      className="hero-root relative w-full overflow-hidden bg-[#070707]"
      style={{ minHeight: "100svh" }}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,700;0,9..40,900&family=Playfair+Display:ital,wght@0,700;0,900;1,400&display=swap');

        .hero-root { font-family: 'DM Sans', sans-serif; }
        .hero-display { font-family: 'Playfair Display', serif; }

        /* Slide transitions */
        @keyframes heroFadeIn {
          from { opacity: 0; transform: scale(1.06); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes heroFadeOut {
          from { opacity: 1; transform: scale(1); }
          to   { opacity: 0; transform: scale(0.97); }
        }
        @keyframes contentIn {
          from { opacity: 0; transform: translateY(28px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes contentIn2 {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .img-enter { animation: heroFadeIn 0.7s cubic-bezier(.4,0,.2,1) forwards; }
        .img-exit  { animation: heroFadeOut 0.5s cubic-bezier(.4,0,.2,1) forwards; position: absolute; inset: 0; }

        .content-line-1 { opacity: 0; animation: contentIn  0.7s cubic-bezier(.4,0,.2,1) 0.15s forwards; }
        .content-line-2 { opacity: 0; animation: contentIn2 0.7s cubic-bezier(.4,0,.2,1) 0.28s forwards; }
        .content-line-3 { opacity: 0; animation: contentIn2 0.7s cubic-bezier(.4,0,.2,1) 0.38s forwards; }
        .content-line-4 { opacity: 0; animation: contentIn2 0.7s cubic-bezier(.4,0,.2,1) 0.48s forwards; }

        /* Scanlines */
        .scanlines::after {
          content: '';
          position: absolute;
          inset: 0;
          background: repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.025) 3px, rgba(0,0,0,0.025) 4px);
          pointer-events: none;
          z-index: 2;
        }

        /* Thumbnail hover */
        .thumb-card { transition: all 0.4s cubic-bezier(.4,0,.2,1); }
        .thumb-card:hover { transform: translateY(-6px); }

        /* Progress bar */
        .prog-track { background: rgba(255,255,255,0.08); }
        .prog-fill  { background: #e50914; transition: width 0.05s linear; }

        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* ── Backdrop images ──────────────────────────────────────────────── */}
      <div className="scanlines absolute inset-0 w-full h-full">
        {/* Exiting image */}
        {prev && (
          <div key={`exit-${prev.id}`} className="img-exit w-full h-full">
            <img
              src={(prev.backdrop || prev.poster || "").replace("w500", "original")}
              alt=""
              className="w-full h-full object-cover object-center"
              style={{ opacity: 0.65 }}
            />
          </div>
        )}

        {/* Active image */}
        <div key={`enter-${current.id}`} className="img-enter w-full h-full">
          <img
            src={(current.backdrop_path
              ? `${IMG}/original${current.backdrop_path}`
              : (current.poster || "").replace("w500", "original")
            )}
            alt={current.title}
            className="w-full h-full object-cover object-center"
            style={{ opacity: 0.65 }}
          />
        </div>

        {/* Gradient layers */}
        <div className="absolute inset-0 z-10" style={{ background: "linear-gradient(to right, rgba(7,7,7,0.97) 25%, rgba(7,7,7,0.5) 60%, rgba(7,7,7,0.15) 100%)" }} />
        <div className="absolute inset-0 z-10" style={{ background: "linear-gradient(to top, #070707 0%, rgba(7,7,7,0.6) 30%, transparent 65%)" }} />
        <div className="absolute inset-0 z-10" style={{ background: "radial-gradient(ellipse at 15% 55%, rgba(229,9,20,0.07) 0%, transparent 55%)" }} />
      </div>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <div className="relative z-20 flex flex-col justify-between min-h-[100svh] px-6 md:px-14 lg:px-20 pt-28 pb-10">

        {/* Hero text block */}
        <div className="flex-1 flex flex-col justify-center max-w-2xl gap-5">

          {/* Eyebrow */}
          <div key={`eye-${current.id}`} className="content-line-1 flex items-center gap-3">
            <div className="flex gap-1">
              {Array.from({ length: 5 }, (_, i) => (
                <Star key={i} size={11} className={i < Math.floor(rating / 2) ? "fill-red-500 text-red-500" : "text-white/15"} />
              ))}
            </div>
            {rating > 0 && <span className="text-[10px] font-black text-white/40 tracking-widest">{rating.toFixed(1)} / 10</span>}
            <span className="w-px h-3 bg-white/15" />
            <span className="text-[9px] font-black uppercase tracking-[0.25em] text-red-500">
              {current.mediaType === "tv" ? "Series" : "Film"}
            </span>
            {current.badgeYear && (
              <>
                <span className="w-px h-3 bg-white/15" />
                <span className="text-[10px] text-white/30 tracking-widest">{current.badgeYear}</span>
              </>
            )}
          </div>

          {/* Title */}
          <h1 key={`title-${current.id}`} className="content-line-2 hero-display text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black leading-[0.95] tracking-tight text-white">
            {current.title}
          </h1>

          {/* Plot */}
          <p key={`plot-${current.id}`} className="content-line-3 text-sm md:text-base leading-relaxed text-white/55 max-w-lg">
            {current.plot}
          </p>

          {/* Buttons */}
          <div key={`btns-${current.id}`} className="content-line-4 flex flex-wrap items-center gap-3 pt-1">
            <button onClick={() => handleNavigate(current)}
              className="flex items-center gap-2.5 px-7 py-3.5 rounded-lg text-[11px] font-black uppercase tracking-widest text-white transition-all hover:scale-[1.03] active:scale-[0.97]"
              style={{ background: "#e50914", boxShadow: "0 8px 28px rgba(229,9,20,0.45)" }}>
              <Play size={15} fill="white" /> Play Now
            </button>
            <button onClick={() => handleNavigate(current)}
              className="flex items-center gap-2.5 px-6 py-3.5 rounded-lg text-[11px] font-black uppercase tracking-widest text-white/70 hover:text-white transition-all hover:scale-[1.02]"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(16px)" }}>
              <Info size={15} /> Details
            </button>
          </div>
        </div>

        {/* ── Bottom section ─────────────────────────────────────────────── */}
        <div className="space-y-5">

          {/* Section label + nav arrows */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-0.5 h-4 rounded-full bg-red-600" />
              <span className="text-[9px] font-black uppercase tracking-[0.35em] text-white/40">Trending Now</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => goTo((activeIndex - 1 + trendingItems.length) % trendingItems.length)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-white/40 hover:text-white transition-all hover:bg-white/10"
                style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
                <ChevronLeft size={14} />
              </button>
              <span className="text-[10px] font-black text-white/25 tracking-widest tabular-nums">
                {String(activeIndex + 1).padStart(2, "0")} / {String(trendingItems.length).padStart(2, "0")}
              </span>
              <button
                onClick={() => goTo((activeIndex + 1) % trendingItems.length)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-white/40 hover:text-white transition-all hover:bg-white/10"
                style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>

          {/* Thumbnail row */}
          <div className="flex gap-3 md:gap-4 overflow-x-auto no-scrollbar pb-2 -mx-6 px-6 md:mx-0 md:px-0 snap-x snap-mandatory">
            {trendingItems.map((movie, index) => {
              const isActive = index === activeIndex;
              return (
                <div
                  key={movie.id}
                  className="thumb-card flex-none snap-start cursor-pointer"
                  style={{ width: isActive ? 120 : 88 }}
                  onClick={() => {
                    if (isActive) handleNavigate(movie);
                    else goTo(index);
                  }}
                >
                  {/* Poster */}
                  <div className="relative overflow-hidden rounded-lg"
                    style={{
                      aspectRatio: "2/3",
                      border: isActive ? "2px solid #e50914" : "2px solid rgba(255,255,255,0.06)",
                      boxShadow: isActive ? "0 0 28px rgba(229,9,20,0.35), 0 8px 32px rgba(0,0,0,0.6)" : "0 4px 16px rgba(0,0,0,0.4)",
                      opacity: isActive ? 1 : 0.45,
                    }}>
                    <img
                      src={movie.poster || `${IMG}/w342${movie.poster_path}`}
                      alt={movie.title}
                      className="w-full h-full object-cover transition-transform duration-500"
                      style={{ transform: isActive ? "scale(1.06)" : "scale(1)" }}
                    />
                    {/* Active overlay */}
                    {isActive && (
                      <div className="absolute inset-0 flex items-end justify-center pb-3"
                        style={{ background: "linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 60%)" }}>
                        <div className="p-1.5 rounded-full" style={{ background: "#e50914" }}>
                          <Play size={10} fill="white" />
                        </div>
                      </div>
                    )}
                    {/* Progress bar on active */}
                    {isActive && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 prog-track">
                        <div className="h-full prog-fill" style={{ width: `${progress}%` }} />
                      </div>
                    )}
                  </div>

                  {/* Title */}
                  <p className="mt-2 text-[9px] md:text-[10px] font-black uppercase tracking-wider truncate transition-colors"
                    style={{ color: isActive ? "#e50914" : "rgba(255,255,255,0.35)" }}>
                    {movie.title}
                  </p>

                  {/* Type badge */}
                  <p className="text-[8px] uppercase tracking-widest mt-0.5"
                    style={{ color: isActive ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.15)" }}>
                    {movie.mediaType === "tv" ? "Series" : "Film"}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Dot indicators */}
          <div className="flex items-center gap-1.5 justify-center">
            {trendingItems.map((_, i) => (
              <button key={i} onClick={() => goTo(i)}
                className="transition-all duration-300 rounded-full"
                style={{
                  width:   i === activeIndex ? 20 : 4,
                  height:  4,
                  background: i === activeIndex ? "#e50914" : "rgba(255,255,255,0.15)",
                }} />
            ))}
          </div>
        </div>
      </div>

      {/* ── Pause indicator ────────────────────────────────────────────────── */}
      {isPaused && (
        <div className="absolute top-6 right-6 z-30 flex items-center gap-2 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest text-white/30"
          style={{ background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.06)", backdropFilter: "blur(12px)" }}>
          <span className="w-1.5 h-1.5 rounded-full bg-white/20" /> Paused
        </div>
      )}

      {/* ── Right-side index strip (desktop only) ──────────────────────────── */}
      <div className="hidden xl:flex absolute right-8 top-1/2 -translate-y-1/2 z-20 flex-col gap-2">
        {trendingItems.map((_, i) => (
          <button key={i} onClick={() => goTo(i)}
            className="transition-all duration-300 rounded-full ml-auto"
            style={{
              width: 2,
              height: i === activeIndex ? 40 : 16,
              background: i === activeIndex ? "#e50914" : "rgba(255,255,255,0.12)",
            }} />
        ))}
      </div>
    </section>
  );
};

export default HeroBanner;