import { DEFAULT_CATEGORIES, VAULT_ROOT_FOLDER_NAME } from '../config/taxonomy';

const DRIVE_FILES_API = 'https://www.googleapis.com/drive/v3/files';
const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';

export class DriveApiError extends Error {}

async function driveFetch(
  accessToken: string,
  path: string,
  init: RequestInit = {}
): Promise<any> {
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
  return res.json();
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
  const data = await driveFetch(accessToken, `?q=${q}&fields=files(id,name)&spaces=drive`);
  return data.files?.[0]?.id ?? null;
}

async function createFolder(
  accessToken: string,
  name: string,
  parentId: string | null
): Promise<string> {
  const data = await driveFetch(accessToken, '', {
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
