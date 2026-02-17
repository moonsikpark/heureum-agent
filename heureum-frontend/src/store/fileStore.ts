// Copyright (c) 2026 Heureum AI. All rights reserved.

import { create } from 'zustand';
import type { SessionFileInfo } from '../lib/api';

interface FileState {
  files: SessionFileInfo[];
  isFilePanelOpen: boolean;
  selectedFile: SessionFileInfo | null;
  mode: 'list' | 'edit' | 'preview';
  setFiles: (files: SessionFileInfo[]) => void;
  toggleFilePanel: () => void;
  openFilePanel: () => void;
  closeFilePanel: () => void;
  selectFile: (file: SessionFileInfo) => void;
  clearSelection: () => void;
  setMode: (mode: 'list' | 'edit' | 'preview') => void;
  updateFileInList: (updated: SessionFileInfo) => void;
  removeFileFromList: (fileId: string) => void;
}

export const useFileStore = create<FileState>((set) => ({
  files: [],
  isFilePanelOpen: false,
  selectedFile: null,
  mode: 'list',
  setFiles: (files) => set({ files }),
  toggleFilePanel: () => set((s) => ({ isFilePanelOpen: !s.isFilePanelOpen })),
  openFilePanel: () => set({ isFilePanelOpen: true }),
  closeFilePanel: () => set({ isFilePanelOpen: false, selectedFile: null, mode: 'list' }),
  selectFile: (file) => set({
    selectedFile: file,
    mode: 'preview',
  }),
  clearSelection: () => set({ selectedFile: null, mode: 'list' }),
  setMode: (mode) => set({ mode }),
  updateFileInList: (updated) => set((s) => ({
    files: s.files.map((f) => (f.id === updated.id ? updated : f)),
    selectedFile: s.selectedFile?.id === updated.id ? updated : s.selectedFile,
  })),
  removeFileFromList: (fileId) => set((s) => ({
    files: s.files.filter((f) => f.id !== fileId),
    selectedFile: s.selectedFile?.id === fileId ? null : s.selectedFile,
    mode: s.selectedFile?.id === fileId ? 'list' : s.mode,
  })),
}));
