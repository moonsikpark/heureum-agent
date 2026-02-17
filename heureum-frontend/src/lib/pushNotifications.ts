// Copyright (c) 2026 Heureum AI. All rights reserved.

import { isMobileApp } from './api';

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8001').replace(/\/+$/, '');

let vapidPublicKey: string | null = null;

function isWebBrowser(): boolean {
  if (typeof window === 'undefined') return false;
  if (isMobileApp()) return false;
  if (window.api?.canExecuteTools) return false;
  return true;
}

async function fetchVapidKey(): Promise<string | null> {
  if (vapidPublicKey) return vapidPublicKey;

  try {
    const resp = await fetch(`${API_BASE_URL}/api/v1/notifications/vapid-key/`, {
      credentials: 'include',
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    vapidPublicKey = data.public_key || null;
    return vapidPublicKey;
  } catch {
    return null;
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;

  const registration = await navigator.serviceWorker.register('/push-sw.js');

  // Wait for the SW to be ready (skipWaiting in push-sw.js handles activation)
  await navigator.serviceWorker.ready;

  return registration;
}

/**
 * Request notification permission and subscribe via PushManager.
 * Returns the JSON-serialized PushSubscription or null.
 */
export async function requestPermissionAndGetToken(): Promise<string | null> {
  if (!isWebBrowser()) return null;

  const publicKey = await fetchVapidKey();
  if (!publicKey) {
    console.warn('VAPID public key not available — web push disabled');
    return null;
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return null;

  const registration = await registerServiceWorker();
  if (!registration) return null;

  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey).buffer as ArrayBuffer,
    });
  }

  return JSON.stringify(subscription.toJSON());
}

/**
 * Unsubscribe from push notifications.
 * Returns the token string so the caller can unregister from the backend.
 */
export async function unregisterToken(): Promise<string | null> {
  if (!('serviceWorker' in navigator)) return null;

  const registration = await navigator.serviceWorker.getRegistration('/push-sw.js');
  if (!registration) return null;

  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return null;

  const token = JSON.stringify(subscription.toJSON());
  await subscription.unsubscribe();
  return token;
}

/**
 * Remove legacy Firebase service workers left over from migration.
 */
export async function cleanupLegacyServiceWorkers(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  const registrations = await navigator.serviceWorker.getRegistrations();
  for (const reg of registrations) {
    const sw = reg.active || reg.installing || reg.waiting;
    if (sw && sw.scriptURL.includes('firebase-messaging-sw')) {
      await reg.unregister();
    }
  }
}

/**
 * Listen for messages from the service worker (e.g. notification clicks).
 */
export function setupForegroundListener(): void {
  if (!('serviceWorker' in navigator)) return;

  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'NOTIFICATION_CLICK') {
      const data = event.data.data;
      if (data?.url) {
        window.location.href = data.url;
      }
    }
  });
}

/**
 * Get current notification permission status.
 */
export function getNotificationStatus(): {
  permission: NotificationPermission;
  isSupported: boolean;
} {
  const isSupported =
    isWebBrowser() &&
    typeof Notification !== 'undefined' &&
    'PushManager' in window;
  const permission =
    typeof Notification !== 'undefined' ? Notification.permission : 'default';
  return { permission, isSupported };
}
