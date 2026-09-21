import { listChildFolders, type VaultStructure } from './driveClient';
import { BROWSABLE_CATEGORIES } from '../config/taxonomy';

export type FolderLabel = { scopeLabel: string; category: string };

// Maps every known category folder ID (the owner's own + each existing
// family member's) to a human-readable "who / category" label, so a global
// search result — which only carries its immediate parent folder ID — can
// show where it actually lives. Only lists existing folders; never creates
// anything (unlike ensureFamilyMemberStructure), since searching shouldn't
// have side effects.
export async function buildFolderIndex(
  accessToken: string,
  structure: VaultStructure
): Promise<Map<string, FolderLabel>> {
  const index = new Map<string, FolderLabel>();

  for (const category of BROWSABLE_CATEGORIES) {
    const id = structure.categories[category];
    if (id) index.set(id, { scopeLabel: 'Me', category });
  }

  const familyRootId = structure.categories['Family'];
  if (familyRootId) {
    const members = await listChildFolders(accessToken, familyRootId);
    for (const member of members) {
      const subfolders = await listChildFolders(accessToken, member.id);
      for (const sub of subfolders) {
        if ((BROWSABLE_CATEGORIES as readonly string[]).includes(sub.name)) {
          index.set(sub.id, { scopeLabel: member.name, category: sub.name });
        }
      }
    }
  }

  return index;
}
