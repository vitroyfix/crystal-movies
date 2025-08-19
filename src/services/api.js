const API_KEY = "7950b183ab0b26dfd1bc509617009940";
const BASE_URL = "https://api.themoviedb.org/3";
const OMDB_API_KEY = "ea2021d";

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
  return data.results.map((movie) => ({
    id: movie.id,
    poster: movie.poster_path
      ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
      : "/no-poster.png",
    title: movie.title,
    rating: movie.vote_average,
    year: movie.release_date?.split("-")[0],
  }));
}

// Popular movies
export async function fetchMovies() {
  try {
    const res = await fetch(
      `${BASE_URL}/movie/popular?api_key=${API_KEY}&language=en-US&page=1`
    );
    if (!res.ok) throw new Error(`Error fetching movies: ${res.status}`);
    const data = await res.json();
    return mapMovies(data);
  } catch (error) {
    console.error("Failed to fetch movies:", error);
    return [];
  }
}

// Trending movies
export async function fetchTrendingMovies() {
  try {
    const res = await fetch(
      `${BASE_URL}/trending/movie/week?api_key=${API_KEY}&language=en-US`
    );
    if (!res.ok) throw new Error(`Error fetching trending movies: ${res.status}`);
    const data = await res.json();
    return mapMovies(data);
  } catch (error) {
    console.error("Failed to fetch trending movies:", error);
    return [];
  }
}

// Top Rated movies
export async function fetchTopRatedMovies() {
  try {
    const res = await fetch(
      `${BASE_URL}/movie/top_rated?api_key=${API_KEY}&language=en-US&page=1`
    );
    if (!res.ok) throw new Error(`Error fetching top rated: ${res.status}`);
    const data = await res.json();
    return mapMovies(data);
  } catch (error) {
    console.error("Failed to fetch top rated:", error);
    return [];
  }
}

// Recently Added (using now_playing)
export async function fetchRecentlyAddedMovies() {
  try {
    const res = await fetch(
      `${BASE_URL}/movie/now_playing?api_key=${API_KEY}&language=en-US&page=1`
    );
    if (!res.ok) throw new Error(`Error fetching recently added: ${res.status}`);
    const data = await res.json();
    return mapMovies(data);
  } catch (error) {
    console.error("Failed to fetch recently added:", error);
    return [];
  }
}

// Trailer
export async function fetchTrailer(movieId) {
  try {
    const res = await fetch(
      `${BASE_URL}/movie/${movieId}/videos?api_key=${API_KEY}&language=en-US`
    );
    if (!res.ok) throw new Error(`Error fetching trailer: ${res.status}`);
    const data = await res.json();
    const trailer = data.results.find(
      (vid) => vid.type === "Trailer" && vid.site === "YouTube"
    );
    return trailer ? trailer.key : null;
  } catch (error) {
    console.error("Failed to fetch trailer:", error);
    return null;
  }
}

// Movie details
export async function fetchMovieDetails(id) {
  try {
    const [detailsRes, creditsRes] = await Promise.all([
      fetch(
        `${BASE_URL}/movie/${id}?api_key=${API_KEY}&language=en-US&append_to_response=external_ids`
      ),
      fetch(`${BASE_URL}/movie/${id}/credits?api_key=${API_KEY}&language=en-US`),
    ]);

    if (!detailsRes.ok) throw new Error(`Error fetching movie details: ${detailsRes.status}`);
    if (!creditsRes.ok) throw new Error(`Error fetching credits: ${creditsRes.status}`);

    const details = await detailsRes.json();
    const credits = await creditsRes.json();

    // try fetching longer plot from OMDb
    let plot = details.overview;
    if (details.external_ids?.imdb_id) {
      try {
        const omdbRes = await fetch(
          `https://www.omdbapi.com/?i=${details.external_ids.imdb_id}&plot=full&apikey=${OMDB_API_KEY}`
        );
        const omdbData = await omdbRes.json();
        if (omdbData.Plot && omdbData.Plot !== "N/A") {
          plot = omdbData.Plot;
        }
      } catch {
        console.warn("Could not fetch long plot from OMDb. Using TMDb overview.");
      }
    }

    const director = credits.crew?.find((c) => c.job === "Director")?.name || "N/A";
    const writers =
      credits.crew?.filter((c) => c.job === "Writer").map((w) => w.name).join(", ") || "N/A";
    const cast = credits.cast?.slice(0, 5).map((a) => a.name).join(", ") || "N/A";
    const genre = details.genres?.map((g) => g.name).join(", ") || "N/A";

    return {
      poster: details.poster_path
        ? `https://image.tmdb.org/t/p/w500${details.poster_path}`
        : "/no-poster.png",
      title: details.title,
      badgeYear: details.release_date?.split("-")[0],
      rating: details.vote_average,
      runtime: `${details.runtime} min`,
      votes: details.vote_count,
      plot,
      director,
      writer: writers,
      cast,
      genre,
      language: languageMap[details.original_language] || details.original_language || "N/A",
    };
  } catch (error) {
    console.error("Failed to fetch movie details:", error);
    return null;
  }
}
