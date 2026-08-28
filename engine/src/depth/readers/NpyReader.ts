import { DepthReader, DepthReaderResult, DepthImage, DepthMetadata, DepthKind } from '../types';
import { inspectNpyWasm, readNpyWasm, type NpyArrayInfo } from '../../parsers/pointcloudWasm';

/**
 * NumPy depth images: a `.npy` array, or one array out of a `.npz` archive.
 *
 * Reading is Rust (`wasm/pointcloud-parser/src/npy.rs`), shared with the
 * point-cloud parser - the two used to carry separate copies of the same header
 * parser, and this one could only read *stored* zip entries, so anything
 * written by `numpy.savez_compressed` came back empty.
 *
 * What stays here is interpretation: which array of an archive to show, and
 * whether its name suggests depth, disparity or inverse depth. That is
 * presentation policy, and it changes with every dataset that turns up.
 */

/** Archive keys that usually hold the depth map, in the order they are tried. */
const PREFERRED_ARRAYS = ['depth', 'disparity', 'distance', 'z', 'range'];

export class NpyReader implements DepthReader {
  canRead(filename: string): boolean {
    return filename.toLowerCase().endsWith('.npy') || filename.toLowerCase().endsWith('.npz');
  }

  async read(arrayBuffer: ArrayBuffer): Promise<DepthReaderResult> {
    const bytes = new Uint8Array(arrayBuffer);
    const arrays = await inspectNpyWasm(bytes);
    const isArchive = arrays.length > 1 || (arrays.length === 1 && arrays[0].name !== '');

    return isArchive ? this.readArchive(bytes, arrays) : this.readSingleArray(bytes, arrays[0]);
  }

  /** A plain `.npy`: (height, width) or (height, width, channels ≤ 4). */
  private async readSingleArray(
    bytes: Uint8Array,
    info: NpyArrayInfo | undefined
  ): Promise<DepthReaderResult> {
    if (!info) {
      throw new Error('Not a readable NPY file.');
    }
    const { shape } = info;
    if (shape.length < 2 || shape.length > 3) {
      throw new Error(
        `Expected 2D or 3D array, got ${shape.length}D array with shape [${shape.join(', ')}].\n\nExpected formats:\n- 2D: (height, width) for single-channel depth\n- 3D: (height, width, channels) for multi-channel data`
      );
    }
    const channels = shape.length === 3 ? shape[2] : 1;
    if (channels > 4) {
      throw new Error(
        `Too many channels: ${channels}. Expected format: 3D array with shape (height, width, channels) where channels ≤ 4.`
      );
    }

    const [height, width] = shape;
    const array = await readNpyWasm(bytes);
    const selectedChannel = 0;
    const data = extractChannel(array.values, width * height, channels, selectedChannel);

    const image: DepthImage = { width, height, data };
    const meta: DepthMetadata = {
      kind: 'depth',
      unit: 'meter',
      scale: 1.0,
      // Multi-channel data cannot be shown without saying which channel.
      requiresConfiguration: channels > 1,
      selectedChannel,
    };
    return { image, meta };
  }

  /** An `.npz`: several named arrays, one of which is the depth map. */
  private async readArchive(bytes: Uint8Array, arrays: NpyArrayInfo[]): Promise<DepthReaderResult> {
    if (arrays.length === 0) {
      throw new Error(
        'NPZ file contains no readable arrays. Expected format: NPZ archive containing at least one 2D NumPy array with depth data (float32/float64 preferred).'
      );
    }

    const availableArrays: { [key: string]: { shape: number[]; dtype: string } } = {};
    for (const array of arrays) {
      availableArrays[array.name] = { shape: array.shape, dtype: array.dtype };
    }

    const selected =
      PREFERRED_ARRAYS.map(name => arrays.find(array => array.name === name)).find(Boolean) ??
      arrays.find(array => array.shape.length === 2);

    if (!selected) {
      const listing = arrays
        .map(array => `  - "${array.name}": ${array.shape.join('x')} (${array.dtype})`)
        .join('\n');
      throw new Error(
        `NPZ file contains no suitable 2D arrays for depth data.\n\nAvailable arrays:\n${listing}\n\nExpected format: 2D NumPy array with shape (height, width) containing depth/disparity values.`
      );
    }
    if (selected.shape.length !== 2) {
      throw new Error(
        `Selected array "${selected.name}" has ${selected.shape.length}D shape [${selected.shape.join(', ')}]. Expected format: 2D array with shape (height, width) for depth data.`
      );
    }

    const [height, width] = selected.shape;
    const array = await readNpyWasm(bytes, selected.name);
    const image: DepthImage = { width, height, data: array.values };

    // The name is the only clue an archive gives about what its numbers mean.
    let kind: DepthKind = 'depth';
    if (selected.name.toLowerCase().includes('disparity')) {
      kind = 'disparity';
    } else if (selected.name.toLowerCase().includes('inv')) {
      kind = 'inverse_depth';
    }

    const meta: DepthMetadata = {
      kind,
      unit: 'meter',
      scale: 1.0,
      availableArrays,
      // With more than one array the choice is the user's to confirm.
      requiresConfiguration: arrays.length > 1,
      selectedArray: selected.name,
      selectedChannel: 0,
    };
    return { image, meta };
  }
}

/** Interleaved channels to one plane; a single-channel array passes through. */
function extractChannel(
  values: Float32Array,
  pixels: number,
  channels: number,
  channel: number
): Float32Array {
  if (channels === 1) {
    return values;
  }
  const plane = new Float32Array(pixels);
  for (let i = 0; i < pixels; i++) {
    plane[i] = values[i * channels + channel];
  }
  return plane;
}
