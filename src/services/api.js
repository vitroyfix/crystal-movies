const API_KEY = "7950b183ab0b26dfd1bc509617009940"; 
const BASE_URL = "https://api.themoviedb.org/3";

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

export async function fetchMovies() {
  try {
    const res = await fetch(`${BASE_URL}/movie/popular?api_key=${API_KEY}&language=en-US&page=1`);
    if (!res.ok) throw new Error(`Error fetching movies: ${res.status}`);
    const data = await res.json();
    return data.results.map(movie => ({
      id: movie.id,
      poster: `https://image.tmdb.org/t/p/w500${movie.poster_path}`,
      title: movie.title,
      rating: movie.vote_average,
      year: movie.release_date?.split("-")[0],
    }));
  } catch (error) {
    console.error(error);
    return [];
  }
}

export async function fetchMovieDetails(id) {
  try {
    const [detailsRes, creditsRes] = await Promise.all([
      fetch(`${BASE_URL}/movie/${id}?api_key=${API_KEY}&language=en-US`),
      fetch(`${BASE_URL}/movie/${id}/credits?api_key=${API_KEY}&language=en-US`)
    ]);

    if (!detailsRes.ok) throw new Error(`Error fetching movie details: ${detailsRes.status}`);
    if (!creditsRes.ok) throw new Error(`Error fetching credits: ${creditsRes.status}`);

    const details = await detailsRes.json();
    const credits = await creditsRes.json();

    const director = credits.crew?.find(c => c.job === "Director")?.name || null;
    const writers = credits.crew?.filter(c => c.job === "Writer").map(w => w.name).join(", ") || null;
    const cast = credits.cast?.slice(0, 5).map(a => a.name).join(", ") || null;
    const genre = details.genres?.map(g => g.name).join(", ") || null;

    return {
      poster: `https://image.tmdb.org/t/p/w500${details.poster_path}`,
      title: details.title,
      badgeYear: details.release_date?.split("-")[0],
      rating: details.vote_average,
      runtime: `${details.runtime} min`,
      votes: details.vote_count,
      plot: details.overview,
      director,
      writer: writers,
      cast,
      genre,
      language: languageMap[details.original_language] || details.original_language || null,
    };

  } catch (error) {
    console.error(error);
    return null;
  }
}
