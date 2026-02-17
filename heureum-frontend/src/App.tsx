// Copyright (c) 2026 Heureum AI. All rights reserved.

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import Home from './pages/Home';
import ChatPage from './pages/ChatPage';
import ChatViewerPage from './pages/ChatViewerPage';
import LoginPage from './pages/LoginPage';
import LoginCallbackPage from './pages/LoginCallbackPage';
import SettingsPage from './pages/SettingsPage';
import PeriodicTasksPage from './pages/PeriodicTasksPage';
import ContactPage from './pages/ContactPage';
import { useAuthStore } from './store/authStore';
import { requestPermissionAndGetToken, setupForegroundListener, cleanupLegacyServiceWorkers, unregisterToken } from './lib/pushNotifications';
import { notificationAPI } from './lib/api';
import './App.css';

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return <div className="loading-screen">Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function GuestRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return <div className="loading-screen">Loading...</div>;
  }

  if (isAuthenticated) {
    return <Navigate to="/chat" replace />;
  }

  return <>{children}</>;
}

function AppContent() {
  const { fetchUser, isAuthenticated, isLoading } = useAuthStore();

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  // Register for push notifications after login
  useEffect(() => {
    if (!isAuthenticated || isLoading) return;

    // Electron: start SSE notification stream via main process
    if (window.api?.startNotificationStream) {
      const platformUrl = import.meta.env.VITE_API_URL || 'http://localhost:8001';
      window.api.startNotificationStream(platformUrl).catch(() => {});
      return () => {
        window.api?.stopNotificationStream?.().catch(() => {});
      };
    }

    // Clean up old Firebase service workers from migration
    cleanupLegacyServiceWorkers().catch(() => {});

    // Web browser: only register push if user has web_enabled, otherwise unsubscribe
    notificationAPI.getPreferences()
      .then(({ preferences }) => {
        if (preferences.web_enabled) {
          return requestPermissionAndGetToken().then((token) => {
            if (token) {
              notificationAPI.registerDevice(token, 'web').catch(() => {});
              setupForegroundListener();
            }
          });
        } else {
          // Unsubscribe any existing push subscription to stop deliveries
          unregisterToken().then((token) => {
            if (token) notificationAPI.unregisterDevice(token).catch(() => {});
          }).catch(() => {});
        }
      })
      .catch(() => {});
  }, [isAuthenticated, isLoading]);

  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<GuestRoute><Home /></GuestRoute>} />
        <Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
        <Route path="/login/callback" element={<LoginCallbackPage />} />
        <Route
          path="/chat"
          element={
            <ProtectedRoute>
              <ChatPage />
            </ProtectedRoute>
          }
        />
        <Route path="/chat/view/:sessionId" element={<ChatViewerPage />} />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <SettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/tasks"
          element={
            <ProtectedRoute>
              <PeriodicTasksPage />
            </ProtectedRoute>
          }
        />
        <Route path="/contact" element={<ContactPage />} />
      </Routes>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
