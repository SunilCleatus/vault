// WebAuthn is used purely as a local, no-server unlock gesture (Face
// ID/Touch ID/fingerprint) gating the app-lock screen — the platform
// authenticator already enforces device biometric/PIN verification before
// resolving, so a successful assertion is a sufficient "this is the device
// owner" signal without needing our own relying-party server. It does NOT
// derive the encryption key used for offline favorites; that always comes
// from the PIN (see crypto.ts), since WebAuthn's PRF extension for that
// purpose isn't reliably available across browsers/OS versions yet.
const CREDENTIAL_ID_KEY = 'vault.lock.webauthnCredentialId';

function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (!window.PublicKeyCredential?.isUserVerifyingPlatformAuthenticatorAvailable) return false;
  try {
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

export function isWebAuthnRegistered(): boolean {
  return !!localStorage.getItem(CREDENTIAL_ID_KEY);
}

export async function registerWebAuthn(): Promise<boolean> {
  try {
    const credential = (await navigator.credentials.create({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rp: { name: 'Vault' },
        user: {
          id: crypto.getRandomValues(new Uint8Array(16)),
          name: 'vault-owner',
          displayName: 'Vault owner',
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },
          { type: 'public-key', alg: -257 },
        ],
        authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' },
        timeout: 60000,
      },
    })) as PublicKeyCredential | null;

    if (!credential) return false;
    localStorage.setItem(CREDENTIAL_ID_KEY, bufferToBase64Url(credential.rawId));
    return true;
  } catch {
    return false;
  }
}

export async function verifyWebAuthn(): Promise<boolean> {
  const credentialId = localStorage.getItem(CREDENTIAL_ID_KEY);
  if (!credentialId) return false;
  try {
    const credential = await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: [{ id: base64UrlToBuffer(credentialId), type: 'public-key' }],
        userVerification: 'required',
        timeout: 60000,
      },
    });
    return !!credential;
  } catch {
    return false;
  }
}
