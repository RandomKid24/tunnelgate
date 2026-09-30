import React, { useState, useEffect } from 'react';
import { TunnelConfig } from '../../shared/types';
import { shortServerName } from '../lib/format';

interface Props {
  tunnel?: TunnelConfig;
  onSubmit: (data: { name: string; hostname: string; port: number; username: string; password: string; rememberAfterSession: boolean }) => void;
  onCancel: () => void;
}

export function TunnelForm({ tunnel, onSubmit, onCancel }: Props) {
  const [name, setName] = useState(tunnel?.name ?? '');
  const [hostname, setHostname] = useState(tunnel?.hostname ?? '');
  const [port, setPort] = useState(tunnel?.port ?? 3389);
  const [username, setUsername] = useState(tunnel?.username ?? '');
  const [password, setPassword] = useState('');
  const [initialPassword, setInitialPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(tunnel?.rememberAfterSession ?? true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (tunnel && tunnel.encryptedPassword) {
      window.cloudflareRdp.tunnels.decryptPassword(tunnel.encryptedPassword)
        .then((decrypted) => {
          setPassword(decrypted);
          setInitialPassword(decrypted);
        })
        .catch(() => {});
    }
  }, [tunnel]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) { setError('Display name is required'); return; }
    if (!hostname.trim()) { setError('Hostname is required'); return; }
    const portNum = Number(port);
    if (!Number.isInteger(portNum) || portNum < 1 || portNum > 65535) { setError('Port must be a number between 1 and 65535'); return; }
    if (!username.trim()) { setError('Username is required'); return; }
    if (!tunnel && !password.trim()) { setError('Password is required'); return; }

    const hostnameRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
    if (!hostnameRegex.test(hostname.trim())) {
      setError('Invalid hostname format (e.g., tunnel.example.com)');
      return;
    }

    onSubmit({
      name: name.trim(),
      hostname: hostname.trim(),
      port: portNum,
      username: username.trim().replace(/\//g, '\\'),
      password,
      rememberAfterSession: remember,
    });
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>
        {tunnel ? 'Edit Tunnel' : 'Add Tunnel'}
      </h2>

      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <Field label="Display Name" tooltip="A name just for you to recognize this server in the list — can be anything, e.g. the person or department it belongs to.">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Work PC"
              style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }}
            />
          </Field>
        </div>
        <div style={{ width: 100, flexShrink: 0 }}>
          <Field label="Port" tooltip="Leave this at 3389 unless you were told otherwise — it's the standard Remote Desktop port and works for almost everyone.">
            <input
              type="number"
              value={port}
              onChange={(e) => setPort(parseInt(e.target.value) || 3389)}
              placeholder="3389"
              min={1}
              max={65535}
              style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }}
            />
          </Field>
        </div>
      </div>

      <Field label="Cloudflare Tunnel Hostname" tooltip="The public address for this server's Cloudflare Tunnel — find it in the Cloudflare Zero Trust dashboard under Networks &gt; Tunnels. Not the server's real IP address.">
        <input
          type="text"
          value={hostname}
          onChange={(e) => setHostname(e.target.value)}
          placeholder="rdp-tunnel.example.com"
          style={{ ...inputStyle, fontFamily: 'monospace' }}
        />
        {tunnel && (
          <div
            title={tunnel.serverName || undefined}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              marginTop: 4,
              fontSize: 11,
              fontFamily: 'monospace',
              color: tunnel.serverName ? 'var(--accent-green)' : 'var(--text-muted)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: tunnel.serverName ? 'var(--accent-green)' : 'var(--text-muted)', flexShrink: 0 }} />
            {tunnel.serverName ? `Detected: ${shortServerName(tunnel.serverName)}` : 'Server name not detected yet'}
          </div>
        )}
      </Field>

      <Field label="Windows Username" tooltip="The Windows login for the remote computer, not your HRMS login. Use DOMAIN\\username or username@domain.com if the PC is on a company domain. If it's a local (non-domain) account and login fails, try .\\username to force local-account authentication.">
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="CORP\\user or user@domain.com"
          style={inputStyle}
        />
      </Field>

      <Field
        label={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <span>Password</span>
            {tunnel && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 11,
                  fontWeight: 600,
                  color: password !== initialPassword ? 'var(--accent-amber)' : 'var(--accent-green)',
                  background: password !== initialPassword ? 'rgba(245,158,11,0.1)' : 'rgba(34,197,94,0.1)',
                  padding: '2px 6px',
                  borderRadius: 'var(--radius-xs)',
                }}
              >
                {password !== initialPassword ? (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                  </svg>
                ) : (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
                {password !== initialPassword ? 'Updating password' : 'Saved password'}
              </span>
            )}
          </div>
        }
      >
        <div style={{ position: 'relative', width: '100%' }}>
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
            style={{ ...inputStyle, paddingRight: 36, width: '100%', boxSizing: 'border-box' }}
          />
          <button
            type="button"
            onClick={() => setShowPassword((p) => !p)}
            tabIndex={-1}
            style={{
              position: 'absolute',
              right: 4,
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              fontSize: 16,
              lineHeight: 1,
              color: 'var(--text-muted)',
            }}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? HideIcon : ShowIcon}
          </button>
        </div>
      </Field>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={remember}
          onChange={(e) => setRemember(e.target.checked)}
          style={{ accentColor: 'var(--accent-blue)' }}
        />
        Remember password after session
      </label>

      {error && (
        <div style={{ fontSize: 12, color: 'var(--accent-red)', padding: '4px 8px', background: 'rgba(239,68,68,0.1)', borderRadius: 4 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" onClick={onCancel} style={secondaryBtnStyle}>Cancel</button>
        <button type="submit" style={primaryBtnStyle}>{tunnel ? 'Save Changes' : 'Add Tunnel'}</button>
      </div>
    </form>
  );
}

const ShowIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);

const HideIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
    <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/>
  </svg>
);

function Field({ label, children, tooltip }: { label: React.ReactNode; children: React.ReactNode; tooltip?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {tooltip ? (
          <span
            title={tooltip}
            style={{
              display: 'inline-block',
              width: 'fit-content',
              cursor: 'help',
              borderBottom: '1px dashed var(--text-muted)',
            }}
          >
            {label}
          </span>
        ) : (
          label
        )}
      </label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '8px 12px',
  fontSize: 14,
  background: 'var(--bg-secondary)',
  border: '1px solid var(--border-color)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text-primary)',
  outline: 'none',
  transition: 'border-color 0.15s',
};

const primaryBtnStyle: React.CSSProperties = {
  padding: '10px 20px',
  fontSize: 13,
  fontWeight: 600,
  border: 'none',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--accent-blue)',
  color: '#fff',
  cursor: 'pointer',
};

const secondaryBtnStyle: React.CSSProperties = {
  padding: '10px 20px',
  fontSize: 13,
  fontWeight: 500,
  border: '1px solid var(--border-color)',
  borderRadius: 'var(--radius-sm)',
  background: 'transparent',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
};
