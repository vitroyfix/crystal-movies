import React, { useState, useEffect, useRef } from "react";
import {
  User, LogOut, Clock, Star, Film, Play, Trash2,
  Inbox, ArrowLeft, List, Activity, Mail, Calendar,
  ChevronRight, Bookmark, History, Tv,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { auth } from "../firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { supabase } from "../services/supabaseClient";

const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";

const extractNumericId = (mediaId) => {
  const match = mediaId.toString().match(/\d+/);
  return match ? match[0] : mediaId.toString();
};

const getPosterUrl = (path, size = "w780") => {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  const cleanPath = path.startsWith("/") ? path.substring(1) : path;
  return `${TMDB_IMAGE_BASE}/${size}/${cleanPath}`;
};

const formatDate = (dateString) => {
  if (!dateString) return "N/A";
  return new Date(dateString).toLocaleDateString("en-US", { month: "long", year: "numeric" });
};

// ── Stat Card ─────────────────────────────────────────────────────────────────
const StatCard = ({ icon: Icon, label, value, accent = "#d4a853" }) => (
  <div className="stat-card p-4 md:p-5 rounded-2xl">
    <div className="flex items-center gap-3">
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: accent + "15", border: `1px solid ${accent}30` }}
      >
        <Icon size={15} style={{ color: accent }} />
      </div>
      <div>
        <p className="text-[8px] uppercase tracking-[0.38em] font-semibold text-white/22 mb-0.5">{label}</p>
        <p className="text-lg font-bold text-white/85 leading-none">{value}</p>
      </div>
    </div>
  </div>
);

// ── Empty State ───────────────────────────────────────────────────────────────
const EmptyState = ({ message, icon: Icon = Inbox }) => (
  <div className="flex flex-col items-center justify-center py-14 px-6 rounded-2xl"
    style={{ background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.08)" }}>
    <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
      style={{ background: "rgba(212,168,83,0.07)", border: "1px solid rgba(212,168,83,0.15)" }}>
      <Icon size={20} className="text-amber-400/40" />
    </div>
    <p className="text-[9px] uppercase tracking-[0.38em] font-semibold text-white/22">{message}</p>
  </div>
);

// ── Nav Tab ───────────────────────────────────────────────────────────────────
const NavTab = ({ id, icon: Icon, label, active, onClick }) => (
  <button
    onClick={() => onClick(id)}
    className={`nav-tab flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-[10px] font-semibold uppercase tracking-[0.1em] transition-all whitespace-nowrap ${active ? "nav-tab-active" : "nav-tab-inactive"}`}
  >
    <Icon size={13} />
    {label}
  </button>
);

// ── Main Component ────────────────────────────────────────────────────────────
const Profile = () => {
  const [userProgress, setUserProgress] = useState([]);
  const [watchlist, setWatchlist]       = useState([]);
  const [activeTab, setActiveTab]       = useState("history");
  const [currentUser, setCurrentUser]   = useState(null);
  const [loading, setLoading]           = useState(true);
  const navigate = useNavigate();

  const historyRef  = useRef(null);
  const watchlistRef = useRef(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) { setCurrentUser(user); fetchUserData(user.uid); }
      else navigate("/login");
      setLoading(false);
    });
    return () => unsub();
  }, [navigate]);

  const fetchUserData = async (userId) => {
    try {
      const { data: progressData, error: pError } = await supabase
        .from("user_progress").select("*").eq("user_id", userId)
        .order("last_updated", { ascending: false });
      if (pError) throw pError;

      const mediaMap = new Map();
      (progressData || []).forEach((item) => {
        if (item.type === "movie") {
          if (!mediaMap.has(item.media_id)) mediaMap.set(item.media_id, item);
        } else if (item.type === "tv") {
          const seriesId = extractNumericId(item.media_id);
          if (!mediaMap.has(seriesId)) mediaMap.set(seriesId, item);
          else {
            const ex = mediaMap.get(seriesId);
            if (item.season > ex.season || (item.season === ex.season && item.episode > ex.episode))
              mediaMap.set(seriesId, item);
          }
        }
      });

      const progressArray = await Promise.all(
        Array.from(mediaMap.values()).map(async (item) => {
          if (item.time <= 0) return null;
          const baseId = extractNumericId(item.media_id);
          const details = await getMediaDetails(baseId, item.type);
          return { ...item, id: baseId, mediaType: item.type, fullMediaId: item.id, poster: item.poster || details.poster, duration: details.duration };
        })
      );
      setUserProgress(progressArray.filter(Boolean));

      const { data: watchlistData, error: wError } = await supabase
        .from("watchlist").select("*").eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (wError) throw wError;

      if (Array.isArray(watchlistData)) {
        const enriched = await Promise.all(watchlistData.map(async (item) => {
          const cleanId = extractNumericId(item.media_id.toString());
          if (!item.poster) {
            const details = await getMediaDetails(cleanId, item.type || "movie");
            return { ...item, poster: details.poster, id: cleanId };
          }
          return { ...item, id: cleanId };
        }));
        setWatchlist(enriched);
      }
    } catch {}
  };

  const getMediaDetails = async (id, type) => {
    try {
      const tmdbUrl = `https://api.themoviedb.org/3/${type}/${id}`;
      const proxyUrl = `/api/proxy?url=${encodeURIComponent(tmdbUrl)}`;
      const data = await fetch(proxyUrl).then((r) => r.json());
      const runtimeMinutes = type === "movie" ? (data.runtime || 120) : (data.episode_run_time?.[0] || 45);
      return { poster: data.poster_path, duration: runtimeMinutes * 60 };
    } catch { return { poster: null, duration: 7200 }; }
  };

  const scrollTo = (ref) => {
    if (!ref.current) return;
    const top = ref.current.getBoundingClientRect().top + window.scrollY - 100;
    window.scrollTo({ top, behavior: "smooth" });
  };

  const handleTabClick = (id) => {
    setActiveTab(id);
    if (id === "history") scrollTo(historyRef);
    if (id === "watchlist") scrollTo(watchlistRef);
  };

  const handleDeleteWatchlist = async (e, item) => {
    e.stopPropagation();
    if (!window.confirm(`Remove ${item.title}?`)) return;
    try {
      const { error } = await supabase.from("watchlist").delete()
        .eq("user_id", currentUser.uid).eq("media_id", item.media_id || item.id);
      if (!error) setWatchlist((p) => p.filter((i) => i.id !== item.id));
    } catch {}
  };

  const handleDeleteProgress = async (e, supabaseRowId) => {
    e.stopPropagation();
    if (!window.confirm("Remove from history?")) return;
    try {
      const { error } = await supabase.from("user_progress").delete().eq("id", supabaseRowId);
      if (!error) setUserProgress((p) => p.filter((i) => i.fullMediaId !== supabaseRowId));
    } catch {}
  };

  const handleLogout = async () => { await signOut(auth); navigate("/login"); };

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-[#080808] flex items-center justify-center" style={{ fontFamily: "'Sora', sans-serif" }}>
      <div className="flex flex-col items-center gap-5">
        <div className="relative w-14 h-14">
          <div className="absolute inset-0 rounded-full border border-amber-400/20 animate-ping" />
          <div className="w-14 h-14 rounded-full border-[1.5px] border-t-amber-400 border-r-transparent border-b-transparent border-l-transparent animate-spin" />
        </div>
        <p className="text-[9px] uppercase tracking-[0.4em] text-white/20 font-medium">Loading profile…</p>
      </div>
    </div>
  );

  const totalMinutes = Math.ceil(userProgress.reduce((a, c) => a + (c.time || 0), 0) / 60);

  return (
    <div className="min-h-screen bg-[#080808] text-white" style={{ fontFamily: "'Sora', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=Playfair+Display:ital,wght@0,700;0,900;1,400;1,700&display=swap');
        :root { --gold:#d4a853; --glass:rgba(255,255,255,0.03); --glass2:rgba(255,255,255,0.06); --border:rgba(255,255,255,0.07); --border2:rgba(255,255,255,0.13); }
        .font-display { font-family:'Playfair Display',serif; }
        .no-scrollbar::-webkit-scrollbar { display:none; } .no-scrollbar { -ms-overflow-style:none; scrollbar-width:none; }
        .thin-scroll::-webkit-scrollbar { width:2px; } .thin-scroll::-webkit-scrollbar-track { background:transparent; } .thin-scroll::-webkit-scrollbar-thumb { background:#d4a853; border-radius:9px; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        .a1{animation:fadeUp .55s ease .05s both}.a2{animation:fadeUp .55s ease .15s both}.a3{animation:fadeUp .55s ease .25s both}.a4{animation:fadeUp .55s ease .35s both}
        .stat-card { background:var(--glass); border:1px solid var(--border); transition:background .2s; }
        .stat-card:hover { background:var(--glass2); }
        .nav-tab { cursor:pointer; border:1px solid transparent; }
        .nav-tab-active { background:rgba(212,168,83,0.14); border-color:rgba(212,168,83,0.35); color:#d4a853; }
        .nav-tab-inactive { color:rgba(255,255,255,0.32); } .nav-tab-inactive:hover { background:rgba(255,255,255,0.04); color:rgba(255,255,255,0.65); }
        .divider { height:1px; background:linear-gradient(90deg,transparent,rgba(255,255,255,0.07) 30%,rgba(255,255,255,0.07) 70%,transparent); }
        .progress-card { background:var(--glass); border:1px solid var(--border); border-radius:16px; overflow:hidden; transition:all .3s cubic-bezier(.4,0,.2,1); cursor:pointer; }
        .progress-card:hover { background:var(--glass2); border-color:rgba(212,168,83,0.28); transform:translateY(-3px); box-shadow:0 14px 40px rgba(0,0,0,0.45); }
        .watchlist-card { border-radius:14px; overflow:hidden; border:1px solid rgba(255,255,255,0.06); transition:all .35s cubic-bezier(.4,0,.2,1); cursor:pointer; }
        .watchlist-card:hover { border-color:rgba(212,168,83,0.3); transform:translateY(-4px); box-shadow:0 16px 44px rgba(0,0,0,0.5); }
        .delete-btn { position:absolute; top:8px; right:8px; z-index:20; width:30px; height:30px; border-radius:50%; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.65); backdrop-filter:blur(8px); border:1px solid rgba(255,255,255,0.1); opacity:0; transition:all .2s; color:rgba(255,255,255,0.6); cursor:pointer; }
        .group:hover .delete-btn { opacity:1; }
        .delete-btn:hover { background:rgba(239,68,68,0.85); border-color:transparent; color:white; }
        .play-overlay { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.3); opacity:0; transition:opacity .25s; }
        .progress-card:hover .play-overlay { opacity:1; }
        .prog-bar { height:2px; background:linear-gradient(90deg,#d4a853,#f0c070); border-radius:0; }
        .back-btn { display:inline-flex; align-items:center; gap:6px; padding:7px 14px; border-radius:30px; font-size:10px; font-weight:600; letter-spacing:.08em; text-transform:uppercase; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.09); color:rgba(255,255,255,0.35); transition:all .2s; cursor:pointer; }
        .back-btn:hover { background:rgba(255,255,255,0.08); border-color:rgba(255,255,255,0.15); color:rgba(255,255,255,0.7); }
        .logout-btn { display:inline-flex; align-items:center; gap:6px; padding:7px 14px; border-radius:30px; font-size:10px; font-weight:600; letter-spacing:.08em; text-transform:uppercase; background:rgba(239,68,68,0.07); border:1px solid rgba(239,68,68,0.18); color:rgba(239,68,68,0.65); transition:all .2s; cursor:pointer; }
        .logout-btn:hover { background:rgba(239,68,68,0.14); border-color:rgba(239,68,68,0.4); color:#ef4444; }
        .section-label { font-size:8px; text-transform:uppercase; letter-spacing:.42em; font-weight:600; color:rgba(255,255,255,0.22); display:flex; align-items:center; gap:8px; }
        .section-label::before { content:''; display:inline-block; width:3px; height:3px; border-radius:50%; background:#d4a853; flex-shrink:0; }
        .avatar-ring { box-shadow: 0 0 0 1px rgba(212,168,83,0.25), 0 0 0 3px rgba(212,168,83,0.08), 0 24px 60px rgba(0,0,0,0.6); }
        .noise { position:fixed; inset:0; pointer-events:none; z-index:0; opacity:.025; background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"); background-size:180px; }
      `}</style>

      <div className="noise" />

      <div className="relative z-10 px-5 md:px-14 lg:px-20 pt-8 pb-24 max-w-7xl mx-auto space-y-10">

        {/* ── Back ─────────────────────────────────────────────────────────── */}
        <div className="a1 flex items-center justify-between">
          <button onClick={() => navigate("/")} className="back-btn">
            <ArrowLeft size={11} /> Home
          </button>
          <button onClick={handleLogout} className="logout-btn">
            <LogOut size={11} /> Sign Out
          </button>
        </div>

        {/* ── Hero / Profile card ─────────────────────────────────────────── */}
        <div className="a2 relative rounded-3xl overflow-hidden p-6 md:p-10"
          style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.08)" }}>
          {/* faint gold glow behind avatar */}
          <div className="absolute left-0 top-0 w-80 h-80 pointer-events-none"
            style={{ background: "radial-gradient(ellipse at 10% 30%, rgba(212,168,83,0.06) 0%, transparent 65%)" }} />

          <div className="relative flex flex-col sm:flex-row items-center sm:items-start gap-6 md:gap-8">
            {/* Avatar */}
            <div className="w-24 h-24 md:w-28 md:h-28 rounded-2xl overflow-hidden flex-shrink-0 avatar-ring">
              {currentUser?.photoURL
                ? <img src={currentUser.photoURL} alt="Avatar" className="w-full h-full object-cover" />
                : (
                  <div className="w-full h-full flex items-center justify-center"
                    style={{ background: "rgba(212,168,83,0.08)", border: "1px solid rgba(212,168,83,0.15)" }}>
                    <User size={32} className="text-amber-400/40" />
                  </div>
                )}
            </div>

            {/* Info */}
            <div className="flex-1 text-center sm:text-left space-y-3 min-w-0">
              <div>
                <p className="section-label justify-center sm:justify-start mb-2">Member</p>
                <h1 className="font-display font-bold text-white leading-none"
                  style={{ fontSize: "clamp(1.8rem, 4vw, 2.8rem)", fontStyle: "italic" }}>
                  {currentUser?.displayName || "Viewer"}
                </h1>
              </div>
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-2 sm:gap-5">
                <span className="flex items-center gap-1.5 text-[10px] text-white/35">
                  <Mail size={9} className="text-amber-400/50" />
                  {currentUser?.email}
                </span>
                <span className="flex items-center gap-1.5 text-[10px] text-white/35">
                  <Calendar size={9} className="text-amber-400/50" />
                  Joined {formatDate(currentUser?.metadata?.creationTime)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Stats row ───────────────────────────────────────────────────── */}
        <div className="a3 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard icon={History}   label="Watched"   value={userProgress.length} accent="#d4a853" />
          <StatCard icon={Clock}     label="Minutes"   value={`${totalMinutes}m`}  accent="#60a5fa" />
          <StatCard icon={Activity}  label="Activity"  value={userProgress.length > 0 ? "Active" : "New"} accent="#34d399" />
          <StatCard icon={Bookmark}  label="Watchlist" value={watchlist.length}    accent="#f87171" />
        </div>

        <div className="divider" />

        {/* ── Tabs + Content ──────────────────────────────────────────────── */}
        <div className="a4 space-y-10">
          {/* Tab nav */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-5 md:mx-0 px-5 md:px-0 pb-1">
            <NavTab id="history"   icon={History}  label="Continue Watching" active={activeTab === "history"}   onClick={handleTabClick} />
            <NavTab id="watchlist" icon={Bookmark} label="My List"           active={activeTab === "watchlist"} onClick={handleTabClick} />
          </div>

          {/* ── Continue Watching ─────────────────────────────────────────── */}
          <section ref={historyRef} className="space-y-5 scroll-mt-28">
            <p className="section-label">Continue Watching · {userProgress.length} titles</p>

            {userProgress.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {userProgress.map((item) => {
                  const pct = item.duration > 0 ? Math.min((item.time / item.duration) * 100, 100) : 0;
                  const poster = getPosterUrl(item.poster, "original");
                  return (
                    <div key={item.fullMediaId} className="progress-card group"
                      onClick={() => navigate(item.mediaType === "tv" ? `/details/tv/${item.id}` : `/details/movie/${item.id}`)}>
                      <div className="relative aspect-video">
                        {poster
                          ? <img src={poster} alt={item.title} className="w-full h-full object-cover" style={{ filter: "brightness(0.7)" }} />
                          : <div className="w-full h-full flex items-center justify-center" style={{ background: "#111" }}><Film size={28} className="text-white/15" /></div>}

                        {/* Play overlay */}
                        <div className="play-overlay">
                          <div className="w-12 h-12 rounded-full flex items-center justify-center"
                            style={{ background: "rgba(212,168,83,0.88)", boxShadow: "0 4px 20px rgba(212,168,83,0.4)" }}>
                            <Play size={16} fill="black" className="text-black ml-0.5" />
                          </div>
                        </div>

                        {/* Type badge */}
                        <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md text-[9px] font-bold tracking-wider"
                          style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.75)" }}>
                          {item.mediaType === "tv" ? <span className="flex items-center gap-1"><Tv size={8} /> S{item.season} · E{item.episode}</span> : <span className="flex items-center gap-1"><Film size={8} /> Movie</span>}
                        </div>

                        {/* Delete */}
                        <button className="delete-btn" onClick={(e) => handleDeleteProgress(e, item.fullMediaId)}>
                          <Trash2 size={12} />
                        </button>

                        {/* Progress bar */}
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/10">
                          <div className="prog-bar h-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>

                      <div className="p-3.5 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <h4 className="text-[11px] font-semibold text-white/80 truncate leading-tight">{item.title}</h4>
                          <p className="text-[9px] text-white/30 mt-0.5">{Math.floor(item.time / 60)}m watched</p>
                        </div>
                        <div className="flex-shrink-0 text-[9px] font-bold text-amber-400/60">
                          {Math.round(pct)}%
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState message="No watch history yet" icon={History} />
            )}
          </section>

          <div className="divider" />

          {/* ── My List ──────────────────────────────────────────────────── */}
          <section ref={watchlistRef} className="space-y-5 scroll-mt-28">
            <p className="section-label">My List · {watchlist.length} saved</p>

            {watchlist.length > 0 ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                {watchlist.map((item) => {
                  const poster = getPosterUrl(item.poster, "w500");
                  return (
                    <div key={item.id} className="watchlist-card group aspect-[2/3] relative bg-neutral-900"
                      onClick={() => navigate(`/details/${item.type || "movie"}/${item.id}`)}>
                      {poster
                        ? <img src={poster} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-600 ease-out" />
                        : <div className="w-full h-full flex items-center justify-center"><Film size={20} className="text-white/15" /></div>}

                      {/* Hover overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      <div className="absolute bottom-0 left-0 right-0 p-2.5 translate-y-1 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                        <p className="text-[9px] font-bold text-white truncate leading-tight">{item.title}</p>
                        <p className="text-[8px] text-white/40 mt-0.5">{item.year || (item.type === "tv" ? "Series" : "Movie")}</p>
                      </div>

                      {/* Play icon */}
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center"
                          style={{ background: "rgba(212,168,83,0.85)" }}>
                          <Play size={12} fill="black" className="text-black ml-0.5" />
                        </div>
                      </div>

                      {/* Delete */}
                      <button className="delete-btn" onClick={(e) => handleDeleteWatchlist(e, item)}>
                        <Trash2 size={11} />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState message="Your watchlist is empty" icon={Bookmark} />
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default Profile;