import { Film, Github, Twitter, Instagram } from "lucide-react";

const Footer = () => {
  const year = new Date().getFullYear();

  return (
    <footer
      style={{
        background: "#080808",
        borderTop: "1px solid rgba(255,255,255,0.06)",
        fontFamily: "'Sora', sans-serif",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&family=Playfair+Display:ital,wght@1,700&display=swap');

        .footer-link {
          font-size: 10px; font-weight: 500; letter-spacing: .07em; text-transform: uppercase;
          color: rgba(255,255,255,0.25);
          transition: color .2s ease;
          cursor: pointer;
          white-space: nowrap;
        }
        .footer-link:hover { color: rgba(212,168,83,0.85); }

        .footer-social {
          width: 34px; height: 34px; border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          border: 1px solid rgba(255,255,255,0.07);
          background: rgba(255,255,255,0.03);
          color: rgba(255,255,255,0.3);
          transition: all .2s ease;
          cursor: pointer;
        }
        .footer-social:hover {
          border-color: rgba(212,168,83,0.3);
          background: rgba(212,168,83,0.08);
          color: #d4a853;
          transform: translateY(-2px);
        }

        .footer-divider {
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.07) 30%, rgba(255,255,255,0.07) 70%, transparent);
        }

        .footer-wordmark {
          font-family: 'Playfair Display', serif;
          font-style: italic; font-weight: 700;
          font-size: 20px; color: white;
        }
        .footer-wordmark span { color: #d4a853; }
      `}</style>

      <div className="px-6 md:px-14 lg:px-20 py-10">

        {/* ── Top row ─────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">

          {/* Wordmark + tagline */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <div className="w-0.5 h-5 rounded-full" style={{ background: "#d4a853" }} />
              <span className="footer-wordmark">Crystal<span>.</span></span>
            </div>
            <p style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", letterSpacing: ".07em" }}>
              Premium streaming · No ads · Ever
            </p>
          </div>

          {/* Links */}
          <nav className="flex flex-wrap items-center gap-x-6 gap-y-3">
            {["Help Center", "Privacy Policy", "Terms of Service", "Contact"].map(lbl => (
              <span key={lbl} className="footer-link">{lbl}</span>
            ))}
          </nav>

          {/* Socials */}
          <div className="flex items-center gap-2">
            {[
              { Icon: Twitter,   title: "Twitter" },
              { Icon: Instagram, title: "Instagram" },
            ].map(({ Icon, title }) => (
              <div key={title} className="footer-social" title={title}>
                <Icon size={14} />
              </div>
            ))}
          </div>
        </div>

        <div className="footer-divider my-8" />

        {/* ── Bottom row ──────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p style={{ fontSize: 10, color: "rgba(255,255,255,0.15)", letterSpacing: ".06em" }}>
            © {year} Crystal Movies. All rights reserved.
          </p>
          <div className="flex items-center gap-1.5" style={{ color: "rgba(255,255,255,0.12)", fontSize: 10 }}>
            <Film size={11} style={{ color: "#d4a853", opacity: 0.6 }} />
            <span style={{ letterSpacing: ".06em" }}>Built for cinema lovers</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;