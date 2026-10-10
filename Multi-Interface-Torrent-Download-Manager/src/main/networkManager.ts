import os from 'node:os';
import net from 'node:net';

export type InterfaceState = 'CONNECTED' | 'TESTING' | 'LIMITED' | 'NO_INTERNET' | 'DISCONNECTED' | 'BLOCKED' | 'ERROR';

export interface NetworkInterfaceInfo {
  id: string;
  name: string;
  displayName: string;
  type: string;
  addresses: string[];
  ipv4Addresses: string[];
  ipv6Addresses: string[];
  gateway?: string;
  isUp: boolean;
  hasInternet: boolean;
  isMetered: boolean;
  state: InterfaceState;
}

interface ConnectivityProbe {
  host: string;
  port: number;
}

// Use services that are intended to accept TCP connections. 8.8.8.8 is a DNS
// resolver, not a reliable HTTP endpoint on port 80; probing that port could
// report a working interface as offline.
const CONNECTIVITY_PROBES: readonly ConnectivityProbe[] = [
  { host: '1.1.1.1', port: 443 },
  { host: '8.8.8.8', port: 53 },
];

export class InterfaceHealthChecker {
  public async check(ipv4: string): Promise<InterfaceState> {
    if (typeof ipv4 !== 'string' || !ipv4.trim()) return 'DISCONNECTED';

    try {
      const isOnline = await this.checkConnectivity(ipv4);
      return isOnline ? 'CONNECTED' : 'NO_INTERNET';
    } catch {
      return 'ERROR';
    }
  }

  private async checkConnectivity(interfaceIp: string): Promise<boolean> {
    for (const probe of CONNECTIVITY_PROBES) {
      const connected = await new Promise<boolean>((resolve) => {
        const socket = new net.Socket();
        let settled = false;

        const finish = (result: boolean) => {
          if (settled) return;
          settled = true;
          socket.destroy();
          resolve(result);
        };

        socket.setTimeout(1200);
        socket.once('connect', () => finish(true));
        socket.once('timeout', () => finish(false));
        socket.once('error', () => finish(false));

        try {
          socket.connect({
            host: probe.host,
            port: probe.port,
            localAddress: interfaceIp,
          });
        } catch {
          finish(false);
        }
      });

      if (connected) return true;
    }

    return false;
  }
}

export class NetworkManager {
  private healthChecker = new InterfaceHealthChecker();

  public getInterfaces(): NetworkInterfaceInfo[] {
    const interfaces = os.networkInterfaces();
    const results: NetworkInterfaceInfo[] = [];

    for (const name of Object.keys(interfaces)) {
      const ifaceArr = interfaces[name];
      if (!ifaceArr) continue;

      const ipv4s = ifaceArr.filter(i => i.family === 'IPv4' && !i.internal).map(i => i.address);
      const ipv6s = ifaceArr.filter(i => i.family === 'IPv6' && !i.internal).map(i => i.address);
      const addresses = [...ipv4s, ...ipv6s];

      if (ipv4s.length > 0) {
        results.push({
          id: name,
          name,
          displayName: name,
          type: name.includes('wl') || name.includes('wi-fi') ? 'Wi-Fi' :
                name.includes('en') || name.includes('eth') ? 'Ethernet' : 'Other',
          addresses,
          ipv4Addresses: ipv4s,
          ipv6Addresses: ipv6s,
          isUp: true,
          hasInternet: false,
          isMetered: name.toLowerCase().includes('usb'),
          state: 'TESTING',
          // A local subnet is only a rough hint; it does not prove gateway equality.
          gateway: ipv4s[0].split('.').slice(0, 3).join('.') + '.1'
        });
      }
    }
    return results;
  }

  public async getHealthyInterfaces(): Promise<NetworkInterfaceInfo[]> {
    const interfaces = this.getInterfaces();
    await Promise.all(interfaces.map(async iface => {
      iface.state = await this.healthChecker.check(iface.ipv4Addresses[0]);
      iface.hasInternet = iface.state === 'CONNECTED';
    }));
    return interfaces;
  }
}

export const networkManager = new NetworkManager();
