import { useState, useEffect } from "react";

const API_KEY = import.meta.env.VITE_TMDB_API_KEY;
const BASE_URL = import.meta.env.VITE_BASE_URL;
const YT_API_KEY = import.meta.env.VITE_YT_API_KEY;

export default function useTrailer(id, type = "movie", autoPlay = true, seasonNumber = null, title = "") {
  const [trailerUrl, setTrailerUrl] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!id) return;

    async function fetchTrailer() {
      setLoading(true);
      setError(null);

      try {
        
        let endpoint = `${BASE_URL}/${type}/${id}/videos?api_key=${API_KEY}&language=en-US`;
        if (type === "tv" && seasonNumber !== null) {
          endpoint = `${BASE_URL}/tv/${id}/season/${seasonNumber}/videos?api_key=${API_KEY}&language=en-US`;
        }

        const res = await fetch(endpoint);
        if (!res.ok) throw new Error("Failed to fetch trailer from TMDb");

        const data = await res.json();
        let trailer = data.results?.find(
          (vid) => vid.type === "Trailer" && vid.site === "YouTube"
        );

              if (!trailer && type === "tv" && seasonNumber !== null) {
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
