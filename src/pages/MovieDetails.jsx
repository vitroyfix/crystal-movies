import React from 'react';

const MovieDetails = ({ movie }) => {
 if(!movie){
    return<p>Loading movie details......</p>
 };
  const {    
    poster,
    title,
    badgeYear,
    rating,
    runtime,
    votes,
    plot
  } = movie;
 const titles = [
    "director", "language", "cast"
 ];
  const star = Math.round(rating);

  return (
    <div>
      <div>
        <img src={poster} alt={title} />
      </div>
      <div>
        <h1>{title}</h1>
      </div>
      <div>
        <span>{badgeYear}</span>
      </div>
      <div>
        <span>{runtime}</span>
      </div>
      <div>
        <span>{votes}</span>
      </div>
      <div>
        <p>{plot}</p>
      </div>
      <div>
        <p>{star}</p>
      </div>
      <div>
        {titles.map((item, index) =>(
        <h2 key={index}>{item}</h2> 
        ))}
      </div>
    </div>
  );
};

export default MovieDetails;
