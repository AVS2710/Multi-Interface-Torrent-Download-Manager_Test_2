import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'node:path';
import { mkdir } from 'node:fs/promises';
import lt from '@porla/libtorrent';
import { networkManager } from './networkManager.js';
import { multiInterfaceManager } from './MultiInterfaceTorrentManager.js';
import { initDb, getSelectedNetworks, saveSelectedNetwork, getSettings, saveSetting } from './db.js';
import type { SelectedNetwork } from './db.js';

let mainWindow: BrowserWindow | null = null;
let pendingExternalInput: string | null = null;
const torrentService = multiInterfaceManager.torrentService;

if (process.env.MULTITORRENT_E2E_USER_DATA) {
  app.setPath('userData', process.env.MULTITORRENT_E2E_USER_DATA);
}

function userFacingError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function showToast(message: string): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('toast-event', { message });
  }
}

function findExternalInput(args: string[]): string | undefined {
  return args.find(argument =>
    typeof argument === 'string' &&
    (/^magnet:\?/i.test(argument) ||
      /^https?:\/\/.+\.torrent(?:[?#].*)?$/i.test(argument) ||
      /\.torrent$/i.test(argument))
  );
}

function openExternalInput(input: string): void {
  if (!mainWindow || mainWindow.isDestroyed() || mainWindow.webContents.isLoading()) {
    pendingExternalInput = input;
    if (!mainWindow || mainWindow.isDestroyed()) createWindow();
    return;
  }

  mainWindow.show();
  mainWindow.focus();
  mainWindow.webContents.send('open-torrent-input', input);
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
} else {
  pendingExternalInput = findExternalInput(process.argv) ?? null;
  app.on('second-instance', (_event, commandLine) => {
    const input = findExternalInput(commandLine);
    if (input) openExternalInput(input);
    else if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

async function settingsWithDefaults(): Promise<Record<string, string>> {
  const saved = await getSettings();
  return {
    ...saved,
    downloadDir: saved.downloadDir || app.getPath('downloads'),
    theme: saved.theme || 'system',
    enableDht: saved.enableDht ?? 'true',
    globalDownloadLimit: saved.globalDownloadLimit ?? '0',
    globalUploadLimit: saved.globalUploadLimit ?? '0',
  };
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 620,
    show: false,
    webPreferences: {
      preload: path.join(app.getAppPath(), 'dist/main/preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const window = mainWindow;
  window.once('ready-to-show', () => window.show());
  window.webContents.on('did-fail-load', (_event, code, description, url) => {
    if (code !== -3) console.error('Renderer failed to load:', { code, description, url });
  });
  window.webContents.on('render-process-gone', (_event, details) => {
    console.error('Renderer process exited:', details);
  });

  const load = process.env.NODE_ENV === 'development'
    ? window.loadURL('http://localhost:5173')
    : window.loadFile(path.join(app.getAppPath(), 'dist/renderer/index.html'));
  void load.catch((error: unknown) => {
    console.error('Unable to load MultiTorrent renderer:', error);
    dialog.showErrorBox('MultiTorrent failed to start', userFacingError(error));
  });

  window.on('closed', () => {
    if (mainWindow === window) mainWindow = null;
  });
}

app.whenReady().then(async () => {
  try {
    app.setName('MultiTorrent');
    if (app.isPackaged) app.setAsDefaultProtocolClient('magnet');
    await mkdir(app.getPath('userData'), { recursive: true });
    await initDb(app.getPath('userData'));

    const settings = await settingsWithDefaults();
    torrentService.applySettings(settings);
    await multiInterfaceManager.reconcileNetworkConfiguration();

    createWindow();
    torrentService.onStateUpdate((torrents) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('torrents-updated', torrents);
      }
    });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  } catch (error) {
    console.error('MultiTorrent startup failed:', error);
    dialog.showErrorBox('MultiTorrent failed to start', userFacingError(error));
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('before-quit', () => torrentService.dispose());

// Keep each IPC channel implemented here in sync with src/shared/torrentApi.d.ts
// and src/preload/index.ts. Errors are intentionally propagated to the renderer.
ipcMain.handle('get-launch-input', () => {
  const input = pendingExternalInput ?? undefined;
  pendingExternalInput = null;
  return input;
});

ipcMain.handle('get-networks', async () => {
  const interfaces = await networkManager.getHealthyInterfaces();
  const selected = await getSelectedNetworks();

  return interfaces.map(iface => {
    const preference = selected.find(item => item.interfaceId === iface.id);
    return {
      ...iface,
      enabled: preference ? preference.enabled : true,
      priority: preference ? preference.priority : 'normal',
      metered: preference ? preference.metered : iface.isMetered,
    };
  });
});

ipcMain.handle('update-network', async (_event, networkId: string, updates: Record<string, unknown>) => {
  if (typeof networkId !== 'string' || !networkId.trim() || !updates || typeof updates !== 'object') {
    throw new Error('Invalid network preference request.');
  }

  const allowed: Partial<SelectedNetwork> = {};
  if (typeof updates.enabled === 'boolean') allowed.enabled = updates.enabled;
  if (typeof updates.metered === 'boolean') allowed.metered = updates.metered;
  if (updates.priority === 'high' || updates.priority === 'normal' || updates.priority === 'low') {
    allowed.priority = updates.priority;
  }
  if (Object.keys(allowed).length === 0) throw new Error('No valid network preferences were provided.');

  const selected = await getSelectedNetworks();
  const current = selected.find(item => item.interfaceId === networkId);
  const next: SelectedNetwork = {
    interfaceId: networkId,
    enabled: current?.enabled ?? true,
    priority: current?.priority ?? 'normal',
    metered: current?.metered ?? false,
    ...allowed,
  };

  await saveSelectedNetwork(next);
  await multiInterfaceManager.reconcileNetworkConfiguration();
});

ipcMain.handle('open-file-dialog', async () => {
  if (!mainWindow || mainWindow.isDestroyed()) return undefined;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Choose download folder',
    defaultPath: app.getPath('downloads'),
  });
  return result.canceled ? undefined : result.filePaths[0];
});

ipcMain.handle('open-torrent-file-dialog', async () => {
  if (!mainWindow || mainWindow.isDestroyed()) return undefined;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'BitTorrent files', extensions: ['torrent'] }],
    title: 'Choose torrent file',
  });
  return result.canceled ? undefined : result.filePaths[0];
});

ipcMain.handle('parse-torrent-file', async (_event, filePath: string) => {
  if (typeof filePath !== 'string' || !filePath.trim()) {
    throw new Error('Choose a .torrent file to inspect.');
  }
  try {
    const info = new lt.TorrentInfo(filePath);
    return { name: info.name() };
  } catch (error) {
    throw new Error(`Failed to parse torrent file: ${userFacingError(error)}`, { cause: error });
  }
});

ipcMain.handle('add-torrent', async (_event, input: string, savePath: string) => {
  const id = await torrentService.addTorrent(input, savePath);
  showToast(`Torrent accepted by the engine (ID ${id}).`);
  return id;
});

ipcMain.handle('get-torrents', () => torrentService.getTorrents());
ipcMain.handle('get-torrent-details', (_event, id: number) => torrentService.getTorrentDetails(id));

ipcMain.handle('pause-torrent', (_event, id: number) => torrentService.pauseTorrent(id));
ipcMain.handle('resume-torrent', (_event, id: number) => torrentService.resumeTorrent(id));
ipcMain.handle('remove-torrent', (_event, id: number) => {
  torrentService.removeTorrent(id);
  showToast(`Torrent ${id} removed.`);
});

ipcMain.handle('get-settings', () => settingsWithDefaults());

ipcMain.handle('update-settings', async (_event, key: string, value: string) => {
  const allowedKeys = new Set([
    'downloadDir',
    'theme',
    'enableDht',
    'globalDownloadLimit',
    'globalUploadLimit',
  ]);
  if (!allowedKeys.has(key) || typeof value !== 'string') {
    throw new Error('Invalid settings update.');
  }

  let normalized = value.trim();
  if (key === 'downloadDir') {
    if (!normalized) throw new Error('Download directory cannot be empty.');
    normalized = path.resolve(normalized);
  } else if (key === 'theme') {
    if (!['system', 'light', 'dark'].includes(normalized)) {
      throw new Error('Choose system, light or dark theme.');
    }
  } else if (key === 'enableDht') {
    if (!['true', 'false'].includes(normalized)) {
      throw new Error('DHT must be enabled or disabled.');
    }
  } else if (key === 'globalDownloadLimit' || key === 'globalUploadLimit') {
    if (normalized === '') normalized = '0';
    const limit = Number(normalized);
    if (!Number.isFinite(limit) || limit < 0 || limit > 1_000_000_000) {
      throw new Error('Bandwidth limits must be non-negative numbers in KB/s.');
    }
    normalized = String(Math.floor(limit));
  }

  await saveSetting(key, normalized);
  torrentService.applySettings(await settingsWithDefaults());
  showToast('Settings saved.');
});
