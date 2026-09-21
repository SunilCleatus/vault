import { BROWSABLE_CATEGORIES, DEFAULT_CATEGORIES, VAULT_ROOT_FOLDER_NAME } from '../config/taxonomy';

const DRIVE_FILES_API = 'https://www.googleapis.com/drive/v3/files';
const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';

export class DriveApiError extends Error {}

async function driveFetch<T>(accessToken: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${DRIVE_FILES_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new DriveApiError(`Drive API error ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

async function findFolder(
  accessToken: string,
  name: string,
  parentId: string | null
): Promise<string | null> {
  const parentClause = parentId ? `'${parentId}' in parents` : `'root' in parents`;
  const escapedName = name.replace(/'/g, "\\'");
  const q = encodeURIComponent(
    `name = '${escapedName}' and mimeType = '${FOLDER_MIME_TYPE}' and ${parentClause} and trashed = false`
  );
  const data = await driveFetch<{ files?: { id: string }[] }>(
    accessToken,
    `?q=${q}&fields=files(id,name)&spaces=drive`
  );
  return data.files?.[0]?.id ?? null;
}

async function createFolder(
  accessToken: string,
  name: string,
  parentId: string | null
): Promise<string> {
  const data = await driveFetch<{ id: string }>(accessToken, '', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      mimeType: FOLDER_MIME_TYPE,
      parents: parentId ? [parentId] : undefined,
    }),
  });
  return data.id;
}

// Idempotent: reuses an existing folder with the same name/parent instead of
// creating a duplicate, so re-running this after a partial failure (or on
// every sign-in) is always safe.
export async function ensureFolder(
  accessToken: string,
  name: string,
  parentId: string | null
): Promise<string> {
  const existing = await findFolder(accessToken, name, parentId);
  if (existing) return existing;
  return createFolder(accessToken, name, parentId);
}

export type VaultStructure = {
  rootId: string;
  categories: Record<string, string>;
};

export async function ensureVaultStructure(
  accessToken: string,
  onCategoryReady?: (category: string) => void
): Promise<VaultStructure> {
  const rootId = await ensureFolder(accessToken, VAULT_ROOT_FOLDER_NAME, null);
  const categories: Record<string, string> = {};
  for (const category of DEFAULT_CATEGORIES) {
    categories[category] = await ensureFolder(accessToken, category, rootId);
    onCategoryReady?.(category);
  }
  return { rootId, categories };
}

// Same idempotent create-or-reuse structure, but rooted at Family/<name>/
// instead of Vault/, so each family member gets their own set of category
// folders under the owner's single Drive.
export async function ensureFamilyMemberStructure(
  accessToken: string,
  familyRootId: string,
  memberName: string,
  onCategoryReady?: (category: string) => void
): Promise<VaultStructure> {
  const rootId = await ensureFolder(accessToken, memberName, familyRootId);
  const categories: Record<string, string> = {};
  for (const category of BROWSABLE_CATEGORIES) {
    categories[category] = await ensureFolder(accessToken, category, rootId);
    onCategoryReady?.(category);
  }
  return { rootId, categories };
}

export async function listChildFolders(
  accessToken: string,
  parentId: string
): Promise<{ id: string; name: string }[]> {
  const q = encodeURIComponent(
    `'${parentId}' in parents and mimeType = '${FOLDER_MIME_TYPE}' and trashed = false`
  );
  const data = await driveFetch<{ files?: { id: string; name: string }[] }>(
    accessToken,
    `?q=${q}&fields=files(id,name)&orderBy=name&spaces=drive`
  );
  return data.files ?? [];
}

export type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  webViewLink?: string;
  iconLink?: string;
  thumbnailLink?: string;
  description?: string;
  properties?: Record<string, string>;
  parents?: string[];
};

export async function listFiles(accessToken: string, folderId: string): Promise<DriveFile[]> {
  const q = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
  const fields = encodeURIComponent(
    'files(id,name,mimeType,modifiedTime,webViewLink,iconLink,thumbnailLink,description,properties)'
  );
  const data = await driveFetch<{ files?: DriveFile[] }>(
    accessToken,
    `?q=${q}&fields=${fields}&orderBy=name&spaces=drive&pageSize=200`
  );
  return data.files ?? [];
}

export async function downloadFileBlob(accessToken: string, fileId: string): Promise<Blob> {
  const res = await fetch(`${DRIVE_FILES_API}/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new DriveApiError(`Could not download file (${res.status}).`);
  }
  return res.blob();
}

export async function deleteFile(accessToken: string, fileId: string): Promise<void> {
  const res = await fetch(`${DRIVE_FILES_API}/${fileId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok && res.status !== 204) {
    throw new DriveApiError(`Could not delete file (${res.status}): ${await res.text()}`);
  }
}

// Grants another person's Google account access to this one file via
// Drive's own sharing — the drive.file scope covers managing permissions on
// files the app created, so no extra OAuth scope is needed. Used for
// explicitly sharing a single document across two separate family-member
// accounts (each with their own private Vault), as opposed to the
// owner-manages-everyone Family/<name> folders.
export async function shareFile(
  accessToken: string,
  fileId: string,
  email: string,
  role: 'reader' | 'writer' = 'reader'
): Promise<void> {
  const res = await fetch(`${DRIVE_FILES_API}/${fileId}/permissions?sendNotificationEmail=true`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ role, type: 'user', emailAddress: email }),
  });
  if (!res.ok) {
    throw new DriveApiError(`Could not share file (${res.status}): ${await res.text()}`);
  }
}
