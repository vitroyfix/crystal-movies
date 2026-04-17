import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { fetchMovieDetails, fetchSeasonDetails } from "../services/api";
import {
  Play,
  X,
  RefreshCw,
  Plus,
  Check,
  Star,
  Calendar,
  Globe,
  ShieldCheck,
  Loader2,
  AlertCircle,
  ArrowLeft,
  FileText,
  User,
} from "lucide-react";
import useTrailer from "../hooks/useTrailer";
import Hls from "hls.js";
import { auth } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import CryptoJS from "crypto-js";
import { supabase } from "../../src/services/supabaseClient";

// Update this to your GCP IP when deploying to South Africa
const BACKEND_URL = "https://crystalmovies.vercel.app//api/scrape-stream";
const SUBS_URL = "https://crystalmovies.vercel.app//api/subs";
const SECRET_KEY = import.meta.env.VITE_ENCRYPTION_KEY;

const MovieDetails = () => {
  const { id, mediaType: typeFromPath } = useParams();
  const navigate = useNavigate();
  const resolvedMediaType = typeFromPath === "tv" ? "tv" : "movie";

  const [movie, setMovie] = useState(null);
  const [loading, setLoading] = useState(true);
  const [episodes, setEpisodes] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [isInList, setIsInList] = useState(false);
  const [isSavingList, setIsSavingList] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [selectedEpisode, setSelectedEpisode] = useState(1);
  const [resumeData, setResumeData] = useState(null);
  const [activeStream, setActiveStream] = useState(null);
  const [cleanUrl, setCleanUrl] = useState(null);
  const [isCleaning, setIsCleaning] = useState(false);
  const [error, setError] = useState(null);
  const [audioTracks, setAudioTracks] = useState([]);
  const [selectedAudio, setSelectedAudio] = useState("original");
  const [subtitleTracks, setSubtitleTracks] = useState([]);
  const [selectedSubtitle, setSelectedSubtitle] = useState(-1);
  const [qualityLevels, setQualityLevels] = useState([]);
  const [selectedQuality, setSelectedQuality] = useState(-1);
  const [activeMenu, setActiveMenu] = useState(null);

  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const progressInterval = useRef(null);
  const controlsRef = useRef(null);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (controlsRef.current && !controlsRef.current.contains(e.target)) {
        setActiveMenu(null);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  useEffect(() => {
    const silenceMediaAbort = (event) => {
      const reason = event.reason;
      if (
        reason &&
        (reason.name === "DOMException" || reason instanceof DOMException) &&
        (reason.message.includes("aborted") ||
          reason.message.includes("AbortError") ||
          reason.message.includes("Invalid URI") ||
          reason.message.includes("media resource"))
      ) {
        event.preventDefault();
        return true;
      }
      return false;
    };
    window.addEventListener("unhandledrejection", silenceMediaAbort);
    return () => window.removeEventListener("unhandledrejection", silenceMediaAbort);
  }, []);

  const encryptData = (payload) => {
    return CryptoJS.AES.encrypt(JSON.stringify(payload), SECRET_KEY).toString();
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(user);
        checkIfInWatchlist(user.uid);
        fetchResumePoint(user.uid);
      }
    });
    return () => unsubscribe();
  }, [id]);

  const fetchResumePoint = async (uid) => {
    try {
      const searchKey = resolvedMediaType === "tv" ? `tv_${id}_%` : `movie_${id}`;
      const { data, error } = await supabase
        .from("user_progress")
        .select("*")
        .eq("user_id", uid)
        .ilike("media_id", searchKey);
      if (error) throw error;
      if (data && data.length > 0) {
        if (resolvedMediaType === "tv") {
          const highestProgress = data.reduce((prev, current) => {
            if (current.season > prev.season) return current;
            if (current.season === prev.season && current.episode > prev.episode) return current;
            return prev;
          }, data[0]);
          setResumeData({ season: highestProgress.season, episode: highestProgress.episode, time: highestProgress.time });
        } else {
          setResumeData({ time: data[0].time });
        }
      }
    } catch {}
  };

  const checkIfInWatchlist = async (uid) => {
    try {
      const { data } = await supabase
        .from("watchlist")
        .select("*")
        .eq("user_id", uid)
        .eq("media_id", id.toString())
        .maybeSingle();
      setIsInList(!!data);
    } catch {
      setIsInList(false);
    }
  };

  const handleWatchlistToggle = async () => {
    if (!currentUser) return alert("Please login to manage your list");
    setIsSavingList(true);
    try {
      if (isInList) {
        await supabase.from("watchlist").delete().eq("user_id", currentUser.uid).eq("media_id", id.toString());
        setIsInList(false);
      } else {
        await supabase.from("watchlist").insert([{
          user_id: currentUser.uid,
          media_id: id.toString(),
          title: movie?.title || movie?.name,
          poster: movie?.poster_path || movie?.backdrop_path,
          type: resolvedMediaType,
          year: (movie?.release_date || movie?.first_air_date)?.split("-")[0] || "N/A",
        }]);
        setIsInList(true);
      }
    } catch {} finally { setIsSavingList(false); }
  };

  const saveProgress = async (currentTime) => {
    if (!currentUser || !movie || !videoRef.current) return;
    const mediaKey = resolvedMediaType === "tv" ? `tv_${id}_s${selectedSeason}_e${selectedEpisode}` : `movie_${id}`;
    try {
      await supabase.from("user_progress").upsert({
        user_id: currentUser.uid,
        media_id: mediaKey,
        time: currentTime,
        title: movie?.title || movie?.name,
        poster: movie?.backdrop_path || movie?.poster_path,
        type: resolvedMediaType,
        season: resolvedMediaType === "tv" ? selectedSeason : null,
        episode: resolvedMediaType === "tv" ? selectedEpisode : null,
        last_updated: new Date().toISOString(),
      }, { onConflict: "user_id, media_id" });
    } catch {}
  };

  const getSavedProgress = async () => {
    if (!currentUser) return 0;
    const mediaKey = resolvedMediaType === "tv" ? `tv_${id}_s${selectedSeason}_e${selectedEpisode}` : `movie_${id}`;
    try {
      const { data } = await supabase.from("user_progress").select("time").eq("user_id", currentUser.uid).eq("media_id", mediaKey).maybeSingle();
      return data ? data.time : 0;
    } catch { return 0; }
  };

  const { trailerUrl, isPlaying, playTrailer, stopTrailer } = useTrailer(id, resolvedMediaType, false, selectedSeason, movie?.title || movie?.name || "");

  const triggerBackendScrape = async (mId, mType, s, e) => {
    setIsCleaning(true);
    setCleanUrl(null);
    setError(null);
    setActiveMenu(null);
    try {
      const payload = { id: mId, type: mType, s, e };
      const encrypted = encryptData(payload);
      const response = await fetch(BACKEND_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: encrypted }),
      });
      if (!response.ok) throw new Error();
      const data = await response.json();
      if (data.success && data.url) {
        // --- SENIOR ENGINEER FIX: Derive Proxy Path from Backend URL ---
        const backendBase = BACKEND_URL.replace('/api/scrape-stream', '');
        const finalProxyUrl = `${backendBase}${data.url}`;
        setCleanUrl(finalProxyUrl);
        fetchSubtitles(mId, mType, s, e);
      } else {
        setError("Stream could not be found.");
      }
    } catch {
      setError("Server is offline or encountered an error.");
    } finally {
      setIsCleaning(false);
    }
  };

  const fetchSubtitles = async (mId, mType, s, e) => {
    try {
      const payload = { imdbId: mId, type: mType, season: s, episode: e };
      const encrypted = encryptData(payload);
      const response = await fetch(SUBS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: encrypted }),
      });
      const result = await response.json();
      if (result.data) {
        const bytes = CryptoJS.AES.decrypt(result.data, SECRET_KEY);
        const decrypted = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
        setSubtitleTracks(decrypted.tracks || []);
        const enIdx = (decrypted.tracks || []).findIndex(t => t.language === "en");
        if (enIdx !== -1) setSelectedSubtitle(enIdx);
      }
    } catch {}
  };

  const handleAutoPlayNext = () => {
    if (resolvedMediaType === "tv") {
      const nextEp = episodes.find(ep => ep.episode_number === selectedEpisode + 1);
      if (nextEp) handleEpisodeSelect(nextEp.episode_number);
      else setActiveStream(null);
    }
  };

  useEffect(() => {
    if (cleanUrl && videoRef.current) {
      const video = videoRef.current;
      const initPlayer = async () => {
        const savedTime = await getSavedProgress();
        const attemptSeekAndPlay = () => {
          const playVideo = () => {
            if (savedTime > 0) video.currentTime = savedTime;
            const playPromise = video.play();
            if (playPromise !== undefined) {
              playPromise.catch(() => {});
            }
          };
          if (video.readyState >= 1) playVideo();
          else video.addEventListener("loadedmetadata", playVideo, { once: true });
        };

        if (Hls.isSupported()) {
          hlsRef.current = new Hls({ xhrSetup: (xhr) => { xhr.withCredentials = false; }, enableWorker: true });
          hlsRef.current.loadSource(cleanUrl);
          hlsRef.current.attachMedia(video);
          hlsRef.current.on(Hls.Events.MANIFEST_PARSED, () => {
            setAudioTracks(hlsRef.current.audioTracks);
            setQualityLevels(hlsRef.current.levels || []);
            setSelectedQuality(-1);
            attemptSeekAndPlay();
          });
        } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = cleanUrl;
          video.addEventListener("loadedmetadata", attemptSeekAndPlay, { once: true });
        }
        video.onpause = () => saveProgress(video.currentTime);
        video.onended = () => { saveProgress(0); handleAutoPlayNext(); };
      };
      initPlayer();
      progressInterval.current = setInterval(() => {
        if (video && !video.paused && !video.ended) saveProgress(video.currentTime);
      }, 10000);
    }
    return () => {
      if (videoRef.current) {
        const video = videoRef.current;
        video.pause();
        video.src = "";
        video.removeAttribute("src");
        video.load();
      }
      if (hlsRef.current) { hlsRef.current.detachMedia(); hlsRef.current.destroy(); hlsRef.current = null; }
      if (progressInterval.current) { clearInterval(progressInterval.current); progressInterval.current = null; }
    };
  }, [cleanUrl, selectedEpisode, selectedSeason]);

  useEffect(() => {
    async function loadMovie() {
      try {
        setLoading(true);
        const data = await fetchMovieDetails(id, resolvedMediaType);
        setMovie(data);
        if (resolvedMediaType === "tv" && data.seasons?.length) {
          const firstSeason = data.seasons.find((s) => s.season_number > 0) || data.seasons[0];
          setSelectedSeason(firstSeason.season_number);
        }
      } catch {} finally { setLoading(false); }
    }
    loadMovie();
  }, [id, resolvedMediaType]);

  useEffect(() => {
    if (resolvedMediaType === "tv" && selectedSeason) fetchSeasonDetails(id, selectedSeason).then(setEpisodes);
  }, [selectedSeason, id, resolvedMediaType]);

  useEffect(() => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const trackElements = video.querySelectorAll("track");
    trackElements.forEach((trackEl, idx) => {
      const textTrack = trackEl.track;
      if (textTrack) textTrack.mode = selectedSubtitle === -1 ? "disabled" : idx === selectedSubtitle ? "showing" : "disabled";
    });
  }, [selectedSubtitle, subtitleTracks.length]);

  const renderStars = (rating) => {
    const stars = [];
    const fullStars = Math.floor(rating / 2);
    for (let i = 0; i < 5; i++) {
      stars.push(<Star key={i} size={16} className={i < fullStars ? "fill-red-600 text-red-600" : "text-gray-600"} />);
    }
    return stars;
  };

  const handleEpisodeSelect = (episodeNum) => {
    if (isPlaying) stopTrailer();
    if (videoRef.current) saveProgress(videoRef.current.currentTime);
    setSelectedEpisode(episodeNum);
    setActiveStream(true);
    setActiveMenu(null);
    triggerBackendScrape(id, resolvedMediaType, selectedSeason, episodeNum);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleResumeClick = () => {
    if (isPlaying) stopTrailer();
    if (resolvedMediaType === "tv" && resumeData) {
      setSelectedSeason(resumeData.season);
      setSelectedEpisode(resumeData.episode);
      setActiveStream(true);
      triggerBackendScrape(id, "tv", resumeData.season, resumeData.episode);
    } else {
      setActiveStream(true);
      triggerBackendScrape(id, resolvedMediaType, selectedSeason, selectedEpisode);
    }
  };

  const toggleAudio = () => {
    if (audioTracks.length > 1 && hlsRef.current) {
      const nextIndex = (hlsRef.current.audioTrack + 1) % audioTracks.length;
      hlsRef.current.audioTrack = nextIndex;
      setSelectedAudio(nextIndex === 0 ? "original" : "english");
    }
  };

  const selectSubtitle = (index) => { setSelectedSubtitle(index); setActiveMenu(null); };
  const getQualityLabel = (index) => {
    if (index === -1 || index >= qualityLevels.length || !qualityLevels[index]) return "Auto";
    return `${qualityLevels[index].height}p`;
  };
  const selectQuality = (levelIndex) => {
    setSelectedQuality(levelIndex);
    if (hlsRef.current) hlsRef.current.currentLevel = levelIndex;
    setActiveMenu(null);
  };

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center"><RefreshCw className="animate-spin text-white" size={40} /></div>;
  if (!movie) return null;

  const { title, name, badgeYear, rating, runtime, plot, backdrop_path, poster_path, director, writer, release_date, first_air_date, votes } = movie;
  const genre = movie.genres?.map((g) => g.name).join(", ") || "";
  const language = movie.original_language?.toUpperCase() || "EN";
  const displayTitle = title || name;
  const displayImage = backdrop_path ? `https://image.tmdb.org/t/p/original${backdrop_path}` : `https://image.tmdb.org/t/p/original${poster_path}`;

  return (
    <div className="relative min-h-screen bg-black text-white selection:bg-white selection:text-black overflow-x-hidden font-sans">
      <button onClick={() => navigate(-1)} className="fixed top-6 left-6 md:top-8 md:left-20 z-[60] flex items-center gap-2 px-4 py-2 md:px-5 md:py-2.5 bg-black/40 backdrop-blur-xl border border-white/10 rounded-full hover:bg-white/10 hover:border-white/30 transition-all group">
        <ArrowLeft size={16} className="md:size-[18px] group-hover:-translate-x-1 transition-transform" />
        <span className="text-[9px] md:text-xs font-black uppercase tracking-widest">Go Back</span>
      </button>

      <div className="fixed inset-0 z-0 w-full h-full overflow-hidden">
        {displayImage && (
          <div className="relative w-full h-full">
            <img src={displayImage} alt={displayTitle} className="w-full h-full object-cover object-center opacity-70" />
            <div className="absolute inset-0 bg-gradient-to-r from-black via-black/60 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
          </div>
        )}
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        <div className="flex-grow flex flex-col justify-center px-6 md:px-20 py-24 md:py-12 min-h-screen">
          <div className="max-w-4xl space-y-6">
            <h1 className="text-3xl sm:text-5xl md:text-7xl lg:text-8xl font-serif font-light tracking-widest uppercase text-white leading-tight md:leading-none">{displayTitle}</h1>
            <div className="flex items-center gap-4">
              <div className="bg-red-600/20 border border-red-600 px-3 py-1 rounded text-[9px] md:text-[10px] font-black uppercase tracking-widest flex items-center gap-2"><ShieldCheck size={14} /> Protected</div>
            </div>
            <div className="space-y-4 text-white">
              <div className="flex flex-wrap items-center gap-3 md:gap-4 text-xs md:text-sm tracking-widest opacity-80">
                <span>{badgeYear || (release_date || first_air_date)?.split("-")[0]}</span>
                <span className="bg-red-600 px-1 text-[10px] rounded-sm font-bold text-white uppercase">12+</span>
                <span>{runtime || "TV Series"}</span>
                <span className="hidden xs:inline">|</span>
                <span className="uppercase">{genre}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex gap-1">{renderStars(rating)}</div>
                <span className="text-[10px] md:text-xs font-sans font-bold ml-1">{rating} / 10 ({votes} votes)</span>
              </div>
            </div>
            <p className="text-sm md:text-base leading-relaxed text-white max-w-xl drop-shadow-md">{plot}</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 pt-4 border-t border-white/10 max-w-3xl">
              <div className="space-y-1">
                <p className="text-[9px] md:text-[10px] uppercase tracking-tighter opacity-50 flex items-center gap-2"><Calendar size={12} /> Release</p>
                <p className="text-xs font-bold">{badgeYear || first_air_date || "N/A"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[9px] md:text-[10px] uppercase tracking-tighter opacity-50 flex items-center gap-2"><Globe size={12} /> Language</p>
                <p className="text-xs font-bold uppercase">{language}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[9px] md:text-[10px] uppercase tracking-tighter opacity-50 flex items-center gap-2"><User size={12} /> {resolvedMediaType === "tv" ? "Created" : "Director"}</p>
                <p className="text-xs font-bold truncate">{director || "N/A"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[9px] md:text-[10px] uppercase tracking-tighter opacity-50 flex items-center gap-2"><FileText size={12} /> Writer</p>
                <p className="text-xs font-bold truncate">{writer || "N/A"}</p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-6 uppercase">
              <button onClick={handleResumeClick} className="w-full sm:w-auto flex items-center justify-center gap-3 bg-red-600 text-white px-6 md:px-10 py-3.5 md:py-3 rounded-sm hover:bg-red-700 transition-all font-black tracking-widest text-xs md:text-sm">
                <Play size={18} fill="white" />{resumeData ? (resolvedMediaType === "tv" ? `Resume S${resumeData.season}:E${resumeData.episode}` : "Resume Movie") : "Start Stream"}
              </button>
              <button onClick={handleWatchlistToggle} disabled={isSavingList} className={`w-full sm:w-auto flex items-center justify-center gap-2 px-6 md:px-8 py-3.5 md:py-3 rounded-sm transition-all font-black backdrop-blur-md text-xs md:text-sm border ${isInList ? "bg-white text-black border-white" : "bg-black/40 text-white border-white/20 hover:bg-white/10"}`}>
                {isSavingList ? <Loader2 size={18} className="animate-spin" /> : isInList ? <Check size={18} /> : <Plus size={18} />}
                {isSavingList ? "Saving..." : isInList ? "Added" : "My List"}
              </button>
            </div>
            <button onClick={() => { setActiveStream(null); playTrailer(); }} className="flex items-center gap-3 md:gap-4 pt-6 md:pt-8 text-white hover:text-red-500 transition-all font-bold uppercase tracking-[0.2em] group text-[10px] md:text-sm">
              <div className="p-2 md:p-3 border-2 border-white group-hover:border-red-500 rounded-full transition-all"><Play size={12} className="md:size-[14px]" fill="currentColor" /></div>Watch Trailer
            </button>
          </div>
        </div>

        {resolvedMediaType === "tv" && movie.seasons && (
          <div className="relative py-12 md:py-24 px-6 md:px-20 bg-gradient-to-t from-black via-black/80 to-transparent">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 md:mb-10 text-white">
              <h2 className="text-xl md:text-3xl font-serif uppercase tracking-widest border-l-4 border-red-600 pl-4">Episodes</h2>
              <select value={selectedSeason} onChange={(e) => { setSelectedSeason(Number(e.target.value)); setSelectedEpisode(1); }} className="w-full sm:w-auto bg-zinc-900 border border-white/10 text-[10px] md:text-xs px-4 py-3 md:py-2 rounded uppercase tracking-widest text-white outline-none cursor-pointer">
                {movie.seasons.map((s) => (<option key={s.id} value={s.season_number}>Season {s.season_number}</option>))}
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8">
              {episodes.map((ep) => (
                <div key={`${selectedSeason}-${ep.episode_number}`} onClick={() => handleEpisodeSelect(ep.episode_number)} className={`group cursor-pointer transition-all duration-300 ${selectedEpisode === ep.episode_number ? "scale-[1.02]" : "opacity-70 hover:opacity-100"}`}>
                  <div className={`relative aspect-video rounded-lg overflow-hidden border-2 ${selectedEpisode === ep.episode_number ? "border-red-600 shadow-lg shadow-red-600/20" : "border-white/10"}`}>
                    <img src={ep.still_path ? `https://image.tmdb.org/t/p/w500${ep.still_path}` : displayImage} alt={ep.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 md:opacity-0 group-hover:opacity-100 transition-opacity"><div className="p-3 bg-red-600 rounded-full shadow-lg"><Play size={20} fill="white" /></div></div>
                  </div>
                  <div className="mt-3 md:mt-4 space-y-1">
                    <h3 className="text-xs md:text-sm font-bold uppercase tracking-widest truncate">{ep.name}</h3>
                    <p className="text-[9px] md:text-[10px] leading-relaxed line-clamp-2 opacity-60">{ep.overview}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {(activeStream || isPlaying) && (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col">
          <div className="absolute top-0 w-full p-4 md:p-8 flex justify-between items-center z-[110] text-white pointer-events-none">
            <h2 className="text-[9px] md:text-xs uppercase tracking-widest font-bold text-red-600 bg-black/50 px-4 md:px-6 py-2 rounded-full pointer-events-auto truncate max-w-[70%]">{displayTitle} {activeStream && resolvedMediaType === "tv" && `• S${selectedSeason}:E${selectedEpisode}`}</h2>
            <button onClick={() => { if (videoRef.current) saveProgress(videoRef.current.currentTime); setActiveStream(null); stopTrailer(); setCleanUrl(null); setActiveMenu(null); }} className="text-white hover:text-red-500 transition-all bg-black/50 p-2 md:p-3 rounded-full pointer-events-auto"><X size={20} /></button>
          </div>

          <div className="flex-grow w-full relative">
            {isCleaning ? (
              <div className="absolute inset-0 z-[115] bg-black flex flex-col items-center justify-center"><Loader2 className="animate-spin text-red-600" size={40} /><p className="mt-4 text-[10px] md:text-xs font-black tracking-widest uppercase animate-pulse">loading...</p></div>
            ) : error ? (
              <div className="absolute inset-0 z-[115] bg-black flex flex-col items-center justify-center text-center px-6"><AlertCircle className="text-red-600 mb-4" size={40} /><p className="text-[10px] md:text-xs font-black tracking-widest uppercase">{error}</p><button onClick={() => triggerBackendScrape(id, resolvedMediaType, selectedSeason, selectedEpisode)} className="mt-6 border border-white/20 px-6 py-2 text-[10px] uppercase font-bold hover:bg-white/10 transition-all">Retry Connection</button></div>
            ) : cleanUrl ? (
              <div className="relative w-full h-full">
                <video ref={videoRef} controls autoPlay playsInline crossOrigin="anonymous" className="w-full h-full object-contain bg-black">
                  {subtitleTracks.map((track, idx) => (
                    <track key={idx} kind="subtitles" src={`${BACKEND_URL.replace('/api/scrape-stream', '')}/api/proxy?url=${encodeURIComponent(track.uri)}&type=sub`} label={track.title} srcLang={track.language} default={idx === selectedSubtitle} />
                  ))}
                </video>

                <div ref={controlsRef} className="absolute bottom-20 md:bottom-24 right-4 md:right-8 flex flex-wrap gap-2 z-[9999] pointer-events-auto">
                  {audioTracks.length > 1 && (<button onClick={toggleAudio} className="bg-black/80 backdrop-blur-xl border border-white/30 text-white px-4 py-2 rounded shadow-2xl text-[10px] uppercase font-bold hover:bg-red-600 transition-all">Audio: {selectedAudio}</button>)}
                  {activeStream && (
                    <div className="relative">
                      <button onClick={() => setActiveMenu((prev) => prev === "quality" ? null : "quality")} className={`bg-black/80 backdrop-blur-xl border text-white px-4 py-2 rounded shadow-2xl text-[10px] uppercase font-bold transition-all ${activeMenu === "quality" ? "border-red-500 bg-red-600/20" : "border-white/30 hover:bg-white/20"}`}>Quality: {getQualityLabel(selectedQuality)}</button>
                      {activeMenu === "quality" && (
                        <div className="absolute bottom-full right-0 mb-2 flex flex-col bg-black/95 backdrop-blur-xl border border-white/20 rounded overflow-hidden min-w-[160px] shadow-2xl">
                          <button onClick={() => selectQuality(-1)} className={`px-4 py-3 text-[10px] uppercase text-left hover:bg-red-600 transition-colors ${selectedQuality === -1 ? "bg-red-600/30 text-red-400 font-black" : "text-white/80"}`}>Auto</button>
                          {qualityLevels.length > 0 && (<div className="max-h-48 overflow-y-auto scrollbar-hide">{qualityLevels.map((level, i) => (<button key={i} onClick={() => selectQuality(i)} className={`w-full px-4 py-3 text-[10px] uppercase text-left hover:bg-red-600 transition-colors ${selectedQuality === i ? "bg-red-600/30 text-red-400 font-black" : "text-white/80"}`}>{level.height}p</button>))}</div>)}
                        </div>
                      )}
                    </div>
                  )}
                  {subtitleTracks.length > 0 && (
                    <div className="relative">
                      <button onClick={() => setActiveMenu((prev) => prev === "subs" ? null : "subs")} className={`bg-black/80 backdrop-blur-xl border text-white px-4 py-2 rounded shadow-2xl text-[10px] uppercase font-bold transition-all ${activeMenu === "subs" ? "border-red-500 bg-red-600/20" : "border-white/30 hover:bg-white/20"}`}>Subs: {selectedSubtitle === -1 ? "Off" : subtitleTracks[selectedSubtitle]?.title}</button>
                      {activeMenu === "subs" && (
                        <div className="absolute bottom-full right-0 mb-2 flex flex-col bg-black/95 backdrop-blur-xl border border-white/20 rounded overflow-hidden min-w-[160px] shadow-2xl">
                          <button onClick={() => selectSubtitle(-1)} className={`px-4 py-3 text-[10px] uppercase text-left hover:bg-red-600 transition-colors ${selectedSubtitle === -1 ? "bg-red-600/30 text-red-400 font-black" : "text-white/80"}`}>Off</button>
                          <div className="max-h-48 overflow-y-auto scrollbar-hide">{subtitleTracks.map((t, i) => (<button key={i} onClick={() => selectSubtitle(i)} className={`w-full px-4 py-3 text-[10px] uppercase text-left hover:bg-red-600 transition-colors ${selectedSubtitle === i ? "bg-red-600/30 text-red-400 font-black" : "text-white/80"}`}>{t.title}</button>))}</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : isPlaying ? (
              <iframe src={trailerUrl} className="w-full h-full border-none" allowFullScreen title="Trailer" />
            ) : null}
          </div>
        </div>
      )}

      <style>{`
        video::cue { background-color: rgba(0, 0, 0, 0.78); color: #ffffff; font-size: 1rem; font-family: sans-serif; line-height: 1.5; padding: 2px 8px; border-radius: 2px; }
        video::-webkit-media-text-track-display { overflow: visible !important; z-index: 9999 !important; pointer-events: none; }
        video::-webkit-media-text-track-container { overflow: visible !important; z-index: 9999 !important; }
      `}</style>
    </div>
  );
};

export default MovieDetails;
