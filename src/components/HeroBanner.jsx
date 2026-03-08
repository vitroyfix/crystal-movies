import React, { useState, useEffect } from "react";
import { fetchTrending, fetchMovieDetails } from "../services/api";
import { Play, Info } from "lucide-react";
import { useNavigate } from "react-router-dom";

const HeroBanner = () => {
  const [trendingItems, setTrendingItems] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const loadTrending = async () => {
      try {
        const data = await fetchTrending();
        // STRICT LIMIT TO FIRST 5 MOVIES/TV SHOWS
        const firstFive = data.slice(0, 5);

        // Fetch full plot/details for the 5 selected items
        const enrichedItems = await Promise.all(
          firstFive.map(async (item) => {
            const details = await fetchMovieDetails(item.id, item.mediaType);

            if (details && details.plot) {
              // Word count limit logic: split into words, take first 20, join back together
              const words = details.plot.split(" ");
              if (words.length > 20) {
                details.plot = words.slice(0, 20).join(" ") + "...";
              }
            }

            return details || item;
          }),
        );

        setTrendingItems(enrichedItems);
      } catch (error) {
        console.error("Error loading trending items:", error);
      } finally {
        setLoading(false);
      }
    };
    loadTrending();
  }, []);

  // AUTOMATIC ROTATION
  useEffect(() => {
    if (trendingItems.length === 0) return;
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % trendingItems.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [trendingItems]);

  if (loading) {
    return (
      <div className="min-h-[75vh] flex items-center justify-center text-white bg-black uppercase tracking-widest font-black">
        Loading...
      </div>
    );
  }

  if (trendingItems.length === 0) return null;

  const currentMovie = trendingItems[activeIndex];

  const handleNavigation = (movie) => {
    navigate(`/movie/${movie.id}/${movie.mediaType}`);
  };

  return (
    <section className="relative min-h-screen w-full text-white flex flex-col justify-end pb-12 overflow-hidden">
      {/* DYNAMIC BACKGROUND - OPTIMIZED FOR DESKTOP VISUALS */}
      <div className="absolute top-0 left-0 w-full h-full -z-10 bg-black">
        <img
          key={currentMovie.id}
          src={currentMovie.poster.replace("w500", "original")}
          alt={currentMovie.title}
          className="w-full h-full object-cover object-center md:object-[center_20%] opacity-60 transition-all duration-1000 ease-in-out animate-in fade-in"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/20 to-transparent" />
      </div>

      {/* HERO CONTENT AREA */}
      <div className="px-6 md:px-12 lg:px-16 w-full space-y-8">
        {/* Dynamic Text Details - PLOT CAPPED AT 20 WORDS */}
        <div className="max-w-4xl space-y-4 animate-in slide-in-from-left duration-700">
          <h1 className="text-4xl md:text-6xl lg:text-8xl font-black uppercase tracking-tighter leading-none drop-shadow-2xl">
            {currentMovie.title}
          </h1>
          <p className="text-sm md:text-lg text-gray-200 leading-relaxed max-w-3xl drop-shadow-lg font-medium">
            {currentMovie.plot}
          </p>

          <div className="flex items-center gap-4 pt-4">
            <button
              onClick={() => handleNavigation(currentMovie)}
              className="flex items-center gap-2 bg-red-600 text-white px-6 md:px-10 py-2.5 md:py-3 rounded-sm hover:bg-red-700 transition-all font-black uppercase tracking-widest text-xs md:text-sm"
            >
              <Play size={18} fill="white" /> Play Now
            </button>
            <button
              onClick={() => handleNavigation(currentMovie)}
              className="flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 text-white px-6 md:px-10 py-2.5 md:py-3 rounded-sm hover:bg-white/20 transition-all font-black uppercase tracking-widest text-xs md:text-sm"
            >
              <Info size={18} /> Details
            </button>
          </div>
        </div>

        {/* TRENDING CAROUSEL - 5 ITEMS ONLY - FULLY VISIBLE */}
        <div className="pt-10 w-full">
          <div className="flex items-center justify-between mb-4 px-1">
            <h2 className="text-[10px] md:text-xs font-black uppercase tracking-[0.4em] text-red-600">
              Trending
            </h2>
          </div>

          <div className="flex gap-4 md:gap-6 overflow-x-auto no-scrollbar pb-8 pt-4 -mx-6 px-6 md:mx-0 md:px-4 snap-x">
            {trendingItems.map((movie, index) => (
              <div
                key={movie.id}
                onClick={() => {
                  // If clicking the already active one, navigate to details
                  if (activeIndex === index) {
                    handleNavigation(movie);
                  } else {
                    // Otherwise, switch the hero banner
                    setActiveIndex(index);
                  }
                }}
                className={`flex-none w-28 md:w-44 lg:w-52 snap-start cursor-pointer transition-all duration-500 ${
                  activeIndex === index
                    ? "scale-105"
                    : "opacity-40 hover:opacity-80 scale-95"
                }`}
              >
                <div
                  className={`relative aspect-[2/3] rounded-sm overflow-hidden border-2 transition-all duration-500 ${
                    activeIndex === index
                      ? "border-red-600 shadow-[0_0_25px_rgba(220,38,38,0.5)]"
                      : "border-transparent"
                  }`}
                >
                  <img
                    src={movie.poster}
                    alt={movie.title}
                    className="w-full h-full object-cover"
                  />
                  {activeIndex === index && (
                    <div className="absolute inset-0 bg-red-600/10 flex items-center justify-center">
                      <div className="p-2 bg-red-600 rounded-full shadow-lg">
                        <Play size={20} fill="white" />
                      </div>
                    </div>
                  )}
                </div>
                <h3
                  className={`mt-3 text-[9px] md:text-[11px] font-black uppercase tracking-widest truncate transition-colors ${
                    activeIndex === index ? "text-red-500" : "text-white"
                  }`}
                >
                  {movie.title}
                </h3>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style jsx="true">{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 0.6;
          }
        }
        .animate-in {
          animation: fadeIn 1s ease-in-out;
        }

        @keyframes slideInLeft {
          from {
            transform: translateX(-30px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .slide-in-from-left {
          animation: slideInLeft 0.8s ease-out forwards;
        }
      `}</style>
    </section>
  );
};

export default HeroBanner;