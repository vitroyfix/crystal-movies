import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { fetchMovieDetails } from "../services/api";
import { Star } from "lucide-react";
import useTrailer from "../hooks/useTrailer";
import '../styles/MovieDetails.css'

const DetailItem = ({ label, value }) => {
  if (!value || value === "N/A") return null;
  return (
    <p>
      <strong>{label}:</strong> {value}
    </p>
  );
};

const MovieDetails = () => {
  const { id } = useParams();
  const [movie, setMovie] = useState(null);
  const [loading, setLoading] = useState(true);

  // Trailer hook usage
  const { trailerUrl, isPlaying, playTrailer, stopTrailer } = useTrailer(id);

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

  return (
    <div className="movie-details" 
     style={{ "--poster-url": `url(${poster})` }}>
      <div className="movie-header">
        <img src={poster} alt={title} />
        <div className="movie-info">
          <h1>{title}</h1>
        <div className="flex items-center space-x-4 text-sm text-gray-300 gap-6">
            <p>{badgeYear}</p>
             <p>{runtime}</p>
            <p>{votes} votes</p>
          </div>
          <p>{plot}</p>
          <p className="flex items-center text-yellow-400">
            <Star size="15px" className="text-yellow-400 mr-1" /> {star}/10 
          </p>

          {/* Trailer buttons */}
          <div className="trailer-buttons">
            {!isPlaying && <button onClick={playTrailer}>Watch Trailer</button>}
            {isPlaying && <button onClick={stopTrailer}>Stop Trailer</button>}
          </div>
        </div>
      </div>

      {/* Show trailer inline if playing */}
      {isPlaying && trailerUrl && (
        <div className="trailer-container">
          <iframe
            width="100%"
            height="400"
            src={trailerUrl}
            title={`${title} Trailer`}
            frameBorder="0"
            allow="autoplay; encrypted-media"
            allowFullScreen
          />
        </div>
      )}

      {/* Additional details */}
      <div className="movie-extra-details">
        <DetailItem label="Director" value={movie.director} />
        <DetailItem label="Cast" value={movie.cast} />
        <DetailItem label="Language" value={movie.language} />
        <DetailItem label="Writer" value={movie.writer} />
        <DetailItem label="Genre" value={movie.genre} />
      </div>
    </div>
  );
};

export default MovieDetails;