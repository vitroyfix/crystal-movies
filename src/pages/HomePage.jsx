import NavBar from "../components/layout/NavBar.jsx";
import MovieGrid from '../components/movies/MovieGrid.jsx'
import Footer from '../components/layout/Footer.jsx'
const HomePage = () => {
  return (
    <div>
      <NavBar /> 
      <MovieGrid/>
      <Footer />
    </div>
  );
};

export default HomePage;
