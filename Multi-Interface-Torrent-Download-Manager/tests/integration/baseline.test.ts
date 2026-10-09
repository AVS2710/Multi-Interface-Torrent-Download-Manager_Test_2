import { describe, it, expect } from 'vitest';
import { TorrentService } from '../../src/main/TorrentService.js';
import lt from '@porla/libtorrent';
import path from 'path';

describe('Baseline Torrent Lifecycle (Real Engine)', () => {
  it('should initialize real session, add local torrent, and observe real events', async () => {
    const service = new TorrentService();
    expect(service.session).toBeDefined();

    const torrentPath = path.join(process.cwd(), 'tests/fixtures/test.torrent');
    // const torrentBuf = fs.readFileSync(torrentPath);

    let added = false;
    service.session.on('add_torrent', () => {
      added = true;
    });

    const ti = new lt.TorrentInfo(torrentPath);
    expect(ti.name()).toBe('test-file.txt');
    expect(ti.v1()).toBeDefined();

    const params = new lt.AddTorrentParams();
    params.ti = ti;
    params.save_path = '/tmp';

    service.session.add_torrent(params);

    // Give it a moment to process the async add_torrent alert
    await new Promise(r => setTimeout(r, 500));

    expect(added).toBe(true);
  });
});