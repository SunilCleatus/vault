import type { DriveFile } from './driveClient';

const DRIVE_FILES_API = 'https://www.googleapis.com/drive/v3/files';
const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';

// Searches across the whole Drive (name and full-text/description), not
// folder-by-folder — the drive.file OAuth scope already limits visibility
// to files this app created, so a single broad query is both simpler and
// faster than iterating every category/family-member folder.
export async function searchFiles(accessToken: string, term: string): Promise<DriveFile[]> {
  const escaped = term.replace(/'/g, "\\'");
  const q = encodeURIComponent(
    `(name contains '${escaped}' or fullText contains '${escaped}') and mimeType != '${FOLDER_MIME_TYPE}' and trashed = false`
  );
  const fields = encodeURIComponent(
    'files(id,name,mimeType,modifiedTime,webViewLink,iconLink,thumbnailLink,description,properties,parents)'
  );
  const res = await fetch(
    `${DRIVE_FILES_API}?q=${q}&fields=${fields}&orderBy=name&spaces=drive&pageSize=50`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) {
    throw new Error(`Search failed (${res.status}).`);
  }
  const data = await res.json();
  return data.files ?? [];
}
