import React, { useMemo, useState } from 'react';
import { TunnelCard } from '../components/TunnelCard';
import { TunnelForm } from '../components/TunnelForm';
import { TunnelWithState } from '../hooks/useTunnels';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { PlusIcon } from '@/components/ui/icons';
import { Loader } from '@/components/ui/loader';
import { SearchInput } from '@/components/ui/search-input';
import { PageHeader } from '@/components/ui/app-shell';

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
  isSuperuser: boolean;
}

function TunnelDialog({
  tunnel,
  onSubmit,
  onClose,
}: {
  tunnel: TunnelWithState | null;
  onSubmit: (data: { name: string; hostname: string; port: number; username: string; password: string; rememberAfterSession: boolean }) => void;
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="max-h-[92vh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto">
        <TunnelForm tunnel={tunnel ?? undefined} onSubmit={onSubmit} onCancel={onClose} />
      </DialogContent>
    </Dialog>
  );
}

function ChecklistItem({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-muted-foreground" />
      <span className="text-[13px] leading-relaxed text-muted-foreground">{text}</span>
    </li>
  );
}

export function Tunnels({ tunnels, loading, errors, onAdd, onUpdate, onDelete, onConnect, onDisconnect, onViewScreen, onViewLogs, isSuperuser }: Props) {
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

  const openAdd = () => {
    setEditingTunnel(null);
    setShowForm(true);
  };

  return (
    <>
      <PageHeader
        title="Tunnels"
        description="Manually added Cloudflare tunnels on this device."
        actions={
          !showForm ? (
            <Button onClick={openAdd}>
              <PlusIcon /> Add Tunnel
            </Button>
          ) : undefined
        }
      />

      {(connectedCount > 0 || (tunnels.length > 4 && !showForm)) && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          {connectedCount > 0 && (
            <Badge variant="success" dot>
              {connectedCount} connected
            </Badge>
          )}
          {tunnels.length > 4 && !showForm && (
            <SearchInput
              value={search}
              onValueChange={setSearch}
              placeholder="Search by name or hostname…"
              className="w-full max-w-sm"
            />
          )}
        </div>
      )}

      {loading ? (
        <div className="grid place-items-center py-20">
          <Loader variant="ring" size="lg" label="Loading tunnels" />
        </div>
      ) : tunnels.length === 0 && !showForm ? (
        <div className="grid place-items-center py-6">
          <Card className="w-full max-w-lg p-6">
            <div className="grid gap-1 text-center">
              <h2 className="text-base font-semibold">Add your first server</h2>
              <p className="text-[13px] leading-relaxed text-muted-foreground">
                You'll need three things from your office IT or Cloudflare Zero Trust dashboard first.
              </p>
            </div>
            <ul className="mt-5 grid gap-2.5">
              <ChecklistItem text="The server's Cloudflare Tunnel hostname (not its IP address)" />
              <ChecklistItem text="Its Windows username, e.g. CORP\yourname" />
              <ChecklistItem text="Its Windows password" />
            </ul>
            <Button className="mt-6 w-full" onClick={openAdd}>
              <PlusIcon /> Add Your First Tunnel
            </Button>
          </Card>
        </div>
      ) : (
        <>
          {visibleTunnels.length === 0 && (
            <p className="py-10 text-center text-[13px] text-muted-foreground">No tunnels match "{search}"</p>
          )}
          <div className="grid gap-3">
            {visibleTunnels.map((tunnel) => (
              <TunnelCard
                key={tunnel.id}
                tunnel={tunnel}
                onConnect={onConnect}
                onDisconnect={onDisconnect}
                onEdit={handleEdit}
                onDelete={onDelete}
                onViewScreen={() => onViewScreen(tunnel)}
                onViewLogs={() => onViewLogs(tunnel.id)}
                connectError={errors[tunnel.id]}
                canEdit={isSuperuser}
              />
            ))}
          </div>
        </>
      )}

      {showForm && (
        <TunnelDialog
          tunnel={editingTunnel}
          onSubmit={handleFormSubmit}
          onClose={() => {
            setShowForm(false);
            setEditingTunnel(null);
          }}
        />
      )}
    </>
  );
}
