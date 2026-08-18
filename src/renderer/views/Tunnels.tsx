import React, { useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom';
import { TunnelCard } from '../components/TunnelCard';
import { TunnelForm } from '../components/TunnelForm';
import { TunnelWithState } from '../hooks/useTunnels';

const ACTIVE_STATUSES = new Set(['connected', 'connecting', 'reconnecting']);

interface Props {
  tunnels: TunnelWithState[];
  loading: boolean;
  errors: Record<string, string>;
  onAdd: (data: { name: string; hostname: string; port: number; username: string; password: string; rememberAfterSession: boolean }) => void;
  onUpdate: (tunnel: any) => void;
  onDelete: (id: string) => void;
  onConnect: (id: string) => void;
  onDisconnect: (id: string) => void;
  onViewScreen: (tunnel: TunnelWithState) => void;
  onViewLogs: (tunnelId: string) => void;
}

function TunnelModal({
  tunnel,
  onSubmit,
  onCancel,
}: {
  tunnel: TunnelWithState | null;
  onSubmit: (data: { name: string; hostname: string; port: number; username: string; password: string; rememberAfterSession: boolean }) => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return ReactDOM.createPortal(
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'var(--overlay-bg)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        animation: 'fade-in 0.15s ease-out',
      }}
      onClick={onCancel}
    >
      <div
        style={{
          position: 'relative',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-lg)',
          padding: 20,
          width: '90%',
          maxWidth: 500,
          maxHeight: '92vh',
          overflowY: 'auto',
          boxShadow: 'var(--shadow-modal)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onCancel}
          aria-label="Close"
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            width: 28,
            height: 28,
            border: 'none',
            background: 'transparent',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 'var(--radius-xs)',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        <TunnelForm tunnel={tunnel ?? undefined} onSubmit={onSubmit} onCancel={onCancel} />
      </div>
    </div>,
    document.body,
  );
}

function ChecklistItem({ text }: { text: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: 'var(--text-muted)',
          flexShrink: 0,
          marginTop: 6,
        }}
      />
      <span style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{text}</span>
    </div>
  );
}

export function Tunnels({ tunnels, loading, errors, onAdd, onUpdate, onDelete, onConnect, onDisconnect, onViewScreen, onViewLogs }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [editingTunnel, setEditingTunnel] = useState<TunnelWithState | null>(null);
  const [search, setSearch] = useState('');

  const connectedCount = useMemo(
    () => tunnels.filter((t) => t.runtime.status === 'connected').length,
    [tunnels],
  );

  const visibleTunnels = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = query
      ? tunnels.filter((t) => t.name.toLowerCase().includes(query) || t.hostname.toLowerCase().includes(query))
      : tunnels;

    // Active tunnels surface first so they're not buried in a long list.
    return [...filtered].sort((a, b) => {
      const aActive = ACTIVE_STATUSES.has(a.runtime.status) ? 0 : 1;
      const bActive = ACTIVE_STATUSES.has(b.runtime.status) ? 0 : 1;
      return aActive - bActive;
    });
  }, [tunnels, search]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
        Loading...
      </div>
    );
  }

  if (tunnels.length === 0 && !showForm) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 24, padding: 24 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Add your first server</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 380, lineHeight: 1.5 }}>
            You'll need three things from your office IT or Cloudflare Zero Trust dashboard first.
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 360 }}>
          <ChecklistItem text="The server's Cloudflare Tunnel hostname (not its IP address)" />
          <ChecklistItem text="Its Windows username, e.g. CORP\yourname" />
          <ChecklistItem text="Its Windows password" />
        </div>

        <button
          onClick={() => setShowForm(true)}
          style={{
            padding: '10px 24px',
            fontSize: 14,
            fontWeight: 600,
            border: 'none',
            borderRadius: 'var(--radius-md)',
            background: 'var(--accent-blue)',
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          Add Your First Tunnel
        </button>
      </div>
    );
  }

  const handleFormSubmit = (data: { name: string; hostname: string; port: number; username: string; password: string; rememberAfterSession: boolean }) => {
    if (editingTunnel) {
      onUpdate({ ...editingTunnel, ...data });
    } else {
      onAdd(data);
    }
    setShowForm(false);
    setEditingTunnel(null);
  };

  const handleEdit = (tunnel: TunnelWithState) => {
    setEditingTunnel(tunnel);
    setShowForm(true);
  };

  return (
    <div style={{ padding: 24, height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Tunnels</h1>
          {connectedCount > 0 && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--accent-green)',
                background: 'rgba(34,197,94,0.1)',
                padding: '3px 8px',
                borderRadius: 'var(--radius-full)',
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-green)' }} />
              {connectedCount} connected
            </span>
          )}
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            style={{
              padding: '10px 18px',
              fontSize: 13,
              fontWeight: 600,
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--accent-blue)',
              color: '#fff',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            + Add Tunnel
          </button>
        )}
      </div>

      {tunnels.length > 4 && !showForm && (
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or hostname..."
          className="tg-input"
          style={{
            width: '100%',
            marginBottom: 16,
            padding: '8px 12px',
            fontSize: 13,
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text-primary)',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      )}

      {visibleTunnels.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: 13 }}>
          No tunnels match "{search}"
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {visibleTunnels.map((tunnel) => (
          <React.Fragment key={tunnel.id}>
            <TunnelCard
              tunnel={tunnel}
              onConnect={onConnect}
              onDisconnect={onDisconnect}
              onEdit={handleEdit}
              onDelete={onDelete}
              onViewScreen={() => onViewScreen(tunnel)}
              onViewLogs={() => onViewLogs(tunnel.id)}
              connectError={errors[tunnel.id]}
            />
          </React.Fragment>
        ))}
      </div>

      {showForm && (
        <TunnelModal
          tunnel={editingTunnel}
          onSubmit={handleFormSubmit}
          onCancel={() => { setShowForm(false); setEditingTunnel(null); }}
        />
      )}
    </div>
  );
}
