import { execFile } from 'child_process';
import { promisify } from 'util';
import { app } from 'electron';
import path from 'path';
import { writeLog } from './logger';

const execFileAsync = promisify(execFile);

function wifiLog(msg: string) {
  writeLog('system', 'WiFi', 'info', msg);
}

export interface WifiInfo {
  ssid: string;
  bssid: string | null;
}

export type WifiDetectionResult =
  | { status: 'ok'; wifi: WifiInfo }
  | { status: 'unavailable' }
  | { status: 'permission-denied' };

interface NativeWifiAddon {
  getCurrentWifi(timeoutSeconds?: number): Promise<{
    authorized: boolean;
    ssid: string | null;
    bssid: string | null;
  }>;
}

let macAddon: NativeWifiAddon | null | undefined;

function loadMacAddon(): NativeWifiAddon | null {
  if (macAddon !== undefined) return macAddon;
  try {
    const addonDir = app.isPackaged
      ? path.join(process.resourcesPath, 'wifi-native')
      : path.join(__dirname, '..', '..', 'native', 'wifi-native', 'build', 'Release');
    macAddon = require(path.join(addonDir, 'wifi_native.node')) as NativeWifiAddon;
  } catch {
    macAddon = null;
  }
  return macAddon;
}

export async function detectWifi(): Promise<WifiDetectionResult> {
  try {
    if (process.platform === 'darwin') return await detectMacWifi();
    if (process.platform === 'win32') return await detectWindowsWifi();
    return await detectLinuxWifi();
  } catch {
    return { status: 'unavailable' };
  }
}

// macOS: reads the real SSID/BSSID via CoreWLAN through a native addon
// (native/wifi-native), in-process. CLI tools (system_profiler, networksetup,
// ipconfig) were tested and found to always redact the SSID as "<redacted>"
// on modern macOS regardless of the calling process's own Location
// authorization — CoreWLAN called directly does not have that restriction,
// as long as the app has been granted Location Services access. The addon
// itself requests that authorization (surfacing the real system prompt on
// first use) and waits up to the given timeout for the user to respond.
async function detectMacWifi(): Promise<WifiDetectionResult> {
  const addon = loadMacAddon();
  if (!addon) return { status: 'unavailable' };

  const result = await addon.getCurrentWifi(30);
  if (!result.authorized) return { status: 'permission-denied' };
  if (!result.ssid) return { status: 'unavailable' };
  return { status: 'ok', wifi: { ssid: result.ssid, bssid: result.bssid } };
}

function normalizeBssid(raw: string): string {
  // Strip whitespace/CR, lowercase, normalize separators to colons
  return raw.trim().replace(/\r/g, '').toLowerCase().replace(/-/g, ':');
}

async function detectWindowsWifi(): Promise<WifiDetectionResult> {
  const { stdout } = await execFileAsync('netsh', ['wlan', 'show', 'interfaces'], { timeout: 8000 });
  wifiLog(`[win32] raw netsh output length: ${stdout.length}`);
  const relevantLines = stdout.split(/\r?\n/).filter(l => /SSID|BSSID/i.test(l)).join(' | ');
  wifiLog(`[win32] netsh lines: ${relevantLines}`);

  const ssidMatch = stdout.match(/^\s*SSID\s*:\s*(.+)$/mi);
  const bssidMatch = stdout.match(/^\s*(?:AP\s+)?BSSID\s*:\s*(.+)$/mi);
  if (!ssidMatch) {
    wifiLog('[win32] no SSID match found in netsh output');
    return { status: 'unavailable' };
  }

  const ssid = ssidMatch[1].trim().replace(/\r/g, '');
  const bssid = bssidMatch ? normalizeBssid(bssidMatch[1]) : null;
  if (!ssid) return { status: 'unavailable' };
  if (isRedacted(ssid) || isRedacted(bssid)) return { status: 'permission-denied' };

  wifiLog(`[win32] parsed ssid="${ssid}" bssid="${bssid ?? 'null'}"`);
  return { status: 'ok', wifi: { ssid, bssid } };
}

async function detectLinuxWifi(): Promise<WifiDetectionResult> {
  const { stdout } = await execFileAsync('nmcli', ['-t', '-f', 'active,ssid,bssid', 'dev', 'wifi'], { timeout: 8000 });
  const lines = stdout.split('\n').filter((l) => l.trim());

  for (const line of lines) {
    const parts = line.split(/(?<!\\):/);
    if (parts[0] === 'yes') {
      const ssid = (parts[1] || '').replace(/\\:/g, ':').trim();
      const bssid = (parts[2] || '').replace(/\\:/g, ':').trim() || null;
      if (!ssid) return { status: 'unavailable' };
      if (isRedacted(ssid) || isRedacted(bssid)) return { status: 'permission-denied' };
      return { status: 'ok', wifi: { ssid, bssid } };
    }
  }
  return { status: 'unavailable' };
}

function isRedacted(value: string | null | undefined): boolean {
  return !!value && value.trim().toLowerCase() === '<redacted>';
}
