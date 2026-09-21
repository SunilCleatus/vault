import { useEffect, useState } from 'react';
import {
  ensureFamilyMemberStructure,
  type DriveFile,
  type VaultStructure,
} from '../../lib/driveClient';
import { invalidateCachedListing } from '../../lib/listingCache';
import { BROWSABLE_CATEGORIES } from '../../config/taxonomy';
import type { FolderLabel } from '../../lib/folderIndex';
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

export default function VaultHome({ accessToken, structure, onAuthExpired, onSignOut }: Props) {
  const [scope, setScope] = useState<FamilyScope>({ kind: 'me' });
  const [activeStructure, setActiveStructure] = useState<VaultStructure>(structure);
  const [resolvingScope, setResolvingScope] = useState(false);
  const [switcherRefresh, setSwitcherRefresh] = useState(0);
  const [folderRefresh, setFolderRefresh] = useState(0);

  const [view, setView] = useState<View>('browse');
  const [viewerOrigin, setViewerOrigin] = useState<'folder' | 'search'>('folder');
  const [selectedCategory, setSelectedCategory] = useState<SelectedCategory | null>(null);
  const [selectedFile, setSelectedFile] = useState<DriveFile | null>(null);
  const [recentUploads, setRecentUploads] = useState<RecentUpload[]>([]);

  const familyRootId = structure.categories['Family'];
  const currentScopeLabel = scope.kind === 'me' ? 'Me' : scope.name;
  const browsableCategories = Object.fromEntries(
    Object.entries(activeStructure.categories).filter(([name]) =>
      (BROWSABLE_CATEGORIES as readonly string[]).includes(name)
    )
  );

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

  const openViewer = (file: DriveFile, category: SelectedCategory, origin: 'folder' | 'search') => {
    setSelectedFile(file);
    setSelectedCategory(category);
    setViewerOrigin(origin);
    setView('viewer');
  };

  if (view === 'capture') {
    return (
      <CaptureFlow
        accessToken={accessToken}
        categoryFolders={activeStructure.categories}
        onCancel={() => setView('browse')}
        onAuthExpired={onAuthExpired}
        onUploaded={({ category, fileName }) => {
          setRecentUploads((prev) => [{ category, fileName }, ...prev]);
          void invalidateCachedListing(activeStructure.categories[category]);
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
          categories={browsableCategories}
          onSelectCategory={(name, folderId) => {
            setSelectedCategory({ name, folderId, scopeLabel: currentScopeLabel });
            setView('folder');
          }}
        />
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
