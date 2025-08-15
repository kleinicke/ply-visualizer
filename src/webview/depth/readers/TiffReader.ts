import { DepthReader, DepthReaderResult, DepthImage, DepthMetadata } from '../types';

declare const GeoTIFF: any;

export class TiffReader implements DepthReader {
  canRead(filename: string): boolean {
    const f = filename.toLowerCase();
    return f.endsWith('.tif') || f.endsWith('.tiff');
  }

  async read(arrayBuffer: ArrayBuffer): Promise<DepthReaderResult> {
    const tiff = await GeoTIFF.fromArrayBuffer(arrayBuffer);
    const image = await tiff.getImage();
    const width = image.getWidth();
    const height = image.getHeight();
    const rasters = await image.readRasters();

    // Prefer float raster if available
    let depth: Float32Array;
    const band = rasters[0];
    if (band instanceof Float32Array || band instanceof Float64Array) {
      depth = new Float32Array(band);
    } else if (band instanceof Uint16Array) {
      // Assume millimeters by default for integer depth
      depth = new Float32Array(band.length);
      for (let i = 0; i < band.length; i++) depth[i] = band[i];
      // unit/scale handled via metadata below
    } else if (band instanceof Int32Array || band instanceof Uint32Array) {
      depth = new Float32Array(band.length);
      for (let i = 0; i < band.length; i++) depth[i] = band[i];
    } else if (band instanceof Uint8Array) {
      // 8-bit unlikely for depth; still pass through
      depth = new Float32Array(band.length);
      for (let i = 0; i < band.length; i++) depth[i] = band[i];
    } else {
      // Fallback copy
      depth = new Float32Array(band as any);
    }

    const img: DepthImage = { width, height, data: depth };
    const meta: DepthMetadata = {
      kind: 'depth',
      unit: (band instanceof Uint16Array || band instanceof Uint32Array || band instanceof Int32Array) ? 'millimeter' : 'meter',
      scale: 1,
    };

    return { image: img, meta };
  }
}



