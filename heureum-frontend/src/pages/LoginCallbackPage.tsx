// Copyright (c) 2026 Heureum AI. All rights reserved.

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getUserInfo } from '../lib/authApi';
import { useAuthStore } from '../store/authStore';
import './LoginPage.css';

export default function LoginCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setUser } = useAuthStore();
  const [error, setError] = useState('');

  useEffect(() => {
    const status = searchParams.get('status');
    const reason = searchParams.get('reason');
    const token = searchParams.get('token');

    // Handle token-based auth (web fallback from magic link redirect page)
    if (token) {
      const platformUrl = import.meta.env.VITE_API_URL || 'http://localhost:8001';
      window.location.href = `${platformUrl}/api/v1/auth/token/exchange/?token=${encodeURIComponent(token)}`;
      return;
    }

    if (status === 'signup_required') {
      // Magic link verified email but no account exists — redirect to login page
      // The session has pending_auth with verified=true, so the signup form will work
      navigate('/login');
      return;
    }

    if (status === 'error') {
      const messages: Record<string, string> = {
        missing_code: 'No sign-in code provided.',
        no_pending_login: 'No pending sign-in found. Please request a new code.',
        expired: 'The sign-in code has expired. Please request a new one.',
        invalid_code: 'Invalid sign-in code. Please try again.',
        missing_token: 'No authentication token provided.',
        invalid_token: 'Invalid or already used authentication token.',
        token_expired: 'Authentication token has expired. Please request a new code.',
      };
      setError(messages[reason || ''] || 'Sign-in failed. Please try again.');
      return;
    }

    // Try to fetch the user (magic link or social login callback)
    getUserInfo()
      .then((user) => {
        setUser(user);
        navigate('/chat');
      })
      .catch(() => {
        setError('Sign-in failed. Please try again.');
      });
  }, [searchParams, setUser, navigate]);

  if (error) {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="login-header">
            <h1 className="login-title">Heureum</h1>
            <p className="login-subtitle">Sign-in failed</p>
          </div>
          <div className="login-error">{error}</div>
          <button className="login-button" onClick={() => navigate('/login')}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <h1 className="login-title">Heureum</h1>
          <p className="login-subtitle">Signing you in...</p>
        </div>
      </div>
    </div>
  );
}
