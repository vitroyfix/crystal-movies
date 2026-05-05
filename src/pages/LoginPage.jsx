import React, { useState, useEffect } from "react";
import {
  Mail, Lock, AlertCircle, Loader2, Phone,
  ArrowLeft, CheckCircle2, Smartphone, Eye, EyeOff,
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
import { fetchByGenre } from "../services/api.js";

const LoginPage = () => {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone]       = useState("");
  const [otp, setOtp]           = useState("");
  const [showPass, setShowPass] = useState(false);

  const [error, setError]         = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading]     = useState(false);
  const [view, setView]           = useState("login");
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [backdrop, setBackdrop]   = useState("");

  const navigate = useNavigate();

  const STATIC_BACKDROPS = [
    "/uwp4990871.jpeg","/uwp4991010.jpeg","/uwp4991044.jpeg","/wp1945900-movie-posters-wallpapers.jpg"
  ];

  useEffect(() => {
    let images = [...STATIC_BACKDROPS];
    let currentIndex = 0;
    const loadImages = async () => {
      try {
        const movies = await fetchByGenre(878);
        const apiImages = (movies || [])
          .map(m => m.backdrop_path ? `https://image.tmdb.org/t/p/original${m.backdrop_path}` : null)
          .filter(Boolean);
        if (apiImages.length > 0) images = apiImages;
      } catch {}
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
      window.recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", { size: "invisible" });
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault(); setError(""); setLoading(true);
    try { await signInWithEmailAndPassword(auth, email, password); navigate("/"); }
    catch { setError("Invalid credentials. Please check your email and password."); }
    finally { setLoading(false); }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!email) return setError("Please enter your email address first.");
    setError(""); setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email, { url: "https://crystalmovies.vercel.app/login", handleCodeInApp: true });
      setSuccessMsg("Reset link sent. Check your inbox.");
      setTimeout(() => { setSuccessMsg(""); setView("login"); }, 5000);
    } catch { setError("Could not send reset email. Please verify the address."); }
    finally { setLoading(false); }
  };

  const handleGoogleLogin = async () => {
    setError("");
    try { await signInWithPopup(auth, googleProvider); navigate("/"); }
    catch { setError("Google Sign-In failed."); }
  };

  const handlePhoneLogin = async (e) => {
    e.preventDefault();
    if (!phone) return setError("Enter a valid phone number (+XX...)");
    setError(""); setLoading(true);
    try {
      setupRecaptcha();
      const result = await signInWithPhoneNumber(auth, phone, window.recaptchaVerifier);
      setConfirmationResult(result); setView("otp");
    } catch { setError("Failed to send SMS. Use format: +1234567890"); }
    finally { setLoading(false); }
  };

  const verifyOtp = async () => {
    setLoading(true);
    try { await confirmationResult.confirm(otp); navigate("/"); }
    catch { setError("Invalid OTP code."); }
    finally { setLoading(false); }
  };

  const viewLabel = { login: "Sign In", reset: "Reset Password", "phone-init": "Phone Login", otp: "Verify Code" };

  return (
    <div
      className="auth-root min-h-screen w-full flex items-center justify-center p-4 md:p-10 lg:p-20 relative"
      style={{ fontFamily: "'Sora', sans-serif" }}
    >
      <div id="recaptcha-container" />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=Playfair+Display:ital,wght@0,700;1,400;1,700&display=swap');

        .auth-root { background: #080808; }

        /* Backdrop */
        .auth-bg {
          position: fixed; inset: 0; z-index: 0;
          background-size: cover; background-position: center;
          transition: background-image 2s ease-in-out;
          filter: brightness(0.32) saturate(1.1);
        }
        .auth-bg::after {
          content: '';
          position: absolute; inset: 0;
          background: linear-gradient(135deg, rgba(8,8,8,0.96) 0%, rgba(8,8,8,0.6) 60%, rgba(8,8,8,0.82) 100%);
        }

        /* Noise */
        .auth-noise::before {
          content: '';
          position: fixed; inset: 0; z-index: 1; pointer-events: none;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
          background-size: 180px;
          opacity: 0.028;
        }

        /* Card */
        .auth-card {
          background: rgba(10,10,10,0.82);
          border: 1px solid rgba(255,255,255,0.07);
          backdrop-filter: blur(32px);
          box-shadow: 0 40px 100px rgba(0,0,0,0.75), 0 0 0 1px rgba(255,255,255,0.04);
        }

        /* Input */
        .auth-input {
          width: 100%;
          padding: 13px 16px;
          border-radius: 12px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.09);
          color: white;
          font-size: 13px;
          font-family: 'Sora', sans-serif;
          outline: none;
          transition: border-color .2s, background .2s;
        }
        .auth-input::placeholder { color: rgba(255,255,255,0.22); }
        .auth-input:focus {
          border-color: rgba(212,168,83,0.5);
          background: rgba(212,168,83,0.04);
        }

        /* Gold primary button */
        .btn-gold {
          width: 100%; padding: 14px;
          border-radius: 12px;
          background: linear-gradient(135deg, #d4a853 0%, #b8892f 100%);
          color: black;
          font-size: 11px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase;
          font-family: 'Sora', sans-serif;
          box-shadow: 0 8px 28px rgba(212,168,83,0.32), inset 0 1px 0 rgba(255,255,255,0.2);
          transition: all .22s cubic-bezier(.4,0,.2,1);
          display: flex; align-items: center; justify-content: center; gap: 8px;
        }
        .btn-gold:hover { box-shadow: 0 14px 40px rgba(212,168,83,0.48), inset 0 1px 0 rgba(255,255,255,0.2); transform: translateY(-1px); }
        .btn-gold:active { transform: scale(.98); }
        .btn-gold:disabled { opacity: .6; transform: none; }

        /* Glass secondary button */
        .btn-glass-auth {
          width: 100%; padding: 13px;
          border-radius: 12px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          color: rgba(255,255,255,0.55);
          font-size: 11px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase;
          font-family: 'Sora', sans-serif;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          transition: all .2s ease;
        }
        .btn-glass-auth:hover { background: rgba(255,255,255,0.08); color: white; border-color: rgba(255,255,255,0.17); }

        /* Alert */
        .auth-error {
          display: flex; align-items: center; gap: 10px;
          padding: 12px 16px; border-radius: 12px;
          background: rgba(239,68,68,0.08);
          border: 1px solid rgba(239,68,68,0.25);
          color: #fca5a5;
          font-size: 11px; font-weight: 500; letter-spacing: .03em;
        }
        .auth-success {
          display: flex; align-items: center; gap: 10px;
          padding: 12px 16px; border-radius: 12px;
          background: rgba(34,197,94,0.08);
          border: 1px solid rgba(34,197,94,0.25);
          color: #86efac;
          font-size: 11px; font-weight: 500;
        }

        /* Divider */
        .auth-divider {
          display: flex; align-items: center; gap: 12px;
          color: rgba(255,255,255,0.18);
          font-size: 9px; font-weight: 600; letter-spacing: .15em; text-transform: uppercase;
        }
        .auth-divider::before, .auth-divider::after {
          content: ''; flex: 1;
          height: 1px; background: rgba(255,255,255,0.07);
        }

        /* Label */
        .auth-label {
          display: flex; align-items: center; gap: 6px;
          font-size: 9px; font-weight: 600; letter-spacing: .12em; text-transform: uppercase;
          color: rgba(212,168,83,0.75);
          margin-bottom: 8px;
        }

        @keyframes fadeUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        .view-in { animation: fadeUp .35s cubic-bezier(.4,0,.2,1) forwards; }

        /* OTP input */
        .otp-input {
          width: 100%; padding: 18px;
          border-radius: 14px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(212,168,83,0.35);
          color: white;
          font-size: 24px; letter-spacing: .6em; text-align: center;
          font-family: 'Sora', sans-serif;
          outline: none;
          transition: border-color .2s;
        }
        .otp-input:focus { border-color: rgba(212,168,83,0.7); background: rgba(212,168,83,0.04); }
      `}</style>

      {/* Backdrop */}
      <div className="auth-noise auth-bg" style={{ backgroundImage: backdrop ? `url("${backdrop}")` : "none" }} />

      {/* Radial gold glow */}
      <div className="fixed inset-0 z-[1] pointer-events-none" style={{ background: "radial-gradient(ellipse at 20% 55%, rgba(212,168,83,0.04) 0%, transparent 55%)" }} />

      {/* ── Card ─────────────────────────────────────────────────────────────── */}
      <div className="relative z-10 auth-card rounded-2xl flex flex-col md:flex-row w-full max-w-md md:max-w-4xl overflow-hidden">

        {/* ── Welcome panel ──────────────────────────────────────────────────── */}
        <div
          className="md:order-2 flex-1 p-8 md:p-14 flex flex-col justify-center text-center md:text-left border-b md:border-b-0 md:border-l"
          style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(212,168,83,0.025)" }}>
          <div className="max-w-xs mx-auto md:mx-0 space-y-5">
            {/* Gold bar + title */}
            <div className="flex items-center gap-3 justify-center md:justify-start">
              <div className="w-0.5 h-8 rounded-full bg-amber-400 flex-shrink-0" />
              <h2 className="font-display font-bold text-white leading-tight" style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(1.6rem, 3vw, 2.4rem)", fontStyle: "italic" }}>
                Crystal<br /><span style={{ color: "#d4a853" }}>Movies</span>
              </h2>
            </div>
            <p className="text-[11px] text-white/35 leading-relaxed tracking-wide">
              Your gateway to premium 4K cinematic experiences. Sign in to access your watchlist and resume where you left off.
            </p>

            {/* Stats row */}
            <div className="hidden md:flex gap-5 pt-2">
              {[["4K", "Ultra HD"], ["∞", "Titles"], ["0", "Ads"]].map(([val, lbl]) => (
                <div key={lbl} className="text-center">
                  <p className="text-sm font-bold text-white/80" style={{ color: "#d4a853" }}>{val}</p>
                  <p className="text-[9px] uppercase tracking-widest text-white/22 mt-0.5">{lbl}</p>
                </div>
              ))}
            </div>

            <div className="hidden md:block pt-3">
              <p className="text-[9px] uppercase tracking-[0.4em] text-white/22 mb-4">New here?</p>
              <Link to="/signup"
                className="inline-flex items-center px-8 py-3 rounded-xl text-[10px] font-semibold uppercase tracking-wider text-white/55 hover:text-white transition-all"
                style={{ border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)" }}>
                Create Account
              </Link>
            </div>
          </div>
        </div>

        {/* ── Form panel ─────────────────────────────────────────────────────── */}
        <div className="md:order-1 flex-[1.2] p-8 md:p-12 flex flex-col justify-center space-y-6">

          {/* Header */}
          <div className="space-y-1">
            <p className="text-[9px] uppercase tracking-[0.4em] text-white/22 font-medium">Account Access</p>
            <h1 className="text-xl font-bold text-white">{viewLabel[view]}</h1>
            <div className="h-px w-10" style={{ background: "linear-gradient(90deg, #d4a853, transparent)" }} />
          </div>

          {error && <div className="auth-error"><AlertCircle size={14} className="flex-shrink-0" />{error}</div>}
          {successMsg && <div className="auth-success"><CheckCircle2 size={14} className="flex-shrink-0" />{successMsg}</div>}

          {/* ── Email login ─────────────────────────────────────────────────── */}
          {view === "login" && (
            <div className="view-in space-y-5">
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <p className="auth-label"><Mail size={9} /> Email</p>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="your@email.com" className="auth-input" required />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <p className="auth-label mb-0"><Lock size={9} /> Password</p>
                    <button type="button" onClick={() => setView("reset")}
                      className="text-[9px] text-white/25 hover:text-amber-400 transition-colors uppercase tracking-wider">
                      Forgot?
                    </button>
                  </div>
                  <div className="relative">
                    <input type={showPass ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••" className="auth-input pr-11" required />
                    <button type="button" onClick={() => setShowPass(p => !p)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/60 transition-colors">
                      {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
                <button type="submit" disabled={loading} className="btn-gold">
                  {loading ? <Loader2 size={15} className="animate-spin" /> : "Sign In"}
                </button>
              </form>

              <button onClick={() => setView("phone-init")}
                className="w-full flex items-center justify-center gap-2 text-[10px] text-white/25 hover:text-white/55 uppercase tracking-widest transition-colors">
                <Smartphone size={12} /> Use phone number instead
              </button>

              {/* Social divider */}
              <div className="auth-divider">or continue with</div>

              <button onClick={handleGoogleLogin} className="btn-glass-auth">
                <img src="https://www.gstatic.com/images/branding/product/1x/gsa_64dp.png" className="w-4 h-4" alt="Google" />
                Sign in with Google
              </button>

              <p className="text-center text-[10px] text-white/22">
                No account?{" "}
                <Link to="/signup" className="font-semibold hover:text-amber-400 transition-colors" style={{ color: "#d4a853" }}>Register here</Link>
              </p>
            </div>
          )}

          {/* ── Phone login ─────────────────────────────────────────────────── */}
          {view === "phone-init" && (
            <div className="view-in space-y-5">
              <p className="text-[11px] text-white/35 leading-relaxed">Enter your verified mobile number to receive a one-time code.</p>
              <form onSubmit={handlePhoneLogin} className="space-y-4">
                <div>
                  <p className="auth-label"><Phone size={9} /> Mobile Number</p>
                  <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                    placeholder="+1234567890" className="auth-input" required />
                </div>
                <button type="submit" disabled={loading} className="btn-gold">
                  {loading ? <Loader2 size={15} className="animate-spin" /> : "Send Code"}
                </button>
              </form>
              <button onClick={() => setView("login")} className="w-full flex items-center justify-center gap-2 text-[10px] text-white/25 hover:text-white/55 uppercase tracking-widest transition-colors">
                <ArrowLeft size={11} /> Back to email login
              </button>
            </div>
          )}

          {/* ── Password reset ──────────────────────────────────────────────── */}
          {view === "reset" && (
            <div className="view-in space-y-5">
              <p className="text-[11px] text-white/35 leading-relaxed">We'll send a secure reset link to your registered email address.</p>
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div>
                  <p className="auth-label"><Mail size={9} /> Email Address</p>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="name@example.com" className="auth-input" required />
                </div>
                <button type="submit" disabled={loading} className="btn-gold">
                  {loading ? <Loader2 size={15} className="animate-spin" /> : "Send Reset Link"}
                </button>
              </form>
              <button onClick={() => setView("login")} className="w-full flex items-center justify-center gap-2 text-[10px] text-white/25 hover:text-white/55 uppercase tracking-widest transition-colors">
                <ArrowLeft size={11} /> Back to sign in
              </button>
            </div>
          )}

          {/* ── OTP verification ─────────────────────────────────────────────── */}
          {view === "otp" && (
            <div className="view-in space-y-5">
              <p className="text-[11px] text-white/35 leading-relaxed text-center">Enter the 6-digit code sent to <span style={{ color: "#d4a853" }}>{phone}</span></p>
              <input type="text" value={otp} onChange={e => setOtp(e.target.value)}
                className="otp-input" placeholder="000000" maxLength={6} />
              <button onClick={verifyOtp} disabled={loading} className="btn-gold">
                {loading ? <Loader2 size={15} className="animate-spin" /> : "Verify Identity"}
              </button>
              <button onClick={() => setView("phone-init")}
                className="w-full text-center text-[10px] text-white/22 hover:text-white/50 uppercase tracking-widest transition-colors">
                Resend code
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoginPage;