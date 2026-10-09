import React, { useState } from 'react';
import { X, FolderOpen, UploadCloud } from 'lucide-react';

interface AddTorrentModalProps {
  onClose: () => void;
  onAdded: () => void;
}

interface TorrentMetadata {
  name?: string;
  totalSize?: number;
  numFiles?: number;
  files?: { path: string }[];
}

const AddTorrentModal: React.FC<AddTorrentModalProps> = ({ onClose, onAdded }) => {
  const [magnetOrPath, setMagnetOrPath] = useState('');
  const [savePath, setSavePath] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [metadata, setMetadata] = useState<TorrentMetadata | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const torrentApi = (window as unknown as { torrentApi?: {
    openFileDialog: () => Promise<string | undefined>;
    openTorrentFileDialog: () => Promise<string | undefined>;
    parseTorrentFile: (path: string) => Promise<TorrentMetadata>;
    addTorrent: (magnetOrPath: string, savePath: string) => Promise<void>;
  } }).torrentApi;

  const handleBrowseLocation = async () => {
    if (torrentApi) {
      const path = await torrentApi.openFileDialog();
      if (path) setSavePath(path);
    }
  };

  const handleBrowseTorrent = async () => {
    if (torrentApi) {
      const result = await torrentApi.openTorrentFileDialog();
      if (result) {
         setMagnetOrPath(result);
         await parseMetadata(result);
      }
    }
  };

  const parseMetadata = async (targetPath: string) => {
    setLoadingMeta(true);
    setError(null);
    try {
      if (torrentApi) {
        const data = await torrentApi.parseTorrentFile(targetPath);
        setMetadata(data as TorrentMetadata);
      }
    } catch {
      setError('Invalid torrent file or magnet link metadata resolution failed.');
    } finally {
      setLoadingMeta(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.torrent')) {
      const p = (file as unknown as { path: string }).path;
      setMagnetOrPath(p);
      await parseMetadata(p);
    } else {
      setError('Please drop a valid .torrent file.');
    }
  };

  const handleAdd = async () => {
    if (!magnetOrPath || !savePath) return;
    if (torrentApi) {
      await torrentApi.addTorrent(magnetOrPath, savePath);
      onAdded();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl border border-gray-700 flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-gray-700">
          <h3 className="text-xl font-bold">Add Torrent</h3>
          <button onClick={onClose} className="hover:text-gray-300 transition">
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-col md:flex-row flex-1 p-4 gap-6">
          <div className="flex-1 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Torrent File or Magnet Link</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  className="flex-1 bg-gray-900 border border-gray-700 rounded p-2 focus:ring focus:ring-blue-500 outline-none"
                  placeholder="magnet:?xt=urn:btih:... or path"
                  value={magnetOrPath}
                  onChange={(e) => setMagnetOrPath(e.target.value)}
                  onBlur={() => magnetOrPath.startsWith('magnet:') ? parseMetadata(magnetOrPath) : null}
                />
                <button
                  onClick={handleBrowseTorrent}
                  className="bg-gray-700 hover:bg-gray-600 px-3 rounded flex items-center justify-center transition border border-gray-600 text-sm whitespace-nowrap"
                >
                  Choose File
                </button>
              </div>
            </div>

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center text-center transition ${isDragging ? 'border-blue-500 bg-blue-500/10' : 'border-gray-600 bg-gray-900/50'}`}
            >
              <UploadCloud size={32} className="text-gray-400 mb-2" />
              <p className="text-gray-400 text-sm">Drag and drop a .torrent file here</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Save Location</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  className="flex-1 bg-gray-900 border border-gray-700 rounded p-2 focus:ring focus:ring-blue-500 outline-none"
                  placeholder="/path/to/downloads"
                  value={savePath}
                  onChange={(e) => setSavePath(e.target.value)}
                />
                <button
                  onClick={handleBrowseLocation}
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
                <p className="text-red-400 text-sm">{error}</p>
             ) : loadingMeta ? (
                <p className="text-blue-400 text-sm">Resolving metadata...</p>
             ) : metadata ? (
                <div className="text-sm text-gray-300 space-y-2 overflow-auto flex-1">
                   <p><span className="font-semibold">Name:</span> <br/>{metadata.name || 'Unknown'}</p>
                   {metadata.totalSize !== undefined && metadata.totalSize !== null ? (
                     <p><span className="font-semibold">Total Size:</span> <br/>{(metadata.totalSize / 1024 / 1024).toFixed(2)} MB</p>
                   ) : (
                     <p><span className="font-semibold">Total Size:</span> <br/><span className="text-gray-500 italic">Not exposed by engine</span></p>
                   )}

                   {metadata.numFiles !== undefined && metadata.numFiles !== null ? (
                     <p><span className="font-semibold">Files:</span> {metadata.numFiles}</p>
                   ) : (
                     <p><span className="font-semibold">Files:</span> <span className="text-gray-500 italic">Not exposed by engine</span></p>
                   )}

                   {metadata.files && metadata.files.length > 0 && (
                     <div className="mt-2 pl-2 border-l border-gray-700 space-y-1 max-h-32 overflow-y-auto">
                        {metadata.files.slice(0, 10).map((f: { path: string }, idx: number) => (
                           <div key={idx} className="truncate text-xs text-gray-400" title={f.path}>{f.path}</div>
                        ))}
                        {metadata.files.length > 10 && <div className="text-xs text-gray-500">...and {metadata.files.length - 10} more</div>}
                     </div>
                   )}
                </div>
             ) : (
                <p className="text-gray-500 text-sm">Select a file or enter a magnet link to preview.</p>
             )}
          </div>
        </div>

        <div className="p-4 border-t border-gray-700 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 hover:bg-gray-700 rounded transition">Cancel</button>
          <button
            onClick={handleAdd}
            disabled={!magnetOrPath || !savePath || !!error}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded transition shadow"
          >
            Add Torrent
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddTorrentModal;