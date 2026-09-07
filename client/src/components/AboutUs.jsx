import React, { useState } from 'react';
import { ArrowUpRight, Camera, ChevronRight, Layers, ShieldCheck, Cpu, Zap, Network } from 'lucide-react';
import './AboutUs.css';

const FAQ_ITEMS = [
  {
    question: "Why Ephimera?",
    answer: "Traditional CDNs bill heavily for every gigabyte transferred from origin servers during massive concurrent live streams. Ephimera builds an instant regional WebRTC DataChannel mesh between active viewers. Peers discover chunk inventories and trade video segments directly in sub-650ms deadline races, offloading 50% to 80% of origin egress bandwidth while eliminating buffering stalls."
  },
  {
    question: "Is Ephimera SOC 2 and DRM compliant?",
    answer: "Yes. Ephimera uses cryptographic HMAC-SHA256 tokens for gated peer rooms and 16-byte AES-128 key delivery for protected HLS media payloads. Video chunks remain fully encrypted throughout the peer-to-peer transport layer and are only decrypted inside the browser's MediaSource engine."
  },
  {
    question: "Can I self-host Ephimera edge nodes?",
    answer: "Absolutely. Ephimera is architected for hybrid multi-cloud and bare-metal environments. You can run signaling trackers, dedicated high-bandwidth seeders, and real-time FFmpeg transcoding workers on your own Kubernetes clusters or edge instances."
  },
  {
    question: "How does Ephimera handle peer churn and packet drops?",
    answer: "Ephimera runs an aggressive 650ms deadline race algorithm. If a candidate peer fails to respond or send requested chunk bytes within 650ms, the player seamlessly falls back to origin CDN edge servers with zero visual artifacts or playback interruptions."
  },
  {
    question: "What's the main advantage for video streaming workflows?",
    answer: "Native HTTP Live Streaming (.m3u8 / .ts) compatibility, zero player plugin requirements, multi-rendition Adaptive Bitrate (ABR) laddering, and drag-and-drop instant FFmpeg transcoding that lets creators seed newly minted segments directly into the mesh."
  },
  {
    question: "How fast is onboarding and player integration?",
    answer: "Drop-in ready. Ephimera embeds into any standard Video.js, Hls.js, or HTML5 media player with under 10 lines of frontend code, negotiating WebRTC DataChannel handshakes with local peers in under 120ms."
  }
];

export default function AboutUs({ onBackToLanding, onLaunchDashboard }) {
  const [openFaq, setOpenFaq] = useState(0);

  const toggleFaq = (index) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  return (
    <div className="about-page-root">
      {/* Ambient Purple Bezier Spline Curves */}
      <div className="about-splines" aria-hidden="true">
        <svg viewBox="0 0 1440 900" fill="none" preserveAspectRatio="none">
          <path
            d="M -100 220 C 250 80, 500 580, 850 200 C 1100 -50, 1300 450, 1550 180"
            stroke="#A855F7"
            strokeWidth="1.3"
            strokeOpacity="0.55"
          />
          <path
            d="M -50 340 C 320 200, 480 720, 950 280 C 1200 40, 1380 620, 1600 320"
            stroke="#C084FC"
            strokeWidth="0.9"
            strokeOpacity="0.38"
          />
          <path
            d="M 100 80 C 400 -80, 750 420, 1050 150 C 1280 -20, 1420 300, 1650 120"
            stroke="#896ABD"
            strokeWidth="1.1"
            strokeOpacity="0.45"
          />
        </svg>
      </div>

      <div className="about-container">
        {/* Top Header Navigation */}
        <header className="about-nav">
          <button className="about-logo-btn" onClick={onBackToLanding}>
            <svg className="about-logo-icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
            <span>Ephimera</span>
          </button>

          <nav className="about-nav-links">
            <button className="about-nav-link" onClick={() => window.open('https://github.com/Aryang2712/Ephimera_Final', '_blank')}>
              DOCS
            </button>
            <button className="about-nav-link" onClick={onBackToLanding}>
              FEATURES
            </button>
            <button className="about-nav-link" onClick={onLaunchDashboard}>
              SWARM
            </button>
            <span className="about-nav-link active">ABOUT US</span>
          </nav>

          <div className="about-nav-actions">
            <button className="about-btn-subtle" onClick={onLaunchDashboard}>
              APP
            </button>
            <button className="about-btn-cta" onClick={onLaunchDashboard}>
              <span>LAUNCH NODE</span>
              <ArrowUpRight size={14} />
            </button>
          </div>
        </header>

        {/* Hero Section */}
        <main>
          <section className="about-hero">
            <h1 className="about-hero-title">
              Building the rails for<br />
              decentralized video on-demand
            </h1>

            <div className="about-hero-paragraphs">
              <p>
                From the beginning, Ephimera was about building the right protocol for the right job. We isolated the latency, egress costs, and origin bottlenecks that modern video streaming architectures struggled with and engineered specialized WebRTC DataChannel swarms to offload them instead. Starting with sub-650ms chunk races, dynamic ABR laddering, and on-the-fly transcoding, our mesh infrastructure makes global video streaming faster, resilient, and virtually cost-free.
              </p>
              <p>
                We envision a future where video streaming scales linearly with concurrent viewership without exponential CDN bills — where every connected viewer becomes an active edge node contributing micro-bandwidth to nearby peers. At Ephimera, we build the algorithms, crypto key exchange, and mesh topology to make this possible.
              </p>
              <p>
                Our team is based in-person, where we build and benchmark together. We're a team of distributed systems researchers, media pipeline architects, and stubborn protocol hackers. If you're stubbornly optimistic and don't back away from hard technical problems, join us.
              </p>
            </div>
          </section>

          {/* Meet the Team Section */}
          <section className="about-team-section">
            <h2 className="about-section-title">Meet the team</h2>
            <div className="about-team-grid">
              {/* Photo Skeleton 1 */}
              <div className="about-photo-skeleton">
                <Camera size={26} className="about-photo-icon" />
                <span className="about-photo-tag">photo 1</span>
              </div>

              {/* Photo Skeleton 2 */}
              <div className="about-photo-skeleton">
                <Camera size={26} className="about-photo-icon" />
                <span className="about-photo-tag">photo 2</span>
              </div>

              {/* Photo Skeleton 3 */}
              <div className="about-photo-skeleton">
                <Camera size={26} className="about-photo-icon" />
                <span className="about-photo-tag">photo 3</span>
              </div>

              {/* Photo Skeleton 4 */}
              <div className="about-photo-skeleton">
                <Camera size={26} className="about-photo-icon" />
                <span className="about-photo-tag">photo 4</span>
              </div>
            </div>
          </section>

          {/* Trusted Brands Section */}
          <section className="about-brands-section">
            <div className="about-brands-kicker">
              Trusted by the best leading brands:
            </div>
            <div className="about-brands-row">
              <div className="about-brand-logo">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                </svg>
                <span>orchids</span>
              </div>

              <div className="about-brand-logo">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
                </svg>
                <span>Magic Patterns</span>
              </div>

              <div className="about-brand-logo">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2L1 21h22L12 2zm0 3.5L18.5 19H5.5L12 5.5z"/>
                </svg>
                <span>a0.dev</span>
              </div>

              <div className="about-brand-logo">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                </svg>
                <span>Lovable</span>
              </div>

              <div className="about-brand-logo">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>
                </svg>
                <span>WebRTC</span>
              </div>

              <div className="about-brand-logo">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 1.99-.9 1.99-2L23 5c0-1.1-.9-2-2-2zm0 14H3V5h18v12z"/>
                </svg>
                <span>FFmpeg</span>
              </div>
            </div>
          </section>

          {/* Frequently Asked Questions Section */}
          <section className="about-faq-section">
            <div className="about-faq-left">
              <div className="about-faq-kicker">
                <span className="about-faq-kicker-square" />
                <span>FAQS</span>
              </div>
              <h2 className="about-faq-title">
                Frequently<br />
                asked<br />
                questions
              </h2>
            </div>

            <div className="about-faq-list">
              {FAQ_ITEMS.map((item, index) => {
                const isOpen = openFaq === index;
                return (
                  <div key={index} className={`about-faq-item ${isOpen ? 'is-open' : ''}`}>
                    <button
                      className="about-faq-question"
                      onClick={() => toggleFaq(index)}
                      aria-expanded={isOpen}
                    >
                      <span>{item.question}</span>
                      <span className="about-faq-toggle">{isOpen ? '−' : '+'}</span>
                    </button>
                    <div className="about-faq-answer">
                      <p>{item.answer}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </main>

        {/* Footer */}
        <footer className="about-footer">
          <div>© {new Date().getFullYear()} Ephimera Labs Inc. All rights reserved.</div>
          <div style={{ display: 'flex', gap: '1.5rem' }}>
            <button className="about-footer-link" onClick={onBackToLanding} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              Landing Page
            </button>
            <button className="about-footer-link" onClick={onLaunchDashboard} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              Live Player
            </button>
            <a className="about-footer-link" href="https://github.com/Aryang2712/Ephimera_Final" target="_blank" rel="noopener noreferrer">
              GitHub
            </a>
          </div>
        </footer>
      </div>
    </div>
  );
}
