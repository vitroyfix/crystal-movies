import React from "react";
import { Link } from "react-router-dom";
import { useSearch } from "../contexts/SearchContext.jsx";

const SearchResults = () => {
  const { results, loading } = useSearch();

  if (loading) return <div className="text-white p-4">Searching...</div>;
  if (!results.length) return null;

  return (
    <div className="bg-gray-900/90 rounded-lg p-2 max-h-64 overflow-y-auto shadow-lg absolute mt-2 w-full z-50">
      {results.map((item) => (
        <Link
          key={item.id}
          to={`/movie/${item.id}/${item.mediaType}`}
          className="flex items-center space-x-3 p-2 hover:bg-gray-700/50 rounded cursor-pointer"
        >
          {item.poster ? (
            <img
              src={item.poster}
              alt={item.title || item.name}
              className="w-8 h-12 object-cover rounded"
            />
          ) : (
            <div className="w-8 h-12 bg-gray-700 rounded" />
          )}
          <span className="text-white text-sm">{item.title || item.name}</span>
          <span className="text-xs text-gray-400">({item.mediaType})</span>
        </Link>
      ))}
    </div>
  );
};

export default SearchResults;
