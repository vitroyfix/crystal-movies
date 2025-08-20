import React, { useState, useEffect } from "react";
import MovieCard from "./MovieCard.jsx";
import {
  fetchTrendingMovies,
  fetchTopRatedMovies,
  fetchRecentlyAddedMovies,
} from "../../services/api.js";

const MovieGrid = () => {
  const buttons = [
    "Action",
    "Romance",
    "Comedy",
    "Horror",
    "Adventure",
    "Sci-fi",
    "Drama",
    "Thriller",
  ];

  const [trending, setTrending] = useState([]);
  const [topRated, setTopRated] = useState([]);
  const [recentlyAdded, setRecentlyAdded] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadMovies() {
      const [trendingData, topRatedData, recentlyAddedData] =
        await Promise.all([
          fetchTrendingMovies(),
          fetchTopRatedMovies(),
          fetchRecentlyAddedMovies(),
        ]);

      setTrending(trendingData);
      setTopRated(topRatedData);
      setRecentlyAdded(recentlyAddedData);
      setLoading(false);
    }

    loadMovies();
  }, []);

  if (loading) return <p className="text-white text-center py-10">Loading movies...</p>;

  return (
    <section className="px-6 md:px-12 py-10 bg-black text-white space-y-12">
      {/* Trending Now */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Trending Now</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {trending.map((movie) => (
            <MovieCard key={movie.id} {...movie} />
          ))}
        </div>
      </div>

      {/* Top Rated */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Top Rated Movies</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {topRated.map((movie) => (
            <MovieCard key={movie.id} {...movie} />
          ))}
        </div>
      </div>

      {/* Browse by Genre */}
      <div>
        <h2 className="text-2xl font-bold mb-2">Browse by Genre</h2>
        <p className="text-gray-400 mb-4">Discover movies tailored to your taste</p>
        <div className="flex flex-wrap gap-3">
          {buttons.map((genre, index) => (
            <button
              key={index}
              className="px-4 py-2 bg-gray-800 rounded-full text-sm font-medium hover:bg-red-500 hover:text-black transition"
            >
              {genre}
            </button>
          ))}
        </div>
      </div>

      {/* Recently Added */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Recently Added</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {recentlyAdded.map((movie) => (
            <MovieCard key={movie.id} {...movie} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default MovieGrid;
