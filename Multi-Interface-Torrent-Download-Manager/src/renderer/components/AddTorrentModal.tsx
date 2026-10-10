import React, { useEffect, useState } from 'react';
import { X, FolderOpen, UploadCloud } from 'lucide-react';
import type { TorrentMetadata } from '../../shared/torrentApi.js';

interface AddTorrentModalProps {
  onClose: () => void;
  onAdded: () => void;
}

const AddTorrentModal: React.FC<AddTorrentModalProps> = ({ onClose, onAdded }) => {
  const [magnetOrPath, setMagnetOrPath] = useState('');
  const [savePath, setSavePath] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [metadata, setMetadata] = useState<TorrentMetadata | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const api = window.torrentApi;
    if (!api) {
      setError('The desktop bridge did not load. Close and restart MultiTorrent.');
      return;
    }
    api.getSettings()
      .then(settings => setSavePath(settings.downloadDir || ''))
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Could not load settings.'));
  }, []);

  const parseMetadata = async (target: string) => {
    const value = typeof target === 'string' ? target.trim() : '';
    if (!value || /^magnet:/i.test(value) || /^https?:\/\//i.test(value)) {
      setMetadata(null);
      return;
    }

    const api = window.torrentApi;
    if (!api) {
      setError('The desktop bridge is unavailable. Restart MultiTorrent and try again.');
      return;
    }

    setLoadingMeta(true);
    setError(null);
    try {
      setMetadata(await api.parseTorrentFile(value));
    } catch (reason) {
      setMetadata(null);
      setError(reason instanceof Error ? reason.message : 'Could not read this torrent file.');
    } finally {
      setLoadingMeta(false);
    }
  };

  const handleBrowseLocation = async () => {
    setError(null);
    try {
      const selected = await window.torrentApi?.openFileDialog();
      if (selected) setSavePath(selected);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not open the folder picker.');
    }
  };

  const handleBrowseTorrent = async () => {
    setError(null);
    try {
      const selected = await window.torrentApi?.openTorrentFileDialog();
      if (selected) {
        setMagnetOrPath(selected);
        await parseMetadata(selected);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not open the torrent picker.');
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
    const file = event.dataTransfer.files.item(0) as (File & { path?: string }) | null;
    if (!file || !file.name.toLowerCase().endsWith('.torrent') || !file.path) {
      setError('Drop a local .torrent file, or use Choose File.');
      return;
    }
    setMagnetOrPath(file.path);
    await parseMetadata(file.path);
  };

  const handleAdd = async () => {
    const source = typeof magnetOrPath === 'string' ? magnetOrPath.trim() : '';
    const destination = typeof savePath === 'string' ? savePath.trim() : '';
    if (!source) {
      setError('Enter a magnet link, torrent URL, or choose a .torrent file.');
      return;
    }
    if (!destination) {
      setError('Choose a download directory.');
      return;
    }

    const api = window.torrentApi;
    if (!api) {
      setError('The desktop bridge is unavailable. Restart MultiTorrent and try again.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await api.addTorrent(source, destination);
      onAdded();
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The torrent could not be added.');
    } finally {
      setSaving(false);
    }
  };

  const sourceValue = typeof magnetOrPath === 'string' ? magnetOrPath : '';

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl border border-gray-700 flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-gray-700">
          <h3 className="text-xl font-bold">Add Torrent</h3>
          <button aria-label="Close Add Torrent" onClick={onClose} className="hover:text-gray-300 transition">
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-col md:flex-row flex-1 p-4 gap-6">
          <div className="flex-1 space-y-4">
            <div>
              <label htmlFor="torrent-source" className="block text-sm font-medium text-gray-300 mb-1">Torrent File, Magnet Link, or Torrent URL</label>
              <div className="flex gap-2">
                <input
                  id="torrent-source"
                  type="text"
                  className="flex-1 min-w-0 bg-gray-900 border border-gray-700 rounded p-2 focus:ring focus:ring-blue-500 outline-none"
                  placeholder="magnet:?xt=urn:btih:… or .torrent URL/path"
                  value={sourceValue}
                  onChange={event => {
                    setMagnetOrPath(event.target.value ?? '');
                    setError(null);
                    setMetadata(null);
                  }}
                  onBlur={() => {
                    const value = typeof magnetOrPath === 'string' ? magnetOrPath.trim() : '';
                    if (value && !/^magnet:/i.test(value) && !/^https?:\/\//i.test(value)) {
                      void parseMetadata(value);
                    }
                  }}
                />
                <button onClick={handleBrowseTorrent} className="bg-gray-700 hover:bg-gray-600 px-3 rounded flex items-center justify-center transition border border-gray-600 text-sm whitespace-nowrap">
                  Choose File
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">Magnet links and HTTP(S) links to .torrent files are supported.</p>
            </div>

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={event => { void handleDrop(event); }}
              className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center text-center transition ${isDragging ? 'border-blue-500 bg-blue-500/10' : 'border-gray-600 bg-gray-900/50'}`}
            >
              <UploadCloud size={32} className="text-gray-400 mb-2" />
              <p className="text-gray-400 text-sm">Drag and drop a .torrent file here</p>
            </div>

            <div>
              <label htmlFor="torrent-save-location" className="block text-sm font-medium text-gray-300 mb-1">Save Location</label>
              <div className="flex gap-2">
                <input
                  id="torrent-save-location"
                  type="text"
                  className="flex-1 min-w-0 bg-gray-900 border border-gray-700 rounded p-2 focus:ring focus:ring-blue-500 outline-none"
                  placeholder="/path/to/downloads"
                  value={savePath}
                  onChange={event => setSavePath(event.target.value ?? '')}
                />
                <button aria-label="Browse save location" onClick={handleBrowseLocation} className="bg-gray-700 hover:bg-gray-600 px-3 rounded flex items-center justify-center transition border border-gray-600">
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
                <p><span className="font-semibold">Name:</span><br />{metadata.name || 'Unknown'}</p>
                <p><span className="font-semibold">Total Size:</span><br /><span className="text-gray-500 italic">Not exposed by engine</span></p>
                <p><span className="font-semibold">Files:</span> <span className="text-gray-500 italic">Not exposed by engine</span></p>
              </div>
            ) : (
              <p className="text-gray-500 text-sm">Select a .torrent file to preview its name. Magnet metadata appears when the engine obtains it.</p>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-gray-700 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 hover:bg-gray-700 rounded transition">Cancel</button>
          <button
            onClick={() => { void handleAdd(); }}
            disabled={saving || loadingMeta || !sourceValue.trim() || !savePath.trim()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded transition shadow"
          >
            {saving ? 'Adding…' : 'Add Torrent'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddTorrentModal;
