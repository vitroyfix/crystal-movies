import React from 'react';
import { Link } from 'react-router-dom';

const SignUp = () => {

  return (
    <div className="signup-container">
      <form className="signup-form">
        <div className="form-group">
          <label htmlFor="username" className="form-label">Username</label>
          <input
            type="text"
            id="username"
            placeholder="Input username"
            className="form-input"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="email" className="form-label">Email address</label>
          <input
            type="email"
            id="email"
            placeholder="Input email address"
            className="form-input"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="password" className="form-label">Password</label>
          <input
            type="password"
            id="password"
            placeholder="•••••"
            className="form-input"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="confirm-password" className="form-label">Confirm Password</label>
          <input
            type="password"
            id="confirm-password"
            placeholder="•••••"
            className="form-input"
            required
          />
        </div>

        <div className="form-group">
          <button type="submit" className="signup-button">
            Create Account
          </button>
        </div>

        <div className="signin-prompt">
          <p>
            Do you have an account? <Link to="/login" className="signin-link">Sign in</Link>
          </p>
        </div>
      </form>
    </div>
  );
};

export default SignUp;
