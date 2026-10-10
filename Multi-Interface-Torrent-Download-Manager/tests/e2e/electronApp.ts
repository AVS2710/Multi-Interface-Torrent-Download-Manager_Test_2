import { _electron as electron, type ElectronApplication, type Page } from 'playwright';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

export interface RunningElectronApp {
  app: ElectronApplication;
  page: Page;
  profileDir: string;
  close: () => Promise<void>;
}

export async function launchElectronApp(): Promise<RunningElectronApp> {
  const profileDir = mkdtempSync(join(tmpdir(), 'multitorrent-e2e-'));
  const userDataDir = join(profileDir, 'user-data');
  mkdirSync(userDataDir, { recursive: true });
  const appDirectory = resolve(process.cwd());

  let app: ElectronApplication | undefined;
  try {
    app = await electron.launch({
      args: [appDirectory],
      env: {
        ...process.env,
        NODE_ENV: 'production',
        MULTITORRENT_E2E_USER_DATA: userDataDir,
        ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
      },
    });
    const page = await app.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForFunction(() => Boolean(document.querySelector('#root')?.childElementCount), undefined, { timeout: 15000 });

    return {
      app,
      page,
      profileDir,
      close: async () => {
        await app?.close();
        rmSync(profileDir, { recursive: true, force: true });
      },
    };
  } catch (error) {
    await app?.close().catch(() => undefined);
    rmSync(profileDir, { recursive: true, force: true });
    throw error;
  }
}
