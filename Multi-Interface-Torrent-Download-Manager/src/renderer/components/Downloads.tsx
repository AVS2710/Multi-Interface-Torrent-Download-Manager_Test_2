import React, { useEffect, useState } from 'react';
import type { UITorrentState } from '../../shared/torrentApi.js';

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const Downloads: React.FC = () => {
  const [torrents, setTorrents] = useState<UITorrentState[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    const api = window.torrentApi;
    if (!api) {
      setError('The secure Electron preload bridge is unavailable. Rebuild the app.');
      return;
    }

    void api.getTorrents().then(current => {
      if (!disposed) setTorrents(current);
    }).catch(reason => {
      if (!disposed) setError(`Could not load downloads: ${errorText(reason)}`);
    });
    api.subscribeToTorrents(current => {
      if (!disposed) setTorrents(current);
    });

    return () => {
      disposed = true;
      api.unsubscribeFromTorrents();
    };
  }, []);

  const runAction = async (action: () => Promise<void>) => {
    setError(null);
    try {
      await action();
    } catch (reason) {
      setError(errorText(reason));
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">Downloads</h2>
      {error && <p role="alert" className="mb-4 rounded border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-300">{error}</p>}
      {torrents.length === 0 ? (
        <p className="text-gray-600 dark:text-gray-400">No active downloads. Choose <strong>+ Add Torrent</strong> to add a magnet link or torrent file.</p>
      ) : (
        <ul className="space-y-4">
          {torrents.map(torrent => (
            <li key={torrent.id} className="border p-4 rounded-md bg-gray-50 dark:bg-gray-800 flex justify-between items-center gap-4">
              <div className="min-w-0">
                <h3 className="font-semibold text-lg truncate">{torrent.name || 'Fetching torrent metadata…'}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Progress: {typeof torrent.progress === 'number' ? `${(Math.max(0, Math.min(1, torrent.progress)) * 100).toFixed(2)}%` : 'Not reported by engine'}
                </p>
                <div className="text-sm text-gray-500 flex flex-wrap gap-x-4">
                  <span>↓ {typeof torrent.download_rate === 'number' ? `${(torrent.download_rate / 1024).toFixed(2)} KB/s` : '—'}</span>
                  <span>↑ {typeof torrent.upload_rate === 'number' ? `${(torrent.upload_rate / 1024).toFixed(2)} KB/s` : 'Not reported by engine'}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => void runAction(() => window.torrentApi!.pauseTorrent(torrent.id))}
                  className="px-3 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600 text-sm"
                >Pause</button>
                <button
                  type="button"
                  onClick={() => void runAction(() => window.torrentApi!.resumeTorrent(torrent.id))}
                  className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                >Resume</button>
                <button
                  type="button"
                  onClick={() => void runAction(() => window.torrentApi!.removeTorrent(torrent.id))}
                  className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
                >Remove</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default Downloads;
