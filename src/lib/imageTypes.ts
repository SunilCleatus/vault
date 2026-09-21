const SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png']);

export function isPdfEmbeddableImage(mimeType: string): boolean {
  return SUPPORTED_IMAGE_TYPES.has(mimeType);
}
