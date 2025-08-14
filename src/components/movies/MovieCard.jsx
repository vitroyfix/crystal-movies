import { Star } from "lucide-react";
import { Link } from "react-router-dom";

const MovieCard = ({ id, poster, title, rating, year }) => {
  const stars = Math.round(rating);

  return (
    <Link to={`/movie/${id}`} style={{ textDecoration: "none", color: "inherit" }}>
      <div>
        <div>
          <img src={poster} alt={title} />
        </div>
        <div>
          <h1>{title}</h1>
        </div>
        <div>
          <Star size={15} />
          <p>{stars}/10</p>
        </div>
        <div>
          <p>{year}</p>
        </div>
      </div>
    </Link>
  );
};

export default MovieCard;
