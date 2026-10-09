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
    this.session.on('add_torrent', () => {
      this.syncHandlesFromSession();
      this.publishState();
    });
    this.session.on('state_update', () => {
      this.syncHandlesFromSession();
      this.publishState();
    });

    // The bindings require explicit polling for periodic torrent status alerts.
    this.updateTimer = setInterval(() => {
      try {
        this.session.post_torrent_updates();
        this.syncHandlesFromSession();
      } catch (error) {
        console.error('Failed to request torrent status update:', error);
      }
    }, 1000);
    this.updateTimer.unref();
  }

  public onStateUpdate(cb: (torrents: UITorrentState[]) => void): void {
    this.onStateUpdateCb = cb;
    this.syncHandlesFromSession();
    this.publishState();
  }

  public addTorrent(source: string, savePath: string): number {
    const value = typeof source === 'string' ? source.trim() : '';
    if (!value) throw new Error('Enter a magnet link, torrent URL, or torrent file path.');
    if (typeof savePath !== 'string' || !savePath.trim()) throw new Error('Choose a download directory.');

    const params = /^magnet:/i.test(value)
      ? lt.parse_magnet_uri(value)
      : (() => {
          const torrentParams = new lt.AddTorrentParams();
          torrentParams.ti = new lt.TorrentInfo(value);
          return torrentParams;
        })();

    params.save_path = savePath;
    const existingIds = new Set(this.session.get_torrents().map(handle => handle.id()));
    this.session.add_torrent(params); // This binding returns void; query the session for the handle.
    this.syncHandlesFromSession();

    const addedHandle = this.session.get_torrents().find(handle => !existingIds.has(handle.id()));
    if (!addedHandle) {
      throw new Error('libtorrent did not expose a new handle. The torrent may already be in the session.');
    }

    this.torrents.set(addedHandle.id(), addedHandle);
    this.publishState();
    return addedHandle.id();
  }

  public getTorrents(): UITorrentState[] {
    this.syncHandlesFromSession();
    return Array.from(this.torrents.values()).map(handle => this.toSummary(handle));
  }

  public getTorrentDetails(id: number): UITorrentState | null {
    this.syncHandlesFromSession();
    const handle = this.torrents.get(id);
    return handle ? this.toSummary(handle) : null;
  }

  public pauseTorrent(id: number): void {
    const handle = this.requireHandle(id);
    handle.pause();
    this.publishState();
  }

  public resumeTorrent(id: number): void {
    const handle = this.requireHandle(id);
    handle.resume();
    this.publishState();
  }

  public removeTorrent(id: number): void {
    const handle = this.requireHandle(id);
    this.session.remove_torrent(handle);
    this.torrents.delete(id);
    this.publishState();
  }

  private requireHandle(id: number): lt.TorrentHandle {
    if (!Number.isSafeInteger(id)) throw new Error('Invalid torrent identifier.');
    const handle = this.torrents.get(id);
    if (!handle) throw new Error(`Torrent ${id} was not found.`);
    return handle;
  }

  private syncHandlesFromSession(): void {
    const sessionHandles = this.session.get_torrents();
    const activeIds = new Set<number>();
    for (const handle of sessionHandles) {
      const id = handle.id();
      activeIds.add(id);
      this.torrents.set(id, handle);
    }
    for (const id of this.torrents.keys()) {
      if (!activeIds.has(id)) this.torrents.delete(id);
    }
  }

  private toSummary(handle: lt.TorrentHandle): UITorrentState {
    const status = handle.status();
    return {
      id: handle.id(),
      name: status.name,
      progress: status.progress,
      download_rate: status.download_rate,
      // The installed binding does not expose upload_rate; do not fabricate it.
      upload_rate: undefined,
      state: status.state,
    };
  }

  private publishState(): void {
    this.onStateUpdateCb?.(Array.from(this.torrents.values()).map(handle => this.toSummary(handle)));
  }

  public dispose(): void {
    clearInterval(this.updateTimer);
  }
}
