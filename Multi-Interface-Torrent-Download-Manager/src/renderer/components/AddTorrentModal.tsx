import React, { useEffect, useState } from 'react';
import { X, FolderOpen, UploadCloud } from 'lucide-react';
import type { TorrentMetadata } from '../../shared/torrentApi.js';

interface AddTorrentModalProps {
  onClose: () => void;
  onAdded: () => void;
  initialInput?: string;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const AddTorrentModal: React.FC<AddTorrentModalProps> = ({ onClose, onAdded, initialInput = '' }) => {
  const [magnetOrPath, setMagnetOrPath] = useState(initialInput);
  const [savePath, setSavePath] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [metadata, setMetadata] = useState<TorrentMetadata | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const api = window.torrentApi;
    if (!api) {
      setError('The secure Electron preload bridge failed to load. Restart the app after rebuilding it.');
      return () => { cancelled = true; };
    }

    void api.getSettings().then(settings => {
      if (!cancelled && !savePath) setSavePath(settings.downloadDir || '');
    }).catch((reason: unknown) => {
      if (!cancelled) setError(`Could not load the default download folder: ${errorText(reason)}`);
    });

    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (initialInput) {
      setMagnetOrPath(initialInput);
      setError(null);
      setMetadata(null);
    }
  }, [initialInput]);

  const parseMetadata = async (targetPath: string) => {
    const api = window.torrentApi;
    if (!api) {
      setError('The Electron preload bridge is unavailable. Rebuild the app before adding torrents.');
      return;
    }
    if (typeof targetPath !== 'string' || !targetPath.trim()) {
      setError('Choose a .torrent file first.');
      return;
    }

    setLoadingMeta(true);
    setError(null);
    try {
      const data = await api.parseTorrentFile(targetPath);
      setMetadata(data);
    } catch (reason) {
      setMetadata(null);
      setError(`Could not read the selected torrent file: ${errorText(reason)}`);
    } finally {
      setLoadingMeta(false);
    }
  };

  const handleBrowseLocation = async () => {
    const api = window.torrentApi;
    if (!api) {
      setError('The secure Electron preload bridge is unavailable. Rebuild the app.');
      return;
    }
    try {
      setError(null);
      const selectedPath = await api.openFileDialog();
      if (selectedPath) setSavePath(selectedPath);
    } catch (reason) {
      setError(`Could not open the download-folder picker: ${errorText(reason)}`);
    }
  };

  const handleBrowseTorrent = async () => {
    const api = window.torrentApi;
    if (!api) {
      setError('The secure Electron preload bridge is unavailable. Rebuild the app.');
      return;
    }
    try {
      setError(null);
      const selectedPath = await api.openTorrentFileDialog();
      if (selectedPath) {
        setMagnetOrPath(selectedPath);
        await parseMetadata(selectedPath);
      }
    } catch (reason) {
      setError(`Could not open the torrent-file picker: ${errorText(reason)}`);
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = async (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files.item(0);
    if (!file || !file.name.toLowerCase().endsWith('.torrent')) {
      setError('Drop a .torrent file, or use Choose File.');
      return;
    }

    try {
      const api = window.torrentApi;
      if (!api) throw new Error('The secure Electron preload bridge is unavailable.');
      const filePath = api.getPathForFile(file);
      if (typeof filePath !== 'string' || !filePath.trim()) {
        throw new Error('Electron could not resolve the dropped file path. Use Choose File instead.');
      }
      setMagnetOrPath(filePath);
      await parseMetadata(filePath);
    } catch (reason) {
      setError(`Could not read the dropped file: ${errorText(reason)}`);
    }
  };

  const handleAdd = async () => {
    const api = window.torrentApi;
    const input = typeof magnetOrPath === 'string' ? magnetOrPath.trim() : '';
    const folder = typeof savePath === 'string' ? savePath.trim() : '';

    if (!api) {
      setError('The secure Electron preload bridge is unavailable. Rebuild the app.');
      return;
    }
    if (!input) {
      setError('Enter a magnet link, direct .torrent URL, or choose a .torrent file.');
      return;
    }
    if (!folder) {
      setError('Choose a download folder before adding the torrent.');
      return;
    }
    if (!/^(magnet:\?|https?:\/\/|file:\/\/|\/|\.\.?\/|[A-Za-z]:\\)/i.test(input)) {
      setError('Enter a valid magnet link, HTTP(S) torrent URL, or local torrent-file path.');
      return;
    }

    setAdding(true);
    setError(null);
    try {
      await api.addTorrent(input, folder);
      onAdded();
      onClose();
    } catch (reason) {
      setError(`Could not add the torrent: ${errorText(reason)}`);
    } finally {
      setAdding(false);
    }
  };

  const isMagnetInput = typeof magnetOrPath === 'string' && /^magnet:\?/i.test(magnetOrPath.trim());

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div role="dialog" aria-modal="true" aria-label="Add Torrent" className="bg-gray-800 text-white rounded-lg shadow-xl w-full max-w-2xl border border-gray-700 flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-gray-700">
          <h3 className="text-xl font-bold">Add Torrent</h3>
          <button type="button" aria-label="Close Add Torrent" onClick={onClose} className="hover:text-gray-300 transition">
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-col md:flex-row flex-1 p-4 gap-6">
          <div className="flex-1 space-y-4">
            <div>
              <label htmlFor="torrent-source" className="block text-sm font-medium text-gray-300 mb-1">Torrent File or Magnet Link</label>
              <div className="flex gap-2">
                <input
                  id="torrent-source"
                  aria-label="Torrent File or Magnet Link"
                  type="text"
                  className="flex-1 min-w-0 bg-gray-900 border border-gray-700 rounded p-2 focus:ring focus:ring-blue-500 outline-none"
                  placeholder="magnet:?xt=urn:btih:… or .torrent URL/path"
                  value={magnetOrPath}
                  onChange={(event) => {
                    const value = event.target.value;
                    setMagnetOrPath(value);
                    setError(null);
                    if (/^magnet:\?/i.test(value.trim())) setMetadata(null);
                  }}
                />
                <button
                  type="button"
                  onClick={() => void handleBrowseTorrent()}
                  className="bg-gray-700 hover:bg-gray-600 px-3 rounded flex items-center justify-center transition border border-gray-600 text-sm whitespace-nowrap"
                >
                  Choose File
                </button>
              </div>
              {isMagnetInput && <p className="text-xs text-gray-400 mt-1">Magnet metadata is retrieved by the torrent engine after adding.</p>}
            </div>

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={(event) => void handleDrop(event)}
              className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center text-center transition ${isDragging ? 'border-blue-500 bg-blue-500/10' : 'border-gray-600 bg-gray-900/50'}`}
            >
              <UploadCloud size={32} className="text-gray-400 mb-2" />
              <p className="text-gray-400 text-sm">Drag and drop a .torrent file here</p>
            </div>

            <div>
              <label htmlFor="download-folder" className="block text-sm font-medium text-gray-300 mb-1">Save Location</label>
              <div className="flex gap-2">
                <input
                  id="download-folder"
                  aria-label="Save Location"
                  type="text"
                  className="flex-1 min-w-0 bg-gray-900 border border-gray-700 rounded p-2 focus:ring focus:ring-blue-500 outline-none"
                  placeholder="/path/to/downloads"
                  value={savePath}
                  onChange={(event) => setSavePath(event.target.value)}
                />
                <button
                  type="button"
                  aria-label="Browse download folder"
                  title="Browse download folder"
                  onClick={() => void handleBrowseLocation()}
                  className="bg-gray-700 hover:bg-gray-600 px-3 rounded flex items-center justify-center transition border border-gray-600"
                >
                  <FolderOpen size={18} />
                </button>
              </div>
            </div>
          </div>

          <div className="w-full md:w-64 bg-gray-900 border border-gray-700 rounded p-4 flex flex-col">
            <h4 className="font-semibold text-gray-300 border-b border-gray-700 pb-2 mb-2">Metadata Preview</h4>
            {error ? (
              <p role="alert" className="text-red-400 text-sm">{error}</p>
            ) : loadingMeta ? (
              <p className="text-blue-400 text-sm">Reading torrent metadata…</p>
            ) : metadata ? (
              <div className="text-sm text-gray-300 space-y-2 overflow-auto flex-1">
                <p><span className="font-semibold">Name:</span><br />{metadata.name || 'Not exposed by engine'}</p>
                <p><span className="font-semibold">Total Size:</span><br /><span className="text-gray-500 italic">{metadata.totalSize === undefined ? 'Not exposed by engine' : `${(metadata.totalSize / 1024 / 1024).toFixed(2)} MB`}</span></p>
                <p><span className="font-semibold">Files:</span><br /><span className="text-gray-500 italic">{metadata.numFiles === undefined ? 'Not exposed by engine' : metadata.numFiles}</span></p>
              </div>
            ) : (
              <p className="text-gray-500 text-sm">Choose a torrent file to preview metadata, or enter a magnet link/URL.</p>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-gray-700 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2 hover:bg-gray-700 rounded transition">Cancel</button>
          <button
            type="button"
            onClick={() => void handleAdd()}
            disabled={!magnetOrPath.trim() || !savePath.trim() || adding || loadingMeta}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded transition shadow"
          >
            {adding ? 'Adding…' : 'Add Torrent'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddTorrentModal;
