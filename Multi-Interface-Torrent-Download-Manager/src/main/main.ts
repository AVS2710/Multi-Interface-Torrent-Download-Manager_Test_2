import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import lt from '@porla/libtorrent';
import { networkManager } from './networkManager.js';
import { multiInterfaceManager } from './MultiInterfaceTorrentManager.js';
import {
  initDb,
  getSelectedNetworks,
  saveSelectedNetwork,
  getSavedSettings,
  saveSetting,
  type SelectedNetwork,
} from './db.js';

let mainWindow: BrowserWindow | null = null;
const torrentService = multiInterfaceManager.torrentService;
const allowedSettingKeys = new Set([
  'downloadDir',
  'theme',
  'enableDht',
  'globalDownloadLimit',
  'globalUploadLimit',
]);
const MAX_TORRENT_FILE_BYTES = 10 * 1024 * 1024;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function notify(message: string): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('toast-event', { message });
  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false,
    webPreferences: {
      preload: path.join(app.getAppPath(), 'dist/main/preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow?.show());
  mainWindow.webContents.on('did-fail-load', (_event, code, description) => {
    console.error('Renderer failed to load:', code, description);
  });

  const loaded = process.env.NODE_ENV === 'development'
    ? mainWindow.loadURL('http://localhost:5173')
    : mainWindow.loadFile(path.join(app.getAppPath(), 'dist/renderer/index.html'));

  void loaded.catch(error => {
    console.error('Failed to load MultiTorrent renderer:', error);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

async function settingsWithDefaults(): Promise<Record<string, string>> {
  const saved = await getSavedSettings();
  return {
    theme: 'system',
    enableDht: 'true',
    globalDownloadLimit: '0',
    globalUploadLimit: '0',
    ...saved,
    downloadDir: saved.downloadDir?.trim() || app.getPath('downloads'),
  };
}

function limitToBytesPerSecond(value: string | undefined, label: string): number {
  const kbPerSecond = Number(value ?? '0');
  if (!Number.isFinite(kbPerSecond) || kbPerSecond < 0) {
    throw new Error(`${label} must be a non-negative number.`);
  }
  return Math.min(Math.floor(kbPerSecond * 1024), 2_147_483_647);
}

async function applySavedSettings(): Promise<void> {
  const settings = await settingsWithDefaults();
  torrentService.session.apply_settings({
    enable_dht: settings.enableDht !== 'false',
    download_rate_limit: limitToBytesPerSecond(settings.globalDownloadLimit, 'Download limit'),
    upload_rate_limit: limitToBytesPerSecond(settings.globalUploadLimit, 'Upload limit'),
  });
}

async function resolveTorrentSource(source: string): Promise<string> {
  const value = source.trim();
  if (!value) throw new Error('Enter a magnet link, torrent URL, or choose a .torrent file.');

  if (/^magnet:/i.test(value)) {
    let magnet: URL;
    try {
      magnet = new URL(value);
    } catch {
      throw new Error('This magnet link is malformed.');
    }
    if (!magnet.searchParams.getAll('xt').some(xt => /urn:btih:|urn:btmh:/i.test(xt))) {
      throw new Error('The magnet link is missing a BitTorrent info hash.');
    }
    return value;
  }

  let parsedUrl: URL | null = null;
  try {
    parsedUrl = new URL(value);
  } catch {
    // A non-URL value is treated as a local torrent file path below.
  }

  if (parsedUrl && (parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:')) {
    const response = await fetch(parsedUrl, { signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new Error(`Torrent URL returned HTTP ${response.status}.`);
    const contentLength = Number(response.headers.get('content-length') ?? 0);
    if (contentLength > MAX_TORRENT_FILE_BYTES) {
      throw new Error('Torrent file is larger than the 10 MB limit.');
    }
    if (!response.body) throw new Error('Torrent URL returned an empty response.');

    const chunks: Buffer[] = [];
    let total = 0;
    for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
      const buffer = Buffer.from(chunk);
      total += buffer.length;
      if (total > MAX_TORRENT_FILE_BYTES) throw new Error('Torrent file is larger than the 10 MB limit.');
      chunks.push(buffer);
    }
    if (total === 0) throw new Error('Torrent URL returned an empty file.');

    const cacheDir = path.join(app.getPath('userData'), 'torrent-cache');
    await fs.mkdir(cacheDir, { recursive: true });
    const cachedPath = path.join(cacheDir, `${randomUUID()}.torrent`);
    await fs.writeFile(cachedPath, Buffer.concat(chunks));
    try {
      new lt.TorrentInfo(cachedPath);
      return cachedPath;
    } catch {
      await fs.unlink(cachedPath).catch(() => undefined);
      throw new Error('The URL did not return a valid .torrent file.');
    }
  }

  let fileStats;
  try {
    fileStats = await fs.stat(value);
  } catch {
    throw new Error('Choose an existing .torrent file or enter a valid magnet/torrent URL.');
  }
  if (!fileStats.isFile()) throw new Error('The selected torrent path is not a file.');

  try {
    new lt.TorrentInfo(value);
  } catch {
    throw new Error('The selected file is not a valid .torrent file.');
  }
  return value;
}

app.whenReady().then(async () => {
  await initDb(app.getPath('userData'));
  await applySavedSettings();
  await multiInterfaceManager.reconcileNetworkConfiguration();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  torrentService.onStateUpdate(torrents => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('torrents-updated', torrents);
    }
  });
}).catch(error => {
  console.error('MultiTorrent failed to start:', error);
  dialog.showErrorBox('MultiTorrent failed to start', errorMessage(error));
  app.quit();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => torrentService.dispose());

ipcMain.handle('get-networks', async () => {
  const interfaces = await networkManager.getHealthyInterfaces();
  const selected = await getSelectedNetworks();
  return interfaces.map(iface => {
    const pref = selected.find(item => item.interfaceId === iface.id);
    return {
      ...iface,
      enabled: pref?.enabled ?? true,
      priority: pref?.priority ?? 'normal',
      metered: pref?.metered ?? iface.isMetered,
    };
  });
});

ipcMain.handle('update-network', async (_event, networkId: string, updates: Record<string, unknown>) => {
  if (typeof networkId !== 'string' || !networkId.trim()) throw new Error('Invalid network identifier.');
  if (!updates || typeof updates !== 'object' || Array.isArray(updates)) throw new Error('Invalid network preferences.');
  const allowedKeys = new Set(['enabled', 'priority', 'metered']);
  for (const key of Object.keys(updates)) {
    if (!allowedKeys.has(key)) throw new Error(`Unsupported network preference: ${key}`);
  }
  if ('enabled' in updates && typeof updates.enabled !== 'boolean') throw new Error('enabled must be a boolean.');
  if ('metered' in updates && typeof updates.metered !== 'boolean') throw new Error('metered must be a boolean.');
  if ('priority' in updates && !['high', 'normal', 'low'].includes(String(updates.priority))) {
    throw new Error('priority must be high, normal, or low.');
  }

  const selected = await getSelectedNetworks();
  const existing = selected.find(item => item.interfaceId === networkId);
  const priority = updates.priority === 'high' || updates.priority === 'normal' || updates.priority === 'low'
    ? updates.priority
    : (existing?.priority ?? 'normal');
  const pref: SelectedNetwork = {
    interfaceId: networkId,
    enabled: typeof updates.enabled === 'boolean' ? updates.enabled : (existing?.enabled ?? true),
    priority,
    metered: typeof updates.metered === 'boolean' ? updates.metered : (existing?.metered ?? false),
  };
  await saveSelectedNetwork(pref);
  await multiInterfaceManager.reconcileNetworkConfiguration();
});

ipcMain.handle('open-file-dialog', async () => {
  if (!mainWindow || mainWindow.isDestroyed()) return null;
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
  return result.canceled ? null : (result.filePaths[0] ?? null);
});

ipcMain.handle('open-torrent-file-dialog', async () => {
  if (!mainWindow || mainWindow.isDestroyed()) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'Torrent files', extensions: ['torrent'] }],
  });
  return result.canceled ? null : (result.filePaths[0] ?? null);
});

ipcMain.handle('parse-torrent-file', async (_event, filePath: string) => {
  if (typeof filePath !== 'string' || !filePath.trim()) throw new Error('No torrent file path was provided.');
  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) throw new Error('The selected path is not a file.');
    const info = new lt.TorrentInfo(filePath);
    return { name: info.name() };
  } catch (error) {
    throw new Error(`Failed to read torrent file: ${errorMessage(error)}`);
  }
});

ipcMain.handle('add-torrent', async (_event, source: string, savePath: string) => {
  try {
    if (typeof savePath !== 'string' || !savePath.trim() || !path.isAbsolute(savePath)) {
      throw new Error('Choose an absolute download directory path.');
    }
    const downloadPath = path.resolve(savePath);
    await fs.mkdir(downloadPath, { recursive: true });
    const stat = await fs.stat(downloadPath);
    if (!stat.isDirectory()) throw new Error('The download location is not a directory.');

    const resolvedSource = await resolveTorrentSource(source);
    const id = torrentService.addTorrent(resolvedSource, downloadPath);
    notify('Torrent added to the session.');
    return { id };
  } catch (error) {
    const message = errorMessage(error);
    notify(`Could not add torrent: ${message}`);
    throw new Error(message);
  }
});

ipcMain.handle('get-torrents', async () => torrentService.getTorrents());
ipcMain.handle('get-torrent-details', async (_event, id: number) => torrentService.getTorrentDetails(id));

ipcMain.handle('pause-torrent', async (_event, id: number) => {
  torrentService.pauseTorrent(id);
  notify('Torrent paused.');
});
ipcMain.handle('resume-torrent', async (_event, id: number) => {
  torrentService.resumeTorrent(id);
  notify('Torrent resumed.');
});
ipcMain.handle('remove-torrent', async (_event, id: number) => {
  torrentService.removeTorrent(id);
  notify('Torrent removed from the session.');
});

ipcMain.handle('get-settings', async () => settingsWithDefaults());
ipcMain.handle('update-settings', async (_event, key: string, value: string) => {
  if (!allowedSettingKeys.has(key)) throw new Error(`Unsupported setting: ${key}`);
  if (typeof value !== 'string') throw new Error('Setting value must be a string.');
  if (key === 'theme' && !['system', 'light', 'dark'].includes(value)) {
    throw new Error('Theme must be system, light, or dark.');
  }
  if ((key === 'enableDht' || key === 'enablePex') && !['true', 'false'].includes(value)) {
    throw new Error(`${key} must be true or false.`);
  }
  if (key === 'globalDownloadLimit' || key === 'globalUploadLimit') {
    limitToBytesPerSecond(value, key);
  }
  if (key === 'downloadDir' && !value.trim()) throw new Error('Download directory cannot be empty.');

  await saveSetting(key, value.trim());
  if (['enableDht', 'enablePex', 'globalDownloadLimit', 'globalUploadLimit'].includes(key)) {
    await applySavedSettings();
  }
});
