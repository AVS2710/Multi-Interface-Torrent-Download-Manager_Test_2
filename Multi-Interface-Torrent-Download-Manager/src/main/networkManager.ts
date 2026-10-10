import os from 'os';
import net from 'net';

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

export class InterfaceHealthChecker {
  public async check(ipv4: string): Promise<InterfaceState> {
    try {
      const isOnline = await this.checkConnectivity(ipv4);
      return isOnline ? 'CONNECTED' : 'NO_INTERNET';
    } catch {
      return 'ERROR';
    }
  }

  private checkConnectivity(interfaceIp: string): Promise<boolean> {
    // 8.8.8.8 is a DNS server, not an HTTP server on port 80. Probe TCP/443
    // on two public endpoints instead, and bind every socket to this adapter's
    // local address so healthy interfaces are checked independently.
    const targets = [
      { host: '1.1.1.1', port: 443 },
      { host: '8.8.8.8', port: 443 },
    ];

    return Promise.all(targets.map(target => new Promise<boolean>(resolve => {
      const socket = new net.Socket();
      let settled = false;
      const finish = (connected: boolean): void => {
        if (settled) return;
        settled = true;
        socket.destroy();
        resolve(connected);
      };

      socket.setTimeout(2000);
      socket.once('connect', () => finish(true));
      socket.once('timeout', () => finish(false));
      socket.once('error', () => finish(false));

      try {
        socket.connect({
          host: target.host,
          port: target.port,
          localAddress: interfaceIp,
        });
      } catch {
        finish(false);
      }
    }))).then(results => results.some(Boolean));
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
          type: (() => {
            const normalizedName = name.toLowerCase();
            if (normalizedName.includes('wi-fi') || normalizedName.includes('wifi') || normalizedName.includes('wlan') || normalizedName.startsWith('wl')) {
              return 'Wi-Fi';
            }
            if (normalizedName.includes('ethernet') || normalizedName.includes('eth') || normalizedName.startsWith('en')) {
              return 'Ethernet';
            }
            return 'Other';
          })(),
          addresses,
          ipv4Addresses: ipv4s,
          ipv6Addresses: ipv6s,
          isUp: true,
          hasInternet: false, // Updated by health checker later
          isMetered: name.toLowerCase().includes('usb'),
          state: 'TESTING',
          // A rudimentary way to estimate gateway uniqueness for UX hints
          gateway: ipv4s[0].split('.').slice(0, 3).join('.') + '.1'
        });
      }
    }
    return results;
  }

  public async getHealthyInterfaces(): Promise<NetworkInterfaceInfo[]> {
    const all = this.getInterfaces();
    for (const iface of all) {
      iface.state = await this.healthChecker.check(iface.ipv4Addresses[0]);
      iface.hasInternet = iface.state === 'CONNECTED';
    }
    return all;
  }
}

export const networkManager = new NetworkManager();