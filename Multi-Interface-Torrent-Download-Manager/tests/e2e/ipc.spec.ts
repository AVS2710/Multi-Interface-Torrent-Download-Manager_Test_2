import { test, expect } from '@playwright/test';
import createTorrent from 'create-torrent';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launchElectronApp } from './electronApp.js';

test.describe('Electron runtime, preload bridge and torrent workflow', () => {
  test('renderer invokes real getNetworks and settings IPC through the preload bridge', async () => {
    const running = await launchElectronApp();
    const { page } = running;
    const pageErrors: string[] = [];
    page.on('pageerror', error => pageErrors.push(error.message));

    try {
      const bridgeReady = await page.evaluate(() =>
        Boolean(window.torrentApi &&
          typeof window.torrentApi.getNetworks === 'function' &&
          typeof window.torrentApi.getSettings === 'function' &&
          typeof window.torrentApi.addTorrent === 'function')
      );
      expect(bridgeReady).toBe(true);

      const networks = await page.evaluate(() => window.torrentApi!.getNetworks());
      expect(Array.isArray(networks)).toBe(true);
      for (const network of networks) {
        expect(typeof network.id).toBe('string');
        expect(Array.isArray(network.ipv4Addresses)).toBe(true);
        expect(typeof network.state).toBe('string');
      }

      const settings = await page.evaluate(() => window.torrentApi!.getSettings());
      expect(typeof settings.downloadDir).toBe('string');
      expect(settings.downloadDir.length).toBeGreaterThan(0);
      expect(pageErrors).toEqual([]);
    } finally {
      await running.close();
    }
  });

  test('Browse buttons select a folder and torrent file, then add it to the real engine', async () => {
    const running = await launchElectronApp();
    const { page, profileDir, app } = running;
    const pageErrors: string[] = [];
    page.on('pageerror', error => pageErrors.push(error.message));

    try {
      const payloadPath = join(profileDir, 'test-file.txt');
      const torrentPath = join(profileDir, 'test-file.torrent');
      const downloadPath = join(profileDir, 'downloads');
      mkdirSync(downloadPath, { recursive: true });
      writeFileSync(payloadPath, 'MultiTorrent local end-to-end fixture.');

      const torrent = await new Promise<Buffer>((resolve, reject) => {
        createTorrent(payloadPath, {
          name: 'test-file.txt',
          announceList: [],
          pieceLength: 16384,
        }, (error, value) => {
          if (error) reject(error);
          else resolve(value);
        });
      });
      writeFileSync(torrentPath, torrent);

      // Stub only the native OS picker response. The button, preload, IPC handler,
      // path propagation, parser and torrent-engine addition remain real.
      await app.evaluate(({ dialog }, selectedPaths: string[]) => {
        const original = dialog.showOpenDialog;
        dialog.showOpenDialog = (async (...args: unknown[]) => {
          const rawOptions = args[args.length - 1];
          const properties = rawOptions && typeof rawOptions === 'object' && 'properties' in rawOptions
            ? rawOptions.properties
            : [];
          const pickDirectory = Array.isArray(properties) && properties.includes('openDirectory');
          return {
            canceled: false,
            filePaths: [selectedPaths[pickDirectory ? 0 : 1]],
          };
        }) as unknown as typeof original;
      }, [downloadPath, torrentPath]);

      await page.getByRole('button', { name: '+ Add Torrent' }).click();
      const addDialog = page.getByRole('dialog', { name: 'Add Torrent' });
      await expect(addDialog).toBeVisible();

      await addDialog.getByRole('button', { name: 'Browse download folder' }).click();
      await expect(addDialog.getByLabel('Save Location')).toHaveValue(downloadPath);

      await addDialog.getByRole('button', { name: 'Choose File' }).click();
      await expect(addDialog.getByLabel('Torrent File or Magnet Link')).toHaveValue(torrentPath);
      await expect(addDialog.getByText('test-file.txt', { exact: true })).toBeVisible();

      await addDialog.getByRole('button', { name: 'Add Torrent' }).click();
      await expect(addDialog).toBeHidden({ timeout: 15000 });
      await expect(page.getByText('test-file.txt', { exact: true })).toBeVisible({ timeout: 15000 });
      expect(pageErrors).toEqual([]);
    } finally {
      await running.close();
    }
  });
});
