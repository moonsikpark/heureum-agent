// Copyright (c) 2026 Heureum AI. All rights reserved.

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import HeureumIcon from './HeureumIcon';

export default function LandingNav() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const navRef = useRef<HTMLElement>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const content = navRef.current?.nextElementSibling;
    if (!content) return;
    const onScroll = () => setScrolled(content.scrollTop > 0);
    content.addEventListener('scroll', onScroll, { passive: true });
    return () => content.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav ref={navRef} className={`landing-nav${scrolled ? ' landing-nav-scrolled' : ''}`}>
      <div className="landing-nav-inner">
        <span className="landing-logo" onClick={() => navigate('/')} role="button" tabIndex={0} style={{ cursor: 'pointer' }}>
          <HeureumIcon size={28} />
          <span className="landing-logo-text">Heureum</span>
        </span>
        <div className="landing-nav-actions">
          <button className="nav-btn-outline" onClick={() => navigate('/contact')}>
            Contact
          </button>
          {isAuthenticated ? (
            <button className="nav-btn-filled" onClick={() => navigate('/chat')}>
              Open Chat
            </button>
          ) : (
            <button className="nav-btn-filled" onClick={() => navigate('/login')}>
              Sign in
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
