import React, { useState } from 'react';
import Downloads from './components/Downloads.js';
import Networks from './components/Networks.js';
import Settings from './components/Settings.js';
import AddTorrentModal from './components/AddTorrentModal.js';
import Toast from './components/Toast.js';

const App: React.FC = () => {
  const [tab, setTab] = useState('downloads');
  const [showAdd, setShowAdd] = useState(false);

  return (
    <div className="flex h-screen bg-gray-900 text-white">
      <div className="w-64 bg-gray-800 p-4 flex flex-col gap-4">
        <h1 className="text-xl font-bold mb-4">MultiTorrent</h1>
        <button className="bg-blue-600 px-4 py-2 rounded" onClick={() => setShowAdd(true)}>+ Add Torrent</button>
        <button className={`text-left p-2 rounded ${tab === 'downloads' ? 'bg-gray-700' : ''}`} onClick={() => setTab('downloads')}>Downloads</button>
        <button className={`text-left p-2 rounded ${tab === 'networks' ? 'bg-gray-700' : ''}`} onClick={() => setTab('networks')}>Networks</button>
        <button className={`text-left p-2 rounded ${tab === 'settings' ? 'bg-gray-700' : ''}`} onClick={() => setTab('settings')}>Settings</button>
      </div>
      <div className="flex-1 overflow-auto">
        {tab === 'downloads' && <Downloads />}
        {tab === 'networks' && <Networks />}
        {tab === 'settings' && <Settings />}
      </div>
      {showAdd && <AddTorrentModal onClose={() => setShowAdd(false)} onAdded={() => setShowAdd(false)} />}
      <Toast />
    </div>
  );
};

export default App;
