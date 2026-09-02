import { ipcMain, dialog, app, BrowserWindow, shell } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import { IPC_CHANNELS, TunnelConfig, TunnelFormData, AppSettings, LogEntry, RdpViewState, UpdateInfo, HrmsSession, WifiStatusResult } from '../shared/types';
import { getTunnels, setTunnels, getSettings, setSettings, getAuthSession, setAuthSession, StoredAuthSession } from './store';
import { credentialStore } from './credentialStore';
import { TunnelManager } from './tunnelManager';
import { RdpViewManager } from './rdpViewManager';
import { resolveCloudflared } from './cloudflaredResolver';
import { getCombinedLogs, writeLog, getLogs } from './logger';
import { hrmsLogin, hrmsValidateWifi } from './hrmsClient';
import { detectWifi } from './wifiDetector';

const isWin = process.platform === 'win32';

const GH_REPO = 'RandomKid24/cloudflareRDB-gui';

function fetchLatestRelease(): Promise<{ tag_name: string; html_url: string } | null> {
  return new Promise((resolve) => {
    const req = require('https').get(
      {
        hostname: 'api.github.com',
        path: `/repos/${GH_REPO}/releases/latest`,
        headers: { 'User-Agent': 'TunnelGate', Accept: 'application/vnd.github+json' },
        timeout: 10000,
      },
      (res: any) => {
        let body = '';
        res.on('data', (chunk: Buffer) => (body += chunk.toString()));
        res.on('end', () => {
          try {
            const data = JSON.parse(body);
            if (data && data.tag_name) resolve({ tag_name: data.tag_name, html_url: data.html_url });
            else resolve(null);
          } catch {
            resolve(null);
          }
        });
      },
    );
    req.on('error', () => resolve(null));
    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });
  });
}

function parseVersion(v: string): number[] {
  const clean = String(v || '').trim().replace(/^v/i, '');
  const parts = clean.split('.');
  return [0, 1, 2].map((i) => parseInt(parts[i], 10) || 0);
}

function isNewerVersion(current: string, latest: string): boolean {
  const a = parseVersion(current);
  const b = parseVersion(latest);
  for (let i = 0; i < 3; i++) {
    if (b[i] > a[i]) return true;
    if (b[i] < a[i]) return false;
  }
  return false;
}

interface WifiCacheEntry {
  key: string;
  allowed: boolean;
  error: string | null;
  ts: number;
}

let wifiCache: WifiCacheEntry | null = null;
const WIFI_CACHE_TTL_MS = 45000;

function toPublicSession(session: StoredAuthSession): HrmsSession {
  return {
    baseUrl: session.baseUrl,
    username: session.username,
    employeeName: session.employeeName,
    loggedInAt: session.loggedInAt,
  };
}

async function checkWifiGate(): Promise<void> {
  const session = getAuthSession();
  if (!session) {
    throw new Error('Not logged in. Please sign in with your HRMS account first.');
  }

  let token: string;
  try {
    token = credentialStore.decrypt(session.encryptedToken);
  } catch {
    throw new Error('Your session has expired. Please log in again.');
  }

  const detection = await detectWifi();

  if (detection.status === 'permission-denied') {
    const hint = process.platform === 'darwin'
      ? 'TunnelGate needs Location access to read your WiFi network name — you should see a system permission prompt; click Allow. If you already denied it, re-enable it under System Settings → Privacy & Security → Location Services → TunnelGate, then try again.'
      : 'Your operating system is hiding your WiFi network name from TunnelGate. Check your WiFi/location privacy settings and try again.';
    throw new Error(`Could not verify your WiFi network. ${hint}`);
  }

  const wifi = detection.status === 'ok' ? detection.wifi : null;
  const cacheKey = `${wifi?.ssid ?? ''}|${wifi?.bssid ?? ''}`;
  writeLog('system', 'WiFi', 'info', `[gate] detection=${detection.status} ssid="${wifi?.ssid ?? ''}" bssid="${wifi?.bssid ?? ''}" cacheKey="${cacheKey}"`);

  if (wifiCache && wifiCache.key === cacheKey && Date.now() - wifiCache.ts < WIFI_CACHE_TTL_MS) {
    if (!wifiCache.allowed) {
      throw new Error(wifiCache.error || 'This WiFi network is not authorized for server access.');
    }
    return;
  }

  let allowed: boolean;
  let error: string | null;
  try {
    const result = await hrmsValidateWifi(session.baseUrl, token, wifi?.ssid ?? null, wifi?.bssid ?? null);
    allowed = result.allowed;
    error = result.error;
    writeLog('system', 'WiFi', 'info', `[gate] HRMS response: allowed=${allowed} matchedNetwork="${result.matchedNetwork}" error="${error}"`);
  } catch (err: any) {
    allowed = false;
    error = `Unable to verify network access: ${err.message}`;
    writeLog('system', 'WiFi', 'error', `[gate] HRMS error: ${err.message}`);
  }

  wifiCache = { key: cacheKey, allowed, error, ts: Date.now() };

  if (!allowed) {
    throw new Error(error || 'This WiFi network is not authorized for server access.');
  }
}

export function registerIpcHandlers(tunnelManager: TunnelManager, rdpViewManager?: RdpViewManager): void {
  ipcMain.handle(IPC_CHANNELS.AUTH_LOGIN, async (_event, baseUrl: string, username: string, password: string): Promise<HrmsSession> => {
    if (!credentialStore.isEncryptionAvailable()) {
      throw new Error('Encryption is not available on this system. Cannot store your session securely.');
    }

    const result = await hrmsLogin(baseUrl, username, password);
    const session: StoredAuthSession = {
      baseUrl: baseUrl.trim().replace(/\/+$/, ''),
      username: result.username,
      employeeName: result.employeeName,
      encryptedToken: credentialStore.encrypt(result.token),
      loggedInAt: new Date().toISOString(),
    };

    setAuthSession(session);
    wifiCache = null;
    return toPublicSession(session);
  });

  ipcMain.handle(IPC_CHANNELS.AUTH_LOGOUT, async () => {
    setAuthSession(null);
    wifiCache = null;
  });

  ipcMain.handle(IPC_CHANNELS.AUTH_GET_SESSION, async (): Promise<HrmsSession | null> => {
    const session = getAuthSession();
    return session ? toPublicSession(session) : null;
  });

  ipcMain.handle(IPC_CHANNELS.WIFI_GET_STATUS, async (_event, bypassCache?: boolean): Promise<WifiStatusResult> => {
    if (bypassCache) {
      wifiCache = null;
    }
    const session = getAuthSession();
    const detection = await detectWifi();

    if (detection.status === 'permission-denied') {
      return {
        status: 'permission-denied',
        ssid: null,
        bssid: null,
        allowed: false,
        matchedNetwork: null,
        error: process.platform === 'darwin'
          ? 'Location access is required to read your Wi-Fi network name on macOS.'
          : 'Your operating system is hiding your Wi-Fi network name.',
        platform: process.platform,
      };
    }

    if (detection.status === 'unavailable' || !detection.wifi?.ssid) {
      return {
        status: 'unavailable',
        ssid: null,
        bssid: null,
        allowed: false,
        matchedNetwork: null,
        error: 'No active Wi-Fi connection detected.',
        platform: process.platform,
      };
    }

    const wifi = detection.wifi;
    if (!session) {
      return {
        status: 'ok',
        ssid: wifi.ssid,
        bssid: wifi.bssid,
        allowed: false,
        matchedNetwork: null,
        error: 'Not logged in to HRMS.',
        platform: process.platform,
      };
    }

    let token: string;
    try {
      token = credentialStore.decrypt(session.encryptedToken);
    } catch {
      return {
        status: 'ok',
        ssid: wifi.ssid,
        bssid: wifi.bssid,
        allowed: false,
        matchedNetwork: null,
        error: 'Session expired. Please log in again.',
        platform: process.platform,
      };
    }

    const cacheKey = `${wifi.ssid}|${wifi.bssid ?? ''}`;
    if (!bypassCache && wifiCache && wifiCache.key === cacheKey && Date.now() - wifiCache.ts < WIFI_CACHE_TTL_MS) {
      return {
        status: 'ok',
        ssid: wifi.ssid,
        bssid: wifi.bssid,
        allowed: wifiCache.allowed,
        matchedNetwork: null,
        error: wifiCache.error,
        platform: process.platform,
      };
    }

    try {
      const result = await hrmsValidateWifi(session.baseUrl, token, wifi.ssid, wifi.bssid);
      wifiCache = { key: cacheKey, allowed: result.allowed, error: result.error, ts: Date.now() };
      return {
        status: 'ok',
        ssid: wifi.ssid,
        bssid: wifi.bssid,
        allowed: result.allowed,
        matchedNetwork: result.matchedNetwork,
        error: result.error,
        platform: process.platform,
      };
    } catch (err: any) {
      return {
        status: 'ok',
        ssid: wifi.ssid,
        bssid: wifi.bssid,
        allowed: false,
        matchedNetwork: null,
        error: `Unable to verify network: ${err.message}`,
        platform: process.platform,
      };
    }
  });

  ipcMain.handle(IPC_CHANNELS.TUNNELS_LIST, () => {
    return getTunnels();
  });

  ipcMain.handle('tunnels:get-logs', (_event, tunnelId?: string) => {
    return getLogs(tunnelId);
  });

  ipcMain.handle('tunnels:decrypt-password', async (_event, encryptedBase64: string) => {
    try {
      return credentialStore.decrypt(encryptedBase64);
    } catch {
      return '';
    }
  });

  ipcMain.handle(IPC_CHANNELS.TUNNELS_ADD, async (_event, data: TunnelFormData) => {
    if (!credentialStore.isEncryptionAvailable()) {
      throw new Error('Encryption is not available on this system. Cannot store credentials securely.');
    }

    const hostnameRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
    if (!hostnameRegex.test(data.hostname)) {
      throw new Error('Invalid hostname format');
    }

    const encryptedPassword = credentialStore.encrypt(data.password);

    const tunnel: TunnelConfig = {
      id: uuidv4(),
      name: data.name,
      hostname: data.hostname,
      port: data.port || 3389,
      username: data.username,
      encryptedPassword,
      rememberAfterSession: data.rememberAfterSession,
      createdAt: new Date().toISOString(),
    };

    const tunnels = getTunnels();
    tunnels.push(tunnel);
    setTunnels(tunnels);

    return tunnel;
  });

  ipcMain.handle(IPC_CHANNELS.TUNNELS_UPDATE, async (_event, data: TunnelConfig & { password?: string }) => {
    const tunnels = getTunnels();
    const index = tunnels.findIndex((t) => t.id === data.id);
    if (index === -1) throw new Error('Tunnel not found');

    const existing = tunnels[index];
    const updated = { ...existing, ...data };

    if (data.password) {
      updated.encryptedPassword = credentialStore.encrypt(data.password);
    } else {
      updated.encryptedPassword = existing.encryptedPassword;
    }

    delete (updated as any).password;

    tunnels[index] = updated;
    setTunnels(tunnels);
    return updated;
  });

  ipcMain.handle(IPC_CHANNELS.TUNNELS_DELETE, async (_event, tunnelId: string) => {
    await tunnelManager.disconnect(tunnelId);
    const tunnels = getTunnels().filter((t) => t.id !== tunnelId);
    setTunnels(tunnels);
  });

  ipcMain.handle(IPC_CHANNELS.TUNNEL_CONNECT, async (_event, tunnelId: string) => {
    await checkWifiGate();

    const tunnels = getTunnels();
    const config = tunnels.find((t) => t.id === tunnelId);
    if (!config) throw new Error('Tunnel not found');

    let password: string;
    try {
      password = credentialStore.decrypt(config.encryptedPassword);
    } catch {
      throw new Error('Failed to decrypt credentials. The stored password may be corrupted.');
    }

    await tunnelManager.connect(config, password);
  });

  ipcMain.handle(IPC_CHANNELS.TUNNEL_DISCONNECT, async (_event, tunnelId: string) => {
    await tunnelManager.disconnect(tunnelId);
  });

  ipcMain.handle(IPC_CHANNELS.TUNNELS_EXPORT_LOGS, async (_event, tunnelId?: string) => {
    const win = BrowserWindow.getFocusedWindow();
    if (!win) return;

    const result = await dialog.showSaveDialog(win, {
      title: 'Export Logs',
      defaultPath: `tunnelgate-logs-${Date.now()}.txt`,
      filters: [{ name: 'Text Files', extensions: ['txt'] }],
    });

    if (result.canceled || !result.filePath) return;

    const logs = getCombinedLogs();
    const filtered = tunnelId ? logs.filter((l) => l.tunnelId === tunnelId) : logs;

    const content = filtered
      .map((l) => `[${l.timestamp}] [${l.level.toUpperCase()}] [${l.tunnelName}] ${l.message}`)
      .join('\n');

    const { writeFile } = await import('fs/promises');
    await writeFile(result.filePath, content, 'utf-8');

    writeLog('export', 'Log Export', 'info', `Logs exported to ${result.filePath}`);
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, () => {
    return getSettings();
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS_SET, async (_event, settings: AppSettings) => {
    setSettings(settings);
    return getSettings();
  });

  ipcMain.handle(IPC_CHANNELS.APP_GET_VERSION, () => {
    return app.getVersion();
  });

  ipcMain.handle(IPC_CHANNELS.APP_CHECK_UPDATES, async (): Promise<UpdateInfo | null> => {
    const release = await fetchLatestRelease();
    if (!release) return null;
    const currentVersion = app.getVersion();
    const latestVersion = release.tag_name.replace(/^v/i, '');
    return {
      currentVersion,
      latestVersion,
      url: release.html_url,
      hasUpdate: isNewerVersion(currentVersion, latestVersion),
    };
  });

  ipcMain.handle(IPC_CHANNELS.APP_OPEN_EXTERNAL, (_event, url: string) => {
    if (typeof url === 'string' && /^https?:\/\//i.test(url)) {
      shell.openExternal(url);
    }
  });

  ipcMain.handle(IPC_CHANNELS.DIALOG_SELECT_FILE, async () => {
    const win = BrowserWindow.getFocusedWindow();
    if (!win) return null;

    const exts = isWin ? ['exe', 'cmd', 'bat'] : ['', 'sh'];
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      filters: [{ name: 'Executables', extensions: exts }],
    });

    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle(IPC_CHANNELS.RDP_AVAILABLE, () => {
    return rdpViewManager?.isAvailable() ?? { available: false, error: 'RDP view manager not initialized' };
  });

  ipcMain.handle(IPC_CHANNELS.RDP_VIEW_CONNECT, async (_event, tunnelId: string, width?: number, height?: number) => {
    if (!rdpViewManager) throw new Error('RDP view manager not initialized');
    await checkWifiGate();

    const tunnels = getTunnels();
    const config = tunnels.find((t) => t.id === tunnelId);
    if (!config) throw new Error('Tunnel not found');

    const tunnelState = tunnelManager.getRuntimeState(tunnelId);
    const port = tunnelState?.localPort;
    if (!port) throw new Error('Tunnel not connected — no local port');

    if (isWin) {
      await credentialStore.clearCredential(tunnelId, config.name, port, config.hostname).catch(() => {});
    }

    let password: string;
    try {
      password = credentialStore.decrypt(config.encryptedPassword);
    } catch {
      throw new Error('Failed to decrypt credentials');
    }

    if (isWin) {
      await credentialStore.injectCredential(tunnelId, config.name, config.username, password, port, config.hostname);
    }

    await rdpViewManager.connectView(tunnelId, port, config.username, password, config.hostname, width, height);
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.RDP_VIEW_UPDATE_PASSWORD, async (_event, tunnelId: string, newPassword: string, width?: number, height?: number) => {
    if (!rdpViewManager) throw new Error('RDP view manager not initialized');

    const tunnels = getTunnels();
    const config = tunnels.find((t) => t.id === tunnelId);
    if (!config) throw new Error('Tunnel not found');

    config.encryptedPassword = credentialStore.encrypt(newPassword);
    setTunnels(tunnels);

    const tunnelState = tunnelManager.getRuntimeState(tunnelId);
    const port = tunnelState?.localPort;
    if (!port) throw new Error('Tunnel not connected — no local port');

    if (isWin) {
      await credentialStore.injectCredential(tunnelId, config.name, config.username, newPassword, port, config.hostname);
    }

    rdpViewManager.disconnectView(tunnelId);
    await rdpViewManager.connectView(tunnelId, port, config.username, newPassword, config.hostname, width, height);
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.LAUNCH_NATIVE_CLIENT, async (_event, tunnelId: string) => {
    await checkWifiGate();

    // If the in-app FreeRDP viewer is still holding a live session on this
    // tunnel, tear it down before handing off to mstsc/native client. Many
    // target machines (a plain Windows 10/11 box, or a Server without the
    // RDS role licensed for multiple sessions) only support ONE remote
    // session at a time — launching mstsc while our own FreeRDP session is
    // still open collides with it and the server refuses the second
    // connection ("...you already have a console session in progress").
    // The brief pause gives the server time to actually release the slot;
    // disconnectView() closing our socket doesn't guarantee the server has
    // finished tearing the session down by the time it returns.
    if (rdpViewManager) {
      rdpViewManager.disconnectView(tunnelId);
      await new Promise((resolve) => setTimeout(resolve, 800));
    }

    tunnelManager.launchNativeClient(tunnelId);
  });

  ipcMain.handle(IPC_CHANNELS.RDP_VIEW_DISCONNECT, (_event, tunnelId: string) => {
    rdpViewManager?.disconnectView(tunnelId);
  });

  ipcMain.handle(IPC_CHANNELS.RDP_VIEW_MOUSE, (_event, tunnelId: string, flags: number, x: number, y: number) => {
    rdpViewManager?.sendPointerEvent(tunnelId, flags, x, y);
  });

  ipcMain.handle(IPC_CHANNELS.RDP_VIEW_KEYBOARD, (_event, tunnelId: string, flags: number, code: number) => {
    rdpViewManager?.sendKeyboardEvent(tunnelId, flags, code);
  });

  ipcMain.handle(IPC_CHANNELS.CHECK_CLOUDFLARED, async () => {
    const settings = getSettings();
    const resolved = await resolveCloudflared(settings.cloudflaredPath || undefined);
    if (resolved) {
      return { found: true, path: resolved.path, source: resolved.source };
    }
    return { found: false, path: null, source: null };
  });
}

export function sendStatusToRenderer(win: BrowserWindow | null, state: any): void {
  if (win && !win.isDestroyed()) {
    win.webContents.send(IPC_CHANNELS.TUNNEL_STATUS_CHANGE, state);
  }
}

export function sendLogToRenderer(win: BrowserWindow | null, tunnelId: string, tunnelName: string, level: string, message: string): void {
  if (win && !win.isDestroyed()) {
    win.webContents.send(IPC_CHANNELS.TUNNEL_LOG, { tunnelId, tunnelName, level, message });
  }
}
