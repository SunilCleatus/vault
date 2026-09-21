import { useEffect, useState } from 'react';
import { searchFiles } from '../../lib/driveSearch';
import { buildFolderIndex, type FolderLabel } from '../../lib/folderIndex';
import type { DriveFile, VaultStructure } from '../../lib/driveClient';

type SortKey = 'name' | 'date' | 'expiry';

type Props = {
  accessToken: string;
  structure: VaultStructure;
  onBack: () => void;
  onSelectFile: (file: DriveFile, label: FolderLabel) => void;
};

const UNKNOWN_LABEL: FolderLabel = { scopeLabel: '', category: '' };

export default function SearchView({ accessToken, structure, onBack, onSelectFile }: Props) {
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<DriveFile[] | null>(null);
  const [folderIndex, setFolderIndex] = useState<Map<string, FolderLabel> | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    buildFolderIndex(accessToken, structure).then(setFolderIndex);
  }, [accessToken, structure]);

  useEffect(() => {
    if (term.trim().length < 2) {
      setResults(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    const timer = setTimeout(async () => {
      try {
        const files = await searchFiles(accessToken, term.trim());
        if (!cancelled) setResults(files);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Search failed.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [term, accessToken]);

  const sorted = results
    ? [...results].sort((a, b) => {
        if (sortKey === 'name') return a.name.localeCompare(b.name);
        if (sortKey === 'date') return (b.modifiedTime ?? '').localeCompare(a.modifiedTime ?? '');
        const ax = a.properties?.expiryDate ?? '9999-99-99';
        const bx = b.properties?.expiryDate ?? '9999-99-99';
        return ax.localeCompare(bx);
      })
    : null;

  return (
    <div className="folder-view">
      <header className="capture-header">
        <button className="text-button" onClick={onBack}>
          Back
        </button>
        <h2>Search</h2>
        <span />
      </header>

      <input
        className="search-input"
        type="search"
        placeholder="Search by name, category, or notes…"
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        autoFocus
      />

      {results && results.length > 0 && (
        <div className="sort-row">
          <span>Sort by</span>
          <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)}>
            <option value="name">Name</option>
            <option value="date">Date modified</option>
            <option value="expiry">Expiry date</option>
          </select>
        </div>
      )}

      {loading && <p className="status-line">Searching…</p>}
      {error && <p className="error">{error}</p>}
      {term.trim().length >= 2 && !loading && results && results.length === 0 && (
        <p className="status-line">No documents match "{term}".</p>
      )}

      {sorted && sorted.length > 0 && (
        <ul className="file-list">
          {sorted.map((file) => {
            const label = (file.parents?.[0] && folderIndex?.get(file.parents[0])) || UNKNOWN_LABEL;
            return (
              <li key={file.id}>
                <button className="file-row" onClick={() => onSelectFile(file, label)}>
                  {file.thumbnailLink ? (
                    <img className="file-thumb" src={file.thumbnailLink} alt="" />
                  ) : (
                    <span className="file-thumb file-thumb-fallback">
                      {file.mimeType === 'application/pdf' ? 'PDF' : 'DOC'}
                    </span>
                  )}
                  <span className="file-info">
                    <span className="file-name">{file.name}</span>
                    <span className="file-expiry">
                      {label.scopeLabel && `${label.scopeLabel} → ${label.category}`}
                      {file.properties?.expiryDate && ` · Expires ${file.properties.expiryDate}`}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
