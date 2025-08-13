import React from "react";
import './HeroBanner.css';

const HeroBanner = () => {
  return (
    <section className="hero">
      <div className="video-background">
        <iframe
          className="hero_video"
          src=""
          frameBorder="0"
          allow="autoplay; encrypted-media"
          allowFullScreen
          title="Hero Trailer Background"
        />
      </div>

      <div className="hero-content">
        <div>
          <span className="hero-meta"></span>
        </div>
        <h1 className="hero-title"></h1>

        <div className="hero-details"></div>

        <button className="hero-button">Watch Trailer</button>
        <button className="info-button">More Info</button>
      </div>

      <div className="trailer-modal">
        <div className="trailer-content">
          <button className="close-trailer">×</button>
          <iframe
            width="100%"
            height="400"
            src=""
            title="Trailer"
            frameBorder="0"
            allow="autoplay; encrypted-media"
            allowFullScreen
          />
        </div>
      </div>
    </section>
  );
};

export default HeroBanner;
