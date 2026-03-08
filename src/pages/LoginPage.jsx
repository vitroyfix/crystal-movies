import React, { useState, useEffect } from "react";
import {
  Facebook,
  Instagram,
  Youtube,
  Linkedin,
  Mail,
  Lock,
  AlertCircle,
  Loader2,
  Phone,
  ArrowLeft,
  CheckCircle2,
  Smartphone,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { auth, googleProvider } from "../firebase";
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  sendPasswordResetEmail,
} from "firebase/auth";
// Import your fetch functions
import { fetchTrending, fetchByGenre } from "../services/api.js";

const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");

  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState("login"); // "login", "otp", "reset", "phone-init"
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

  // EFFECT: Auto-changing background logic (matches SignUp page)
  useEffect(() => {
    let images = [...STATIC_BACKDROPS]; 
    let currentIndex = 0;

    const loadImages = async () => {
      try {
        const scifiMovies = await fetchByGenre(878);
        if (scifiMovies && scifiMovies.length > 0) {
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
        {
          size: "invisible",
        },
      );
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate("/");
    } catch (err) {
      setError("Invalid credentials. Please check your email and password.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!email) return setError("Please enter your email address first.");
    setError("");
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setSuccessMsg("Reset link sent! Check your inbox.");
      setTimeout(() => setView("login"), 5000);
    } catch (err) {
      setError("Failed to send reset email.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError("");
    try {
      await signInWithPopup(auth, googleProvider);
      navigate("/");
    } catch (err) {
      setError("Google Sign-In failed.");
    }
  };

  const handlePhoneLogin = async (e) => {
    e.preventDefault();
    if (!phone) return setError("Enter a valid phone number (+XX...)");
    setError("");
    setLoading(true);
    try {
      setupRecaptcha();
      const result = await signInWithPhoneNumber(
        auth,
        phone,
        window.recaptchaVerifier,
      );
      setConfirmationResult(result);
      setView("otp");
    } catch (err) {
      setError("Failed to send SMS. Use format: +1234567890");
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
      
      className="min-h-screen w-full flex items-center justify-center p-4 md:p-10 lg:p-20 bg-cover bg-center bg-fixed relative font-sans transition-all duration-[2000ms] ease-in-out"
      style={{
        backgroundImage: backdrop ? `url("${backdrop}")` : 'none',
        filter: backdrop ? 'brightness(1)' : 'brightness(0.5)'
      }}
    >
      <div id="recaptcha-container"></div>
      <div className="absolute inset-0 bg-black/75 z-0" />

      <div className="relative z-10 bg-zinc-950/40 backdrop-blur-3xl border border-white/10 rounded-sm shadow-2xl flex flex-col md:flex-row w-full max-w-md md:max-w-5xl overflow-hidden transition-all duration-500">
        {/* WELCOME SECTION */}
        <div className="md:order-2 flex-1 bg-gradient-to-b md:bg-gradient-to-br from-red-600/20 to-transparent p-8 md:p-16 flex flex-col justify-center text-center md:text-left border-b md:border-b-0 md:border-l border-white/10">
          <div className="max-w-xs mx-auto md:mx-0">
            <h2 className="text-2xl md:text-4xl font-black text-white uppercase tracking-tighter leading-tight mb-4">
              Welcome to{" "}
              <span className="text-red-600 md:block">Crystal Movies</span>
            </h2>
            <p className="text-[10px] md:text-sm text-gray-400 uppercase tracking-[0.2em] font-medium leading-relaxed mb-6 md:mb-10">
              Your gateway to premium 4K cinematic experiences.
            </p>
            <div className="hidden md:block pt-4">
              <p className="text-[10px] text-gray-500 uppercase tracking-[0.4em] mb-4">
                New here?
              </p>
              <Link
                to="/signup"
                className="inline-block px-10 py-3 border border-white/20 hover:bg-red-600 transition-all text-white font-black uppercase tracking-[0.2em] text-[10px] rounded-sm"
              >
                Register
              </Link>
            </div>
          </div>
        </div>

        {/* FORM SECTION */}
        <div className="md:order-1 flex-[1.2] p-8 md:p-16 flex flex-col justify-center bg-zinc-950/20">
          <div className="space-y-2 mb-8">
            <h1 className="text-xl md:text-3xl font-black text-white uppercase tracking-widest leading-none">
              {view === "reset"
                ? "Reset Access"
                : view === "phone-init"
                  ? "SMS Login"
                  : "Account Login"}
            </h1>
            <div className="h-1 w-8 bg-red-600"></div>
          </div>

          {error && (
            <div className="flex items-center gap-3 p-4 mb-6 bg-red-600/10 border border-red-600/50 rounded-sm text-red-500 text-[10px] uppercase font-bold tracking-widest">
              <AlertCircle size={14} /> {error}
            </div>
          )}

          {successMsg && (
            <div className="flex items-center gap-3 p-4 mb-6 bg-green-600/10 border border-green-600/50 rounded-sm text-green-500 text-[10px] uppercase font-bold tracking-widest">
              <CheckCircle2 size={14} /> {successMsg}
            </div>
          )}

          {/* MAIN EMAIL LOGIN VIEW */}
          {view === "login" && (
            <div className="space-y-6">
              <form onSubmit={handleLogin} className="space-y-6">
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-[10px] font-black text-red-600 uppercase tracking-widest">
                    <Mail size={12} /> Email Portal
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email address"
                    className="w-full px-4 py-3.5 rounded-sm bg-black/40 border border-white/10 text-white text-sm focus:border-red-600 outline-none"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="flex items-center gap-2 text-[10px] font-black text-red-600 uppercase tracking-widest">
                      <Lock size={12} /> Password
                    </label>
                    <button
                      type="button"
                      onClick={() => setView("reset")}
                      className="text-[9px] text-gray-500 hover:text-red-600 uppercase font-bold tracking-tighter"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-3.5 rounded-sm bg-black/40 border border-white/10 text-white text-sm focus:border-red-600 outline-none"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-[0.3em] text-[11px] rounded-sm transition-all flex justify-center items-center shadow-xl shadow-red-600/20"
                >
                  {loading ? (
                    <Loader2 className="animate-spin" size={16} />
                  ) : (
                    "Authorize"
                  )}
                </button>
              </form>

              <button
                onClick={() => setView("phone-init")}
                className="w-full text-[10px] text-gray-500 hover:text-white uppercase font-black tracking-widest flex items-center justify-center gap-2 transition-colors"
              >
                <Smartphone size={14} /> Forgot Email? Use Phone Number
              </button>
            </div>
          )}

          {/* OPTIONAL PHONE LOGIN VIEW */}
          {view === "phone-init" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <p className="text-[10px] text-gray-400 uppercase tracking-widest">
                Login using your verified mobile number.
              </p>
              <form onSubmit={handlePhoneLogin} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-red-600 uppercase tracking-widest">
                    Mobile Number
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1234567890"
                    className="w-full px-4 py-3.5 rounded-sm bg-black/40 border border-red-600 text-white text-sm outline-none"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 bg-red-600 text-white font-black uppercase tracking-widest text-[11px] flex justify-center shadow-xl shadow-red-600/20"
                >
                  {loading ? (
                    <Loader2 className="animate-spin" size={16} />
                  ) : (
                    "Send Access Code"
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setView("login")}
                  className="w-full flex items-center justify-center gap-2 text-[9px] text-gray-500 hover:text-white uppercase font-bold tracking-widest transition-colors"
                >
                  <ArrowLeft size={12} /> Back to Email
                </button>
              </form>
            </div>
          )}

          {/* RESET PASSWORD VIEW */}
          {view === "reset" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <p className="text-[10px] text-gray-400 uppercase tracking-widest leading-relaxed">
                Transmitting a secure link to your registered email.
              </p>
              <form onSubmit={handleForgotPassword} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-red-600 uppercase tracking-widest">
                    Target Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full px-4 py-3.5 rounded-sm bg-black/40 border border-red-600 text-white text-sm outline-none"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 bg-red-600 text-white font-black uppercase tracking-widest text-[11px] flex justify-center"
                >
                  {loading ? (
                    <Loader2 className="animate-spin" size={16} />
                  ) : (
                    "Transmit Reset Link"
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setView("login")}
                  className="w-full flex items-center justify-center gap-2 text-[9px] text-gray-500 hover:text-white uppercase font-bold transition-colors"
                >
                  <ArrowLeft size={12} /> Return
                </button>
              </form>
            </div>
          )}

          {/* OTP VERIFICATION VIEW */}
          {view === "otp" && (
            <div className="space-y-6 animate-in zoom-in duration-300">
              <div className="space-y-2 text-center">
                <label className="text-[10px] font-black text-red-600 uppercase tracking-widest">
                  SMS Secure Code
                </label>
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  className="w-full px-4 py-4 rounded-sm bg-black border border-red-600 text-white text-center text-2xl tracking-[0.5em] outline-none"
                  placeholder="000000"
                />
              </div>
              <button
                onClick={verifyOtp}
                disabled={loading}
                className="w-full py-4 bg-red-600 text-white font-black uppercase tracking-widest text-[11px] flex justify-center shadow-xl shadow-red-600/20"
              >
                {loading ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : (
                  "Verify Identity"
                )}
              </button>
              <button
                onClick={() => setView("phone-init")}
                className="w-full text-[9px] text-gray-500 hover:text-white uppercase font-bold"
              >
                Resend SMS
              </button>
            </div>
          )}

          {/* SOCIAL LOGIN PANEL */}
          {(view === "login" || view === "phone-init") && (
            <div className="pt-8 text-center space-y-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/5"></div>
                </div>
                <div className="relative flex justify-center text-[9px] uppercase tracking-widest text-gray-500 font-bold bg-transparent px-2">
                  <span className="bg-zinc-950/20 backdrop-blur-md px-2">
                    Social Auth
                  </span>
                </div>
              </div>
              <button
                onClick={handleGoogleLogin}
                className="w-full py-3 border border-white/10 hover:bg-white/5 text-white text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3"
              >
                <img
                  src="https://www.gstatic.com/images/branding/product/1x/gsa_64dp.png"
                  className="w-4 h-4"
                  alt="Google"
                />{" "}
                Sign in with Google
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoginPage;