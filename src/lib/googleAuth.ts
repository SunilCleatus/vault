// Requests an OAuth access token scoped to files this app creates in Drive
// (drive.file), per the PRD's minimum-viable-scope decision — never full
// Drive access.
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

// Treat the token as expiring a bit before Google actually does, so a
// borderline-stale restored session gets refreshed proactively rather than
// failing a Drive call mid-use.
const EXPIRY_SAFETY_BUFFER_SECONDS = 300;

export type GoogleAuthResult = { accessToken: string; expiresAt: number };

export function requestGoogleAccessToken(
  clientId: string,
  options: { selectAccount?: boolean } = {}
): Promise<GoogleAuthResult> {
  return new Promise((resolve, reject) => {
    if (!window.google?.accounts?.oauth2) {
      reject(
        new Error(
          'Google Sign-In has not finished loading yet. Please wait a moment and try again.'
        )
      );
      return;
    }

    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_SCOPE,
      callback: (response) => {
        if (response.error || !response.access_token) {
          reject(new Error(response.error ?? 'Google sign-in failed.'));
          return;
        }
        const lifetimeSeconds = Math.max(
          (response.expires_in ?? 3600) - EXPIRY_SAFETY_BUFFER_SECONDS,
          60
        );
        resolve({
          accessToken: response.access_token,
          expiresAt: Date.now() + lifetimeSeconds * 1000,
        });
      },
    });

    // Forces Google's account chooser instead of silently reusing whatever
    // account is cached in the browser — lets a different family member
    // pick their own account on a shared device instead of landing back in
    // whoever last signed in here.
    tokenClient.requestAccessToken(options.selectAccount ? { prompt: 'select_account' } : undefined);
  });
}
