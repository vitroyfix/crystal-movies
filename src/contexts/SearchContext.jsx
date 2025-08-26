import React, { createContext, useContext, useState, useEffect } from "react";

const SearchContext = createContext();

export const useSearch = () => useContext(SearchContext);

export const SearchProvider = ({ children }) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query) {
      setResults([]);
      return;
    }

    const debounce = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `${import.meta.env.VITE_BASE_URL}/search/multi?api_key=${import.meta.env.VITE_TMDB_API_KEY}&language=en-US&query=${encodeURIComponent(
            query
          )}&page=1&include_adult=false`
        );
        if (!res.ok) throw new Error("Failed to search");
        const data = await res.json();

                const filtered = (data.results || [])
          .filter((item) => item.media_type === "movie" || item.media_type === "tv")
          .map((item) => ({
            id: item.id,
            title: item.title || item.name,
            poster: item.poster_path
              ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
              : "/no-poster.png",
            mediaType: item.media_type,
            year:
              (item.release_date?.split("-")[0]) ||
              (item.first_air_date?.split("-")[0]) ||
              "N/A",
          }));

        setResults(filtered);
      } catch (err) {
        console.error("Search error:", err);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300); 

    return () => clearTimeout(debounce);
  }, [query]);

  const search = (value) => setQuery(value);

  return (
    <SearchContext.Provider value={{ query, results, search, loading }}>
      {children}
    </SearchContext.Provider>
  );
};
