import { useEffect, useState } from 'react';
import { listFiles, type DriveFile } from '../../lib/driveClient';
import { getCachedListing, setCachedListing } from '../../lib/listingCache';

type Props = {
  accessToken: string;
  category: string;
  folderId: string;
  onBack: () => void;
  onSelectFile: (file: DriveFile) => void;
  refreshToken: number;
};

export default function FolderView({
  accessToken,
  category,
  folderId,
  onBack,
  onSelectFile,
  refreshToken,
}: Props) {
  const [files, setFiles] = useState<DriveFile[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setError(null);
      const cached = await getCachedListing(folderId);
      if (!cancelled && cached) {
        setFiles(cached);
        setLoading(false);
      } else if (!cancelled) {
        setLoading(true);
      }

      try {
        const fresh = await listFiles(accessToken, folderId);
        if (cancelled) return;
        setFiles(fresh);
        setLoading(false);
        void setCachedListing(folderId, fresh);
      } catch (err) {
        if (cancelled) return;
        setLoading(false);
        if (!cached) {
          setError(err instanceof Error ? err.message : 'Could not load documents.');
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [accessToken, folderId, refreshToken]);

  return (
    <div className="folder-view">
      <header className="capture-header">
        <button className="text-button" onClick={onBack}>
          Back
        </button>
        <h2>{category}</h2>
        <span />
      </header>

      {loading && files === null && <p className="status-line">Loading…</p>}
      {error && <p className="error">{error}</p>}

      {files !== null && files.length === 0 && !loading && (
        <p className="status-line">No documents in {category} yet.</p>
      )}

      {files !== null && files.length > 0 && (
        <ul className="file-list">
          {files.map((file) => (
            <li key={file.id}>
              <button className="file-row" onClick={() => onSelectFile(file)}>
                {file.thumbnailLink ? (
                  <img className="file-thumb" src={file.thumbnailLink} alt="" />
                ) : (
                  <span className="file-thumb file-thumb-fallback">
                    {file.mimeType === 'application/pdf' ? 'PDF' : 'DOC'}
                  </span>
                )}
                <span className="file-info">
                  <span className="file-name">{file.name}</span>
                  {file.properties?.expiryDate && (
                    <span className="file-expiry">Expires {file.properties.expiryDate}</span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
