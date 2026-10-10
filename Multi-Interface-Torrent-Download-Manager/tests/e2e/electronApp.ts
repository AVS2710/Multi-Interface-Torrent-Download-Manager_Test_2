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
  const processOutput: string[] = [];
  try {
    app = await electron.launch({
      args: [appDirectory],
      timeout: 20000,
      env: {
        ...process.env,
        NODE_ENV: 'production',
        MULTITORRENT_E2E_USER_DATA: userDataDir,
        ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
      },
    });

    const child = app.process();
    child.stdout?.on('data', chunk => processOutput.push(String(chunk)));
    child.stderr?.on('data', chunk => processOutput.push(String(chunk)));

    const exitBeforeWindow = new Promise<never>((_resolve, reject) => {
      child.once('exit', (code, signal) => {
        reject(new Error(
          `Electron exited before creating a window (code=${code}, signal=${signal}).\n` +
          processOutput.join('').slice(-12000),
        ));
      });
    });

    const page = await Promise.race([app.firstWindow(), exitBeforeWindow]);
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
