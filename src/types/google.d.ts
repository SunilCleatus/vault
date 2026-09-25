export {};

declare global {
  interface GooglePickerDocsView {
    setIncludeFolders(include: boolean): GooglePickerDocsView;
    setSelectFolderEnabled(enabled: boolean): GooglePickerDocsView;
  }

  interface GooglePickerBuilder {
    setOAuthToken(token: string): GooglePickerBuilder;
    setDeveloperKey(key: string): GooglePickerBuilder;
    addView(view: GooglePickerDocsView): GooglePickerBuilder;
    setCallback(callback: (data: PickerResponse) => void): GooglePickerBuilder;
    build(): { setVisible(visible: boolean): void };
  }

  type PickerResponse = {
    action: string;
    docs?: { id: string; name: string; mimeType: string }[];
  };

  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient(config: {
            client_id: string;
            scope: string;
            callback: (response: {
              access_token?: string;
              expires_in?: number;
              error?: string;
            }) => void;
          }): {
            requestAccessToken: (overrideConfig?: { prompt?: string }) => void;
          };
          revoke(accessToken: string, done: () => void): void;
        };
      };
      picker: {
        Action: { PICKED: string; CANCEL: string };
        DocsView: new () => GooglePickerDocsView;
        PickerBuilder: new () => GooglePickerBuilder;
      };
    };
    gapi?: {
      load(apiName: string, callback: () => void): void;
    };
  }
}
