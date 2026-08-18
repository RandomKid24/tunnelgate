import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { TunnelWithState } from '../hooks/useTunnels';
import { shortServerName } from '../lib/format';

interface Props {
  tunnel: TunnelWithState;
  onConnect: (id: string) => void;
  onDisconnect: (id: string) => void;
  onEdit: (tunnel: TunnelWithState) => void;
  onDelete: (id: string) => void;
  onViewScreen?: () => void;
  onViewLogs?: () => void;
  connectError?: string;
}

const statusColors: Record<string, string> = {
  disconnected: 'var(--text-muted)',
  connecting: 'var(--accent-amber)',
  connected: 'var(--accent-green)',
  error: 'var(--accent-red)',
  reconnecting: 'var(--accent-amber)',
};

const statusLabels: Record<string, string> = {
  disconnected: 'Disconnected',
  connecting: 'Connecting...',
  connected: 'Connected',
  error: 'Error',
  reconnecting: 'Reconnecting...',
};

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

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins < 60) return `${mins}m ${secs}s`;
  const hrs = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return `${hrs}h ${remainMins}m ${secs}s`;
}

export function TunnelCard({ tunnel, onConnect, onDisconnect, onEdit, onDelete, onViewScreen, onViewLogs, connectError }: Props) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [duration, setDuration] = useState(0);
  const connectedAtRef = useRef<number | null>(null);
  const { runtime } = tunnel;
  const isActive = runtime.status === 'connected' || runtime.status === 'connecting' || runtime.status === 'reconnecting';

  useEffect(() => {
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

  return (
    <div
      className="card-enter"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-md)',
        padding: 18,
        boxShadow: 'var(--shadow-resting)',
        transition: 'border-color 0.2s, box-shadow 0.2s, transform 0.15s',
        borderColor: isActive ? statusColors[runtime.status] : undefined,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = 'var(--shadow-lift)';
        e.currentTarget.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'var(--shadow-resting)';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: statusColors[runtime.status],
              flexShrink: 0,
              ...(runtime.status === 'connecting' || runtime.status === 'reconnecting'
                ? { animation: 'pulse-dot 1.5s ease-in-out infinite' }
                : {}),
            }}
          />
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{tunnel.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
              {tunnel.hostname}
              {runtime.status === 'connected' && duration > 0 && (
                <span style={{ color: 'var(--accent-green)' }}> &middot; {formatDuration(duration)}</span>
              )}
            </div>
            {tunnel.serverName && (
              <div
                title={tunnel.serverName}
                style={{ fontSize: 11, color: 'var(--accent-green)', fontFamily: 'monospace', marginTop: 1 }}
              >
                {shortServerName(tunnel.serverName)}
              </div>
            )}
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
              {tunnel.lastConnectedAt
                ? `Last connected: ${getRelativeTime(tunnel.lastConnectedAt)}`
                : 'Never connected'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {runtime.localPort && (
            <span
              title={`Local tunnel port: ${runtime.localPort}`}
              style={{
                fontSize: 10,
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: 'var(--radius-xs)',
                background: 'var(--bg-tertiary)',
                color: 'var(--text-muted)',
                border: '1px solid var(--border-color)',
                fontFamily: 'monospace',
              }}
            >
              :{runtime.localPort}
            </span>
          )}
          <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>
            {statusLabels[runtime.status]}
          </span>
        </div>
      </div>

      {connectError && (
        <div style={{ fontSize: 13, color: 'var(--accent-red)', marginBottom: 8, padding: '6px 10px', background: 'rgba(239,68,68,0.1)', borderRadius: 'var(--radius-xs)' }}>
          Couldn't connect. Details below:
          <div style={{ fontFamily: 'monospace', fontSize: 12, marginTop: 4, whiteSpace: 'pre-wrap' }}>{connectError}</div>
        </div>
      )}

      {runtime.lastError && runtime.status === 'error' && (
        <div style={{ fontSize: 13, color: 'var(--accent-red)', marginBottom: 8, padding: '6px 10px', background: 'rgba(239,68,68,0.1)', borderRadius: 'var(--radius-xs)', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
          {runtime.lastError}
        </div>
      )}

      {(runtime.status === 'connecting' || runtime.status === 'reconnecting' || (runtime.status === 'error' && runtime.capturedOutput)) && runtime.capturedOutput ? (
        <LiveOutput capturedOutput={runtime.capturedOutput} />
      ) : null}

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        {isActive ? (
          <>
            <ActionButton onClick={() => onDisconnect(tunnel.id)} color="var(--accent-red)" icon={DisconnectIcon}>
              Disconnect
            </ActionButton>
            {onViewScreen && runtime.status === 'connected' && (
              <ActionButton onClick={onViewScreen} color="var(--accent-blue)" icon={ViewScreenIcon}>
                View Screen
              </ActionButton>
            )}
          </>
        ) : (
          <ActionButton onClick={() => onConnect(tunnel.id)} color="var(--accent-green)" icon={ConnectIcon}>
            Connect
          </ActionButton>
        )}
        <ActionButton onClick={() => onEdit(tunnel)} color="var(--accent-blue)" variant="secondary" icon={EditIcon}>
          Edit
        </ActionButton>
        {onViewLogs && (
          <ActionButton onClick={onViewLogs} color="var(--text-secondary)" variant="secondary" icon={LogsListIcon}>
            Logs
          </ActionButton>
        )}
        <ActionButton onClick={() => setShowDeleteConfirm(true)} color="var(--accent-red)" variant="secondary" icon={DeleteIcon}>
          Delete
        </ActionButton>
      </div>

      {showDeleteConfirm && ReactDOM.createPortal(
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
            animation: 'fadeIn 0.15s ease-out',
          }}
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              borderRadius: 'var(--radius-lg)',
              padding: 24,
              width: '90%',
              maxWidth: 400,
              boxShadow: 'var(--shadow-modal-danger)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>
              Delete Tunnel?
            </h3>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Are you sure you want to delete <strong style={{ color: 'var(--text-primary)' }}>"{tunnel.name}"</strong>? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                style={{
                  padding: '10px 18px',
                  fontSize: 13,
                  fontWeight: 500,
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)',
                  background: 'transparent',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onDelete(tunnel.id);
                  setShowDeleteConfirm(false);
                }}
                style={{
                  padding: '10px 18px',
                  fontSize: 13,
                  fontWeight: 600,
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  background: 'var(--accent-red)',
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                Delete Tunnel
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

function LiveOutput({ capturedOutput }: { capturedOutput: string }) {
  const ref = useRef<HTMLPreElement>(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.scrollTop = ref.current.scrollHeight;
    }
  }, [capturedOutput]);

  return (
    <pre
      ref={ref}
      style={{
        fontSize: 11,
        lineHeight: 1.4,
        background: 'rgba(0,0,0,0.06)',
        borderRadius: 'var(--radius-xs)',
        padding: 8,
        maxHeight: 150,
        overflowY: 'auto',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
        fontFamily: 'monospace',
        margin: '8px 0 0',
        color: 'var(--text-secondary)',
      }}
    >
      {capturedOutput}
    </pre>
  );
}

function ActionButton({ onClick, color, variant, icon, children }: {
  onClick: () => void;
  color: string;
  variant?: 'primary' | 'secondary';
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  const isPrimary = variant !== 'secondary';
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 14px',
        fontSize: 13,
        fontWeight: 500,
        borderRadius: 'var(--radius-xs)',
        border: isPrimary ? 'none' : `1px solid ${color}`,
        background: isPrimary ? color : 'transparent',
        color: isPrimary ? '#fff' : color,
        cursor: 'pointer',
        transition: 'opacity 0.15s, transform 0.1s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.85'; }}
      onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
    >
      {icon}
      {children}
    </button>
  );
}

const ConnectIcon = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3" /></svg>
);
const DisconnectIcon = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0" /><line x1="12" y1="2" x2="12" y2="12" /></svg>
);
const ViewScreenIcon = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>
);
const EditIcon = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
);
const LogsListIcon = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>
);
const DeleteIcon = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
);
