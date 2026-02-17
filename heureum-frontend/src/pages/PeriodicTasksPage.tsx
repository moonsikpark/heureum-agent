// Copyright (c) 2026 Heureum AI. All rights reserved.

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { periodicTaskAPI } from '../lib/api';
import { usePeriodicTaskStore } from '../store/periodicTaskStore';
import type { PeriodicTask } from '../types';
import './PeriodicTasksPage.css';

function formatSchedule(schedule: PeriodicTask['schedule']): string {
  if (!schedule) return 'N/A';
  if (schedule.type === 'cron' && schedule.cron) {
    const { minute, hour, day_of_week: dow } = schedule.cron;
    const time = hour !== '*' ? `${String(hour).padStart(2, '0')}:${String(minute ?? 0).padStart(2, '0')}` : `every hour at :${String(minute ?? 0).padStart(2, '0')}`;
    if (dow === '*' || dow === undefined) return `Every day at ${time}`;
    if (dow === '1-5') return `Weekdays at ${time}`;
    return `Day ${dow} at ${time}`;
  }
  if (schedule.type === 'interval' && schedule.interval) {
    return `Every ${schedule.interval.every} ${schedule.interval.unit}`;
  }
  return 'Custom';
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
  });
}

function formatNextRunRelative(dateStr: string | null): string {
  if (!dateStr) return '';
  const now = Date.now();
  const next = new Date(dateStr).getTime();
  const diff = next - now;
  if (diff < 0) return ' (overdue)';
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return ' (soon)';
  if (minutes < 60) return ` (in ${minutes}m)`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    const rem = minutes % 60;
    return rem > 0 ? ` (in ${hours}h ${rem}m)` : ` (in ${hours}h)`;
  }
  const days = Math.floor(hours / 24);
  return ` (in ${days}d ${hours % 24}h)`;
}

function StatusBadge({ status }: { status: string }) {
  const cls = `pt-badge pt-badge-${status}`;
  const labels: Record<string, string> = {
    active: 'Active',
    paused: 'Paused',
    failed: 'Failed',
    completed: 'Completed',
  };
  return <span className={cls}>{labels[status] || status}</span>;
}

function RunStatusBadge({ status }: { status: string }) {
  const cls = `pt-run-badge pt-run-badge-${status}`;
  const labels: Record<string, string> = {
    running: 'Running',
    completed: 'Completed',
    failed: 'Failed',
  };
  return <span className={cls}>{labels[status] || status}</span>;
}

export default function PeriodicTasksPage() {
  const navigate = useNavigate();
  const {
    tasks, selectedTask, runs, isLoading,
    setTasks, selectTask, setRuns, setLoading,
    updateTask, removeTask,
  } = usePeriodicTaskStore();

  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const data = await periodicTaskAPI.list();
      setTasks(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [setTasks, setLoading]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const loadRuns = useCallback(async (taskId: string) => {
    try {
      const data = await periodicTaskAPI.runs(taskId);
      setRuns(data);
    } catch {
      // ignore
    }
  }, [setRuns]);

  const handleSelect = (task: PeriodicTask) => {
    selectTask(task);
    loadRuns(task.id);
  };

  const handlePause = async (taskId: string) => {
    setActionLoading(taskId);
    try {
      const updated = await periodicTaskAPI.pause(taskId);
      updateTask(taskId, updated);
    } catch { /* ignore */ }
    setActionLoading(null);
  };

  const handleResume = async (taskId: string) => {
    setActionLoading(taskId);
    try {
      const updated = await periodicTaskAPI.resume(taskId);
      updateTask(taskId, updated);
    } catch { /* ignore */ }
    setActionLoading(null);
  };

  const handleDelete = async (taskId: string) => {
    if (!confirm('Delete this periodic task?')) return;
    setActionLoading(taskId);
    try {
      await periodicTaskAPI.delete(taskId);
      removeTask(taskId);
    } catch { /* ignore */ }
    setActionLoading(null);
  };

  return (
    <div className="pt-page">
      <button className="pt-back" onClick={() => navigate('/chat')} title="Back to chat">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <div className="pt-container">
        {/* Left panel — task list */}
        <div className="pt-list-panel">
          <div className="pt-list-header">
            <h2 className="pt-list-title">Scheduled Tasks</h2>
            <span className="pt-list-count">{tasks.length}</span>
          </div>

          {isLoading && tasks.length === 0 && (
            <div className="pt-empty">Loading...</div>
          )}

          {!isLoading && tasks.length === 0 && (
            <div className="pt-empty">
              No scheduled tasks yet. Ask your assistant to create one!
            </div>
          )}

          <div className="pt-list">
            {tasks.map((task) => (
              <button
                key={task.id}
                className={`pt-list-item ${selectedTask?.id === task.id ? 'pt-list-item-active' : ''}`}
                onClick={() => handleSelect(task)}
              >
                <div className="pt-list-item-header">
                  <span className="pt-list-item-title">{task.title}</span>
                  <StatusBadge status={task.status} />
                </div>
                <div className="pt-list-item-meta">
                  <span>{formatSchedule(task.schedule)}</span>
                  {task.next_run_at && (
                    <span>Next: {formatDate(task.next_run_at)}{formatNextRunRelative(task.next_run_at)}</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right panel — detail */}
        <div className="pt-detail-panel">
          {!selectedTask ? (
            <div className="pt-detail-empty">Select a task to see details</div>
          ) : (
            <>
              <div className="pt-detail-header">
                <h2 className="pt-detail-title">{selectedTask.title}</h2>
                <StatusBadge status={selectedTask.status} />
              </div>

              {selectedTask.description && (
                <p className="pt-detail-desc">{selectedTask.description}</p>
              )}

              <div className="pt-detail-info">
                <div className="pt-info-row">
                  <span className="pt-info-label">Schedule</span>
                  <span>{formatSchedule(selectedTask.schedule)}</span>
                </div>
                <div className="pt-info-row">
                  <span className="pt-info-label">Timezone</span>
                  <span>{selectedTask.timezone_name}</span>
                </div>
                <div className="pt-info-row">
                  <span className="pt-info-label">Next Run</span>
                  <span>{formatDate(selectedTask.next_run_at)}{formatNextRunRelative(selectedTask.next_run_at)}</span>
                </div>
                <div className="pt-info-row">
                  <span className="pt-info-label">Last Run</span>
                  <span>{formatDate(selectedTask.last_run_at)}</span>
                </div>
                <div className="pt-info-row">
                  <span className="pt-info-label">Total Runs</span>
                  <span>{selectedTask.total_runs} ({selectedTask.total_successes} ok, {selectedTask.total_failures} failed)</span>
                </div>
                <div className="pt-info-row">
                  <span className="pt-info-label">Created</span>
                  <span>{formatDate(selectedTask.created_at)}</span>
                </div>
                <div className="pt-info-row">
                  <span className="pt-info-label">Success Notification</span>
                  <label className="pt-toggle">
                    <input
                      type="checkbox"
                      checked={selectedTask.notify_on_success}
                      onChange={async () => {
                        const updated = await periodicTaskAPI.update(selectedTask.id, {
                          notify_on_success: !selectedTask.notify_on_success,
                        });
                        updateTask(selectedTask.id, updated);
                      }}
                    />
                    <span className="pt-toggle-label">{selectedTask.notify_on_success ? 'On' : 'Off'}</span>
                  </label>
                </div>
              </div>

              <div className="pt-detail-actions">
                {selectedTask.status === 'active' && (
                  <button
                    className="pt-action-btn pt-action-pause"
                    onClick={() => handlePause(selectedTask.id)}
                    disabled={actionLoading === selectedTask.id}
                  >
                    Pause
                  </button>
                )}
                {(selectedTask.status === 'paused' || selectedTask.status === 'failed') && (
                  <button
                    className="pt-action-btn pt-action-resume"
                    onClick={() => handleResume(selectedTask.id)}
                    disabled={actionLoading === selectedTask.id}
                  >
                    Resume
                  </button>
                )}
                <button
                  className="pt-action-btn pt-action-delete"
                  onClick={() => handleDelete(selectedTask.id)}
                  disabled={actionLoading === selectedTask.id}
                >
                  Delete
                </button>
              </div>

              <div className="pt-runs-section">
                <h3 className="pt-runs-title">Execution History</h3>
                {runs.length === 0 ? (
                  <div className="pt-runs-empty">No runs yet</div>
                ) : (
                  <div className="pt-runs-list">
                    {runs.map((run) => (
                      <div key={run.id} className="pt-run-item">
                        <div className="pt-run-header">
                          <RunStatusBadge status={run.status} />
                          <span className="pt-run-date">{formatDate(run.started_at)}</span>
                          {run.attempt > 1 && (
                            <span className="pt-run-attempt">Attempt {run.attempt}</span>
                          )}
                        </div>
                        {run.output_summary && (
                          <div className="pt-run-summary">{run.output_summary.slice(0, 300)}</div>
                        )}
                        {run.error_message && (
                          <div className="pt-run-error">{run.error_message.slice(0, 300)}</div>
                        )}
                        <div className="pt-run-meta">
                          {run.total_tokens > 0 && <span>{run.total_tokens.toLocaleString()} tokens</span>}
                          {run.iterations > 0 && <span>{run.iterations} iterations</span>}
                          {run.completed_at && (
                            <span>{Math.round((new Date(run.completed_at).getTime() - new Date(run.started_at).getTime()) / 1000)}s</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
