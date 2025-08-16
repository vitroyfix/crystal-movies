import React, { useState } from "react";
import { useHeroBanner } from "../hooks/useHeroBanner";
import { Music, Speaker, Undo} from "lucide-react";

const HeroBanner = () => {
  const { movie, videoIds, trailerKey } = useHeroBanner();
  const [showTrailer, setShowTrailer] = useState(false);
  const [muted, setMuted] = useState(true);

  if (!movie) return <div className="hero-loading">Loading hero banner...</div>;

  return (
    <section className="hero" style={{ position: "relative", height: "70vh" }}>
    
      {videoIds.length > 0 ? (
        <iframe
          src={`https://www.youtube.com/embed/${videoIds[0]}?autoplay=1&mute=${muted ? 1 : 0}&loop=1&playlist=${videoIds.join(
            ","
          )}&controls=0&modestbranding=1&showinfo=0`}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            zIndex: -1,
            border: "none",
          }}
          title="Background Clip"
          allow="autoplay; encrypted-media"
        />
      ) : (
        <img
          src={movie.backdrop}
          alt={movie.title}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            zIndex: -1,
          }}
        />
      )}

      <div style={{ padding: "2rem", color: "white", maxWidth: "600px" }}>
        <h1 style={{ fontSize: "3rem", marginBottom: "1rem" }}>{movie.title}</h1>
        <p style={{ fontSize: "1.2rem", marginBottom: "1.5rem" }}>{movie.overview}</p>

        {trailerKey && (
          <button
            onClick={() => setShowTrailer(true)}
            style={{
              padding: "10px 20px",
              backgroundColor: "#ff0000",
              border: "none",
              color: "white",
              fontSize: "1rem",
              cursor: "pointer",
              borderRadius: "5px",
              marginRight: "10px",
            }}
          >
            Watch Trailer
          </button>
        )}

        {videoIds.length > 0 && (
          <button
            onClick={() => setMuted(!muted)}
            style={{
              padding: "10px 20px",
              backgroundColor: "#000000aa",
              border: "none",
              color: "white",
              fontSize: "1rem",
              cursor: "pointer",
              borderRadius: "5px",
              display: "flex",
              alignItems: "center",
              gap: "5px",
            }}
          >
            {muted ? <Speaker size={16} /> : <Music size={16} />}
            {muted ? "Unmute" : "Mute"}
          </button>
        )}
      </div>

      {showTrailer && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(0,0,0,0.8)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
          }}
        >
          <div style={{ position: "relative", width: "80%", maxWidth: "900px" }}>
            <button
              onClick={() => setShowTrailer(false)}
              style={{
                position: "absolute",
                top: "-40px",
                right: 0,
                background: "none",
                color: "white",
                fontSize: "2rem",
                border: "none",
                cursor: "pointer",
              }}
            >
            <Undo/>
            </button>
            <iframe
              width="100%"
              height="500"
              src={`https://www.youtube.com/embed/${trailerKey}?autoplay=1`}
              title="Movie Trailer"
              frameBorder="0"
              allow="autoplay; encrypted-media"
              allowFullScreen
            />
          </div>
        </div>
      )}
    </section>
  );
};

export default HeroBanner;
