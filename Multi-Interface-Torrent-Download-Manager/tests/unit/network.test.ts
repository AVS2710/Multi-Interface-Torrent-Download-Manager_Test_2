import { describe, it, expect, vi } from 'vitest';
import { networkManager } from '../../src/main/networkManager.js';
import os from 'os';

describe('Network Manager', () => {
  it('should parse os.networkInterfaces correctly', () => {
    vi.spyOn(os, 'networkInterfaces').mockReturnValue({
      'eth0': [{ address: '192.168.1.10', family: 'IPv4', internal: false, netmask: '255.255.255.0', mac: '', cidr: '' }] as os.NetworkInterfaceInfo[],
      'lo': [{ address: '127.0.0.1', family: 'IPv4', internal: true, netmask: '255.0.0.0', mac: '', cidr: '' }] as os.NetworkInterfaceInfo[]
    });

    const interfaces = networkManager.getInterfaces();
    expect(interfaces).toHaveLength(1);
    expect(interfaces[0].ipv4Addresses[0]).toBe('192.168.1.10');
    expect(interfaces[0].name).toBe('eth0');
  });
});