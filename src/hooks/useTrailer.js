import { useState, useEffect } from "react";

// Fallback to the standard TMDb v3 URL if the env variable is missing
const API_KEY = import.meta.env.VITE_TMDB_API_KEY;
const BASE_URL = import.meta.env.VITE_BASE_URL || "https://api.themoviedb.org/3";
const YT_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY;

export default function useTrailer(id, type = "movie", autoPlay = true, seasonNumber = null, title = "") {
  const [trailerUrl, setTrailerUrl] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Prevent fetching if id is null or undefined (this stops the 404s on mount)
    if (!id || id === "undefined") return;

    async function fetchTrailer() {
      setLoading(true);
      setError(null);

      try {
        let endpoint = `${BASE_URL}/${type}/${id}/videos?api_key=${API_KEY}&language=en-US`;
        
        if (type === "tv" && seasonNumber !== null) {
          endpoint = `${BASE_URL}/tv/${id}/season/${seasonNumber}/videos?api_key=${API_KEY}&language=en-US`;
        }

        const res = await fetch(endpoint);
        
        // If the response is not OK (404, 401), throw error
        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.status_message || "Failed to fetch trailer from TMDb");
        }

        const data = await res.json();
        let trailer = data.results?.find(
          (vid) => (vid.type === "Trailer" || vid.type === "Teaser") && vid.site === "YouTube"
        );

        // Fallback to YouTube Search API if TMDb has no video for a TV Season
        if (!trailer && type === "tv" && seasonNumber !== null && YT_API_KEY) {
          const seasonQuery = `${title} Season ${seasonNumber} Trailer`;
          const ytRes = await fetch(
            `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(
              seasonQuery
            )}&key=${YT_API_KEY}&maxResults=1&type=video`
          );
          const ytData = await ytRes.json();
          if (ytData.items && ytData.items.length > 0) {
            trailer = { key: ytData.items[0].id.videoId };
          }
        }

        if (trailer) {
          const autoplayParam = autoPlay ? 1 : 0;
          setTrailerUrl(
            `https://www.youtube.com/embed/${trailer.key}?autoplay=${autoplayParam}&unmute=1&loop=1&playlist=${trailer.key}`
          );
        } else {
          setTrailerUrl("");
        }
      } catch (err) {
        console.error("Error fetching trailer:", err);
        setError(err.message);
        setTrailerUrl("");
      } finally {
        setLoading(false);
      }
    }

    fetchTrailer();
  }, [id, type, seasonNumber, autoPlay, title]);

  const playTrailer = () => setIsPlaying(true);
  const stopTrailer = () => setIsPlaying(false);

  return { trailerUrl, isPlaying, playTrailer, stopTrailer, loading, error };
}