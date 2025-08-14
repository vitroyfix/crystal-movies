import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { fetchMovieDetails } from "../services/api";
import { Star } from 'lucide-react';

const MovieDetails = () => {
  const { id } = useParams();
  const [movie, setMovie] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadMovie() {
      const data = await fetchMovieDetails(id);
      setMovie(data);
      setLoading(false);
    }
    loadMovie();
  }, [id]);

  if (loading) return <p>Loading movie details...</p>;
  if (!movie) return <p>Failed to load movie details.</p>;

  const { poster, title, badgeYear, rating, runtime, votes, plot } = movie;
  const star = Math.round(rating);

 const movieDetails = {
  Director: movie.director,
  Cast: movie.cast,
  Language: movie.language,
  Writer: movie.writer,
  Genre: movie.genre,
};


  return (
    <div>
      <div>
      <img src={poster} alt={title} />
      <h1>{title}</h1>
      <p>{badgeYear}</p>
      <p>{runtime}</p>
      <p>{votes} votes</p>
      <p>{plot}</p>
      <p><Star size="15px"/>{star}/10</p>
      </div>
       <div>
        {Object.entries(movieDetails).map(([key, value]) => (
        <p key={key}><strong>{key}:</strong> {value}</p>
        ))}
     </div>
    </div>
  );
};

export default MovieDetails;
