import { useState, useEffect } from "react";

const TMDB_API_KEY   = import.meta.env.VITE_TMDB_API_KEY;   // Bearer token
const TMDB_BASE_URL  = "https://api.themoviedb.org/3";
const YT_API_KEY     = import.meta.env.VITE_YOUTUBE_API_KEY;

/**
 * useTrailer
 *
 * Fetches a trailer for a movie or TV show (optionally a specific season).
 * Falls back to YouTube Search API when TMDB has no result for a TV season.
 *
 * @param {string|number} id          - TMDB media ID
 * @param {"movie"|"tv"}  type        - Media type
 * @param {boolean}       autoPlay    - Whether the embed should autoplay
 * @param {number|null}   seasonNumber- TV season number (null for movies)
 * @param {string}        title       - Show title (used for YT fallback query)
 */
export default function useTrailer(
  id,
  type = "movie",
  autoPlay = true,
  seasonNumber = null,
  title = ""
) {
  const [trailerUrl, setTrailerUrl] = useState("");
  const [isPlaying,  setIsPlaying]  = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState(null);

  useEffect(() => {
    // Guard: don't run with missing / invalid id
    if (!id || id === "undefined") return;

    let cancelled = false; // prevent state update after unmount

    async function fetchTrailer() {
      setLoading(true);
      setError(null);

      try {
        // ── 1. Build TMDB endpoint ────────────────────────────────────────────
        let endpoint = `${TMDB_BASE_URL}/${type}/${id}/videos?language=en-US`;
        if (type === "tv" && seasonNumber !== null) {
          endpoint = `${TMDB_BASE_URL}/tv/${id}/season/${seasonNumber}/videos?language=en-US`;
        }

        // ── 2. Fetch from TMDB with Bearer token ──────────────────────────────
        const res = await fetch(endpoint, {
          headers: {
            Authorization: `Bearer ${TMDB_API_KEY}`,
            accept: "application/json",
          },
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.status_message || `TMDB error ${res.status}`);
        }

        const data = await res.json();

        // ── 3. Pick best video (Trailer > Teaser, YouTube only) ───────────────
        let trailer = (data.results ?? []).find(
          (v) =>
            (v.type === "Trailer" || v.type === "Teaser") &&
            v.site === "YouTube"
        );

        // ── 4. YouTube fallback for TV seasons ────────────────────────────────
        if (!trailer && type === "tv" && seasonNumber !== null && YT_API_KEY) {
          const query = `${title} Season ${seasonNumber} Official Trailer`;
          const ytRes = await fetch(
            `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&key=${YT_API_KEY}&maxResults=1&type=video`
          );
          const ytData = await ytRes.json();
          const firstItem = ytData.items?.[0];
          if (firstItem) {
            trailer = { key: firstItem.id.videoId };
          }
        }

        if (cancelled) return;

        // ── 5. Build embed URL ────────────────────────────────────────────────
        if (trailer?.key) {
          const autoplayParam = autoPlay ? 1 : 0;
          setTrailerUrl(
            `https://www.youtube.com/embed/${trailer.key}` +
            `?autoplay=${autoplayParam}&mute=0&loop=1&playlist=${trailer.key}&rel=0`
          );
        } else {
          setTrailerUrl("");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
          setTrailerUrl("");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchTrailer();

    return () => { cancelled = true; };
  }, [id, type, seasonNumber, autoPlay, title]);

  const playTrailer  = () => setIsPlaying(true);
  const stopTrailer  = () => setIsPlaying(false);

  return { trailerUrl, isPlaying, playTrailer, stopTrailer, loading, error };
}