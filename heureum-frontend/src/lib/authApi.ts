// Copyright (c) 2026 Heureum AI. All rights reserved.

import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001';

const authClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

// CSRF token handling
function getCsrfToken(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

authClient.interceptors.request.use((config) => {
  if (config.method && !['get', 'head', 'options'].includes(config.method)) {
    const token = getCsrfToken();
    if (token) {
      config.headers['X-CSRFToken'] = token;
    }
  }
  return config;
});

export interface UserInfo {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
}

export interface AllAuthSession {
  status: number;
  data?: {
    user?: {
      id: number;
      email: string;
      display?: string;
      has_usable_password?: boolean;
    };
    flows?: Array<{
      id: string;
      [key: string]: unknown;
    }>;
  };
  meta?: {
    is_authenticated: boolean;
  };
}

function detectClient(): 'web' | 'electron' | 'mobile' {
  if (navigator.userAgent.includes('Electron')) return 'electron';
  if (/Expo|ReactNative/.test(navigator.userAgent)) return 'mobile';
  return 'web';
}

// Unified code request — always sends a code regardless of account existence
export async function requestCode(email: string): Promise<{ status: string }> {
  const response = await authClient.post<{ status: string }>(
    '/api/v1/auth/code/request/',
    { email, client: detectClient() },
  );
  return response.data;
}

// Unified code confirm — returns { status: "authenticated", user } or { status: "signup_required" }
export async function confirmCode(code: string): Promise<{
  status: string;
  user?: UserInfo;
}> {
  const response = await authClient.post<{ status: string; user?: UserInfo }>(
    '/api/v1/auth/code/confirm/',
    { code },
  );
  return response.data;
}

// Complete signup after email is verified — takes name, returns user
export async function completeSignup(data: {
  first_name: string;
  last_name: string;
}): Promise<UserInfo> {
  const response = await authClient.post<UserInfo>(
    '/api/v1/auth/signup/complete/',
    data,
  );
  return response.data;
}

export async function getSession(): Promise<AllAuthSession> {
  const response = await authClient.get<AllAuthSession>(
    '/_allauth/browser/v1/auth/session',
  );
  return response.data;
}

export async function logout(): Promise<void> {
  await authClient.delete('/_allauth/browser/v1/auth/session');
}

export async function getUserInfo(): Promise<UserInfo> {
  const response = await authClient.get<UserInfo>('/api/v1/auth/me/');
  return response.data;
}

export function buildSocialLoginForm(provider: string, callbackUrl: string): HTMLFormElement {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = `${API_BASE_URL}/_allauth/browser/v1/auth/provider/redirect`;

  const csrfToken = getCsrfToken();

  const fields = {
    provider,
    callback_url: callbackUrl,
    process: 'login',
    ...(csrfToken ? { csrfmiddlewaretoken: csrfToken } : {}),
  };

  for (const [key, value] of Object.entries(fields)) {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = key;
    input.value = value;
    form.appendChild(input);
  }

  return form;
}

export function initiateSocialLogin(provider: string, callbackUrl: string): void {
  const form = buildSocialLoginForm(provider, callbackUrl);
  document.body.appendChild(form);
  form.submit();
}
