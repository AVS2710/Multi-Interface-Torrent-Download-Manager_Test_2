import React, { useEffect, useState } from 'react';
import type { NetworkInfo } from '../../shared/torrentApi.js';

const Networks: React.FC = () => {
  const [networks, setNetworks] = useState<NetworkInfo[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const api = window.torrentApi;
    if (!api) {
      setError('The desktop bridge did not load. Restart MultiTorrent.');
      return;
    }
    api.getNetworks().then(setNetworks).catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : 'Could not load network interfaces.');
    });
  }, []);

  const updateNetwork = async (id: string, preferences: Record<string, unknown>) => {
    const api = window.torrentApi;
    if (!api) {
      setError('The desktop bridge is unavailable.');
      return;
    }
    setError(null);
    try {
      await api.updateNetworkPreferences(id, preferences);
      setNetworks(current => current.map(network => network.id === id
        ? { ...network, ...preferences }
        : network));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not update network preferences.');
    }
  };

  const getSharedGatewayWarning = (network: NetworkInfo) => {
    const hasSimilarIP = networks.some(other =>
      other.id !== network.id &&
      other.ipv4Addresses.some(address =>
        network.ipv4Addresses.some(otherAddress =>
          otherAddress.substring(0, otherAddress.lastIndexOf('.')) === address.substring(0, address.lastIndexOf('.'))
        )
      )
    );
    return hasSimilarIP ? 'This interface may share an upstream network with another interface.' : null;
  };

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">Networks</h2>
      <p className="text-sm text-gray-400 mb-6">
        Multiple interfaces can help only when they provide independent Internet paths. Adapters connected to the same router usually share the same upstream bandwidth.
      </p>
      {error && <p role="alert" className="mb-4 rounded border border-red-700 bg-red-950/50 p-3 text-sm text-red-300">{error}</p>}
      {networks.length === 0 && !error && <p className="text-gray-400">No external IPv4 interfaces detected.</p>}
      <div className="grid gap-4">
        {networks.map(network => {
          const warning = getSharedGatewayWarning(network);
          return (
            <div key={network.id} className="border p-4 rounded-md bg-gray-50 dark:bg-gray-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="flex-1">
                <h3 className="font-bold text-lg">{network.name} ({network.type})</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">{network.ipv4Addresses.join(', ')}</p>
                <p className="text-sm text-gray-500 mt-1">
                  Status: <span className={network.hasInternet ? 'text-green-600' : 'text-red-500'}>{network.state}</span>
                </p>
                {warning && <p className="text-sm text-yellow-600 mt-1">⚠ {warning}</p>}
                {network.metered && <p className="text-sm text-orange-500 mt-1">⚠ Metered connection: using it may consume mobile data.</p>}
              </div>
              <div className="flex flex-col gap-2 w-full md:w-auto">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={network.enabled} onChange={event => void updateNetwork(network.id, { enabled: event.target.checked })} />
                  <span>Use for torrents</span>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={network.metered} onChange={event => void updateNetwork(network.id, { metered: event.target.checked })} />
                  <span>Metered connection</span>
                </label>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Networks;
