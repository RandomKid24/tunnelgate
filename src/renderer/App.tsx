import React, { useState } from 'react';
import { Servers } from './views/Servers';
import { Tunnels } from './views/Tunnels';
import { Logs } from './views/Logs';
import { Settings } from './views/Settings';
import { RdpView } from './views/RdpView';
import { Login } from './views/Login';
import { WifiStatusBar } from './components/WifiStatusBar';
import { ThemeMenu } from './components/ThemeMenu';
import { ServerEntry, TunnelConfig } from '../shared/types';
import { useTunnels, TunnelWithState } from './hooks/useTunnels';
import { useAppUpdate } from './hooks/useAppUpdate';
import { useAuth } from './hooks/useAuth';
import { AppShell, Topbar, AppContent } from '@/components/ui/app-shell';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarItem,
} from '@/components/ui/sidebar';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Loader } from '@/components/ui/loader';
import { StatusDot } from '@/components/ui/status-dot';
import { UserMenu } from '@/components/ui/user-menu';
import { BrandMark } from './components/BrandMark';
import { FileTextIcon, NetworkIcon, ServerIcon, SettingsIcon } from '@/components/ui/icons';

type Tab = 'servers' | 'tunnels' | 'logs' | 'settings';

const TAB_LABELS: Record<Tab, string> = {
  servers: 'Servers',
  tunnels: 'Tunnels',
  logs: 'Logs',
  settings: 'Settings',
};

interface ViewingServer extends TunnelConfig {
  runtime: { tunnelId: string; status: 'connected' };
}

function toViewingServer(server: ServerEntry, sessionId: string, username: string): ViewingServer {
  return {
    id: sessionId,
    name: server.name,
    hostname: server.host,
    port: server.port,
    username,
    encryptedPassword: '',
    rememberAfterSession: false,
    createdAt: new Date().toISOString(),
    runtime: { tunnelId: sessionId, status: 'connected' },
  };
}

function Brand() {
  return (
    <div className="flex w-full items-center gap-2.5 overflow-hidden group-data-[collapsed=true]:justify-center">
      <BrandMark className="size-8" />
      <div className="grid min-w-0 leading-tight group-data-[collapsed=true]:hidden">
        <span className="truncate text-[13px] font-semibold">TunnelGate</span>
        <span className="truncate text-[11px] text-muted-foreground">Remote desktop access</span>
      </div>
    </div>
  );
}

function App() {
  const [tab, setTab] = useState<Tab>('servers');
  const [viewingTunnel, setViewingTunnel] = useState<ViewingServer | TunnelWithState | null>(null);
  const [selectedLogTunnelId, setSelectedLogTunnelId] = useState<string | undefined>(undefined);
  const [updateDismissed, setUpdateDismissed] = useState<boolean>(
    () => sessionStorage.getItem('update-banner-dismissed') === '1',
  );
  const { session, loading: authLoading, login, logout } = useAuth();
  const { tunnels, loading, errors, add, update, remove, connect, disconnect, reload } = useTunnels(logout);
  const appUpdate = useAppUpdate();
  const isSuperuser = !!session?.isSuperuser;

  const navItems: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'servers', label: 'Servers', icon: <ServerIcon /> },
    // Manual Cloudflare tunnels: superusers only (add servers directly, no HRMS needed)
    ...(isSuperuser ? [{ id: 'tunnels' as Tab, label: 'Tunnels', icon: <NetworkIcon /> }] : []),
    { id: 'logs', label: 'Logs', icon: <FileTextIcon /> },
    { id: 'settings', label: 'Settings', icon: <SettingsIcon /> },
  ];

  if (authLoading) {
    return (
      <div className="grid h-screen place-items-center">
        <Loader variant="ring" label="Loading" />
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

  const displayName = session.employeeName || session.username;

  return (
    <AppShell
      sidebar={
        <Sidebar className="group">
          <SidebarHeader>
            <Brand />
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup label="Navigation">
              {navItems.map((item) => (
                <SidebarItem
                  key={item.id}
                  icon={item.icon}
                  label={item.label}
                  active={tab === item.id}
                  onClick={() => setTab(item.id)}
                />
              ))}
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter>
            <div className="flex items-center group-data-[collapsed=true]:justify-center">
              <StatusDot tone="success">
                <span className="group-data-[collapsed=true]:hidden">Signed in</span>
              </StatusDot>
            </div>
          </SidebarFooter>
        </Sidebar>
      }
    >
      <Topbar>
        <span className="text-sm font-medium">{TAB_LABELS[tab]}</span>
        <div className="ml-auto flex items-center gap-3">
          <ThemeMenu />
          <WifiStatusBar />
          <UserMenu name={displayName} email={session.baseUrl} onSignOut={logout} />
        </div>
      </Topbar>

      {appUpdate && (appUpdate.state === 'ready' || !updateDismissed) && (
        <Banner
          key={appUpdate.state}
          action={
            appUpdate.state === 'ready' ? (
              <Button size="xs" variant="dark" onClick={() => window.cloudflareRdp.app.installUpdate()}>
                Restart & install
              </Button>
            ) : undefined
          }
          onDismiss={
            appUpdate.state === 'ready'
              ? undefined
              : () => {
                  sessionStorage.setItem('update-banner-dismissed', '1');
                  setUpdateDismissed(true);
                }
          }
        >
          {appUpdate.state === 'available' && (
            <>TunnelGate <strong>{appUpdate.version}</strong> is available — downloading…</>
          )}
          {appUpdate.state === 'downloading' && (
            <>Downloading TunnelGate <strong>{appUpdate.version}</strong>… {appUpdate.percent}%</>
          )}
          {appUpdate.state === 'ready' && (
            <>TunnelGate <strong>{appUpdate.version}</strong> is ready — restart to install.</>
          )}
          {appUpdate.state === 'error' && <>Update failed: {appUpdate.message}</>}
        </Banner>
      )}

      {tab === 'logs' ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <Logs
            tunnels={isSuperuser ? tunnels : []}
            initialTunnelId={selectedLogTunnelId}
            onClearFilter={() => setSelectedLogTunnelId(undefined)}
          />
        </div>
      ) : (
        <AppContent>
          {tab === 'servers' && (
            <Servers
              isSuperuser={isSuperuser}
              onAuthExpired={logout}
              onConnect={async (server, username, password) => {
                const sessionId = await window.cloudflareRdp.servers.setCredentials(server.id, username, password);
                setViewingTunnel(toViewingServer(server, sessionId, username));
              }}
            />
          )}
          {tab === 'tunnels' && isSuperuser && (
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
              isSuperuser={isSuperuser}
            />
          )}
          {tab === 'settings' && <Settings session={session} onLogout={logout} />}
        </AppContent>
      )}
    </AppShell>
  );
}

export default App;
