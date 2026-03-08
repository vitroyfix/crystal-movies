import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  User,
  Mail,
  Lock,
  AlertCircle,
  Loader2,
  Phone,
} from "lucide-react";
import { auth, googleProvider } from "../firebase";
import {
  createUserWithEmailAndPassword,
  updateProfile,
  signInWithPopup,
  RecaptchaVerifier,
  signInWithPhoneNumber,
} from "firebase/auth";
// Import your fetch functions
import { fetchTrending, fetchByGenre } from "../services/api.js"; 

const SignUp = () => {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState(null);
  
  // State to hold the dynamic background
  const [backdrop, setBackdrop] = useState("");

  const navigate = useNavigate();

  // LIST OF FALLBACK IMAGES (Local assets from public folder)
  const STATIC_BACKDROPS = [
    "/uwp4990871.jpeg",
    "/uwp4991010.jpeg",
    "/uwp4991044.jpeg",
    "/wp1945900-movie-posters-wallpapers.jpg"
  ];

  // EFFECT: Auto-changing background logic (matches Login smoothing)
  useEffect(() => {
    let images = [...STATIC_BACKDROPS]; 
    let currentIndex = 0;

    const loadImages = async () => {
      try {
        const scifiMovies = await fetchByGenre(878);
        if (scifiMovies && scifiMovies.length > 0) {
          // Construct full TMDB URLs to ensure backgrounds load and transition
          const apiImages = scifiMovies
            .map(movie => movie.backdrop_path ? `https://image.tmdb.org/t/p/original${movie.backdrop_path}` : null)
            .filter(img => img !== null);
          
          if (apiImages.length > 0) {
            images = apiImages;
          }
        }
      } catch (err) {
        console.warn("API Background fetch failed, using static fallbacks.");
      }
      setBackdrop(images[0]);
    };

    loadImages();

    const interval = setInterval(() => {
      currentIndex = (currentIndex + 1) % images.length;
      setBackdrop(images[currentIndex]);
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const setupRecaptcha = () => {
    if (!window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(
        auth,
        "recaptcha-container",
        { size: "invisible" }
      );
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) return setError("Passwords do not match.");
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(userCredential.user, { displayName: username });
      navigate("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
      navigate("/");
    } catch (err) {
      setError("Google Sign-In failed.");
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneSignIn = async () => {
    if (!phone) return setError("Please enter a phone number to use SMS verification.");
    setError("");
    setLoading(true);
    try {
      setupRecaptcha();
      const result = await signInWithPhoneNumber(auth, phone, window.recaptchaVerifier);
      setConfirmationResult(result);
      setShowOtpInput(true);
    } catch (err) {
      setError("Failed to send SMS.");
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    setLoading(true);
    try {
      await confirmationResult.confirm(otp);
      navigate("/");
    } catch (err) {
      setError("Invalid OTP code.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center p-4 md:p-10 bg-zinc-950 bg-cover bg-center bg-fixed relative font-sans transition-all duration-[2000ms] ease-in-out"
      style={{
        backgroundImage: backdrop ? `url("${backdrop}")` : 'none',
        filter: backdrop ? 'brightness(1)' : 'brightness(0.5)'
      }}
    >
      <div id="recaptcha-container"></div>
      
      {/* Constant dark overlay to ensure images "glow" out of the darkness */}
      <div className="absolute inset-0 bg-black/80  z-0" />

      <div className="relative z-10 bg-zinc-900/40 backdrop-blur-3xl border border-white/10 rounded-sm shadow-2xl flex flex-col md:flex-row w-full max-w-md md:max-w-5xl overflow-hidden transition-all duration-500">
        
        {/* WELCOME SECTION */}
        <div className="md:order-2 flex-1 bg-gradient-to-br from-red-600/20 to-transparent p-8 md:p-16 flex flex-col justify-center text-center md:text-left border-b md:border-b-0 md:border-l border-white/10">
          <div className="max-w-xs mx-auto md:mx-0">
            <h2 className="text-2xl md:text-4xl font-black text-white uppercase tracking-tighter leading-tight mb-4">
              Join <span className="text-red-600 md:block">Crystal Movies</span>
            </h2>
            <p className="text-[10px] md:text-sm text-gray-400 uppercase tracking-[0.2em] font-medium leading-relaxed mb-10">
              Unlock exclusive 4K content and personalized watchlists.
            </p>

            <div className="hidden md:block pt-4">
              <p className="text-[10px] text-gray-500 uppercase tracking-[0.4em] mb-4">
                Already a member?
              </p>
              <Link
                to="/login"
                className="inline-block px-10 py-3 border border-white/20 hover:bg-red-600 transition-all text-white font-black uppercase tracking-[0.2em] text-[10px] rounded-sm"
              >
                Login Portal
              </Link>
            </div>
          </div>
        </div>

        {/* SIGNUP FORM SECTION */}
        <div className="md:order-1 flex-[1.2] p-8 md:p-12 flex flex-col justify-center bg-zinc-950/20">
          <div className="mb-6 space-y-2">
            <h1 className="text-xl md:text-2xl font-black text-white uppercase tracking-widest">
              Register Account
            </h1>
            <div className="h-1 w-8 bg-red-600"></div>
          </div>

          {error && (
            <div className="flex items-center gap-3 p-3 mb-4 bg-red-600/10 border border-red-600/50 rounded-sm text-red-500 text-[10px] uppercase font-bold">
              <AlertCircle size={14} /> {error}
            </div>
          )}

          {!showOtpInput ? (
            <form onSubmit={handleSignUp} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-red-600 uppercase tracking-widest flex items-center gap-1">
                    <User size={10} /> User
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-sm bg-black/40 border border-white/10 text-white text-sm focus:border-red-600 outline-none"
                    placeholder="Username"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-red-600 uppercase tracking-widest flex items-center gap-1">
                    <Mail size={10} /> Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-sm bg-black/40 border border-white/10 text-white text-sm focus:border-red-600 outline-none"
                    placeholder="Email"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black text-red-600 uppercase tracking-widest flex items-center gap-1">
                  <Phone size={10} /> Phone <span className="text-[7px] text-gray-500 lowercase">(optional)</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="flex-grow px-4 py-2.5 rounded-sm bg-black/40 border border-white/10 text-white text-sm focus:border-red-600 outline-none"
                    placeholder="+123..."
                  />
                  <button
                    type="button"
                    onClick={handlePhoneSignIn}
                    className="px-4 bg-white/5 border border-white/10 text-[9px] uppercase font-bold hover:bg-white/10 text-white transition-all"
                  >
                    SMS
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-sm bg-black/40 border border-white/10 text-white text-sm focus:border-red-600 outline-none"
                  placeholder="Password"
                  required
                />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-sm bg-black/40 border border-white/10 text-white text-sm focus:border-red-600 outline-none"
                  placeholder="Confirm"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-[0.3em] text-[10px] rounded-sm transition-all flex justify-center items-center shadow-lg shadow-red-600/20"
              >
                {loading ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : (
                  "Initiate Membership"
                )}
              </button>
            </form>
          ) : (
            <div className="space-y-4 animate-in fade-in duration-500">
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                className="w-full px-4 py-4 rounded-sm bg-black border border-red-600 text-white text-center text-xl tracking-[0.5em] outline-none"
                placeholder="000000"
              />
              <button
                onClick={verifyOtp}
                className="w-full py-4 bg-red-600 text-white font-black uppercase tracking-widest text-[10px]"
              >
                Verify & Register
              </button>
              <button 
                onClick={() => setShowOtpInput(false)}
                className="w-full text-[9px] text-gray-500 uppercase font-bold"
              >
                Cancel SMS Login
              </button>
            </div>
          )}

          <div className="pt-6 text-center space-y-4">
            <button
              onClick={handleGoogleSignUp}
              className="w-full py-3 border border-white/10 hover:bg-white/5 text-white text-[9px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3"
            >
              <img
                src="https://www.gstatic.com/images/branding/product/1x/gsa_64dp.png"
                className="w-4 h-4"
                alt="Google"
              />{" "}
              Continue with Google
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignUp;