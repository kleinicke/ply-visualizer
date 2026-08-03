import { DepthReader, DepthReaderResult, DepthImage, DepthMetadata } from '../types';
import { Rgb24Converter } from './Rgb24Reader';
import { decodeTiffWasm } from './tiffWasm';

export interface TifDepthConfig {
  rgb24ConversionMode?: 'shift' | 'multiply' | 'red' | 'green' | 'blue';
  rgb24ScaleFactor?: number;
  rgb24InvalidValue?: number;
}

/**
 * TIFF depth reader backed solely by the Rust/WASM decoder.
 *
 * There is deliberately no geotiff.js fallback: the WASM decoder covers every
 * layout we care about (LZW/Deflate/Zstd/PackBits/CCITT/JPEG/WebP, striped and
 * tiled, chunky and planar, sub-byte bit depths, predictors 2 and 3) and is an
 * order of magnitude faster on the compressed float depth maps that dominate
 * this extension's workload. A decode failure is a real error, not a cue to
 * retry in slower JS.
 */
export class TifReader implements DepthReader {
  private config: TifDepthConfig = {};

  canRead(filename: string): boolean {
    return filename.toLowerCase().endsWith('.tif') || filename.toLowerCase().endsWith('.tiff');
  }

  setConfig(config: Partial<TifDepthConfig>): void {
    this.config = { ...this.config, ...config };
  }

  async read(arrayBuffer: ArrayBuffer): Promise<DepthReaderResult> {
    const wasm = await decodeTiffWasm(arrayBuffer);
    if (!wasm) {
      throw new Error(
        'Failed to read TIF file: the WASM TIFF decoder is unavailable. ' +
          'Check that tiff_wasm_bg.wasm is reachable from the webview.'
      );
    }

    const { width, height, channels, data } = wasm;
    const pixelCount = width * height;
    if (pixelCount === 0 || data.length < pixelCount * channels) {
      throw new Error(
        `Failed to read TIF file: truncated decode (${width}x${height}x${channels}, ` +
          `got ${data.length} samples)`
      );
    }

    const depthData =
      channels >= 3
        ? this.convertInterleavedRgbToDepth(data, width, height, channels)
        : this.extractFirstChannel(data, pixelCount, channels);

    const image: DepthImage = { width, height, data: depthData };
    const meta: DepthMetadata = {
      kind: 'depth',
      unit: 'meter',
      decodeInfo:
        `${width}x${height} ${channels}ch ${wasm.bitsPerSample}bit ` +
        `sampleFormat=${wasm.sampleFormat} compression=${wasm.compression} ` +
        `predictor=${wasm.predictor}`,
    };
    return { image, meta };
  }

  /** Take channel 0 out of an interleaved buffer (no copy when already planar). */
  private extractFirstChannel(
    data: Float32Array,
    pixelCount: number,
    channels: number
  ): Float32Array {
    if (channels === 1) {
      return data.length === pixelCount ? data : data.subarray(0, pixelCount);
    }
    const out = new Float32Array(pixelCount);
    for (let i = 0; i < pixelCount; i++) {
      out[i] = data[i * channels];
    }
    return out;
  }

  /**
   * 3+ channel TIFFs may be RGB24-packed depth. Rebuild RGBA and hand it to the
   * shared converter, which also decides whether the image is truly RGB or
   * just grayscale replicated across channels.
   */
  private convertInterleavedRgbToDepth(
    data: Float32Array,
    width: number,
    height: number,
    channels: number
  ): Float32Array {
    const pixelCount = width * height;
    const rgba = new Uint8ClampedArray(pixelCount * 4);
    for (let i = 0; i < pixelCount; i++) {
      const src = i * channels;
      const dst = i * 4;
      rgba[dst] = data[src];
      rgba[dst + 1] = data[src + 1];
      rgba[dst + 2] = data[src + 2];
      rgba[dst + 3] = 255;
    }

    const imageData = new ImageData(rgba, width, height);
    if (Rgb24Converter.isRgbImage(imageData)) {
      return Rgb24Converter.convertRgbToDepth(imageData, {
        conversionMode: this.config.rgb24ConversionMode || 'shift',
        scaleFactor: this.config.rgb24ScaleFactor || 1000,
        invalidValue: this.config.rgb24InvalidValue,
      });
    }

    // Grayscale replicated across channels: channel 0 carries the depth.
    return this.extractFirstChannel(data, pixelCount, channels);
  }
}
