import { useEffect, useState } from 'react';
import { deleteFile, downloadFileBlob, type DriveFile } from '../../lib/driveClient';

type Props = {
  accessToken: string;
  file: DriveFile;
  onClose: () => void;
  onDeleted: () => void;
};

export default function DocumentViewer({ accessToken, file, onClose, onDeleted }: Props) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    downloadFileBlob(accessToken, file.id)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not open document.');
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [accessToken, file.id]);

  const handleDelete = async () => {
    if (!confirm(`Delete "${file.name}"? This can't be undone from here.`)) return;
    setDeleting(true);
    try {
      await deleteFile(accessToken, file.id);
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete document.');
      setDeleting(false);
    }
  };

  const isPdf = file.mimeType === 'application/pdf';
  const isImage = file.mimeType.startsWith('image/');

  return (
    <div className="viewer">
      <header className="capture-header">
        <button className="text-button" onClick={onClose}>
          Close
        </button>
        <h2 className="viewer-title">{file.name}</h2>
        <span />
      </header>

      <div className="viewer-body">
        {!blobUrl && !error && <p className="status-line">Loading…</p>}
        {error && <p className="error">{error}</p>}
        {blobUrl && isImage && <img className="viewer-image" src={blobUrl} alt={file.name} />}
        {blobUrl && isPdf && <iframe className="viewer-pdf" src={blobUrl} title={file.name} />}
        {blobUrl && !isImage && !isPdf && (
          <p className="status-line">Preview isn't available for this file type yet.</p>
        )}
      </div>

      {(file.properties?.expiryDate || file.description) && (
        <div className="viewer-meta">
          {file.properties?.expiryDate && <p>Expires: {file.properties.expiryDate}</p>}
          {file.description && <p>{file.description}</p>}
        </div>
      )}

      <div className="viewer-actions">
        {blobUrl && (
          <a className="secondary-button" href={blobUrl} download={file.name}>
            Download
          </a>
        )}
        <button className="secondary-button danger" onClick={handleDelete} disabled={deleting}>
          {deleting ? 'Deleting…' : 'Delete'}
        </button>
      </div>
    </div>
  );
}
