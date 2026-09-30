import { useState, useEffect, useCallback, useRef } from 'react';
import { TunnelConfig, TunnelRuntimeState, TunnelStatus } from '../../shared/types';
import { formatIpcError } from '../lib/format';

export interface TunnelWithState extends TunnelConfig {
  runtime: TunnelRuntimeState;
}

export function useTunnels(onAuthExpired?: () => void) {
  const [tunnels, setTunnels] = useState<TunnelWithState[]>([]);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const stateMap = useRef<Map<string, TunnelRuntimeState>>(new Map());

  const loadTunnels = useCallback(async () => {
    try {
      const configs = await window.cloudflareRdp.tunnels.list();
      const merged = configs.map((c) => ({
        ...c,
        runtime: stateMap.current.get(c.id) ?? {
          tunnelId: c.id,
          status: 'disconnected' as TunnelStatus,
        },
      }));
      setTunnels(merged);
    } catch (err) {
      console.error('Failed to load tunnels:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTunnels();
  }, [loadTunnels]);

  useEffect(() => {
    const unsub = window.cloudflareRdp.tunnels.onStatusChange((state) => {
      stateMap.current.set(state.tunnelId, state);
      if (state.status === 'connected') {
        setErrors((prev) => {
          if (!(state.tunnelId in prev)) return prev;
          const next = { ...prev };
          delete next[state.tunnelId];
          return next;
        });
      }
      setTunnels((prev) =>
        prev.map((t) =>
          t.id === state.tunnelId
            ? { ...t, runtime: state }
            : t
        )
      );
    });
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = window.cloudflareRdp.tunnels.onTrayConnect((tunnelId) => {
      connect(tunnelId);
    });
    return unsub;
  }, []);

  const add = useCallback(async (data: {
    name: string;
    hostname: string;
    port: number;
    username: string;
    password: string;
    rememberAfterSession: boolean;
  }) => {
    const tunnel = await window.cloudflareRdp.tunnels.add(data);
    setTunnels((prev) => [
      ...prev,
      {
        ...tunnel,
        runtime: { tunnelId: tunnel.id, status: 'disconnected' },
      },
    ]);
  }, []);

  const update = useCallback(async (tunnel: TunnelConfig) => {
    await window.cloudflareRdp.tunnels.update(tunnel);
    await loadTunnels();
  }, [loadTunnels]);

  const remove = useCallback(async (tunnelId: string) => {
    await window.cloudflareRdp.tunnels.delete(tunnelId);
    setTunnels((prev) => prev.filter((t) => t.id !== tunnelId));
  }, []);

  const [connectingTunnels, setConnectingTunnels] = useState<Set<string>>(new Set());

  const connect = useCallback(async (tunnelId: string) => {
    setErrors((prev) => {
      if (!(tunnelId in prev)) return prev;
      const next = { ...prev };
      delete next[tunnelId];
      return next;
    });
    setConnectingTunnels((prev) => new Set(prev).add(tunnelId));
    setTunnels((prev) =>
      prev.map((t) =>
        t.id === tunnelId
          ? {
              ...t,
              runtime: {
                ...t.runtime,
                status: 'connecting',
                capturedOutput: 'Verifying Wi-Fi network and starting tunnel...',
              },
            }
          : t
      )
    );
    try {
      await window.cloudflareRdp.tunnels.connect(tunnelId);
    } catch (err: any) {
      const message = formatIpcError(err);
      setErrors((prev) => ({ ...prev, [tunnelId]: message }));
      setTunnels((prev) =>
        prev.map((t) =>
          t.id === tunnelId && t.runtime.status === 'connecting'
            ? { ...t, runtime: { ...t.runtime, status: 'disconnected', capturedOutput: undefined } }
            : t
        )
      );
      // The main process throws this exact phrasing when the HRMS session is
      // missing or its stored token has gone stale — rather than leave the
      // user staring at a red banner that tells them to "log in again"
      // without actually doing it, sign them out so the Login screen comes
      // back up on its own.
      if (/log in again|not logged in/i.test(message)) {
        onAuthExpired?.();
      }
    } finally {
      setConnectingTunnels((prev) => {
        const next = new Set(prev);
        next.delete(tunnelId);
        return next;
      });
    }
  }, [onAuthExpired]);

  const disconnect = useCallback(async (tunnelId: string) => {
    await window.cloudflareRdp.tunnels.disconnect(tunnelId);
  }, []);

  return { tunnels, loading, errors, connectingTunnels, add, update, remove, connect, disconnect, reload: loadTunnels };
}
