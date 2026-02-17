// Copyright (c) 2026 Heureum AI. All rights reserved.

import type { TodoState } from '../types';
import './TodoProgress.css';

interface TodoProgressProps {
  todo: TodoState;
}

const STEP_ICONS: Record<string, string> = {
  completed: '\u2611',    // ☑
  in_progress: '\u2733',  // ✳
  pending: '\u2610',      // ☐
  failed: '\u2612',       // ☒
};

export default function TodoProgress({ todo }: TodoProgressProps) {
  return (
    <div className="ac-todo">
      <div className="ac-todo-dot" />
      <div className="ac-todo-content">
        <div className="ac-todo-task">{todo.task}</div>
        <div className="ac-todo-steps">
          {todo.steps.map((step, i) => (
            <div key={i} className={`ac-todo-step ac-todo-step-${step.status}`}>
              <span className="ac-todo-step-icon">
                {STEP_ICONS[step.status] || STEP_ICONS.pending}
              </span>
              <span className="ac-todo-step-desc">{step.description}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
