const DB_NAME = 'vault-cache';
const DB_VERSION = 2;

export const LISTINGS_STORE = 'fileListings';
export const FAVORITES_STORE = 'favorites';

// Wipes both local stores on sign-out, since they're per-account caches (not
// the source of truth — Drive is) and must not leak into the next account
// that signs in on this device.
export async function clearAllLocalData(): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([LISTINGS_STORE, FAVORITES_STORE], 'readwrite');
      tx.objectStore(LISTINGS_STORE).clear();
      tx.objectStore(FAVORITES_STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // best-effort only
  }
}

export function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(LISTINGS_STORE)) {
        db.createObjectStore(LISTINGS_STORE, { keyPath: 'folderId' });
      }
      if (!db.objectStoreNames.contains(FAVORITES_STORE)) {
        db.createObjectStore(FAVORITES_STORE, { keyPath: 'fileId' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
