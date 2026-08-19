import './bootstrap';
import { app, BrowserWindow, screen, ipcMain } from 'electron';
import path from 'path';
import { IPC_CHANNELS, DisplayInfo } from '../shared/types';
import { PQClient } from 'pq-befu';
import { pqElectronMain } from 'pq-befu/integrations/electron';
import { TunnelManager } from './tunnelManager';
import { RdpViewManager } from './rdpViewManager';
import { registerIpcHandlers, sendStatusToRenderer, sendLogToRenderer } from './ipcHandlers';
import { writeLog } from './logger';
import { getSettings, getWindowBounds, setWindowBounds } from './store';

const pq = new PQClient({
  apiKey: process.env.PQ_API_KEY || '02b1dbc99a3dbf8165603651634496e9aabb496e5ef94a14c6169baa7916b3df',
  baseUrl: process.env.PQ_BASE_URL || 'http://localhost:8000',
});
pqElectronMain(pq, { environment: process.env.NODE_ENV || 'development' });

process.on('uncaughtException', (error) => {
  writeLog('system', 'System', 'error', `Uncaught Exception: ${error.message}\n${error.stack || ''}`);
});

process.on('unhandledRejection', (reason: any) => {
  writeLog('system', 'System', 'error', `Unhandled Rejection: ${reason?.message || reason}\n${reason?.stack || ''}`);
});

let mainWindow: BrowserWindow | null = null;
let tunnelManager: TunnelManager | null = null;
let rdpViewManager: RdpViewManager | null = null;
let isQuitting = false;

function getValidWindowBounds(): { x: number; y: number; width: number; height: number } | null {
  const saved = getWindowBounds();
  if (!saved) return null;

  const visibleOnSomeDisplay = screen.getAllDisplays().some((display) => {
    const area = display.workArea;
    const right = saved.x + saved.width;
    const bottom = saved.y + saved.height;
    return right > area.x && saved.x < area.x + area.width && bottom > area.y && saved.y < area.y + area.height;
  });

  if (!visibleOnSomeDisplay) return null;
  return saved;
}

function createMainWindow(): void {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const bounds = getValidWindowBounds();
  const windowOptions: Electron.BrowserWindowConstructorOptions = {
    minWidth: 900,
    minHeight: 600,
    title: 'TunnelGate',
    icon: path.join(__dirname, '../../resources/icons/icon.ico'),
    show: !getSettings().startMinimizedToTray,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  };

  if (bounds) {
    windowOptions.x = bounds.x;
    windowOptions.y = bounds.y;
    windowOptions.width = bounds.width;
    windowOptions.height = bounds.height;
  } else {
    windowOptions.width = Math.min(1000, width);
    windowOptions.height = Math.min(700, height);
  }

  mainWindow = new BrowserWindow(windowOptions);

  rdpViewManager?.setWindow(mainWindow);

  if (process.env.NODE_ENV === 'development' || process.argv.includes('--dev')) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('close', () => {
    isQuitting = true;
  });

  let saveBoundsTimer: NodeJS.Timeout | null = null;
  const saveWindowBounds = () => {
    if (saveBoundsTimer) clearTimeout(saveBoundsTimer);
    saveBoundsTimer = setTimeout(() => {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      const b = mainWindow.getNormalBounds();
      setWindowBounds({ x: b.x, y: b.y, width: b.width, height: b.height });
    }, 300);
  };
  mainWindow.on('resize', saveWindowBounds);
  mainWindow.on('move', saveWindowBounds);

  mainWindow.on('closed', () => {
    mainWindow = null;
    rdpViewManager?.setWindow(null);
  });

  mainWindow.on('enter-full-screen', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('rdp:fullscreen-change', true);
    }
  });

  mainWindow.on('leave-full-screen', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('rdp:fullscreen-change', false);
    }
  });
}

function showMainWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createMainWindow();
  } else {
    mainWindow.show();
    mainWindow.focus();
  }
}

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    showMainWindow();
  });

  app.whenReady().then(() => {
    if (process.platform === 'win32') {
      app.setAppUserModelId('com.tunnelgate.app');
    }

    tunnelManager = new TunnelManager(
      (state) => {
        sendStatusToRenderer(mainWindow, state);
      },
      (tunnelId, tunnelName, level, message) => {
        sendLogToRenderer(mainWindow, tunnelId, tunnelName, level, message);
      }
    );

    rdpViewManager = new RdpViewManager();

    registerIpcHandlers(tunnelManager, rdpViewManager);

    ipcMain.handle(IPC_CHANNELS.GET_DISPLAY_INFO, (): DisplayInfo => {
      const display = screen.getPrimaryDisplay();
      return {
        width: display.bounds.width,
        height: display.bounds.height,
        scaleFactor: display.scaleFactor,
      };
    });

    ipcMain.handle(IPC_CHANNELS.RDP_VIEW_FULLSCREEN, async () => {
      if (!mainWindow || mainWindow.isDestroyed()) return false;
      const isFs = mainWindow.isFullScreen();
      mainWindow.setFullScreen(!isFs);
      return !isFs;
    });

    createMainWindow();

    writeLog('system', 'System', 'info', 'TunnelGate started');

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
      } else {
        showMainWindow();
      }
    });
  });

  app.on('before-quit', () => {
    isQuitting = true;
    tunnelManager?.disconnectAll();
    rdpViewManager?.disconnectAll();
  });

  app.on('window-all-closed', () => {
    app.quit();
  });

  app.on('will-quit', () => {
    tunnelManager?.disconnectAll();
    rdpViewManager?.disconnectAll();
  });
}
