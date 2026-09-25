import { openDb, FAVORITES_STORE } from './db';
import { encryptBlob, decryptBlob } from './crypto';

export type FavoriteMeta = {
  fileId: string;
  name: string;
  mimeType: string;
  category: string;
  scopeLabel: string;
  savedAt: number;
};

type FavoriteRecord = FavoriteMeta & { iv: string; ciphertext: string };

export async function saveFavorite(key: CryptoKey, meta: FavoriteMeta, blob: Blob): Promise<void> {
  const { iv, ciphertext } = await encryptBlob(key, blob);
  const record: FavoriteRecord = { ...meta, iv, ciphertext };
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(FAVORITES_STORE, 'readwrite');
    tx.objectStore(FAVORITES_STORE).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function removeFavorite(fileId: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(FAVORITES_STORE, 'readwrite');
    tx.objectStore(FAVORITES_STORE).delete(fileId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function isFavorited(fileId: string): Promise<boolean> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FAVORITES_STORE, 'readonly');
    const req = tx.objectStore(FAVORITES_STORE).get(fileId);
    req.onsuccess = () => resolve(!!req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function listFavoriteMeta(): Promise<FavoriteMeta[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FAVORITES_STORE, 'readonly');
    const req = tx.objectStore(FAVORITES_STORE).getAll();
    req.onsuccess = () => {
      const records = req.result as FavoriteRecord[];
      resolve(records.map(({ iv: _iv, ciphertext: _ciphertext, ...meta }) => meta));
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getFavoriteBlob(key: CryptoKey, fileId: string): Promise<Blob | null> {
  const db = await openDb();
  const record = await new Promise<FavoriteRecord | undefined>((resolve, reject) => {
    const tx = db.transaction(FAVORITES_STORE, 'readonly');
    const req = tx.objectStore(FAVORITES_STORE).get(fileId);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  if (!record) return null;
  return decryptBlob(key, record.iv, record.ciphertext, record.mimeType);
}

// Changing the PIN generates a new salt, which would otherwise make every
// existing offline favorite permanently undecryptable (their ciphertext was
// encrypted with a key derived from the OLD pin+salt). Decrypts each with
// the old key and re-encrypts with the new one so nothing is lost.
export async function reencryptFavorites(oldKey: CryptoKey, newKey: CryptoKey): Promise<void> {
  const db = await openDb();
  const records = await new Promise<FavoriteRecord[]>((resolve, reject) => {
    const tx = db.transaction(FAVORITES_STORE, 'readonly');
    const req = tx.objectStore(FAVORITES_STORE).getAll();
    req.onsuccess = () => resolve(req.result as FavoriteRecord[]);
    req.onerror = () => reject(req.error);
  });

  for (const record of records) {
    const blob = await decryptBlob(oldKey, record.iv, record.ciphertext, record.mimeType);
    const { iv, ciphertext } = await encryptBlob(newKey, blob);
    const updated: FavoriteRecord = { ...record, iv, ciphertext };
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(FAVORITES_STORE, 'readwrite');
      tx.objectStore(FAVORITES_STORE).put(updated);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}
