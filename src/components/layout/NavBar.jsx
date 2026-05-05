import { Search, User, Menu, X, LogOut, Film, Tv, Home } from "lucide-react";
import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSearch } from "../../contexts/SearchContext.jsx";
import { auth } from "../../firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";

const NavBar = () => {
  const { query, results, search, loading } = useSearch();
  const navigate  = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled]     = useState(false);
  const [user, setUser]             = useState(null);
  const searchRef = useRef(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => setUser(u));
    return () => unsub();
  }, []);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  // Close search dropdown on outside click
  useEffect(() => {
    const fn = e => { if (searchRef.current && !searchRef.current.contains(e.target)) search(""); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  const handleLogout = async () => {
    try { await signOut(auth); setIsMenuOpen(false); navigate("/login"); }
    catch (e) { console.error(e); }
  };

  const navLinks = [
    { label: "Home",     link: "/",       type: "all",   Icon: Home },
    { label: "Movies",   link: "/movies", type: "movie", Icon: Film },
    { label: "TV Shows", link: "/tv",     type: "tv",    Icon: Tv },
  ];

  const handleLinkClick = (path, type) => {
    navigate(path, { state: { filterType: type } });
    setIsMenuOpen(false);
    search("");
  };

  const avatar = user?.displayName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "?";
  const displayName = user?.displayName || user?.email?.split("@")[0] || "";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=Playfair+Display:ital,wght@1,700&display=swap');

        .nav-root { font-family: 'Sora', sans-serif; }

        /* Glass nav bar */
        .nav-bar {
          transition: background .35s ease, border-color .35s ease, box-shadow .35s ease;
        }
        .nav-bar-solid {
          background: rgba(8,8,8,0.92) !important;
          border-bottom-color: rgba(255,255,255,0.07) !important;
          box-shadow: 0 8px 32px rgba(0,0,0,0.55) !important;
          backdrop-filter: blur(28px);
        }
        .nav-bar-top {
          background: linear-gradient(to bottom, rgba(8,8,8,0.88) 0%, transparent 100%);
          border-bottom-color: transparent !important;
          backdrop-filter: blur(0px);
        }

        /* Nav link */
        .nav-link {
          position: relative;
          font-size: 10px; font-weight: 600; letter-spacing: .1em; text-transform: uppercase;
          color: rgba(255,255,255,0.42);
          transition: color .2s ease;
          cursor: pointer;
          padding: 4px 0;
        }
        .nav-link::after {
          content: '';
          position: absolute; bottom: -2px; left: 0;
          height: 1.5px; width: 0;
          background: linear-gradient(90deg, #d4a853, #f0c070);
          border-radius: 9999px;
          transition: width .25s cubic-bezier(.4,0,.2,1);
        }
        .nav-link:hover { color: rgba(255,255,255,0.85); }
        .nav-link:hover::after { width: 100%; }

        /* Search */
        .nav-search {
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.09);
          border-radius: 10px;
          padding: 8px 14px 8px 36px;
          color: white; font-size: 12px;
          font-family: 'Sora', sans-serif;
          outline: none; width: 100%;
          transition: border-color .2s, background .2s, width .3s ease;
        }
        .nav-search::placeholder { color: rgba(255,255,255,0.2); font-size: 11px; }
        .nav-search:focus {
          border-color: rgba(212,168,83,0.45);
          background: rgba(212,168,83,0.04);
        }

        /* Results dropdown */
        .search-dropdown {
          background: rgba(10,10,10,0.98);
          border: 1px solid rgba(255,255,255,0.08);
          backdrop-filter: blur(28px);
          border-radius: 14px;
          box-shadow: 0 24px 60px rgba(0,0,0,0.75);
          overflow: hidden;
        }
        .search-result-item {
          display: flex; align-items: center; gap: 12px;
          padding: 10px 14px;
          border-bottom: 1px solid rgba(255,255,255,0.05);
          transition: background .15s;
          cursor: pointer;
        }
        .search-result-item:hover { background: rgba(212,168,83,0.07); }
        .search-result-item:last-child { border-bottom: none; }

        /* Avatar */
        .user-avatar {
          width: 34px; height: 34px; border-radius: 10px;
          background: linear-gradient(135deg, #d4a853, #b8892f);
          display: flex; align-items: center; justify-content: center;
          font-size: 12px; font-weight: 700; color: black;
          border: 1px solid rgba(212,168,83,0.3);
          transition: all .2s ease;
          cursor: pointer;
        }
        .user-avatar:hover { box-shadow: 0 4px 16px rgba(212,168,83,0.35); transform: translateY(-1px); }

        /* Login btn */
        .btn-login {
          display: flex; align-items: center; gap: 6px;
          padding: 7px 16px; border-radius: 10px;
          background: linear-gradient(135deg, #d4a853, #b8892f);
          color: black; font-size: 10px; font-weight: 700;
          letter-spacing: .08em; text-transform: uppercase;
          font-family: 'Sora', sans-serif;
          box-shadow: 0 4px 16px rgba(212,168,83,0.28);
          transition: all .2s cubic-bezier(.4,0,.2,1);
        }
        .btn-login:hover { box-shadow: 0 8px 24px rgba(212,168,83,0.45); transform: translateY(-1px); }

        /* Mobile drawer */
        .mobile-drawer {
          background: rgba(8,8,8,0.97);
          border-top: 1px solid rgba(255,255,255,0.06);
          backdrop-filter: blur(32px);
        }
        .mobile-nav-item {
          display: flex; align-items: center; gap-12px;
          padding: 14px 20px;
          font-size: 11px; font-weight: 600; letter-spacing: .1em; text-transform: uppercase;
          color: rgba(255,255,255,0.45);
          border-bottom: 1px solid rgba(255,255,255,0.05);
          transition: color .15s, background .15s;
          cursor: pointer;
          gap: 12px;
        }
        .mobile-nav-item:hover { color: white; background: rgba(255,255,255,0.03); }
        .mobile-nav-item-danger { color: rgba(239,68,68,0.65); }
        .mobile-nav-item-danger:hover { color: #fca5a5; }

        /* Wordmark */
        .wordmark {
          font-family: 'Playfair Display', serif;
          font-style: italic; font-weight: 700;
          font-size: 18px; color: white;
          letter-spacing: -.01em;
        }
        .wordmark span { color: #d4a853; }

        .no-sb::-webkit-scrollbar { display:none }
        .no-sb { -ms-overflow-style:none; scrollbar-width:none }

        @keyframes drawerIn {
          from { opacity:0; transform:translateY(-8px); }
          to   { opacity:1; transform:translateY(0); }
        }
        .drawer-in { animation: drawerIn .25s cubic-bezier(.4,0,.2,1) forwards; }
      `}</style>

      <nav
        className={`nav-root nav-bar fixed top-0 left-0 w-full z-[100] px-5 md:px-10 lg:px-16 py-3.5 flex items-center justify-between border-b ${scrolled ? "nav-bar-solid" : "nav-bar-top"}`}>

        {/* ── Left: Wordmark + Desktop links ─────────────────────────────── */}
        <div className="flex items-center gap-8">
          {/* Wordmark */}
          <button onClick={() => handleLinkClick("/", "all")} className="wordmark flex-shrink-0">
            Crystal<span>.</span>
          </button>

          {/* Desktop nav links */}
          <ul className="hidden lg:flex items-center gap-7">
            {navLinks.map(({ label, link, type }) => (
              <li key={label} className="nav-link" onClick={() => handleLinkClick(link, type)}>
                {label}
              </li>
            ))}
          </ul>
        </div>

        {/* ── Right: Search + Auth ────────────────────────────────────────── */}
        <div className="flex items-center gap-3 flex-1 justify-end max-w-lg">

          {/* Search */}
          <div ref={searchRef} className="relative flex-1 max-w-[240px]">
            <input
              type="text"
              value={query}
              onChange={e => search(e.target.value)}
              placeholder="Search titles…"
              className="nav-search"
            />
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25 pointer-events-none" />

            {/* Dropdown */}
            {query && (
              <div className="search-dropdown absolute top-full mt-2 right-0 w-[88vw] max-w-sm z-[120] max-h-[60vh] overflow-y-auto no-sb">
                {loading ? (
                  <div className="flex items-center justify-center gap-3 py-6">
                    <div className="w-5 h-5 rounded-full border-t-amber-400 border-r-transparent border-b-transparent border-l-transparent border-[1.5px] animate-spin" />
                    <span className="text-[10px] text-white/25 uppercase tracking-widest">Searching…</span>
                  </div>
                ) : results.length > 0 ? (
                  results.map(item => (
                    <Link
                      key={item.id}
                      to={`/movie/${item.id}/${item.mediaType}`}
                      onClick={() => search("")}
                      className="search-result-item"
                    >
                      <div className="w-8 h-12 rounded-lg overflow-hidden flex-none bg-white/5 border border-white/08">
                        {item.poster && <img src={item.poster} alt="" className="w-full h-full object-cover" />}
                      </div>
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-white text-[11px] font-semibold truncate">{item.title}</span>
                        <span className="text-[9px] font-medium uppercase tracking-wider mt-0.5" style={{ color: "#d4a853" }}>
                          {item.mediaType === "tv" ? "Series" : "Film"} · {item.year}
                        </span>
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className="py-8 text-center text-[10px] text-white/22 uppercase tracking-widest">No results found</div>
                )}
              </div>
            )}
          </div>

          {/* Auth */}
          {!user ? (
            <Link to="/login">
              <button className="btn-login">
                <User size={12} /> Login
              </button>
            </Link>
          ) : (
            <div className="flex items-center gap-2.5">
              {/* Name (desktop) */}
              <div className="hidden md:flex flex-col items-end leading-none">
                <span className="text-[8px] text-white/20 uppercase tracking-widest mb-0.5">Account</span>
                <span className="text-[10px] text-white/60 font-semibold truncate max-w-[90px]">{displayName}</span>
              </div>

              {/* Avatar */}
              <Link to="/profile" title="Profile">
                <div className="user-avatar">{avatar}</div>
              </Link>

              {/* Logout (desktop) */}
              <button onClick={handleLogout}
                className="hidden lg:flex items-center gap-1.5 text-[10px] text-white/22 hover:text-white/55 uppercase tracking-wider transition-colors">
                <LogOut size={12} /> Out
              </button>
            </div>
          )}

          {/* Hamburger */}
          <button
            onClick={() => setIsMenuOpen(o => !o)}
            className="lg:hidden w-8 h-8 flex items-center justify-center rounded-lg text-white/45 hover:text-white transition-colors"
            style={{ border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)" }}>
            {isMenuOpen ? <X size={15} /> : <Menu size={15} />}
          </button>
        </div>
      </nav>

      {/* ── Mobile drawer ─────────────────────────────────────────────────── */}
      {isMenuOpen && (
        <div className="mobile-drawer drawer-in fixed top-[57px] left-0 w-full z-[99] lg:hidden">
          {/* User info strip */}
          {user && (
            <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(212,168,83,0.04)" }}>
              <div className="user-avatar text-sm">{avatar}</div>
              <div>
                <p className="text-[11px] font-semibold text-white/70">{displayName}</p>
                <p className="text-[9px] text-white/25 uppercase tracking-wider">Signed in</p>
              </div>
            </div>
          )}

          <ul>
            {navLinks.map(({ label, link, type, Icon }) => (
              <li key={label} className="mobile-nav-item" onClick={() => handleLinkClick(link, type)}>
                <Icon size={13} className="flex-shrink-0" style={{ color: "#d4a853" }} />
                {label}
              </li>
            ))}

            {user && (
              <li className="mobile-nav-item" onClick={() => handleLinkClick("/profile", "profile")}>
                <User size={13} className="flex-shrink-0" style={{ color: "#d4a853" }} />
                My Profile
              </li>
            )}

            {!user ? (
              <li className="mobile-nav-item" onClick={() => handleLinkClick("/login", "login")} style={{ color: "#d4a853" }}>
                <User size={13} className="flex-shrink-0" /> Sign In
              </li>
            ) : (
              <li className="mobile-nav-item mobile-nav-item-danger" onClick={handleLogout}>
                <LogOut size={13} className="flex-shrink-0" /> Sign Out
              </li>
            )}
          </ul>
        </div>
      )}
    </>
  );
};

export default NavBar;