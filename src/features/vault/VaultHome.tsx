import { useEffect, useState } from 'react';
import {
  ensureFamilyMemberStructure,
  type DriveFile,
  type VaultStructure,
} from '../../lib/driveClient';
import { invalidateCachedListing } from '../../lib/listingCache';
import { BROWSABLE_CATEGORIES } from '../../config/taxonomy';
import CaptureFlow from '../capture/CaptureFlow';
import CategoryGrid from '../browse/CategoryGrid';
import FolderView from '../browse/FolderView';
import DocumentViewer from '../browse/DocumentViewer';
import FamilySwitcher, { type FamilyScope } from '../family/FamilySwitcher';

type Props = {
  accessToken: string;
  structure: VaultStructure;
  onAuthExpired: () => void;
};

type RecentUpload = { category: string; fileName: string };
type View = 'browse' | 'folder' | 'viewer' | 'capture';
type SelectedCategory = { name: string; folderId: string };

export default function VaultHome({ accessToken, structure, onAuthExpired }: Props) {
  const [scope, setScope] = useState<FamilyScope>({ kind: 'me' });
  const [activeStructure, setActiveStructure] = useState<VaultStructure>(structure);
  const [resolvingScope, setResolvingScope] = useState(false);
  const [switcherRefresh, setSwitcherRefresh] = useState(0);
  const [folderRefresh, setFolderRefresh] = useState(0);

  const [view, setView] = useState<View>('browse');
  const [selectedCategory, setSelectedCategory] = useState<SelectedCategory | null>(null);
  const [selectedFile, setSelectedFile] = useState<DriveFile | null>(null);
  const [recentUploads, setRecentUploads] = useState<RecentUpload[]>([]);

  const familyRootId = structure.categories['Family'];
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
        onClose={() => {
          setSelectedFile(null);
          setView('folder');
        }}
        onDeleted={() => {
          void invalidateCachedListing(selectedCategory.folderId);
          setSelectedFile(null);
          setFolderRefresh((n) => n + 1);
          setView('folder');
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
        onSelectFile={(file) => {
          setSelectedFile(file);
          setView('viewer');
        }}
      />
    );
  }

  return (
    <div className="vault-home">
      <FamilySwitcher
        accessToken={accessToken}
        familyRootId={familyRootId}
        scope={scope}
        onScopeChange={setScope}
        refreshToken={switcherRefresh}
      />

      {resolvingScope && <p className="status-line">Setting up their folders…</p>}

      {!resolvingScope && (
        <CategoryGrid
          categories={browsableCategories}
          onSelectCategory={(name, folderId) => {
            setSelectedCategory({ name, folderId });
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
