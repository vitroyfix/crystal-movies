import React, { useState, useEffect } from "react";
import MovieCard from "./MovieCard.jsx";
import { fetchMovies } from "../../services/api.js"; 

const MovieGrid = () => {
  const buttons = ["Action", "Romance", "Comedy", "Horror", "Adventure", "Sci-fi", "Drama", "Thriller"];


  const [trending, setTrending] = useState([]);
  const [topRated, setTopRated] = useState([]);
  const [recentlyAdded, setRecentlyAdded] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadMovies() {
      const trendingData = await fetchMovies(); 
      const topRatedData = await fetchMovies(); 
      const recentlyAddedData = await fetchMovies(); 

      setTrending(trendingData);
      setTopRated(topRatedData);
      setRecentlyAdded(recentlyAddedData);
      setLoading(false);
    }

    loadMovies();
  }, []);

  if (loading) return <p>Loading movies...</p>;

  return (
    <section>
      <div>
        <h2>Trending Now</h2>
        <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
          {trending.map(movie => (
            <MovieCard
              key={movie.id}
              id={movie.id}
              poster={movie.poster}
              title={movie.title}
              rating={movie.rating}
              year={movie.year}
            />
          ))}
        </div>
      </div>

      <div>
        <h2>Top Rated Movies</h2>
        <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
          {topRated.map(movie => (
            <MovieCard
              key={movie.id}
              id={movie.id}
              poster={movie.poster}
              title={movie.title}
              rating={movie.rating}
              year={movie.year}
            />
          ))}
        </div>
      </div>

      <div>
        <h2>Browse by Genre</h2>
        <p>Discover movies tailored to your taste</p>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          {buttons.map((genre, index) => (
            <button key={index}>{genre}</button>
          ))}
        </div>
      </div>

      <div>
        <h2>Recently Added</h2>
        <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
          {recentlyAdded.map(movie => (
            <MovieCard
              key={movie.id}
              id={movie.id}
              poster={movie.poster}
              title={movie.title}
              rating={movie.rating}
              year={movie.year}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default MovieGrid;
