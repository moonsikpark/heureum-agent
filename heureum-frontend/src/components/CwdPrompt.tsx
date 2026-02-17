// Copyright (c) 2026 Heureum AI. All rights reserved.

import { useEffect } from 'react';
import './PermissionPrompt.css';

interface CwdPromptProps {
  onDecision: (proceed: boolean) => void;
}

export default function CwdPrompt({ onDecision }: CwdPromptProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onDecision(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onDecision]);

  return (
    <div className="permission-panel">
      <div className="permission-panel-header">
        <span className="permission-panel-tag">
          <span>&#x1F4C2;</span> Working Directory
        </span>
        <button
          className="permission-panel-close"
          onClick={() => onDecision(false)}
          aria-label="Cancel"
        >
          &#x2715;
        </button>
      </div>

      <div className="permission-panel-options">
        <button className="permission-option primary" onClick={() => onDecision(true)}>
          <span className="permission-option-icon">&#x1F4C2;</span>
          <span className="permission-option-label">
            Select Folder
            <span className="permission-option-desc"> &mdash; choose a working directory for commands</span>
          </span>
        </button>
        <button className="permission-option deny" onClick={() => onDecision(false)}>
          <span className="permission-option-icon">&#x2715;</span>
          <span className="permission-option-label">Skip</span>
        </button>
      </div>

      <div className="permission-panel-footer">
        <span className="permission-panel-esc"><kbd>Esc</kbd> to skip</span>
      </div>
    </div>
  );
}
