import { useEffect, useState } from 'react';
import { deleteFile, downloadFileBlob, shareFile, updateFile, type DriveFile } from '../../lib/driveClient';
import { isFavorited, removeFavorite, saveFavorite } from '../../lib/favoritesStore';
import { usePinKey } from '../lock/LockGate';

type Props = {
  accessToken: string;
  file: DriveFile;
  category: string;
  scopeLabel: string;
  folderId: string;
  categoryFolders: Record<string, string>;
  onClose: () => void;
  onDeleted: () => void;
  onUpdated: () => void;
  onMoved: (toCategory: string, toFolderId: string) => void;
};

export default function DocumentViewer({
  accessToken,
  file,
  category,
  scopeLabel,
  folderId,
  categoryFolders,
  onClose,
  onDeleted,
  onUpdated,
  onMoved,
}: Props) {
  const { requestKey } = usePinKey();
  const [fileState, setFileState] = useState(file);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [favorited, setFavorited] = useState(false);
  const [favoriteBusy, setFavoriteBusy] = useState(false);

  const [sharing, setSharing] = useState(false);
  const [shareEmail, setShareEmail] = useState('');
  const [shareBusy, setShareBusy] = useState(false);
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [sendMessage, setSendMessage] = useState<string | null>(null);

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(file.name);
  const [savingName, setSavingName] = useState(false);

  const [editingMeta, setEditingMeta] = useState(false);
  const [expiryInput, setExpiryInput] = useState(file.properties?.expiryDate ?? '');
  const [notesInput, setNotesInput] = useState(file.description ?? '');
  const [savingMeta, setSavingMeta] = useState(false);

  const [moving, setMoving] = useState(false);
  const [moveTarget, setMoveTarget] = useState('');
  const [savingMove, setSavingMove] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    downloadFileBlob(accessToken, fileState.id)
      .then((downloaded) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(downloaded);
        setBlob(downloaded);
        setBlobUrl(objectUrl);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not open document.');
      });

    isFavorited(fileState.id).then((value) => {
      if (!cancelled) setFavorited(value);
    });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [accessToken, fileState.id]);

  const handleDelete = async () => {
    if (!confirm(`Delete "${fileState.name}"? This can't be undone from here.`)) return;
    setDeleting(true);
    try {
      await deleteFile(accessToken, fileState.id);
      await removeFavorite(fileState.id);
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete document.');
      setDeleting(false);
    }
  };

  const handleToggleFavorite = async () => {
    if (favorited) {
      await removeFavorite(fileState.id);
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
          fileId: fileState.id,
          name: fileState.name,
          mimeType: fileState.mimeType,
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

  const handleShare = async () => {
    const email = shareEmail.trim();
    if (!email) return;
    setShareBusy(true);
    setShareMessage(null);
    try {
      await shareFile(accessToken, fileState.id, email, 'reader');
      setShareMessage(`Shared with ${email}.`);
      setShareEmail('');
      setSharing(false);
    } catch (err) {
      setShareMessage(err instanceof Error ? err.message : 'Could not share document.');
    } finally {
      setShareBusy(false);
    }
  };

  // Hands the file to the phone's native share sheet (WhatsApp, Messages,
  // Mail, AirDrop, etc.) — distinct from the Grant Access button above,
  // which grants another Google account read access to the file in Drive.
  const handleSendTo = async () => {
    if (!blob) return;
    setSendMessage(null);
    const fileToSend = new File([blob], fileState.name, { type: fileState.mimeType });
    if (!navigator.canShare?.({ files: [fileToSend] })) {
      setSendMessage("Sending to other apps isn't supported on this browser — use Download instead.");
      return;
    }
    try {
      await navigator.share({ files: [fileToSend], title: fileState.name });
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setSendMessage(err.message);
      }
    }
  };

  const handleRename = async () => {
    const name = nameInput.trim();
    if (!name || name === fileState.name) {
      setEditingName(false);
      return;
    }
    setSavingName(true);
    try {
      await updateFile(accessToken, fileState.id, { name });
      setFileState((prev) => ({ ...prev, name }));
      setEditingName(false);
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not rename document.');
    } finally {
      setSavingName(false);
    }
  };

  const handleSaveMeta = async () => {
    setSavingMeta(true);
    try {
      // null explicitly deletes the key server-side; omitting it (or
      // sending {}) would leave a previously-set expiry date untouched.
      await updateFile(accessToken, fileState.id, {
        description: notesInput,
        properties: { expiryDate: expiryInput || null },
      });
      const localProperties: Record<string, string> = expiryInput ? { expiryDate: expiryInput } : {};
      setFileState((prev) => ({ ...prev, description: notesInput, properties: localProperties }));
      setEditingMeta(false);
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update document.');
    } finally {
      setSavingMeta(false);
    }
  };

  const handleMove = async () => {
    const targetFolderId = categoryFolders[moveTarget];
    if (!targetFolderId) return;
    setSavingMove(true);
    try {
      await updateFile(accessToken, fileState.id, {
        moveFromParentId: folderId,
        moveToParentId: targetFolderId,
      });
      onMoved(moveTarget, targetFolderId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not move document.');
      setSavingMove(false);
    }
  };

  const isPdf = fileState.mimeType === 'application/pdf';
  const isImage = fileState.mimeType.startsWith('image/');
  const moveOptions = Object.keys(categoryFolders).filter((c) => c !== category);

  return (
    <div className="viewer">
      <header className="capture-header">
        <button className="text-button" onClick={onClose}>
          Close
        </button>
        {editingName ? (
          <input
            className="viewer-title-input"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            autoFocus
          />
        ) : (
          <h2 className="viewer-title" onClick={() => setEditingName(true)}>
            {fileState.name}
          </h2>
        )}
        <span />
      </header>

      {editingName && (
        <div className="inline-actions">
          <button className="text-button" onClick={handleRename} disabled={savingName}>
            {savingName ? 'Saving…' : 'Save'}
          </button>
          <button
            className="text-button"
            onClick={() => {
              setNameInput(fileState.name);
              setEditingName(false);
            }}
            disabled={savingName}
          >
            Cancel
          </button>
        </div>
      )}

      <div className="viewer-body">
        {!blobUrl && !error && <p className="status-line">Loading…</p>}
        {error && <p className="error">{error}</p>}
        {blobUrl && isImage && <img className="viewer-image" src={blobUrl} alt={fileState.name} />}
        {blobUrl && isPdf && <iframe className="viewer-pdf" src={blobUrl} title={fileState.name} />}
        {blobUrl && !isImage && !isPdf && (
          <p className="status-line">Preview isn't available for this file type yet.</p>
        )}
      </div>

      {!editingMeta ? (
        <div className="viewer-meta" onClick={() => setEditingMeta(true)}>
          {fileState.properties?.expiryDate && <p>Expires: {fileState.properties.expiryDate}</p>}
          {fileState.description && <p>{fileState.description}</p>}
          {!fileState.properties?.expiryDate && !fileState.description && (
            <p className="status-line">Tap to add an expiry date or notes</p>
          )}
        </div>
      ) : (
        <div className="metadata-form">
          <div className="form-field">
            <label htmlFor="viewer-expiry-date">Expiry / renewal date</label>
            <div className="date-field">
              <input
                id="viewer-expiry-date"
                type="date"
                value={expiryInput}
                onChange={(e) => setExpiryInput(e.target.value)}
              />
              <button
                type="button"
                className="text-button"
                onClick={() => setExpiryInput('')}
                disabled={!expiryInput}
              >
                Clear
              </button>
            </div>
          </div>
          <label>
            Notes
            <textarea rows={2} value={notesInput} onChange={(e) => setNotesInput(e.target.value)} />
          </label>
          <div className="inline-actions">
            <button className="text-button" onClick={handleSaveMeta} disabled={savingMeta}>
              {savingMeta ? 'Saving…' : 'Save'}
            </button>
            <button className="text-button" onClick={() => setEditingMeta(false)} disabled={savingMeta}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {shareMessage && <p className="status-line">{shareMessage}</p>}
      {sendMessage && <p className="status-line">{sendMessage}</p>}

      {sharing && (
        <div className="share-form">
          <input
            type="email"
            placeholder="family member's email"
            value={shareEmail}
            onChange={(e) => setShareEmail(e.target.value)}
            autoFocus
          />
          <button className="text-button" onClick={handleShare} disabled={shareBusy}>
            {shareBusy ? 'Sharing…' : 'Share'}
          </button>
          <button className="text-button" onClick={() => setSharing(false)} disabled={shareBusy}>
            Cancel
          </button>
        </div>
      )}

      {moving && (
        <div className="share-form">
          <select value={moveTarget} onChange={(e) => setMoveTarget(e.target.value)}>
            <option value="">Move to…</option>
            {moveOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <button className="text-button" onClick={handleMove} disabled={savingMove || !moveTarget}>
            {savingMove ? 'Moving…' : 'Move'}
          </button>
          <button className="text-button" onClick={() => setMoving(false)} disabled={savingMove}>
            Cancel
          </button>
        </div>
      )}

      <div className="viewer-actions">
        {blobUrl && (
          <a className="secondary-button" href={blobUrl} download={fileState.name}>
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
        <button
          className="secondary-button"
          onClick={handleSendTo}
          disabled={!blob}
        >
          Send To…
        </button>
        <button className="secondary-button" onClick={() => setSharing(true)} disabled={sharing}>
          Grant Access
        </button>
        {moveOptions.length > 0 && (
          <button className="secondary-button" onClick={() => setMoving(true)} disabled={moving}>
            Move
          </button>
        )}
        <button className="secondary-button danger" onClick={handleDelete} disabled={deleting}>
          {deleting ? 'Deleting…' : 'Delete'}
        </button>
      </div>
    </div>
  );
}
