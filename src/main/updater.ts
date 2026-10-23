import { app, BrowserWindow, ipcMain } from 'electron';
import { autoUpdater } from 'electron-updater';
import { IPC_CHANNELS, UpdateStatus } from '../shared/types';
import { writeLog } from './logger';

const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;

let status: UpdateStatus | null = null;

export function initUpdater(getWindow: () => BrowserWindow | null): void {
  ipcMain.handle(IPC_CHANNELS.APP_UPDATE_GET, () => status);
  ipcMain.handle(IPC_CHANNELS.APP_UPDATE_INSTALL, () => {
    if (status?.state === 'ready') autoUpdater.quitAndInstall();
  });

  // Updates need a packaged, signed build (and its app-update.yml); dev runs have neither.
  if (!app.isPackaged) return;

  const publish = (next: UpdateStatus) => {
    status = next;
    const win = getWindow();
    if (win && !win.isDestroyed()) win.webContents.send(IPC_CHANNELS.APP_UPDATE_STATUS, next);
  };

  autoUpdater.logger = null;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => publish({ state: 'available', version: info.version }));
  autoUpdater.on('download-progress', (p) =>
    publish({ state: 'downloading', version: (status as any)?.version ?? '', percent: Math.round(p.percent) }),
  );
  autoUpdater.on('update-downloaded', (info) => publish({ state: 'ready', version: info.version }));
  autoUpdater.on('error', (err) => {
    writeLog('system', 'System', 'error', `Auto-update failed: ${err?.message || err}`);
    // A failed check is silent (offline is normal); only surface failures mid-download.
    if (status?.state === 'downloading') publish({ state: 'error', message: err?.message || 'Update failed' });
  });

  const check = () => {
    // Don't restart the app over an in-progress update that is already staged.
    if (status?.state === 'ready' || status?.state === 'downloading') return;
    autoUpdater.checkForUpdates().catch(() => {});
  };
  setTimeout(check, 10_000);
  setInterval(check, CHECK_INTERVAL_MS);
}
