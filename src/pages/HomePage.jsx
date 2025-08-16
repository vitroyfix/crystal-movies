import NavBar from "../components/layout/NavBar.jsx";
import MovieGrid from '../components/movies/MovieGrid.jsx'
import Footer from '../components/layout/Footer.jsx';
import HeroBanner from '../components/HeroBanner.jsx'
const HomePage = () => {
  return (
    <div>
      <NavBar /> 
      <HeroBanner/>
      <MovieGrid/>
      <Footer />
    </div>
  );
};

export default HomePage;
