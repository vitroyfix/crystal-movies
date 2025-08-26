import { Star } from "lucide-react";
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
      <div className="bg-gray-900 rounded-lg overflow-hidden shadow-md hover:scale-105 transform transition relative">
        <div className="relative">
          <img
            src={poster}
            alt={title}
            className="w-full h-64 object-cover group-hover:opacity-90"
          />
        </div>

        <div className="p-3 text-white">
        <h1 className="font-semibold text-base mb-1 truncate">{title}</h1>
          <div className="flex items-center justify-between text-sm text-gray-300">
            <div className="flex items-center gap-1">
              <Star size={14} className="text-yellow-400" />
              <p>{stars}/10</p>
            </div>
            <p className="text-gray-400">{year || "N/A"}</p>
          </div>
        </div>
      </div>
    </Link>
  );
};

export default MovieCard;
