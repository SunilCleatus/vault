import { useEffect, useState } from 'react';
import { listFavoriteMeta, getFavoriteBlob, removeFavorite, type FavoriteMeta } from '../../lib/favoritesStore';
import { usePinKey } from '../lock/LockGate';

export default function FavoritesView({ onBack }: { onBack: () => void }) {
  const { requestKey } = usePinKey();
  const [items, setItems] = useState<FavoriteMeta[] | null>(null);
  const [openItem, setOpenItem] = useState<{ meta: FavoriteMeta; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listFavoriteMeta().then(setItems);
  }, []);

  const handleOpen = async (meta: FavoriteMeta) => {
    setError(null);
    const key = await requestKey();
    if (!key) return;
    const blob = await getFavoriteBlob(key, meta.fileId);
    if (!blob) {
      setError('Could not find that document offline.');
      return;
    }
    setOpenItem({ meta, url: URL.createObjectURL(blob) });
  };

  const handleRemove = async (fileId: string) => {
    await removeFavorite(fileId);
    setItems((prev) => prev?.filter((i) => i.fileId !== fileId) ?? null);
    if (openItem?.meta.fileId === fileId) {
      URL.revokeObjectURL(openItem.url);
      setOpenItem(null);
    }
  };

  if (openItem) {
    const isPdf = openItem.meta.mimeType === 'application/pdf';
    const isImage = openItem.meta.mimeType.startsWith('image/');
    return (
      <div className="viewer">
        <header className="capture-header">
          <button
            className="text-button"
            onClick={() => {
              URL.revokeObjectURL(openItem.url);
              setOpenItem(null);
            }}
          >
            Close
          </button>
          <h2 className="viewer-title">{openItem.meta.name}</h2>
          <span />
        </header>
        <div className="viewer-body">
          {isImage && <img className="viewer-image" src={openItem.url} alt={openItem.meta.name} />}
          {isPdf && <iframe className="viewer-pdf" src={openItem.url} title={openItem.meta.name} />}
        </div>
        <div className="viewer-actions">
          <button className="secondary-button danger" onClick={() => handleRemove(openItem.meta.fileId)}>
            Remove Offline Copy
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="folder-view">
      <header className="capture-header">
        <button className="text-button" onClick={onBack}>
          Back
        </button>
        <h2>Offline Favorites</h2>
        <span />
      </header>

      {error && <p className="error">{error}</p>}
      {items === null && <p className="status-line">Loading…</p>}
      {items && items.length === 0 && (
        <p className="status-line">
          No documents saved for offline access yet. Open a document and tap "Save for Offline" to
          add one.
        </p>
      )}

      {items && items.length > 0 && (
        <ul className="file-list">
          {items.map((item) => (
            <li key={item.fileId}>
              <button className="file-row" onClick={() => handleOpen(item)}>
                <span className="file-thumb file-thumb-fallback">
                  {item.mimeType === 'application/pdf' ? 'PDF' : 'IMG'}
                </span>
                <span className="file-info">
                  <span className="file-name">{item.name}</span>
                  <span className="file-expiry">
                    {item.scopeLabel} → {item.category}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
