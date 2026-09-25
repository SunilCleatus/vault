// PIN-derived encryption for locally cached favorites. The PIN is never
// stored — only a salt and a "check" ciphertext that lets us verify a
// re-entered PIN derives the same key, per the PRD's fallback-to-PIN
// key-management decision (WebAuthn alone can't recover a symmetric key
// without the PRF extension, which isn't reliably available across browsers
// yet).
const PBKDF2_ITERATIONS = 150_000;
const CHECK_PLAINTEXT = 'vault-pin-check-v1';
const SALT_KEY = 'vault.lock.salt';
const CHECK_KEY = 'vault.lock.check';

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

async function deriveKey(pin: string, salt: Uint8Array): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pin),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export function isPinConfigured(): boolean {
  return !!localStorage.getItem(SALT_KEY) && !!localStorage.getItem(CHECK_KEY);
}

export async function setupPin(pin: string): Promise<void> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(pin, salt);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    new TextEncoder().encode(CHECK_PLAINTEXT)
  );
  localStorage.setItem(SALT_KEY, toBase64(salt));
  localStorage.setItem(
    CHECK_KEY,
    JSON.stringify({ iv: toBase64(iv), ct: toBase64(new Uint8Array(ciphertext)) })
  );
}

export async function verifyPin(pin: string): Promise<CryptoKey | null> {
  const saltB64 = localStorage.getItem(SALT_KEY);
  const checkRaw = localStorage.getItem(CHECK_KEY);
  if (!saltB64 || !checkRaw) return null;

  const salt = fromBase64(saltB64);
  const { iv, ct } = JSON.parse(checkRaw) as { iv: string; ct: string };
  const key = await deriveKey(pin, salt);
  try {
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(iv) as BufferSource },
      key,
      fromBase64(ct) as BufferSource
    );
    return new TextDecoder().decode(plain) === CHECK_PLAINTEXT ? key : null;
  } catch {
    return null;
  }
}

export async function encryptBlob(key: CryptoKey, blob: Blob): Promise<{ iv: string; ciphertext: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new Uint8Array(await blob.arrayBuffer());
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, data as BufferSource);
  return { iv: toBase64(iv), ciphertext: toBase64(new Uint8Array(ciphertext)) };
}

export async function decryptBlob(
  key: CryptoKey,
  ivB64: string,
  ciphertextB64: string,
  mimeType: string
): Promise<Blob> {
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(ivB64) as BufferSource },
    key,
    fromBase64(ciphertextB64) as BufferSource
  );
  return new Blob([plain], { type: mimeType });
}
