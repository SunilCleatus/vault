import { useState } from 'react';
import { openDrivePicker, type PickedFile } from '../../lib/drivePicker';
import { updateFile } from '../../lib/driveClient';

const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY as string | undefined;

type Props = {
  accessToken: string;
  categoryFolders: Record<string, string>;
  onBack: () => void;
  onImported: (category: string) => void;
};

export default function ImportView({ accessToken, categoryFolders, onBack, onImported }: Props) {
  const [picked, setPicked] = useState<PickedFile[]>([]);
  const [category, setCategory] = useState(() => Object.keys(categoryFolders)[0] ?? '');
  const [picking, setPicking] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleChooseFiles = async () => {
    if (!API_KEY) {
      setError(
        'Import from Drive needs a Google API key. Set VITE_GOOGLE_API_KEY in your environment.'
      );
      return;
    }
    setError(null);
    setMessage(null);
    setPicking(true);
    try {
      const files = await openDrivePicker(accessToken, API_KEY);
      setPicked(files);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open Google Drive picker.');
    } finally {
      setPicking(false);
    }
  };

  const handleImport = async () => {
    const folderId = categoryFolders[category];
    if (!folderId || picked.length === 0) return;
    setImporting(true);
    setError(null);
    try {
      for (const file of picked) {
        // Adds the category folder as an additional parent rather than
        // moving the file out of wherever it already lives in Drive — an
        // import shouldn't disrupt organization the user already had.
        await updateFile(accessToken, file.id, { moveToParentId: folderId });
      }
      setMessage(`Imported ${picked.length} file${picked.length === 1 ? '' : 's'} into ${category}.`);
      onImported(category);
      setPicked([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not import one or more files.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="folder-view">
      <header className="capture-header">
        <button className="text-button" onClick={onBack}>
          Back
        </button>
        <h2>Import from Drive</h2>
        <span />
      </header>

      <p className="tagline">
        Bring documents you already have in Google Drive into your Vault, organized by category.
        The original file stays where it is — this just adds it to the category folder too.
      </p>

      {error && <p className="error">{error}</p>}
      {message && <p className="status-line">{message}</p>}

      <button className="secondary-button" onClick={handleChooseFiles} disabled={picking}>
        {picking ? 'Opening Drive…' : 'Choose Files from Drive'}
      </button>

      {picked.length > 0 && (
        <>
          <ul className="file-list">
            {picked.map((file) => (
              <li key={file.id}>
                <div className="file-row">
                  <span className="file-thumb file-thumb-fallback">
                    {file.mimeType === 'application/pdf' ? 'PDF' : 'DOC'}
                  </span>
                  <span className="file-info">
                    <span className="file-name">{file.name}</span>
                  </span>
                </div>
              </li>
            ))}
          </ul>

          <div className="form-field">
            <label htmlFor="import-category">Import into</label>
            <select
              id="import-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {Object.keys(categoryFolders).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <button className="primary-button" onClick={handleImport} disabled={importing}>
            {importing ? 'Importing…' : `Import ${picked.length} file${picked.length === 1 ? '' : 's'}`}
          </button>
        </>
      )}
    </div>
  );
}
