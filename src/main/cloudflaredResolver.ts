import path from 'path';
import { app } from 'electron';
import { access } from 'fs/promises';
import { execFileSync } from 'child_process';

const isWin = process.platform === 'win32';
const isMac = process.platform === 'darwin';

export type CloudflaredSource = 'settings' | 'bundled' | 'system-dir' | 'path';

export interface ResolvedCloudflared {
  path: string;
  source: CloudflaredSource;
}

export function cloudflaredBinName(): string {
  return isWin ? 'cloudflared.exe' : 'cloudflared';
}

/**
 * Where the copy of cloudflared we ship with the app lives.
 * Packaged: alongside the other extraResources in the platform resource dir.
 * Dev:      the repo's resources/ folder (populated by scripts/fetch-cloudflared.js).
 */
export function bundledCloudflaredPath(): string {
  const bin = cloudflaredBinName();
  if (app.isPackaged) {
    return path.join(process.resourcesPath, bin);
  }
  return path.join(app.getAppPath(), 'resources', bin);
}

function systemDirCandidates(): string[] {
  const bin = cloudflaredBinName();
  if (isWin) {
    return [
      (process.env.LOCALAPPDATA || '') + '\\cloudflared\\' + bin,
      (process.env.PROGRAMFILES || 'C:\\Program Files') + '\\cloudflared\\' + bin,
      (process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)') + '\\cloudflared\\' + bin,
    ];
  }
  if (isMac) {
    return ['/opt/homebrew/bin/' + bin, '/usr/local/bin/' + bin];
  }
  return ['/usr/local/bin/' + bin, '/usr/bin/' + bin];
}

async function exists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

function lookupOnPath(): string | null {
  const bin = cloudflaredBinName();
  try {
    const cmd = isWin ? 'where' : 'which';
    const out = execFileSync(cmd, [bin], { encoding: 'utf-8', timeout: 3000 });
    const first = out.split('\n')[0].trim();
    return first || null;
  } catch {
    return null;
  }
}

/**
 * Single source of truth for locating cloudflared, used by both the tunnel
 * spawner and the Settings "Cloudflared" status readout.
 *
 * Priority: an explicit path the user set in Settings always wins; otherwise the
 * binary bundled with the app is preferred (it's the version we test against),
 * then a system-wide install, then anything on PATH.
 */
export async function resolveCloudflared(explicitPath?: string): Promise<ResolvedCloudflared | null> {
  if (explicitPath && (await exists(explicitPath))) {
    return { path: explicitPath, source: 'settings' };
  }

  const bundled = bundledCloudflaredPath();
  if (await exists(bundled)) {
    return { path: bundled, source: 'bundled' };
  }

  for (const p of systemDirCandidates()) {
    if (await exists(p)) {
      return { path: p, source: 'system-dir' };
    }
  }

  const onPath = lookupOnPath();
  if (onPath) {
    return { path: onPath, source: 'path' };
  }

  return null;
}
