import { ChildProcess, spawn } from 'child_process';
import { createServer } from 'net';
import treeKill from 'tree-kill';
import { TunnelConfig, TunnelRuntimeState, TunnelStatus } from '../shared/types';
import { writeLog } from './logger';
import { credentialStore } from './credentialStore';
import { getSettings } from './store';
import { resolveCloudflared } from './cloudflaredResolver';

const isWin = process.platform === 'win32';
const isMac = process.platform === 'darwin';

// Ask the OS for any free loopback port (port 0) so the tunnel never collides
// with a local RDP listener on 3389 or another running tunnel.
function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as any).port;
      server.close(() => resolve(port));
    });
  });
}

interface ManagedTunnel {
  config: TunnelConfig;
  state: TunnelRuntimeState;
  proc?: ChildProcess;
  reconnectAttempts: number;
  disconnectRequested: boolean;
  password?: string;
  spawnFailed: boolean;
  stderrBuffer: string;
  stdoutBuffer: string;
}

// Everything the platform RDP client (mstsc / Microsoft Remote Desktop /
// xfreerdp) needs to dial a session. `connectHost`/`connectPort` are the
// address the client actually dials — the local cloudflared port for tunneled
// servers, or the real host:port for direct (superuser-added) servers.
export interface NativeClientTarget {
  id: string;
  name: string;
  username: string;
  password: string;
  connectHost: string;
  connectPort: number;
}

type StatusCallback = (state: TunnelRuntimeState) => void;
type LogCallback = (tunnelId: string, tunnelName: string, level: 'info' | 'warn' | 'error' | 'debug', message: string) => void;

export class TunnelManager {
  private registry = new Map<string, ManagedTunnel>();
  private onStatusChange: StatusCallback;
  private onLog: LogCallback;

  constructor(onStatusChange: StatusCallback, onLog: LogCallback) {
    this.onStatusChange = onStatusChange;
    this.onLog = onLog;
  }

  private emitStatus(tunnel: ManagedTunnel): void {
    this.onStatusChange({ ...tunnel.state });
  }

  private setStatus(tunnel: ManagedTunnel, status: TunnelStatus, error?: string): void {
    tunnel.state.status = status;
    tunnel.state.lastError = error;
    tunnel.state.capturedOutput = tunnel.stderrBuffer;
    this.emitStatus(tunnel);
  }

  private async findCloudflared(): Promise<string | null> {
    const settings = getSettings();
    const resolved = await resolveCloudflared(settings.cloudflaredPath || undefined);
    if (resolved) {
      writeLog('system', 'findCloudflared', 'debug',
        `Using cloudflared (${resolved.source}): ${resolved.path}`);
      return resolved.path;
    }
    return null;
  }

  async connect(config: TunnelConfig, password: string): Promise<void> {
    if (this.registry.has(config.id)) {
      const existing = this.registry.get(config.id)!;
      if (existing.state.status === 'connected' || existing.state.status === 'connecting') {
        writeLog(config.id, config.name, 'warn', 'Tunnel already active');
        return;
      }
      this.registry.delete(config.id);
    }

    const tunnel: ManagedTunnel = {
      config,
      state: {
        tunnelId: config.id,
        status: 'connecting',
      },
      reconnectAttempts: 0,
      disconnectRequested: false,
      password,
      spawnFailed: false,
      stderrBuffer: '',
      stdoutBuffer: '',
    };

    this.registry.set(config.id, tunnel);
    this.setStatus(tunnel, 'connecting');

    try {
      await this.startProcess(tunnel);
    } catch (err: any) {
      this.setStatus(tunnel, 'error', err.message);
      writeLog(config.id, config.name, 'error', `Failed to start: ${err.message}`);
    }
  }

  private async startProcess(tunnel: ManagedTunnel): Promise<void> {
    const config = tunnel.config;
    const port = await findFreePort();
    tunnel.state.localPort = port;
    writeLog(config.id, config.name, 'info', `Selected free local port automatically: ${port}`);

    const cloudflaredPath = await this.findCloudflared();
    writeLog(config.id, config.name, 'debug', `Resolved cloudflared path: ${cloudflaredPath ?? '(null)'}`);

    if (!cloudflaredPath) {
      const msg = `cloudflared not found. It normally ships bundled inside TunnelGate — this install may be damaged. Reinstall the app, or set a cloudflared path manually in Settings.`;
      writeLog(config.id, config.name, 'error', msg);
      this.setStatus(tunnel, 'error', msg);
      return;
    }

    const args = [
      'access', 'tcp',
      '--hostname', config.hostname,
      '--url', `127.0.0.1:${port}`,
      '--loglevel', 'debug',
    ];

    writeLog(config.id, config.name, 'debug', `Spawning: ${JSON.stringify(cloudflaredPath)} with argv: ${JSON.stringify(args)}`);

    const proc = spawn(cloudflaredPath, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    tunnel.proc = proc;
    tunnel.state.pid = proc.pid;
    writeLog(config.id, config.name, 'debug', `child_process.pid = ${proc.pid}`);

    proc.stdout?.on('data', (data: Buffer) => {
      const text = data.toString();
      tunnel.stdoutBuffer += text;
      this.parseOutput(tunnel, text);
      tunnel.state.capturedOutput = tunnel.stderrBuffer;
      this.emitStatus(tunnel);
    });

    proc.stderr?.on('data', (data: Buffer) => {
      const text = data.toString();
      tunnel.stderrBuffer += text;
      this.parseOutput(tunnel, text);
      tunnel.state.capturedOutput = tunnel.stderrBuffer;
      this.emitStatus(tunnel);
    });

    proc.on('error', (err: NodeJS.ErrnoException) => {
      tunnel.spawnFailed = true;
      const summary = [
        `child_process 'error' event — code=${err.code}, errno=${err.errno}, syscall=${err.syscall}`,
        `message: ${err.message}`,
        `resolved binary path: ${cloudflaredPath}`,
      ].join(' | ');
      writeLog(config.id, config.name, 'error', summary);
      this.setStatus(tunnel, 'error', `Failed to launch cloudflared: ${err.message} (${err.code})`);

      if (!tunnel.disconnectRequested) {
        this.registry.delete(config.id);
      }
    });

    proc.on('close', (code, signal) => {
      writeLog(config.id, config.name, 'debug',
        `child_process 'close' event — code=${code}, signal=${signal}`
      );

      if (tunnel.spawnFailed) {
        writeLog(config.id, config.name, 'debug', 'Spawn already failed — ignoring close event');
        return;
      }

      const capturedStderr = tunnel.stderrBuffer ? `stderr:\n${tunnel.stderrBuffer}` : '(no stderr captured)';
      const capturedStdout = tunnel.stdoutBuffer ? `stdout:\n${tunnel.stdoutBuffer}` : '(no stdout captured)';

      if (code !== 0) {
        writeLog(config.id, config.name, 'error',
          `Process exited with code=${code}, signal=${signal}\n${capturedStderr}\n${capturedStdout}`
        );
      } else {
        writeLog(config.id, config.name, 'info',
          `Process exited cleanly (code=${code})\n${capturedStderr}\n${capturedStdout}`
        );
      }

      if (!tunnel.disconnectRequested) {
        this.handleUnexpectedDisconnect(tunnel, code, signal, capturedStderr);
      } else {
        this.setStatus(tunnel, 'disconnected');
        this.registry.delete(config.id);
      }
    });

    if (tunnel.spawnFailed) {
      writeLog(config.id, config.name, 'debug', 'Spawn failed before waitForReady — skipping');
      return;
    }

    const ready = await this.waitForReady(tunnel);
    if (tunnel.spawnFailed) {
      writeLog(config.id, config.name, 'debug', 'Spawn failed during waitForReady — skipping ready handler');
      return;
    }
    if (ready) {
      await this.handleReady(tunnel);
    }
  }

  private parseOutput(tunnel: ManagedTunnel, text: string): void {
    const lines = text.split('\n').filter((l) => l.trim());

    for (const line of lines) {
      const trimmed = line.trim();
      let level: 'info' | 'warn' | 'error' | 'debug' = 'info';

      if (/error|fail|refused|denied|timeout/i.test(trimmed)) {
        level = 'error';
      } else if (/warn|caution/i.test(trimmed)) {
        level = 'warn';
      } else if (/debug|trace/i.test(trimmed)) {
        level = 'debug';
      }

      this.onLog(tunnel.config.id, tunnel.config.name, level, trimmed);
    }
  }

  private async waitForReady(tunnel: ManagedTunnel): Promise<boolean> {
    if (tunnel.spawnFailed) return false;

    const hasExistingOutput = tunnel.stderrBuffer || tunnel.stdoutBuffer;
    if (hasExistingOutput) {
      const combined = tunnel.stdoutBuffer + '\n' + tunnel.stderrBuffer;
      if (this.isReadyMessage(combined)) return true;
      if (this.isErrorMessage(combined)) {
        writeLog(tunnel.config.id, tunnel.config.name, 'error', `Initial output indicates error:\n${combined}`);
        this.setStatus(tunnel, 'error', this.humanReadableError(combined));
        return false;
      }
    }

    return new Promise((resolve) => {
      let settled = false;

      const done = (result: boolean) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(result);
      };

      const timeout = setTimeout(() => {
        const capturedStderr = tunnel.stderrBuffer || '(none)';
        writeLog(tunnel.config.id, tunnel.config.name, 'error', `Tunnel connection timed out after 30s.\nCaptured stderr:\n${capturedStderr}`);
        const errorMsg = tunnel.stderrBuffer
          ? 'Connection timed out — cloudflared output:\n' + this.humanReadableError(tunnel.stderrBuffer)
          : 'Connection timed out — check tunnel hostname and network';
        this.setStatus(tunnel, 'error', errorMsg);
        done(false);
      }, 30000);

      const onData = () => {
        const combined = tunnel.stderrBuffer + '\n' + tunnel.stdoutBuffer;
        if (this.isReadyMessage(combined)) {
          done(true);
          return;
        }
        if (this.isErrorMessage(combined)) {
          writeLog(tunnel.config.id, tunnel.config.name, 'error', `Tunnel error detected in output:\n${combined}`);
          this.setStatus(tunnel, 'error', this.humanReadableError(combined));
          done(false);
        }
      };

      const onSpawnError = () => {
        writeLog(tunnel.config.id, tunnel.config.name, 'debug', 'waitForReady: spawn error detected, aborting');
        done(false);
      };

      const onClose = (code: number | null) => {
        writeLog(tunnel.config.id, tunnel.config.name, 'debug', `waitForReady: process closed with code=${code} before ready signal`);
        if (code !== 0) {
          const stderr = tunnel.stderrBuffer || '(no stderr)';
          this.setStatus(tunnel, 'error', `Process exited (code=${code}) before tunnel ready. Stderr:\n${stderr}`);
        }
        done(false);
      };

      const cleanup = () => {
        clearTimeout(timeout);
        tunnel.proc?.stdout?.removeListener('data', onData);
        tunnel.proc?.stderr?.removeListener('data', onData);
        tunnel.proc?.removeListener('error', onSpawnError);
        tunnel.proc?.removeListener('close', onClose);
      };

      tunnel.proc?.stdout?.on('data', onData);
      tunnel.proc?.stderr?.on('data', onData);
      tunnel.proc?.on('error', onSpawnError);
      tunnel.proc?.on('close', onClose);
    });
  }

  private isReadyMessage(text: string): boolean {
    return /ready|listening|connection registered|Started serving|Start Websocket listener/i.test(text);
  }

  private isErrorMessage(text: string): boolean {
    return /error|fail(ed|ure)?|refused|denied|not found|timed out|econnrefused|enoent/i.test(text);
  }

  private humanReadableError(text: string): string {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const errorLines = lines.filter(l => /ERR\s|error|fail|refused|denied|timeout|fatal|could not|unable to/i.test(l));
    if (errorLines.length > 0) {
      const relevant = errorLines[0];
      return relevant.length > 500 ? relevant.substring(0, 500) + '...' : relevant;
    }
    return text.trim().substring(0, 500);
  }

  private async handleReady(tunnel: ManagedTunnel): Promise<void> {
    this.setStatus(tunnel, 'connected');
    writeLog(tunnel.config.id, tunnel.config.name, 'info', `Tunnel ready on localhost:${tunnel.state.localPort}`);
  }

  /**
   * Hand the session off to the platform's native RDP client (mstsc /
   * Microsoft Remote Desktop / xfreerdp). Used by the "Open Native Client"
   * toolbar action, which must work whether or not the in-app viewer is up,
   * so it takes an explicit target instead of relying on a running tunnel.
   * Resolves once the client has been handed off; rejects with a message
   * safe to show the user when the platform client is missing or fails.
   */
  launchNativeClientFor(target: NativeClientTarget): Promise<void> {
    if (target.connectHost === '127.0.0.1') {
      credentialStore.injectCredential(
        target.id,
        target.name,
        target.username,
        target.password,
        target.connectPort,
        target.connectHost,
      ).catch((err: any) => {
        writeLog(target.id, target.name, 'error', `Credential injection failed: ${err.message}`);
      });
    } else {
      // Direct server: mstsc dials the real host, so a 127.0.0.1-keyed
      // credential entry would never match. The client prompts instead.
      writeLog(target.id, target.name, 'info',
        'Direct server — skipping credential injection; the RDP client will prompt for credentials.');
    }

    return this.launchRdpClient(target);
  }

  launchNativeClient(tunnelId: string): Promise<void> {
    const tunnel = this.registry.get(tunnelId);
    if (!tunnel) {
      return Promise.reject(new Error('No active tunnel for this server. Connect once to start it, then open the native client.'));
    }
    if (!tunnel.state.localPort) {
      return Promise.reject(new Error('The tunnel has no local port yet — it may still be starting. Try again in a moment.'));
    }
    if (!tunnel.password) {
      return Promise.reject(new Error('No password is available for this session. Reconnect with your password first.'));
    }

    return this.launchNativeClientFor({
      id: tunnel.config.id,
      name: tunnel.config.name,
      username: tunnel.config.username,
      password: tunnel.password,
      connectHost: '127.0.0.1',
      connectPort: tunnel.state.localPort,
    });
  }

  private launchRdpClient(target: NativeClientTarget): Promise<void> {
    if (isWin) return this.launchMstsc(target);
    if (isMac) return this.launchMacRdp(target);
    return this.launchLinuxRdp(target);
  }

  private launchMstsc(target: NativeClientTarget): Promise<void> {
    const address = `${target.connectHost}:${target.connectPort}`;
    writeLog(target.id, target.name, 'info', `Launching: mstsc.exe /v:${address}`);

    return new Promise<void>((resolve, reject) => {
      const proc = spawn('mstsc.exe', [`/v:${address}`], {
        stdio: 'ignore',
        windowsHide: false,
      });

      proc.on('spawn', () => {
        writeLog(target.id, target.name, 'info', 'RDP session window opened');
        resolve();
      });

      proc.on('error', (err) => {
        writeLog(target.id, target.name, 'error', `Failed to launch mstsc: ${err.message}`);
        writeLog(target.id, target.name, 'info', `Manual connection: ${address}`);
        reject(new Error(`Could not start mstsc (${err.message}). Connect manually to ${address}.`));
      });

      proc.on('close', () => {
        writeLog(target.id, target.name, 'info', 'RDP session window closed');
        if (getSettings().forgetPasswordAfterSession) {
          credentialStore.clearCredential(target.id, target.name, target.connectPort, target.connectHost);
        }
      });
    });
  }

  private launchMacRdp(target: NativeClientTarget): Promise<void> {
    const address = `${target.connectHost}:${target.connectPort}`;
    writeLog(target.id, target.name, 'info', `Launching Microsoft Remote Desktop for ${address}`);

    return new Promise<void>((resolve, reject) => {
      const proc = spawn('open', [
        '-b', 'com.microsoft.rdc.macos',
        '--args',
        `full address:s:${address}`,
        `username:s:${target.username}`,
      ], { stdio: 'ignore' });

      proc.on('error', (err) => {
        reject(new Error(
          `Could not open Microsoft Remote Desktop (${err.message}). Install it from the App Store, then connect manually to ${address} as ${target.username}.`
        ));
      });

      // `open` exits non-zero (without a spawn error) when the bundle is
      // missing, so the exit code — not the error event — is the real signal.
      proc.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(
            `Microsoft Remote Desktop is not installed (or did not open). Install it from the App Store, then connect manually to ${address} as ${target.username}.`
          ));
          return;
        }
        writeLog(target.id, target.name, 'info', 'Microsoft Remote Desktop opened');
        resolve();
      });
    });
  }

  private async launchLinuxRdp(target: NativeClientTarget): Promise<void> {
    const address = `${target.connectHost}:${target.connectPort}`;
    const clients: [string, string[]][] = [
      ['xfreerdp', [`/v:${address}`, `/u:${target.username}`, `/p:${target.password}`, '/dynamic-resolution', '+fonts']],
      ['remmina', ['--connect', `rdp://${target.username}@${address}`]],
    ];

    for (const [client, args] of clients) {
      const launched = await new Promise<boolean>((resolve) => {
        let settled = false;
        const done = (ok: boolean) => { if (!settled) { settled = true; resolve(ok); } };

        let proc: ChildProcess;
        try {
          proc = spawn(client, args, { stdio: 'ignore' });
        } catch {
          done(false);
          return;
        }

        proc.on('spawn', () => {
          writeLog(target.id, target.name, 'info', `Launched ${client} for ${address}`);
          done(true);
        });
        proc.on('error', () => done(false));
        proc.on('close', (code) => {
          if (code !== 0) {
            writeLog(target.id, target.name, 'info',
              `${client} exited with code ${code}. Try connecting manually: ${address}`
            );
          }
        });
      });

      if (launched) return;
    }

    const msg = `No RDP client found. Install xfreerdp or Remmina, or connect manually to ${address} as ${target.username}.`;
    writeLog(target.id, target.name, 'info', msg);
    throw new Error(msg);
  }

  private async handleUnexpectedDisconnect(
    tunnel: ManagedTunnel,
    code: number | null,
    signal: string | null,
    capturedStderr: string
  ): Promise<void> {
    const settings = getSettings();

    if (tunnel.reconnectAttempts >= settings.autoReconnectAttempts) {
      writeLog(tunnel.config.id, tunnel.config.name, 'error', 'Max reconnection attempts reached');
      this.setStatus(tunnel, 'error', `Max reconnection attempts reached. Last exit: code=${code}, signal=${signal}. Stderr: ${capturedStderr.substring(0, 500)}`);
      return;
    }

    tunnel.reconnectAttempts++;
    tunnel.state.status = 'reconnecting';
    this.emitStatus(tunnel);
    writeLog(
      tunnel.config.id,
      tunnel.config.name,
      'warn',
      `Process exited (code=${code}, signal=${signal}). Reconnecting attempt ${tunnel.reconnectAttempts}/${settings.autoReconnectAttempts}...`
    );

    const delay = Math.min(1000 * Math.pow(2, tunnel.reconnectAttempts - 1), 15000);
    await new Promise((r) => setTimeout(r, delay));

    try {
      tunnel.spawnFailed = false;
      tunnel.stderrBuffer = '';
      tunnel.stdoutBuffer = '';
      await this.startProcess(tunnel);
    } catch (err: any) {
      writeLog(tunnel.config.id, tunnel.config.name, 'error', `Reconnect failed: ${err.message}`);
      this.setStatus(tunnel, 'error', err.message);
    }
  }

  async disconnect(tunnelId: string): Promise<void> {
    const tunnel = this.registry.get(tunnelId);
    if (!tunnel) return;

    tunnel.disconnectRequested = true;
    writeLog(tunnel.config.id, tunnel.config.name, 'info', 'Disconnecting tunnel...');

    if (tunnel.proc?.pid) {
      await new Promise<void>((resolve) => {
        treeKill(tunnel.proc!.pid!, 'SIGTERM', (err) => {
          if (err) {
            writeLog(tunnel.config.id, tunnel.config.name, 'error', `Failed to kill process: ${err.message}`);
          }
          resolve();
        });
      });
    }

    if (tunnel.state.localPort && getSettings().forgetPasswordAfterSession) {
      await credentialStore.clearCredential(tunnel.config.id, tunnel.config.name, tunnel.state.localPort, tunnel.config.hostname);
    }

    this.setStatus(tunnel, 'disconnected');
    this.registry.delete(tunnelId);
  }

  disconnectAll(): void {
    for (const [id] of this.registry) {
      this.disconnect(id).catch(() => {});
    }
  }

  getRuntimeState(tunnelId: string): TunnelRuntimeState | undefined {
    return this.registry.get(tunnelId)?.state;
  }

  getAllRuntimeStates(): TunnelRuntimeState[] {
    return Array.from(this.registry.values()).map((t) => t.state);
  }

  getActiveTunnelCount(): number {
    let count = 0;
    for (const [, t] of this.registry) {
      if (t.state.status === 'connected') count++;
    }
    return count;
  }
}
