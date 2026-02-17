import { useState, useEffect, useCallback } from 'react';
import { useIntersectionObserver } from '../../lib/useIntersectionObserver';
import './BrowserControlMockup.css';

const TYPED_TEXT = 'wireless headphones';
const STEP_DURATION = 2500;
const TYPE_INTERVAL = 60;

const ACTION_LABELS = [
  { cmd: 'navigate("shop.example.com")', label: 'Navigate' },
  { cmd: 'click("input.search")', label: 'Click' },
  { cmd: 'type("wireless headphones")', label: 'Type' },
  { cmd: 'click("button.search")', label: 'Search' },
];

export default function BrowserControlMockup() {
  const { ref, isVisible } = useIntersectionObserver({ threshold: 0.2 });
  const [step, setStep] = useState(-1);
  const [typedChars, setTypedChars] = useState(0);

  const resetAndStart = useCallback(() => {
    setStep(0);
    setTypedChars(0);
  }, []);

  // Step advancement
  useEffect(() => {
    if (!isVisible || step < 0) return;

    if (step === 2) {
      // Typing step: wait until typing completes, then advance
      if (typedChars >= TYPED_TEXT.length) {
        const timer = setTimeout(() => setStep(3), 800);
        return () => clearTimeout(timer);
      }
      return;
    }

    const timer = setTimeout(() => {
      if (step >= 3) {
        // Reset after last step
        const resetTimer = setTimeout(resetAndStart, 1500);
        return () => clearTimeout(resetTimer);
      }
      setStep((s) => s + 1);
      setTypedChars(0);
    }, STEP_DURATION);

    return () => clearTimeout(timer);
  }, [isVisible, step, typedChars, resetAndStart]);

  // Start when visible
  useEffect(() => {
    if (isVisible && step === -1) {
      const timer = setTimeout(resetAndStart, 400);
      return () => clearTimeout(timer);
    }
  }, [isVisible, step, resetAndStart]);

  // Typing animation
  useEffect(() => {
    if (step !== 2 || typedChars >= TYPED_TEXT.length) return;
    const timer = setInterval(() => {
      setTypedChars((c) => Math.min(c + 1, TYPED_TEXT.length));
    }, TYPE_INTERVAL);
    return () => clearInterval(timer);
  }, [step, typedChars]);

  const urlText = step >= 0 ? 'https://shop.example.com' : '';
  const searchValue = step >= 2 ? TYPED_TEXT.slice(0, typedChars) : '';
  const pageVisible = step >= 0;

  return (
    <div ref={ref} className={`bcm-card ${isVisible ? 'bcm-active' : ''}`} aria-hidden="true">
      {/* Browser chrome */}
      <div className="bcm-chrome">
        <div className="bcm-dots">
          <span className="bcm-dot bcm-dot-red" />
          <span className="bcm-dot bcm-dot-yellow" />
          <span className="bcm-dot bcm-dot-green" />
        </div>
        <div className="bcm-url-bar">
          <span className="bcm-url-text">{urlText}</span>
          {step === 0 && <span className="bcm-url-cursor" />}
        </div>
      </div>

      {/* Page content */}
      <div className={`bcm-page ${pageVisible ? 'bcm-page-visible' : ''}`}>
        <div className="bcm-page-heading">Welcome to Shop</div>

        <div className="bcm-search-row">
          <div className={`bcm-search-input ${step === 1 ? 'bcm-highlight' : ''} ${step === 2 ? 'bcm-typing' : ''}`}>
            {step === 1 && <span className="bcm-selector-tooltip">input.search</span>}
            <span className="bcm-search-text">
              {searchValue || (step < 2 ? 'Search products...' : '')}
            </span>
            {step === 2 && typedChars < TYPED_TEXT.length && (
              <span className="bcm-type-cursor" />
            )}
            {step === 1 && <span className="bcm-click-ripple" />}
          </div>
          <div className={`bcm-search-btn ${step === 3 ? 'bcm-highlight' : ''}`}>
            Search
            {step === 3 && <span className="bcm-click-ripple" />}
          </div>
        </div>

        <div className="bcm-products">
          <div className="bcm-product">
            <div className="bcm-product-img" />
            <div className="bcm-product-name">Item 1</div>
            <div className="bcm-product-price">$29.99</div>
          </div>
          <div className="bcm-product">
            <div className="bcm-product-img" />
            <div className="bcm-product-name">Item 2</div>
            <div className="bcm-product-price">$49.99</div>
          </div>
          <div className="bcm-product">
            <div className="bcm-product-img" />
            <div className="bcm-product-name">Item 3</div>
            <div className="bcm-product-price">$19.99</div>
          </div>
        </div>
      </div>

      {/* Action log */}
      <div className="bcm-actions">
        {ACTION_LABELS.map((action, i) => {
          let status: 'done' | 'active' | 'pending' = 'pending';
          if (i < step) status = 'done';
          else if (i === step) status = 'active';

          return (
            <div key={action.label} className={`bcm-action bcm-action-${status}`}>
              <span className={`bcm-action-dot bcm-action-dot-${status}`}>
                {status === 'done' ? '\u2713' : ''}
              </span>
              <code className="bcm-action-cmd">{action.cmd}</code>
              <span className={`bcm-action-badge bcm-action-badge-${status}`}>
                {status === 'done' ? 'done' : status === 'active' ? 'running' : 'pending'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
