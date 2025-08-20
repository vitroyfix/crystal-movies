import React from "react";
import { Link } from "react-router-dom";

const SignUp = () => {
  return (
    <div
      className="relative flex items-center justify-center min-h-screen bg-cover bg-center"
      style={{
        backgroundImage:
          "url('https://i.pinimg.com/736x/ea/51/8e/ea518e4f31a27163d214012fd282a7b1.jpg')",
      }}
    >
      
      {/* Form container */}
      <form className="relative z-10 bg-[rgba(0,0,0,0.2)] p-8 rounded-2xl shadow-lg w-full max-w-md">
        <h2 className="text-2xl font-bold text-white text-center mb-6">
          Create an Account
        </h2>

        {/* Username */}
        <div className="mb-4">
          <label htmlFor="username" className="block text-gray-300 mb-2">
            Username
          </label>
          <input
            type="text"
            id="username"
            placeholder="Enter username"
            className="w-full px-4 py-2 rounded-lg bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500"
            required
          />
        </div>

        {/* Email */}
        <div className="mb-4">
          <label htmlFor="email" className="block text-gray-300 mb-2">
            Email address
          </label>
          <input
            type="email"
            id="email"
            placeholder="Enter email address"
            className="w-full px-4 py-2 rounded-lg bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500"
            required
          />
        </div>

        {/* Password */}
        <div className="mb-4">
          <label htmlFor="password" className="block text-gray-300 mb-2">
            Password
          </label>
          <input
            type="password"
            id="password"
            placeholder="••••••••"
            className="w-full px-4 py-2 rounded-lg bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500"
            required
          />
        </div>

        {/* Confirm Password */}
        <div className="mb-6">
          <label htmlFor="confirm-password" className="block text-gray-300 mb-2">
            Confirm Password
          </label>
          <input
            type="password"
            id="confirm-password"
            placeholder="••••••••"
            className="w-full px-4 py-2 rounded-lg bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500"
            required
          />
        </div>

        {/* Button */}
        <button
          type="submit"
          className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition duration-300"
        >
          Create Account
        </button>

        {/* Sign in link */}
        <p className="text-white text-sm text-center mt-6">
          Already have an account?{" "}
          <Link to="/login" className="text-red-500 hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
};

export default SignUp;
