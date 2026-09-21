import { useCallback, useState } from 'react';
import { requestGoogleAccessToken } from './lib/googleAuth';
import { ensureVaultStructure, type VaultStructure } from './lib/driveClient';
import { DEFAULT_CATEGORIES } from './config/taxonomy';
import VaultHome from './features/vault/VaultHome';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

type Status = 'signed-out' | 'signing-in' | 'scaffolding' | 'ready' | 'error';

export default function App() {
  const [status, setStatus] = useState<Status>('signed-out');
  const [error, setError] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [structure, setStructure] = useState<VaultStructure | null>(null);
  const [readyCategories, setReadyCategories] = useState<string[]>([]);

  const handleSignIn = useCallback(async () => {
    if (!CLIENT_ID) {
      setError(
        'Missing VITE_GOOGLE_CLIENT_ID. Set it in a .env.local file (see .env.example).'
      );
      setStatus('error');
      return;
    }

    setError(null);
    setStatus('signing-in');
    try {
      const token = await requestGoogleAccessToken(CLIENT_ID);
      setAccessToken(token);
      setStatus('scaffolding');
      setReadyCategories([]);
      const result = await ensureVaultStructure(token, (category) => {
        setReadyCategories((prev) => [...prev, category]);
      });
      setStructure(result);
      setStatus('ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setStatus('error');
    }
  }, []);

  if (status === 'ready' && structure && accessToken) {
    return (
      <main className="screen">
        <VaultHome accessToken={accessToken} structure={structure} onAuthExpired={handleSignIn} />
      </main>
    );
  }

  const showSignIn = status === 'signed-out' || status === 'error';
  const showProgress = status === 'scaffolding';

  return (
    <main className="screen">
      <h1>Vault</h1>
      <p className="tagline">Your documents, organized in your own Google Drive.</p>

      {showSignIn && (
        <>
          <button className="primary-button" onClick={handleSignIn}>
            Sign in with Google
          </button>
          {error && <p className="error">{error}</p>}
        </>
      )}

      {status === 'signing-in' && <p className="status-line">Waiting for Google sign-in…</p>}

      {showProgress && (
        <ul className="category-list">
          {DEFAULT_CATEGORIES.map((category) => {
            const done = readyCategories.includes(category);
            return (
              <li key={category} className={done ? 'done' : ''}>
                <span className="marker">{done ? '✓' : '…'}</span>
                {category}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
