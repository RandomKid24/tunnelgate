import { BrowserWindow, app, clipboard } from 'electron';
import path from 'path';
const isWin = process.platform === 'win32';
const isLinux = process.platform === 'linux';
import { writeLog } from './logger';
import { getTunnels, setTunnels } from './store';

interface RdpAddon {
  createSession(
    host: string, port: number,
    width: number, height: number,
    username: string, password: string,
    serverHostname: string,
    onBitmap: (x: number, y: number, w: number, h: number, buf: Buffer) => void,
    onEvent: (type: string, ...args: any[]) => void,
  ): number;
  destroySession(id: number): void;
  sendPointerEvent(id: number, flags: number, x: number, y: number): void;
  sendKeyboardEvent(id: number, flags: number, code: number): void;
  /** Present on builds compiled against FreeRDP 3 (clipboard redirection). */
  setClipboard?(id: number, text: string): void;
}

// Cap clipboard payloads pushed to the remote session. Plenty for text;
// keeps a pathological local clipboard from being shovelled over the channel.
const MAX_CLIPBOARD_BYTES = 256 * 1024;
const CLIPBOARD_POLL_MS = 500;

type RdpEventCallback = (tunnelId: string, event: string, ...args: any[]) => void;

const DEFAULT_WIDTH = 1280;
const DEFAULT_HEIGHT = 720;

const RETRYABLE_ERRORS = new Set([
  131085, // ERRCONNECT_CONNECT_TRANSPORT_FAILED
]);
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1500;

export class RdpViewManager {
  private addon: RdpAddon | null = null;
  private sessions = new Map<string, number>();
  private addonAvailable = false;
  private addonLoadError = '';
  private win: BrowserWindow | null = null;
  private onEvent: RdpEventCallback | null = null;
  private lastDimensions = new Map<string, { width: number; height: number }>();

  // Host <-> remote clipboard bridge. We poll the OS clipboard (Electron has no
  // change event) while any session is live, and push new text to every session.
  // `lastClipboardText` is the last value we've reconciled in either direction,
  // so neither side echoes the other's paste back into a loop.
  private clipboardPoll: NodeJS.Timeout | null = null;
  private lastClipboardText = '';

  constructor() {
    const fs = require('fs');
    const addonDir = app.isPackaged
      ? path.join(process.resourcesPath, 'rdp-addon')
      : path.join(__dirname, '..', '..', 'native', 'rdp-addon', 'build', 'Release');
    const addonPath = path.join(addonDir, 'rdp_addon.node');

    try {
      if (!fs.existsSync(addonPath)) {
        throw new Error(`Addon file not found at ${addonPath}`);
      }

      if (isWin) {
        process.env.PATH = `${addonDir};${process.env.PATH}`;

        const requiredDlls = ['msvcp140.dll', 'vcruntime140.dll', 'vcruntime140_1.dll'];
        const missing = requiredDlls.filter(dll => {
          const p = path.join(addonDir, dll);
          if (fs.existsSync(p)) return false;
          try { require(dll); return false; } catch { return true; }
        });
        if (missing.length > 0) {
          throw new Error(
            `Missing Visual C++ runtime DLLs in ${addonDir}:\n  ${missing.join('\n  ')}\n\n` +
            `These are required by the native RDP addon. Reinstall the application or ` +
            `install the Microsoft Visual C++ 2022 Redistributable.`
          );
        }

      }

      if (isLinux) {
        process.env.LD_LIBRARY_PATH = `${addonDir}:${process.env.LD_LIBRARY_PATH || ''}`;
      }

      this.addon = require(addonPath) as RdpAddon;
      this.addonAvailable = true;
      writeLog('rdp', 'RDP View', 'info', `Native RDP addon loaded from ${addonPath}`);
    } catch (err: any) {
      this.addonLoadError = `${err.message}\n${err.stack || ''}`;
      writeLog('rdp', 'RDP View', 'error',
        `Native RDP addon failed to load from ${addonPath}:\n${this.addonLoadError}`);
      this.addonAvailable = false;
    }
  }

  isAvailable(): { available: boolean; error?: string } {
    return { available: this.addonAvailable, error: this.addonLoadError || undefined };
  }

  setWindow(win: BrowserWindow | null) {
    this.win = win;
  }

  setEventCallback(cb: RdpEventCallback) {
    this.onEvent = cb;
  }

  async connectView(
    tunnelId: string,
    port: number,
    username: string,
    password: string,
    serverHostname?: string,
    width?: number,
    height?: number,
  ): Promise<boolean> {
    if (!this.addonAvailable || !this.addon) {
      const msg = 'Native RDP addon not available: ' + (this.addonLoadError || 'unknown error');
      writeLog(tunnelId, 'RDP View', 'error', msg);
      throw new Error(msg);
    }

    if (this.sessions.has(tunnelId)) {
      writeLog(tunnelId, 'RDP View', 'warn', 'Session already exists, destroying first');
      this.disconnectView(tunnelId);
    }

    const fs = require('fs');
    const userDataPath = app.getPath('userData');
    const logFilename = `freerdp-${tunnelId}.log`;
    const logFilePath = path.join(userDataPath, logFilename);

    // Truncate/clear the session-specific log file if it exists
    try {
      if (fs.existsSync(logFilePath)) {
        fs.writeFileSync(logFilePath, '', 'utf-8');
      }
    } catch (e: any) {
      writeLog(tunnelId, 'RDP View', 'warn', `Failed to truncate existing log file: ${e.message}`);
    }

    // Set environment variables before creating session
    process.env.WLOG_APPENDER = 'file';
    process.env.WLOG_FILEAPPENDER_OUTPUT_FILE_PATH = userDataPath;
    process.env.WLOG_FILEAPPENDER_OUTPUT_FILE_NAME = logFilename;
    process.env.WLOG_LEVEL = 'DEBUG';

    const startTime = Date.now();

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        // Use stored dimensions if not provided on reconnect
        if (width === undefined || height === undefined) {
          const stored = this.lastDimensions.get(tunnelId);
          width = stored?.width ?? DEFAULT_WIDTH;
          height = stored?.height ?? DEFAULT_HEIGHT;
        }

        const sessionId = this.addon.createSession(
          '127.0.0.1', port, width, height, username, password, serverHostname ?? '127.0.0.1',
          (x, y, w, h, buf) => {
            this.forwardFrame(tunnelId, x, y, w, h, buf);
          },
          (type, ...args) => {
            this.handleEvent(tunnelId, type, args);
          },
        );

        this.lastDimensions.set(tunnelId, { width, height });
        this.sessions.set(tunnelId, sessionId);
        this.startClipboardBridge();

        const elapsed = Date.now() - startTime;
        if (attempt > 1) {
          writeLog(tunnelId, 'RDP View', 'info',
            `RDP connected successfully after ${attempt - 1} retries (${elapsed}ms total)`);
        } else {
          writeLog(tunnelId, 'RDP View', 'info',
            `RDP session created (id=${sessionId}) at ${width}x${height}`);
        }
        return true;
      } catch (err: any) {
        const code: number | undefined = err.freerdpCode;

        if (code === undefined || !RETRYABLE_ERRORS.has(code) || attempt === MAX_RETRIES) {
          this.dumpNativeLogs(tunnelId);

          if (isWin && code === 131087) {
            writeLog(tunnelId, 'RDP View', 'warn',
              'FreeRDP on Windows reported password-expired (131087) — likely false positive due to NLA/SSPI. Treating as generic error.');
            throw new Error('Failed to create RDP session: RDP authentication failed (NLA compatibility issue). Try reconnecting or use the native client.');
          }

          const rawMsg = err.message || '';
          const msg = `Failed to create RDP session: ${rawMsg}\n${err.stack || ''}`;
          writeLog(tunnelId, 'RDP View', 'error', msg);
          throw new Error(msg);
        }

        writeLog(tunnelId, 'RDP View', 'warn',
          `RDP transport failed (${code}). Retry ${attempt}/${MAX_RETRIES} in ${RETRY_DELAY_MS}ms...`);
        await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
      }
    }

    throw new Error('RDP connection failed: exhausted all retry attempts');
  }

  disconnectView(tunnelId: string) {
    const sessionId = this.sessions.get(tunnelId);
    if (sessionId === undefined) return;

    try {
      this.addon?.destroySession(sessionId);
    } catch (err: any) {
      writeLog(tunnelId, 'RDP View', 'error', `Error destroying session: ${err.message}\n${err.stack || ''}`);
    }
    this.sessions.delete(tunnelId);
    if (this.sessions.size === 0) this.stopClipboardBridge();
    writeLog(tunnelId, 'RDP View', 'info', 'RDP session destroyed');

    if (this.onEvent) {
      this.onEvent(tunnelId, 'disconnected', 'Session closed');
    }
  }

  private forwardFrame(tunnelId: string, x: number, y: number, w: number, h: number, buf: Buffer) {
    if (!this.win || this.win.isDestroyed()) return;
    try {
      this.win.webContents.send('rdp:frame', tunnelId, { x, y, w, h }, buf);
    } catch {}
  }

  private handleEvent(tunnelId: string, type: string, args: any[]) {
    // Log the event to our main logger
    const firstArg = args[0] !== undefined ? String(args[0]) : '';
    if (type === 'error') {
      writeLog(tunnelId, 'RDP View', 'error', `RDP connection error: ${firstArg}`);
      this.dumpNativeLogs(tunnelId); // Dump logs on error event
    } else if (type === 'disconnected') {
      writeLog(tunnelId, 'RDP View', 'info', `RDP session disconnected: ${firstArg || 'Session closed'}`);
      this.dumpNativeLogs(tunnelId); // Dump logs on disconnect event
    } else if (type === 'resize') {
      const w = args[0];
      const h = args[1];
      this.lastDimensions.set(tunnelId, { width: w, height: h });
      writeLog(tunnelId, 'RDP View', 'info', `RDP session resized to ${w}x${h}`);
    } else if (type === 'clipboard') {
      // Remote session copied text — mirror it to the host OS clipboard.
      const text = typeof args[0] === 'string' ? args[0] : '';
      try {
        clipboard.writeText(text);
        // Read back so lastClipboardText matches exactly what the OS stored
        // (it may normalise line endings); otherwise the next poll would treat
        // it as a fresh local change and echo it back to the remote.
        this.lastClipboardText = clipboard.readText();
      } catch (err: any) {
        this.lastClipboardText = text;
        writeLog(tunnelId, 'RDP View', 'warn', `Failed to write host clipboard: ${err.message}`);
      }
      writeLog(tunnelId, 'RDP View', 'debug', `Clipboard: received ${text.length} chars from remote`);
      return; // don't forward clipboard contents to the renderer
    } else if (type === 'serverName') {
      writeLog(tunnelId, 'RDP View', 'info', `RDP server name detected: ${firstArg}`);
      const name = (firstArg || '').trim();
      if (name) {
        try {
          const tunnels = getTunnels();
          const index = tunnels.findIndex((t) => t.id === tunnelId);
          if (index !== -1 && tunnels[index].serverName !== name) {
            tunnels[index] = { ...tunnels[index], serverName: name };
            setTunnels(tunnels);
            writeLog(tunnelId, 'RDP View', 'info', `Saved detected server name "${name}" to tunnel settings`);
          }
        } catch (err: any) {
          writeLog(tunnelId, 'RDP View', 'error', `Failed to persist server name: ${err.message}`);
        }
      }
    } else {
      writeLog(tunnelId, 'RDP View', 'debug', `RDP session event [${type}]: ${firstArg}`);
    }

    if (!this.win || this.win.isDestroyed()) return;
    try {
      this.win.webContents.send('rdp:event', tunnelId, type, ...args);
    } catch {}
    if (this.onEvent) {
      this.onEvent(tunnelId, type, ...args);
    }
  }

  private dumpNativeLogs(tunnelId: string) {
    const fs = require('fs');
    const userDataPath = app.getPath('userData');
    const logFilePath = path.join(userDataPath, `freerdp-${tunnelId}.log`);

    try {
      if (fs.existsSync(logFilePath)) {
        const content = fs.readFileSync(logFilePath, 'utf-8');
        const lines = content.split('\n').filter((l: string) => l.trim().length > 0);
        // Take the last 40 lines
        const lastLines = lines.slice(-40);
        
        writeLog(tunnelId, 'FreeRDP Engine', 'info', `--- Native FreeRDP Logs (Last ${lastLines.length} lines) ---`);
        for (const line of lastLines) {
          let level: 'info' | 'warn' | 'error' | 'debug' = 'debug';
          const lowerLine = line.toLowerCase();
          if (lowerLine.includes('error') || lowerLine.includes('fail') || lowerLine.includes('reject')) {
            level = 'error';
          } else if (lowerLine.includes('warn')) {
            level = 'warn';
          } else if (lowerLine.includes('info')) {
            level = 'info';
          }
          
          writeLog(tunnelId, 'FreeRDP Engine', level, line.trim());
        }
        writeLog(tunnelId, 'FreeRDP Engine', 'info', `------------------------------------------------------`);
      }
    } catch (err: any) {
      writeLog(tunnelId, 'RDP Log Reader', 'error', `Failed to read native log file: ${err.message}`);
    }
  }

  sendPointerEvent(tunnelId: string, flags: number, x: number, y: number) {
    const sessionId = this.sessions.get(tunnelId);
    if (sessionId === undefined) return;
    try {
      this.addon?.sendPointerEvent(sessionId, flags, x, y);
    } catch (err: any) {
      writeLog(tunnelId, 'RDP View', 'error', `sendPointerEvent error: ${err.message}\n${err.stack || ''}`);
    }
  }

  sendKeyboardEvent(tunnelId: string, flags: number, code: number) {
    const sessionId = this.sessions.get(tunnelId);
    if (sessionId === undefined) return;
    try {
      this.addon?.sendKeyboardEvent(sessionId, flags, code);
    } catch (err: any) {
      writeLog(tunnelId, 'RDP View', 'error', `sendKeyboardEvent error: ${err.message}\n${err.stack || ''}`);
    }
  }

  private startClipboardBridge() {
    if (this.clipboardPoll) return;
    if (typeof this.addon?.setClipboard !== 'function') {
      writeLog('rdp', 'RDP View', 'info',
        'Clipboard redirection unavailable (addon built without FreeRDP 3 cliprdr support)');
      return;
    }

    // Seed empty so the first sync actually pushes the current clipboard to the
    // freshly connected session instead of treating it as "unchanged".
    this.lastClipboardText = '';
    this.syncClipboardFromHost();
    this.clipboardPoll = setInterval(() => this.syncClipboardFromHost(), CLIPBOARD_POLL_MS);

    writeLog('rdp', 'RDP View', 'info', 'Clipboard bridge started');
  }

  private syncClipboardFromHost() {
    if (this.sessions.size === 0 || typeof this.addon?.setClipboard !== 'function') return;
    let text: string;
    try {
      text = clipboard.readText();
    } catch {
      return;
    }
    if (text === this.lastClipboardText) return;
    if (Buffer.byteLength(text, 'utf8') > MAX_CLIPBOARD_BYTES) {
      writeLog('rdp', 'RDP View', 'debug',
        `Clipboard: host text too large (${text.length} chars), not syncing to remote`);
      this.lastClipboardText = text; // don't retry every tick
      return;
    }
    this.lastClipboardText = text;
    for (const sessionId of this.sessions.values()) {
      try {
        this.addon?.setClipboard?.(sessionId, text);
      } catch (err: any) {
        writeLog('rdp', 'RDP View', 'warn', `Clipboard push failed: ${err.message}`);
      }
    }
  }

  private stopClipboardBridge() {
    if (!this.clipboardPoll) return;
    clearInterval(this.clipboardPoll);
    this.clipboardPoll = null;
    this.lastClipboardText = '';
    writeLog('rdp', 'RDP View', 'info', 'Clipboard bridge stopped');
  }

  disconnectAll() {
    for (const tunnelId of this.sessions.keys()) {
      this.disconnectView(tunnelId);
    }
    this.stopClipboardBridge();
  }
}
