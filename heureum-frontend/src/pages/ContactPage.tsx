// Copyright (c) 2026 Heureum AI. All rights reserved.

import LandingNav from '../components/LandingNav';
import './Home.css';
import './ContactPage.css';

export default function ContactPage() {
  return (
    <div className="contact-page">
      <LandingNav />

      <div className="contact-content">
        <main className="contact-main">
          <h1 className="contact-title">Get in Touch</h1>
          <p className="contact-description">
            Have questions, feedback, or partnership inquiries? We'd love to hear from you.
          </p>
          <a href="mailto:contact@heureum.ai" className="contact-email">
            contact@heureum.ai
          </a>
        </main>

        <footer className="landing-footer">
          <p>&copy; Heureum AI</p>
        </footer>
      </div>
    </div>
  );
}
