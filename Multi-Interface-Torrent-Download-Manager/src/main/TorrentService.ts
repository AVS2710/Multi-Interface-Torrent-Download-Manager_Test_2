import lt from '@porla/libtorrent';
import type { TorrentSummary } from '../shared/torrentApi.js';

export type UITorrentState = TorrentSummary;

export class TorrentService {
  public readonly session: lt.Session;
  private readonly torrents = new Map<number, lt.TorrentHandle>();
  private onStateUpdateCb?: (torrents: UITorrentState[]) => void;
  private readonly updateTimer: NodeJS.Timeout;

  constructor() {
    this.session = new lt.Session();
    this.session.on('state_update', () => this.publishState());

    // The binding's README requires post_torrent_updates() for periodic alerts.
    this.updateTimer = setInterval(() => {
      try {
        this.session.post_torrent_updates();
      } catch (error) {
        console.error('Failed to request torrent status update:', error);
      }
    }, 1000);
    this.updateTimer.unref();
  }

  public onStateUpdate(cb: (torrents: UITorrentState[]) => void): void {
    this.onStateUpdateCb = cb;
    this.publishState();
  }

  public addTorrent(source: string, savePath: string): number {
    const value = source.trim();
    if (!value) throw new Error('Enter a magnet link, torrent URL, or torrent file path.');
    if (!savePath.trim()) throw new Error('Choose a download directory.');

    const params = /^magnet:/i.test(value)
      ? lt.parse_magnet_uri(value)
      : (() => {
          const torrentParams = new lt.AddTorrentParams();
          torrentParams.ti = new lt.TorrentInfo(value);
          return torrentParams;
        })();

    params.save_path = savePath;
    const handle = this.session.add_torrent(params);
    const id = handle.id();
    this.torrents.set(id, handle);
    this.publishState();
    return id;
  }

  public getTorrents(): UITorrentState[] {
    return Array.from(this.torrents.values()).map(handle => this.toSummary(handle));
  }

  public getTorrentDetails(id: number): UITorrentState | null {
    const handle = this.torrents.get(id);
    return handle ? this.toSummary(handle) : null;
  }

  public pauseTorrent(id: number): void {
    const handle = this.torrents.get(id);
    if (!handle) throw new Error(`Torrent ${id} was not found.`);
    handle.pause();
    this.publishState();
  }

  public resumeTorrent(id: number): void {
    const handle = this.torrents.get(id);
    if (!handle) throw new Error(`Torrent ${id} was not found.`);
    handle.resume();
    this.publishState();
  }

  public removeTorrent(id: number): void {
    const handle = this.torrents.get(id);
    if (!handle) throw new Error(`Torrent ${id} was not found.`);
    this.session.remove_torrent(handle);
    this.torrents.delete(id);
    this.publishState();
  }

  private toSummary(handle: lt.TorrentHandle): UITorrentState {
    const status = handle.status();
    return {
      id: handle.id(),
      name: status.name,
      progress: status.progress,
      download_rate: status.download_rate,
      // This binding does not reliably expose upload_rate. Do not invent a value.
      upload_rate: undefined,
      state: status.state,
    };
  }

  public dispose(): void {
    clearInterval(this.updateTimer);
  }
}
