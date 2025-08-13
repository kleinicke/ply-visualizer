import { DepthReader, DepthReaderResult, DepthImage, DepthMetadata } from '../types';

// We load EXR via three.js EXRLoader
// Note: EXRLoader may not be tree-shaken easily; ensure webpack bundles examples if needed.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
// Use any to avoid type friction with three's example typings
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { EXRLoader } = require('three/examples/jsm/loaders/EXRLoader.js');

export class ExrReader implements DepthReader {
  canRead(filename: string): boolean {
    return filename.toLowerCase().endsWith('.exr');
  }

  async read(arrayBuffer: ArrayBuffer): Promise<DepthReaderResult> {
    const loader: any = new EXRLoader();
    // Use parse for ArrayBuffer
    const texture: any = loader.parse(arrayBuffer);
    const width = texture?.image?.width ?? 0;
    const height = texture?.image?.height ?? 0;
    if (!width || !height) throw new Error('Failed to parse EXR');
    const data: any = texture.image.data;

    let depth: Float32Array;
    if (data && data.length === width * height) {
      depth = data instanceof Float32Array ? data : new Float32Array(data as any);
    } else {
      // Assume RGBA, take R channel
      depth = new Float32Array(width * height);
      for (let i = 0, j = 0; i < depth.length; i++, j += 4) depth[i] = data[j];
    }

    const image: DepthImage = { width, height, data: depth };
    const meta: DepthMetadata = { kind: 'z', unit: 'meter', scale: 1 };
    return { image, meta };
  }
}


