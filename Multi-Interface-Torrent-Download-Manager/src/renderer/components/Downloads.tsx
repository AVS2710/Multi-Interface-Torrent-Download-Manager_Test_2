import React, { useEffect, useState } from 'react';
import type { TorrentSummary } from '../../shared/torrentApi.js';

const Downloads: React.FC = () => {
  const [torrents, setTorrents] = useState<TorrentSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const api = window.torrentApi;
    if (!api) {
      setError('The desktop bridge did not load. Restart MultiTorrent.');
      return;
    }

    api.subscribeToTorrents(setTorrents);
    api.getTorrents().then(setTorrents).catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : 'Could not load downloads.');
    });
    return () => api.unsubscribeFromTorrents();
  }, []);

  const runAction = async (action: () => Promise<void>) => {
    setError(null);
    try {
      await action();
      setTorrents(await window.torrentApi?.getTorrents() ?? []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Torrent action failed.');
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">Downloads</h2>
      {error && <p role="alert" className="mb-4 rounded border border-red-700 bg-red-950/50 p-3 text-sm text-red-300">{error}</p>}
      {torrents.length === 0 ? (
        <p>No active downloads.</p>
      ) : (
        <ul className="space-y-4">
          {torrents.map(torrent => (
            <li key={torrent.id} className="border p-4 rounded-md bg-gray-50 dark:bg-gray-800 flex justify-between items-center gap-4">
              <div className="min-w-0">
                <h3 className="font-semibold text-lg break-words">{torrent.name || 'Torrent metadata pending'}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Progress: {(Math.max(0, Math.min(1, torrent.progress || 0)) * 100).toFixed(2)}%</p>
                <div className="text-sm text-gray-500 flex flex-wrap gap-x-4">
                  <span>↓ {((torrent.download_rate || 0) / 1024).toFixed(2)} KB/s</span>
                  <span>↑ {typeof torrent.upload_rate === 'number' ? `${(torrent.upload_rate / 1024).toFixed(2)} KB/s` : 'Upload speed unavailable'}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <button onClick={() => void runAction(() => window.torrentApi!.pauseTorrent(torrent.id))} className="px-3 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600 text-sm">Pause</button>
                <button onClick={() => void runAction(() => window.torrentApi!.resumeTorrent(torrent.id))} className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm">Resume</button>
                <button onClick={() => void runAction(() => window.torrentApi!.removeTorrent(torrent.id))} className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm">Remove</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default Downloads;
