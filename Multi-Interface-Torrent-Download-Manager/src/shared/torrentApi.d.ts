export interface UITorrentState {
  id: number;
  name?: string;
  progress?: number;
  download_rate?: number;
  upload_rate?: number;
  state?: number;
}

export interface AppNetwork {
  id: string;
  name: string;
  displayName: string;
  type: string;
  addresses: string[];
  ipv4Addresses: string[];
  ipv6Addresses: string[];
  gateway?: string;
  isUp: boolean;
  hasInternet: boolean;
  isMetered: boolean;
  state: string;
  enabled: boolean;
  priority: string;
  metered: boolean;
}

export interface TorrentMetadata {
  name?: string;
  totalSize?: number;
  numFiles?: number;
  files?: Array<{ path: string }>;
}

export interface TorrentApi {
  addTorrent: (input: string, savePath: string) => Promise<number>;
  pauseTorrent: (id: number) => Promise<void>;
  resumeTorrent: (id: number) => Promise<void>;
  removeTorrent: (id: number) => Promise<void>;
  getNetworks: () => Promise<AppNetwork[]>;
  updateNetworkPreferences: (id: string, updates: Record<string, unknown>) => Promise<void>;
  getTorrents: () => Promise<UITorrentState[]>;
  getTorrentDetails: (id: number) => Promise<UITorrentState>;
  openFileDialog: () => Promise<string | undefined>;
  openTorrentFileDialog: () => Promise<string | undefined>;
  parseTorrentFile: (filePath: string) => Promise<TorrentMetadata>;
  getSettings: () => Promise<Record<string, string>>;
  updateSettings: (key: string, value: string) => Promise<void>;
  getPathForFile: (file: File) => string;
  subscribeToTorrents: (callback: (data: UITorrentState[]) => void) => void;
  unsubscribeFromTorrents: () => void;
  subscribeToToasts: (callback: (toast: { message: string }) => void) => void;
  unsubscribeFromToasts: () => void;
  subscribeToOpenTorrentInput: (callback: (input: string) => void) => void;
  unsubscribeFromOpenTorrentInput: () => void;
}

declare global {
  interface Window {
    torrentApi?: TorrentApi;
  }
}

export {};
