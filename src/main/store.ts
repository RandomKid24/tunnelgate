import Store from 'electron-store';
import { TunnelConfig, AppSettings } from '../shared/types';

export interface WindowBounds {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export interface StoredAuthSession {
  baseUrl: string;
  username: string;
  employeeName?: string;
  encryptedToken: string;
  loggedInAt: string;
}

interface Schema {
  tunnels: TunnelConfig[];
  settings: AppSettings;
  windowBounds: WindowBounds;
  auth: StoredAuthSession | null;
}

const DEFAULT_SETTINGS: AppSettings = {
  cloudflaredPath: '',
  launchOnStartup: false,
  startMinimizedToTray: false,
  autoReconnectAttempts: 3,
  forgetPasswordAfterSession: true,
};

export const store = new Store<Schema>({
  name: 'tunnelgate-config',
  schema: {
    tunnels: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          hostname: { type: 'string' },
          port: { type: 'number', default: 3389 },
          username: { type: 'string' },
          encryptedPassword: { type: 'string' },
          rememberAfterSession: { type: 'boolean' },
          createdAt: { type: 'string' },
          lastConnectedAt: { type: 'string' },
          serverName: { type: 'string' },
        },
        required: ['id', 'name', 'hostname', 'username', 'encryptedPassword', 'rememberAfterSession', 'createdAt'],
      },
    },
    settings: {
      type: 'object',
      default: DEFAULT_SETTINGS,
    },
    windowBounds: {
      type: 'object',
      properties: {
        x: { type: 'number' },
        y: { type: 'number' },
        width: { type: 'number' },
        height: { type: 'number' },
      },
      default: {},
    },
    auth: {
      type: ['object', 'null'],
      default: null,
    },
  },
  defaults: {
    tunnels: [],
    settings: DEFAULT_SETTINGS,
    windowBounds: {},
    auth: null,
  },
});

export function getTunnels(): TunnelConfig[] {
  return store.get('tunnels', []);
}

export function setTunnels(tunnels: TunnelConfig[]): void {
  store.set('tunnels', tunnels);
}

export function getWindowBounds(): { x: number; y: number; width: number; height: number } | undefined {
  const b = store.get('windowBounds') as WindowBounds | undefined;
  if (!b || !b.width || !b.height || b.x === undefined || b.y === undefined) return undefined;
  return { x: b.x, y: b.y, width: b.width, height: b.height };
}

export function setWindowBounds(bounds: WindowBounds): void {
  store.set('windowBounds', bounds);
}

export function getSettings(): AppSettings {
  return store.get('settings', DEFAULT_SETTINGS);
}

export function setSettings(settings: AppSettings): void {
  store.set('settings', settings);
  if ('launchOnStartup' in settings) {
    const { app } = require('electron');
    app.setLoginItemSettings({ openAtLogin: settings.launchOnStartup });
  }
}

export function getAuthSession(): StoredAuthSession | null {
  return store.get('auth', null);
}

export function setAuthSession(session: StoredAuthSession | null): void {
  store.set('auth', session);
}
