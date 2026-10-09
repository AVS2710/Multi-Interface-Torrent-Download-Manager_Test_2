import React, { useState, useEffect } from 'react';

interface Torrent {
  id: number;
  name: string;
  progress: number;
  download_rate: number;
  upload_rate: number;
  state: number;
}

const Downloads: React.FC = () => {
  const [torrents, setTorrents] = useState<Torrent[]>([]);

  useEffect(() => {
    const torrentApi = (window as unknown as {
      torrentApi?: {
        subscribeToTorrents: (cb: (torrents: Torrent[]) => void) => void,
        unsubscribeFromTorrents: () => void,
        pauseTorrent: (id: number) => void,
        resumeTorrent: (id: number) => void,
        removeTorrent: (id: number) => void
      }
    }).torrentApi;

    if (torrentApi) {
      torrentApi.subscribeToTorrents((data) => {
        setTorrents(data);
      });
      return () => torrentApi.unsubscribeFromTorrents();
    }
  }, []);

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">Downloads</h2>
      {torrents.length === 0 ? (
        <p>No active downloads.</p>
      ) : (
        <ul className="space-y-4">
          {torrents.map((t) => (
            <li key={t.id} className="border p-4 rounded-md bg-gray-50 dark:bg-gray-800 flex justify-between items-center">
              <div>
                <h3 className="font-semibold text-lg">{t.name}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Progress: {(t.progress * 100).toFixed(2)}%</p>
                <div className="text-sm text-gray-500 flex space-x-4">
                  <span>↓ {(t.download_rate / 1024).toFixed(2)} KB/s</span>
                  <span>↑ {(t.upload_rate / 1024).toFixed(2)} KB/s</span>
                </div>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => (window as any).torrentApi.pauseTorrent(t.id)}
                  className="px-3 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600 text-sm"
                >
                  Pause
                </button>
                <button
                  onClick={() => (window as any).torrentApi.resumeTorrent(t.id)}
                  className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                >
                  Resume
                </button>
                <button
                  onClick={() => (window as any).torrentApi.removeTorrent(t.id)}
                  className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default Downloads;
