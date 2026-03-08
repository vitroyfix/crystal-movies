import { Star, Play } from "lucide-react";
import { Link } from "react-router-dom";

const MovieCard = ({
  id,
  poster,
  title,
  rating = 0,
  year,       
  mediaType = "movie",
}) => {
  const stars = Math.round(rating);
  const route = `/movie/${id}/${mediaType}`;

  return (
    <Link to={route} className="block group">
      <div className="relative bg-zinc-900 rounded-sm overflow-hidden border border-white/5 transition-all duration-500 group-hover:scale-105 group-hover:border-red-600/50 group-hover:shadow-[0_10px_30px_rgba(220,38,38,0.2)]">
        
        {/* Poster Container */}
        <div className="relative aspect-[2/3] overflow-hidden">
          <img
            src={poster}
            alt={title}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          />
          
          {/* Modern Overlay Gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80" />

          {/* Floating Rating Badge */}
          <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/60 backdrop-blur-md px-2 py-1 rounded-sm border border-white/10">
            <Star size={10} className="fill-red-600 text-red-600" />
            <span className="text-[10px] font-black text-white">{stars}</span>
          </div>

          {/* Hover Play Button */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="bg-red-600 p-3 rounded-full shadow-lg transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
              <Play size={20} fill="white" className="text-white" />
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="p-3 bg-zinc-950">
          <h1 className="font-bold text-xs uppercase tracking-widest text-white truncate mb-1 group-hover:text-red-500 transition-colors">
            {title}
          </h1>
          
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-gray-500 uppercase tracking-tighter">
              {mediaType === 'tv' ? 'TV Show' : 'Movie'}
            </span>
            <span className="text-[10px] font-bold text-gray-400">
              {year || "N/A"}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
};

export default MovieCard;