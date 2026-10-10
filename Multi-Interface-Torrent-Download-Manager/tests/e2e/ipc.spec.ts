import { test, expect } from '@playwright/test';
import { _electron as electron, type Page } from 'playwright';
import createTorrent from 'create-torrent';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const launchApp = (userDataDir?: string) => electron.launch({
  args: [...(userDataDir ? [`--user-data-dir=${userDataDir}`] : []), '.'],
  cwd: process.cwd(),
  env: {
    ...process.env,
    NODE_ENV: 'production',
    ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
    ELECTRON_ENABLE_LOGGING: '1',
  },
  timeout: 30_000,
});

async function closeApp(app: Awaited<ReturnType<typeof launchApp>>): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      app.close(),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error('Electron did not close cleanly within 5 seconds.')), 5_000);
      }),
    ]);
  } catch (error) {
    console.error('Forcing Electron test process to exit:', error);
    const child = app.process();
    if (child.exitCode === null) child.kill('SIGKILL');
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function waitForFirstWindow(app: Awaited<ReturnType<typeof launchApp>>) {
  const child = app.process();
  const output: string[] = [];
  child.stdout?.on('data', (chunk: Buffer) => output.push(chunk.toString()));
  child.stderr?.on('data', (chunk: Buffer) => output.push(chunk.toString()));

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`Electron did not create a window within 20 seconds. Process output:\\n${output.join('') || '(no process output captured)'}`));
    }, 20_000);
  });

  try {
    const page = await Promise.race([app.firstWindow(), timeout]);
    return { page, output };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function waitForRenderer(page: Page, output: string[]): Promise<void> {
  const rendererErrors: string[] = [];
  page.on('console', message => {
    if (message.type() === 'error') rendererErrors.push(message.text());
  });
  page.on('pageerror', error => rendererErrors.push(error.stack ?? error.message));
  try {
    await page.waitForLoadState('domcontentloaded', { timeout: 15_000 });
  } catch (error) {
    throw new Error(
      `Renderer did not reach DOMContentLoaded. URL: ${page.url()}\\n` +
      `Electron output:\\n${output.join('') || '(no process output captured)'}\\n` +
      `Renderer errors:\\n${rendererErrors.join('\\n') || '(none captured)'}\\n` +
      String(error),
      { cause: error },
    );
  }
}

test.describe('Electron IPC and Preload Bridge', () => {
  test('renderer loads the sandboxed preload and invokes getNetworks over IPC', async () => {
    const app = await launchApp();
    try {
      const { page, output } = await waitForFirstWindow(app);
      await waitForRenderer(page, output);
      await expect(page.getByRole('heading', { name: 'MultiTorrent' })).toBeVisible();

      await expect.poll(() => page.evaluate(() => typeof window.torrentApi?.getNetworks)).toBe('function');

      const networks = await page.evaluate(async () => {
        const api = window.torrentApi;
        if (!api) throw new Error('window.torrentApi was not exposed by the preload');
        return api.getNetworks();
      });
      expect(Array.isArray(networks)).toBe(true);
      for (const network of networks) {
        expect(typeof network.id).toBe('string');
        expect(typeof network.name).toBe('string');
        expect(Array.isArray(network.ipv4Addresses)).toBe(true);
      }

      const settings = await page.evaluate(async () => {
        const api = window.torrentApi;
        if (!api) throw new Error('window.torrentApi is missing');
        return api.getSettings();
      });
      expect(typeof settings.downloadDir).toBe('string');
    } finally {
      await closeApp(app);
    }
  });

  test('UI can add a local .torrent file through the real preload and libtorrent service', async () => {
    const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'multitorrent-e2e-'));
    const userDataDir = path.join(workDir, 'user-data');
    const downloadsDir = path.join(workDir, 'downloads');
    await fs.mkdir(downloadsDir, { recursive: true });

    const payloadPath = path.join(workDir, 'payload.txt');
    const torrentPath = path.join(workDir, 'e2e-test.torrent');
    await fs.writeFile(payloadPath, 'MultiTorrent E2E fixture payload.');
    const torrentBytes = await new Promise<Buffer>((resolve, reject) => {
      createTorrent(payloadPath, {
        name: 'multitorrent-e2e-file.txt',
        announceList: [],
        pieceLength: 16384,
        creationDate: new Date('2026-10-09T00:00:00Z'),
      }, (error, torrent) => error ? reject(error) : resolve(torrent));
    });
    await fs.writeFile(torrentPath, torrentBytes);

    const app = await launchApp(userDataDir);
    try {
      const { page, output } = await waitForFirstWindow(app);
      await waitForRenderer(page, output);
      await page.getByRole('button', { name: /add torrent/i }).first().click();
      await expect(page.getByRole('heading', { name: 'Add Torrent' })).toBeVisible();

      await page.getByLabel('Torrent File, Magnet Link, or Torrent URL').fill(torrentPath);
      await page.getByLabel('Save Location').fill(downloadsDir);
      await expect(page.getByText('multitorrent-e2e-file.txt', { exact: true })).toBeVisible();

      await page.getByRole('button', { name: 'Add Torrent', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Add Torrent' })).toHaveCount(0);
      await expect(page.getByText('multitorrent-e2e-file.txt', { exact: true })).toBeVisible({ timeout: 10_000 });
    } finally {
      await app.close();
      await fs.rm(workDir, { recursive: true, force: true });
    }
  });
});
