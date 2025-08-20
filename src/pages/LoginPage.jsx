import React from 'react';
import { Facebook, Instagram, Youtube, Linkedin } from 'lucide-react';
import { Link } from 'react-router-dom';


const LoginPage = () => {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-6 bg-cover bg-center relative"
      style={{ backgroundImage: "url('https://i.pinimg.com/736x/ea/51/8e/ea518e4f31a27163d214012fd282a7b1.jpg')" }}
    >

      <div className="relative z-10 bg-[rgba(0,0,0,0.25)] backdrop-blur-lg rounded-2xl shadow-lg flex flex-col md:flex-row w-full max-w-5xl overflow-hidden">
        
        {/* Login Form */}
        <form className="flex-1 p-8 md:p-12 flex flex-col justify-center">
          <h1 className="text-3xl font-bold text-white mb-6 text-center md:text-left">LOGIN</h1>

          {/* Email */}
          <div className="mb-4">
            <label htmlFor="email" className="block text-gray-300 mb-2">Email</label>
            <input
              type="email"
              id="email"
              placeholder="Email address"
              className="w-full px-4 py-2 rounded-lg bg-gray-800 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500"
              required
            />
          </div>

          {/* Password */}
          <div className="mb-4">
            <label htmlFor="password" className="block text-gray-300 mb-2">Password</label>
            <input
              type="password"
              id="password"
              placeholder="••••••••"
              className="w-full px-4 py-2 rounded-lg bg-gray-800 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500"
              required
            />
          </div>

          {/* Remember me */}
          <div className="flex items-center text-gray-300 text-sm mb-6">
            <input type="checkbox" id="remember" className="mr-2" />
            <label htmlFor="remember">Remember me</label>
          </div>

          {/* Button */}
          <button
            type="submit"
            className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition duration-300"
          >
            Login
          </button>

          {/* Social Icons */}
          <div className="flex justify-center space-x-6 mt-6 text-white">
            <Facebook className="cursor-pointer hover:text-red-500" />
            <Instagram className="cursor-pointer hover:text-red-500" />
            <Youtube className="cursor-pointer hover:text-red-500" />
            <Linkedin className="cursor-pointer hover:text-red-500" />
          </div>
        </form>

        {/* Welcome Section */}
        <div className="flex-1 bg-[rgba(0,0,0,0.2)] p-8 md:p-12 flex flex-col justify-center text-center md:text-left">
          <h1 className="text-2xl font-bold text-white mb-4">Welcome to Crystal Movies!</h1>
          <p className="text-gray-300 mb-6">
            Sign in to explore your favorite movies and get personalized recommendations.
          </p>

          <p className="text-white mb-6">
            Don&apos;t have an account?{" "}
            <Link to="/signup" className="text-red-500 hover:underline">
              Sign up
            </Link>
          </p>

          <p className="text-xs text-white">
            By logging in, you agree to our{" "}
            <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-red-400 hover:underline">
              Terms and Conditions
            </a>{" "}
            and{" "}
            <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-red-400 hover:underline">
              Privacy Policy
            </a>.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
