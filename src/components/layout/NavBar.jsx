import { Search, User } from "lucide-react";
import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSearch } from "../../contexts/SearchContext.jsx";

const NavBar = () => {
  const { query, results, search } = useSearch();
  const navigate = useNavigate();

  const navBarLinks = [
    { label: "Home", link: "/" },
    { label: "Movies", link: "/movies" },
    { label: "TV Shows", link: "/tv" },
    { label: "Top Rated", link: "/top-rated" },
    { label: "Recently Added", link: "/recent" },
  ];

  return (
    <nav className="fixed top-0 left-0 w-full z-50 bg-gradient-to-b from-black/70 to-transparent px-8 py-4 flex items-center justify-between">
      {/* Left Links */}
      <ul className="flex space-x-6 text-white font-medium">
        {navBarLinks.map((item, index) => (
          <li
            key={index}
            className="hover:text-yellow-400 transition cursor-pointer"
            onClick={() => navigate(item.link)}
          >
            {item.label}
          </li>
        ))}
      </ul>

      {/* Search + Profile */}
      <div className="flex items-center space-x-4">
        {/* Search Box */}
        <div className="relative w-72">
          <input
            type="text"
            value={query}
            onChange={(e) => search(e.target.value)}
            placeholder="Search movies, tv shows..."
            className="bg-gray-800/70 text-white rounded-full pl-10 pr-4 py-2 focus:outline-none placeholder-gray-400 w-full"
          />
          <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />

          {/* Dropdown Results */}
          {query && results.length > 0 && (
            <div className="absolute mt-2 w-full bg-gray-900/90 rounded-lg p-2 max-h-64 overflow-y-auto shadow-lg z-50">
              {results.map((item) => (
                <Link
                  key={item.id}
                  to={`/movie/${item.id}/${item.mediaType}`}
                  className="flex items-center space-x-3 p-2 hover:bg-gray-700/50 rounded cursor-pointer"
                >
                  {item.poster ? (
                    <img
                      src={item.poster}
                      alt={item.title}
                      className="w-8 h-12 object-cover rounded"
                    />
                  ) : (
                    <div className="w-8 h-12 bg-gray-700 rounded" />
                  )}
                  <div className="flex flex-col">
                    <span className="text-white text-sm font-medium">{item.title}</span>
                    <span className="text-xs text-gray-400">
                      {item.mediaType.toUpperCase()} ({item.year})
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Login Button */}
        <Link to="/login">
          <button className="bg-red-500 hover:bg-red-600 text-black px-4 py-2 rounded-lg font-semibold">
            Login
          </button>
        </Link>

        {/* Profile Icon */}
        <Link
          to="/profile"
          className="bg-gray-800 p-2 rounded-full hover:bg-gray-700"
        >
          <User className="text-white" />
        </Link>
      </div>
    </nav>
  );
};

export default NavBar;
