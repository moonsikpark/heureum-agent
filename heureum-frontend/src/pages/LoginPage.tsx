// Copyright (c) 2026 Heureum AI. All rights reserved.

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  requestCode,
  confirmCode,
  completeSignup,
  initiateSocialLogin,
} from '../lib/authApi';
import { useAuthStore } from '../store/authStore';
import HeureumIcon from '../components/HeureumIcon';
import ThemeToggle from '../components/ThemeToggle';
import './LoginPage.css';

type Step = 'email' | 'code' | 'signup';

export default function LoginPage() {
  const navigate = useNavigate();
  const { setUser } = useAuthStore();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, []);

  const startCooldown = () => {
    setResendCooldown(30);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(cooldownRef.current!);
          cooldownRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0 || isSubmitting) return;
    setError('');
    setIsSubmitting(true);
    try {
      await requestCode(email.trim());
      startCooldown();
    } catch {
      setError('Failed to resend code. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || isSubmitting) return;

    setError('');
    setIsSubmitting(true);
    try {
      await requestCode(email.trim());
      startCooldown();
      setStep('code');
    } catch {
      setError('Failed to send code. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || isSubmitting) return;

    setError('');
    setIsSubmitting(true);
    try {
      const result = await confirmCode(code.trim());

      if (result.status === 'authenticated' && result.user) {
        setUser(result.user);
        navigate('/chat');
      } else if (result.status === 'signup_required') {
        setStep('signup');
      }
    } catch (err: any) {
      const errorField = err.response?.data?.error;
      const messages: Record<string, string> = {
        invalid_code: 'Invalid code. Please try again.',
        code_expired: 'Code expired. Please go back and try again.',
        too_many_attempts: 'Too many failed attempts. Please go back and try again.',
        no_pending_auth: 'No pending verification. Please start over.',
      };
      setError(messages[errorField || ''] || 'Verification failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim() || isSubmitting) return;

    setError('');
    setIsSubmitting(true);
    try {
      const user = await completeSignup({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
      });
      setUser(user);
      navigate('/chat');
    } catch (err: any) {
      const errorField = err.response?.data?.error;
      const messages: Record<string, string> = {
        missing_fields: 'Please fill in all fields.',
        email_not_verified: 'Email not verified. Please start over.',
        email_taken: 'An account with this email already exists.',
      };
      setError(messages[errorField || ''] || 'Failed to create account. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSocialLogin = (provider: string) => {
    const callbackUrl = `${window.location.origin}/login/callback`;
    initiateSocialLogin(provider, callbackUrl);
  };

  return (
    <div className="login-page">
      <button className="login-back" onClick={() => navigate('/')} title="Go back">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
      </button>
      <div className="login-theme-toggle">
        <ThemeToggle />
      </div>
      <div className="login-card">
        <div className="login-header">
          <h1 className="login-title">
            <HeureumIcon size={36} />
            <span className="login-title-text">Heureum</span>
          </h1>
          <p className="login-subtitle">
            {step === 'email' && 'Sign in to your account'}
            {step === 'code' && 'Check your email'}
            {step === 'signup' && 'Create your account'}
          </p>
        </div>

        {error && <div className="login-error">{error}</div>}

        {step === 'email' && (
          <>
            <form onSubmit={handleEmailSubmit} className="login-form">
              <label className="login-label" htmlFor="email">
                Email address
              </label>
              <input
                id="email"
                type="email"
                className="login-input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
                required
              />
              <button type="submit" className="login-button" disabled={isSubmitting}>
                {isSubmitting ? 'Sending...' : 'Continue'}
              </button>
            </form>

            <div className="login-divider">
              <span>or continue with</span>
            </div>

            <div className="social-buttons">
              <button
                type="button"
                className="social-button social-google"
                onClick={() => handleSocialLogin('google')}
              >
                <svg viewBox="0 0 24 24" width="20" height="20">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                Google
              </button>
              <button
                type="button"
                className="social-button social-microsoft"
                onClick={() => handleSocialLogin('microsoft')}
              >
                <svg viewBox="0 0 24 24" width="20" height="20">
                  <path d="M1 1h10v10H1z" fill="#F25022" />
                  <path d="M13 1h10v10H13z" fill="#7FBA00" />
                  <path d="M1 13h10v10H1z" fill="#00A4EF" />
                  <path d="M13 13h10v10H13z" fill="#FFB900" />
                </svg>
                Microsoft
              </button>
            </div>
          </>
        )}

        {step === 'code' && (
          <div className="login-form">
            <p className="login-info">
              We sent a sign-in link to <strong>{email}</strong>.
              <br />
              Click the link in the email to sign in.
            </p>

            {showCodeInput ? (
              <form onSubmit={handleCodeSubmit} className="login-form">
                <label className="login-label" htmlFor="code">
                  Verification code
                </label>
                <input
                  id="code"
                  type="text"
                  className="login-input login-input-code"
                  placeholder="Enter code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  autoFocus
                  autoComplete="one-time-code"
                  required
                />
                <button type="submit" className="login-button" disabled={isSubmitting}>
                  {isSubmitting ? 'Verifying...' : 'Verify'}
                </button>
              </form>
            ) : (
              <button
                type="button"
                className="login-link"
                onClick={() => setShowCodeInput(true)}
              >
                Enter code manually
              </button>
            )}

            <button
              type="button"
              className="login-link"
              onClick={handleResendCode}
              disabled={resendCooldown > 0 || isSubmitting}
            >
              {resendCooldown > 0
                ? `Resend email (${resendCooldown}s)`
                : 'Resend email'}
            </button>

            <button
              type="button"
              className="login-link"
              onClick={() => {
                setCode('');
                setError('');
                setShowCodeInput(false);
                setStep('email');
              }}
            >
              Use a different email
            </button>
          </div>
        )}

        {step === 'signup' && (
          <form onSubmit={handleSignupSubmit} className="login-form">
            <p className="login-info">
              No account found for <strong>{email}</strong>.
              <br />
              Enter your name to create one.
            </p>
            <label className="login-label" htmlFor="firstName">
              First name
            </label>
            <input
              id="firstName"
              type="text"
              className="login-input"
              placeholder="First name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              autoFocus
              required
            />
            <label className="login-label" htmlFor="lastName">
              Last name
            </label>
            <input
              id="lastName"
              type="text"
              className="login-input"
              placeholder="Last name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
            />
            <button type="submit" className="login-button" disabled={isSubmitting}>
              {isSubmitting ? 'Creating account...' : 'Create account'}
            </button>
            <button
              type="button"
              className="login-link"
              onClick={() => {
                setStep('email');
                setError('');
              }}
            >
              Use a different email
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
