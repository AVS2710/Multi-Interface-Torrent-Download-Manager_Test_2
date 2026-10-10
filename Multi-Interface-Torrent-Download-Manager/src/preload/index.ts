import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import type { TorrentApi, TorrentSummary } from '../shared/torrentApi.js';

const torrentApi: TorrentApi = {
  addTorrent: (source, savePath) => ipcRenderer.invoke('add-torrent', source, savePath),
  pauseTorrent: (id) => ipcRenderer.invoke('pause-torrent', id),
  resumeTorrent: (id) => ipcRenderer.invoke('resume-torrent', id),
  removeTorrent: (id) => ipcRenderer.invoke('remove-torrent', id),
  getNetworks: () => ipcRenderer.invoke('get-networks'),
  updateNetworkPreferences: (id, preferences) => ipcRenderer.invoke('update-network', id, preferences),
  getTorrents: () => ipcRenderer.invoke('get-torrents'),
  getTorrentDetails: (id) => ipcRenderer.invoke('get-torrent-details', id),
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
  openTorrentFileDialog: () => ipcRenderer.invoke('open-torrent-file-dialog'),
  parseTorrentFile: (filePath) => ipcRenderer.invoke('parse-torrent-file', filePath),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  updateSettings: (key, value) => ipcRenderer.invoke('update-settings', key, value),
  subscribeToTorrents: (callback) => {
    const listener = (_event: IpcRendererEvent, data: TorrentSummary[]) => callback(data);
    ipcRenderer.on('torrents-updated', listener);
  },
  unsubscribeFromTorrents: () => {
    ipcRenderer.removeAllListeners('torrents-updated');
  },
  subscribeToToasts: (callback) => {
    const listener = (_event: IpcRendererEvent, data: { message: string }) => callback(data);
    ipcRenderer.on('toast-event', listener);
  },
  unsubscribeFromToasts: () => {
    ipcRenderer.removeAllListeners('toast-event');
  },
};

contextBridge.exposeInMainWorld('torrentApi', torrentApi);
