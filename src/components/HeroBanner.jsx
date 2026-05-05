import React, { useState, useEffect, useRef, useCallback } from "react";
import { fetchTrending, fetchMovieDetails } from "../services/api";
import { Play, Info, Star, ChevronLeft, ChevronRight, Clock, Film, Tv } from "lucide-react";
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

  const DURATION = 8000;

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
    }, 700);
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

  // ── Progress bar ──────────────────────────────────────────────────────────
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
    <div className="min-h-screen flex items-center justify-center bg-[#080808]">
      <div className="flex flex-col items-center gap-5">
        <div className="relative w-14 h-14">
          <div className="absolute inset-0 rounded-full border border-amber-400/20 animate-ping" />
          <div className="w-14 h-14 rounded-full border-t-amber-400 border-r-transparent border-b-transparent border-l-transparent border-[1.5px] animate-spin" />
        </div>
        <p className="text-[10px] uppercase tracking-[0.4em] text-white/20 font-medium">Loading</p>
      </div>
    </div>
  );

  if (!trendingItems.length) return null;

  const current = trendingItems[activeIndex];
  const prev    = prevIndex !== null ? trendingItems[prevIndex] : null;
  const rating  = parseFloat(current.rating) || 0;

  return (
    <section
      className="hero-root relative w-full overflow-hidden bg-[#080808]"
      style={{ minHeight: "100svh" }}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=Playfair+Display:ital,wght@0,700;0,900;1,400;1,700&display=swap');

        .hero-root { font-family: 'Sora', sans-serif; }
        .hero-display { font-family: 'Playfair Display', serif; }

        @keyframes heroFadeIn {
          from { opacity: 0; transform: scale(1.06) translateX(12px); }
          to   { opacity: 1; transform: scale(1)    translateX(0); }
        }
        @keyframes heroFadeOut {
          from { opacity: 1; transform: scale(1); }
          to   { opacity: 0; transform: scale(0.96); }
        }
        @keyframes contentIn {
          from { opacity: 0; transform: translateY(26px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes contentIn2 {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer {
          0%   { background-position: -200% center; }
          100% { background-position:  200% center; }
        }

        .img-enter { animation: heroFadeIn  0.8s cubic-bezier(.4,0,.2,1) forwards; }
        .img-exit  { animation: heroFadeOut 0.55s cubic-bezier(.4,0,.2,1) forwards; position: absolute; inset: 0; }

        .c1 { opacity:0; animation: contentIn  0.7s cubic-bezier(.4,0,.2,1) 0.12s forwards; }
        .c2 { opacity:0; animation: contentIn  0.7s cubic-bezier(.4,0,.2,1) 0.22s forwards; }
        .c3 { opacity:0; animation: contentIn2 0.7s cubic-bezier(.4,0,.2,1) 0.34s forwards; }
        .c4 { opacity:0; animation: contentIn2 0.7s cubic-bezier(.4,0,.2,1) 0.45s forwards; }

        /* Noise texture overlay */
        .noise-overlay::after {
          content: '';
          position: absolute;
          inset: 0;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
          background-size: 180px;
          opacity: 0.03;
          pointer-events: none;
          z-index: 3;
        }

        /* Thumb */
        .thumb-card { transition: all 0.4s cubic-bezier(.4,0,.2,1); }
        .thumb-card:hover { transform: translateY(-5px); }

        /* Gold progress bar */
        .prog-track { background: rgba(255,255,255,0.07); }
        .prog-fill  {
          background: linear-gradient(90deg, #d4a853, #f0c070);
          transition: width 0.05s linear;
          box-shadow: 0 0 8px rgba(212,168,83,0.5);
        }

        /* Gold shimmer on active title */
        .gold-shimmer {
          background: linear-gradient(120deg, #d4a853 0%, #f0c070 40%, #d4a853 60%, #b8892f 100%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: shimmer 3.5s linear infinite;
        }

        /* Side index strip */
        .strip-pill { transition: all 0.4s cubic-bezier(.4,0,.2,1); border-radius: 9999px; }

        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

        .kw-tag {
          display: inline-flex; align-items: center;
          padding: 4px 11px; border-radius: 20px;
          font-size: 9px; font-weight: 600; letter-spacing: .05em;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.09);
          color: rgba(255,255,255,0.4);
        }

        .btn-glass {
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          backdrop-filter: blur(20px);
          transition: all .22s ease;
        }
        .btn-glass:hover {
          background: rgba(255,255,255,0.09);
          border-color: rgba(255,255,255,0.18);
        }

        .play-btn {
          background: linear-gradient(135deg, #d4a853 0%, #b8892f 100%);
          box-shadow: 0 8px 32px rgba(212,168,83,0.32), inset 0 1px 0 rgba(255,255,255,0.2);
          transition: all .25s cubic-bezier(.4,0,.2,1);
        }
        .play-btn:hover {
          box-shadow: 0 14px 44px rgba(212,168,83,0.5), inset 0 1px 0 rgba(255,255,255,0.2);
          transform: translateY(-1px);
        }
        .play-btn:active { transform: scale(.98); }

        .rating-badge {
          font-size: 9px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase;
          padding: 3px 8px; border-radius: 5px;
          background: rgba(255,255,255,0.07);
          border: 1px solid rgba(255,255,255,0.13);
          color: rgba(255,255,255,0.5);
        }

        .divider { height:1px; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.07) 40%, rgba(255,255,255,0.07) 60%, transparent); }

        .thumb-border-active {
          border: 1.5px solid #d4a853;
          box-shadow: 0 0 0 1px rgba(212,168,83,0.2), 0 8px 32px rgba(0,0,0,0.65), 0 0 24px rgba(212,168,83,0.18);
        }
        .thumb-border-inactive {
          border: 1.5px solid rgba(255,255,255,0.06);
          box-shadow: 0 4px 14px rgba(0,0,0,0.4);
        }

        .pause-badge {
          background: rgba(8,8,8,0.75);
          border: 1px solid rgba(255,255,255,0.07);
          backdrop-filter: blur(16px);
        }
      `}</style>

      {/* ── Backdrop images ─────────────────────────────────────────────────── */}
      <div className="noise-overlay absolute inset-0 w-full h-full">
        {prev && (
          <div key={`exit-${prev.id}`} className="img-exit w-full h-full">
            <img
              src={(prev.backdrop_path ? `${IMG}/original${prev.backdrop_path}` : (prev.poster || "").replace("w500", "original"))}
              alt=""
              className="w-full h-full object-cover object-center"
              style={{ opacity: 0.55 }}
            />
          </div>
        )}

        <div key={`enter-${current.id}`} className="img-enter w-full h-full">
          <img
            src={(current.backdrop_path ? `${IMG}/original${current.backdrop_path}` : (current.poster || "").replace("w500", "original"))}
            alt={current.title}
            className="w-full h-full object-cover object-center"
            style={{ opacity: 0.55 }}
          />
        </div>

        {/* Gradient layers — same system as MovieDetails */}
        <div className="absolute inset-0 z-10" style={{ background: "linear-gradient(105deg, rgba(8,8,8,0.98) 0%, rgba(8,8,8,0.78) 45%, rgba(8,8,8,0.15) 100%)" }} />
        <div className="absolute inset-0 z-10" style={{ background: "linear-gradient(to top, #080808 0%, rgba(8,8,8,0.62) 28%, transparent 62%)" }} />
        <div className="absolute inset-0 z-10" style={{ background: "radial-gradient(ellipse at 14% 62%, rgba(212,168,83,0.06) 0%, transparent 52%)" }} />
      </div>

      {/* ── Main content ─────────────────────────────────────────────────────── */}
      <div className="relative z-20 flex flex-col justify-between min-h-[100svh] px-6 md:px-14 lg:px-20 pt-28 pb-10">

        {/* ── Hero text block ─────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col justify-center max-w-2xl gap-5">

          {/* Eyebrow */}
          <div key={`eye-${current.id}`} className="c1 flex flex-wrap items-center gap-2.5">
            {/* Gold accent bar */}
            <div className="w-0.5 h-4 rounded-full bg-amber-400 flex-shrink-0" />

            <span
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-semibold uppercase tracking-widest flex-shrink-0"
              style={{ background: "rgba(212,168,83,0.1)", border: "1px solid rgba(212,168,83,0.25)", color: "#d4a853" }}>
              {current.mediaType === "tv" ? <Tv size={9} /> : <Film size={9} />}
              {current.mediaType === "tv" ? "Series" : "Film"}
            </span>

            {current.badgeYear && (
              <span className="kw-tag">{current.badgeYear}</span>
            )}

            {current.runtime && (
              <span className="kw-tag flex items-center gap-1"><Clock size={8} />{current.runtime}</span>
            )}

            <span className="w-px h-3 bg-white/12 flex-shrink-0" />

            {/* Star rating */}
            <div className="flex items-center gap-1.5">
              <div className="flex gap-0.5">
                {Array.from({ length: 5 }, (_, i) => (
                  <Star key={i} size={10} className={i < Math.floor(rating / 2) ? "fill-amber-400 text-amber-400" : "text-white/10"} />
                ))}
              </div>
              {rating > 0 && (
                <span className="text-[10px] font-bold text-white/40 tracking-wider">{rating.toFixed(1)}</span>
              )}
            </div>
          </div>

          {/* Title */}
          <h1
            key={`title-${current.id}`}
            className="c2 hero-display font-bold leading-[1.02] tracking-tight text-white"
            style={{ fontSize: "clamp(2.8rem, 6vw, 5.2rem)", fontStyle: "italic", textShadow: "0 4px 30px rgba(0,0,0,0.55)" }}>
            {current.title}
          </h1>

          {/* Genres */}
          {current.genres?.length > 0 && (
            <div key={`genres-${current.id}`} className="c2 flex flex-wrap gap-1.5">
              {current.genres.slice(0, 4).map(g => (
                <span key={g.id || g} className="kw-tag">{g.name || g}</span>
              ))}
            </div>
          )}

          {/* Plot */}
          <p
            key={`plot-${current.id}`}
            className="c3 text-[13px] leading-relaxed text-white/55 max-w-lg">
            {current.plot}
          </p>

          {/* Buttons */}
          <div key={`btns-${current.id}`} className="c4 flex flex-wrap items-center gap-3 pt-1">
            <button
              onClick={() => handleNavigate(current)}
              className="flex items-center gap-2.5 px-7 py-3.5 rounded-xl text-[11px] font-bold uppercase tracking-wider text-black play-btn">
              <Play size={14} fill="black" /> Stream Now
            </button>
            <button
              onClick={() => handleNavigate(current)}
              className="flex items-center gap-2.5 px-6 py-3.5 rounded-xl text-[11px] font-semibold uppercase tracking-wider text-white/50 hover:text-white/80 btn-glass">
              <Info size={14} /> Details
            </button>
          </div>
        </div>

        {/* ── Bottom section ───────────────────────────────────────────────── */}
        <div className="space-y-4">

          <div className="divider" />

          {/* Label + nav */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-0.5 h-4 rounded-full bg-amber-400" />
              <span className="text-[9px] font-semibold uppercase tracking-[0.35em] text-white/35">Trending Now</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => goTo((activeIndex - 1 + trendingItems.length) % trendingItems.length)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-white/35 hover:text-white transition-all hover:bg-white/08"
                style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
                <ChevronLeft size={14} />
              </button>
              <span className="text-[10px] font-bold text-white/25 tracking-widest tabular-nums">
                {String(activeIndex + 1).padStart(2, "0")} / {String(trendingItems.length).padStart(2, "0")}
              </span>
              <button
                onClick={() => goTo((activeIndex + 1) % trendingItems.length)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-white/35 hover:text-white transition-all hover:bg-white/08"
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
                  style={{ width: isActive ? 116 : 84, transition: "width 0.4s cubic-bezier(.4,0,.2,1)" }}
                  onClick={() => isActive ? handleNavigate(movie) : goTo(index)}>

                  <div
                    className={`relative overflow-hidden rounded-xl ${isActive ? "thumb-border-active" : "thumb-border-inactive"}`}
                    style={{
                      aspectRatio: "2/3",
                      opacity: isActive ? 1 : 0.38,
                      transition: "opacity 0.4s ease, box-shadow 0.4s ease",
                    }}>
                    <img
                      src={movie.poster || `${IMG}/w342${movie.poster_path}`}
                      alt={movie.title}
                      className="w-full h-full object-cover"
                      style={{ transform: isActive ? "scale(1.06)" : "scale(1)", transition: "transform 0.5s ease" }}
                    />

                    {/* Active overlay */}
                    {isActive && (
                      <div className="absolute inset-0 flex items-end justify-center pb-3"
                        style={{ background: "linear-gradient(to top, rgba(0,0,0,0.72) 0%, transparent 58%)" }}>
                        <div className="w-7 h-7 rounded-full flex items-center justify-center"
                          style={{ background: "rgba(212,168,83,0.92)", boxShadow: "0 4px 14px rgba(212,168,83,0.4)" }}>
                          <Play size={10} fill="black" className="ml-0.5" />
                        </div>
                      </div>
                    )}

                    {/* Gold progress bar on active */}
                    {isActive && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 prog-track rounded-none">
                        <div className="h-full prog-fill" style={{ width: `${progress}%` }} />
                      </div>
                    )}
                  </div>

                  {/* Label */}
                  <p className="mt-2 text-[9px] md:text-[10px] font-semibold uppercase tracking-wider truncate transition-colors"
                    style={{ color: isActive ? "#d4a853" : "rgba(255,255,255,0.3)" }}>
                    {movie.title}
                  </p>
                  <p className="text-[8px] uppercase tracking-widest mt-0.5"
                    style={{ color: isActive ? "rgba(212,168,83,0.5)" : "rgba(255,255,255,0.12)" }}>
                    {movie.mediaType === "tv" ? "Series" : "Film"}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Dot indicators */}
          <div className="flex items-center gap-1.5 justify-center pt-1">
            {trendingItems.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                className="transition-all duration-400 rounded-full"
                style={{
                  width:      i === activeIndex ? 22 : 4,
                  height:     4,
                  background: i === activeIndex
                    ? "linear-gradient(90deg, #d4a853, #f0c070)"
                    : "rgba(255,255,255,0.12)",
                  boxShadow:  i === activeIndex ? "0 0 8px rgba(212,168,83,0.4)" : "none",
                }} />
            ))}
          </div>
        </div>
      </div>

      {/* ── Pause badge ─────────────────────────────────────────────────────── */}
      {isPaused && (
        <div className="absolute top-6 right-6 z-30 flex items-center gap-2 px-3 py-1.5 rounded-full text-[9px] font-semibold uppercase tracking-widest text-white/25 pause-badge">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400/30" /> Paused
        </div>
      )}

      {/* ── Right-side index strip (desktop only) ───────────────────────────── */}
      <div className="hidden xl:flex absolute right-8 top-1/2 -translate-y-1/2 z-20 flex-col items-end gap-2.5">
        {trendingItems.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            className="strip-pill ml-auto"
            style={{
              width:      2,
              height:     i === activeIndex ? 42 : 14,
              background: i === activeIndex
                ? "linear-gradient(180deg, #d4a853, #f0c070)"
                : "rgba(255,255,255,0.1)",
              boxShadow:  i === activeIndex ? "0 0 10px rgba(212,168,83,0.45)" : "none",
            }} />
        ))}
      </div>
    </section>
  );
};

export default HeroBanner;