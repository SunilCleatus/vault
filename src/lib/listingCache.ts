import type { DriveFile } from './driveClient';

// Local metadata cache so re-opening a folder feels instant (PRD's <500ms
// browse target) instead of always round-tripping to the Drive API first.
// Cache-then-network: callers show this immediately, then overwrite with a
// fresh fetch. Falls back to cache-miss behavior (network only) if
// IndexedDB is unavailable (private browsing, storage disabled, etc.).
const DB_NAME = 'vault-cache';
const DB_VERSION = 1;
const STORE = 'fileListings';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: 'folderId' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getCachedListing(folderId: string): Promise<DriveFile[] | null> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(folderId);
      req.onsuccess = () => resolve(req.result?.files ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function setCachedListing(folderId: string, files: DriveFile[]): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put({ folderId, files, fetchedAt: Date.now() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // best-effort only
  }
}

export async function invalidateCachedListing(folderId: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(folderId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // best-effort only
  }
}
