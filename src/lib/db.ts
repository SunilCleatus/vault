const DB_NAME = 'vault-cache';
const DB_VERSION = 2;

export const LISTINGS_STORE = 'fileListings';
export const FAVORITES_STORE = 'favorites';

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
