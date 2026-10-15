import React, { useState, useEffect, useCallback } from 'react';
import { WifiStatusResult } from '../../shared/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { MapPinIcon, RefreshIcon, WifiIcon, WifiOffIcon } from '@/components/ui/icons';

export function WifiStatusBar() {
  const [wifiStatus, setWifiStatus] = useState<WifiStatusResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const fetchStatus = useCallback(async (bypassCache = false) => {
    if (!window.cloudflareRdp?.wifi) return;
    setLoading(true);
    try {
      const res = await window.cloudflareRdp.wifi.getStatus(bypassCache);
      setWifiStatus(res);
      setLastChecked(new Date());
    } catch (err) {
      console.error('Failed to fetch Wi-Fi status:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus(false);
    // Periodically re-check Wi-Fi status every 30 seconds
    const interval = setInterval(() => fetchStatus(false), 30000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  if (!wifiStatus && !loading) return null;

  const isOk = wifiStatus?.status === 'ok' && wifiStatus.allowed;
  const isUnauthorized = wifiStatus?.status === 'ok' && !wifiStatus.allowed;
  const isPermDenied = wifiStatus?.status === 'permission-denied';

  let tone: 'default' | 'success' | 'warning' | 'danger' = 'default';
  let statusText = 'Checking Wi-Fi…';
  let subText = '';
  let Icon: React.ComponentType<{ className?: string }> = WifiIcon;

  if (loading && !wifiStatus) {
    statusText = 'Checking Wi-Fi…';
  } else if (isOk) {
    tone = 'success';
    statusText = wifiStatus.ssid || 'Authorized Network';
    subText = wifiStatus.matchedNetwork ? `(${wifiStatus.matchedNetwork})` : '(Authorized)';
  } else if (isUnauthorized) {
    tone = 'danger';
    statusText = wifiStatus?.ssid || 'Unknown Network';
    subText = '(Not Authorized)';
  } else if (isPermDenied) {
    tone = 'warning';
    statusText = 'Permission Required';
    subText = '(macOS Location)';
    Icon = MapPinIcon;
  } else if (wifiStatus?.status === 'unavailable') {
    tone = 'default';
    statusText = 'No Wi-Fi Detected';
    Icon = WifiOffIcon;
  }

  const tooltip = wifiStatus?.error
    ? `Wi-Fi verification: ${wifiStatus.error}`
    : isOk
      ? `Connected to authorized Wi-Fi: ${wifiStatus?.ssid}`
      : 'Click refresh to re-verify Wi-Fi status';

  return (
    <div className="inline-flex items-center gap-1">
      <Tooltip content={tooltip}>
        <span className="inline-flex">
          <Badge variant={tone} className="gap-1.5 py-1">
            <Icon />
            <span className="font-semibold">{statusText}</span>
            {subText && <span className="font-normal opacity-70">{subText}</span>}
          </Badge>
        </span>
      </Tooltip>
      <Tooltip
        content={
          lastChecked ? `Last checked: ${lastChecked.toLocaleTimeString()}` : 'Re-check Wi-Fi status'
        }
      >
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => fetchStatus(true)}
          disabled={loading}
          aria-label="Refresh Wi-Fi status"
        >
          <RefreshIcon className={loading ? 'animate-spin' : undefined} />
        </Button>
      </Tooltip>
    </div>
  );
}
