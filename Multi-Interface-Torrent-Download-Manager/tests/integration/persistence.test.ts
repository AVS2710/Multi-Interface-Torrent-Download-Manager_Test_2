import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { initDb, saveSelectedNetwork, getSelectedNetworks } from '../../src/main/db.js';
import fs from 'fs';

const TEST_DB = '/tmp/multitorrent_test';

describe('SQLite Persistence', () => {
  beforeEach(async () => {
    await initDb('/tmp');
  });

  afterAll(() => {
    if (fs.existsSync(TEST_DB + '/multitorrent.sqlite')) {
      fs.unlinkSync(TEST_DB + '/multitorrent.sqlite');
    }
  });

  it('should save and restore selected networks', async () => {
    await saveSelectedNetwork({
      interfaceId: 'eth0',
      enabled: true,
      priority: 'high',
      metered: false
    });

    const networks = await getSelectedNetworks();
    expect(networks).toHaveLength(1);
    expect(networks[0].interfaceId).toBe('eth0');
    expect(networks[0].enabled).toBe(true);
    expect(networks[0].priority).toBe('high');
    expect(networks[0].metered).toBe(false);
  });
});