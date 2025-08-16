import { useState, useEffect } from "react";

const API_KEY = "7950b183ab0b26dfd1bc509617009940";
const BASE_URL = "https://api.themoviedb.org/3";

export default function useTrailer(movieId) {
  const [trailerUrl, setTrailerUrl] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (!movieId) return;

    async function fetchTrailer() {
      try {
        const res = await fetch(`${BASE_URL}/movie/${movieId}/videos?api_key=${API_KEY}&language=en-US`);
        const data = await res.json();

       
        const trailer = data.results.find(
          (vid) => vid.type === "Trailer" && vid.site === "YouTube"
        );

        if (trailer) {
          setTrailerUrl(`https://www.youtube.com/embed/${trailer.key}?autoplay=1&mute=1&loop=1&playlist=${trailer.key}`);
        }
      } catch (error) {
        console.error("Error fetching trailer:", error);
      }
    }

    fetchTrailer();
  }, [movieId]);

  const playTrailer = () => setIsPlaying(true);
  const stopTrailer = () => setIsPlaying(false);

  return { trailerUrl, isPlaying, playTrailer, stopTrailer };
}
