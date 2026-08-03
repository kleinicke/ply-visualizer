import { DepthReader, DepthReaderResult, DepthImage, DepthMetadata } from '../types';
import { decodeExrWasm } from './tiffWasm';

/**
 * OpenEXR depth reader backed by the Rust/WASM decoder.
 *
 * EXR is a natural depth container: samples are already 32-bit float and
 * renderers commonly write a dedicated depth channel alongside RGB. When such a
 * channel is present it is used verbatim; otherwise the first channel is taken,
 * which is the right answer for the single-channel depth passes most tools emit.
 */
export class ExrReader implements DepthReader {
  /** Channel names that conventionally carry depth, in order of preference. */
  private static readonly DEPTH_CHANNEL_NAMES = ['z', 'depth', 'distance', 'y'];

  canRead(filename: string): boolean {
    return filename.toLowerCase().endsWith('.exr');
  }

  async read(arrayBuffer: ArrayBuffer): Promise<DepthReaderResult> {
    const exr = await decodeExrWasm(arrayBuffer);
    if (!exr) {
      throw new Error(
        'Failed to read EXR file: the WASM decoder is unavailable. ' +
          'Check that tiff_wasm_bg.wasm is reachable from the webview.'
      );
    }

    const { width, height, channels, data, displayedChannels } = exr;
    const pixelCount = width * height;
    if (pixelCount === 0 || data.length < pixelCount * channels) {
      throw new Error(
        `Failed to read EXR file: truncated decode (${width}x${height}x${channels}, ` +
          `got ${data.length} samples)`
      );
    }

    const channelIndex = this.pickDepthChannel(displayedChannels, channels);

    let depthData: Float32Array;
    if (channels === 1) {
      depthData = data.length === pixelCount ? data : data.subarray(0, pixelCount);
    } else {
      depthData = new Float32Array(pixelCount);
      for (let i = 0; i < pixelCount; i++) {
        depthData[i] = data[i * channels + channelIndex];
      }
    }

    const image: DepthImage = { width, height, data: depthData };
    const meta: DepthMetadata = {
      kind: 'depth',
      unit: 'meter',
      decodeInfo:
        `${width}x${height} ${channels}ch, using channel ` +
        `${displayedChannels[channelIndex] ?? channelIndex}`,
    };
    return { image, meta };
  }

  /** Prefer a conventionally named depth channel; otherwise channel 0. */
  private pickDepthChannel(names: string[], channels: number): number {
    for (const candidate of ExrReader.DEPTH_CHANNEL_NAMES) {
      const index = names.findIndex(name => name.trim().toLowerCase() === candidate);
      if (index >= 0 && index < channels) {
        return index;
      }
    }
    return 0;
  }
}
