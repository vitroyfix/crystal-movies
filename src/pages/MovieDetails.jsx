import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { fetchMovieDetails } from "../services/api"; 
import { Star } from "lucide-react";
import useTrailer from "../hooks/useTrailer";
import "../styles/MovieDetails.css";

const DetailItem = ({ label, value }) => {
  if (!value || value === "N/A") return null;
  return (
    <p>
      <strong>{label}:</strong> {value}
    </p>
  );
};

const MovieDetails = () => {
  const { id, mediaType: typeFromPath } = useParams();
  const resolvedMediaType = typeFromPath === "tv" ? "tv" : "movie";

  const [movie, setMovie] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSeason, setSelectedSeason] = useState(null);

    const { trailerUrl, isPlaying, playTrailer, stopTrailer, loading: trailerLoading } = useTrailer(
    id,
    resolvedMediaType,
    true,
    selectedSeason,
    movie?.title || movie?.name || ""
  );

  useEffect(() => {
    async function loadMovie() {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchMovieDetails(id, resolvedMediaType); 
        if (!data) throw new Error("No data found");
        setMovie(data);

        if (resolvedMediaType === "tv" && data.seasons?.length) {
          setSelectedSeason(data.seasons[0].season_number);
        }
      } catch (err) {
        console.error("Failed to load details:", err);
        setError("Could not fetch details.");
      } finally {
        setLoading(false);
      }
    }
    loadMovie();
  }, [id, resolvedMediaType]);

  if (loading) return <p>Loading {resolvedMediaType} details...</p>;
  if (error) return <p>{error}</p>;
  if (!movie) return <p>No details found.</p>;

  const { poster, title, badgeYear, rating, runtime, votes, plot, seasons } = movie;
  const star = Math.round(rating);

  return (
    <div className="movie-details" style={{ "--poster-url": `url(${poster})` }}>
      <div className="movie-header">
        <img src={poster} alt={title} />
        <div className="movie-info">
          <h1>{title}</h1>
          <div className="flex items-center space-x-4 text-sm text-gray-300 gap-6">
            <p>{badgeYear}</p>
            {runtime && <p>{runtime}</p>}
            <p>{votes} votes</p>
          </div>
          <p>{plot}</p>
          <p className="flex items-center text-yellow-400">
            <Star size="15px" className="text-yellow-400 mr-1" /> {star}/10
          </p>

        {resolvedMediaType === "tv" && seasons?.length > 0 && (
                <div className="season-selector my-4 flex flex-col md:flex-row items-start md:items-center gap-2">
                  <label className="text-white font-medium mb-1 md:mb-0 md:mr-2">
                    Select Season:
                  </label>
                  <select
                    value={selectedSeason}
                    onChange={(e) => setSelectedSeason(Number(e.target.value))}
                    className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 bg-white text-gray-800"
                  >
                    {seasons.map((s) => (
                      <option key={s.id} value={s.season_number}>
                        {s.name || `Season ${s.season_number}`}
                      </option>             
                    ))}
                  </select>
              </div>
        )}
          {trailerUrl && !isPlaying && (
            <button className="mt-2 px-4 py-2 bg-red-500 text-black rounded" onClick={playTrailer}>
              Watch Trailer
            </button>
          )}
          {isPlaying && (
            <button className="mt-2 px-4 py-2 bg-gray-800 text-white rounded" onClick={stopTrailer}>
              Stop Trailer
            </button>
          )}
        </div>
      </div>
      {isPlaying && trailerUrl && (
        <div className="trailer-container mt-4">
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
      <div className="movie-extra-details mt-4">
        <DetailItem label={resolvedMediaType === "tv" ? "Creator" : "Director"} value={movie.director} />
        <DetailItem label="Cast" value={movie.cast} />
        <DetailItem label="Language" value={movie.language} />
        <DetailItem label="Writer" value={movie.writer} />
        <DetailItem label="Genre" value={movie.genre} />
      </div>
    </div>
  );
};

export default MovieDetails;
