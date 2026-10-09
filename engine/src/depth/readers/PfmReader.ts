import { DepthReader, DepthReaderResult, DepthImage, DepthMetadata } from '../types';
import { decodeDepthPfmWasm } from './tiffWasm';

/**
 * The scale line of a PFM header (the third non-comment line). Its magnitude
 * is the depth scale; its sign only says which byte order the samples use,
 * which the decoder handles. Some writers put `#` comment lines in the
 * header, which the format does not define but every common reader accepts.
 */
function headerScale(bytes: Uint8Array): number {
  const text = new TextDecoder('latin1').decode(bytes.subarray(0, Math.min(bytes.length, 4096)));
  const lines = text.split('\n').filter(line => !line.trimStart().startsWith('#'));
  const scale = parseFloat(lines[2] ?? '');
  return Number.isFinite(scale) ? scale : 1;
}

/**
 * Portable float maps, decoded by the shared Rust decoder (the one the agent
 * tools already used). The JavaScript reader it replaces read a header with a
 * comment line as NaN x NaN, and the conversion of that never finished.
 */
export class PfmReader implements DepthReader {
  canRead(filename: string): boolean {
    return filename.toLowerCase().endsWith('.pfm');
  }

  async read(arrayBuffer: ArrayBuffer): Promise<DepthReaderResult> {
    const bytes = new Uint8Array(arrayBuffer);
    const raster = await decodeDepthPfmWasm(bytes);
    const { width, height, channels } = raster;
    if (!(width > 0 && height > 0) || raster.data.length < width * height * channels) {
      throw new Error('Invalid PFM file');
    }
    // A colour (PF) map carries depth in its first channel.
    let data = raster.data;
    if (channels > 1) {
      data = new Float32Array(width * height);
      for (let i = 0; i < data.length; i++) {
        data[i] = raster.data[i * channels];
      }
    }
    const image: DepthImage = { width, height, data };
    const meta: DepthMetadata = {
      kind: 'depth',
      unit: 'meter',
      scale: Math.abs(headerScale(bytes)) || 1,
    };
    return { image, meta };
  }
}
