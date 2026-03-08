import React, { useState, useEffect } from "react";
import MovieCard from "./MovieCard.jsx";
import { fetchTrending, fetchMovies, fetchByGenre } from "../../services/api.js"; 
import { Home, ArrowLeft } from "lucide-react"; // Import icons for a professional look

const MovieGrid = () => {
  const genreMap = {
    "Action": 28, "Animation": 16, "Romance": 10749, "Comedy": 35, "Horror": 27,
    "Adventure": 12, "Sci-fi": 878, "Drama": 18, "Thriller": 53
  };

  const buttons = Object.keys(genreMap);

  const [trending, setTrending] = useState([]);
  const [topRated, setTopRated] = useState([]);
  const [recentlyAdded, setRecentlyAdded] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedGenre, setSelectedGenre] = useState(null);
  const [genreMovies, setGenreMovies] = useState([]);
  const [isFiltering, setIsFiltering] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    async function loadMovies() {
      const [trendingData, topRatedData, recentlyAddedData] = await Promise.all([
        fetchTrending(),
        fetchMovies(),
        fetchMovies(),
      ]);

      setTrending(trendingData);
      setTopRated(topRatedData);
      setRecentlyAdded(recentlyAddedData);
      setLoading(false);
    }
    loadMovies();
  }, []);

  // Function to Reset everything and go back to the "Home" view
  const resetToHome = () => {
    setSelectedGenre(null);
    setGenreMovies([]);
    setCurrentPage(1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleGenreClick = async (genreName) => {
    if (selectedGenre === genreName) {
      resetToHome();
      return;
    }

    setSelectedGenre(genreName);
    setIsFiltering(true);
    setCurrentPage(1);
    try {
      const genreId = genreMap[genreName];
      const data = await fetchByGenre(genreId, 1);
      setGenreMovies(data);
      setHasMore(data.length > 0);
    } catch (err) {
      console.error("Genre fetch failed", err);
    } finally {
      setIsFiltering(false);
    }
  };

  const loadMore = async () => {
    const nextPage = currentPage + 1;
    const genreId = genreMap[selectedGenre];
    try {
      const newData = await fetchByGenre(genreId, nextPage);
      if (newData.length === 0) {
        setHasMore(false);
      } else {
        setGenreMovies((prev) => [...prev, ...newData]);
        setCurrentPage(nextPage);
      }
    } catch (err) {
      console.error("Load more failed", err);
    }
  };

  if (loading) return <p className="text-white text-center py-10 font-black uppercase tracking-widest">Loading content...</p>;

  const MovieRow = ({ title, data }) => (
    <div className="space-y-4">
      <h2 className="text-xl md:text-2xl font-black uppercase tracking-tighter border-l-4 border-red-600 pl-4">{title}</h2>
      <div className="flex overflow-x-auto md:grid md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 pb-6 md:pb-0 no-scrollbar snap-x">
        {data.map((item, index) => (
          <div key={`${item.id}-${index}`} className="min-w-[160px] md:min-w-0 snap-start">
            <MovieCard {...item} />
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <section className="px-6 md:px-12 py-10 bg-black text-white space-y-16">
      
      {/* 1. Header with Reset Button when Filtering */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-xl md:text-2xl font-black uppercase tracking-tighter border-l-4 border-red-600 pl-4 mb-2">
            {selectedGenre ? `Category: ${selectedGenre}` : "Browse by Genre"}
          </h2>
          <p className="text-gray-400 text-xs md:text-sm uppercase tracking-widest">
            {selectedGenre ? `Showing the best of ${selectedGenre}` : "Discover movies and TV shows tailored to your taste"}
          </p>
        </div>

        {selectedGenre && (
          <button 
            onClick={resetToHome}
            className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-red-600 hover:text-white transition-colors"
          >
            <ArrowLeft size={16} /> Return to Home
          </button>
        )}
      </div>

      {/* 2. Genre Buttons */}
      <div className="flex overflow-x-auto no-scrollbar gap-3 pb-2">
        {buttons.map((genre, index) => (
          <button 
            key={index} 
            onClick={() => handleGenreClick(genre)}
            className={`flex-none px-6 py-2 border rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
              selectedGenre === genre 
              ? "bg-red-600 border-red-600 text-white" 
              : "bg-zinc-900 border-white/10 hover:bg-red-600 hover:border-red-600"
            }`}
          >
            {genre}
          </button>
        ))}
      </div>

      {/* 3. Results / Home Logic */}
      {selectedGenre ? (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {isFiltering ? (
             <div className="py-20 text-center"><p className="text-red-600 font-black animate-pulse uppercase tracking-widest text-sm">Filtering...</p></div>
          ) : (
             <>
               <MovieRow title={`${selectedGenre} Results`} data={genreMovies} />
               
               <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8">
                 {hasMore && (
                   <button 
                    onClick={loadMore}
                    className="w-full sm:w-auto px-12 py-4 bg-white text-black text-xs font-black uppercase tracking-[0.3em] hover:bg-red-600 hover:text-white transition-all rounded-sm"
                   >
                     Load More
                   </button>
                 )}
                 <button 
                  onClick={resetToHome}
                  className="w-full sm:w-auto px-12 py-4 bg-zinc-900 text-white text-xs font-black uppercase tracking-[0.3em] hover:bg-zinc-800 transition-all rounded-sm border border-white/10 flex items-center justify-center gap-2"
                 >
                   <Home size={14} /> Back to Home
                 </button>
               </div>
             </>
          )}
        </div>
      ) : (
        <>
          <MovieRow title="Trending Movies & TV Shows" data={trending} />
          <MovieRow title="Top Rated Movies" data={topRated} />
          <MovieRow title="Recently Added Movies" data={recentlyAdded} />
        </>
      )}

      <style jsx="true">{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </section>
  );
};

export default MovieGrid;