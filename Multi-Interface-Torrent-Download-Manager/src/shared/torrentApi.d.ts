export interface TorrentSummary {
  id: number;
  name: string;
  progress: number;
  download_rate: number;
  upload_rate?: number;
  state: number;
}

export interface NetworkInfo {
  id: string;
  name: string;
  displayName: string;
  type: string;
  addresses: string[];
  ipv4Addresses: string[];
  ipv6Addresses: string[];
  isUp: boolean;
  hasInternet: boolean;
  isMetered: boolean;
  state: string;
  enabled: boolean;
  priority: 'high' | 'normal' | 'low';
  metered: boolean;
  gateway?: string;
}

export interface TorrentMetadata {
  name?: string;
}

export interface TorrentApi {
  addTorrent(source: string, savePath: string): Promise<{ id: number }>;
  pauseTorrent(id: number): Promise<void>;
  resumeTorrent(id: number): Promise<void>;
  removeTorrent(id: number): Promise<void>;
  getNetworks(): Promise<NetworkInfo[]>;
  updateNetworkPreferences(id: string, preferences: Record<string, unknown>): Promise<void>;
  getTorrents(): Promise<TorrentSummary[]>;
  getTorrentDetails(id: number): Promise<TorrentSummary | null>;
  openFileDialog(): Promise<string | null>;
  openTorrentFileDialog(): Promise<string | null>;
  parseTorrentFile(filePath: string): Promise<TorrentMetadata>;
  getSettings(): Promise<Record<string, string>>;
  updateSettings(key: string, value: string): Promise<void>;
  subscribeToTorrents(callback: (torrents: TorrentSummary[]) => void): void;
  unsubscribeFromTorrents(): void;
  subscribeToToasts(callback: (toast: { message: string }) => void): void;
  unsubscribeFromToasts(): void;
}

declare global {
  interface Window {
    torrentApi?: TorrentApi;
  }
}

export {};
