import { Star } from 'lucide-react';

const MovieCard = ({ poster, title, rating, year }) => {
  const stars = Math.round(rating);

  return (
    <div>
      <div>
        <img src={poster} alt={`${title}`} />
      </div>
      <div>
        <h1>{title}</h1>
      </div>
      <div>
        <Star size={15}/>
        <p>{stars}/5</p>
      </div>
      <div>
        <p>{year}</p>
      </div>
    </div>
  );
};

export default MovieCard;
