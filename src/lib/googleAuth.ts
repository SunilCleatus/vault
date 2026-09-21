// Requests an OAuth access token scoped to files this app creates in Drive
// (drive.file), per the PRD's minimum-viable-scope decision — never full
// Drive access.
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

export function requestGoogleAccessToken(clientId: string): Promise<string> {
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
        resolve(response.access_token);
      },
    });

    tokenClient.requestAccessToken();
  });
}
