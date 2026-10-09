import { describe, it, expect, vi } from 'vitest';
import { MultiInterfaceTorrentManager } from '../../src/main/MultiInterfaceTorrentManager.js';
import { networkManager } from '../../src/main/networkManager.js';
import * as db from '../../src/main/db.js';

describe('Interface Failure and Recovery (Real Engine)', () => {
  it('should handle interface loss and recovery correctly without crashing', async () => {
    vi.spyOn(db, 'getSelectedNetworks').mockResolvedValue([
      { interfaceId: 'eth0', enabled: true, priority: 'normal', metered: false },
      { interfaceId: 'wlan0', enabled: true, priority: 'normal', metered: false }
    ]);

    const manager = new MultiInterfaceTorrentManager();

    // 1. Initial ONLINE state
    const getHealthyInterfacesMock = vi.spyOn(networkManager, 'getHealthyInterfaces').mockResolvedValue([
      { id: 'eth0', name: 'eth0', displayName: 'eth0', type: 'Ethernet', addresses: ['10.0.0.5'], ipv4Addresses: ['10.0.0.5'], ipv6Addresses: [], isUp: true, hasInternet: true, isMetered: false, state: 'CONNECTED' },
      { id: 'wlan0', name: 'wlan0', displayName: 'wlan0', type: 'Wi-Fi', addresses: ['192.168.1.20'], ipv4Addresses: ['192.168.1.20'], ipv6Addresses: [], isUp: true, hasInternet: true, isMetered: false, state: 'CONNECTED' }
    ]);

    const applySpy = vi.spyOn(manager.torrentService.session, 'apply_settings');

    await manager.reconcileNetworkConfiguration();
    await new Promise(r => setTimeout(r, 1100));
    expect(applySpy).toHaveBeenCalledWith({ outgoing_interfaces: '10.0.0.5,192.168.1.20', listen_interfaces: '10.0.0.5:6881,192.168.1.20:6881' });

    // 2. Simulate wlan0 going OFFLINE
    getHealthyInterfacesMock.mockResolvedValue([
      { id: 'eth0', name: 'eth0', displayName: 'eth0', type: 'Ethernet', addresses: ['10.0.0.5'], ipv4Addresses: ['10.0.0.5'], ipv6Addresses: [], isUp: true, hasInternet: true, isMetered: false, state: 'CONNECTED' },
      { id: 'wlan0', name: 'wlan0', displayName: 'wlan0', type: 'Wi-Fi', addresses: ['192.168.1.20'], ipv4Addresses: ['192.168.1.20'], ipv6Addresses: [], isUp: true, hasInternet: false, isMetered: false, state: 'DISCONNECTED' }
    ]);

    await manager.reconcileNetworkConfiguration();
    await new Promise(r => setTimeout(r, 1100));
    expect(applySpy).toHaveBeenCalledWith({ outgoing_interfaces: '10.0.0.5', listen_interfaces: '10.0.0.5:6881' });

    // 3. Simulate wlan0 RECOVERY
    getHealthyInterfacesMock.mockResolvedValue([
      { id: 'eth0', name: 'eth0', displayName: 'eth0', type: 'Ethernet', addresses: ['10.0.0.5'], ipv4Addresses: ['10.0.0.5'], ipv6Addresses: [], isUp: true, hasInternet: true, isMetered: false, state: 'CONNECTED' },
      { id: 'wlan0', name: 'wlan0', displayName: 'wlan0', type: 'Wi-Fi', addresses: ['192.168.1.20'], ipv4Addresses: ['192.168.1.20'], ipv6Addresses: [], isUp: true, hasInternet: true, isMetered: false, state: 'CONNECTED' }
    ]);

    await manager.reconcileNetworkConfiguration();
    await new Promise(r => setTimeout(r, 1100));
    expect(applySpy).toHaveBeenCalledWith({ outgoing_interfaces: '10.0.0.5,192.168.1.20', listen_interfaces: '10.0.0.5:6881,192.168.1.20:6881' });
  });

  it('should handle rapid flapping without crashing and apply last stable state', async () => {
    vi.spyOn(db, 'getSelectedNetworks').mockResolvedValue([
      { interfaceId: 'eth0', enabled: true, priority: 'normal', metered: false }
    ]);

    const manager = new MultiInterfaceTorrentManager();
    const getHealthyInterfacesMock = vi.spyOn(networkManager, 'getHealthyInterfaces');
    const applySpy = vi.spyOn(manager.torrentService.session, 'apply_settings');

    // Flap the state multiple times rapidly
    for (let i = 0; i < 5; i++) {
        getHealthyInterfacesMock.mockResolvedValue([{ id: 'eth0', name: 'eth0', displayName: 'eth0', type: 'Ethernet', addresses: ['10.0.0.5'], ipv4Addresses: ['10.0.0.5'], ipv6Addresses: [], isUp: true, hasInternet: true, isMetered: false, state: 'CONNECTED' }]);
        manager.reconcileNetworkConfiguration();

        getHealthyInterfacesMock.mockResolvedValue([{ id: 'eth0', name: 'eth0', displayName: 'eth0', type: 'Ethernet', addresses: ['10.0.0.5'], ipv4Addresses: ['10.0.0.5'], ipv6Addresses: [], isUp: true, hasInternet: false, isMetered: false, state: 'DISCONNECTED' }]);
        manager.reconcileNetworkConfiguration();
    }

    // Stabilize on CONNECTED
    getHealthyInterfacesMock.mockResolvedValue([{ id: 'eth0', name: 'eth0', displayName: 'eth0', type: 'Ethernet', addresses: ['10.0.0.5'], ipv4Addresses: ['10.0.0.5'], ipv6Addresses: [], isUp: true, hasInternet: true, isMetered: false, state: 'CONNECTED' }]);
    manager.reconcileNetworkConfiguration();

    // Debounce wait
    await new Promise(r => setTimeout(r, 1100));

    // Because of debouncing, the final call should just be the active connection
    expect(applySpy).toHaveBeenCalledWith({ outgoing_interfaces: '10.0.0.5', listen_interfaces: '10.0.0.5:6881' });
  });

  it('should handle invalid/unavailable interfaces correctly', async () => {
    vi.spyOn(db, 'getSelectedNetworks').mockResolvedValue([
      { interfaceId: 'invalid0', enabled: true, priority: 'normal', metered: false },
      { interfaceId: 'eth0', enabled: true, priority: 'normal', metered: false }
    ]);

    const manager = new MultiInterfaceTorrentManager();

    // invalid0 is missing from hardware response
    vi.spyOn(networkManager, 'getHealthyInterfaces').mockResolvedValue([
      { id: 'eth0', name: 'eth0', displayName: 'eth0', type: 'Ethernet', addresses: ['10.0.0.5'], ipv4Addresses: ['10.0.0.5'], ipv6Addresses: [], isUp: true, hasInternet: true, isMetered: false, state: 'CONNECTED' }
    ]);

    const applySpy = vi.spyOn(manager.torrentService.session, 'apply_settings');

    await manager.reconcileNetworkConfiguration();
    await new Promise(r => setTimeout(r, 1100));

    expect(applySpy).toHaveBeenCalledWith({ outgoing_interfaces: '10.0.0.5', listen_interfaces: '10.0.0.5:6881' });
  });
});