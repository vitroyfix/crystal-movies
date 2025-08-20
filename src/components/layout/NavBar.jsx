import { Search, User } from "lucide-react";
import React from "react";
import { Link } from "react-router-dom";

const NavBar = () => {
  const navBarLinks = [
    { label: "Home", link: "#" },
    { label: "Movies", link: "#" },
    { label: "TV Shows", link: "#" },
    { label: "Top Rated", link: "#" },
    { label: "Recently Added", link: "#" },
  ];

  return (
    <nav className="fixed top-0 left-0 w-full z-50 bg-gradient-to-b from-black/70 to-transparent px-8 py-4 flex items-center justify-between">
      {/* Left Links */}
      <ul className="flex space-x-6 text-white font-medium">
        {navBarLinks.map((item, index) => (
          <li key={index} className="hover:text-yellow-400 transition">
            <a href={item.link}>{item.label}</a>
          </li>
        ))}
      </ul>

      {/* Search + Profile */}
      <div className="flex items-center space-x-4">
        <div className="relative">
          <input
            type="text"
            placeholder="Search movies, tv shows..."
            className="bg-gray-800/70 text-white rounded-full pl-10 pr-4 py-2 focus:outline-none placeholder-gray-400"
          />
          <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
        </div>

        <Link to="/login">
          <button className="bg-red-500 hover:bg-red-600 text-black px-4 py-2 rounded-lg font-semibold">
            Login
          </button>
        </Link>

        <Link to="/profile" className="bg-gray-800 p-2 rounded-full hover:bg-gray-700">
          <User className="text-white" />
        </Link>
      </div>
    </nav>
  );
};

export default NavBar;
