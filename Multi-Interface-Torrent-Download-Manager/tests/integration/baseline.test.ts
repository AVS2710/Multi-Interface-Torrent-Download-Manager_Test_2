import { describe, it, expect } from 'vitest';
import createTorrent from 'create-torrent';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { TorrentService } from '../../src/main/TorrentService.js';
import lt from '@porla/libtorrent';

describe('Baseline Torrent Lifecycle (Real Engine)', () => {
  it('should initialize real session, add local torrent, and observe real events', async () => {
    const workDir = mkdtempSync(path.join(os.tmpdir(), 'multitorrent-baseline-'));
    const sourcePath = path.join(workDir, 'test-file.txt');
    const torrentPath = path.join(workDir, 'test.torrent');
    const savePath = path.join(workDir, 'downloads');
    mkdirSync(savePath, { recursive: true });
    writeFileSync(sourcePath, 'MultiTorrent real-engine test fixture.');
    const service = new TorrentService();

    try {
      const torrentData = await new Promise<Buffer>((resolve, reject) => {
        createTorrent(
          sourcePath,
          {
            name: 'test-file.txt',
            announceList: [],
            pieceLength: 16384,
            creationDate: new Date('2026-10-09T00:00:00Z'),
          },
          (error, torrent) => {
            if (error) reject(error);
            else resolve(torrent);
          },
        );
      });
      writeFileSync(torrentPath, torrentData);

      expect(service.session).toBeDefined();

      let added = false;
      service.session.on('add_torrent', () => {
        added = true;
      });

      const info = new lt.TorrentInfo(torrentPath);
      expect(info.name()).toBe('test-file.txt');
      expect(info.v1()).toBeDefined();

      const params = new lt.AddTorrentParams();
      params.ti = info;
      params.save_path = savePath;
      service.session.add_torrent(params);

      // Let libtorrent deliver the real add_torrent alert.
      await new Promise(resolve => setTimeout(resolve, 500));
      expect(added).toBe(true);
    } finally {
      service.dispose();
      rmSync(workDir, { recursive: true, force: true });
    }
  });
});
