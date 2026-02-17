// Copyright (c) 2026 Heureum AI. All rights reserved.

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import LandingNav from '../components/LandingNav';
import FeatureSection from '../components/landing/FeatureSection';
import PeriodicTaskMockup from '../components/landing/PeriodicTaskMockup';
import BrowserControlMockup from '../components/landing/BrowserControlMockup';
import FileEditMockup from '../components/landing/FileEditMockup';
import SelfHostMockup from '../components/landing/SelfHostMockup';
import './Home.css';

function PlatformIcon({ name }: { name: string }) {
  const s = 16;
  switch (name) {
    case 'macOS':
    case 'iOS':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
        </svg>
      );
    case 'Windows':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="#0078D4">
          <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801" />
        </svg>
      );
    case 'Android':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="#34A853">
          <path d="M17.523 15.341a1.138 1.138 0 0 0 1.137-1.137V8.28a1.138 1.138 0 0 0-2.275 0v5.924a1.138 1.138 0 0 0 1.138 1.137m-11.046 0a1.138 1.138 0 0 0 1.138-1.137V8.28a1.138 1.138 0 0 0-2.275 0v5.924a1.138 1.138 0 0 0 1.137 1.137m1.675 5.429h.638v2.092a1.138 1.138 0 0 0 2.275 0V20.77h1.87v2.092a1.138 1.138 0 0 0 2.275 0V20.77h.637A1.84 1.84 0 0 0 16.69 18.93V8.472H7.31v10.457a1.84 1.84 0 0 0 1.842 1.841M15.4 4.26l1.238-1.876a.256.256 0 1 0-.425-.285l-1.283 1.946A7.26 7.26 0 0 0 12 3.49a7.26 7.26 0 0 0-2.93.555L7.787 2.099a.256.256 0 1 0-.425.285L8.6 4.26C6.728 5.217 5.47 7.06 5.47 9.18v.572h13.06V9.18c0-2.12-1.258-3.963-3.13-4.92M9.543 7.485a.64.64 0 1 1 0-1.28.64.64 0 0 1 0 1.28m4.914 0a.64.64 0 1 1 0-1.28.64.64 0 0 1 0 1.28" />
        </svg>
      );
    default:
      return null;
  }
}

const PLATFORMS = ['macOS', 'Windows', 'iOS', 'Android'] as const;

const ROTATING_WORDS = [
  'smarter conversations',
  'productive workflows',
  'personal automation',
  'effortless research',
];

function useRotatingText(words: string[], typingSpeed = 90, deleteSpeed = 50, pauseMs = 3000) {
  const [wordIndex, setWordIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(words[0].length);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPaused, setIsPaused] = useState(true);

  useEffect(() => {
    const delay = isPaused ? pauseMs : isDeleting ? deleteSpeed : typingSpeed;

    const timer = setTimeout(() => {
      if (isPaused) {
        setIsPaused(false);
        setIsDeleting(true);
        return;
      }

      if (isDeleting) {
        if (charIndex > 0) {
          setCharIndex((c) => c - 1);
        } else {
          setIsDeleting(false);
          setWordIndex((i) => (i + 1) % words.length);
        }
      } else {
        if (charIndex < words[wordIndex].length) {
          setCharIndex((c) => c + 1);
        } else {
          setIsPaused(true);
        }
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [words, wordIndex, charIndex, isDeleting, isPaused, typingSpeed, deleteSpeed, pauseMs]);

  return words[wordIndex].slice(0, charIndex);
}

export default function Home() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuthStore();
  const [downloadClicked, setDownloadClicked] = useState<string | null>(null);
  const rotatingText = useRotatingText(ROTATING_WORDS);

  return (
    <div className="landing">
      <LandingNav />

      <div className="landing-content">
      {/* Hero */}
      <main className="landing-hero">
        <div className="landing-hero-inner">
          <div className="hero-left">
            <h1 className="landing-headline">
              Your AI assistant for{' '}
              <span className="landing-rotating-wrap">
                {/* Hidden sizer: reserves height of longest phrase */}
                <span className="landing-rotating-sizer" aria-hidden="true">
                  {ROTATING_WORDS.reduce((a, b) => (a.length >= b.length ? a : b))}
                </span>
                <span className="landing-gradient-text landing-rotating-text">
                  {rotatingText}
                  <span className="landing-cursor" />
                </span>
              </span>
            </h1>
            <p className="landing-subtext">
              Chat naturally with an advanced AI agent. Get instant, intelligent
              responses to help you think, create, and solve problems.
            </p>

            {isAuthenticated ? (
              <div className="hero-authenticated">
                <p className="hero-greeting">Welcome back, {user?.first_name}.</p>
                <button className="hero-cta-button" onClick={() => navigate('/chat')}>
                  Start Chatting
                  <span className="hero-arrow">&rarr;</span>
                </button>
              </div>
            ) : (
              <div className="hero-cta">
                <button className="hero-cta-button" onClick={() => navigate('/login')}>
                  Use on Web
                  <span className="hero-arrow">&rarr;</span>
                </button>
              </div>
            )}

            <div className="hero-download">
              <p className="hero-download-label">Also available on</p>
              <div className="hero-download-row">
                {PLATFORMS.map((name) => (
                  <button
                    key={name}
                    className={`hero-download-btn ${downloadClicked === name ? 'hero-download-btn-clicked' : ''}`}
                    onClick={() => setDownloadClicked(name)}
                  >
                    <PlatformIcon name={name} />
                    <span className="hero-download-name">{name}</span>
                    {downloadClicked === name && (
                      <span className="hero-download-toast">Coming soon</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="hero-right">
            <div className="hero-chat-preview">
              <div className="demo-chat">
                <div className="demo-chat-header">Heureum Chat</div>
                <div className="demo-chat-messages">
                  <div className="demo-msg demo-msg-user">Create a quarterly sales report as a Word document</div>
                  <div className="demo-msg demo-msg-tool">
                    <span className="demo-tool-icon">{'\u2713'}</span>
                    <code>docx_write: Q4_Sales_Report.docx</code>
                    <span className="demo-tool-badge">completed</span>
                  </div>
                  <div className="demo-msg demo-msg-ai">I've created the quarterly sales report. The document includes an executive summary, regional revenue breakdown with charts, subscription metrics, and recommendations for next quarter.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Feature Showcases */}
      <FeatureSection
        id="feature-periodic"
        title="Automate with"
        titleAccent="Scheduled Tasks"
        description="Set up recurring AI automations that run on your schedule. From daily briefings to weekly reports, your agent works around the clock so you don't have to."
        index={0}
      >
        <PeriodicTaskMockup />
      </FeatureSection>

      <FeatureSection
        id="feature-browser"
        title="Control the"
        titleAccent="Browser"
        description="Your AI agent navigates websites, fills forms, clicks buttons, and extracts data — all through natural language instructions. Web automation made effortless."
        index={1}
      >
        <BrowserControlMockup />
      </FeatureSection>

      <FeatureSection
        id="feature-files"
        title="Create and Edit"
        titleAccent="Files"
        description="Generate reports, edit documents, and manage files directly in your session. With support for Markdown, HTML, images, and more — your workspace stays organized."
        index={2}
      >
        <FileEditMockup />
      </FeatureSection>

      <FeatureSection
        id="feature-selfhost"
        title="Own Your"
        titleAccent="Data"
        description="Deploy Heureum on your own infrastructure with open-source models. Your conversations, files, and data never leave your servers — full control, zero compromise."
        index={3}
      >
        <SelfHostMockup />
      </FeatureSection>

      <footer className="landing-footer">
        <p>&copy; Heureum AI</p>
      </footer>
      </div>
    </div>
  );
}
