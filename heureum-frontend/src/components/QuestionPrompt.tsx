// Copyright (c) 2026 Heureum AI. All rights reserved.

import { useState, useEffect } from 'react';
import type { QuestionRequest, QuestionAnswer, ChoiceObject } from '../types';
import { normalizeChoice } from '../types';
import './QuestionPrompt.css';

interface QuestionPromptProps {
  question: QuestionRequest;
  onAnswer: (answer: QuestionAnswer) => void;
  onCancel?: () => void;
  disabled?: boolean;
}

export default function QuestionPrompt({ question, onAnswer, onCancel, disabled }: QuestionPromptProps) {
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [userInput, setUserInput] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  // Normalize choices to ChoiceObject[]
  const normalizedChoices: ChoiceObject[] = question.choices.map(normalizeChoice);

  // Filter out "Other" from choices when allowUserInput is true
  const displayChoices = question.allowUserInput
    ? normalizedChoices.filter((c) => c.label.toLowerCase() !== 'other')
    : normalizedChoices;

  const handleSelectChoice = (label: string) => {
    setSelectedChoice(label);
    setShowCustomInput(false);
  };

  const handleToggleCustomInput = () => {
    setSelectedChoice(null);
    setShowCustomInput(true);
  };

  const handleSubmit = () => {
    if (showCustomInput && userInput.trim()) {
      onAnswer({ type: 'user_input', value: userInput.trim() });
    } else if (selectedChoice) {
      onAnswer({ type: 'choice', value: selectedChoice });
    }
  };

  const canSubmit = showCustomInput ? !!userInput.trim() : !!selectedChoice;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onCancel) {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  return (
    <div className="question-panel">
      <div className="question-panel-header">
        <span className="question-panel-tag">
          <span>&#x2753;</span> Question
        </span>
        {onCancel && (
          <button
            className="question-panel-close"
            onClick={onCancel}
            aria-label="Cancel"
          >
            &#x2715;
          </button>
        )}
      </div>

      <p className="question-panel-text">{question.question}</p>

      <div className="question-panel-choices">
        {displayChoices.map((choice, index) => (
          <button
            key={index}
            className={`question-panel-choice ${selectedChoice === choice.label ? 'selected' : ''}`}
            onClick={() => handleSelectChoice(choice.label)}
            disabled={disabled}
          >
            <span className="question-panel-choice-icon">
              {selectedChoice === choice.label ? '\u25C9' : '\u25CB'}
            </span>
            <span className="question-panel-choice-content">
              <span className="question-panel-choice-label">{choice.label}</span>
              {choice.description && (
                <span className="question-panel-choice-description">{choice.description}</span>
              )}
            </span>
          </button>
        ))}
        {question.allowUserInput && (
          <button
            className={`question-panel-choice question-panel-choice-other ${showCustomInput ? 'selected' : ''}`}
            onClick={handleToggleCustomInput}
            disabled={disabled}
          >
            <span className="question-panel-choice-icon">
              {showCustomInput ? '\u25C9' : '\u25CB'}
            </span>
            Other...
          </button>
        )}
      </div>

      {showCustomInput && (
        <div className="question-panel-input-area">
          <textarea
            className="question-panel-input"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            placeholder="Type your answer..."
            disabled={disabled}
            rows={2}
            autoFocus
          />
        </div>
      )}

      <div className="question-panel-footer">
        <span className="question-panel-esc">
          {onCancel && <><kbd>Esc</kbd> to cancel</>}
        </span>
        <button
          className="question-panel-submit"
          onClick={handleSubmit}
          disabled={disabled || !canSubmit}
        >
          Submit
        </button>
      </div>
    </div>
  );
}
