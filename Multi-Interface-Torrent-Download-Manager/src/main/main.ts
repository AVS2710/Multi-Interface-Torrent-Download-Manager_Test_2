import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import lt from '@porla/libtorrent';
import { networkManager } from './networkManager.js';
import { multiInterfaceManager } from './MultiInterfaceTorrentManager.js';
import { initDb, getSelectedNetworks, saveSelectedNetwork } from './db.js';

let mainWindow: BrowserWindow | null = null;
const torrentService = multiInterfaceManager.torrentService;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(app.getAppPath(), 'dist/main/preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(app.getAppPath(), 'dist/renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  await initDb(app.getPath('userData'));
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });

  torrentService.onStateUpdate((torrents) => {
    if (mainWindow) {
      mainWindow.webContents.send('torrents-updated', torrents);
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers
ipcMain.handle('get-networks', async () => {
  const interfaces = await networkManager.getHealthyInterfaces();
  const selected = await getSelectedNetworks();

  return interfaces.map(iface => {
    const pref = selected.find(s => s.interfaceId === iface.id);
    return {
      ...iface,
      enabled: pref ? pref.enabled : true,
      priority: pref ? pref.priority : 'normal'
    };
  });
});

ipcMain.handle('update-network', async (_event, networkId: string, updates: Record<string, unknown>) => {
  const selected = await getSelectedNetworks();
  let pref = selected.find(s => s.interfaceId === networkId);
  if (!pref) {
    pref = { interfaceId: networkId, enabled: true, priority: 'normal', metered: false };
  }
  Object.assign(pref, updates);
  await saveSelectedNetwork(pref);
  await multiInterfaceManager.reconcileNetworkConfiguration();
});

ipcMain.handle('open-file-dialog', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  return result.filePaths[0];
});

ipcMain.handle('open-torrent-file-dialog', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'Torrents', extensions: ['torrent'] }]
  });
  return result.filePaths[0];
});

ipcMain.handle('parse-torrent-file', async (_event, filePath: string) => {
  try {
    const ti = new lt.TorrentInfo(filePath);
    return {
      name: ti.name(),
      totalSize: undefined,
      numFiles: undefined,
      files: undefined
    };
  } catch {
    throw new Error(`Failed to parse torrent.`);
  }
});

ipcMain.handle('add-torrent', async (_event, magnetOrPath: string, savePath: string) => {
  torrentService.addTorrent(magnetOrPath, savePath);
});

ipcMain.handle('pause-torrent', async (_event, id: number) => {
  torrentService.pauseTorrent(id);
});

ipcMain.handle('resume-torrent', async (_event, id: number) => {
  torrentService.resumeTorrent(id);
});

ipcMain.handle('remove-torrent', async (_event, id: number) => {
  torrentService.removeTorrent(id);
});
