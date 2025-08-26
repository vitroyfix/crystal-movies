import { useState, useEffect } from "react";
const API_KEY = import.meta.env.VITE_TMDB_API_KEY;
const BASE_URL = import.meta.env.VITE_BASE_URL;

export default function useMovies(type = "all") {
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1); 
  const [hasMore, setHasMore] = useState(true); 
  const fetchMovies = async (currentPage = 1) => {
    setLoading(true);
    setError(null);

    try {
      let endpoint = "";

      switch (type) {
        case "top_rated":
          endpoint = `${BASE_URL}/movie/top_rated?api_key=${API_KEY}&language=en-US&page=${currentPage}`;
          break;
        case "recent":
          endpoint = `${BASE_URL}/trending/all/day?api_key=${API_KEY}&language=en-US&page=${currentPage}`;
          break;
        case "tv":
          endpoint = `${BASE_URL}/tv/popular?api_key=${API_KEY}&language=en-US&page=${currentPage}`;
          break;
        case "all":
        default:
          endpoint = `${BASE_URL}/trending/all/day?api_key=${API_KEY}&language=en-US&page=${currentPage}`;
          break;
      }

      const res = await fetch(endpoint);
      if (!res.ok) throw new Error("Failed to fetch movies");
      const data = await res.json();

      if (!data.results || data.results.length === 0) {
        setHasMore(false);
        return;
      }

      const newMovies = data.results.map((item) => ({
        id: item.id,
        title: item.title || item.name,
        mediaType: item.media_type || (item.first_air_date ? "tv" : "movie"),
        poster: item.poster_path
          ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
          : "/no-poster.png",
        year: (item.release_date || item.first_air_date || "N/A").split("-")[0],
        rating: item.vote_average || 0,
      }));

      setMovies((prev) => [
        ...prev,
        ...newMovies.filter((nm) => !prev.some((m) => m.id === nm.id)),
      ]);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setMovies([]);
    setPage(1);
    setHasMore(true);
    fetchMovies(1);
  }, [type]);

  const loadMore = () => {
    if (!hasMore) return;
    const nextPage = page + 1;
    setPage(nextPage);
    fetchMovies(nextPage);
  };

  return { movies, loading, error, loadMore, hasMore };
}
