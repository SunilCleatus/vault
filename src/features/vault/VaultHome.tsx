import { useEffect, useState } from 'react';
import {
  ensureFamilyMemberStructure,
  ensureFolder,
  listCategories,
  type DriveFile,
  type VaultStructure,
} from '../../lib/driveClient';
import { invalidateCachedListing } from '../../lib/listingCache';
import { buildFolderIndex, type FolderLabel } from '../../lib/folderIndex';
import { findExpiringSoon, formatDaysUntilExpiry, type ExpiringFile } from '../../lib/expiryCheck';
import CaptureFlow from '../capture/CaptureFlow';
import CategoryGrid from '../browse/CategoryGrid';
import FolderView from '../browse/FolderView';
import DocumentViewer from '../browse/DocumentViewer';
import FamilySwitcher, { type FamilyScope } from '../family/FamilySwitcher';
import SearchView from '../search/SearchView';
import FavoritesView from '../favorites/FavoritesView';

type Props = {
  accessToken: string;
  structure: VaultStructure;
  onAuthExpired: () => void;
  onSignOut: () => void;
};

type RecentUpload = { category: string; fileName: string };
type View = 'browse' | 'folder' | 'viewer' | 'capture' | 'search' | 'favorites';
type SelectedCategory = { name: string; folderId: string; scopeLabel: string };
type ViewerOrigin = 'folder' | 'search' | 'browse';

export default function VaultHome({ accessToken, structure, onAuthExpired, onSignOut }: Props) {
  const [scope, setScope] = useState<FamilyScope>({ kind: 'me' });
  const [activeStructure, setActiveStructure] = useState<VaultStructure>(structure);
  const [resolvingScope, setResolvingScope] = useState(false);
  const [switcherRefresh, setSwitcherRefresh] = useState(0);
  const [folderRefresh, setFolderRefresh] = useState(0);

  // The live set of category folders for whatever scope is currently being
  // browsed — starts from the defaults created at setup, then refreshes from
  // Drive to pick up any custom folders the user has added since.
  const [categories, setCategories] = useState<Record<string, string>>(structure.categories);
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [savingCategory, setSavingCategory] = useState(false);

  const [view, setView] = useState<View>('browse');
  const [viewerOrigin, setViewerOrigin] = useState<ViewerOrigin>('folder');
  const [selectedCategory, setSelectedCategory] = useState<SelectedCategory | null>(null);
  const [selectedFile, setSelectedFile] = useState<DriveFile | null>(null);
  const [recentUploads, setRecentUploads] = useState<RecentUpload[]>([]);
  const [expiringSoon, setExpiringSoon] = useState<ExpiringFile[]>([]);
  const [folderIndex, setFolderIndex] = useState<Map<string, FolderLabel> | null>(null);

  const familyRootId = structure.categories['Family'];
  const currentScopeLabel = scope.kind === 'me' ? 'Me' : scope.name;

  useEffect(() => {
    if (scope.kind === 'me') {
      setActiveStructure(structure);
      return;
    }
    let cancelled = false;
    setResolvingScope(true);
    ensureFamilyMemberStructure(accessToken, familyRootId, scope.name)
      .then((result) => {
        if (cancelled) return;
        setActiveStructure(result);
        setResolvingScope(false);
        setSwitcherRefresh((n) => n + 1);
      })
      .catch(() => {
        if (!cancelled) setResolvingScope(false);
      });
    return () => {
      cancelled = true;
    };
  }, [scope, accessToken, familyRootId, structure]);

  useEffect(() => {
    let cancelled = false;
    setCategories(activeStructure.categories);
    listCategories(accessToken, activeStructure.rootId).then((live) => {
      if (!cancelled) setCategories(live);
    });
    return () => {
      cancelled = true;
    };
  }, [accessToken, activeStructure]);

  // Checked once per sign-in, across every category and family member (not
  // just the currently browsed scope) — the whole point is surfacing things
  // you'd otherwise have to remember to go looking for.
  useEffect(() => {
    let cancelled = false;
    findExpiringSoon(accessToken)
      .then((files) => {
        if (!cancelled) setExpiringSoon(files);
      })
      .catch(() => {
        // best-effort — an expiry-check failure shouldn't block the rest of the app
      });
    buildFolderIndex(accessToken, structure).then((index) => {
      if (!cancelled) setFolderIndex(index);
    });
    return () => {
      cancelled = true;
    };
  }, [accessToken, structure]);

  const openViewer = (file: DriveFile, category: SelectedCategory, origin: ViewerOrigin) => {
    setSelectedFile(file);
    setSelectedCategory(category);
    setViewerOrigin(origin);
    setView('viewer');
  };

  const handleAddCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) return;
    setSavingCategory(true);
    try {
      const id = await ensureFolder(accessToken, name, activeStructure.rootId);
      setCategories((prev) => ({ ...prev, [name]: id }));
      setNewCategoryName('');
      setAddingCategory(false);
    } finally {
      setSavingCategory(false);
    }
  };

  if (view === 'capture') {
    return (
      <CaptureFlow
        accessToken={accessToken}
        categoryFolders={categories}
        onCancel={() => setView('browse')}
        onAuthExpired={onAuthExpired}
        onUploaded={({ category, fileName }) => {
          setRecentUploads((prev) => [{ category, fileName }, ...prev]);
          void invalidateCachedListing(categories[category]);
          setView('browse');
        }}
      />
    );
  }

  if (view === 'viewer' && selectedFile && selectedCategory) {
    return (
      <DocumentViewer
        accessToken={accessToken}
        file={selectedFile}
        category={selectedCategory.name}
        scopeLabel={selectedCategory.scopeLabel}
        folderId={selectedCategory.folderId}
        // Move only offers other categories within the scope currently being
        // browsed — a search result can belong to any family member's scope,
        // and we don't have that scope's folder map loaded, so Move is
        // simply unavailable there rather than risking a wrong target.
        categoryFolders={viewerOrigin === 'folder' ? categories : {}}
        onClose={() => {
          setSelectedFile(null);
          setView(viewerOrigin);
        }}
        onDeleted={() => {
          void invalidateCachedListing(selectedCategory.folderId);
          setSelectedFile(null);
          setFolderRefresh((n) => n + 1);
          setView(viewerOrigin);
        }}
        onUpdated={() => {
          void invalidateCachedListing(selectedCategory.folderId);
          setFolderRefresh((n) => n + 1);
        }}
        onMoved={(toCategory, toFolderId) => {
          void invalidateCachedListing(selectedCategory.folderId);
          void invalidateCachedListing(toFolderId);
          setSelectedFile(null);
          setFolderRefresh((n) => n + 1);
          setView(viewerOrigin);
        }}
      />
    );
  }

  if (view === 'folder' && selectedCategory) {
    return (
      <FolderView
        accessToken={accessToken}
        category={selectedCategory.name}
        folderId={selectedCategory.folderId}
        refreshToken={folderRefresh}
        onBack={() => {
          setSelectedCategory(null);
          setView('browse');
        }}
        onSelectFile={(file) => openViewer(file, selectedCategory, 'folder')}
      />
    );
  }

  if (view === 'search') {
    return (
      <SearchView
        accessToken={accessToken}
        structure={structure}
        onBack={() => setView('browse')}
        onSelectFile={(file, label: FolderLabel) =>
          openViewer(
            file,
            { name: label.category, folderId: file.parents?.[0] ?? '', scopeLabel: label.scopeLabel },
            'search'
          )
        }
      />
    );
  }

  if (view === 'favorites') {
    return <FavoritesView onBack={() => setView('browse')} />;
  }

  return (
    <div className="vault-home">
      <div className="home-toolbar">
        <button className="text-button" onClick={() => setView('search')}>
          🔍 Search
        </button>
        <button className="text-button" onClick={() => setView('favorites')}>
          ⭐ Offline Favorites
        </button>
        <button className="text-button" onClick={onSignOut}>
          Sign Out
        </button>
      </div>

      {expiringSoon.length > 0 && (
        <div className="expiring-soon">
          <h3>⚠️ Expiring Soon</h3>
          <ul className="file-list">
            {expiringSoon.map((file) => {
              const label = (file.parents?.[0] && folderIndex?.get(file.parents[0])) || {
                scopeLabel: '',
                category: '',
              };
              return (
                <li key={file.id}>
                  <button
                    className="file-row"
                    onClick={() =>
                      openViewer(
                        file,
                        { name: label.category, folderId: file.parents?.[0] ?? '', scopeLabel: label.scopeLabel },
                        'browse'
                      )
                    }
                  >
                    <span className="file-thumb file-thumb-fallback">
                      {file.mimeType === 'application/pdf' ? 'PDF' : 'DOC'}
                    </span>
                    <span className="file-info">
                      <span className="file-name">{file.name}</span>
                      <span className="file-expiry">
                        {formatDaysUntilExpiry(file.daysUntilExpiry)}
                        {label.scopeLabel && ` · ${label.scopeLabel} → ${label.category}`}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <FamilySwitcher
        accessToken={accessToken}
        familyRootId={familyRootId}
        scope={scope}
        onScopeChange={setScope}
        refreshToken={switcherRefresh}
      />
      <p className="family-hint">
        For dependents without their own Google account. Family members who have one should sign
        out and sign in as themselves for a private Vault — you can Share individual documents
        with them instead.
      </p>

      {resolvingScope && <p className="status-line">Setting up their folders…</p>}

      {!resolvingScope && (
        <CategoryGrid
          categories={categories}
          onSelectCategory={(name, folderId) => {
            setSelectedCategory({ name, folderId, scopeLabel: currentScopeLabel });
            setView('folder');
          }}
          onAddCategory={() => setAddingCategory(true)}
        />
      )}

      {addingCategory && (
        <div className="add-member-form">
          <input
            type="text"
            placeholder="Category name (e.g. Warranties)"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            autoFocus
          />
          <button className="text-button" onClick={handleAddCategory} disabled={savingCategory}>
            {savingCategory ? 'Adding…' : 'Add'}
          </button>
          <button
            className="text-button"
            onClick={() => setAddingCategory(false)}
            disabled={savingCategory}
          >
            Cancel
          </button>
        </div>
      )}

      {recentUploads.length > 0 && (
        <ul className="recent-list">
          {recentUploads.map((upload, i) => (
            <li key={i}>
              <span className="marker">✓</span>
              {upload.fileName} <span className="recent-category">→ {upload.category}</span>
            </li>
          ))}
        </ul>
      )}

      <button className="primary-button fab" onClick={() => setView('capture')}>
        + Add Document
      </button>
    </div>
  );
}
