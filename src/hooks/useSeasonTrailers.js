import { useState, useEffect } from "react";

/**
 * useSeasonTrailers
 *
 * Loads trailers for a specific TV season by calling a method exposed on
 * the `movie` object: `movie.fetchTvSeasonTrailers(id, season)`.
 *
 * @param {object|null} movie          - Movie/show object with fetchTvSeasonTrailers method
 * @param {number|null} selectedSeason - Season number to load trailers for
 */
export default function useSeasonTrailers(movie, selectedSeason) {
  const [seasonTrailers, setSeasonTrailers] = useState([]);
  const [loading,        setLoading]        = useState(false);
  const [error,          setError]          = useState(null);

  useEffect(() => {
    // Guard: requires a valid movie object with the fetcher method
    if (!movie || !selectedSeason || typeof movie.fetchTvSeasonTrailers !== "function") {
      setSeasonTrailers([]);
      return;
    }

    let cancelled = false;

    async function loadSeasonTrailers() {
      setLoading(true);
      setError(null);

      try {
        const trailers = await movie.fetchTvSeasonTrailers(movie.id, selectedSeason);
        if (!cancelled) setSeasonTrailers(trailers ?? []);
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
          setSeasonTrailers([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadSeasonTrailers();

    return () => { cancelled = true; };
  }, [movie, selectedSeason]);

  return { seasonTrailers, loading, error };
}