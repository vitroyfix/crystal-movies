import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import MovieCard from "../components/movies/MovieCard.jsx";
import { 
  fetchMovies, 
  fetchTVShows, 
  fetchTopRatedMovies, 
  fetchRecentMovies 
} from "../services/api.js";

export default function MovieGridPage() {
  const location = useLocation();
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const getPageType = () => {
    switch (location.pathname) {
      case "/movies": return "movies";
      case "/tv": return "tv";
      case "/top-rated": return "top-rated";
      case "/recent": return "recent";
      default: return "movies";
    }
  };

  const fetchData = async (currentPage = 1) => {
    setLoading(true);
    setError(null);

    const pageType = getPageType();

    try {
      let data = [];

      if (pageType === "movies") data = await fetchMovies(currentPage);
      else if (pageType === "tv") data = await fetchTVShows(currentPage);
      else if (pageType === "top-rated") data = await fetchTopRatedMovies(currentPage);
      else if (pageType === "recent") data = await fetchRecentMovies(currentPage);

      if (data.length === 0) {
        setHasMore(false);
        return;
      }

      // Filter out duplicates
      const filteredData = data.filter(
        (item) => !movies.some((movie) => movie.id === item.id)
      );

      if (filteredData.length === 0) setHasMore(false);

      setMovies((prev) => [...prev, ...filteredData]);
    } catch (err) {
      console.error("Error fetching grid data:", err);
      setError("Failed to load content.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setMovies([]);
    setPage(1);
    setHasMore(true);
    fetchData(1);
  }, [location.pathname]);

  const handleLoadMore = () => {
    if (!hasMore) return;
    const nextPage = page + 1;
    setPage(nextPage);
    fetchData(nextPage);
  };

  return (
    <div className="min-h-screen bg-black p-8">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
        {movies.length > 0 ? (
          movies.map((movie) => <MovieCard key={movie.id} {...movie} />)
        ) : (
          <p className="text-white">No content found.</p>
        )}
      </div>

      {loading && <p className="text-white mt-4">Loading...</p>}
      {!loading && hasMore && (
        <button
          className="mt-6 px-6 py-2 bg-red-500 text-white font-bold rounded hover:bg-red-500 transition"
          onClick={handleLoadMore}
        >
          Load More
        </button>
      )}
      {!hasMore && <p className="text-gray-400 mt-4">No more results.</p>}
      {error && <p className="text-red-500 mt-4">{error}</p>}
    </div>
  );
}
