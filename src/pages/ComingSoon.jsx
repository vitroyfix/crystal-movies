import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Clock } from "lucide-react";

const ComingSoon = () => {
  const navigate = useNavigate();
  const canvasRef = useRef(null);

  // Subtle floating particles on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let raf;

    const resize = () => {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const particles = Array.from({ length: 38 }, () => ({
      x:    Math.random() * canvas.width,
      y:    Math.random() * canvas.height,
      r:    Math.random() * 1.4 + 0.3,
      dx:   (Math.random() - 0.5) * 0.22,
      dy:  -(Math.random() * 0.28 + 0.08),
      o:    Math.random() * 0.35 + 0.08,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(212,168,83,${p.o})`;
        ctx.fill();
        p.x += p.dx;
        p.y += p.dy;
        if (p.y < -4)  { p.y = canvas.height + 4; p.x = Math.random() * canvas.width; }
        if (p.x < -4)  p.x = canvas.width + 4;
        if (p.x > canvas.width + 4) p.x = -4;
      });
      raf = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div
      className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-[#080808]"
      style={{ fontFamily: "'Sora', sans-serif" }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=Playfair+Display:ital,wght@0,700;0,900;1,400;1,700&display=swap');

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes dash {
          0%   { stroke-dashoffset: 283; }
          100% { stroke-dashoffset: 0; }
        }
        @keyframes glow-pulse {
          0%, 100% { opacity: .55; transform: scale(1); }
          50%       { opacity: .9;  transform: scale(1.06); }
        }
        @keyframes bar-breathe {
          0%, 100% { opacity: .5; width: 48px; }
          50%       { opacity: 1;  width: 72px; }
        }

        .a1 { animation: fadeUp .65s ease .1s  both; }
        .a2 { animation: fadeUp .65s ease .25s both; }
        .a3 { animation: fadeUp .65s ease .4s  both; }
        .a4 { animation: fadeUp .65s ease .55s both; }
        .a5 { animation: fadeUp .65s ease .7s  both; }
        .fade-in { animation: fadeIn .9s ease both; }

        .font-display { font-family: 'Playfair Display', serif; }

        .noise {
          position: absolute; inset: 0; pointer-events: none; z-index: 1; opacity: .032;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
          background-size: 180px;
        }

        .ring-svg circle.track {
          stroke: rgba(255,255,255,0.05);
        }
        .ring-svg circle.fill {
          stroke: url(#ringGrad);
          stroke-dasharray: 283;
          animation: dash 2.2s cubic-bezier(.4,0,.2,1) .6s forwards;
        }

        .glow-dot {
          animation: glow-pulse 2.6s ease-in-out infinite;
        }

        .bar {
          height: 2px;
          border-radius: 9px;
          background: linear-gradient(90deg, #d4a853, #f0c070);
          animation: bar-breathe 2.8s ease-in-out infinite;
        }

        .back-btn {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 7px 14px; border-radius: 30px;
          font-size: 10px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.09);
          color: rgba(255,255,255,0.35);
          transition: all .2s ease; cursor: pointer;
        }
        .back-btn:hover {
          background: rgba(255,255,255,0.08);
          border-color: rgba(255,255,255,0.15);
          color: rgba(255,255,255,0.7);
          transform: translateX(-2px);
        }

        .kw-tag {
          display: inline-flex; align-items: center;
          padding: 5px 12px; border-radius: 20px;
          font-size: 10px; font-weight: 500; letter-spacing: .04em;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          color: rgba(255,255,255,0.35);
        }

        .divider {
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.07) 30%, rgba(255,255,255,0.07) 70%, transparent);
        }
      `}</style>

      {/* ── Background layers ─────────────────────────────────────────────── */}
      {/* Faint hero image */}
      <div
        className="absolute inset-0 fade-in"
        style={{
          backgroundImage: "url('https://i.pinimg.com/1200x/a5/86/ac/a586ac3a3aaf5bd37bfbb32104599000.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          filter: "brightness(0.12) saturate(0.7)",
          transform: "scale(1.06)",
        }}
      />
      {/* Gradient vignette */}
      <div className="absolute inset-0 z-[1]"
        style={{ background: "linear-gradient(to bottom, #080808 0%, rgba(8,8,8,0.55) 40%, rgba(8,8,8,0.55) 60%, #080808 100%)" }} />
      {/* Left-side gold glow */}
      <div className="absolute inset-0 z-[1]"
        style={{ background: "radial-gradient(ellipse at 20% 55%, rgba(212,168,83,0.07) 0%, transparent 55%)" }} />
      {/* Noise */}
      <div className="noise" />
      {/* Particles */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full z-[2]" style={{ opacity: 0.7 }} />

      {/* ── Back button ───────────────────────────────────────────────────── */}
      <div className="absolute top-6 left-5 md:top-8 md:left-10 z-20 a1">
        <button onClick={() => navigate(-1)} className="back-btn">
          <ArrowLeft size={11} /> Back
        </button>
      </div>

      {/* ── Centre content ────────────────────────────────────────────────── */}
      <div className="relative z-10 flex flex-col items-center text-center px-5 max-w-lg">

        {/* Animated ring clock */}
        <div className="a1 mb-8 relative flex items-center justify-center">
          <svg
            className="ring-svg"
            width="90" height="90" viewBox="0 0 100 100"
            style={{ transform: "rotate(-90deg)" }}
          >
            <defs>
              <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%"   stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#d4a853" />
              </linearGradient>
            </defs>
            <circle className="track" cx="50" cy="50" r="45" fill="none" strokeWidth="2.5" />
            <circle className="fill"  cx="50" cy="50" r="45" fill="none" strokeWidth="2.5"
              strokeLinecap="round" strokeDashoffset="283" />
          </svg>
          {/* Inner icon */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-14 h-14 rounded-full flex items-center justify-center"
              style={{ background: "rgba(212,168,83,0.08)", border: "1px solid rgba(212,168,83,0.2)" }}>
              <Clock size={20} className="text-amber-400/70 glow-dot" />
            </div>
          </div>
        </div>

        {/* Label */}
        <p className="a2 text-[9px] uppercase tracking-[0.55em] font-semibold mb-4"
          style={{ color: "rgba(212,168,83,0.65)" }}>
          In Development
        </p>

        {/* Title */}
        <h1
          className="a3 font-display font-bold text-white leading-[1.04] mb-5"
          style={{
            fontSize: "clamp(2.8rem, 8vw, 4.8rem)",
            fontStyle: "italic",
            textShadow: "0 4px 32px rgba(0,0,0,0.7)",
          }}
        >
          Coming Soon
        </h1>

        {/* Animated gold bar */}
        <div className="a3 flex justify-center mb-6">
          <div className="bar" />
        </div>

        {/* Divider */}
        <div className="a4 w-full divider mb-6" />

        {/* Body copy */}
        <p className="a4 text-[13px] leading-relaxed mb-8"
          style={{ color: "rgba(255,255,255,0.38)", maxWidth: 340 }}>
          This page is under construction. We're working on something great — check back soon.
        </p>

        {/* Tags */}
        <div className="a5 flex flex-wrap justify-center gap-2 mb-10">
          {["New Feature", "In Progress", "Stay Tuned"].map((t) => (
            <span key={t} className="kw-tag">{t}</span>
          ))}
        </div>

        {/* CTA */}
        <div className="a5">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2.5 px-7 py-3.5 rounded-xl text-[11px] font-bold uppercase tracking-wider text-black transition-all"
            style={{
              background: "linear-gradient(135deg,#d4a853 0%,#b8892f 100%)",
              boxShadow: "0 8px 32px rgba(212,168,83,0.28), inset 0 1px 0 rgba(255,255,255,0.2)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = "0 14px 44px rgba(212,168,83,0.48), inset 0 1px 0 rgba(255,255,255,0.2)";
              e.currentTarget.style.transform = "translateY(-1px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = "0 8px 32px rgba(212,168,83,0.28), inset 0 1px 0 rgba(255,255,255,0.2)";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            <ArrowLeft size={13} /> Go Back Home
          </button>
        </div>
      </div>
    </div>
  );
};

export default ComingSoon;