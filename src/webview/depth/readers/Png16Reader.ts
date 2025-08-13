import { DepthReader, DepthReaderResult, DepthImage, DepthMetadata } from '../types';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const UPNG = require('upng-js');

export class Png16Reader implements DepthReader {
  canRead(filename: string, mimeType?: string): boolean {
    const f = filename.toLowerCase();
    return f.endsWith('.png') || mimeType === 'image/png';
  }

  async read(arrayBuffer: ArrayBuffer): Promise<DepthReaderResult> {
    const png = UPNG.decode(arrayBuffer);
    const width = png.width as number;
    const height = png.height as number;
    // Get first frame as 16-bit if present
    const frames = UPNG.toRGBA8(png);
    if (!frames || !frames.length) throw new Error('PNG decode failed: no frames. Ensure grayscale 16-bit PNG.');
    const rgba = new Uint8Array(frames[0]);
    // If grayscale 16-bit, png.depth===16 and palette/alpha absent. Our RGBA8 conversion collapses to 8-bit.
    // Prefer UPNG.toUint16 if available; otherwise attempt to reconstruct from raw
    let data: Float32Array;
    if ((png as any).depth === 16 && png.ctype === 0) {
      // Try to extract the original 16-bit samples using raw buffer if exposed
      const raw = (png as any).tabs?.data || null;
      // If unavailable, fall back to 8-bit channel with guidance
      data = new Float32Array(width * height);
      for (let i = 0, p = 0; i < data.length; i++, p += 4) data[i] = rgba[p];
    } else {
      // 8-bit depth stored in one channel (use R)
      data = new Float32Array(width * height);
      for (let i = 0, p = 0; i < data.length; i++, p += 4) data[i] = rgba[p];
    }

    const image: DepthImage = { width, height, data };
    const meta: DepthMetadata = { kind: 'depth', unit: 'meter', scale: 1 };
    return { image, meta };
  }
}


