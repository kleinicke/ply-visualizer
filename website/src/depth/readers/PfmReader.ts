import { DepthReader, DepthReaderResult, DepthImage, DepthMetadata } from '../types';

function readAsciiLine(view: DataView, offset: number): { line: string; next: number } {
  const bytes: number[] = [];
  for (let i = offset; i < view.byteLength; i++) {
    const b = view.getUint8(i);
    if (b === 0x0a /*\n*/) {
      return { line: new TextDecoder().decode(new Uint8Array(bytes)), next: i + 1 };
    }
    if (b !== 0x0d /*\r*/) {
      bytes.push(b);
    }
  }
  return { line: new TextDecoder().decode(new Uint8Array(bytes)), next: view.byteLength };
}

export class PfmReader implements DepthReader {
  canRead(filename: string): boolean {
    return filename.toLowerCase().endsWith('.pfm');
  }

  async read(arrayBuffer: ArrayBuffer): Promise<DepthReaderResult> {
    const view = new DataView(arrayBuffer);
    let offset = 0;
    // Header
    let r1 = readAsciiLine(view, offset);
    offset = r1.next;
    const id = r1.line.trim();
    if (id !== 'Pf' && id !== 'PF') {
      throw new Error('Invalid PFM header');
    }
    const channels = id === 'PF' ? 3 : 1;
    let r2 = readAsciiLine(view, offset);
    offset = r2.next;
    const dims = r2.line.trim().split(/\s+/);
    if (dims.length < 2) {
      throw new Error('Invalid PFM dimensions');
    }
    const width = parseInt(dims[0], 10);
    const height = parseInt(dims[1], 10);
    let r3 = readAsciiLine(view, offset);
    offset = r3.next;
    const scaleStr = r3.line.trim();
    const scale = parseFloat(scaleStr);
    const littleEndian = scale < 0;

    const numFloats = width * height * channels;
    const data = new Float32Array(width * height);
    const dv = new DataView(arrayBuffer, offset);
    const step = 4 * channels;
    // PFM stores scanlines from bottom to top
    for (let y = height - 1; y >= 0; y--) {
      const rowStart = (height - 1 - y) * width * step;
      for (let x = 0; x < width; x++) {
        const base = rowStart + x * step;
        const d = dv.getFloat32(base, littleEndian);
        data[y * width + x] = d;
      }
    }

    const image: DepthImage = { width, height, data };
    const meta: DepthMetadata = { kind: 'depth', unit: 'meter', scale: Math.abs(scale) || 1 };
    return { image, meta };
  }
}
