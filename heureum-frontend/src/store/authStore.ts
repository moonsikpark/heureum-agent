// Copyright (c) 2026 Heureum AI. All rights reserved.

import { create } from 'zustand';
import {
  getSession,
  getUserInfo,
  logout as apiLogout,
  type UserInfo,
} from '../lib/authApi';

interface AuthState {
  user: UserInfo | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  fetchUser: () => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: UserInfo | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  fetchUser: async () => {
    set({ isLoading: true });
    try {
      // Call getSession first — this sets the CSRF cookie needed for POST requests
      const session = await getSession();
      if (session.meta?.is_authenticated) {
        const user = await getUserInfo();
        set({ user, isAuthenticated: true, isLoading: false });
      } else {
        set({ user: null, isAuthenticated: false, isLoading: false });
      }
    } catch {
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  logout: async () => {
    try {
      await apiLogout();
    } catch {
      // Ignore errors on logout
    }
    set({ user: null, isAuthenticated: false });
  },

  setUser: (user) => {
    set({ user, isAuthenticated: !!user, isLoading: false });
  },
}));
