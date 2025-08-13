import { DepthReader, DepthReaderResult, DepthImage, DepthMetadata } from '../types';

// We'll rely on browser ImageBitmap and canvas to decode, since the webview has DOM.
// For true 16-bit precision, consider adding UPNG.js later; for now we read as 8-bit
// fallback and document that sidecar scale may be required.

export class Png16Reader implements DepthReader {
  canRead(filename: string, mimeType?: string): boolean {
    const f = filename.toLowerCase();
    return f.endsWith('.png') || mimeType === 'image/png';
  }

  async read(arrayBuffer: ArrayBuffer): Promise<DepthReaderResult> {
    // Decode using createImageBitmap for simplicity; this will quantize to 8-bit.
    // We keep structure ready to swap in a true 16-bit decoder later (UPNG.js).
    const blob = new Blob([arrayBuffer], { type: 'image/png' });
    const bitmap = await createImageBitmap(blob);

    const width = bitmap.width;
    const height = bitmap.height;
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D | null;
    if (!ctx) throw new Error('2D context not available');
    ctx.drawImage(bitmap, 0, 0);
    const imgData = ctx.getImageData(0, 0, width, height);

    // If source is single-channel 16-bit, this path loses precision. We'll accept
    // it for initial implementation and replace with UPNG later.
    const data = new Float32Array(width * height);
    const src = imgData.data; // RGBA 8-bit
    for (let i = 0, p = 0; i < data.length; i++, p += 4) {
      // Use R channel. Sidecar scale expected (e.g., mm in 0..65535 → we only have 0..255 here)
      data[i] = src[p];
    }

    const image: DepthImage = { width, height, data };
    const meta: DepthMetadata = {
      kind: 'depth',
      // Users will likely provide scale via sidecar; default assume meters already
      unit: 'meter',
      scale: 1,
    };
    return { image, meta };
  }
}


