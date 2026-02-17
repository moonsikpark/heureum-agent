// Copyright (c) 2026 Heureum AI. All rights reserved.

import { useEffect } from 'react';
import type { PermissionRequest, PermissionDecision } from '../types';
import './PermissionPrompt.css';

interface PermissionPromptProps {
  request: PermissionRequest;
  onDecision: (decision: PermissionDecision) => void;
  onCancel?: () => void;
}

export default function PermissionPrompt({ request, onDecision, onCancel }: PermissionPromptProps) {
  const baseCommand = request.command.trim().split(/\s+/)[0];

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      onDecision('deny');
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel, onDecision]);

  return (
    <div className="permission-panel">
      <div className="permission-panel-header">
        <span className="permission-panel-tag">
          <span>&#x26A0;</span> Permission Required
        </span>
        <button
          className="permission-panel-close"
          onClick={handleCancel}
          aria-label="Cancel"
        >
          &#x2715;
        </button>
      </div>

      <pre className="permission-command">{request.command}</pre>

      <div className="permission-panel-options">
        <button className="permission-option primary" onClick={() => onDecision('always_allow')}>
          <span className="permission-option-icon">&#x2713;</span>
          <span className="permission-option-label">
            Always Allow
            <span className="permission-option-desc"> &mdash; auto-approve future {baseCommand} commands</span>
          </span>
        </button>
        <button className="permission-option" onClick={() => onDecision('allow_once')}>
          <span className="permission-option-icon">&#x25B6;</span>
          <span className="permission-option-label">Allow Once</span>
        </button>
        <button className="permission-option deny" onClick={() => onDecision('deny')}>
          <span className="permission-option-icon">&#x2715;</span>
          <span className="permission-option-label">Deny</span>
        </button>
      </div>

      <div className="permission-panel-footer">
        <span className="permission-panel-esc"><kbd>Esc</kbd> to deny</span>
      </div>
    </div>
  );
}
