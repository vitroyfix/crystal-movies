import { useState, useEffect } from "react";
import { fetchTrending, fetchMovieDetails } from "../services/api"; 
const YT_API_KEY = import.meta.env.VITE_YT_API_KEY;

export function useHeroBanner() {
  const [item, setItem] = useState(null);
  const [videoIds, setVideoIds] = useState([]);
  const [trailerKey, setTrailerKey] = useState(null);

  useEffect(() => {
    async function getItemAndClips() {
      try {
        const trending = await fetchTrending();
        if (!trending || trending.length === 0) return;

        const firstItem = trending[0]; 
        const fullDetails = await fetchMovieDetails(firstItem.id, firstItem.mediaType);
        setItem(fullDetails);

        const title = fullDetails.title; 
        const typeLabel = firstItem.mediaType === "tv" ? "TV show" : "movie";

        const searchTerms = [
          `${title} official trailer`,
          `${title} ${typeLabel} clip`,
          `${title} scene`,
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

    getItemAndClips();
  }, []);

  return { item, videoIds, trailerKey };
}
