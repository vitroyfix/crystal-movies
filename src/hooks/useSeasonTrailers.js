import { useState, useEffect } from "react";

export default function useSeasonTrailers(movie, selectedSeason) {
  const [seasonTrailers, setSeasonTrailers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadSeasonTrailers() {
      if (!movie || !selectedSeason || !movie.fetchTvSeasonTrailers) return;

      setLoading(true);
      setError(null);

      try {
        const trailers = await movie.fetchTvSeasonTrailers(movie.id, selectedSeason);
        setSeasonTrailers(trailers);
      } catch (err) {
        console.error("Failed to load season trailers:", err);
        setError(err.message);
        setSeasonTrailers([]);
      } finally {
        setLoading(false);
      }
    }

    loadSeasonTrailers();
  }, [movie, selectedSeason]);

  return { seasonTrailers, loading, error };
}
