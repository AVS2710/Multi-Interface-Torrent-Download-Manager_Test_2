import lt from '@porla/libtorrent';
import type { TorrentSummary } from '../shared/torrentApi.js';

export type UITorrentState = TorrentSummary;

interface PendingAdd {
  resolve: (id: number) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}

function isTorrentHandle(value: unknown): value is lt.TorrentHandle {
  if (value === null || typeof value !== 'object') return false;
  const candidate = value as {
    id?: unknown;
    status?: unknown;
    pause?: unknown;
    resume?: unknown;
    info_hash?: unknown;
  };
  return typeof candidate.id === 'function'
    && typeof candidate.status === 'function'
    && typeof candidate.pause === 'function'
    && typeof candidate.resume === 'function';
}

function findTorrentHandle(args: unknown[]): lt.TorrentHandle | undefined {
  const queue = [...args];
  const visited = new Set<unknown>();
  while (queue.length > 0) {
    const candidate = queue.shift();
    if (!candidate || visited.has(candidate)) continue;
    visited.add(candidate);
    if (isTorrentHandle(candidate)) return candidate;
    if (typeof candidate === 'object') {
      const wrapper = candidate as Record<string, unknown>;
      for (const key of ['handle', 'torrent', 'torrent_handle']) {
        if (wrapper[key]) queue.push(wrapper[key]);
      }
    }
  }
  return undefined;
}

export class TorrentService {
  public readonly session: lt.Session;
  private readonly torrents = new Map<number, lt.TorrentHandle>();
  private readonly pendingAdds: PendingAdd[] = [];
  private onStateUpdateCb?: (torrents: UITorrentState[]) => void;
  private readonly updateTimer: NodeJS.Timeout;

  constructor() {
    this.session = new lt.Session();
    this.session.on('add_torrent', (...args: unknown[]) => {
      const handle = findTorrentHandle(args);
      if (handle) {
        const id = handle.id();
        this.torrents.set(id, handle);
        const pending = this.pendingAdds.shift();
        if (pending) {
          clearTimeout(pending.timer);
          pending.resolve(id);
        }
      }
      this.publishState();
    });
    this.session.on('state_update', () => this.publishState());

    // The bindings require explicit polling for periodic torrent status alerts.
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

  public addTorrent(source: string, savePath: string): Promise<number> {
    const value = typeof source === 'string' ? source.trim() : '';
    if (!value) return Promise.reject(new Error('Enter a magnet link, torrent URL, or torrent file path.'));
    if (typeof savePath !== 'string' || !savePath.trim()) {
      return Promise.reject(new Error('Choose a download directory.'));
    }

    let params: lt.AddTorrentParams;
    try {
      if (/^magnet:/i.test(value)) {
        params = lt.parse_magnet_uri(value);
      } else {
        params = new lt.AddTorrentParams();
        params.ti = new lt.TorrentInfo(value);
      }
      params.save_path = savePath;
    } catch (error) {
      return Promise.reject(error instanceof Error ? error : new Error(String(error)));
    }

    return new Promise<number>((resolve, reject) => {
      const pending: PendingAdd = {
        resolve,
        reject,
        timer: setTimeout(() => {
          const index = this.pendingAdds.indexOf(pending);
          if (index >= 0) this.pendingAdds.splice(index, 1);
          reject(new Error('libtorrent did not confirm that the torrent was added. Check the torrent source and try again.'));
        }, 10_000),
      };
      pending.timer.unref();
      // Register the pending request before calling into native code because
      // the binding may emit the add_torrent event synchronously or asynchronously.
      this.pendingAdds.push(pending);
      try {
        this.session.add_torrent(params); // This binding returns void; the handle arrives through its event.
      } catch (error) {
        clearTimeout(pending.timer);
        const index = this.pendingAdds.indexOf(pending);
        if (index >= 0) this.pendingAdds.splice(index, 1);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  public getTorrents(): UITorrentState[] {
    return Array.from(this.torrents.values()).map(handle => this.toSummary(handle));
  }

  public getTorrentDetails(id: number): UITorrentState | null {
    const handle = this.torrents.get(id);
    return handle ? this.toSummary(handle) : null;
  }

  public pauseTorrent(id: number): void {
    this.requireHandle(id).pause();
    this.publishState();
  }

  public resumeTorrent(id: number): void {
    this.requireHandle(id).resume();
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
    for (const pending of this.pendingAdds) {
      clearTimeout(pending.timer);
      pending.reject(new Error('Torrent service is shutting down.'));
    }
    this.pendingAdds.length = 0;
  }
}
