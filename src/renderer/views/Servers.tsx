import React, { useCallback, useEffect, useState } from 'react';
import { ServerEntry, LocalServerInput } from '../../shared/types';
import { formatIpcError } from '../lib/format';
import { Alert } from '@/components/ui/alert';
import { AlertDialog } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { EditIcon, PlusIcon, PlugIcon, RefreshIcon, ServerIcon, TrashIcon } from '@/components/ui/icons';
import { Field } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Loader } from '@/components/ui/loader';
import { PasswordInput } from '@/components/ui/password-input';
import { toast } from '@/components/ui/toast';

interface Props {
  isSuperuser?: boolean;
  onConnect: (server: ServerEntry, username: string, password: string) => Promise<void>;
  onAuthExpired: () => void;
}

function CredentialsDialog({
  server,
  onSubmit,
  onClose,
}: {
  server: ServerEntry;
  onSubmit: (username: string, password: string) => Promise<void>;
  onClose: () => void;
}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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

  return (
    <Dialog open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Connect to {server.name}</DialogTitle>
          <DialogDescription className="font-mono">{server.address}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4">
          <Field label="Windows username" htmlFor="creds-username">
            <Input
              id="creds-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
              disabled={submitting}
              autoComplete="off"
            />
          </Field>

          <Field label="Windows password" htmlFor="creds-password">
            <PasswordInput
              id="creds-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={submitting}
              autoComplete="off"
            />
          </Field>

          {error && <Alert variant="danger">{error}</Alert>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              {submitting ? 'Connecting…' : 'Connect'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ServerFormDialog({
  server,
  onSubmit,
  onClose,
}: {
  server: ServerEntry | null;
  onSubmit: (input: LocalServerInput) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState(server?.name ?? '');
  const [host, setHost] = useState(server?.host ?? '');
  const [port, setPort] = useState(String(server?.port ?? 3389));
  const [description, setDescription] = useState(server?.description ?? '');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit({ name, host, port: Number(port), description });
    } catch (err: any) {
      setError(formatIpcError(err));
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{server ? 'Edit server' : 'Add server'}</DialogTitle>
          <DialogDescription>Direct server (superuser only). Not stored in HRMS.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4">
          <Field label="Name" htmlFor="server-name">
            <Input
              id="server-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
              disabled={submitting}
            />
          </Field>

          <div className="flex gap-2.5">
            <Field label="Host / IP" htmlFor="server-host" className="flex-1">
              <Input
                id="server-host"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                required
                placeholder="192.168.1.102"
                disabled={submitting}
              />
            </Field>
            <Field label="Port" htmlFor="server-port" className="w-24">
              <Input
                id="server-port"
                type="number"
                min={1}
                max={65535}
                value={port}
                onChange={(e) => setPort(e.target.value)}
                required
                disabled={submitting}
              />
            </Field>
          </div>

          <Field label="Description (optional)" htmlFor="server-description">
            <Input
              id="server-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={submitting}
            />
          </Field>

          {error && <Alert variant="danger">{error}</Alert>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              {submitting ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function Servers({ onConnect, onAuthExpired, isSuperuser }: Props) {
  const [servers, setServers] = useState<ServerEntry[]>([]);
  const [unrestricted, setUnrestricted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ServerEntry | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ServerEntry | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ServerEntry | null>(null);

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

  const handleDelete = async (server: ServerEntry) => {
    try {
      await window.cloudflareRdp.servers.deleteLocal(server.id);
      toast.success('Server deleted', server.name);
      await load();
    } catch (err: any) {
      setError(formatIpcError(err));
    }
  };

  const emptyDescription = isSuperuser
    ? 'Add one in HRMS (Admin → Servers), or use "Add server" to add a direct server.'
    : 'No servers are assigned to your account. Ask an administrator to grant you access in HRMS.';

  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-1">
          <h1 className="text-xl font-semibold tracking-tight">Servers</h1>
          {unrestricted && servers.length > 0 && (
            <p className="text-[13px] text-muted-foreground">Unrestricted access: showing every active server.</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isSuperuser && (
            <Button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <PlusIcon /> Add server
            </Button>
          )}
          <Button variant="outline" onClick={load} loading={loading}>
            <RefreshIcon /> Refresh
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="danger" className="mb-4">
          {error}
        </Alert>
      )}

      {loading && servers.length === 0 && (
        <div className="grid place-items-center py-20">
          <Loader variant="ring" size="lg" label="Loading servers" />
        </div>
      )}

      {!loading && !error && servers.length === 0 && (
        <EmptyState
          icon={<ServerIcon />}
          title="No servers yet"
          description={emptyDescription}
          action={
            isSuperuser ? (
              <Button
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                <PlusIcon /> Add server
              </Button>
            ) : undefined
          }
        />
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {servers.map((server) => (
          <Card key={server.id} className="flex flex-col gap-1.5 p-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">{server.name}</span>
              {server.source === 'local' && <Badge variant="outline">DIRECT</Badge>}
            </div>
            <span className="font-mono text-xs text-muted-foreground">{server.address}</span>
            {server.description && <span className="text-xs text-muted-foreground">{server.description}</span>}

            <Button className="mt-2" onClick={() => setSelected(server)}>
              <PlugIcon /> Connect
            </Button>

            {isSuperuser && server.source === 'local' && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    setEditing(server);
                    setFormOpen(true);
                  }}
                >
                  <EditIcon /> Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setPendingDelete(server)}
                >
                  <TrashIcon /> Delete
                </Button>
              </div>
            )}
          </Card>
        ))}
      </div>

      {formOpen && (
        <ServerFormDialog
          server={editing}
          onClose={() => setFormOpen(false)}
          onSubmit={async (input) => {
            if (editing) await window.cloudflareRdp.servers.updateLocal(editing.id, input);
            else await window.cloudflareRdp.servers.addLocal(input);
            toast.success(editing ? 'Server updated' : 'Server added', input.name);
            setFormOpen(false);
            await load();
          }}
        />
      )}

      {selected && (
        <CredentialsDialog
          server={selected}
          onClose={() => setSelected(null)}
          onSubmit={async (username, password) => {
            await onConnect(selected, username, password);
            setSelected(null);
          }}
        />
      )}

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(open) => (!open ? setPendingDelete(null) : undefined)}
        title="Delete server?"
        description={
          pendingDelete
            ? `"${pendingDelete.name}" will be removed from this device. This cannot be undone.`
            : undefined
        }
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          if (pendingDelete) void handleDelete(pendingDelete);
          setPendingDelete(null);
        }}
      />
    </>
  );
}
