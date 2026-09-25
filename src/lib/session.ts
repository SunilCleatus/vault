import type { VaultStructure } from './driveClient';

// Session-only (not localStorage): survives closing and reopening the app
// within the same browser session, but never persists across a real device
// restart or lingers indefinitely — there's no refresh-token flow here,
// which would need a backend to exchange codes without exposing a client
// secret. This is the no-backend middle ground: skip re-authenticating on
// every reopen, without changing the "no server for document data"
// architecture.
const SESSION_KEY = 'vault.session';

type StoredSession = {
  accessToken: string;
  expiresAt: number;
  structure: VaultStructure;
};

export function saveSession(session: StoredSession): void {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // best-effort only (private browsing, storage disabled, etc.)
  }
}

export function loadSession(): StoredSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSession;
    if (Date.now() >= parsed.expiresAt) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}
