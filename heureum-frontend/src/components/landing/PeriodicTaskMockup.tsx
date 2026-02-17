import { useIntersectionObserver } from '../../lib/useIntersectionObserver';
import './PeriodicTaskMockup.css';

const MOCK_TASKS = [
  { name: 'Daily News Summary', schedule: 'Every day at 08:00', next: 'in 2h 15m', status: 'active' as const },
  { name: 'Weekly Report Generator', schedule: 'Weekdays at 09:00', next: 'in 1d 4h', status: 'active' as const },
  { name: 'Data Backup', schedule: 'Every 6 hours', next: '\u2014', status: 'paused' as const },
];

const TIMELINE_MARKERS = [
  { label: '08:00', left: '15%' },
  { label: '09:00', left: '45%' },
  { label: '14:00', left: '78%' },
];

export default function PeriodicTaskMockup() {
  const { ref, isVisible } = useIntersectionObserver({ threshold: 0.2 });

  return (
    <div ref={ref} className={`ptm-card ${isVisible ? 'ptm-active' : ''}`} aria-hidden="true">
      {/* Header */}
      <div className="ptm-header">
        <span className="ptm-header-title">Scheduled Tasks</span>
        <span className="ptm-header-count">3 tasks</span>
      </div>

      {/* Task list */}
      <div className="ptm-tasks">
        {MOCK_TASKS.map((task, i) => (
          <div
            key={task.name}
            className={`ptm-task ${i === 0 ? 'ptm-task-running' : ''}`}
            style={{ '--item-index': i } as React.CSSProperties}
          >
            <div className="ptm-task-top">
              <div className="ptm-task-left">
                <span className={`ptm-dot ptm-dot-${task.status}`} />
                <span className="ptm-task-name">{task.name}</span>
              </div>
              <span className={`ptm-badge ptm-badge-${task.status}`}>
                {task.status === 'active' ? 'Active' : 'Paused'}
              </span>
            </div>
            <div className="ptm-task-meta">
              <span className="ptm-task-schedule">{task.schedule}</span>
              <span className="ptm-task-sep">&middot;</span>
              <span className="ptm-task-next">Next: {task.next}</span>
            </div>
            {i === 0 && <div className="ptm-progress-bar" />}
          </div>
        ))}
      </div>

      {/* Timeline */}
      <div className="ptm-timeline">
        <div className="ptm-timeline-label">Timeline</div>
        <div className="ptm-timeline-track">
          <div className="ptm-timeline-line" />
          {TIMELINE_MARKERS.map((m, i) => (
            <div
              key={m.label}
              className="ptm-timeline-marker"
              style={{ left: m.left, '--marker-index': i } as React.CSSProperties}
            >
              <div className="ptm-timeline-dot" />
              <span className="ptm-timeline-time">{m.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
