import { useState, useEffect } from "react";
import { fetchTrendingMovies } from "../services/api";

const YT_API_KEY = "AIzaSyDF-XoNkTPCQ-ZdwMeBDEQ6rY-d5LBKfms"; 
export function useHeroBanner() {
  const [movie, setMovie] = useState(null);
  const [videoIds, setVideoIds] = useState([]);
  const [trailerKey, setTrailerKey] = useState(null);

  useEffect(() => {
    async function getMovieAndClips() {
      try {
        const trending = await fetchTrendingMovies();
        if (!trending || trending.length === 0) return;

        const firstMovie = trending[0];
        setMovie(firstMovie);

        const searchTerms = [
          firstMovie.title + " official trailer",
          firstMovie.title + " movie clip",
          firstMovie.title + " scene",
        ];

        const ids = [];
        for (let term of searchTerms) {
          const res = await fetch(
            `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(
              term
            )}&key=${YT_API_KEY}&maxResults=1&type=video`
          );
          const data = await res.json();
          if (data.items?.length > 0) ids.push(data.items[0].id.videoId);
        }

        setVideoIds(ids);
        if (ids.length > 0) setTrailerKey(ids[0]);
      } catch (error) {
        console.error("Error loading hero banner:", error);
      }
    }

    getMovieAndClips();
  }, []);

  return { movie, videoIds, trailerKey };
}
