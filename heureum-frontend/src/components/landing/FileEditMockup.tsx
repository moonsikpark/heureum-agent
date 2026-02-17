import { useState, useEffect } from 'react';
import { useIntersectionObserver } from '../../lib/useIntersectionObserver';
import './FileEditMockup.css';

const MOCK_FILES = [
  { name: 'report.md', icon: '\u{1F4DD}', badge: 'Agent' },
  { name: 'chart.png', icon: '\u{1F5BC}', badge: null },
  { name: 'invoice.pdf', icon: '\u{1F4C4}', badge: null },
  { name: 'data.csv', icon: '\u{1F4CE}', badge: 'Agent' },
];

interface ContentLine {
  raw: string;
  type: 'h1' | 'h2' | 'text' | 'blank' | 'bullet';
}

const CONTENT_LINES: ContentLine[] = [
  { raw: '# Q4 Sales Report', type: 'h1' },
  { raw: '', type: 'blank' },
  { raw: '## Revenue Summary', type: 'h2' },
  { raw: 'Total revenue grew by **23%** compared to Q3, reaching **$4.2M** across all regions.', type: 'text' },
  { raw: '', type: 'blank' },
  { raw: '## Key Metrics', type: 'h2' },
  { raw: '- ARR: $16.8M', type: 'bullet' },
  { raw: '- Churn rate: 2.1%', type: 'bullet' },
  { raw: '- New customers: 847', type: 'bullet' },
];

function renderLine(line: ContentLine) {
  const renderBold = (text: string) => {
    const parts = text.split(/\*\*(.+?)\*\*/g);
    return parts.map((part, i) =>
      i % 2 === 1 ? <strong key={i}>{part}</strong> : part,
    );
  };

  switch (line.type) {
    case 'h1':
      return <div className="fem-line fem-h1">{line.raw.replace(/^#\s+/, '')}</div>;
    case 'h2':
      return <div className="fem-line fem-h2">{line.raw.replace(/^##\s+/, '')}</div>;
    case 'bullet':
      return <div className="fem-line fem-bullet">{renderBold(line.raw.replace(/^-\s+/, ''))}</div>;
    case 'blank':
      return <div className="fem-line fem-blank" />;
    default:
      return <div className="fem-line fem-text">{renderBold(line.raw)}</div>;
  }
}

export default function FileEditMockup() {
  const { ref, isVisible } = useIntersectionObserver({ threshold: 0.2 });
  const [revealedLines, setRevealedLines] = useState(0);

  useEffect(() => {
    if (!isVisible || revealedLines >= CONTENT_LINES.length) return;
    const timer = setInterval(() => {
      setRevealedLines((n) => {
        if (n >= CONTENT_LINES.length) return n;
        return n + 1;
      });
    }, 280);
    return () => clearInterval(timer);
  }, [isVisible, revealedLines]);

  return (
    <div ref={ref} className={`fem-card ${isVisible ? 'fem-active' : ''}`} aria-hidden="true">
      <div className="fem-split">
        {/* File list */}
        <div className="fem-sidebar">
          <div className="fem-sidebar-header">Files</div>
          <div className="fem-file-list">
            {MOCK_FILES.map((file, i) => (
              <div
                key={file.name}
                className={`fem-file ${i === 0 ? 'fem-file-selected' : ''}`}
                style={{ '--item-index': i } as React.CSSProperties}
              >
                <span className="fem-file-icon">{file.icon}</span>
                <span className="fem-file-name">{file.name}</span>
                {file.badge && (
                  <span className="fem-file-badge">{file.badge}</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Preview pane */}
        <div className="fem-preview">
          <div className="fem-preview-header">
            <span className="fem-preview-filename">report.md</span>
            <span className="fem-preview-mode">Preview</span>
          </div>
          <div className="fem-preview-content">
            {CONTENT_LINES.slice(0, revealedLines).map((line, i) => (
              <div
                key={i}
                className="fem-line-wrapper"
                style={{ '--line-index': i } as React.CSSProperties}
              >
                {renderLine(line)}
              </div>
            ))}
            {revealedLines < CONTENT_LINES.length && revealedLines > 0 && (
              <span className="fem-write-cursor" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
