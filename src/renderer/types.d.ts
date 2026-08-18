import { TunnelConfig, TunnelRuntimeState, AppSettings, LogEntry, TunnelFormData, UpdateInfo, HrmsSession } from '../shared/types';

declare global {
  interface Window {
    pq?: {
      captureError: (data?: Record<string, unknown>) => Promise<unknown>;
      captureException: (err: unknown, data?: Record<string, unknown>) => Promise<unknown>;
      sendFeedback: (data?: Record<string, unknown>) => Promise<unknown>;
      createTicket: (data?: Record<string, unknown>) => Promise<unknown>;
    };
    cloudflareRdp: {
      auth: {
        login: (baseUrl: string, username: string, password: string) => Promise<HrmsSession>;
        logout: () => Promise<void>;
        getSession: () => Promise<HrmsSession | null>;
      };
      tunnels: {
        list: () => Promise<TunnelConfig[]>;
        add: (data: TunnelFormData) => Promise<TunnelConfig>;
        update: (tunnel: TunnelConfig) => Promise<TunnelConfig>;
        delete: (tunnelId: string) => Promise<void>;
        connect: (tunnelId: string) => Promise<void>;
        disconnect: (tunnelId: string) => Promise<void>;
        exportLogs: (tunnelId?: string) => Promise<void>;
        getLogs: (tunnelId?: string) => Promise<LogEntry[]>;
        onStatusChange: (callback: (state: TunnelRuntimeState) => void) => () => void;
        onLog: (callback: (entry: Omit<LogEntry, 'id' | 'timestamp'>) => void) => () => void;
        onTrayConnect: (callback: (tunnelId: string) => void) => () => void;
        decryptPassword: (encryptedBase64: string) => Promise<string>;
      };
      settings: {
        get: () => Promise<AppSettings>;
        set: (settings: AppSettings) => Promise<AppSettings>;
      };
      app: {
        getVersion: () => Promise<string>;
        checkForUpdates: () => Promise<UpdateInfo | null>;
        openExternal: (url: string) => void;
        selectFile: () => Promise<string | null>;
        checkCloudflared: () => Promise<{ found: boolean; path: string | null }>;
      };
      rdp: {
        isAvailable: () => Promise<{ available: boolean; error?: string }>;
        launchNativeClient: (tunnelId: string) => Promise<void>;
        connect: (tunnelId: string, width?: number, height?: number) => Promise<boolean>;
        disconnect: (tunnelId: string) => Promise<void>;
        sendMouse: (tunnelId: string, flags: number, x: number, y: number) => void;
        sendKeyboard: (tunnelId: string, flags: number, code: number) => void;
        onFrame: (callback: (tunnelId: string, rect: { x: number; y: number; w: number; h: number }, buf: ArrayBuffer) => void) => () => void;
        onEvent: (callback: (tunnelId: string, type: string, ...args: any[]) => void) => () => void;
        updatePassword: (tunnelId: string, newPassword: string, width?: number, height?: number) => Promise<boolean>;
      };
    };
  }
}

export {};
