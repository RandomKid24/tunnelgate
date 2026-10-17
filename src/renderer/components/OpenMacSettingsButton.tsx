import React from 'react';
import { Button } from '@/components/ui/button';
import { SettingsIcon } from '@/components/ui/icons';

const IS_MAC = typeof navigator !== 'undefined' && /mac/i.test(navigator.userAgent);

/**
 * True when an error text is the macOS Location Services refusal that gates
 * Wi-Fi SSID reads. The wording it matches is built in `checkWifiGate` /
 * `WIFI_GET_STATUS` (src/main/ipcHandlers.ts) — keep the two in step.
 * Deliberately macOS-only: the settings deep-link below has no meaning
 * elsewhere, and other platforms show a different hint.
 */
export function isMacLocationPermissionError(message: string | null | undefined): boolean {
  if (!IS_MAC || !message) return false;
  return /location (services|access)/i.test(message);
}

/**
 * Small shortcut that deep-links to
 * System Settings → Privacy & Security → Location Services
 * (IPC_CHANNELS.WIFI_OPEN_LOCATION_SETTINGS) so the user only has to click,
 * instead of hunting through System Settings themselves. The main-process
 * handler is a no-op on non-macOS.
 */
export function OpenMacSettingsButton({ size = 'xs', className }: { size?: 'xs' | 'sm'; className?: string }) {
  return (
    <Button
      type="button"
      variant="outline"
      size={size}
      className={className}
      onClick={() => window.cloudflareRdp.wifi.openLocationSettings().catch(() => undefined)}
    >
      <SettingsIcon /> Open Settings
    </Button>
  );
}
