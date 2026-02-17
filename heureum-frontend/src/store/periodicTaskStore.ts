// Copyright (c) 2026 Heureum AI. All rights reserved.

import { create } from 'zustand';
import type { PeriodicTask, PeriodicTaskRun } from '../types';

interface PeriodicTaskState {
  tasks: PeriodicTask[];
  selectedTask: PeriodicTask | null;
  runs: PeriodicTaskRun[];
  isLoading: boolean;
  setTasks: (tasks: PeriodicTask[]) => void;
  selectTask: (task: PeriodicTask | null) => void;
  setRuns: (runs: PeriodicTaskRun[]) => void;
  setLoading: (loading: boolean) => void;
  updateTask: (taskId: string, updates: Partial<PeriodicTask>) => void;
  removeTask: (taskId: string) => void;
}

export const usePeriodicTaskStore = create<PeriodicTaskState>((set) => ({
  tasks: [],
  selectedTask: null,
  runs: [],
  isLoading: false,
  setTasks: (tasks) => set({ tasks }),
  selectTask: (task) => set({ selectedTask: task, runs: [] }),
  setRuns: (runs) => set({ runs }),
  setLoading: (loading) => set({ isLoading: loading }),
  updateTask: (taskId, updates) =>
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === taskId ? { ...t, ...updates } : t)),
      selectedTask:
        s.selectedTask?.id === taskId
          ? { ...s.selectedTask, ...updates } as PeriodicTask
          : s.selectedTask,
    })),
  removeTask: (taskId) =>
    set((s) => ({
      tasks: s.tasks.filter((t) => t.id !== taskId),
      selectedTask: s.selectedTask?.id === taskId ? null : s.selectedTask,
    })),
}));
