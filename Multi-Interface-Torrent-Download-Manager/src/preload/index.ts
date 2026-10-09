import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('torrentApi', {
  addTorrent: (magnetOrPath: string, savePath: string) => ipcRenderer.invoke('add-torrent', magnetOrPath, savePath),
  pauseTorrent: (id: number) => ipcRenderer.invoke('pause-torrent', id),
  resumeTorrent: (id: number) => ipcRenderer.invoke('resume-torrent', id),
  removeTorrent: (id: number) => ipcRenderer.invoke('remove-torrent', id),
  getNetworks: () => ipcRenderer.invoke('get-networks'),
  updateNetworkPreferences: (networkId: string, updates: Record<string, unknown>) => ipcRenderer.invoke('update-network', networkId, updates),
  getTorrents: () => ipcRenderer.invoke('get-torrents'),
  getTorrentDetails: (id: number) => ipcRenderer.invoke('get-torrent-details', id),
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
  openTorrentFileDialog: () => ipcRenderer.invoke('open-torrent-file-dialog'),
  parseTorrentFile: (path: string) => ipcRenderer.invoke('parse-torrent-file', path),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  updateSettings: (key: string, value: string) => ipcRenderer.invoke('update-settings', key, value),
  subscribeToTorrents: (callback: (data: unknown) => void) => {
    ipcRenderer.on('torrents-updated', (_event, data) => callback(data));
  },
  unsubscribeFromTorrents: () => {
    ipcRenderer.removeAllListeners('torrents-updated');
  },
  subscribeToToasts: (callback: (toast: unknown) => void) => {
    ipcRenderer.on('toast-event', (_event, data) => callback(data));
  },
  unsubscribeFromToasts: () => {
    ipcRenderer.removeAllListeners('toast-event');
  }
});