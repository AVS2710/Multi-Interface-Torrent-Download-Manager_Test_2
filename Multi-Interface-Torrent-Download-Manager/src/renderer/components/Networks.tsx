import React, { useState, useEffect } from 'react';

interface Network {
  id: string;
  name: string;
  type: string;
  ipv4Addresses: string[];
  isUp: boolean;
  hasInternet: boolean;
  state: string;
  enabled: boolean;
  priority: string;
  metered: boolean;
}

const Networks: React.FC = () => {
  const [networks, setNetworks] = useState<Network[]>([]);

  const torrentApi = (window as unknown as { torrentApi?: { getNetworks: () => Promise<Network[]>, updateNetworkPreferences: (id: string, pref: Record<string, unknown>) => Promise<void> } }).torrentApi;

  useEffect(() => {
    if (torrentApi) {
      torrentApi.getNetworks().then(setNetworks).catch(console.error);
    }
  }, [torrentApi]);

  const toggleEnabled = (id: string, current: boolean) => {
    if (torrentApi) {
      torrentApi.updateNetworkPreferences(id, { enabled: !current }).then(() => {
        setNetworks(prev => prev.map(n => n.id === id ? { ...n, enabled: !current } : n));
      });
    }
  };

  const toggleMetered = (id: string, current: boolean) => {
    if (torrentApi) {
      torrentApi.updateNetworkPreferences(id, { metered: !current }).then(() => {
        setNetworks(prev => prev.map(n => n.id === id ? { ...n, metered: !current } : n));
      });
    }
  };

  // Group by gateways to detect shared upstream connectivity
  const getSharedGatewayWarning = (network: Network) => {
    // This is a naive heuristic for UI display: if the network type is different but same subnet/gateway exists, warn.
    // Given we only have IP addresses here, we'll just check if it shares an IP range with another type.
    const hasSimilarIP = networks.some(n =>
      n.id !== network.id &&
      n.ipv4Addresses.some(ip => network.ipv4Addresses.some(nip => nip.substring(0, nip.lastIndexOf('.')) === ip.substring(0, ip.lastIndexOf('.'))))
    );
    return hasSimilarIP ? "⚠ Warning: This interface may share a gateway with another network." : null;
  };

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">Networks</h2>
      <p className="text-sm text-gray-400 mb-6">
        Multi-network downloading works best when your connections use independent Internet connections, such as home Wi-Fi + mobile tethering. Two adapters connected to the same router usually share the same upstream connection and may not increase total Internet bandwidth.
      </p>
      <div className="grid gap-4">
        {networks.map(n => {
          const warning = getSharedGatewayWarning(n);
          return (
            <div key={n.id} className="border p-4 rounded-md bg-gray-50 dark:bg-gray-800 flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0">
              <div className="flex-1">
                <h3 className="font-bold text-lg">{n.name} ({n.type})</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">{n.ipv4Addresses.join(', ')}</p>
                <p className="text-sm text-gray-500 mt-1">
                  Status: <span className={n.hasInternet ? 'text-green-600' : 'text-red-500'}>{n.state}</span>
                </p>
                {warning && <p className="text-sm text-yellow-600 mt-1">{warning}</p>}

                {n.metered && (
                  <p className="text-sm text-orange-500 mt-1">⚠ Metered connection. Using it may consume mobile data.</p>
                )}
              </div>
              <div className="flex flex-col space-y-2 w-full md:w-auto">
                <label className="flex items-center space-x-2 text-sm">
                  <input type="checkbox" checked={n.enabled} onChange={() => toggleEnabled(n.id, n.enabled)} className="form-checkbox h-4 w-4 text-blue-600" />
                  <span>Use for torrents</span>
                </label>
                <label className="flex items-center space-x-2 text-sm">
                  <input type="checkbox" checked={n.metered} onChange={() => toggleMetered(n.id, n.metered)} className="form-checkbox h-4 w-4 text-orange-600" />
                  <span>Metered connection</span>
                </label>
                <div className="pt-2 border-t mt-2 border-gray-200 dark:border-gray-700">
                  <div className="flex flex-col mb-1 text-sm">
                     <label className="text-gray-600 dark:text-gray-400 mb-1">Download Limit (KB/s)</label>
                     <input type="number" placeholder="0 (Unlimited)" className="p-1 text-sm border rounded bg-white dark:bg-gray-700 w-32" />
                  </div>
                  <div className="flex flex-col text-sm">
                     <label className="text-gray-600 dark:text-gray-400 mb-1">Upload Limit (KB/s)</label>
                     <input type="number" placeholder="0 (Unlimited)" className="p-1 text-sm border rounded bg-white dark:bg-gray-700 w-32" />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Networks;
