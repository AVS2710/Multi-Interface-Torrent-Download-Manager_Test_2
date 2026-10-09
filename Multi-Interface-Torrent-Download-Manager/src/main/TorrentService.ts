import lt from '@porla/libtorrent';

export interface UIPeer {
  ip: string;
  port: number;
  client: string;
  down_speed: number;
  up_speed: number;
  local_endpoint: string;
}

export interface UITorrentState {
  id: number;
  name: string;
  progress: number;
  download_rate: number;
  upload_rate: number;
  state: number;
}

export class TorrentService {
  public session: lt.Session;
  private torrents: Map<number, lt.TorrentHandle> = new Map();
  private onStateUpdateCb?: (torrents: UITorrentState[]) => void;
  private nextId = 1;

  constructor() {
    this.session = new lt.Session();

    this.session.on('state_update', () => {
        if (this.onStateUpdateCb) {
          const torrentList = Array.from(this.torrents.values()).map(t => {
            const status = t.status();
            return {
              id: t.id(),
              name: status.name,
              progress: status.progress,
              download_rate: status.download_rate,
              upload_rate: undefined as unknown as number, // Property missing in bindings
              state: status.state
            };
          });
          this.onStateUpdateCb(torrentList);
        }
    });
  }

  public onStateUpdate(cb: (torrents: UITorrentState[]) => void) {
    this.onStateUpdateCb = cb;
  }

  public addTorrent(magnet: string, savePath: string): number {
    const params = lt.parse_magnet_uri(magnet);
    params.save_path = savePath;
    this.session.add_torrent(params);

    // Assigning a generated tracking ID to map UI items to active engine handles
    const generatedId = this.nextId++;
    return generatedId;
  }

  public pauseTorrent(id: number) {
    const handle = this.torrents.get(id);
    if (handle) {
      handle.pause();
    }
  }

  public resumeTorrent(id: number) {
    const handle = this.torrents.get(id);
    if (handle) {
      handle.resume();
    }
  }

  public removeTorrent(id: number) {
    const handle = this.torrents.get(id);
    if (handle) {
      this.session.remove_torrent(handle);
      this.torrents.delete(id);
    }
  }
}