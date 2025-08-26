Movie Database App

This is a modern movie browsing application built with React and Vite. The app uses the TMDb API
 to display trending, popular, and upcoming movies. It includes search functionality, detailed movie pages, trailers, and user features such as watchlists and favorites.

Features

Search for movies in real time using the TMDb API

Browse trending, popular, and upcoming movies

View detailed information about each movie including cast and trailers

Watch trailers through YouTube embeds

Create a personal watchlist and favorites list (stored in localStorage)

User login and signup pages with profile management

Responsive layout for desktop and mobile devices

Smooth navigation using React Router

Loading skeletons for better user experience

Technology Stack

Frontend: React, Vite, jsx

Styling: Tailwind CSS and custom CSS

API: TMDb API and YouTube embeds

State Management: React Hooks (useState, useEffect, useContext)


Deployment: Vercel (or any preferred hosting)

Project Structure
src/
 ├── components/    
 ├── layout/         
 ├── pages/          
 ├── contexts/      
 ├── hooks/          
 ├── services/        
 ├── libraries/             
 ├── assets/          
 └── main.jsx


Create a .env file in the project root:

VITE_TMDB_API_KEY=your_tmdb_api_key
VITE_BASE_URL=https://api.themoviedb.org/3
VITE_YOUTUBE_API_KEY=your_youtube_api_key   # optional


Start the development server:

npm run dev

Roadmap

Add backend authentication (JWT, Firebase, or Supabase)

Advanced filtering by genre, release year, and rating

Support for TV shows

Separate cast and crew pages

User reviews and ratings

PWA support for offline usage

License

This project is licensed under the MIT License.
