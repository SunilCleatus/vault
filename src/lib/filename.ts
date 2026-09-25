const EXTENSION_BY_MIME: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

function slugify(text: string): string {
  return text.trim().replace(/\s+/g, '_').replace(/[^\w-]/g, '');
}

// Matches the PRD's naming convention, e.g. Aadhaar_SunilGeorge_2024-09-21.pdf
export function buildFileName(category: string, title: string, mimeType: string): string {
  const date = new Date().toISOString().slice(0, 10);
  const base = slugify(title) || slugify(category) || 'Document';
  const extension = EXTENSION_BY_MIME[mimeType] ?? 'bin';
  return `${base}_${date}.${extension}`;
}
