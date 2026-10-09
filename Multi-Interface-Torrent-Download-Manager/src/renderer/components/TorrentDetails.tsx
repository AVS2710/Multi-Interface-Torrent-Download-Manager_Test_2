import React, { useState } from 'react';

const TorrentDetails: React.FC = () => {
  const [activeTab, setActiveTab] = useState('Overview');

  const tabs = ['Overview', 'Files', 'Peers', 'Trackers', 'Pieces', 'Networks', 'Logs'];

  return (
    <div className="p-4 flex flex-col h-full">
      <h2 className="text-2xl font-bold mb-4">Torrent Details</h2>
      <div className="flex border-b border-gray-300 dark:border-gray-700 mb-4 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 whitespace-nowrap ${activeTab === tab ? 'border-b-2 border-blue-500 text-blue-600 font-semibold' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="flex-1 bg-gray-50 dark:bg-gray-800 rounded p-4 overflow-y-auto">
        {activeTab === 'Overview' && (
          <div>
            <h3 className="font-bold mb-2">Overview</h3>
            <p className="text-gray-500">Basic information, transfer speeds, and metadata will appear here.</p>
          </div>
        )}
        {activeTab === 'Files' && (
          <div>
            <h3 className="font-bold mb-2">Files</h3>
            <p className="text-gray-500">File tree and priority selection will appear here.</p>
          </div>
        )}
        {activeTab === 'Peers' && (
          <div>
            <h3 className="font-bold mb-2">Peers</h3>
            <p className="text-gray-500">Connected peers, IP addresses, and their assigned interfaces will appear here.</p>
          </div>
        )}
        {activeTab === 'Trackers' && (
          <div>
            <h3 className="font-bold mb-2">Trackers</h3>
            <p className="text-gray-500">Tracker statuses and announce information will appear here.</p>
          </div>
        )}
        {activeTab === 'Pieces' && (
          <div>
            <h3 className="font-bold mb-2">Pieces</h3>
            <p className="text-gray-500">Piece map visualization will appear here.</p>
          </div>
        )}
        {activeTab === 'Networks' && (
          <div>
            <h3 className="font-bold mb-2">Networks</h3>
            <p className="text-gray-500">Per-interface bandwidth utilization and aggregation stats for this torrent will appear here.</p>
          </div>
        )}
        {activeTab === 'Logs' && (
          <div>
            <h3 className="font-bold mb-2">Logs</h3>
            <p className="text-gray-500">Debug logs and engine events for this torrent will appear here.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TorrentDetails;
