import React, { useState } from "react";
import { useHeroBanner } from "../hooks/useHeroBanner";
import { Volume2, VolumeX, Undo, Play } from "lucide-react";

const HeroBanner = () => {
  const { movie, videoIds, trailerKey } = useHeroBanner();
  const [showTrailer, setShowTrailer] = useState(false);
  const [muted, setMuted] = useState(true);

  if (!movie) return <div className="text-white">Loading hero banner...</div>;

  return (
    <section className="relative h-[75vh] text-white">
      {/* Background */}
      {videoIds.length > 0 ? (
        <iframe
          src={`https://www.youtube.com/embed/${videoIds[0]}?autoplay=1&mute=${muted ? 1 : 0}&loop=1&playlist=${videoIds.join(
            ","
          )}&controls=0&modestbranding=1&rel=0`}
          className="absolute top-0 left-0 w-full h-full object-cover -z-10"
          title="Background Clip"
          allow="autoplay; encrypted-media"
        />
      ) : (
        <img
          src={movie.poster}
          alt={movie.title}
          className="absolute top-0 left-0 w-full h-full object-cover -z-10"
        />
      )}

      {/* Gradient Overlay */}
      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-t from-black via-black/40 to-transparent -z-10" />

      {/* Content */}
      <div className="relative px-8 lg:px-16 max-w-xl top-1/3">
        <h1 className="text-4xl md:text-6xl font-bold mb-4">{movie.title}</h1>
        <p className="text-lg text-gray-200 mb-6">{movie.plot}</p>

        <div className="flex items-center space-x-4">
          {/* Play Now */}
          <button
            onClick={() => setShowTrailer(true)}
            className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-black px-6 py-3 rounded-lg font-semibold"
          >
            <Play size={20} /> Play Now
          </button>

          {/* Mute / Unmute */}
          {videoIds.length > 0 && (
            <button
              onClick={() => setMuted(!muted)}
              className="flex items-center gap-2 bg-gray-800/70 px-4 py-3 rounded-lg hover:bg-gray-700"
            >
              {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
              {muted ? "Unmute" : "Mute"}
            </button>
          )}
        </div>
      </div>

      {/* Trailer Modal */}
      {showTrailer && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="relative w-11/12 max-w-4xl">
            <button
              onClick={() => setShowTrailer(false)}
              className="absolute -top-12 right-0 text-white text-2xl"
            >
              <Undo />
            </button>
            <iframe
              width="100%"
              height="500"
              src={`https://www.youtube.com/embed/${trailerKey}?autoplay=1`}
              title="Movie Trailer"
              allow="autoplay; encrypted-media"
              allowFullScreen
              className="rounded-lg"
            />
          </div>
        </div>
      )}
    </section>
  );
};

export default HeroBanner;
