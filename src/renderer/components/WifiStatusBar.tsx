import React, { useState, useEffect, useCallback } from 'react';
import { WifiStatusResult } from '../../shared/types';

export function WifiStatusBar() {
  const [wifiStatus, setWifiStatus] = useState<WifiStatusResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const fetchStatus = useCallback(async (bypassCache = false) => {
    if (!window.cloudflareRdp?.wifi) return;
    setLoading(true);
    try {
      const res = await window.cloudflareRdp.wifi.getStatus(bypassCache);
      setWifiStatus(res);
      setLastChecked(new Date());
    } catch (err) {
      console.error('Failed to fetch Wi-Fi status:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus(false);
    // Periodically re-check Wi-Fi status every 30 seconds
    const interval = setInterval(() => fetchStatus(false), 30000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  if (!wifiStatus && !loading) return null;

  const isOk = wifiStatus?.status === 'ok' && wifiStatus.allowed;
  const isUnauthorized = wifiStatus?.status === 'ok' && !wifiStatus.allowed;
  const isPermDenied = wifiStatus?.status === 'permission-denied';
  const isUnavailable = wifiStatus?.status === 'unavailable';

  let badgeColor = 'var(--text-muted)';
  let badgeBg = 'var(--bg-tertiary)';
  let borderColor = 'var(--border-color)';
  let statusText = 'Checking Wi-Fi...';
  let subText = '';

  if (loading && !wifiStatus) {
    statusText = 'Checking Wi-Fi...';
  } else if (isOk) {
    badgeColor = 'var(--accent-green)';
    badgeBg = 'rgba(34, 197, 94, 0.12)';
    borderColor = 'rgba(34, 197, 94, 0.3)';
    statusText = wifiStatus.ssid || 'Authorized Network';
    subText = wifiStatus.matchedNetwork ? `(${wifiStatus.matchedNetwork})` : '(Authorized)';
  } else if (isUnauthorized) {
    badgeColor = 'var(--accent-red)';
    badgeBg = 'rgba(239, 68, 68, 0.12)';
    borderColor = 'rgba(239, 68, 68, 0.3)';
    statusText = wifiStatus?.ssid || 'Unknown Network';
    subText = '(Not Authorized)';
  } else if (isPermDenied) {
    badgeColor = 'var(--accent-amber)';
    badgeBg = 'rgba(245, 158, 11, 0.12)';
    borderColor = 'rgba(245, 158, 11, 0.3)';
    statusText = 'Permission Required';
    subText = '(macOS Location)';
  } else if (isUnavailable) {
    badgeColor = 'var(--text-muted)';
    badgeBg = 'var(--bg-tertiary)';
    borderColor = 'var(--border-color)';
    statusText = 'No Wi-Fi Detected';
  }

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '4px 10px',
        borderRadius: 'var(--radius-sm)',
        background: badgeBg,
        border: `1px solid ${borderColor}`,
        fontSize: 12,
        color: 'var(--text-primary)',
        transition: 'all 0.2s ease',
      }}
      title={
        wifiStatus?.error
          ? `Wi-Fi Verification: ${wifiStatus.error}`
          : isOk
          ? `Connected to authorized Wi-Fi: ${wifiStatus?.ssid}`
          : 'Click refresh to re-verify Wi-Fi status'
      }
    >
      {/* Wi-Fi Icon */}
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke={badgeColor}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ flexShrink: 0 }}
      >
        <path d="M5 12.55a11 11 0 0 1 14.08 0" />
        <path d="M1.42 9a16 16 0 0 1 21.16 0" />
        <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
        <line x1="12" y1="20" x2="12.01" y2="20" />
      </svg>

      <div style={{ display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}>
        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{statusText}</span>
        {subText && (
          <span style={{ color: badgeColor, fontWeight: 500, fontSize: 11 }}>
            {subText}
          </span>
        )}
      </div>

      {/* Refresh Button */}
      <button
        onClick={() => fetchStatus(true)}
        disabled={loading}
        title={`Re-check Wi-Fi status${lastChecked ? ` (Last checked: ${lastChecked.toLocaleTimeString()})` : ''}`}
        aria-label="Refresh Wi-Fi Status"
        style={{
          border: 'none',
          background: 'transparent',
          color: 'var(--text-muted)',
          cursor: loading ? 'not-allowed' : 'pointer',
          padding: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 'var(--radius-xs)',
          opacity: loading ? 0.6 : 0.8,
          transition: 'opacity 0.15s, transform 0.2s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
        onMouseLeave={(e) => { e.currentTarget.style.opacity = loading ? '0.6' : '0.8'; }}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            animation: loading ? 'spin 1s linear infinite' : 'none',
          }}
        >
          <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
        </svg>
      </button>
    </div>
  );
}
