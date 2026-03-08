import { Search, User, Menu, X, Film, LogOut, LogIn } from "lucide-react";
import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSearch } from "../../contexts/SearchContext.jsx";
// Import firebase auth
import { auth } from "../../firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";

const NavBar = () => {
  const { query, results, search, loading } = useSearch();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  // Track authenticated user
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setIsMenuOpen(false); 
      navigate("/login");
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  const navBarLinks = [
    { label: "Home", link: "/" },
    { label: "Movies", link: "/movies" },
    { label: "TV Shows", link: "/tv" },
    { label: "Top Rated", link: "/top-rated" },
    { label: "Recently Added", link: "/recent" },
  ];

  const handleLinkClick = (path) => {
    navigate(path);
    setIsMenuOpen(false);
    search(""); 
  };

  return (
    <nav className="fixed top-0 left-0 w-full z-[100] bg-gradient-to-b from-black/95 via-black/80 to-transparent backdrop-blur-md px-4 md:px-8 py-3 md:py-4 flex items-center justify-between transition-all duration-300">
      
      {/* LEFT: Mobile Menu & Desktop Links */}
      <div className="flex items-center">
        <button 
          className="text-white mr-3 lg:hidden p-1.5 hover:bg-white/10 rounded-sm" 
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
          {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>

        <ul className="hidden lg:flex space-x-6 text-white font-medium text-sm">
          {navBarLinks.map((item, index) => (
            <li
              key={index}
              className="hover:text-red-500 transition cursor-pointer uppercase tracking-[0.2em] font-black text-[11px]"
              onClick={() => handleLinkClick(item.link)}
            >
              {item.label}
            </li>
          ))}
        </ul>
      </div>

      {/* RIGHT: Search + Auth State (Login vs Profile) */}
      <div className="flex items-center space-x-2 md:space-x-4 flex-1 justify-end">
        
        {/* Search Input */}
        <div className="relative w-full max-w-[110px] xs:max-w-[150px] sm:max-w-[200px] md:max-w-72 transition-all">
          <input
            type="text"
            value={query}
            onChange={(e) => search(e.target.value)}
            placeholder="Search..."
            className="bg-zinc-900/80 text-white rounded-full pl-8 md:pl-9 pr-4 py-1.5 md:py-2 focus:outline-none focus:ring-1 focus:ring-red-600 placeholder-gray-500 w-full text-[10px] md:text-sm border border-white/10"
          />
          <Search className="absolute left-2.5 top-2 md:top-2.5 text-gray-500" size={14} />
          
          {/* Results Dropdown (Scoped code) */}
          {query && (
            <div className="absolute mt-3 -right-2 md:right-0 w-[85vw] max-w-[320px] bg-zinc-950 border border-white/10 rounded-sm shadow-2xl z-[110] max-h-[60vh] overflow-y-auto no-scrollbar">
              {loading ? (
                <div className="p-4 text-center text-red-600 animate-pulse font-black uppercase text-[9px]">Searching...</div>
              ) : results.length > 0 ? (
                results.map((item) => (
                  <Link key={item.id} to={`/movie/${item.id}/${item.mediaType}`} onClick={() => search("")} className="flex items-center gap-3 p-3 hover:bg-white/5 border-b border-white/5">
                    <div className="w-8 h-12 bg-zinc-800 rounded-sm overflow-hidden flex-none">
                      {item.poster && <img src={item.poster} alt="" className="w-full h-full object-cover" />}
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-white text-[10px] font-bold uppercase truncate">{item.title}</span>
                      <span className="text-[8px] text-red-600 font-black uppercase">{item.mediaType} • {item.year}</span>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="p-6 text-center text-gray-500 text-[9px] font-black uppercase">No Results</div>
              )}
            </div>
          )}
        </div>

        {/* AUTH LOGIC: Login Button or Profile Link */}
        {!user ? (
          <Link to="/login">
            <button className="bg-red-600 hover:bg-red-700 text-white px-3 md:px-5 py-1.5 md:py-2 rounded-sm font-black text-[9px] md:text-[10px] uppercase tracking-widest transition-all flex items-center gap-2">
            login
              <span className="hidden xs:inline">Login</span>
            </button>
          </Link>
        ) : (
          <div className="flex items-center gap-2 md:gap-3">
            {/* User Name/Badge (Desktop) */}
            <div className="hidden md:flex flex-col items-end leading-none">
              <span className="text-[7px] text-gray-500 font-black uppercase tracking-widest mb-0.5">Account</span>
              <span className="text-[9px] text-white font-black uppercase truncate max-w-[90px]">
                {user.displayName || user.email?.split('@')[0]}
              </span>
            </div>
            
            {/* Profile Avatar Button */}
            <Link
              to="/profile"
              className="bg-zinc-800/80 p-2 rounded-full hover:bg-red-600 transition-colors border border-white/5 flex items-center justify-center"
              title="Visit Profile"
            >
              <User className="text-white" size={16} />
            </Link>

            {/* Logout (Desktop Only) */}
            <button 
              onClick={handleLogout}
              className="hidden lg:block p-2 hover:text-red-600 text-gray-500 transition-colors"
            >
              Logout
            </button>
          </div>
        )}
      </div>

      {/* MOBILE MENU DRAWER */}
      {isMenuOpen && (
        <div className="absolute top-full left-0 w-full bg-zinc-950/98 backdrop-blur-2xl border-t border-white/10 lg:hidden shadow-2xl">
          <ul className="flex flex-col p-4 space-y-1 text-white font-black uppercase tracking-[0.2em] text-[10px]">
            {navBarLinks.map((item, index) => (
              <li key={index} className="py-4 border-b border-white/5 px-4 active:bg-white/5" onClick={() => handleLinkClick(item.link)}>
                {item.label}
              </li>
            ))}
            
            {/* Profile link inside mobile menu if logged in */}
            {user && (
               <li className="py-4 border-b border-white/5 px-4 text-white flex items-center justify-between" onClick={() => handleLinkClick("/profile")}>
                <span>My Profile</span>
                <User size={14} />
              </li>
            )}

            {!user ? (
              <li className="py-4 text-red-600 px-4" onClick={() => handleLinkClick("/login")}>
                Initialize Session
              </li>
            ) : (
              <li className="py-4 text-red-600 px-4 flex items-center justify-between" onClick={handleLogout}>
                <span>Terminate Session</span>
                <LogOut size={14} />
              </li>
            )}
          </ul>
        </div>
      )}

      <style jsx="true">{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </nav>
  );
};

export default NavBar;