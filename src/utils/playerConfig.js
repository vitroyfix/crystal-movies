/**
 * playerConfig.js
 */

export const forceEnglish = (url) => {
  if (!url) return "";
  
  const separator = url.includes("?") ? "&" : "?";
  
  // hl=en and hlang=en are the most powerful flags for HLS players 
  // to pick the correct track from the manifest.
  const englishParams = "lang=en&audio=en&audio_track=en&hl=en&hlang=en&forced=en";

  return `${url}${separator}${englishParams}`;
};

export const PROVIDERS = {
  vidlink: (id, type, s, e) => {
    const base = type === 'movie' 
      ? `https://vidlink.pro/movie/${id}` 
      : `https://vidlink.pro/tv/${id}/${s}/${e}`;
    return forceEnglish(`${base}?primaryColor=e50914&nextbutton=true`);
  },
  
  vidsrc: (id, type, s, e) => {
    const base = type === 'movie'
      ? `https://vidsrc.me/embed/movie?tmdb=${id}`
      : `https://vidsrc.me/embed/tv?tmdb=${id}&sea=${s}&epi=${e}`;
    return forceEnglish(base);
  }
};