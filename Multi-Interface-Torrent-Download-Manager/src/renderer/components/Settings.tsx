import React, { useState, useEffect } from 'react';

const Settings: React.FC = () => {
  const [settings, setSettings] = useState<Record<string, string>>({});

  const torrentApi = (window as unknown as { torrentApi?: { getSettings: () => Promise<Record<string, string>>, updateSettings: (key: string, value: string) => Promise<void> } }).torrentApi;

  useEffect(() => {
    if (torrentApi) {
      torrentApi.getSettings().then(setSettings).catch(console.error);
    }
  }, [torrentApi]);

  const handleChange = (key: string, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    if (torrentApi) {
      torrentApi.updateSettings(key, value).catch(console.error);
    }
  };

  return (
    <div className="p-4 max-w-2xl">
      <h2 className="text-2xl font-bold mb-4">Settings</h2>

      <div className="space-y-6">
        <section>
          <h3 className="text-xl font-semibold mb-2 border-b pb-2">General</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium">Download Directory</label>
              <input
                type="text"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm text-black p-2 border"
                value={settings['downloadDir'] || ''}
                onChange={(e) => handleChange('downloadDir', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Theme</label>
              <select
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm text-black p-2 border"
                value={settings['theme'] || 'system'}
                onChange={(e) => handleChange('theme', e.target.value)}
              >
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
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                className="form-checkbox h-4 w-4 text-blue-600"
                checked={settings['enableDht'] === 'true'}
                onChange={(e) => handleChange('enableDht', e.target.checked ? 'true' : 'false')}
              />
              <label className="text-sm font-medium">Enable DHT (Distributed Hash Table)</label>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                className="form-checkbox h-4 w-4 text-blue-600"
                checked={settings['enablePex'] === 'true'}
                onChange={(e) => handleChange('enablePex', e.target.checked ? 'true' : 'false')}
              />
              <label className="text-sm font-medium">Enable PEX (Peer Exchange)</label>
            </div>
          </div>
        </section>

        <section>
          <h3 className="text-xl font-semibold mb-2 border-b pb-2">Bandwidth Limits (Global)</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium">Download Limit (KB/s)</label>
              <input
                type="number"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm text-black p-2 border"
                placeholder="0 (Unlimited)"
                value={settings['globalDownloadLimit'] || ''}
                onChange={(e) => handleChange('globalDownloadLimit', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Upload Limit (KB/s)</label>
              <input
                type="number"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm text-black p-2 border"
                placeholder="0 (Unlimited)"
                value={settings['globalUploadLimit'] || ''}
                onChange={(e) => handleChange('globalUploadLimit', e.target.value)}
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Settings;
