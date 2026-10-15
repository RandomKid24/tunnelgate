import React, { useRef, useEffect, useState, useMemo } from 'react';
import { LogEntry } from '../../shared/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { DownloadIcon, TrashIcon, SearchIcon } from '@/components/ui/icons';

interface Props {
  logs: LogEntry[];
  onExport: () => void;
  onClear: () => void;
  filterTunnelId?: string;
}

const levelTones: Record<string, 'default' | 'warning' | 'danger' | 'primary'> = {
  info: 'default',
  warn: 'warning',
  error: 'danger',
  debug: 'default',
};

const levelLabels: Record<string, string> = {
  info: 'INFO',
  warn: 'WARN',
  error: 'ERROR',
  debug: 'DEBUG',
};

function formatTime(ts: string): string {
  const d = new Date(ts);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return `${h}:${m}:${s}.${ms}`;
}

export function LogViewer({ logs, onExport, onClear, filterTunnelId }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    let result = filterTunnelId
      ? logs.filter((l) => l.tunnelId === filterTunnelId)
      : logs;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((l) =>
        l.message.toLowerCase().includes(q) ||
        l.tunnelName.toLowerCase().includes(q) ||
        l.level.toLowerCase().includes(q),
      );
    }
    return result;
  }, [logs, filterTunnelId, search]);

  useEffect(() => {
    if (autoScroll) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [filtered.length, autoScroll]);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 50;
    if (isNearBottom !== autoScroll) {
      setAutoScroll(isNearBottom);
    }
  };

  const isFiltered = Boolean(filterTunnelId);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border bg-card">
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
        <div className="relative w-full max-w-xs">
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter logs"
            className="h-8 pl-8 pr-3"
          />
        </div>
        <Button
          variant={autoScroll ? 'primary' : 'outline'}
          size="sm"
          onClick={() => setAutoScroll((v) => !v)}
        >
          Auto {autoScroll ? 'ON' : 'OFF'}
        </Button>
        <Button variant="outline" size="sm" onClick={onClear}>
          <TrashIcon /> Clear
        </Button>
        <Button variant="outline" size="sm" onClick={onExport}>
          <DownloadIcon /> Export
        </Button>
        <div className="ml-auto text-xs text-muted-foreground">
          {filtered.length} {filtered.length === 1 ? 'entry' : 'entries'}
          {isFiltered && ' (filtered)'}
        </div>
      </div>

      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="min-h-0 flex-1 overflow-y-auto px-3 py-2 font-mono text-[12px] leading-relaxed"
      >
        {filtered.length === 0 ? (
          <EmptyState
            title={search ? 'No matching log entries' : 'No log entries yet'}
            description={
              search
                ? 'Try a different search term or clear the filter.'
                : 'Connect a tunnel to see live cloudflared output.'
            }
            className="h-full border-0 bg-transparent"
          />
        ) : (
          <div className="grid gap-0.5">
            {filtered.map((entry) => (
              <div key={entry.id} className="flex flex-wrap items-start gap-2">
                <span className="text-muted-foreground">[{formatTime(entry.timestamp)}]</span>
                <Badge variant={levelTones[entry.level] || 'default'} className="rounded-sm px-1 py-0 text-[10px]">
                  {levelLabels[entry.level] || entry.level.toUpperCase()}
                </Badge>
                <span className="text-primary">[{entry.tunnelName}]</span>
                <span className="ml-1 whitespace-pre-wrap break-words text-foreground">{entry.message}</span>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>
    </div>
  );
}
