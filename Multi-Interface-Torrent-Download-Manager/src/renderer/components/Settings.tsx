import React, { useEffect, useState } from 'react';

const Settings: React.FC = () => {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const api = window.torrentApi;
    if (!api) {
      setError('The desktop bridge did not load. Restart MultiTorrent.');
      return;
    }
    api.getSettings().then(setSettings).catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : 'Could not load settings.');
    });
  }, []);

  const handleChange = async (key: string, value: string) => {
    const api = window.torrentApi;
    setSettings(current => ({ ...current, [key]: value }));
    if (!api) {
      setError('The desktop bridge is unavailable.');
      return;
    }
    setError(null);
    try {
      await api.updateSettings(key, value);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save settings.');
    }
  };

  return (
    <div className="p-4 max-w-2xl">
      <h2 className="text-2xl font-bold mb-4">Settings</h2>
      {error && <p role="alert" className="mb-4 rounded border border-red-700 bg-red-950/50 p-3 text-sm text-red-300">{error}</p>}
      <div className="space-y-6">
        <section>
          <h3 className="text-xl font-semibold mb-2 border-b pb-2">General</h3>
          <div className="space-y-4">
            <div>
              <label htmlFor="setting-download-dir" className="block text-sm font-medium">Download Directory</label>
              <input id="setting-download-dir" type="text" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm text-black p-2 border" value={settings.downloadDir || ''} onChange={event => void handleChange('downloadDir', event.target.value)} />
            </div>
            <div>
              <label htmlFor="setting-theme" className="block text-sm font-medium">Theme</label>
              <select id="setting-theme" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm text-black p-2 border" value={settings.theme || 'system'} onChange={event => void handleChange('theme', event.target.value)}>
                <option value="system">System Default</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </div>
          </div>
        </section>
        <section>
          <h3 className="text-xl font-semibold mb-2 border-b pb-2">BitTorrent</h3>
          <div className="space-y-4">
            <label className="flex items-center space-x-2">
              <input type="checkbox" checked={(settings.enableDht || 'true') === 'true'} onChange={event => void handleChange('enableDht', event.target.checked ? 'true' : 'false')} />
              <span>Enable DHT (Distributed Hash Table)</span>
            </label>
            <label className="flex items-center space-x-2">
              <input type="checkbox" checked={(settings.enablePex || 'true') === 'true'} onChange={event => void handleChange('enablePex', event.target.checked ? 'true' : 'false')} />
              <span>Enable PEX (Peer Exchange)</span>
            </label>
          </div>
        </section>
        <section>
          <h3 className="text-xl font-semibold mb-2 border-b pb-2">Bandwidth Limits (Global)</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="setting-download-limit" className="block text-sm font-medium">Download Limit (KB/s)</label>
              <input id="setting-download-limit" type="number" min="0" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm text-black p-2 border" placeholder="0 (Unlimited)" value={settings.globalDownloadLimit ?? '0'} onChange={event => void handleChange('globalDownloadLimit', event.target.value)} />
            </div>
            <div>
              <label htmlFor="setting-upload-limit" className="block text-sm font-medium">Upload Limit (KB/s)</label>
              <input id="setting-upload-limit" type="number" min="0" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm text-black p-2 border" placeholder="0 (Unlimited)" value={settings.globalUploadLimit ?? '0'} onChange={event => void handleChange('globalUploadLimit', event.target.value)} />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Settings;
