// Copyright (c) 2026 Heureum AI. All rights reserved.

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  requestPermissionAndGetToken,
  getNotificationStatus,
} from '../lib/pushNotifications';
import { notificationAPI, type NotificationPreferences } from '../lib/api';
import HeureumIcon from '../components/HeureumIcon';
import ThemeToggle from '../components/ThemeToggle';
import './SettingsPage.css';

function isElectron(): boolean {
  return !!window.api?.canExecuteTools;
}

function ToggleSwitch({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={`settings-toggle ${checked ? 'settings-toggle-on' : ''} ${disabled ? 'settings-toggle-disabled' : ''}`}
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
    >
      <span className="settings-toggle-knob" />
    </button>
  );
}

function NotificationPreferencesSection() {
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [deviceTypes, setDeviceTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [electronInfo, setElectronInfo] = useState<{ supported: boolean; platform: string } | null>(null);
  const [testLoading, setTestLoading] = useState(false);

  useEffect(() => {
    notificationAPI.getPreferences()
      .then(({ preferences, registered_device_types }) => {
        setPrefs(preferences);
        setDeviceTypes(registered_device_types);
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    if (isElectron()) {
      window.api?.getNotificationInfo?.().then(setElectronInfo).catch(() => {});
    }
  }, []);

  const handleToggle = useCallback(async (field: keyof NotificationPreferences, value: boolean) => {
    if (!prefs) return;
    setSaving(true);
    setMessage(null);
    try {
      // When enabling web push, ensure browser permission is granted
      if (field === 'web_enabled' && value) {
        const status = getNotificationStatus();
        if (status.permission === 'denied') {
          setMessage({ type: 'error', text: 'Browser notifications are blocked. Click the lock icon in your address bar to allow them.' });
          setSaving(false);
          return;
        }
        if (status.permission === 'default') {
          const token = await requestPermissionAndGetToken();
          if (!token) {
            setMessage({ type: 'error', text: 'Browser notification permission was not granted.' });
            setSaving(false);
            return;
          }
          await notificationAPI.registerDevice(token, 'web').catch(() => {});
        }
      }
      const updated = await notificationAPI.updatePreferences({ [field]: value });
      setPrefs(updated);
    } catch {
      setMessage({ type: 'error', text: 'Failed to update preference.' });
    } finally {
      setSaving(false);
    }
  }, [prefs]);

  const handleTestDesktop = useCallback(async () => {
    setTestLoading(true);
    setMessage(null);
    try {
      const result = await window.api!.sendTestNotification();
      if (result.success) {
        setMessage({ type: 'success', text: 'Test notification sent.' });
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to send test notification.' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to send test notification.' });
    } finally {
      setTestLoading(false);
    }
  }, []);

  if (loading || !prefs) {
    return (
      <div className="settings-section">
        <h3 className="settings-section-title">Notifications</h3>
        <p className="settings-info">Loading preferences...</p>
      </div>
    );
  }

  const hasMobileDevice = deviceTypes.some(t => t === 'ios' || t === 'android');
  const webStatus = !isElectron() ? getNotificationStatus() : null;

  return (
    <div className="settings-section">
      <h3 className="settings-section-title">Notifications</h3>

      <div className="settings-status-row">
        <span className="settings-status-label">Notifications</span>
        <ToggleSwitch checked={prefs.enabled} onChange={(v) => handleToggle('enabled', v)} disabled={saving} />
      </div>

      {message && (
        <div className={`settings-message settings-message-${message.type}`}>
          {message.text}
        </div>
      )}

      {prefs.enabled && (
        <div className="settings-channels">
          <div className="settings-channels-label">Delivery Channels</div>

          <div className="settings-channel-row">
            <div className="settings-channel-info">
              <span className="settings-channel-name">Mobile</span>
              <span className="settings-channel-desc">
                {hasMobileDevice ? 'Phone/tablet push (always reachable)' : 'No mobile device registered'}
              </span>
            </div>
            <ToggleSwitch checked={prefs.mobile_enabled} onChange={(v) => handleToggle('mobile_enabled', v)} disabled={saving || !hasMobileDevice} />
          </div>

          <div className="settings-channel-row">
            <div className="settings-channel-info">
              <span className="settings-channel-name">Desktop</span>
              <span className="settings-channel-desc">Desktop notifications (when computer is on)</span>
            </div>
            <ToggleSwitch checked={prefs.electron_enabled} onChange={(v) => handleToggle('electron_enabled', v)} disabled={saving} />
          </div>

          {isElectron() && prefs.electron_enabled && electronInfo && (
            <div className="settings-channel-actions">
              <button
                className="settings-button-inline"
                onClick={handleTestDesktop}
                disabled={testLoading || !electronInfo.supported}
              >
                {testLoading ? 'Sending...' : 'Send Test Notification'}
              </button>
              {(electronInfo.platform === 'darwin' || electronInfo.platform === 'win32') && (
                <button
                  className="settings-button-inline"
                  onClick={() => window.api?.openNotificationSettings()}
                >
                  OS Notification Settings
                </button>
              )}
            </div>
          )}

          <div className="settings-channel-row">
            <div className="settings-channel-info">
              <span className="settings-channel-name">Web Browser</span>
              <span className="settings-channel-desc">
                {webStatus?.permission === 'denied'
                  ? 'Blocked by browser — check address bar settings'
                  : 'Browser push notifications'}
              </span>
            </div>
            <ToggleSwitch
              checked={prefs.web_enabled}
              onChange={(v) => handleToggle('web_enabled', v)}
              disabled={saving || webStatus?.permission === 'denied'}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const navigate = useNavigate();

  return (
    <div className="settings-page">
      <button className="settings-back" onClick={() => navigate('/chat')} title="Back to chat">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div className="settings-theme-toggle"><ThemeToggle /></div>

      <div className="settings-card">
        <div className="settings-header">
          <div className="settings-title">
            <HeureumIcon size={28} />
            <span className="settings-title-text">Settings</span>
          </div>
        </div>

        <NotificationPreferencesSection />
      </div>
    </div>
  );
}
