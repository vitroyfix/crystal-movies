import { Routes, Route } from "react-router-dom";
import { SearchProvider } from "./contexts/SearchContext.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import SignUp from "./pages/SignUp.jsx";
import HomePage from "./pages/HomePage.jsx";
import Profile from "./pages/Profile.jsx";
import MovieDetails from "./pages/MovieDetails.jsx";
import MovieGridPage from "./pages/MovieGridPage.jsx";
import "./App.css";

function App() {
  return (
    <SearchProvider>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/movie/:id/:mediaType?" element={<MovieDetails />} />
        <Route path="/movies" element={<MovieGridPage type="movie" />} />
        <Route path="/tv" element={<MovieGridPage type="tv" />} />
        <Route path="/top-rated" element={<MovieGridPage type="top_rated" />} />
        <Route path="/recent" element={<MovieGridPage type="recent" />} />
      </Routes>
    </SearchProvider>
  );
}

export default App;
