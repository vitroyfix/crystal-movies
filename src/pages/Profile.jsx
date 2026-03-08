import React, { useState, useEffect, useRef } from "react";
import { 
  User, Settings, CreditCard, Shield, Monitor, 
  LogOut, Clock, Star, Film, ChevronRight, 
  Activity, Mail, Calendar, Edit2, Smartphone, List, Play, Trash2,
  Inbox, Home
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { auth } from "../firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
// Updated path to resolve resolution errors
import { supabase } from "../services/supabaseClient"; 

const Profile = () => {
  const [userProgress, setUserProgress] = useState([]);
  const [watchlist, setWatchlist] = useState([]); 
  const [activeTab, setActiveTab] = useState("overview");
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const overviewRef = useRef(null);
  const watchlistRef = useRef(null);

  // Using VITE_ prefix for environment variables to work with Vite/Vercel
  const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY; 
  const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(user);
        fetchUserData(user.uid);
      } else {
        navigate("/login");
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [navigate]);

  const fetchUserData = async (userId) => {
    try {
      const { data: progressData, error: pError } = await supabase
        .from('user_progress')
        .select('*')
        .eq('user_id', userId)
        .order('last_updated', { ascending: false });

      if (pError) throw pError;

      const progressArray = await Promise.all((progressData || []).map(async (item) => {
        if (item.time <= 0) return null;
        
        // RESOLUTION: Extract numeric ID (e.g., 1084242) from prefixed media_id (e.g., movie_1084242)
        const parts = item.media_id.split('_');
        const baseId = parts.length > 1 ? parts[1] : parts[0];
        
        let poster = item.poster;
        if (!poster) poster = await getPosterFromId(baseId, item.type);
        
        return { 
          ...item,
          id: baseId, // Clean TMDb numeric ID for URLs
          mediaType: item.type, 
          fullMediaId: item.id, // Internal Supabase UUID for DB deletion
          poster 
        };
      }));
      setUserProgress(progressArray.filter(Boolean));

      const { data: watchlistData, error: wError } = await supabase
        .from('watchlist')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (wError) throw wError;

      if (Array.isArray(watchlistData)) {
        const enrichedWatchlist = await Promise.all(watchlistData.map(async (item) => {
          const wParts = item.media_id.toString().split('_');
          const cleanWId = wParts.length > 1 ? wParts[1] : wParts[0];

          if (!item.poster) {
            const poster = await getPosterFromId(cleanWId, item.type || 'movie');
            return { ...item, poster, id: cleanWId };
          }
          return { ...item, id: cleanWId };
        }));
        setWatchlist(enrichedWatchlist);
      }
    } catch (err) { console.error("Could not load user data from Supabase", err); }
  };

  const getPosterFromId = async (id, type) => {
    try {
      const response = await fetch(`https://api.themoviedb.org/3/${type}/${id}?api_key=${TMDB_API_KEY}`);
      const data = await response.json();
      return data.poster_path;
    } catch (error) { return null; }
  };

  const handleSidebarClick = (id) => {
    setActiveTab(id);
    const element = id === 'overview' ? overviewRef.current : watchlistRef.current;
    if (element) {
      const offset = 100;
      const bodyRect = document.body.getBoundingClientRect().top;
      const elementRect = element.getBoundingClientRect().top;
      const elementPosition = elementRect - bodyRect;
      const offsetPosition = elementPosition - offset;

      window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
    }
  };

  const handleDeleteWatchlist = async (e, item) => {
    e.stopPropagation();
    if (!window.confirm(`Remove ${item.title}?`)) return;
    try {
      const { error } = await supabase
        .from('watchlist')
        .delete()
        .eq('user_id', currentUser.uid)
        .eq('media_id', item.media_id || item.id);

      if (!error) setWatchlist(prev => prev.filter(i => i.id !== item.id));
    } catch (err) { console.error(err); }
  };

  const handleDeleteProgress = async (e, supabaseRowId) => {
    e.stopPropagation();
    if (!window.confirm("Remove from history?")) return;
    try {
      const { error } = await supabase
        .from('user_progress')
        .delete()
        .eq('id', supabaseRowId);

      if (!error) setUserProgress(prev => prev.filter(item => item.fullMediaId !== supabaseRowId));
    } catch (err) { console.error(err); }
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login");
  };

  const getPosterUrl = (path, size = "w780") => {
    if (!path) return "https://via.placeholder.com/500x750?text=No+Poster";
    if (path.startsWith('http')) return path;
    const cleanPath = path.startsWith('/') ? path.substring(1) : path;
    return `${TMDB_IMAGE_BASE}/${size}/${cleanPath}`;
  };

  const StatCard = ({ icon: Icon, label, value }) => (
    <div className="bg-zinc-900/50 border border-white/5 p-4 md:p-6 rounded-xl hover:bg-zinc-900 transition-all group">
      <div className="flex items-center gap-3 md:gap-4">
        <div className="p-2 md:p-3 bg-red-600/10 rounded-lg group-hover:bg-red-600/20 transition-colors">
          <Icon className="text-red-600" size={18} />
        </div>
        <div>
          <p className="text-[9px] md:text-[10px] uppercase tracking-widest text-zinc-500 font-bold">{label}</p>
          <p className="text-lg md:text-xl font-serif text-white">{value}</p>
        </div>
      </div>
    </div>
  );

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const EmptyState = ({ message }) => (
    <div className="flex flex-col items-center justify-center py-12 px-4 border border-dashed border-white/10 rounded-2xl bg-zinc-900/20">
      <Inbox className="text-zinc-700 mb-3" size={32} />
      <p className="text-[10px] md:text-xs font-black uppercase tracking-[0.2em] text-zinc-500">{message}</p>
    </div>
  );

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-red-600 animate-pulse font-black uppercase tracking-[0.4em]">Loading...</div>;

  return (
    <div className="min-h-screen bg-black text-white pt-20 md:pt-24 pb-20 px-4 md:px-20 font-sans selection:bg-red-600">
      <div className="max-w-7xl mx-auto space-y-8 md:y-12">
        
        {/* BACK TO HOME BUTTON */}
        <button 
          onClick={() => navigate('/')}
          className="group flex items-center gap-2 text-zinc-500 hover:text-white transition-colors mb-4"
        >
          <div className="p-2 rounded-full bg-zinc-900 group-hover:bg-zinc-800 transition-colors">
            <ChevronRight size={16} className="rotate-180" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-[0.2em]">Back to Home</span>
        </button>

        {/* HEADER */}
        <div className="relative flex flex-col md:flex-row items-center gap-6 md:gap-8 p-6 md:p-8 rounded-2xl md:rounded-3xl bg-gradient-to-br from-zinc-900 via-black to-black border border-white/10">
          <div className="w-28 h-28 md:w-40 md:h-40 rounded-full bg-zinc-800 flex items-center justify-center border-4 border-red-600 shadow-2xl overflow-hidden shrink-0">
            {currentUser?.photoURL ? <img src={currentUser.photoURL} className="w-full h-full object-cover" alt="User" /> : <User size={48} className="text-zinc-600" />}
          </div>
          <div className="text-center md:text-left space-y-2">
            <h1 className="text-3xl md:text-5xl font-serif font-light">{currentUser?.displayName || "Member"}</h1>
            <div className="flex flex-col md:flex-row items-center justify-center md:justify-start gap-3 md:gap-6 text-zinc-400 text-xs md:text-sm">
              <span className="flex items-center gap-2"><Mail size={14}/> {currentUser?.email}</span>
              <span className="flex items-center gap-2"><Calendar size={14}/> Joined {formatDate(currentUser?.metadata?.creationTime)}</span>
            </div>
          </div>
        </div>

        {/* STATS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
          <StatCard icon={Film} label="History" value={userProgress.length} />
          <StatCard icon={Clock} label="Minutes" value={`${Math.ceil(userProgress.reduce((acc, curr) => acc + (curr.time || 0), 0) / 60)}m`} />
          <StatCard icon={Activity} label="Activity" value={userProgress.length > 0 ? "Active" : "New"} />
          <StatCard icon={Star} label="Watchlist" value={watchlist.length} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 md:gap-12">
          {/* SIDEBAR */}
          <div className="lg:col-span-1 lg:sticky lg:top-24 h-fit space-y-4 md:space-y-8">
            <h3 className="text-xs font-black uppercase tracking-[0.3em] text-red-600 hidden lg:block">Account</h3>
            <nav className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-visible no-scrollbar pb-2 lg:pb-0">
              {[
                { id: 'overview', icon: User, label: 'Overview' },
                { id: 'watchlist', icon: List, label: 'Watchlist' },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleSidebarClick(item.id)}
                  className={`flex-none lg:w-full flex items-center gap-3 p-3 md:p-4 rounded-xl transition-all whitespace-nowrap ${activeTab === item.id ? 'bg-white text-black font-bold' : 'bg-zinc-900/50 lg:bg-transparent hover:bg-zinc-900 text-zinc-400'}`}
                >
                  <item.icon size={18} />
                  <span className="text-xs md:text-sm tracking-wide">{item.label}</span>
                </button>
              ))}
              <button onClick={handleLogout} className="flex-none lg:w-full flex items-center gap-3 p-3 md:p-4 rounded-xl text-red-500 bg-red-500/5 lg:bg-transparent hover:bg-red-500/10"><LogOut size={18} /> Logout</button>
            </nav>
          </div>

          {/* CONTENT AREA */}
          <div className="lg:col-span-2 space-y-10 md:space-y-12">
            <section ref={overviewRef} className="space-y-6 scroll-mt-32">
              <h3 className="text-xs font-black uppercase tracking-[0.3em] text-red-600">Continue Watching</h3>
              {userProgress.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                  {userProgress.map((item) => (
                    <div 
                      key={item.fullMediaId} 
                      onClick={() => {
                        const route = item.mediaType === 'tv' 
                          ? `/details/tv/${item.id}/${item.season}/${item.episode}`
                          : `/details/movie/${item.id}`;
                        navigate(route);
                      }}
                      className="bg-zinc-900 rounded-xl md:rounded-2xl overflow-hidden border border-white/5 group cursor-pointer relative"
                    >
                      <button onClick={(e) => handleDeleteProgress(e, item.fullMediaId)} className="absolute top-2 right-2 z-20 p-2 bg-black/60 hover:bg-red-600 rounded-full md:opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={16} /></button>
                      <div className="relative aspect-video">
                        <img src={getPosterUrl(item.poster, "original")} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" alt={item.title} />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20"><Play size={24} className="text-white/80 group-hover:scale-125 transition-transform" fill="currentColor" /></div>
                      </div>
                      <div className="p-4 md:p-5">
                        <h4 className="font-bold text-xs md:text-sm uppercase truncate">{item.title}</h4>
                        <p className="text-[9px] md:text-[10px] text-zinc-500 font-bold uppercase mt-1">{item.mediaType === 'tv' ? `S${item.season} E${item.episode}` : 'Movie'} • {Math.floor(item.time / 60)}m</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState message="No watch history found" />
              )}
            </section>

            <section ref={watchlistRef} className="space-y-6 scroll-mt-32">
              <h3 className="text-xs font-black uppercase tracking-[0.3em] text-red-600">My List</h3>
              {watchlist.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 md:gap-6">
                  {watchlist.map((item) => (
                    <div 
                      key={item.id} 
                      onClick={() => navigate(`/details/${item.type || 'movie'}/${item.id}`)}
                      className="group cursor-pointer space-y-3"
                    >
                      <div className="relative aspect-[2/3] rounded-lg md:rounded-xl overflow-hidden bg-zinc-900 border border-white/5 group-hover:border-red-600 transition-all">
                        <button 
                          onClick={(e) => handleDeleteWatchlist(e, item)} 
                          className="absolute top-2 right-2 z-20 p-2 bg-black/60 hover:bg-red-600 rounded-full md:opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <Trash2 size={14} />
                        </button>
                        <img src={getPosterUrl(item.poster, "w780")} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt={item.title} />
                      </div>
                      <div>
                        <h4 className="font-bold text-[10px] md:text-xs uppercase truncate group-hover:text-red-600 transition-colors">{item.title}</h4>
                        <p className="text-[9px] text-zinc-500 font-bold uppercase">{item.year || (item.type === 'tv' ? 'Series' : 'Movie')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState message="Your watchlist is empty" />
              )}
            </section>
          </div>
        </div>
      </div>
      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; -webkit-overflow-scrolling: touch; }
      `}</style>
    </div>
  );
};

export default Profile;