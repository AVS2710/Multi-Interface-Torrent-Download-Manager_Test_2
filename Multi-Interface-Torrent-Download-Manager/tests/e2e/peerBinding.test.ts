import { test, expect } from '@playwright/test';
import { launchElectronApp } from './electronApp.js';

test('Networks tab renders real interface data returned by the main process', async () => {
  const running = await launchElectronApp();
  const { page } = running;

  try {
    const bridgeNetworks = await page.evaluate(() => {
      if (!window.torrentApi) throw new Error('Preload bridge is missing.');
      return window.torrentApi.getNetworks();
    });
    expect(Array.isArray(bridgeNetworks)).toBe(true);

    await page.getByRole('button', { name: 'Networks', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Networks', exact: true })).toBeVisible();
    await page.waitForFunction(() => {
      const content = document.body.innerText;
      return content.includes('Status:') ||
        content.includes('No non-loopback IPv4 network interfaces were detected.') ||
        content.includes('Could not read network interfaces:');
    }, undefined, { timeout: 15000 });

    const renderedState = await page.locator('body').innerText();
    expect(renderedState).toMatch(/Status:|No non-loopback IPv4 network interfaces were detected\.|Could not read network interfaces:/);
  } finally {
    await running.close();
  }
});
