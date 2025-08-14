import {  Routes, Route } from 'react-router-dom';
import LoginPage from './pages/LoginPage.jsx';
import SignUp from './pages/SignUp.jsx';
import HomePage from './pages/HomePage.jsx';
import Profile from './pages/Profile.jsx';
import MovieDetails from './pages/MovieDetails.jsx';
import './App.css';

function App() {
  return (
      <Routes>
       <Route path="/" element={<HomePage />} />
       <Route path="/login" element={<LoginPage />} />
       <Route path="/signup" element={<SignUp />} />
       <Route path="/profile" element={<Profile />} />
       <Route path="/movie/:id" element={<MovieDetails />} />
      </Routes>
  );
}

export default App;