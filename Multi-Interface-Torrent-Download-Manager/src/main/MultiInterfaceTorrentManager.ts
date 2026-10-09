import { TorrentService } from './TorrentService.js';
import { networkManager } from './networkManager.js';
import { getSelectedNetworks, SelectedNetwork } from './db.js';

export class MultiInterfaceTorrentManager {
  public torrentService: TorrentService;
  private reconcileTimer: NodeJS.Timeout | null = null;
  private currentOutgoingInterfaces: string = '';

  constructor() {
    this.torrentService = new TorrentService();
  }

  public async reconcileNetworkConfiguration() {
    // Debounce to prevent rapid flapping configurations
    if (this.reconcileTimer) {
      clearTimeout(this.reconcileTimer);
    }

    this.reconcileTimer = setTimeout(async () => {
      let interfaces: import('./networkManager.js').NetworkInterfaceInfo[] = [];
      try {
        interfaces = await networkManager.getHealthyInterfaces();
      } catch {
        // Safe handling if network detection completely fails
      }

      let selected: SelectedNetwork[] = [];
      try {
        selected = await getSelectedNetworks();
      } catch {
        // Safe handling if DB not ready
      }

      const activeIps: string[] = [];
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
        } catch {
          // Fallback handling if libtorrent rejects configuration
        }
      }
    }, 1000); // 1-second debounce
  }
}

export const multiInterfaceManager = new MultiInterfaceTorrentManager();