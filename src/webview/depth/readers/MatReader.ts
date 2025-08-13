import { DepthReader, DepthReaderResult } from '../types';

export class MatReader implements DepthReader {
  canRead(filename: string): boolean {
    return filename.toLowerCase().endsWith('.mat');
  }

  async read(_arrayBuffer: ArrayBuffer): Promise<DepthReaderResult> {
    throw new Error('MAT v5 reading is not supported yet. Please save a 2D float array as NPY/NPZ.');
  }
}


