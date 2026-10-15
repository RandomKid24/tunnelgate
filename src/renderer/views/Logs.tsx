import React from 'react';
import { formatIpcError } from '../lib/format';
import { LogViewer } from '../components/LogViewer';
import { useLogs } from '../hooks/useLogs';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/app-shell';

interface Props {
  tunnels: { id: string; name: string }[];
  initialTunnelId?: string;
  onClearFilter?: () => void;
}

export function Logs({ tunnels, initialTunnelId, onClearFilter }: Props) {
  const { logs, exportLogs, clearLogs } = useLogs();
  const [filterTunnelId, setFilterTunnelId] = React.useState<string | undefined>(initialTunnelId);

  const handleSelectFilter = (id: string | undefined) => {
    setFilterTunnelId(id);
    if (!id && onClearFilter) {
      onClearFilter();
    }
  };

  const filteredLogs = filterTunnelId
    ? logs.filter((l) => l.tunnelId === filterTunnelId)
    : logs;

  const isFiltered = Boolean(filterTunnelId);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        title="Logs"
        description={isFiltered ? `Filtered — ${filteredLogs.length} entries` : `All tunnels — ${logs.length} entries`}
      />

      <div className="mb-3 flex flex-wrap items-center gap-2 px-4 sm:px-6">
        <Badge
          variant={!filterTunnelId ? 'primary' : 'default'}
          className={filterTunnelId ? 'cursor-pointer hover:bg-muted' : 'cursor-pointer'}
          onClick={() => handleSelectFilter(undefined)}
        >
          All Tunnels
        </Badge>
        {tunnels.map((t) => (
          <Badge
            key={t.id}
            variant={filterTunnelId === t.id ? 'primary' : 'default'}
            className={filterTunnelId === t.id ? 'cursor-pointer' : 'cursor-pointer hover:bg-muted'}
            onClick={() => handleSelectFilter(t.id)}
          >
            {t.name}
          </Badge>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-hidden px-4 pb-4 sm:px-6 sm:pb-6">
        <LogViewer
          logs={logs}
          onExport={() => exportLogs(filterTunnelId)}
          onClear={clearLogs}
          filterTunnelId={filterTunnelId}
        />
      </div>
    </div>
  );
}
