import React from 'react';
import { TunnelCard as _TunnelCard } from '../components/TunnelCard';
import { TunnelWithState } from '../hooks/useTunnels';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import { AlertDialog } from '@/components/ui/alert-dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/dialog';
import { Tooltip } from '@/components/ui/tooltip';
import { Terminal, TerminalLine } from '@/components/ui/terminal';
import { ActivityIcon, AlertCircleIcon, CheckIcon, ClockIcon, ExternalLinkIcon, FileTextIcon, PlugIcon, RotateCcwIcon, TrashIcon, XCircleIcon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import { formatIpcError } from '../lib/format';

interface Props {
  tunnel: TunnelWithState;
  onConnect: (id: string) => void;
  onDisconnect: (id: string) => void;
  onEdit: (tunnel: TunnelWithState) => void;
  onDelete: (id: string) => void;
  onViewScreen?: () => void;
  onViewLogs?: () => void;
  connectError?: string;
  canEdit?: boolean;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins < 60) return `${mins}m ${secs}s`;
  const hrs = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return `${hrs}h ${remainMins}m ${secs}s`;
}

function getRelativeTime(dateStr: string | undefined): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 0) return '';
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const statusColors: Record<string, 'primary' | 'success' | 'warning' | 'danger' | 'default'> = {
  disconnected: 'default',
  connecting: 'warning',
  connected: 'success',
  error: 'danger',
  reconnecting: 'warning',
};

const statusLabels: Record<string, string> = {
  disconnected: 'Disconnected',
  connecting: 'Connecting…',
  connected: 'Connected',
  error: 'Error',
  reconnecting: 'Reconnecting…',
};

export function TunnelCard({ tunnel, onConnect, onDisconnect, onEdit, onDelete, onViewScreen, onViewLogs, connectError, canEdit = true }: Props) {
  const [showDelete, setShowDelete] = React.useState(false);
  const [showLogsSheet, setShowLogsSheet] = React.useState(false);
  const [duration, setDuration] = React.useState(0);
  const connectedAtRef = React.useRef<number | null>(null);
  const { runtime } = tunnel;
  const isActive = runtime.status === 'connected' || runtime.status === 'connecting' || runtime.status === 'reconnecting';

  React.useEffect(() => {
    if (runtime.status === 'connected') {
      connectedAtRef.current = Date.now();
      const tick = () => setDuration(Math.floor((Date.now() - connectedAtRef.current!) / 1000));
      tick();
      const id = setInterval(tick, 1000);
      return () => clearInterval(id);
    } else {
      connectedAtRef.current = null;
      setDuration(0);
    }
  }, [runtime.status]);

  const lastError = connectError || runtime.lastError;

  const isBusy = runtime.status === 'connecting' || runtime.status === 'reconnecting';

  return (
    <>
      <Card
        className={cn(
          'card-enter p-4 transition-all hover:-translate-y-0.5 hover:shadow-md',
          isActive && 'border-primary/40',
        )}
      >
        <div className="mb-3 flex items-start justify-between gap-4">
          <div className="flex items-start gap-2.5">
            <span
              className={cn(
                'mt-1 size-2 rounded-full',
                runtime.status === 'connected' && 'bg-success',
                runtime.status === 'error' && 'bg-destructive',
                runtime.status === 'connecting' && 'bg-warning animate-pulse-dot',
                runtime.status === 'reconnecting' && 'bg-warning animate-pulse-dot',
                runtime.status === 'disconnected' && 'bg-muted-foreground',
              )}
            />
            <div className="grid gap-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">{tunnel.name}</span>
                <Badge variant={statusColors[runtime.status]}>{statusLabels[runtime.status]}</Badge>
                {runtime.localPort && (
                  <Tooltip content={`Local tunnel port: ${runtime.localPort}`}>
                    <span className="font-mono text-[11px] text-muted-foreground">:{runtime.localPort}</span>
                  </Tooltip>
                )}
              </div>
              <span className="font-mono text-xs text-muted-foreground">{tunnel.hostname}</span>
              {tunnel.serverName && (
                <span className="text-[11px] text-muted-foreground">{tunnel.serverName}</span>
              )}
              <span className="text-[11px] text-muted-foreground">
                {tunnel.lastConnectedAt
                  ? `Last connected: ${getRelativeTime(tunnel.lastConnectedAt)}`
                  : 'Never connected'}
                {runtime.status === 'connected' && duration > 0 && (
                  <span className="text-success"> · {formatDuration(duration)}</span>
                )}
              </span>
            </div>
          </div>
        </div>

        {lastError && runtime.status !== 'connected' && (
          <Alert variant="danger" className="mb-3">
            <div className="max-h-28 overflow-y-auto whitespace-pre-wrap font-mono text-xs">
              {lastError}
            </div>
          </Alert>
        )}

        <div className="flex flex-wrap gap-2">
          {isBusy ? (
            <>
              <Button size="sm" disabled>
                <ActivityIcon className="animate-pulse" /> Connecting…
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => onDisconnect(tunnel.id)}
              >
                <XCircleIcon /> Cancel
              </Button>
            </>
          ) : runtime.status === 'connected' ? (
            <>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => onDisconnect(tunnel.id)}
              >
                <XCircleIcon /> Disconnect
              </Button>
              {onViewScreen && (
                <Button size="sm" onClick={onViewScreen}>
                  <ExternalLinkIcon /> View Screen
                </Button>
              )}
            </>
          ) : (
            <Button size="sm" onClick={() => onConnect(tunnel.id)}>
              <PlugIcon /> Connect
            </Button>
          )}

          {canEdit && (
            <Button variant="outline" size="sm" onClick={() => onEdit(tunnel)}>
              Edit
            </Button>
          )}

          {onViewLogs && (
            <Button variant="outline" size="sm" onClick={() => setShowLogsSheet(true)}>
              <FileTextIcon /> Logs
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setShowDelete(true)}
          >
            <TrashIcon /> Delete
          </Button>
        </div>
      </Card>

      <AlertDialog
        open={showDelete}
        onOpenChange={(open) => (!open ? setShowDelete(false) : undefined)}
        title="Delete tunnel?"
        description={`Delete "${tunnel.name}" (${tunnel.hostname})? This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          onDelete(tunnel.id);
          setShowDelete(false);
        }}
      />

      <Sheet open={showLogsSheet} onOpenChange={setShowLogsSheet}>
        <SheetContent className="w-full max-w-2xl gap-0 p-0">
          <SheetHeader className="border-b px-6 py-4">
            <SheetTitle>Connection output — {tunnel.name}</SheetTitle>
            <SheetDescription>Recent stderr/stdout from cloudflared</SheetDescription>
          </SheetHeader>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <Terminal
              className="flex h-[60vh] min-h-[320px] flex-1 rounded-none border-0"
              lines={(runtime.capturedOutput ?? '')
                .split(/\r?\n/)
                .filter((l) => l.trim().length > 0)
                .slice(-200)
                .map((l): TerminalLine => ({ text: l, kind: 'output' }))}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
