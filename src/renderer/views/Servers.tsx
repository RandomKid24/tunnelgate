import React, { useCallback, useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { HrmsServer } from '../../shared/types';
import { formatIpcError } from '../lib/format';
import { WifiStatusBar } from '../components/WifiStatusBar';

interface Props {
  onConnect: (server: HrmsServer, username: string, password: string) => Promise<void>;
  onAuthExpired: () => void;
}

function CredentialsModal({
  server,
  onSubmit,
  onCancel,
}: {
  server: HrmsServer;
  onSubmit: (username: string, password: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit(username, password);
    } catch (err: any) {
      setError(formatIpcError(err));
      setSubmitting(false);
    }
  };

  return ReactDOM.createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--overlay-bg)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
      }}
      onClick={onCancel}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 360,
          padding: 24,
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-modal)',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Connect to {server.name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2, fontFamily: 'monospace' }}>
            {server.address}
          </div>
        </div>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
          Windows username
          <input
            type="text"
            className="tg-input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoFocus
            disabled={submitting}
            autoComplete="off"
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
          Windows password
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              type={showPassword ? 'text' : 'password'}
              className="tg-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={submitting}
              autoComplete="off"
              style={{ flex: 1 }}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              style={{
                padding: '0 10px',
                fontSize: 12,
                borderRadius: 'var(--radius-xs)',
                border: '1px solid var(--border-color)',
                background: 'transparent',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
        </label>

        {error && <div style={{ fontSize: 12, color: 'var(--accent-red, #ef4444)' }}>{error}</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            style={{
              padding: '8px 14px',
              fontSize: 13,
              borderRadius: 'var(--radius-xs)',
              border: '1px solid var(--border-color)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            style={{
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 600,
              borderRadius: 'var(--radius-xs)',
              border: 'none',
              background: 'var(--accent-blue)',
              color: '#fff',
              cursor: submitting ? 'default' : 'pointer',
              opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting ? 'Connecting…' : 'Connect'}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}

export function Servers({ onConnect, onAuthExpired }: Props) {
  const [servers, setServers] = useState<HrmsServer[]>([]);
  const [unrestricted, setUnrestricted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<HrmsServer | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.cloudflareRdp.servers.list();
      setServers(result.servers);
      setUnrestricted(result.unrestricted);
    } catch (err: any) {
      const message = formatIpcError(err);
      setError(message);
      if (/log in again|not logged in/i.test(message)) onAuthExpired();
    } finally {
      setLoading(false);
    }
  }, [onAuthExpired]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Servers</h1>
        <WifiStatusBar />
        <button
          onClick={load}
          disabled={loading}
          style={{
            padding: '6px 12px',
            fontSize: 12,
            borderRadius: 'var(--radius-xs)',
            border: '1px solid var(--border-color)',
            background: 'transparent',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
          }}
        >
          Refresh
        </button>
      </div>

      {unrestricted && servers.length > 0 && (
        <div style={{ marginBottom: 16, fontSize: 12, color: 'var(--text-secondary)' }}>
          Unrestricted access: showing every active server.
        </div>
      )}

      {error && (
        <div style={{ padding: 12, marginBottom: 16, fontSize: 13, borderRadius: 'var(--radius-xs)', border: '1px solid rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.1)' }}>
          {error}
        </div>
      )}

      {loading && servers.length === 0 && (
        <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Loading servers…</div>
      )}

      {!loading && !error && servers.length === 0 && (
        <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
          No servers are assigned to your account. Ask an administrator to grant you access in HRMS.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
        {servers.map((server) => (
          <div
            key={server.id}
            style={{
              padding: 16,
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-resting)',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 600 }}>{server.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{server.address}</div>
            {server.description && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{server.description}</div>
            )}
            <button
              onClick={() => setSelected(server)}
              style={{
                marginTop: 8,
                padding: '8px 12px',
                fontSize: 13,
                fontWeight: 600,
                borderRadius: 'var(--radius-xs)',
                border: 'none',
                background: 'var(--accent-blue)',
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              Connect
            </button>
          </div>
        ))}
      </div>

      {selected && (
        <CredentialsModal
          server={selected}
          onCancel={() => setSelected(null)}
          onSubmit={async (username, password) => {
            await onConnect(selected, username, password);
            setSelected(null);
          }}
        />
      )}
    </div>
  );
}
