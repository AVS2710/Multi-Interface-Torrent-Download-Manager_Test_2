import { TorrentService } from './TorrentService.js';
import { networkManager } from './networkManager.js';
import { getSelectedNetworks } from './db.js';
export class MultiInterfaceTorrentManager {
    torrentService;
    reconcileTimer = null;
    currentOutgoingInterfaces = '';
    constructor() {
        this.torrentService = new TorrentService();
    }
    async reconcileNetworkConfiguration() {
        // Debounce to prevent rapid flapping configurations
        if (this.reconcileTimer) {
            clearTimeout(this.reconcileTimer);
        }
        this.reconcileTimer = setTimeout(async () => {
            let interfaces = [];
            try {
                interfaces = await networkManager.getHealthyInterfaces();
            }
            catch (err) {
                // Safe handling if network detection completely fails
            }
            let selected = [];
            try {
                selected = await getSelectedNetworks();
            }
            catch (e) {
                // Safe handling if DB not ready
            }
            const activeIps = [];
            for (const iface of interfaces) {
                // Strict state machine filtering (only route through CONNECTED)
                if (iface.state === 'CONNECTED') {
                    const pref = selected.find(s => s.interfaceId === iface.id);
                    if (!pref || pref.enabled) {
                        activeIps.push(...iface.ipv4Addresses);
                    }
                }
            }
            // Safe fallback if all disappear: allow fallback to default 0.0.0.0
            const joinedString = activeIps.length > 0 ? activeIps.join(',') : '0.0.0.0';
            const listenString = activeIps.length > 0 ? activeIps.map(ip => `${ip}:6881`).join(',') : '0.0.0.0:6881';
            if (this.currentOutgoingInterfaces !== joinedString) {
                try {
                    this.torrentService.session.apply_settings({
                        outgoing_interfaces: joinedString,
                        listen_interfaces: listenString
                    });
                    this.currentOutgoingInterfaces = joinedString;
                }
                catch (e) {
                    // Fallback handling if libtorrent rejects configuration
                }
            }
        }, 1000); // 1-second debounce
    }
}
export const multiInterfaceManager = new MultiInterfaceTorrentManager();
