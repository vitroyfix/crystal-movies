import { Search, User, Menu, X, LogOut, Film, Tv, Home, ChevronRight } from "lucide-react";
import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSearch } from "../../contexts/SearchContext.jsx";
import { auth } from "../../firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";

const NAV_H = 57; // navbar height in px — used for positioning dropdowns

const NavBar = () => {
  const { query, results, search, loading } = useSearch();
  const navigate = useNavigate();

  const [isMenuOpen, setIsMenuOpen]             = useState(false);
  const [scrolled, setScrolled]                 = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [showResults, setShowResults]           = useState(false);
  const [user, setUser]                         = useState(null);

  const desktopInputRef = useRef(null);
  const mobileInputRef  = useRef(null);
  const dropdownRef     = useRef(null);
  const mobileDropRef   = useRef(null);

  // ── Auth ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => setUser(u));
    return () => unsub();
  }, []);

  // ── Scroll ────────────────────────────────────────────────────────────
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  // ── Show results whenever query is non-empty ──────────────────────────
  useEffect(() => {
    setShowResults(query.length > 0);
  }, [query]);

  // ── Body scroll lock when drawer open ────────────────────────────────
  useEffect(() => {
    document.body.style.overflow = isMenuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isMenuOpen]);

  // ── Auto-focus mobile input ───────────────────────────────────────────
  useEffect(() => {
    if (mobileSearchOpen) setTimeout(() => mobileInputRef.current?.focus(), 80);
  }, [mobileSearchOpen]);

  // ── Outside click — close results with delay so item clicks register ──
  useEffect(() => {
    const fn = (e) => {
      const inside =
        dropdownRef.current?.contains(e.target) ||
        mobileDropRef.current?.contains(e.target) ||
        desktopInputRef.current?.contains(e.target) ||
        mobileInputRef.current?.contains(e.target);
      if (!inside) setTimeout(() => setShowResults(false), 150);
    };
    document.addEventListener("mousedown", fn);
    document.addEventListener("touchstart", fn, { passive: true });
    return () => {
      document.removeEventListener("mousedown", fn);
      document.removeEventListener("touchstart", fn);
    };
  }, []);

  // ── Escape key ────────────────────────────────────────────────────────
  useEffect(() => {
    const fn = (e) => {
      if (e.key !== "Escape") return;
      setShowResults(false);
      setMobileSearchOpen(false);
      setIsMenuOpen(false);
      desktopInputRef.current?.blur();
      mobileInputRef.current?.blur();
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, []);

  // ── Handlers ──────────────────────────────────────────────────────────
  const handleLogout = async () => {
    try { await signOut(auth); setIsMenuOpen(false); navigate("/login"); }
    catch (e) { console.error(e); }
  };

  // Navigate WITHOUT clearing query — user returns to same search state
  const handleLinkClick = (path, type) => {
    navigate(path, { state: { filterType: type } });
    setIsMenuOpen(false);
    setShowResults(false);
  };

  const handleResultClick = (item) => {
    navigate(`/details/${item.mediaType}/${item.id}`);
    setShowResults(false);
    setMobileSearchOpen(false);
    setIsMenuOpen(false);
    // Intentionally NOT calling search("") — query is preserved
  };

  const clearSearch = () => {
    search("");
    setShowResults(false);
  };

  const navLinks = [
    { label: "Home",     link: "/",       type: "all",   Icon: Home },
    { label: "Movies",   link: "/movies", type: "movie", Icon: Film },
    { label: "TV Shows", link: "/tv",     type: "tv",    Icon: Tv },
  ];

  const avatar      = user?.displayName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "?";
  const displayName = user?.displayName || user?.email?.split("@")[0] || "";

  // ── Shared results list ───────────────────────────────────────────────
  // onMouseDown preventDefault stops the input losing focus before onClick fires
  const ResultsList = ({ onItemClick }) => (
    <div onMouseDown={e => e.preventDefault()}>
      {loading ? (
        <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:10, padding:"28px 16px" }}>
          <div style={{ width:18, height:18, borderRadius:"50%", border:"1.5px solid transparent", borderTopColor:"#d4a853", animation:"spin .7s linear infinite" }} />
          <span style={{ fontSize:10, color:"rgba(255,255,255,0.25)", textTransform:"uppercase", letterSpacing:"0.12em" }}>Searching…</span>
        </div>
      ) : results.length > 0 ? (
        results.map(item => (
          <div
            key={item.id}
            onClick={() => onItemClick(item)}
            style={{ display:"flex", alignItems:"center", gap:12, padding:"11px 16px", borderBottom:"1px solid rgba(255,255,255,0.05)", cursor:"pointer", transition:"background .12s", WebkitTapHighlightColor:"transparent", userSelect:"none" }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(212,168,83,0.08)"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            onTouchStart={e => e.currentTarget.style.background = "rgba(212,168,83,0.08)"}
            onTouchEnd={e  => e.currentTarget.style.background = "transparent"}
          >
            <div style={{ width:36, height:54, borderRadius:8, overflow:"hidden", flexShrink:0, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)" }}>
              {item.poster && <img src={item.poster} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} loading="lazy" />}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <p style={{ fontSize:12, fontWeight:600, color:"rgba(255,255,255,0.88)", marginBottom:4, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{item.title}</p>
              <p style={{ fontSize:9, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em", color:"#d4a853" }}>
                {item.mediaType === "tv" ? "Series" : "Film"}{item.year ? ` · ${item.year}` : ""}
              </p>
            </div>
            <ChevronRight size={12} style={{ color:"rgba(255,255,255,0.18)", flexShrink:0 }} />
          </div>
        ))
      ) : (
        <div style={{ padding:"32px 16px", textAlign:"center", fontSize:10, color:"rgba(255,255,255,0.22)", textTransform:"uppercase", letterSpacing:"0.12em" }}>
          No results for "{query}"
        </div>
      )}
    </div>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=Playfair+Display:ital,wght@1,700&display=swap');
        *, *::before, *::after { box-sizing: border-box; }

        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeDown {
          from { opacity:0; transform:translateY(-6px) scale(.98); }
          to   { opacity:1; transform:translateY(0) scale(1); }
        }
        @keyframes slideRight {
          from { opacity:0; transform:translateX(100%); }
          to   { opacity:1; transform:translateX(0); }
        }
        @keyframes mobileSearchIn {
          from { opacity:0; transform:translateY(-8px); }
          to   { opacity:1; transform:translateY(0); }
        }

        .nav-root { font-family:'Sora',sans-serif; }

        .nav-bar { transition: background .3s ease, border-color .3s ease, box-shadow .3s ease; }
        .nav-bar-solid {
          background: rgba(8,8,8,0.96) !important;
          border-bottom: 1px solid rgba(255,255,255,0.07) !important;
          box-shadow: 0 4px 40px rgba(0,0,0,0.6) !important;
          backdrop-filter: blur(32px) !important;
          -webkit-backdrop-filter: blur(32px) !important;
        }
        .nav-bar-top {
          background: linear-gradient(to bottom, rgba(8,8,8,0.82) 0%, transparent 100%);
          border-bottom: 1px solid transparent !important;
        }

        /* Desktop nav links */
        .nav-link {
          position:relative; font-size:10px; font-weight:600;
          letter-spacing:.1em; text-transform:uppercase;
          color:rgba(255,255,255,0.4); transition:color .2s;
          cursor:pointer; padding:4px 0; white-space:nowrap;
        }
        .nav-link::after {
          content:''; position:absolute; bottom:-2px; left:0;
          height:1.5px; width:0;
          background:linear-gradient(90deg,#d4a853,#f0c070);
          border-radius:9999px; transition:width .25s cubic-bezier(.4,0,.2,1);
        }
        .nav-link:hover { color:rgba(255,255,255,0.9); }
        .nav-link:hover::after { width:100%; }

        /* Search input */
        .search-input {
          background:rgba(255,255,255,0.05);
          border:1px solid rgba(255,255,255,0.09);
          border-radius:10px;
          padding:8px 34px 8px 36px;
          color:white; font-size:12px;
          font-family:'Sora',sans-serif;
          outline:none; width:100%;
          transition:border-color .2s, background .2s, box-shadow .2s;
        }
        .search-input::placeholder { color:rgba(255,255,255,0.2); font-size:11px; }
        .search-input:focus {
          border-color:rgba(212,168,83,0.5);
          background:rgba(212,168,83,0.04);
          box-shadow:0 0 0 3px rgba(212,168,83,0.08);
        }

        /* Results panel */
        .results-panel {
          background:rgba(8,8,8,0.99);
          border:1px solid rgba(255,255,255,0.1);
          border-radius:14px;
          box-shadow:0 24px 64px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.04);
          overflow-y:auto;
          overscroll-behavior:contain;
          -webkit-overflow-scrolling:touch;
          animation:fadeDown .18s cubic-bezier(.4,0,.2,1) forwards;
        }
        .results-panel::-webkit-scrollbar { width:3px; }
        .results-panel::-webkit-scrollbar-track { background:transparent; }
        .results-panel::-webkit-scrollbar-thumb { background:rgba(212,168,83,0.6); border-radius:9px; }

        .results-header {
          padding:9px 16px 8px;
          border-bottom:1px solid rgba(255,255,255,0.06);
          font-size:9px; font-weight:600;
          text-transform:uppercase; letter-spacing:.12em;
          color:rgba(255,255,255,0.22);
          position:sticky; top:0;
          background:rgba(8,8,8,0.99);
          z-index:1;
        }

        /* Avatar */
        .user-avatar {
          width:33px; height:33px; border-radius:9px;
          background:linear-gradient(135deg,#d4a853,#b8892f);
          display:flex; align-items:center; justify-content:center;
          font-size:13px; font-weight:700; color:black;
          border:1px solid rgba(212,168,83,0.3);
          transition:all .2s; cursor:pointer; flex-shrink:0;
        }
        .user-avatar:hover { box-shadow:0 4px 18px rgba(212,168,83,0.4); transform:translateY(-1px); }

        /* Login button */
        .btn-login {
          display:flex; align-items:center; gap:6px;
          padding:7px 15px; border-radius:9px;
          background:linear-gradient(135deg,#d4a853,#b8892f);
          color:black; font-size:10px; font-weight:700;
          letter-spacing:.08em; text-transform:uppercase;
          font-family:'Sora',sans-serif;
          box-shadow:0 4px 14px rgba(212,168,83,0.28);
          transition:all .2s cubic-bezier(.4,0,.2,1); white-space:nowrap; flex-shrink:0;
        }
        .btn-login:hover { box-shadow:0 8px 24px rgba(212,168,83,0.45); transform:translateY(-1px); }

        /* Icon buttons */
        .icon-btn {
          width:33px; height:33px; border-radius:9px;
          display:flex; align-items:center; justify-content:center;
          background:rgba(255,255,255,0.05);
          border:1px solid rgba(255,255,255,0.09);
          color:rgba(255,255,255,0.5);
          transition:all .2s; cursor:pointer; flex-shrink:0;
          -webkit-tap-highlight-color:transparent;
        }
        .icon-btn:hover { background:rgba(255,255,255,0.09); color:white; }
        .icon-btn:active { transform:scale(.94); }
        .icon-btn-on { background:rgba(212,168,83,0.12)!important; border-color:rgba(212,168,83,0.35)!important; color:#d4a853!important; }

        /* Wordmark */
        .wordmark {
          font-family:'Playfair Display',serif; font-style:italic; font-weight:700;
          font-size:20px; color:white; letter-spacing:-.01em; flex-shrink:0;
        }
        .wordmark span { color:#d4a853; }

        /* Mobile search bar */
        .mobile-search-bar {
          position:fixed; top:${NAV_H}px; left:0; right:0; z-index:97;
          padding:12px 16px;
          background:rgba(6,6,6,0.98);
          border-bottom:1px solid rgba(255,255,255,0.08);
          backdrop-filter:blur(32px); -webkit-backdrop-filter:blur(32px);
          animation:mobileSearchIn .2s cubic-bezier(.4,0,.2,1) forwards;
        }

        /* Mobile results — fixed so never clipped */
        .mobile-results-panel {
          position:fixed; left:0; right:0; z-index:96;
          border-radius:0 0 16px 16px;
          border-top:none;
          max-height:calc(100vh - ${NAV_H + 62}px);
          top:${NAV_H + 62}px;
        }

        /* Side drawer */
        .mobile-drawer {
          position:fixed; top:${NAV_H}px; right:0; bottom:0;
          width:min(300px,90vw); z-index:95;
          background:rgba(6,6,6,0.99);
          border-left:1px solid rgba(255,255,255,0.07);
          backdrop-filter:blur(32px); -webkit-backdrop-filter:blur(32px);
          overflow-y:auto; overscroll-behavior:contain; -webkit-overflow-scrolling:touch;
          animation:slideRight .25s cubic-bezier(.4,0,.2,1) forwards;
        }
        .drawer-backdrop {
          position:fixed; inset:0; z-index:94;
          background:rgba(0,0,0,0.5);
          backdrop-filter:blur(2px); -webkit-backdrop-filter:blur(2px);
        }
        .drawer-item {
          display:flex; align-items:center; gap:13px; padding:15px 22px;
          font-size:11px; font-weight:600; letter-spacing:.1em; text-transform:uppercase;
          color:rgba(255,255,255,0.45);
          border-bottom:1px solid rgba(255,255,255,0.05);
          cursor:pointer; transition:color .15s, background .15s;
          -webkit-tap-highlight-color:transparent; user-select:none;
        }
        .drawer-item:hover { color:white; background:rgba(255,255,255,0.03); }
        .drawer-item:active { background:rgba(255,255,255,0.06); }
        .drawer-item-danger { color:rgba(239,68,68,0.6); }
        .drawer-item-danger:hover { color:#fca5a5; background:rgba(239,68,68,0.04); }
        .drawer-section-label {
          padding:13px 22px 7px; font-size:9px; font-weight:600;
          text-transform:uppercase; letter-spacing:.14em; color:rgba(255,255,255,0.18);
        }

        /* Responsive helpers */
        @media (min-width:1024px) { .hide-lg { display:none!important; } }
        @media (max-width:1023px) { .show-lg { display:none!important; } }
        @media (min-width:768px)  { .hide-md { display:none!important; } }
        @media (max-width:767px)  { .show-md { display:none!important; } }
      `}</style>

      {/* ── Navbar ──────────────────────────────────────────────────────── */}
      <nav
        className={`nav-root nav-bar fixed top-0 left-0 w-full z-[100] ${scrolled ? "nav-bar-solid" : "nav-bar-top"}`}
        style={{ height:NAV_H, display:"flex", alignItems:"center", padding:"0 16px", gap:10 }}
      >
        {/* Wordmark */}
        <button onClick={() => handleLinkClick("/","all")} className="wordmark">Crystal<span>.</span></button>

        {/* Desktop nav links */}
        <ul className="show-lg" style={{ display:"flex", alignItems:"center", gap:24, listStyle:"none", padding:0, margin:"0 8px" }}>
          {navLinks.map(({ label, link, type }) => (
            <li key={label} className="nav-link" onClick={() => handleLinkClick(link, type)}>{label}</li>
          ))}
        </ul>

        <div style={{ flex:1 }} />

        {/* ── Desktop search (md and up) ──────────────────────────────── */}
        <div className="show-md" style={{ position:"relative", width:"100%", maxWidth:270, flexShrink:1 }}>
          <input
            ref={desktopInputRef}
            type="text" value={query}
            onChange={e => search(e.target.value)}
            onFocus={() => query && setShowResults(true)}
            placeholder="Search titles…"
            className="search-input"
          />
          <Search size={13} style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", color:"rgba(255,255,255,0.25)", pointerEvents:"none" }} />
          {query && (
            <button onClick={clearSearch} style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", color:"rgba(255,255,255,0.3)", padding:4, display:"flex", alignItems:"center" }}
              onMouseEnter={e => e.currentTarget.style.color="rgba(255,255,255,0.7)"}
              onMouseLeave={e => e.currentTarget.style.color="rgba(255,255,255,0.3)"}>
              <X size={12} />
            </button>
          )}
          {/* Desktop dropdown */}
          {showResults && query && (
            <div ref={dropdownRef} className="results-panel"
              style={{ position:"absolute", top:"calc(100% + 8px)", right:0, width:"max(100%, 340px)", maxHeight:"min(72vh,500px)", zIndex:200 }}>
              <div className="results-header">Results for "{query}"</div>
              <ResultsList onItemClick={handleResultClick} />
            </div>
          )}
        </div>

        {/* ── Mobile search icon (sm only) ────────────────────────────── */}
        <button
          className={`icon-btn hide-md ${mobileSearchOpen ? "icon-btn-on" : ""}`}
          onClick={() => { setMobileSearchOpen(o => !o); setIsMenuOpen(false); }}
          aria-label="Search"
        >
          {mobileSearchOpen ? <X size={15} /> : <Search size={15} />}
        </button>

        {/* Auth */}
        {!user ? (
          <Link to="/login"><button className="btn-login"><User size={12}/> Login</button></Link>
        ) : (
          <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
            <div className="show-lg" style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", lineHeight:1 }}>
              <span style={{ fontSize:8, color:"rgba(255,255,255,0.2)", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:2 }}>Account</span>
              <span style={{ fontSize:10, color:"rgba(255,255,255,0.6)", fontWeight:600, maxWidth:90, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{displayName}</span>
            </div>
            <Link to="/profile" title="Profile"><div className="user-avatar">{avatar}</div></Link>
            <button onClick={handleLogout} className="show-lg"
              style={{ display:"flex", alignItems:"center", gap:5, fontSize:10, color:"rgba(255,255,255,0.22)", textTransform:"uppercase", letterSpacing:"0.08em", transition:"color .2s", background:"none", border:"none", cursor:"pointer", padding:"4px 2px" }}
              onMouseEnter={e => e.currentTarget.style.color="rgba(255,255,255,0.6)"}
              onMouseLeave={e => e.currentTarget.style.color="rgba(255,255,255,0.22)"}>
              <LogOut size={12}/> Out
            </button>
          </div>
        )}

        {/* Hamburger */}
        <button
          className={`icon-btn hide-lg ${isMenuOpen ? "icon-btn-on" : ""}`}
          onClick={() => { setIsMenuOpen(o => !o); setMobileSearchOpen(false); }}
          aria-label="Menu"
        >
          {isMenuOpen ? <X size={15}/> : <Menu size={15}/>}
        </button>
      </nav>

      {/* ── Mobile search bar — slides in below navbar ───────────────────── */}
      {mobileSearchOpen && (
        <div className="mobile-search-bar hide-md">
          <div style={{ position:"relative" }}>
            <input
              ref={mobileInputRef}
              type="text" value={query}
              onChange={e => search(e.target.value)}
              onFocus={() => query && setShowResults(true)}
              placeholder="Search movies & TV shows…"
              className="search-input"
              style={{ fontSize:13, padding:"10px 36px 10px 40px" }}
            />
            <Search size={15} style={{ position:"absolute", left:13, top:"50%", transform:"translateY(-50%)", color:"rgba(255,255,255,0.3)", pointerEvents:"none" }} />
            {query && (
              <button onClick={clearSearch} style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", color:"rgba(255,255,255,0.35)", padding:4, display:"flex", alignItems:"center" }}>
                <X size={14}/>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Mobile results panel — fixed, scrollable ─────────────────────── */}
      {mobileSearchOpen && showResults && query && (
        <div ref={mobileDropRef} className="results-panel mobile-results-panel hide-md">
          <div className="results-header">Results for "{query}"</div>
          <ResultsList onItemClick={handleResultClick} />
        </div>
      )}

      {/* ── Drawer backdrop ──────────────────────────────────────────────── */}
      {isMenuOpen && (
        <div className="drawer-backdrop hide-lg" onClick={() => setIsMenuOpen(false)} />
      )}

      {/* ── Side drawer — nav + account, NO search ───────────────────────── */}
      {isMenuOpen && (
        <div className="mobile-drawer hide-lg">

          {/* User strip */}
          {user ? (
            <div style={{ display:"flex", alignItems:"center", gap:12, padding:"18px 22px", borderBottom:"1px solid rgba(255,255,255,0.07)", background:"rgba(212,168,83,0.04)" }}>
              <div className="user-avatar" style={{ width:40, height:40, fontSize:15, borderRadius:11 }}>{avatar}</div>
              <div style={{ minWidth:0 }}>
                <p style={{ fontSize:13, fontWeight:600, color:"rgba(255,255,255,0.8)", marginBottom:3, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{displayName}</p>
                <p style={{ fontSize:9, color:"rgba(255,255,255,0.25)", textTransform:"uppercase", letterSpacing:"0.1em" }}>Signed in</p>
              </div>
            </div>
          ) : (
            <div style={{ padding:"18px 22px", borderBottom:"1px solid rgba(255,255,255,0.07)" }}>
              <p style={{ fontSize:11, color:"rgba(255,255,255,0.3)", marginBottom:10 }}>Not signed in</p>
              <Link to="/login" onClick={() => setIsMenuOpen(false)}>
                <button className="btn-login" style={{ width:"100%", justifyContent:"center" }}><User size={13}/> Sign In</button>
              </Link>
            </div>
          )}

          <div className="drawer-section-label">Navigate</div>

          {navLinks.map(({ label, link, type, Icon }) => (
            <div key={label} className="drawer-item" onClick={() => handleLinkClick(link, type)}>
              <Icon size={14} style={{ color:"#d4a853", flexShrink:0 }}/> {label}
            </div>
          ))}

          {user && (
            <>
              <div style={{ height:1, background:"rgba(255,255,255,0.06)", margin:"6px 0" }} />
              <div className="drawer-section-label">Account</div>
              <div className="drawer-item" onClick={() => handleLinkClick("/profile","profile")}>
                <User size={14} style={{ color:"#d4a853", flexShrink:0 }}/> My Profile
              </div>
              <div className="drawer-item drawer-item-danger" onClick={handleLogout}>
                <LogOut size={14} style={{ flexShrink:0 }}/> Sign Out
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
};

export default NavBar;