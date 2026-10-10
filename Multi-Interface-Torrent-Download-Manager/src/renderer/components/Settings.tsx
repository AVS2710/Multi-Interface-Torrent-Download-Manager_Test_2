import React, { useEffect, useState } from 'react';

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function applyTheme(theme: string): void {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.classList.toggle('dark', theme === 'dark' || (theme === 'system' && prefersDark));
}

const Settings: React.FC = () => {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let disposed = false;
    const api = window.torrentApi;
    if (!api) {
      setError('The secure Electron preload bridge is unavailable. Rebuild the app.');
      return;
    }
    void api.getSettings().then(values => {
      if (disposed) return;
      setSettings(values);
      applyTheme(values.theme || 'system');
      setLoaded(true);
    }).catch(reason => {
      if (!disposed) setError(`Could not load settings: ${errorText(reason)}`);
    });
    return () => { disposed = true; };
  }, []);

  const updateSetting = async (key: string, value: string) => {
    const api = window.torrentApi;
    if (!api) {
      setError('The secure Electron preload bridge is unavailable. Rebuild the app.');
      return;
    }

    setError(null);
    try {
      await api.updateSettings(key, value);
      setSettings(previous => ({ ...previous, [key]: value }));
      if (key === 'theme') {
        applyTheme(value);
        window.dispatchEvent(new CustomEvent('multitorrent-theme-change', { detail: value }));
      }
    } catch (reason) {
      setError(`Could not save ${key}: ${errorText(reason)}`);
    }
  };

  const editSetting = (key: string, value: string) => {
    setSettings(previous => ({ ...previous, [key]: value }));
  };

  if (!loaded && !error) {
    return <div className="p-4"><h2 className="text-2xl font-bold mb-4">Settings</h2><p className="text-gray-500">Loading settings…</p></div>;
  }

  return (
    <div className="p-4 max-w-2xl">
      <h2 className="text-2xl font-bold mb-4">Settings</h2>
      {error && <p role="alert" className="mb-4 rounded border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-300">{error}</p>}

      <div className="space-y-6">
        <section>
          <h3 className="text-xl font-semibold mb-2 border-b pb-2">General</h3>
          <div className="space-y-4">
            <div>
              <label htmlFor="download-dir" className="block text-sm font-medium">Download Directory</label>
              <input
                id="download-dir"
                type="text"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm text-black p-2 border"
                value={settings.downloadDir || ''}
                onChange={event => editSetting('downloadDir', event.target.value)}
                onBlur={() => { if (settings.downloadDir) void updateSetting('downloadDir', settings.downloadDir); }}
              />
            </div>
            <div>
              <label htmlFor="theme" className="block text-sm font-medium">Theme</label>
              <select
                id="theme"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm text-black p-2 border"
                value={settings.theme || 'system'}
                onChange={event => void updateSetting('theme', event.target.value)}
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
          <label className="flex items-center space-x-2 text-sm">
            <input
              type="checkbox"
              className="form-checkbox h-4 w-4 text-blue-600"
              checked={settings.enableDht === 'true'}
              onChange={event => void updateSetting('enableDht', event.target.checked ? 'true' : 'false')}
            />
            <span>Enable DHT (Distributed Hash Table)</span>
          </label>
          <p className="mt-2 text-sm text-gray-500">Peer Exchange (PEX) follows the native engine defaults; this binding does not expose a reliable global PEX toggle.</p>
        </section>

        <section>
          <h3 className="text-xl font-semibold mb-2 border-b pb-2">Bandwidth Limits (Global)</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="download-limit" className="block text-sm font-medium">Download Limit (KB/s)</label>
              <input
                id="download-limit"
                type="number"
                min="0"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm text-black p-2 border"
                placeholder="0 (Unlimited)"
                value={settings.globalDownloadLimit ?? '0'}
                onChange={event => editSetting('globalDownloadLimit', event.target.value)}
                onBlur={() => void updateSetting('globalDownloadLimit', settings.globalDownloadLimit ?? '0')}
              />
            </div>
            <div>
              <label htmlFor="upload-limit" className="block text-sm font-medium">Upload Limit (KB/s)</label>
              <input
                id="upload-limit"
                type="number"
                min="0"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm text-black p-2 border"
                placeholder="0 (Unlimited)"
                value={settings.globalUploadLimit ?? '0'}
                onChange={event => editSetting('globalUploadLimit', event.target.value)}
                onBlur={() => void updateSetting('globalUploadLimit', settings.globalUploadLimit ?? '0')}
              />
            </div>
          </div>
          <p className="mt-2 text-xs text-gray-500">Limits are applied to the libtorrent session. Use 0 for unlimited bandwidth.</p>
        </section>
      </div>
    </div>
  );
};

export default Settings;
