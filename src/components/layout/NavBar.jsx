import { Search, User } from 'lucide-react';
import React from 'react';
import { Link } from 'react-router-dom';

const NavBar = () => {
  const navBarLinks = [
    { label: "Home", link: "#" },
    { label: "Movies", link: "#" },
    { label: "Tv Shows", link: "#" },
    { label: "Top rated", link: "#" },
    { label: "Recently added", link: "#" },
  ];

  return (
    <div> 
        <div>
        <ul>
            {navBarLinks.map((item, index) => (
            <li key={index}>
                <a href={item.link}>{item.label}</a>
            </li>
            ))}
        </ul>
        </div>
        <div>
            <input type="text" placeholder="Search movies, tv shows ...." />
            <Search/>
        </div>
        <div>
            <button>
                <Link to="/login"></Link>
            </button>
        </div>
        <div>
          <Link to="/profile"><User/></Link>
        </div>
    </div>
  );
};

export default NavBar;
