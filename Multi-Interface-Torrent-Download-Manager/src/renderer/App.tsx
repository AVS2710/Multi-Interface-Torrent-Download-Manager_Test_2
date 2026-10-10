import React, { useEffect, useState } from 'react';
import Downloads from './components/Downloads.js';
import Networks from './components/Networks.js';
import Settings from './components/Settings.js';
import AddTorrentModal from './components/AddTorrentModal.js';
import Toast from './components/Toast.js';

function applyTheme(theme: string): void {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.classList.toggle('dark', theme === 'dark' || (theme === 'system' && prefersDark));
}

const App: React.FC = () => {
  const [tab, setTab] = useState('downloads');
  const [showAdd, setShowAdd] = useState(false);
  const [initialInput, setInitialInput] = useState('');

  useEffect(() => {
    let disposed = false;
    const api = window.torrentApi;
    if (api) {
      void api.getSettings().then(settings => {
        if (!disposed) applyTheme(settings.theme || 'system');
      }).catch((error: unknown) => console.error('Could not load appearance settings:', error));

      api.subscribeToOpenTorrentInput(input => {
        setInitialInput(input);
        setShowAdd(true);
      });
    }

    const handleThemeChange = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      if (typeof detail === 'string') applyTheme(detail);
    };
    window.addEventListener('multitorrent-theme-change', handleThemeChange);

    return () => {
      disposed = true;
      api?.unsubscribeFromOpenTorrentInput();
      window.removeEventListener('multitorrent-theme-change', handleThemeChange);
    };
  }, []);

  const closeAdd = () => {
    setShowAdd(false);
    setInitialInput('');
  };

  return (
    <div className="flex h-screen bg-gray-100 text-gray-900 dark:bg-gray-900 dark:text-white">
      <div className="w-64 bg-gray-200 dark:bg-gray-800 p-4 flex flex-col gap-4">
        <h1 className="text-xl font-bold mb-4">MultiTorrent</h1>
        <button type="button" className="bg-blue-600 text-white px-4 py-2 rounded" onClick={() => setShowAdd(true)}>+ Add Torrent</button>
        <button type="button" className={`text-left p-2 rounded ${tab === 'downloads' ? 'bg-gray-300 dark:bg-gray-700' : ''}`} onClick={() => setTab('downloads')}>Downloads</button>
        <button type="button" className={`text-left p-2 rounded ${tab === 'networks' ? 'bg-gray-300 dark:bg-gray-700' : ''}`} onClick={() => setTab('networks')}>Networks</button>
        <button type="button" className={`text-left p-2 rounded ${tab === 'settings' ? 'bg-gray-300 dark:bg-gray-700' : ''}`} onClick={() => setTab('settings')}>Settings</button>
      </div>
      <div className="flex-1 overflow-auto">
        {tab === 'downloads' && <Downloads />}
        {tab === 'networks' && <Networks />}
        {tab === 'settings' && <Settings />}
      </div>
      {showAdd && <AddTorrentModal initialInput={initialInput} onClose={closeAdd} onAdded={() => setShowAdd(false)} />}
      <Toast />
    </div>
  );
};

export default App;
