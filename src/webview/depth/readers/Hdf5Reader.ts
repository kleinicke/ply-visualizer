import { DepthReader, DepthReaderResult, DepthImage, DepthMetadata } from '../types';

export class Hdf5Reader implements DepthReader {
  canRead(filename: string): boolean {
    return filename.toLowerCase().endsWith('.h5') || filename.toLowerCase().endsWith('.hdf5');
  }

  async read(_arrayBuffer: ArrayBuffer): Promise<DepthReaderResult> {
    throw new Error('HDF5 is not supported yet. Please save a 2D float array as NPY/NPZ or MAT v5.');
  }
}


