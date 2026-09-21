import { useState } from 'react';
import type { VaultStructure } from '../../lib/driveClient';
import CaptureFlow from '../capture/CaptureFlow';

type Props = {
  accessToken: string;
  structure: VaultStructure;
  onAuthExpired: () => void;
};

type RecentUpload = { category: string; fileName: string };

export default function VaultHome({ accessToken, structure, onAuthExpired }: Props) {
  const [view, setView] = useState<'home' | 'capture'>('home');
  const [recentUploads, setRecentUploads] = useState<RecentUpload[]>([]);

  if (view === 'capture') {
    return (
      <CaptureFlow
        accessToken={accessToken}
        categoryFolders={structure.categories}
        onCancel={() => setView('home')}
        onAuthExpired={onAuthExpired}
        onUploaded={({ category, fileName }) => {
          setRecentUploads((prev) => [{ category, fileName }, ...prev]);
          setView('home');
        }}
      />
    );
  }

  return (
    <div className="vault-home">
      <p className="success">
        Your Vault is set up in Google Drive with {Object.keys(structure.categories).length}{' '}
        categories, ready to file documents into.
      </p>

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
