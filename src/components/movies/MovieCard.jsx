import { Star, Play } from "lucide-react";
import { Link } from "react-router-dom";

const MovieCard = ({ id, poster, title, rating, year }) => {
  const stars = Math.round(rating);

  return (
    <Link to={`/movie/${id}`} className="block group">
      <div className="bg-gray-900 rounded-lg overflow-hidden shadow-md hover:scale-105 transform transition relative">
        {/* Poster */}
        <div className="relative">
          <img
            src={poster}
            alt={title}
            className="w-full h-64 object-cover group-hover:opacity-90"
          />

          {/* Play button overlay */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition bg-black/50">
            <Play size={36} className="text-white" />
          </div>
        </div>

        {/* Info */}
        <div className="p-3 text-white">
          {/* Title */}
          <h1 className="font-semibold text-base mb-1 truncate">{title}</h1>

          {/* Rating + Year */}
          <div className="flex items-center justify-between text-sm text-gray-300">
            <div className="flex items-center gap-1">
              <Star size={14} className="text-yellow-400" />
              <p>{stars}/10</p>
            </div>
            <p className="text-gray-400">{year}</p>
          </div>
        </div>
      </div>
    </Link>
  );
};

export default MovieCard;
