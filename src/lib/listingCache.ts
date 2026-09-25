import type { DriveFile } from './driveClient';
import { openDb, LISTINGS_STORE } from './db';

// Local metadata cache so re-opening a folder feels instant (PRD's <500ms
// browse target) instead of always round-tripping to the Drive API first.
// Cache-then-network: callers show this immediately, then overwrite with a
// fresh fetch. Falls back to cache-miss behavior (network only) if
// IndexedDB is unavailable (private browsing, storage disabled, etc.).
export async function getCachedListing(folderId: string): Promise<DriveFile[] | null> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(LISTINGS_STORE, 'readonly');
      const req = tx.objectStore(LISTINGS_STORE).get(folderId);
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
      const tx = db.transaction(LISTINGS_STORE, 'readwrite');
      tx.objectStore(LISTINGS_STORE).put({ folderId, files, fetchedAt: Date.now() });
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
      const tx = db.transaction(LISTINGS_STORE, 'readwrite');
      tx.objectStore(LISTINGS_STORE).delete(folderId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // best-effort only
  }
}
