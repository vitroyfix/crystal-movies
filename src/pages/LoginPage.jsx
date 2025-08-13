import React from 'react';
import { Facebook, Instagram, Youtube, Linkedin } from 'lucide-react';
import { Link } from 'react-router-dom';

const LoginPage = () => {

  return (
    <div className="login-container">
      <form className="login-form">
        <div className="login-header">
          <h1 className="login-title">LOGIN</h1>
        </div>

        <div className="form-group">
          <label htmlFor="email" className="form-label">Email</label>
          <input
            type="email"
            id="email"
            name="email"
            placeholder="Email address"
            className="form-input"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="password" className="form-label">Password</label>
          <input
            type="password"
            id="password"
            name="password"
            placeholder="•••••"
            className="form-input"
            required
          />
        </div>

        <div>
          <p>
            <input type="checkbox" /> Remember me
          </p>
        </div>

        <div className="form-group">
          <button type="submit" className="login-button">
            Login
          </button>
        </div>

        <div className="social-icons">
          <Facebook className="social-icon" />
          <Instagram className="social-icon" />
          <Youtube className="social-icon" />
          <Linkedin className="social-icon" />
        </div>
      </form>

      <div className="welcome-form">
        <div className="welcome-header">
          <h1 className="welcome-title">Welcome to Crystal Movies!</h1>
        </div>

        <div className="welcome-message">
          <p>Sign in to explore your favorite movies and get personalized recommendations.</p>
        </div>

        <div className="signup-prompt">
          <p>
            Don't have an account? <Link to="/signup">Sign up</Link>
          </p>
        </div>

        <div>
          <p>
            By logging in, you agree to our{' '}
            <a href="/terms" target="_blank" rel="noopener noreferrer">Terms and Conditions</a> and{' '}
            <a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
