import { DepthReader, DepthReaderResult, DepthImage, DepthMetadata } from '../types';

// Lightweight NPY reader (npyjs-like) to avoid extra deps initially
function parseNpy(buffer: ArrayBuffer): { shape: number[]; data: Float32Array } {
  const view = new DataView(buffer);
  if (view.getUint8(0) !== 0x93 || String.fromCharCode(view.getUint8(1)) !== 'N') {
    throw new Error('Invalid NPY file');
  }
  const headerLen = view.getUint16(8, true);
  const headerText = new TextDecoder().decode(new Uint8Array(buffer, 10, headerLen));
  // Very small parser to get shape and dtype
  const shapeMatch = headerText.match(/\(\s*(\d+)\s*,\s*(\d+)\s*\)/);
  if (!shapeMatch) throw new Error('Unsupported NPY shape');
  const height = parseInt(shapeMatch[1], 10);
  const width = parseInt(shapeMatch[2], 10);
  const fortran = /fortran_order\s*:\s*True/.test(headerText);
  if (fortran) throw new Error('Fortran-order NPY not supported');
  const dtypeMatch = headerText.match(/descr\s*:\s*'([<>])f(4|8)'/);
  if (!dtypeMatch) throw new Error('Only float32/float64 NPY supported');
  const little = dtypeMatch[1] === '<';
  const itemSize = dtypeMatch[2] === '8' ? 8 : 4;
  const offset = 10 + headerLen;
  const count = width * height;
  const out = new Float32Array(count);
  let pos = offset;
  for (let i = 0; i < count; i++) {
    out[i] = itemSize === 8 ? view.getFloat64(pos, little) : view.getFloat32(pos, little);
    pos += itemSize;
  }
  return { shape: [height, width], data: out };
}

export class NpyReader implements DepthReader {
  canRead(filename: string): boolean {
    const f = filename.toLowerCase();
    return f.endsWith('.npy'); // NPZ to be added later
  }

  async read(arrayBuffer: ArrayBuffer): Promise<DepthReaderResult> {
    const { shape, data } = parseNpy(arrayBuffer);
    const [height, width] = shape;
    const image: DepthImage = { width, height, data };
    const meta: DepthMetadata = { kind: 'depth', unit: 'meter', scale: 1 };
    return { image, meta };
  }
}


