import { Star, Play, Film, Tv } from "lucide-react";
import { Link } from "react-router-dom";

const MovieCard = ({
  id,
  poster,
  title,
  rating = 0,
  year,
  mediaType = "movie",
}) => {
  const route = `/movie/${id}/${mediaType}`;
  const score = parseFloat(rating) || 0;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700&display=swap');

        .movie-card {
          position: relative;
          border-radius: 14px;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,0.06);
          background: #111;
          transition: transform .35s cubic-bezier(.4,0,.2,1), border-color .35s ease, box-shadow .35s ease;
          cursor: pointer;
          font-family: 'Sora', sans-serif;
        }
        .movie-card:hover {
          transform: translateY(-5px) scale(1.02);
          border-color: rgba(212,168,83,0.35);
          box-shadow: 0 16px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(212,168,83,0.15);
        }

        .card-img {
          width: 100%; height: 100%; object-fit: cover;
          transition: transform .6s cubic-bezier(.4,0,.2,1);
        }
        .movie-card:hover .card-img { transform: scale(1.08); }

        /* Gradient overlay */
        .card-overlay {
          position: absolute; inset: 0;
          background: linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.2) 45%, transparent 70%);
          opacity: 0;
          transition: opacity .3s ease;
        }
        .movie-card:hover .card-overlay { opacity: 1; }

        /* Play button */
        .card-play {
          position: absolute; inset: 0;
          display: flex; align-items: center; justify-content: center;
          opacity: 0;
          transition: opacity .25s ease;
        }
        .movie-card:hover .card-play { opacity: 1; }
        .card-play-btn {
          width: 44px; height: 44px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          background: linear-gradient(135deg, #d4a853, #b8892f);
          box-shadow: 0 8px 24px rgba(212,168,83,0.5);
          transform: scale(0.8);
          transition: transform .25s cubic-bezier(.4,0,.2,1);
        }
        .movie-card:hover .card-play-btn { transform: scale(1); }

        /* Rating badge */
        .card-rating {
          position: absolute; top: 9px; right: 9px;
          display: flex; align-items: center; gap: 3px;
          padding: 3px 7px; border-radius: 7px;
          background: rgba(0,0,0,0.72);
          border: 1px solid rgba(255,255,255,0.1);
          backdrop-filter: blur(8px);
          font-size: 10px; font-weight: 700; color: white;
          font-family: 'Sora', sans-serif;
        }

        /* Type badge */
        .card-type {
          position: absolute; top: 9px; left: 9px;
          padding: 3px 8px; border-radius: 7px;
          background: rgba(212,168,83,0.12);
          border: 1px solid rgba(212,168,83,0.25);
          font-size: 8px; font-weight: 600;
          letter-spacing: .07em; text-transform: uppercase;
          color: #d4a853;
          font-family: 'Sora', sans-serif;
          backdrop-filter: blur(8px);
        }

        /* Bottom info (always visible) */
        .card-footer {
          padding: 10px 10px 10px;
          background: linear-gradient(to top, #0d0d0d 0%, rgba(13,13,13,0.9) 100%);
          border-top: 1px solid rgba(255,255,255,0.05);
        }
        .card-title {
          font-size: 10px; font-weight: 600;
          color: rgba(255,255,255,0.75);
          text-transform: uppercase; letter-spacing: .05em;
          truncate: true; overflow: hidden;
          white-space: nowrap; text-overflow: ellipsis;
          transition: color .2s;
          font-family: 'Sora', sans-serif;
        }
        .movie-card:hover .card-title { color: white; }
        .card-year {
          font-size: 9px; font-weight: 500;
          color: rgba(255,255,255,0.22);
          font-family: 'Sora', sans-serif;
        }

        /* Hover slide-up info */
        .card-hover-info {
          position: absolute; bottom: 0; left: 0; right: 0;
          padding: 10px 10px 12px;
          transform: translateY(4px);
          opacity: 0;
          transition: all .28s cubic-bezier(.4,0,.2,1);
        }
        .movie-card:hover .card-hover-info { transform: translateY(0); opacity: 1; }
      `}</style>

      <Link to={route} className="block">
        <div className="movie-card">
          {/* Poster */}
          <div className="relative overflow-hidden" style={{ aspectRatio: "2/3" }}>
            {poster ? (
              <img src={poster} alt={title} className="card-img" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-neutral-900">
                {mediaType === "tv" ? <Tv size={28} className="text-white/10" /> : <Film size={28} className="text-white/10" />}
              </div>
            )}

            {/* Overlays */}
            <div className="card-overlay" />

            {/* Type badge */}
            <div className="card-type">
              {mediaType === "tv" ? "Series" : "Film"}
            </div>

            {/* Rating badge */}
            {score > 0 && (
              <div className="card-rating">
                <Star size={9} fill="#d4a853" style={{ color: "#d4a853" }} />
                {score.toFixed(1)}
              </div>
            )}

            {/* Play button */}
            <div className="card-play">
              <div className="card-play-btn">
                <Play size={16} fill="black" className="text-black ml-0.5" />
              </div>
            </div>

            {/* Slide-up hover info */}
            <div className="card-hover-info">
              <p className="text-[10px] font-semibold text-white truncate leading-tight">{title}</p>
              {year && <p className="text-[9px] mt-0.5" style={{ color: "rgba(212,168,83,0.6)" }}>{year}</p>}
            </div>
          </div>

          {/* Footer */}
          <div className="card-footer">
            <p className="card-title">{title}</p>
            <p className="card-year">{year || "—"}</p>
          </div>
        </div>
      </Link>
    </>
  );
};

export default MovieCard;