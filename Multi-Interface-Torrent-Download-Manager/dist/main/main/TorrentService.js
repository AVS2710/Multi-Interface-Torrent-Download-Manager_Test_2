import lt from '@porla/libtorrent';
export class TorrentService {
    session; // using any temporarily to bypass ESM structural checking
    torrents = new Map();
    onStateUpdateCb;
    constructor() {
        this.session = new lt.Session();
        this.session.on('state_update', (data) => {
            if (this.onStateUpdateCb) {
                const torrentList = Array.from(this.torrents.values()).map(t => {
                    const status = t.status();
                    return {
                        id: t.id(),
                        name: status.name,
                        progress: status.progress,
                        download_rate: status.download_rate,
                        upload_rate: status.total_upload, // Mock shape
                        state: status.state
                    };
                });
                this.onStateUpdateCb(torrentList);
            }
        });
    }
    onStateUpdate(cb) {
        this.onStateUpdateCb = cb;
    }
    addTorrent(magnet, savePath) {
        const params = lt.parse_magnet_uri(magnet);
        params.save_path = savePath;
        this.session.add_torrent(params);
        return 0; // Mock ID
    }
    pauseTorrent(id) {
        const handle = this.torrents.get(id);
        if (handle) {
            handle.pause();
        }
    }
    resumeTorrent(id) {
        const handle = this.torrents.get(id);
        if (handle) {
            handle.resume();
        }
    }
    removeTorrent(id) {
        const handle = this.torrents.get(id);
        if (handle) {
            this.session.remove_torrent(handle);
            this.torrents.delete(id);
        }
    }
}
