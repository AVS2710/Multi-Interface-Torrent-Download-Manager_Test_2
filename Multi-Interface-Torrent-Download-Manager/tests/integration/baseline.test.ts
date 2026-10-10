import { describe, it, expect } from 'vitest';
import { TorrentService } from '../../src/main/TorrentService.js';
import lt from '@porla/libtorrent';
import createTorrent from 'create-torrent';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

describe('Baseline Torrent Lifecycle (Real Engine)', () => {
  it('should initialize a real session, add a valid local torrent, and observe real events', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'multitorrent-baseline-'));
    const payloadPath = path.join(tempDir, 'test-file.txt');
    const torrentPath = path.join(tempDir, 'test.torrent');
    const service = new TorrentService();

    try {
      await fs.writeFile(payloadPath, 'Hello, world!');
      const torrentData = await new Promise<Buffer>((resolve, reject) => {
        createTorrent(payloadPath, {
          name: 'test-file.txt',
          announceList: [],
          pieceLength: 16384,
          creationDate: new Date('2026-10-09T00:00:00Z'),
        }, (error, torrent) => error ? reject(error) : resolve(torrent));
      });
      await fs.writeFile(torrentPath, torrentData);

      expect(service.session).toBeDefined();

      const info = new lt.TorrentInfo(torrentPath);
      expect(info.name()).toBe('test-file.txt');
      expect(info.v1()).toBeDefined();

      const id = await service.addTorrent(torrentPath, tempDir);
      expect(Number.isSafeInteger(id)).toBe(true);
      expect(service.getTorrentDetails(id)?.name).toBe('test-file.txt');
    } finally {
      service.dispose();
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });
});
