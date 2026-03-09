import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { fetchMovieDetails, fetchSeasonDetails } from "../services/api";
import { Play, X, RefreshCw, Plus, Check, Star, Info, Calendar, Globe, Building2, ShieldCheck, Loader2, AlertCircle, ArrowLeft, Users, FileText, User } from "lucide-react";
import useTrailer from "../hooks/useTrailer";
import Hls from "hls.js";
import { auth } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
// --- NEW: IMPORT SUPABASE ---
import { supabase } from "../../src/services/supabaseClient";
// --- SCRAPER URL REMAINS ---
const BACKEND_URL = '/api/scrape-stream';
// --- NEW: PROXY URL ---
const PROXY_URL = '/api/proxy';
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
const [selectedAudio, setSelectedAudio] = useState('original'); // 'original' or 'english'
const [subtitleTracks, setSubtitleTracks] = useState([]);
const [selectedSubtitle, setSelectedSubtitle] = useState(-1);
const videoRef = useRef(null);
const hlsRef = useRef(null);
const progressInterval = useRef(null);
// --- AUTH & WATCHLIST ---
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
const { data, error } = await supabase
        .from('user_progress')
        .select('*')
        .eq('user_id', uid)
        .ilike('media_id', `%_${id}%`)
        .order('last_updated', { ascending: false })
        .limit(1);
if (error) throw error;
if (data && data.length > 0) {
const latest = data[0];
if (resolvedMediaType === 'tv') {
setResumeData({
season: latest.season || 1,
episode: latest.episode || 1,
time: latest.time
          });
        } else {
setResumeData({ time: latest.time });
        }
      }
    } catch (err) { console.error("Resume fetch failed", err); }
  };
const checkIfInWatchlist = async (uid) => {
try {
const { data, error } = await supabase
        .from('watchlist')
        .select('*')
        .eq('user_id', uid)
        .eq('media_id', id)
        .maybeSingle(); // Changed to maybeSingle to prevent 406 console errors
if (data) setIsInList(true);
else setIsInList(false);
    } catch (err) {
console.error("Watchlist check failed", err);
setIsInList(false);
    }
  };
const handleWatchlistToggle = async () => {
if (!currentUser) return alert("Please login to manage your list");
setIsSavingList(true);
try {
if (isInList) {
const { error } = await supabase
          .from('watchlist')
          .delete()
          .eq('user_id', currentUser.uid)
          .eq('media_id', id);
if (!error) setIsInList(false);
      } else {
const { error } = await supabase
          .from('watchlist')
          .insert([{
user_id: currentUser.uid,
media_id: id,
title: movie?.title || movie?.name,
poster: movie?.poster_path || movie?.backdrop_path,
type: resolvedMediaType,
year: (movie?.release_date || movie?.first_air_date)?.split('-')[0]
          }]);
if (!error) setIsInList(true);
      }
    } catch (err) {
console.error("Watchlist update failed", err);
    } finally {
setIsSavingList(false);
    }
  };
// --- PROGRESS SAVING ---
const saveProgress = async (currentTime) => {
if (!currentUser || currentTime <= 0 || !movie) return;
const mediaKey = resolvedMediaType === 'tv'
? `tv_${id}_s${selectedSeason}_e${selectedEpisode}`
: `movie_${id}`;
try {
await supabase
        .from('user_progress')
        .upsert({
user_id: currentUser.uid,
media_id: mediaKey,
time: currentTime,
title: movie?.title || movie?.name,
poster: movie?.poster_path || movie?.backdrop_path,
type: resolvedMediaType,
season: resolvedMediaType === 'tv' ? selectedSeason : null,
episode: resolvedMediaType === 'tv' ? selectedEpisode : null,
last_updated: new Date().toISOString()
        }, { onConflict: 'user_id, media_id' });
    } catch (err) { console.error("Failed to save progress", err); }
  };
const getSavedProgress = async () => {
if(!currentUser) return 0;
const mediaKey = resolvedMediaType === 'tv' ? `tv_${id}_s${selectedSeason}_e${selectedEpisode}` : `movie_${id}`;
try {
const { data, error } = await supabase
        .from('user_progress')
        .select('time')
        .eq('user_id', currentUser.uid)
        .eq('media_id', mediaKey)
        .maybeSingle(); // Changed to maybeSingle
return data ? data.time : 0;
    } catch (err) { return 0; }
  };
// --- TRAILER HOOK ---
const { trailerUrl, isPlaying, playTrailer, stopTrailer } = useTrailer(
id, resolvedMediaType, false, selectedSeason, movie?.title || movie?.name || ""
  );
// --- UPDATED: TRIGGER BACKEND SCRAPE WITH PROXY ---
const triggerBackendScrape = async (mId, mType, s, e) => {
setIsCleaning(true); setCleanUrl(null); setError(null);
try {
const url = `${BACKEND_URL}?id=${mId}&type=${mType}${mType === 'tv' ? `&s=${s}&e=${e}` : ''}`;
const response = await fetch(url);
if (!response.ok) throw new Error("Server error");
const data = await response.json();
if (data.success && data.url) {
// Use the returned URL directly (already proxied by backend)
setCleanUrl(data.url);
      } else {
setError("Stream could not be found.");
      }
    } catch (err) {
setError("Server is offline or encountered an error.");
    } finally {
setIsCleaning(false);
    }
  };
const handleAutoPlayNext = () => {
if (resolvedMediaType === 'tv') {
const nextEp = episodes.find(ep => ep.episode_number === selectedEpisode + 1);
if (nextEp) {
handleEpisodeSelect(nextEp.episode_number);
      } else {
setActiveStream(null);
      }
    }
  };
// --- Function to select English audio track with fuzzy matching ---
const selectEnglishAudio = (tracks) => {
if (tracks.length > 1 && hlsRef.current) {
const englishIndex = tracks.findIndex(track =>
      (track.lang && track.lang.toLowerCase().includes('en')) ||
      (track.name && track.name.toLowerCase().includes('en')) ||
      (track.name && track.name.toLowerCase().includes('dub'))
    );
if (englishIndex !== -1) {
hlsRef.current.audioTrack = englishIndex;
    }
  }
};
// --- Function to select English subtitle track with fuzzy matching ---
const selectEnglishSubtitle = (tracks) => {
  if (tracks.length > 0) {
    const englishIndex = tracks.findIndex(track =>
      (track.lang && (track.lang.toLowerCase().startsWith('en') || track.lang.toLowerCase() === 'eng')) ||
      (track.name && track.name.toLowerCase().includes('en'))
    );
    if (englishIndex !== -1) {
      if (hlsRef.current) {
        hlsRef.current.subtitleTrack = englishIndex;
      } else {
        tracks.forEach((t, i) => {
          t.nativeTrack.mode = i === englishIndex ? 'showing' : 'disabled';
        });
      }
      setSelectedSubtitle(englishIndex);
    }
  }
};
useEffect(() => {
if (cleanUrl && videoRef.current) {
const video = videoRef.current;
const initPlayer = async () => {
const savedTime = await getSavedProgress();
const startPlayback = () => {
if (savedTime > 0) {
// Use a slight delay or wait for the video to be ready to seek
const seek = () => {
video.currentTime = savedTime;
video.play().catch(e => console.error("Playback failed", e));
            };
if (video.readyState >= 1) {
seek();
            } else {
video.addEventListener('loadedmetadata', seek, { once: true });
            }
        } else {
video.play().catch(e => console.error("Playback failed", e));
        }
      };
if (Hls.isSupported()) {
hlsRef.current = new Hls({
  // CRITICAL: Ensure range headers are allowed for seeking
  xhrSetup: (xhr) => {
  xhr.withCredentials = false; // Set to true only if using cookies
          },
  manifestLoadingMaxRetry: 4,
  levelLoadingMaxRetry: 4,
  fragLoadingMaxRetry: 4,
  enableWorker: true
        });
hlsRef.current.loadSource(cleanUrl);
hlsRef.current.attachMedia(video);
hlsRef.current.on(Hls.Events.MANIFEST_PARSED, () => {
  setAudioTracks(hlsRef.current.audioTracks);
  selectEnglishAudio(hlsRef.current.audioTracks);
  
  // Sync subtitle tracks immediately
  const tracks = hlsRef.current.subtitleTracks.map((track, id) => ({...track, id}));
  setSubtitleTracks(tracks);
  
  selectEnglishSubtitle(tracks);
  
  startPlayback();
});
hlsRef.current.on(Hls.Events.AUDIO_TRACKS_UPDATED, () => {
  // Handle race condition: select when tracks are updated
  setAudioTracks(hlsRef.current.audioTracks);
  selectEnglishAudio(hlsRef.current.audioTracks);
        });
hlsRef.current.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, (event, data) => {
  // Catch tracks if they load slightly after the manifest
  const tracks = data.subtitleTracks.map((track, id) => ({...track, id}));
  setSubtitleTracks(tracks);
  if (selectedSubtitle === -1) {
    selectEnglishSubtitle(tracks);
  }
});
hlsRef.current.on(Hls.Events.ERROR, (event, data) => {
  if (data.fatal) {
    switch (data.type) {
      case Hls.ErrorTypes.NETWORK_ERROR:
        console.error("Network error, trying to recover...");
        hlsRef.current.startLoad();
        break;
      case Hls.ErrorTypes.MEDIA_ERROR:
        console.error("Media error, trying to recover...");
        hlsRef.current.recoverMediaError();
        break;
      default:
        console.error("Fatal error, destroying player");
        setError("Streaming Error: Please try again or refresh.");
        hlsRef.current.destroy();
        break;
            }
          }
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
  // Fallback for Safari - native HLS
  video.src = cleanUrl;

  const handleUpdateSubtitles = (isInitial = false) => {
    const nativeSubs = Array.from(video.textTracks)
      .filter(t => t.kind === 'subtitles')
      .map((t, id) => ({
        id,
        lang: t.language || '',
        name: t.label || '',
        nativeTrack: t
      }));
    setSubtitleTracks(nativeSubs);

    if (selectedSubtitle === -1 || isInitial) {
      selectEnglishSubtitle(nativeSubs);
    }
  };

  video.addEventListener('loadedmetadata', () => {
    handleUpdateSubtitles(true);
    startPlayback();
  }, { once: true });

  video.textTracks.addEventListener('addtrack', () => {
    handleUpdateSubtitles();
  });
      }
video.onpause = () => saveProgress(video.currentTime);
video.onended = () => {
saveProgress(0);
handleAutoPlayNext();
      };
    };
initPlayer();
progressInterval.current = setInterval(() => {
if (video && !video.paused && !video.ended) {
saveProgress(video.currentTime);
      }
    }, 10000);
  }
// CLEANUP: Destroy HLS instance when component unmounts or URL changes
return () => {
if (hlsRef.current) {
hlsRef.current.destroy();
hlsRef.current = null;
    }
if (progressInterval.current) {
clearInterval(progressInterval.current);
    }
if (videoRef.current) {
  videoRef.current.textTracks.removeEventListener('addtrack', () => {});
}
  };
}, [cleanUrl, selectedEpisode, selectedSeason]);
useEffect(() => {
async function loadMovie() {
try {
setLoading(true);
const data = await fetchMovieDetails(id, resolvedMediaType);
setMovie(data);
if (resolvedMediaType === "tv" && data.seasons?.length) {
const firstSeason = data.seasons.find(s => s.season_number > 0) || data.seasons[0];
setSelectedSeason(firstSeason.season_number);
        }
      } catch (err) { console.error(err); } finally { setLoading(false); }
    }
loadMovie();
  }, [id, resolvedMediaType]);
useEffect(() => {
if (resolvedMediaType === "tv" && selectedSeason) fetchSeasonDetails(id, selectedSeason).then(setEpisodes);
  }, [selectedSeason, id, resolvedMediaType]);
useEffect(() => {
  // Inject subtitle styling
  const styleId = 'subtitle-style';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.innerHTML = `
      video::cue {
        color: white;
        background-color: black;
        font-size: 1.5em;
        padding: 0.2em;
      }
    `;
    document.head.appendChild(style);
  }
  return () => {
    const style = document.getElementById(styleId);
    if (style) {
      style.remove();
    }
  };
}, []);
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
setSelectedEpisode(episodeNum); setActiveStream(true);
triggerBackendScrape(id, resolvedMediaType, selectedSeason, episodeNum);
window.scrollTo({ top: 0, behavior: "smooth" });
  };
const handleResumeClick = () => {
if (isPlaying) stopTrailer();
if (resolvedMediaType === 'tv' && resumeData) {
setSelectedSeason(resumeData.season);
setSelectedEpisode(resumeData.episode);
setActiveStream(true);
triggerBackendScrape(id, 'tv', resumeData.season, resumeData.episode);
    } else {
setActiveStream(true);
triggerBackendScrape(id, resolvedMediaType, selectedSeason, selectedEpisode);
    }
  };
// --- Toggle audio language ---
const toggleAudio = () => {
if (audioTracks.length > 1 && hlsRef.current) {
const currentIndex = hlsRef.current.audioTrack;
const originalIndex = 0; // Assume first is original
const englishIndex = audioTracks.findIndex(track =>
      (track.lang && track.lang.toLowerCase().includes('en')) ||
      (track.name && track.name.toLowerCase().includes('en')) ||
      (track.name && track.name.toLowerCase().includes('dub'))
    );
if (englishIndex !== -1) {
const newIndex = (selectedAudio === 'original') ? englishIndex : originalIndex;
hlsRef.current.audioTrack = newIndex;
// Force reload of audio level to sync switch
hlsRef.current.nextLevel = hlsRef.current.currentLevel;
setSelectedAudio(selectedAudio === 'original' ? 'english' : 'original');
    }
  }
};
// --- Cycle through subtitles or turn off ---
const toggleSubtitle = () => {
  if (subtitleTracks.length > 0) {
    // Cycle: -1 -> 0 -> 1 -> ... -> -1
    let nextIndex = selectedSubtitle + 1;
    if (nextIndex >= subtitleTracks.length) {
      nextIndex = -1; // Loop back to 'Off'
    }
    if (hlsRef.current) {
      hlsRef.current.subtitleTrack = nextIndex;
    } else {
      subtitleTracks.forEach((t, i) => {
        t.nativeTrack.mode = i === nextIndex ? 'showing' : 'disabled';
      });
    }
    setSelectedSubtitle(nextIndex);
  }
};
if (loading) return <div className="min-h-screen bg-black flex items-center justify-center"><RefreshCw className="animate-spin text-white" size={40} /></div>;
if (!movie) return null;
const { title, name, badgeYear, rating, runtime, plot, backdrop_path, poster_path, director, writer, cast, genre, language, votes, release_date, first_air_date } = movie;
const displayTitle = title || name;
const displayImage = backdrop_path ? `https://image.tmdb.org/t/p/original${backdrop_path}` : `https://image.tmdb.org/t/p/original${poster_path}`;
return (
<div className="relative min-h-screen bg-black text-white selection:bg-white selection:text-black overflow-x-hidden font-sans">
<button
onClick={() => navigate(-1)}
className="fixed top-6 left-6 md:top-8 md:left-20 z-[60] flex items-center gap-2 px-4 py-2 md:px-5 md:py-2.5 bg-black/40 backdrop-blur-xl border border-white/10 rounded-full hover:bg-white/10 hover:border-white/30 transition-all group"
>
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
<div className="bg-red-600/20 border border-red-600 px-3 py-1 rounded text-[9px] md:text-[10px] font-black uppercase tracking-widest flex items-center gap-2"><ShieldCheck size={14} />Protected</div>
</div>
<div className="space-y-4 text-white">
<div className="flex flex-wrap items-center gap-3 md:gap-4 text-xs md:text-sm tracking-widest opacity-80">
<span>{badgeYear || (release_date || first_air_date)?.split('-')[0]}</span>
<span className="bg-red-600 px-1 text-[10px] rounded-sm font-bold text-white uppercase">12+</span>
<span>{runtime || "TV Series"}</span>
<span className="hidden xs:inline">|</span>
<span className="uppercase">{genre || (movie.genres?.map(g => g.name).join(", "))}</span>
</div>
<div className="flex items-center gap-2">
<div className="flex gap-1">{renderStars(rating)}</div>
<span className="text-[10px] md:text-xs font-sans font-bold ml-1">{rating} / 10 ({votes} votes)</span>
</div>
</div>
<p className="text-sm md:text-base leading-relaxed text-white max-w-xl drop-shadow-md">{plot}</p>
<div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 pt-4 border-t border-white/10 max-w-3xl">
<div className="space-y-1">
<p className="text-[9px] md:text-[10px] uppercase tracking-tighter opacity-50 flex items-center gap-2"><Calendar size={12}/> Release</p>
<p className="text-xs font-bold">{badgeYear || first_air_date || "N/A"}</p>
</div>
<div className="space-y-1">
<p className="text-[9px] md:text-[10px] uppercase tracking-tighter opacity-50 flex items-center gap-2"><Globe size={12}/> Language</p>
<p className="text-xs font-bold uppercase">{language || "English"}</p>
</div>
<div className="space-y-1">
<p className="text-[9px] md:text-[10px] uppercase tracking-tighter opacity-50 flex items-center gap-2"><User size={12}/> {resolvedMediaType === 'tv' ? 'Created' : 'Director'}</p>
<p className="text-xs font-bold truncate">{director || "N/A"}</p>
</div>
<div className="space-y-1">
<p className="text-[9px] md:text-[10px] uppercase tracking-tighter opacity-50 flex items-center gap-2"><FileText size={12}/> Writer</p>
<p className="text-xs font-bold truncate">{writer || "N/A"}</p>
</div>
</div>
<div className="pt-4 max-w-2xl">
<p className="text-[9px] md:text-[10px] uppercase tracking-tighter opacity-50 mb-2 flex items-center gap-2"><Users size={12}/> Top Cast</p>
<p className="text-[11px] md:text-xs font-medium leading-relaxed opacity-90">{cast || "N/A"}</p>
</div>
<div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-6 uppercase">
<button onClick={handleResumeClick} className="w-full sm:w-auto flex items-center justify-center gap-3 bg-red-600 text-white px-6 md:px-10 py-3.5 md:py-3 rounded-sm hover:bg-red-700 transition-all font-black tracking-widest text-xs md:text-sm">
<Play size={18} fill="white" />
{resumeData ? (resolvedMediaType === 'tv' ? `Resume S${resumeData.season}:E${resumeData.episode}` : 'Resume Movie') : 'Start Stream'}
</button>
<button onClick={handleWatchlistToggle} disabled={isSavingList} className={`w-full sm:w-auto flex items-center justify-center gap-2 px-6 md:px-8 py-3.5 md:py-3 rounded-sm transition-all font-black backdrop-blur-md text-xs md:text-sm border ${isInList ? 'bg-white text-black border-white' : 'bg-black/40 text-white border-white/20 hover:bg-white/10'}`}>
{isSavingList ? <Loader2 size={18} className="animate-spin" /> : isInList ? <Check size={18} /> : <Plus size={18} />}
{isSavingList ? 'Saving...' : isInList ? 'Added' : 'My List'}
</button>
</div>
<button onClick={() => { setActiveStream(null); playTrailer(); }} className="flex items-center gap-3 md:gap-4 pt-6 md:pt-8 text-white hover:text-red-500 transition-all font-bold uppercase tracking-[0.2em] group text-[10px] md:text-sm">
<div className="p-2 md:p-3 border-2 border-white group-hover:border-red-500 rounded-full transition-all"><Play size={12} className="md:size-[14px]" fill="currentColor" /></div> Watch Trailer
</button>
</div>
</div>
{resolvedMediaType === "tv" && movie.seasons && (
<div className="relative py-12 md:py-24 px-6 md:px-20 bg-gradient-to-t from-black via-black/80 to-transparent">
<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 md:mb-10 text-white">
<h2 className="text-xl md:text-3xl font-serif uppercase tracking-widest border-l-4 border-red-600 pl-4">Episodes</h2>
<select value={selectedSeason} onChange={(e) => { setSelectedSeason(Number(e.target.value)); setSelectedEpisode(1); }} className="w-full sm:w-auto bg-zinc-900 border border-white/10 text-[10px] md:text-xs px-4 py-3 md:py-2 rounded uppercase tracking-widest text-white outline-none cursor-pointer">
{movie.seasons.map((s) => <option key={s.id} value={s.season_number}>Season {s.season_number}</option>)}
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
<h2 className="text-[9px] md:text-xs uppercase tracking-widest font-bold text-red-600 bg-black/50 px-4 md:px-6 py-2 rounded-full pointer-events-auto truncate max-w-[70%]">
{displayTitle} {activeStream && resolvedMediaType === "tv" && `• S${selectedSeason}:E${selectedEpisode}`}
</h2>
<button onClick={() => { if (videoRef.current) saveProgress(videoRef.current.currentTime); setActiveStream(null); stopTrailer(); setCleanUrl(null); }} className="text-white hover:text-red-500 transition-all bg-black/50 p-2 md:p-3 rounded-full pointer-events-auto"><X size={20} className="md:size-[24px]" /></button>
</div>
<div className="flex-grow w-full relative">
{isCleaning ? (
<div className="absolute inset-0 z-[115] bg-black flex flex-col items-center justify-center">
<Loader2 className="animate-spin text-red-600" size={40} />
<p className="mt-4 text-[10px] md:text-xs font-black tracking-widest uppercase animate-pulse">loading...</p>
</div>
            ) : error ? (
<div className="absolute inset-0 z-[115] bg-black flex flex-col items-center justify-center text-center px-6">
<AlertCircle className="text-red-600 mb-4" size={40} />
<p className="text-[10px] md:text-xs font-black tracking-widest uppercase">{error}</p>
<button onClick={() => triggerBackendScrape(id, resolvedMediaType, selectedSeason, selectedEpisode)} className="mt-6 border border-white/20 px-6 py-2 text-[10px] uppercase font-bold hover:bg-white/10 transition-all">Retry Connection</button>
</div>
            ) : cleanUrl ? (
<div className="relative w-full h-full">
<video ref={videoRef} controls autoPlay playsInline className="w-full h-full object-contain bg-black" />
<div className="absolute bottom-4 right-4 flex gap-4">
  {audioTracks.length > 1 && (
    <button
      onClick={toggleAudio}
      className="bg-black/70 text-white px-4 py-2 rounded text-sm"
    >
      {selectedAudio === 'original' ? 'Switch to English' : 'Switch to Original'}
    </button>
  )}
  {subtitleTracks.length > 0 && (
  <button
    onClick={toggleSubtitle}
    className={`px-4 py-2 rounded text-sm transition-all border ${
      selectedSubtitle === -1 
      ? "bg-black/70 text-white border-white/20" 
      : "bg-red-600 text-white border-red-600 font-bold"
    }`}
  >
    {selectedSubtitle === -1 
      ? 'CC Off' 
      : `CC: ${subtitleTracks[selectedSubtitle]?.name || subtitleTracks[selectedSubtitle]?.lang || 'Track ' + (selectedSubtitle + 1)}`}
  </button>
)}
</div>
</div>
            ) : isPlaying ? (
<iframe src={trailerUrl} className="w-full h-full border-none" allowFullScreen title="Trailer" />
            ) : null}
</div>
</div>
      )}
</div>
  );
};
export default MovieDetails;