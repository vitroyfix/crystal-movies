const API_KEY = import.meta.env.VITE_TMDB_API_KEY;
const BASE_URL = import.meta.env.VITE_BASE_URL;
const OMDB_API_KEY = import.meta.env.VITE_OMDB_API_KEY;

const languageMap = {
  en: "English",
  zh: "Chinese",
  fr: "French",
  es: "Spanish",
  ja: "Japanese",
  de: "German",
  it: "Italian",
  ko: "Korean",
  hi: "Hindi",
  ru: "Russian",
  pt: "Portuguese",
  ar: "Arabic",
};

function mapMovies(data) {
  return data.results.map((item) => {
    const mediaType = item.media_type || (item.first_air_date ? "tv" : "movie");
    let year = "N/A";
    if (mediaType === "movie" && item.release_date) year = item.release_date.split("-")[0];
    else if (mediaType === "tv" && item.first_air_date) year = item.first_air_date.split("-")[0];
    return {
      id: item.id,
      mediaType,
      poster: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : "/no-poster.png",
      title: item.title || item.name || "Untitled",
      rating: item.vote_average || 0,
      year,
      runtime: "N/A",
    };
  });
}

export async function fetchMovies(page = 1) {
  try {
    const res = await fetch(`${BASE_URL}/movie/popular?api_key=${API_KEY}&language=en-US&page=${page}`);
    if (!res.ok) throw new Error(`Error fetching movies: ${res.status}`);
    const data = await res.json();
    return mapMovies(data);
  } catch (error) {
    console.error("Failed to fetch movies:", error);
    return [];
  }
}

export async function fetchTrending() {
  try {
    const res = await fetch(`${BASE_URL}/trending/all/day?api_key=${API_KEY}&language=en-US`);
    if (!res.ok) throw new Error(`Error fetching trending: ${res.status}`);
    const data = await res.json();
    return mapMovies(data);
  } catch (error) {
    console.error("Failed to fetch trending:", error);
    return [];
  }
}

export async function fetchTrailer(id, mediaType = "movie") {
  try {
    const res = await fetch(`${BASE_URL}/${mediaType}/${id}/videos?api_key=${API_KEY}&language=en-US`);
    if (!res.ok) throw new Error(`Error fetching trailer: ${res.status}`);
    const data = await res.json();
    const trailer = data.results?.find((v) => v.type === "Trailer" && v.site === "YouTube");
    return trailer?.key || null;
  } catch (error) {
    console.error("Failed to fetch trailer:", error);
    return null;
  }
}

export async function fetchTvSeasonTrailers(tvId, seasonNumber) {
  try {
    const res = await fetch(`${BASE_URL}/tv/${tvId}/season/${seasonNumber}/videos?api_key=${API_KEY}&language=en-US`);
    if (!res.ok) throw new Error(`Error fetching season trailers: ${res.status}`);
    const data = await res.json();
    return data.results?.filter(v => v.type === "Trailer" && v.site === "YouTube") || [];
  } catch (error) {
    console.error("Failed to fetch season trailers:", error);
    return [];
  }
}

export async function fetchMovieDetails(id, mediaType = "movie") {
  try {
    const [detailsRes, creditsRes, trailerKey] = await Promise.all([
      fetch(`${BASE_URL}/${mediaType}/${id}?api_key=${API_KEY}&language=en-US&append_to_response=external_ids,seasons`),
      fetch(`${BASE_URL}/${mediaType}/${id}/credits?api_key=${API_KEY}&language=en-US`),
      fetchTrailer(id, mediaType),
    ]);

    if (!detailsRes.ok) throw new Error(`Error fetching details: ${detailsRes.status}`);
    if (!creditsRes.ok) throw new Error(`Error fetching credits: ${creditsRes.status}`);

    const details = await detailsRes.json();
    const credits = await creditsRes.json();
    let plot = details.overview;

    if (mediaType === "movie" && details.external_ids?.imdb_id) {
      try {
        const omdbRes = await fetch(`https://www.omdbapi.com/?i=${details.external_ids.imdb_id}&plot=full&apikey=${OMDB_API_KEY}`);
        const omdbData = await omdbRes.json();
        if (omdbData.Plot && omdbData.Plot !== "N/A") plot = omdbData.Plot;
      } catch {
        console.warn("Could not fetch full plot from OMDb.");
      }
    }

    let director = "N/A";
    if (mediaType === "movie") director = credits.crew?.find(c => c.job === "Director")?.name || "N/A";
    else if (mediaType === "tv") director = credits.crew?.find(c => c.job === "Executive Producer")?.name || credits.crew?.find(c => c.job === "Creator")?.name || "N/A";

    const writers = credits.crew?.filter(c => c.job === "Writer" || c.department === "Writing").map(w => w.name).join(", ") || "N/A";
    const cast = credits.cast?.slice(0, 5).map(a => a.name).join(", ") || "N/A";
    const genre = details.genres?.map(g => g.name).join(", ") || "N/A";
    const badgeYear = details.release_date?.split("-")[0] || details.first_air_date?.split("-")[0] || "N/A";

    let runtime = "N/A";
    if (mediaType === "movie") runtime = details.runtime ? `${Math.floor(details.runtime / 60)}h ${details.runtime % 60}m` : "N/A";
    else if (mediaType === "tv") runtime = details.episode_run_time?.length ? `${details.episode_run_time[0]}m per episode` : details.seasons?.length ? "Episode runtime varies" : "N/A";

    return {
      poster: details.poster_path ? `https://image.tmdb.org/t/p/w500${details.poster_path}` : "/no-poster.png",
      title: details.title || details.name,
      badgeYear,
      rating: details.vote_average || 0,
      runtime,
      votes: details.vote_count || 0,
      plot,
      director,
      writer: writers,
      cast,
      genre,
      language: languageMap[details.original_language] || details.original_language || "N/A",
      mediaType,
      trailerKey,
      seasons: details.seasons || [],
      fetchTvSeasonTrailers,
    };
  } catch (error) {
    console.error("Failed to fetch details:", error);
    return null;
  }
}

export async function fetchTVShows(page = 1) {
  try {
    const res = await fetch(`${BASE_URL}/tv/popular?api_key=${API_KEY}&language=en-US&page=${page}`);
    if (!res.ok) throw new Error(`Error fetching TV shows: ${res.status}`);
    const data = await res.json();
    return mapMovies(data);
  } catch (err) {
    console.error(err);
    return [];
  }
}

export async function fetchTopRatedMovies(page = 1) {
  try {
    const res = await fetch(`${BASE_URL}/movie/top_rated?api_key=${API_KEY}&language=en-US&page=${page}`);
    if (!res.ok) throw new Error(`Error fetching top-rated movies: ${res.status}`);
    const data = await res.json();
    return mapMovies(data);
  } catch (err) {
    console.error(err);
    return [];
  }
}

export async function fetchRecentMovies(page = 1) {
  try {
    const res = await fetch(`${BASE_URL}/movie/now_playing?api_key=${API_KEY}&language=en-US&page=${page}`);
    if (!res.ok) throw new Error(`Error fetching recent movies: ${res.status}`);
    const data = await res.json();
    return mapMovies(data);
  } catch (err) {
    console.error(err);
    return [];
  }
}
