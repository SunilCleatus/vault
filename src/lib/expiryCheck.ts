import type { DriveFile } from './driveClient';

const DRIVE_FILES_API = 'https://www.googleapis.com/drive/v3/files';
const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';

export type ExpiringFile = DriveFile & { daysUntilExpiry: number };

// Fetches every non-folder file the app can see (drive.file scope already
// limits this to files the app created) and filters client-side for an
// expiryDate property landing within the reminder window. Drive's query
// syntax for custom properties only supports exact-value matches, not
// date-range comparisons, so the range filter has to happen here rather
// than server-side.
export async function findExpiringSoon(
  accessToken: string,
  withinDays: number = 30
): Promise<ExpiringFile[]> {
  const q = encodeURIComponent(`mimeType != '${FOLDER_MIME_TYPE}' and trashed = false`);
  const fields = encodeURIComponent('files(id,name,mimeType,modifiedTime,properties,parents)');
  const res = await fetch(`${DRIVE_FILES_API}?q=${q}&fields=${fields}&pageSize=1000&spaces=drive`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Could not check expiry dates (${res.status}).`);
  }
  const data = await res.json();
  const files: DriveFile[] = data.files ?? [];

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const results: ExpiringFile[] = [];

  for (const file of files) {
    const expiry = file.properties?.expiryDate;
    if (!expiry) continue;
    const expiryDate = new Date(expiry);
    if (Number.isNaN(expiryDate.getTime())) continue;
    const daysUntilExpiry = Math.round((expiryDate.getTime() - today.getTime()) / 86_400_000);
    if (daysUntilExpiry <= withinDays) {
      results.push({ ...file, daysUntilExpiry });
    }
  }

  results.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
  return results;
}

export function formatDaysUntilExpiry(days: number): string {
  if (days < 0) return `Expired ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago`;
  if (days === 0) return 'Expires today';
  return `Expires in ${days} day${days === 1 ? '' : 's'}`;
}
