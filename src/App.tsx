import { useCallback, useEffect, useState } from 'react';
import { requestGoogleAccessToken } from './lib/googleAuth';
import { ensureVaultStructure, type VaultStructure } from './lib/driveClient';
import { clearAllLocalData } from './lib/db';
import { saveSession, loadSession, clearSession } from './lib/session';
import { DEFAULT_CATEGORIES } from './config/taxonomy';
import VaultHome from './features/vault/VaultHome';
import LockGate from './features/lock/LockGate';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

type Status = 'signed-out' | 'signing-in' | 'scaffolding' | 'ready' | 'error';

export default function App() {
  const [status, setStatus] = useState<Status>('signed-out');
  const [error, setError] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [structure, setStructure] = useState<VaultStructure | null>(null);
  const [readyCategories, setReadyCategories] = useState<string[]>([]);

  // Restores a still-valid session instantly (no network calls, no
  // re-authenticating) so reopening the app within the same browser session
  // doesn't require signing in again every time.
  useEffect(() => {
    const session = loadSession();
    if (session) {
      setAccessToken(session.accessToken);
      setStructure(session.structure);
      setStatus('ready');
    }
  }, []);

  const signIn = useCallback(async (selectAccount: boolean) => {
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
      const { accessToken: token, expiresAt } = await requestGoogleAccessToken(CLIENT_ID, {
        selectAccount,
      });
      setAccessToken(token);
      setStatus('scaffolding');
      setReadyCategories([]);
      const result = await ensureVaultStructure(token, (category) => {
        setReadyCategories((prev) => [...prev, category]);
      });
      setStructure(result);
      setStatus('ready');
      saveSession({ accessToken: token, expiresAt, structure: result });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setStatus('error');
    }
  }, []);

  // The button always offers the account chooser — whoever picks up the
  // device next should be able to pick their own Google account rather than
  // silently continuing whichever session the browser has cached.
  const handleSignIn = useCallback(() => signIn(true), [signIn]);

  // Re-authenticating after a token expires mid-session should silently
  // refresh the SAME account, not interrupt with an account picker.
  const handleReauth = useCallback(() => signIn(false), [signIn]);

  const handleSignOut = useCallback(async () => {
    if (accessToken && window.google?.accounts?.oauth2) {
      window.google.accounts.oauth2.revoke(accessToken, () => {});
    }
    clearSession();
    await clearAllLocalData();
    setAccessToken(null);
    setStructure(null);
    setReadyCategories([]);
    setStatus('signed-out');
  }, [accessToken]);

  if (status === 'ready' && structure && accessToken) {
    return (
      <main className="screen">
        <LockGate>
          <VaultHome
            accessToken={accessToken}
            structure={structure}
            onAuthExpired={handleReauth}
            onSignOut={handleSignOut}
          />
        </LockGate>
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
