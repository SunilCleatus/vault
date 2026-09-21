import { useCallback, useRef, useState } from 'react';
import { BROWSABLE_CATEGORIES, type DefaultCategory } from '../../config/taxonomy';
import { isPdfEmbeddableImage } from '../../lib/imageTypes';
import { buildFileName } from '../../lib/filename';
import { uploadFileToDrive } from '../../lib/driveUpload';

type Page = {
  id: string;
  blob: Blob;
  mimeType: string;
  previewUrl: string;
};

type Props = {
  accessToken: string;
  categoryFolders: Record<string, string>;
  onUploaded: (result: { category: string; title: string; fileName: string }) => void;
  onCancel: () => void;
  onAuthExpired: () => void;
};

export default function CaptureFlow({
  accessToken,
  categoryFolders,
  onUploaded,
  onCancel,
  onAuthExpired,
}: Props) {
  const [pages, setPages] = useState<Page[]>([]);
  const [category, setCategory] = useState<DefaultCategory>(BROWSABLE_CATEGORIES[0]);
  const [title, setTitle] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [notes, setNotes] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((fileList: FileList | null) => {
    if (!fileList) return;
    const newPages: Page[] = Array.from(fileList).map((file) => ({
      id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
      blob: file,
      mimeType: file.type,
      previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : '',
    }));
    setPages((prev) => [...prev, ...newPages]);
    setError(null);
  }, []);

  const removePage = useCallback((id: string) => {
    setPages((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  }, []);

  const handleSave = useCallback(async () => {
    if (pages.length === 0) {
      setError('Add at least one photo or file first.');
      return;
    }

    setError(null);
    setUploading(true);
    setProgress(0);

    try {
      let blob: Blob;
      let mimeType: string;

      if (pages.length === 1) {
        blob = pages[0].blob;
        mimeType = pages[0].mimeType;
      } else {
        const nonImagePage = pages.find((p) => !isPdfEmbeddableImage(p.mimeType));
        if (nonImagePage) {
          throw new Error(
            'Multiple pages must all be photos (JPEG/PNG). Remove any imported PDF or keep just one file.'
          );
        }
        const { imagesToPdf } = await import('../../lib/buildPdf');
        blob = await imagesToPdf(pages.map((p) => ({ blob: p.blob, mimeType: p.mimeType })));
        mimeType = 'application/pdf';
      }

      const fileName = buildFileName(category, title, mimeType);
      const parentId = categoryFolders[category];
      if (!parentId) throw new Error(`No Drive folder found for category "${category}".`);

      await uploadFileToDrive(
        accessToken,
        {
          name: fileName,
          parentId,
          mimeType,
          blob,
          description: notes || undefined,
          properties: expiryDate ? { expiryDate } : undefined,
        },
        (fraction) => setProgress(fraction)
      );

      pages.forEach((p) => p.previewUrl && URL.revokeObjectURL(p.previewUrl));
      onUploaded({ category, title, fileName });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed.';
      if (message.includes('401') || /invalid.*credential/i.test(message)) {
        onAuthExpired();
      } else {
        setError(message);
      }
    } finally {
      setUploading(false);
    }
  }, [pages, category, title, expiryDate, notes, categoryFolders, accessToken, onUploaded, onAuthExpired]);

  return (
    <div className="capture-flow">
      <header className="capture-header">
        <button className="text-button" onClick={onCancel} disabled={uploading}>
          Cancel
        </button>
        <h2>Add Document</h2>
        <span />
      </header>

      <div className="page-strip">
        {pages.map((page) => (
          <div className="page-thumb" key={page.id}>
            {page.previewUrl ? (
              <img src={page.previewUrl} alt="Captured page" />
            ) : (
              <div className="page-thumb-fallback">PDF</div>
            )}
            <button
              className="remove-page"
              onClick={() => removePage(page.id)}
              disabled={uploading}
              aria-label="Remove page"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <div className="capture-actions">
        <button
          className="secondary-button"
          onClick={() => cameraInputRef.current?.click()}
          disabled={uploading}
        >
          Take Photo
        </button>
        <button
          className="secondary-button"
          onClick={() => importInputRef.current?.click()}
          disabled={uploading}
        >
          Import File
        </button>
      </div>

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = '';
        }}
      />
      <input
        ref={importInputRef}
        type="file"
        accept="image/*,application/pdf"
        multiple
        hidden
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = '';
        }}
      />

      <form
        className="metadata-form"
        onSubmit={(e) => {
          e.preventDefault();
          handleSave();
        }}
      >
        <label>
          Category
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as DefaultCategory)}
            disabled={uploading}
          >
            {BROWSABLE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <label>
          Title
          <input
            type="text"
            placeholder={category}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={uploading}
          />
        </label>

        <label>
          Expiry / renewal date (optional)
          <input
            type="date"
            value={expiryDate}
            onChange={(e) => setExpiryDate(e.target.value)}
            disabled={uploading}
          />
        </label>

        <label>
          Notes (optional)
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={uploading}
          />
        </label>

        {error && <p className="error">{error}</p>}

        {uploading && (
          <div className="progress-bar">
            <div className="progress-bar-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
        )}

        <button className="primary-button" type="submit" disabled={uploading}>
          {uploading ? `Uploading… ${Math.round(progress * 100)}%` : 'Save to Vault'}
        </button>
      </form>
    </div>
  );
}
