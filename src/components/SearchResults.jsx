import React from "react";
import { Link } from "react-router-dom";
import { useSearch } from "../contexts/SearchContext.jsx";
import { Search, Film, Tv } from "lucide-react";

const SearchResults = () => {
  const { results, loading, query } = useSearch();

  if (loading) return (
    <div className="absolute mt-2 w-full bg-zinc-900/90 backdrop-blur-xl border border-white/10 rounded-sm p-4 text-center z-50">
      <div className="flex items-center justify-center gap-2 text-red-600 animate-pulse font-black uppercase tracking-widest text-[10px]">
        <Search size={14} /> Searching Database...
      </div>
    </div>
  );

  if (!query) return null;

  return (
    <div className="absolute mt-2 w-full bg-zinc-950/95 backdrop-blur-2xl border border-white/10 rounded-sm overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-[60] max-h-[450px] overflow-y-auto no-scrollbar">
      
      {results.length > 0 ? (
        <div className="flex flex-col">
          <div className="px-4 py-2 border-b border-white/5 bg-white/5">
             <span className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em]">Top Results</span>
          </div>
          
          {results.map((item) => (
            <Link
              key={item.id}
              to={`/movie/${item.id}/${item.mediaType}`}
              className="flex items-center gap-4 p-3 hover:bg-red-600/10 border-b border-white/5 transition-all duration-300 group"
            >
              {/* Poster Thumbnail */}
              <div className="relative flex-none w-10 h-14 bg-zinc-800 rounded-sm overflow-hidden border border-white/10">
                {item.poster ? (
                  <img
                    src={item.poster}
                    alt={item.title || item.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Film size={16} className="text-zinc-600" />
                  </div>
                )}
              </div>

              {/* Text Details */}
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-white text-xs md:text-sm font-bold uppercase tracking-tight truncate group-hover:text-red-500 transition-colors">
                  {item.title || item.name}
                </span>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[9px] font-black text-red-600 uppercase tracking-widest">
                    {item.mediaType === 'tv' ? 'TV Series' : 'Movie'}
                  </span>
                  {item.year && (
                    <span className="text-[9px] font-bold text-gray-500">{item.year}</span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="p-8 text-center">
          <p className="text-gray-500 text-[10px] font-black uppercase tracking-[0.3em]">No matches found</p>
        </div>
      )}

      <style jsx="true">{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
};

export default SearchResults;