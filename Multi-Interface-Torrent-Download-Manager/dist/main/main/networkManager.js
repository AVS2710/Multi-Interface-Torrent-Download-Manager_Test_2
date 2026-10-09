import os from 'os';
import net from 'net';
export class InterfaceHealthChecker {
    async check(ipv4) {
        try {
            const isOnline = await this.checkConnectivity(ipv4);
            return isOnline ? 'CONNECTED' : 'NO_INTERNET';
        }
        catch (e) {
            return 'ERROR';
        }
    }
    checkConnectivity(interfaceIp) {
        return new Promise((resolve) => {
            const socket = new net.Socket();
            socket.setTimeout(2000);
            socket.on('connect', () => {
                socket.destroy();
                resolve(true);
            });
            socket.on('timeout', () => {
                socket.destroy();
                resolve(false);
            });
            socket.on('error', () => {
                socket.destroy();
                resolve(false);
            });
            try {
                socket.connect({
                    port: 80,
                    host: '8.8.8.8',
                    localAddress: interfaceIp
                });
            }
            catch (e) {
                resolve(false);
            }
        });
    }
}
export class NetworkManager {
    healthChecker = new InterfaceHealthChecker();
    getInterfaces() {
        const interfaces = os.networkInterfaces();
        const results = [];
        for (const name of Object.keys(interfaces)) {
            const ifaceArr = interfaces[name];
            if (!ifaceArr)
                continue;
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
    async getHealthyInterfaces() {
        const all = this.getInterfaces();
        for (const iface of all) {
            iface.state = await this.healthChecker.check(iface.ipv4Addresses[0]);
            iface.hasInternet = iface.state === 'CONNECTED';
        }
        return all;
    }
}
export const networkManager = new NetworkManager();
