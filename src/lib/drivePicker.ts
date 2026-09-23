// Wraps the Google Picker API — the documented way to grant a drive.file-
// scoped app access to files it did NOT create, without upgrading to a
// broader Drive scope. Selecting a file through this picker grants our app
// file-level access to it, same as if we'd created it ourselves.
const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';

export type PickedFile = { id: string; name: string; mimeType: string };

function loadPickerApi(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.picker) {
      resolve();
      return;
    }
    if (!window.gapi) {
      reject(
        new Error('Google API loader has not finished loading yet. Please wait a moment and try again.')
      );
      return;
    }
    window.gapi.load('picker', () => resolve());
  });
}

export async function openDrivePicker(accessToken: string, apiKey: string): Promise<PickedFile[]> {
  await loadPickerApi();
  const picker = window.google?.picker;
  if (!picker) {
    throw new Error('Google Picker failed to load.');
  }

  return new Promise((resolve) => {
    const view = new picker.DocsView();
    view.setIncludeFolders(false);

    const builtPicker = new picker.PickerBuilder()
      .setOAuthToken(accessToken)
      .setDeveloperKey(apiKey)
      .addView(view)
      .setCallback((data: PickerResponse) => {
        if (data.action === picker.Action.PICKED) {
          resolve(
            (data.docs ?? [])
              .filter((doc) => doc.mimeType !== FOLDER_MIME_TYPE)
              .map((doc) => ({ id: doc.id, name: doc.name, mimeType: doc.mimeType }))
          );
        } else if (data.action === picker.Action.CANCEL) {
          resolve([]);
        }
      })
      .build();

    builtPicker.setVisible(true);
  });
}
