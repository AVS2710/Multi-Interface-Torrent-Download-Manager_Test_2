import lt from '@porla/libtorrent';
import { mkdir, mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface UITorrentState {
  id: number;
  name?: string;
  progress?: number;
  download_rate?: number;
  upload_rate?: number;
  state?: number;
}

type StatusLike = {
  name?: unknown;
  progress?: unknown;
  download_rate?: unknown;
  upload_rate?: unknown;
  state?: unknown;
};

const MAX_TORRENT_FILE_BYTES = 64 * 1024 * 1024;

function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function textOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export class TorrentService {
  public session: lt.Session;
  private torrents: Map<number, lt.TorrentHandle> = new Map();
  private onStateUpdateCb?: (torrents: UITorrentState[]) => void;
  private updateTimer: NodeJS.Timeout;

  constructor() {
    this.session = new lt.Session();

    this.session.on('state_update', () => this.publishState());

    // libtorrent emits state_update alerts after post_torrent_updates is requested.
    this.updateTimer = setInterval(() => {
      try {
        this.session.post_torrent_updates();
      } catch (error) {
        console.error('Unable to request torrent status updates:', error);
      }
    }, 1000);
    this.updateTimer.unref();
  }

  public onStateUpdate(cb: (torrents: UITorrentState[]) => void): void {
    this.onStateUpdateCb = cb;
    cb(this.getTorrents());
  }

  public getTorrents(): UITorrentState[] {
    return Array.from(this.torrents.entries()).map(([id, handle]) => this.toUiState(id, handle));
  }

  public getTorrentDetails(id: number): UITorrentState {
    const handle = this.torrents.get(id);
    if (!handle) throw new Error(`Torrent ${id} was not found.`);
    return this.toUiState(id, handle);
  }

  public async addTorrent(input: string, savePath: string): Promise<number> {
    if (typeof input !== 'string' || input.trim().length === 0) {
      throw new Error('Enter a magnet link, a .torrent file path, or a direct .torrent URL.');
    }
    if (typeof savePath !== 'string' || savePath.trim().length === 0) {
      throw new Error('Choose a download folder before adding the torrent.');
    }

    const source = input.trim();
    const destination = path.resolve(savePath.trim());
    await mkdir(destination, { recursive: true });

    let temporaryDirectory: string | undefined;
    try {
      let params: lt.AddTorrentParams;
      if (/^magnet:\?/i.test(source)) {
        params = lt.parse_magnet_uri(source);
      } else {
        let torrentPath = source;
        if (/^https?:\/\//i.test(source)) {
          const url = new URL(source);
          if (url.protocol !== 'http:' && url.protocol !== 'https:') {
            throw new Error('Only HTTP and HTTPS torrent-file URLs are supported.');
          }
          const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
          if (!response.ok) {
            throw new Error(`The torrent URL returned HTTP ${response.status}.`);
          }
          const headerLength = Number(response.headers.get('content-length') || 0);
          if (headerLength > MAX_TORRENT_FILE_BYTES) {
            throw new Error('The torrent file is larger than the 64 MiB safety limit.');
          }
          const bytes = Buffer.from(await response.arrayBuffer());
          if (bytes.byteLength === 0) throw new Error('The URL returned an empty response.');
          if (bytes.byteLength > MAX_TORRENT_FILE_BYTES) {
            throw new Error('The torrent file is larger than the 64 MiB safety limit.');
          }

          temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'multitorrent-torrent-'));
          torrentPath = path.join(temporaryDirectory, 'download.torrent');
          await writeFile(torrentPath, bytes);
        } else if (/^file:/i.test(source)) {
          torrentPath = fileURLToPath(new URL(source));
        }

        const fileInfo = await stat(torrentPath);
        if (!fileInfo.isFile()) throw new Error('The selected torrent path is not a file.');

        params = new lt.AddTorrentParams();
        params.ti = new lt.TorrentInfo(torrentPath);
      }

      params.save_path = destination;

      // libtorrent's synchronous add_torrent returns the real handle. Track that handle
      // so status, pause, resume and remove actions operate on the same engine object.
      const handle = this.session.add_torrent(params) as unknown as lt.TorrentHandle;
      if (!handle || typeof handle.id !== 'function' || typeof handle.status !== 'function') {
        throw new Error('The native torrent engine did not return a valid torrent handle.');
      }

      const id = handle.id();
      this.torrents.set(id, handle);
      this.publishState();
      return id;
    } catch (error) {
      throw new Error(`Could not add torrent: ${errorMessage(error)}`, { cause: error });
    } finally {
      if (temporaryDirectory) {
        await rm(temporaryDirectory, { recursive: true, force: true });
      }
    }
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

  public applySettings(settings: Record<string, string>): void {
    const toBytesPerSecond = (value: string | undefined): number => {
      const parsed = Number(value ?? '0');
      if (!Number.isFinite(parsed) || parsed <= 0) return 0;
      return Math.floor(parsed * 1024);
    };

    this.session.apply_settings({
      enable_dht: settings.enableDht !== 'false',
      download_rate_limit: toBytesPerSecond(settings.globalDownloadLimit),
      upload_rate_limit: toBytesPerSecond(settings.globalUploadLimit),
    });
  }

  public dispose(): void {
    clearInterval(this.updateTimer);
  }

  private requireHandle(id: number): lt.TorrentHandle {
    if (!Number.isInteger(id)) throw new Error('Invalid torrent ID.');
    const handle = this.torrents.get(id);
    if (!handle) throw new Error(`Torrent ${id} was not found or has already been removed.`);
    return handle;
  }

  private toUiState(id: number, handle: lt.TorrentHandle): UITorrentState {
    const status = handle.status() as unknown as StatusLike;
    return {
      id,
      name: textOrUndefined(status.name),
      progress: numberOrUndefined(status.progress),
      download_rate: numberOrUndefined(status.download_rate),
      // The installed native binding does not expose upload_rate in TorrentStatus.
      // Keep it absent so the UI can display "Not reported" instead of inventing a value.
      upload_rate: numberOrUndefined(status.upload_rate),
      state: numberOrUndefined(status.state),
    };
  }

  private publishState(): void {
    if (!this.onStateUpdateCb) return;

    try {
      this.onStateUpdateCb(this.getTorrents());
    } catch (error) {
      console.error('Unable to publish torrent state:', error);
    }
  }
}
