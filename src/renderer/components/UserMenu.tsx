import React, { useState } from 'react';
import { HrmsSession } from '../../shared/types';
import { getInitials } from '../lib/format';

interface UserMenuProps {
  session: HrmsSession;
  onLogout: () => Promise<void> | void;
}

export function UserMenu({ session, onLogout }: UserMenuProps) {
  const [hover, setHover] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const displayName = session.employeeName || session.username;
  const initials = getInitials(displayName);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await onLogout();
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <div
      style={{
        marginTop: 'auto',
        padding: '12px 16px',
        borderTop: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: 'var(--radius-xs)',
          background: 'var(--accent-blue)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 12,
          fontWeight: 700,
          color: '#fff',
          flexShrink: 0,
        }}
      >
        {initials}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          title={displayName}
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--text-primary)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {displayName}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'var(--accent-green)',
              flexShrink: 0,
            }}
          />
          Signed in
        </div>
      </div>

      <button
        onClick={handleLogout}
        disabled={loggingOut}
        title="Sign out"
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          width: 28,
          height: 28,
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-color)',
          background: hover ? 'rgba(239,68,68,0.12)' : 'transparent',
          color: hover ? 'var(--accent-red)' : 'var(--text-secondary)',
          cursor: loggingOut ? 'default' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          transition: 'all 0.15s',
          opacity: loggingOut ? 0.6 : 1,
        }}
      >
        {loggingOut ? (
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              border: '2px solid currentColor',
              borderTopColor: 'transparent',
              animation: 'spin 0.6s linear infinite',
            }}
          />
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        )}
      </button>
    </div>
  );
}
