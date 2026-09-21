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
