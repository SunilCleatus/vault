import { PDFDocument } from 'pdf-lib';
import { isPdfEmbeddableImage } from './imageTypes';

// Combines multiple captured page images into a single multi-page PDF, so a
// document like a multi-page rental agreement files as one item, not several.
export async function imagesToPdf(images: { blob: Blob; mimeType: string }[]): Promise<Blob> {
  const pdfDoc = await PDFDocument.create();

  for (const image of images) {
    if (!isPdfEmbeddableImage(image.mimeType)) {
      throw new Error(
        `Unsupported image type "${image.mimeType}" for a multi-page document. Use JPEG or PNG photos.`
      );
    }
    const bytes = new Uint8Array(await image.blob.arrayBuffer());
    const embedded =
      image.mimeType === 'image/png' ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
    const page = pdfDoc.addPage([embedded.width, embedded.height]);
    page.drawImage(embedded, { x: 0, y: 0, width: embedded.width, height: embedded.height });
  }

  const pdfBytes = await pdfDoc.save();
  // pdf-lib always backs this with a plain ArrayBuffer, never SharedArrayBuffer;
  // slice() both copies out our byte range and narrows the type Blob expects.
  const buffer = pdfBytes.buffer.slice(
    pdfBytes.byteOffset,
    pdfBytes.byteOffset + pdfBytes.byteLength
  ) as ArrayBuffer;
  return new Blob([buffer], { type: 'application/pdf' });
}
