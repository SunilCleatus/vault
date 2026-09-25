import { listCategories, listChildFolders, type VaultStructure } from './driveClient';

export type FolderLabel = { scopeLabel: string; category: string };

// Maps every known category folder ID (the owner's own + each existing
// family member's, including any custom categories added since setup) to a
// human-readable "who / category" label, so a global search result — which
// only carries its immediate parent folder ID — can show where it actually
// lives. Only lists existing folders; never creates anything (unlike
// ensureFamilyMemberStructure), since searching shouldn't have side effects.
export async function buildFolderIndex(
  accessToken: string,
  structure: VaultStructure
): Promise<Map<string, FolderLabel>> {
  const index = new Map<string, FolderLabel>();

  const meCategories = await listCategories(accessToken, structure.rootId);
  for (const [category, id] of Object.entries(meCategories)) {
    index.set(id, { scopeLabel: 'Me', category });
  }

  const familyRootId = structure.categories['Family'];
  if (familyRootId) {
    const members = await listChildFolders(accessToken, familyRootId);
    for (const member of members) {
      const memberCategories = await listCategories(accessToken, member.id);
      for (const [category, id] of Object.entries(memberCategories)) {
        index.set(id, { scopeLabel: member.name, category });
      }
    }
  }

  return index;
}
