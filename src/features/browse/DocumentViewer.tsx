import { useEffect, useState } from 'react';
import { deleteFile, downloadFileBlob, type DriveFile } from '../../lib/driveClient';
import { isFavorited, removeFavorite, saveFavorite } from '../../lib/favoritesStore';
import { usePinKey } from '../lock/LockGate';

type Props = {
  accessToken: string;
  file: DriveFile;
  category: string;
  scopeLabel: string;
  onClose: () => void;
  onDeleted: () => void;
};

export default function DocumentViewer({
  accessToken,
  file,
  category,
  scopeLabel,
  onClose,
  onDeleted,
}: Props) {
  const { requestKey } = usePinKey();
  const [blob, setBlob] = useState<Blob | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [favorited, setFavorited] = useState(false);
  const [favoriteBusy, setFavoriteBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    downloadFileBlob(accessToken, file.id)
      .then((downloaded) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(downloaded);
        setBlob(downloaded);
        setBlobUrl(objectUrl);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not open document.');
      });

    isFavorited(file.id).then((value) => {
      if (!cancelled) setFavorited(value);
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
      await removeFavorite(file.id);
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete document.');
      setDeleting(false);
    }
  };

  const handleToggleFavorite = async () => {
    if (favorited) {
      await removeFavorite(file.id);
      setFavorited(false);
      return;
    }
    if (!blob) return;
    setFavoriteBusy(true);
    try {
      const key = await requestKey();
      if (!key) return;
      await saveFavorite(
        key,
        {
          fileId: file.id,
          name: file.name,
          mimeType: file.mimeType,
          category,
          scopeLabel,
          savedAt: Date.now(),
        },
        blob
      );
      setFavorited(true);
    } finally {
      setFavoriteBusy(false);
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
        <button
          className="secondary-button"
          onClick={handleToggleFavorite}
          disabled={!blob || favoriteBusy}
        >
          {favorited ? '★ Saved Offline' : '☆ Save for Offline'}
        </button>
        <button className="secondary-button danger" onClick={handleDelete} disabled={deleting}>
          {deleting ? 'Deleting…' : 'Delete'}
        </button>
      </div>
    </div>
  );
}
