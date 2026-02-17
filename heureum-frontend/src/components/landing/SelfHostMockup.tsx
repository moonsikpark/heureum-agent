import { useState } from 'react';
import { useIntersectionObserver } from '../../lib/useIntersectionObserver';
import './SelfHostMockup.css';

const MODELS = [
  { name: 'gpt-oss-70b', provider: 'Open Source' },
  { name: 'llama-3-405b', provider: 'Meta' },
  { name: 'mistral-large', provider: 'Mistral AI' },
];

export default function SelfHostMockup() {
  const { ref, isVisible } = useIntersectionObserver({ threshold: 0.2 });
  const [selectedModel, setSelectedModel] = useState(0);

  return (
    <div ref={ref} className={`shm-card ${isVisible ? 'shm-active' : ''}`}>
      {/* Header */}
      <div className="shm-header">
        <span className="shm-header-title">Deployment Settings</span>
        <span className="shm-header-badge">Self-Hosted</span>
      </div>

      <div className="shm-body">
        {/* Infra section */}
        <div className="shm-section" style={{ '--item-index': 0 } as React.CSSProperties}>
          <div className="shm-section-label">Infrastructure</div>
          <div className="shm-infra-row">
            <div className="shm-infra-item">
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="8" rx="2" />
                <rect x="2" y="14" width="20" height="8" rx="2" />
                <circle cx="6" cy="6" r="1" fill="currentColor" />
                <circle cx="6" cy="18" r="1" fill="currentColor" />
              </svg>
              <span>Your servers</span>
            </div>
            <div className="shm-infra-item">
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <span>Private network</span>
            </div>
          </div>
        </div>

        {/* Model selection */}
        <div className="shm-section" style={{ '--item-index': 1 } as React.CSSProperties}>
          <div className="shm-section-label">AI Model</div>
          <div className="shm-models">
            {MODELS.map((m, i) => (
              <div
                key={m.name}
                className={`shm-model ${selectedModel === i ? 'shm-model-active' : ''}`}
                style={{ '--model-index': i } as React.CSSProperties}
                onClick={() => setSelectedModel(i)}
              >
                <div className="shm-model-radio">
                  {selectedModel === i && <div className="shm-model-radio-dot" />}
                </div>
                <div className="shm-model-info">
                  <span className="shm-model-name">{m.name}</span>
                  <span className="shm-model-provider">{m.provider}</span>
                </div>
                {selectedModel === i && <span className="shm-model-check">{'\u2713'}</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Data privacy */}
        <div className="shm-section" style={{ '--item-index': 2 } as React.CSSProperties}>
          <div className="shm-privacy">
            <div className="shm-privacy-icon">
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <div className="shm-privacy-text">
              <span className="shm-privacy-title">Your data never leaves your infrastructure</span>
              <span className="shm-privacy-sub">All processing happens on your servers. Zero external API calls.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
