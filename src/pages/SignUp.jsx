import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  User, Mail, Lock, AlertCircle, Loader2, Phone, Eye, EyeOff, ArrowLeft,
} from "lucide-react";
import { auth, googleProvider } from "../firebase";
import {
  createUserWithEmailAndPassword,
  updateProfile,
  signInWithPopup,
  RecaptchaVerifier,
  signInWithPhoneNumber,
} from "firebase/auth";
import { fetchByGenre } from "../services/api.js";

const SignUp = () => {
  const [username, setUsername]               = useState("");
  const [email, setEmail]                     = useState("");
  const [password, setPassword]               = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phone, setPhone]                     = useState("");
  const [otp, setOtp]                         = useState("");
  const [showPass, setShowPass]               = useState(false);
  const [showConfirm, setShowConfirm]         = useState(false);

  const [error, setError]                       = useState("");
  const [loading, setLoading]                   = useState(false);
  const [showOtpInput, setShowOtpInput]         = useState(false);
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [backdrop, setBackdrop]                 = useState("");

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

  const handleSignUp = async (e) => {
    e.preventDefault(); setError("");
    if (password !== confirmPassword) return setError("Passwords do not match.");
    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: username });
      navigate("/");
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const handleGoogleSignUp = async () => {
    setLoading(true);
    try { await signInWithPopup(auth, googleProvider); navigate("/"); }
    catch { setError("Google Sign-In failed."); }
    finally { setLoading(false); }
  };

  const handlePhoneSignIn = async () => {
    if (!phone) return setError("Please enter a phone number.");
    setError(""); setLoading(true);
    try {
      setupRecaptcha();
      const result = await signInWithPhoneNumber(auth, phone, window.recaptchaVerifier);
      setConfirmationResult(result); setShowOtpInput(true);
    } catch { setError("Failed to send SMS. Use format: +1234567890"); }
    finally { setLoading(false); }
  };

  const verifyOtp = async () => {
    setLoading(true);
    try { await confirmationResult.confirm(otp); navigate("/"); }
    catch { setError("Invalid OTP code."); }
    finally { setLoading(false); }
  };

  return (
    <div
      className="auth-root min-h-screen w-full flex items-center justify-center p-4 md:p-10 lg:p-16 relative"
      style={{ fontFamily: "'Sora', sans-serif" }}
    >
      <div id="recaptcha-container" />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=Playfair+Display:ital,wght@0,700;1,400;1,700&display=swap');

        .auth-root { background: #080808; }

        .auth-bg {
          position: fixed; inset: 0; z-index: 0;
          background-size: cover; background-position: center;
          transition: background-image 2s ease-in-out;
          filter: brightness(0.3) saturate(1.1);
        }
        .auth-bg::after {
          content: '';
          position: absolute; inset: 0;
          background: linear-gradient(135deg, rgba(8,8,8,0.96) 0%, rgba(8,8,8,0.6) 60%, rgba(8,8,8,0.85) 100%);
        }

        .auth-noise::before {
          content: '';
          position: fixed; inset: 0; z-index: 1; pointer-events: none;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
          background-size: 180px;
          opacity: 0.028;
        }

        .auth-card {
          background: rgba(10,10,10,0.84);
          border: 1px solid rgba(255,255,255,0.07);
          backdrop-filter: blur(32px);
          box-shadow: 0 40px 100px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.04);
        }

        .auth-input {
          width: 100%; padding: 12px 16px;
          border-radius: 12px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.09);
          color: white; font-size: 13px;
          font-family: 'Sora', sans-serif;
          outline: none;
          transition: border-color .2s, background .2s;
        }
        .auth-input::placeholder { color: rgba(255,255,255,0.2); }
        .auth-input:focus {
          border-color: rgba(212,168,83,0.5);
          background: rgba(212,168,83,0.04);
        }

        .btn-gold {
          width: 100%; padding: 14px;
          border-radius: 12px;
          background: linear-gradient(135deg, #d4a853 0%, #b8892f 100%);
          color: black;
          font-size: 11px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase;
          font-family: 'Sora', sans-serif;
          box-shadow: 0 8px 28px rgba(212,168,83,0.3), inset 0 1px 0 rgba(255,255,255,0.2);
          transition: all .22s cubic-bezier(.4,0,.2,1);
          display: flex; align-items: center; justify-content: center; gap: 8px;
        }
        .btn-gold:hover { box-shadow: 0 14px 40px rgba(212,168,83,0.48), inset 0 1px 0 rgba(255,255,255,0.2); transform: translateY(-1px); }
        .btn-gold:active { transform: scale(.98); }
        .btn-gold:disabled { opacity: .6; transform: none; }

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

        .btn-ghost {
          padding: 10px 16px; border-radius: 10px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          color: rgba(255,255,255,0.45);
          font-size: 10px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase;
          font-family: 'Sora', sans-serif;
          transition: all .2s ease;
        }
        .btn-ghost:hover { background: rgba(255,255,255,0.08); color: white; }

        .auth-error {
          display: flex; align-items: flex-start; gap: 10px;
          padding: 12px 16px; border-radius: 12px;
          background: rgba(239,68,68,0.08);
          border: 1px solid rgba(239,68,68,0.22);
          color: #fca5a5;
          font-size: 11px; font-weight: 500; line-height: 1.5;
        }

        .auth-label {
          display: flex; align-items: center; gap: 6px;
          font-size: 9px; font-weight: 600; letter-spacing: .12em; text-transform: uppercase;
          color: rgba(212,168,83,0.7);
          margin-bottom: 7px;
        }

        .auth-divider {
          display: flex; align-items: center; gap: 12px;
          color: rgba(255,255,255,0.18);
          font-size: 9px; font-weight: 600; letter-spacing: .15em; text-transform: uppercase;
        }
        .auth-divider::before, .auth-divider::after {
          content: ''; flex: 1;
          height: 1px; background: rgba(255,255,255,0.07);
        }

        .otp-input {
          width: 100%; padding: 18px;
          border-radius: 14px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(212,168,83,0.35);
          color: white;
          font-size: 24px; letter-spacing: .6em; text-align: center;
          font-family: 'Sora', sans-serif; outline: none;
          transition: border-color .2s;
        }
        .otp-input:focus { border-color: rgba(212,168,83,0.7); }

        @keyframes fadeUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        .form-in { animation: fadeUp .4s cubic-bezier(.4,0,.2,1) forwards; }
      `}</style>

      {/* Backdrop */}
      <div className="auth-noise auth-bg" style={{ backgroundImage: backdrop ? `url("${backdrop}")` : "none" }} />
      <div className="fixed inset-0 z-[1] pointer-events-none" style={{ background: "radial-gradient(ellipse at 75% 40%, rgba(212,168,83,0.04) 0%, transparent 55%)" }} />

      {/* ── Card ──────────────────────────────────────────────────────────────── */}
      <div className="relative z-10 auth-card rounded-2xl flex flex-col md:flex-row w-full max-w-md md:max-w-4xl overflow-hidden">

        {/* ── Welcome panel ─────────────────────────────────────────────────── */}
        <div
          className="md:order-2 flex-1 p-8 md:p-14 flex flex-col justify-center text-center md:text-left border-b md:border-b-0 md:border-l"
          style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(212,168,83,0.02)" }}>
          <div className="max-w-xs mx-auto md:mx-0 space-y-5">
            <div className="flex items-center gap-3 justify-center md:justify-start">
              <div className="w-0.5 h-8 rounded-full bg-amber-400 flex-shrink-0" />
              <h2 className="font-bold text-white leading-tight" style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(1.6rem, 3vw, 2.4rem)", fontStyle: "italic" }}>
                Join<br /><span style={{ color: "#d4a853" }}>Crystal Movies</span>
              </h2>
            </div>
            <p className="text-[11px] text-white/32 leading-relaxed tracking-wide">
              Unlock exclusive 4K content, personalized watchlists, and cross-device sync.
            </p>

            {/* Feature list */}
            <div className="hidden md:flex flex-col gap-2.5 pt-1">
              {["Unlimited 4K Streaming", "Watchlist & Progress Sync", "No Ads, Ever"].map(feat => (
                <div key={feat} className="flex items-center gap-2.5">
                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "#d4a853" }} />
                  <span className="text-[10px] text-white/40 font-medium">{feat}</span>
                </div>
              ))}
            </div>

            <div className="hidden md:block pt-3">
              <p className="text-[9px] uppercase tracking-[0.4em] text-white/20 mb-4">Already a member?</p>
              <Link to="/login"
                className="inline-flex items-center px-8 py-3 rounded-xl text-[10px] font-semibold uppercase tracking-wider text-white/50 hover:text-white transition-all"
                style={{ border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)" }}>
                Sign In
              </Link>
            </div>
          </div>
        </div>

        {/* ── Form panel ──────────────────────────────────────────────────────── */}
        <div className="md:order-1 flex-[1.2] p-8 md:p-10 flex flex-col justify-center space-y-5">

          {/* Header */}
          <div className="space-y-1">
            <p className="text-[9px] uppercase tracking-[0.4em] text-white/22 font-medium">New Member</p>
            <h1 className="text-xl font-bold text-white">Create Account</h1>
            <div className="h-px w-10" style={{ background: "linear-gradient(90deg, #d4a853, transparent)" }} />
          </div>

          {error && (
            <div className="auth-error"><AlertCircle size={14} className="flex-shrink-0 mt-0.5" />{error}</div>
          )}

          {/* ── Registration form ─────────────────────────────────────────────── */}
          {!showOtpInput ? (
            <form onSubmit={handleSignUp} className="form-in space-y-4">

              {/* Name + Email row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <p className="auth-label"><User size={9} /> Username</p>
                  <input type="text" value={username} onChange={e => setUsername(e.target.value)}
                    placeholder="Display name" className="auth-input" required />
                </div>
                <div>
                  <p className="auth-label"><Mail size={9} /> Email</p>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="your@email.com" className="auth-input" required />
                </div>
              </div>

              {/* Phone (optional) */}
              <div>
                <p className="auth-label">
                  <Phone size={9} /> Phone
                  <span className="text-[8px] text-white/20 normal-case font-normal ml-1">(optional — for SMS login)</span>
                </p>
                <div className="flex gap-2">
                  <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                    placeholder="+1234567890" className="auth-input" />
                  <button type="button" onClick={handlePhoneSignIn} className="btn-ghost flex-shrink-0 whitespace-nowrap">
                    SMS
                  </button>
                </div>
              </div>

              {/* Passwords */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <p className="auth-label"><Lock size={9} /> Password</p>
                  <div className="relative">
                    <input type={showPass ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••" className="auth-input pr-10" required />
                    <button type="button" onClick={() => setShowPass(p => !p)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/22 hover:text-white/55 transition-colors">
                      {showPass ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                  </div>
                </div>
                <div>
                  <p className="auth-label"><Lock size={9} /> Confirm</p>
                  <div className="relative">
                    <input type={showConfirm ? "text" : "password"} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="••••••••" className="auth-input pr-10" required />
                    <button type="button" onClick={() => setShowConfirm(p => !p)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/22 hover:text-white/55 transition-colors">
                      {showConfirm ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Password strength hint */}
              {password && (
                <div className="flex gap-1">
                  {[1,2,3,4].map(i => (
                    <div key={i} className="flex-1 h-0.5 rounded-full transition-all duration-300"
                      style={{ background: password.length >= i * 3 ? (password.length >= 12 ? "#d4a853" : password.length >= 8 ? "#f59e0b" : "#ef4444") : "rgba(255,255,255,0.08)" }} />
                  ))}
                </div>
              )}

              <button type="submit" disabled={loading} className="btn-gold">
                {loading ? <Loader2 size={15} className="animate-spin" /> : "Create Account"}
              </button>
            </form>
          ) : (
            /* ── OTP verification ──────────────────────────────────────────── */
            <div className="form-in space-y-4">
              <p className="text-[11px] text-white/35 text-center leading-relaxed">
                Enter the 6-digit code sent to <span style={{ color: "#d4a853" }}>{phone}</span>
              </p>
              <input type="text" value={otp} onChange={e => setOtp(e.target.value)}
                className="otp-input" placeholder="000000" maxLength={6} />
              <button onClick={verifyOtp} disabled={loading} className="btn-gold">
                {loading ? <Loader2 size={15} className="animate-spin" /> : "Verify & Register"}
              </button>
              <button onClick={() => setShowOtpInput(false)}
                className="w-full flex items-center justify-center gap-2 text-[10px] text-white/22 hover:text-white/50 uppercase tracking-widest transition-colors">
                <ArrowLeft size={11} /> Cancel
              </button>
            </div>
          )}

          {/* Social */}
          {!showOtpInput && (
            <>
              <div className="auth-divider">or</div>
              <button onClick={handleGoogleSignUp} className="btn-glass-auth">
                <img src="https://www.gstatic.com/images/branding/product/1x/gsa_64dp.png" className="w-4 h-4" alt="Google" />
                Continue with Google
              </button>
              <p className="text-center text-[10px] text-white/22">
                Already a member?{" "}
                <Link to="/login" className="font-semibold hover:text-amber-400 transition-colors" style={{ color: "#d4a853" }}>Sign in</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SignUp;