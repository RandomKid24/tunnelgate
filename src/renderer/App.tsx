import React, { useState } from 'react';
import { Tunnels } from './views/Tunnels';
import { Logs } from './views/Logs';
import { Settings } from './views/Settings';
import { RdpView } from './views/RdpView';
import { Login } from './views/Login';
import { UserMenu } from './components/UserMenu';
import { useTunnels, TunnelWithState } from './hooks/useTunnels';
import { useUpdateCheck } from './hooks/useUpdateCheck';
import { useAuth } from './hooks/useAuth';

type Tab = 'tunnels' | 'logs' | 'settings';

function TunnelsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}

function LogsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  );
}

function App() {
  const [tab, setTab] = useState<Tab>('tunnels');
  const [viewingTunnel, setViewingTunnel] = useState<TunnelWithState | null>(null);
  const [selectedLogTunnelId, setSelectedLogTunnelId] = useState<string | undefined>(undefined);
  const [updateDismissed, setUpdateDismissed] = useState<boolean>(
    () => sessionStorage.getItem('update-banner-dismissed') === '1',
  );
  const { session, loading: authLoading, login, logout } = useAuth();
  const { tunnels, loading, errors, add, update, remove, connect, disconnect, reload } = useTunnels(logout);
  const updateInfo = useUpdateCheck();

  const navItems: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'tunnels', label: 'Tunnels', icon: <TunnelsIcon /> },
    { id: 'logs', label: 'Logs', icon: <LogsIcon /> },
    { id: 'settings', label: 'Settings', icon: <SettingsIcon /> },
  ];

  if (authLoading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
        Loading…
      </div>
    );
  }

  if (!session) {
    return <Login onLogin={login} />;
  }

  if (viewingTunnel) {
    return (
      <div style={{ height: '100vh', background: '#000' }}>
        <RdpView tunnel={viewingTunnel} onBack={() => setViewingTunnel(null)} onServerName={reload} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {updateInfo && !updateDismissed && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '8px 16px',
            background: 'rgba(245,158,11,0.12)',
            borderBottom: '1px solid rgba(245,158,11,0.4)',
            fontSize: 13,
            flexShrink: 0,
          }}
        >
          <span>
            A new version (<strong>{updateInfo.latestVersion}</strong>) is available. You're running{' '}
            {updateInfo.currentVersion}.
          </span>
          <button
            onClick={() => window.cloudflareRdp.app.openExternal(updateInfo.url)}
            style={{
              padding: '4px 12px',
              fontSize: 12,
              fontWeight: 600,
              borderRadius: 'var(--radius-xs)',
              border: 'none',
              background: 'var(--accent-blue)',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            View Download
          </button>
          <button
            onClick={() => {
              sessionStorage.setItem('update-banner-dismissed', '1');
              setUpdateDismissed(true);
            }}
            style={{
              padding: '4px 10px',
              fontSize: 12,
              borderRadius: 'var(--radius-xs)',
              border: '1px solid var(--border-color)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            Dismiss
          </button>
        </div>
      )}

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <nav style={{
          width: 200,
          background: 'var(--bg-secondary)',
          borderRight: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          padding: '16px 0',
          flexShrink: 0,
        }}>
          <div style={{ padding: '0 16px 20px' }}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>TunnelGate</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>One-click RDP tunnels</div>
          </div>

          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 16px',
                fontSize: 14,
                fontWeight: tab === item.id ? 600 : 400,
                border: 'none',
                borderRight: tab === item.id ? '2px solid var(--accent-blue)' : '2px solid transparent',
                background: tab === item.id ? 'var(--bg-tertiary)' : 'transparent',
                color: tab === item.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s',
              }}
            >
              {item.icon}
              {item.label}
            </button>
          ))}

          <UserMenu session={session} onLogout={logout} />
        </nav>

        <main style={{ flex: 1, overflow: 'hidden' }}>
          {tab === 'tunnels' && (
            <Tunnels
              tunnels={tunnels}
              loading={loading}
              errors={errors}
              onAdd={add}
              onUpdate={update}
              onDelete={remove}
              onConnect={connect}
              onDisconnect={disconnect}
              onViewScreen={setViewingTunnel}
              onViewLogs={(tunnelId) => {
                setSelectedLogTunnelId(tunnelId);
                setTab('logs');
              }}
            />
          )}
          {tab === 'logs' && (
            <Logs
              tunnels={tunnels}
              initialTunnelId={selectedLogTunnelId}
              onClearFilter={() => setSelectedLogTunnelId(undefined)}
            />
          )}
          {tab === 'settings' && <Settings session={session} onLogout={logout} />}
        </main>
      </div>
    </div>
  );
}

export default App;
