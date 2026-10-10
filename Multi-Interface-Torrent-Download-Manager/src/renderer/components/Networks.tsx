import React, { useEffect, useState } from 'react';
import type { AppNetwork } from '../../shared/torrentApi.js';

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const Networks: React.FC = () => {
  const [networks, setNetworks] = useState<AppNetwork[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let disposed = false;
    const api = window.torrentApi;
    if (!api) {
      setError('The secure Electron preload bridge is unavailable. Rebuild the app.');
      setLoading(false);
      return;
    }
    void api.getNetworks().then(values => {
      if (!disposed) setNetworks(values);
    }).catch(reason => {
      if (!disposed) setError(`Could not read network interfaces: ${errorText(reason)}`);
    }).finally(() => {
      if (!disposed) setLoading(false);
    });
    return () => { disposed = true; };
  }, []);

  const updatePreference = async (id: string, updates: Record<string, unknown>) => {
    const api = window.torrentApi;
    if (!api) {
      setError('The secure Electron preload bridge is unavailable. Rebuild the app.');
      return;
    }
    setError(null);
    try {
      await api.updateNetworkPreferences(id, updates);
      setNetworks(previous => previous.map(network => network.id === id ? { ...network, ...updates } : network));
    } catch (reason) {
      setError(`Could not update ${id}: ${errorText(reason)}`);
    }
  };

  const getSharedGatewayWarning = (network: AppNetwork) => {
    const sharesSubnet = networks.some(other =>
      other.id !== network.id &&
      other.ipv4Addresses.some(otherIp =>
        network.ipv4Addresses.some(ip =>
          otherIp.substring(0, otherIp.lastIndexOf('.')) === ip.substring(0, ip.lastIndexOf('.'))
        )
      )
    );
    return sharesSubnet ? 'This interface may share a local subnet with another interface.' : null;
  };

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">Networks</h2>
      <p className="text-sm text-gray-500 mb-6">
        Multi-network downloads work best with independent Internet connections. Two adapters connected to the same router usually share upstream bandwidth.
      </p>
      {error && <p role="alert" className="mb-4 rounded border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-300">{error}</p>}
      {loading ? <p className="text-gray-500">Detecting network interfaces…</p> : null}
      {!loading && !error && networks.length === 0 && <p className="text-gray-500">No non-loopback IPv4 network interfaces were detected.</p>}
      <div className="grid gap-4">
        {networks.map(network => {
          const warning = getSharedGatewayWarning(network);
          return (
            <div key={network.id} className="border p-4 rounded-md bg-gray-50 dark:bg-gray-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="flex-1">
                <h3 className="font-bold text-lg">{network.displayName || network.name} ({network.type})</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">{network.ipv4Addresses.join(', ') || 'No IPv4 address'}</p>
                <p className="text-sm text-gray-500 mt-1">
                  Status: <span className={network.hasInternet ? 'text-green-600' : 'text-red-500'}>{network.state}</span>
                </p>
                {warning && <p className="text-sm text-yellow-600 mt-1">⚠ {warning}</p>}
                {network.metered && <p className="text-sm text-orange-500 mt-1">⚠ Metered connection; using it may consume mobile data.</p>}
              </div>
              <div className="flex flex-col space-y-3 w-full md:w-56">
                <label className="flex items-center space-x-2 text-sm">
                  <input type="checkbox" checked={network.enabled} onChange={event => void updatePreference(network.id, { enabled: event.target.checked })} className="form-checkbox h-4 w-4 text-blue-600" />
                  <span>Use for torrents</span>
                </label>
                <label className="flex items-center space-x-2 text-sm">
                  <input type="checkbox" checked={network.metered} onChange={event => void updatePreference(network.id, { metered: event.target.checked })} className="form-checkbox h-4 w-4 text-orange-600" />
                  <span>Metered connection</span>
                </label>
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-5 text-xs text-gray-500">Per-interface bandwidth caps are not exposed by the current native binding. Global rate limits are available in Settings.</p>
    </div>
  );
};

export default Networks;
