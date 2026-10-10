import { contextBridge, ipcRenderer, webUtils } from 'electron';
import type { AppNetwork, TorrentApi, TorrentMetadata, UITorrentState } from '../shared/torrentApi.js';

const api: TorrentApi = {
  addTorrent: (input: string, savePath: string) => ipcRenderer.invoke('add-torrent', input, savePath),
  pauseTorrent: (id: number) => ipcRenderer.invoke('pause-torrent', id),
  resumeTorrent: (id: number) => ipcRenderer.invoke('resume-torrent', id),
  removeTorrent: (id: number) => ipcRenderer.invoke('remove-torrent', id),
  getNetworks: () => ipcRenderer.invoke('get-networks') as Promise<AppNetwork[]>,
  updateNetworkPreferences: (id: string, updates: Record<string, unknown>) =>
    ipcRenderer.invoke('update-network', id, updates),
  getTorrents: () => ipcRenderer.invoke('get-torrents') as Promise<UITorrentState[]>,
  getTorrentDetails: (id: number) => ipcRenderer.invoke('get-torrent-details', id) as Promise<UITorrentState>,
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog') as Promise<string | undefined>,
  openTorrentFileDialog: () => ipcRenderer.invoke('open-torrent-file-dialog') as Promise<string | undefined>,
  parseTorrentFile: (filePath: string) =>
    ipcRenderer.invoke('parse-torrent-file', filePath) as Promise<TorrentMetadata>,
  getSettings: () => ipcRenderer.invoke('get-settings') as Promise<Record<string, string>>,
  updateSettings: (key: string, value: string) => ipcRenderer.invoke('update-settings', key, value),
  getPathForFile: (file: File) => webUtils.getPathForFile(file),
  subscribeToTorrents: (callback) => {
    ipcRenderer.on('torrents-updated', (_event, data: UITorrentState[]) => callback(data));
  },
  unsubscribeFromTorrents: () => {
    ipcRenderer.removeAllListeners('torrents-updated');
  },
  subscribeToToasts: (callback) => {
    ipcRenderer.on('toast-event', (_event, data: { message: string }) => callback(data));
  },
  unsubscribeFromToasts: () => {
    ipcRenderer.removeAllListeners('toast-event');
  },
  subscribeToOpenTorrentInput: (callback) => {
    ipcRenderer.on('open-torrent-input', (_event, input: string) => callback(input));
  },
  unsubscribeFromOpenTorrentInput: () => {
    ipcRenderer.removeAllListeners('open-torrent-input');
  },
};

contextBridge.exposeInMainWorld('torrentApi', api);
