export const VAULT_ROOT_FOLDER_NAME = 'Vault';

export const DEFAULT_CATEGORIES = [
  'Identity',
  'Licenses',
  'Property',
  'Insurance',
  'Financial',
  'Medical',
  'Family',
  'Other',
] as const;

export type DefaultCategory = (typeof DEFAULT_CATEGORIES)[number];

// "Family" is a container for per-member subfolders, not a place to file
// documents directly — excluded from category grids and from what gets
// created under each family member (no nested Family-within-a-person).
export const BROWSABLE_CATEGORIES = DEFAULT_CATEGORIES.filter((c) => c !== 'Family');

