import { Facebook, Youtube, Twitter, Instagram } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="footer">
      <div className="footer-about">
        <h1>Crystal Movies</h1>
        <p>
          Your ultimate destination for discovering and exploring the world of
          cinema. From blockbusters to indie gems, we've got it all.
        </p>
      </div>

      <div className="footer-social">
        <h6>Follow Us</h6>
        <div className="social-icons">
          <Facebook size={24} />
          <Youtube size={24} />
          <Twitter size={24} />
          <Instagram size={24} />
        </div>
      </div>

      <div className="footer-support">
        <h6>Support</h6>
        <ul>
          <li>Help Center</li>
          <li>Contact Us</li>
          <li>Privacy Policy</li>
          <li>Terms of Service</li>
        </ul>
      </div>

      <div className="footer-company">
        <h6>Company</h6>
        <ul>
          <li>About Us</li>
          <li>Careers</li>
          <li>Press</li>
          <li>Blog</li>
        </ul>
      </div>

      <div className="footer-discover">
        <h6>Discover</h6>
        <ul>
          <li>New Releases</li>
          <li>Top Rated</li>
          <li>Trending</li>
        </ul>
      </div>

      <div className="footer-contact">
        <h6>Contact</h6>
        <p>contact@moviedb.com</p>
        <p>+1 (555) 123-4567</p>
        <p>Nairobi</p>
      </div>

      <div className="footer-bottom">
        <p>
          &copy; {new Date().getFullYear()} Crystal Movies. All rights reserved. Built with passion for
          cinema lovers.
        </p>

      </div>
    </footer>
  );
};

export default Footer;
