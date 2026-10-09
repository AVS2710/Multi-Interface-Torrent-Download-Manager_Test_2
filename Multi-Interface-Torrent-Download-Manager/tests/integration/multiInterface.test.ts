import { describe, it, expect, vi } from 'vitest';
import { MultiInterfaceTorrentManager } from '../../src/main/MultiInterfaceTorrentManager.js';
import { networkManager } from '../../src/main/networkManager.js';
import * as db from '../../src/main/db.js';

describe('Multi-Interface Configuration (Real Engine)', () => {
  it('should correctly configure outgoing_interfaces and pass it directly to libtorrent', async () => {
    // Mock the db
    vi.spyOn(db, 'getSelectedNetworks').mockResolvedValue([
      { interfaceId: 'eth0', enabled: true, priority: 'normal', metered: false },
      { interfaceId: 'wlan0', enabled: true, priority: 'normal', metered: false }
    ]);

    // Mock network detection
    vi.spyOn(networkManager, 'getHealthyInterfaces').mockResolvedValue([
      {
        id: 'eth0', name: 'eth0', displayName: 'eth0', type: 'Ethernet',
        addresses: ['10.0.0.5'], ipv4Addresses: ['10.0.0.5'], ipv6Addresses: [],
        isUp: true, hasInternet: true, isMetered: false, state: 'CONNECTED'
      },
      {
        id: 'wlan0', name: 'wlan0', displayName: 'wlan0', type: 'Wi-Fi',
        addresses: ['192.168.1.20'], ipv4Addresses: ['192.168.1.20'], ipv6Addresses: [],
        isUp: true, hasInternet: true, isMetered: false, state: 'CONNECTED'
      }
    ]);

    const manager = new MultiInterfaceTorrentManager();

    // Because apply_settings is read-only on the C++ binding object, we spy on it to verify the arguments
    const applySpy = vi.spyOn(manager.torrentService.session, 'apply_settings');

    // Reconcile and wait for the debounce timer
    await manager.reconcileNetworkConfiguration();
    await new Promise(r => setTimeout(r, 1100)); // wait for debounce 1s + margin

    expect(applySpy).toHaveBeenCalledWith({
      outgoing_interfaces: '10.0.0.5,192.168.1.20',
      listen_interfaces: '10.0.0.5:6881,192.168.1.20:6881'
    });
  });
});