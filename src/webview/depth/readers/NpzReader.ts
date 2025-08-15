import { DepthReader, DepthReaderResult, DepthImage, DepthMetadata } from '../types';
import { unzipSync, Unzipped } from 'fflate';

function parseNpy(buffer: ArrayBuffer): { shape: number[]; data: Float32Array } {
  const view = new DataView(buffer);
  if (view.getUint8(0) !== 0x93 || String.fromCharCode(view.getUint8(1)) !== 'N') {
    throw new Error('Invalid NPY file inside NPZ: header signature not found');
  }
  const headerLen = view.getUint16(8, true);
  const headerText = new TextDecoder().decode(new Uint8Array(buffer, 10, headerLen));
  const shapeMatch = headerText.match(/\(\s*(\d+)\s*,\s*(\d+)\s*\)/);
  if (!shapeMatch) throw new Error('Unsupported NPY shape inside NPZ. Expected 2D (H,W) array.');
  const height = parseInt(shapeMatch[1], 10);
  const width = parseInt(shapeMatch[2], 10);
  const fortran = /fortran_order\s*:\s*True/.test(headerText);
  if (fortran) throw new Error('Fortran-order NPY arrays are not supported. Please save as C-order.');
  const dtypeMatch = headerText.match(/descr\s*:\s*'([<>])f(4|8)'/);
  if (!dtypeMatch) throw new Error('Only float32/float64 arrays are supported in NPZ depth files.');
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

export class NpzReader implements DepthReader {
  canRead(filename: string): boolean {
    return filename.toLowerCase().endsWith('.npz');
  }

  async read(arrayBuffer: ArrayBuffer): Promise<DepthReaderResult> {
    const zipped: Unzipped = unzipSync(new Uint8Array(arrayBuffer));
    const entries = Object.keys(zipped).filter(k => k.toLowerCase().endsWith('.npy'));
    if (entries.length === 0) {
      throw new Error('NPZ does not contain any .npy arrays. Expected at least one 2D float array named "depth" or the first array to be used.');
    }
    // Prefer a key named 'depth.npy'
    let key = entries.find(k => /(^|\/)depth\.npy$/i.test(k)) ?? entries[0];
    const npyBytes = zipped[key];
    const { shape, data } = parseNpy(npyBytes.buffer);
    const [height, width] = shape;
    const image: DepthImage = { width, height, data };
    const meta: DepthMetadata = { kind: 'depth', unit: 'meter', scale: 1 };
    return { image, meta };
  }
}



