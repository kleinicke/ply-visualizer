import { DepthReader, DepthReaderResult, DepthImage, DepthMetadata } from '../types';
import { Rgb24Converter, Rgb24ConversionConfig } from './Rgb24Reader';

// Use the global GeoTIFF that's already loaded
declare const GeoTIFF: any;

export interface TifDepthConfig {
  rgb24ConversionMode?: 'shift' | 'multiply' | 'red' | 'green' | 'blue';
  rgb24ScaleFactor?: number;
  rgb24InvalidValue?: number;
}

export class TifReader implements DepthReader {
  private config: TifDepthConfig = {};

  canRead(filename: string): boolean {
    return filename.toLowerCase().endsWith('.tif') || filename.toLowerCase().endsWith('.tiff');
  }

  setConfig(config: Partial<TifDepthConfig>): void {
    this.config = { ...this.config, ...config };
  }

  async read(arrayBuffer: ArrayBuffer): Promise<DepthReaderResult> {
    try {
      const tiff = await GeoTIFF.fromArrayBuffer(arrayBuffer);
      const image = await tiff.getImage();

      const width = image.getWidth();
      const height = image.getHeight();
      const samplesPerPixel = image.getSamplesPerPixel();
      const sampleFormat = image.getSampleFormat ? image.getSampleFormat() : null;
      const bitsPerSample = image.getBitsPerSample();

      // Validate this is a depth image (allow 1-channel or 3-channel RGB)
      if (!this.isDepthTifImage(samplesPerPixel, sampleFormat, bitsPerSample)) {
        throw new Error(
          `Not a depth TIF image (${samplesPerPixel} channels, format=${sampleFormat})`
        );
      }

      // Read the raster data
      const rasterData = await image.readRasters();
      let depthData: Float32Array;

      // Check if this is an RGB image (3 channels)
      if (samplesPerPixel === 3 && Array.isArray(rasterData) && rasterData.length === 3) {
        // Combine 3 bands into ImageData for RGB24Converter
        const pixelCount = width * height;
        const imageDataArray = new Uint8ClampedArray(pixelCount * 4);

        // Extract R, G, B bands and combine into RGBA format
        const rBand = rasterData[0];
        const gBand = rasterData[1];
        const bBand = rasterData[2];

        for (let i = 0; i < pixelCount; i++) {
          const imageDataIndex = i * 4;
          imageDataArray[imageDataIndex] = Number(rBand[i]) & 0xff; // R
          imageDataArray[imageDataIndex + 1] = Number(gBand[i]) & 0xff; // G
          imageDataArray[imageDataIndex + 2] = Number(bBand[i]) & 0xff; // B
          imageDataArray[imageDataIndex + 3] = 255; // A (fully opaque)
        }

        const imageData = new ImageData(imageDataArray, width, height);

        // Check if this is actually RGB data (not just grayscale stored in 3 channels)
        if (Rgb24Converter.isRgbImage(imageData)) {
          console.log('[TifReader] Detected RGB image, applying RGB24 conversion');
          depthData = Rgb24Converter.convertRgbToDepth(imageData, {
            conversionMode: this.config.rgb24ConversionMode || 'shift',
            scaleFactor: this.config.rgb24ScaleFactor || 1000,
            invalidValue: this.config.rgb24InvalidValue,
          });
        } else {
          // Grayscale stored in 3 channels, use first band
          console.log('[TifReader] 3-channel image detected but not RGB, using first band');
          depthData = this.convertBandToFloat32Array(rBand);
        }
      } else {
        // Single-channel depth image
        if (rasterData instanceof Float32Array) {
          depthData = rasterData;
        } else if (rasterData instanceof Float64Array) {
          depthData = new Float32Array(rasterData);
        } else if (Array.isArray(rasterData) && rasterData.length > 0) {
          // Multi-band image, take the first band
          depthData = this.convertBandToFloat32Array(rasterData[0]);
        } else {
          throw new Error('Unsupported TIF raster data format');
        }
      }

      const depthImage: DepthImage = {
        width,
        height,
        data: depthData,
      };

      const metadata: DepthMetadata = {
        kind: 'depth', // Default to depth
        unit: 'meter', // Assume meters unless specified
      };

      return { image: depthImage, meta: metadata };
    } catch (error) {
      throw new Error(
        `Failed to read TIF file: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private convertBandToFloat32Array(band: any): Float32Array {
    if (band instanceof Float32Array) {
      return band;
    } else if (band instanceof Float64Array) {
      return new Float32Array(band);
    } else {
      // Convert other types to Float32Array
      const result = new Float32Array(band.length);
      for (let i = 0; i < band.length; i++) {
        result[i] = Number(band[i]);
      }
      return result;
    }
  }

  private isDepthTifImage(
    samplesPerPixel: number,
    sampleFormat: number | null,
    bitsPerSample: number[]
  ): boolean {
    // Single channel or 3-channel RGB
    if (samplesPerPixel !== 1 && samplesPerPixel !== 3) {
      return false;
    }

    // For 3-channel, accept as potential RGB depth image
    if (samplesPerPixel === 3) {
      return true;
    }

    // Floating point format preferred for depth
    if (sampleFormat === 3) {
      // IEEE floating point
      return true;
    }

    // Integer formats can also be depth/disparity
    if (sampleFormat === 1 || sampleFormat === 2) {
      // Unsigned/signed integer
      // Check bit depth - higher bit depths more likely to be depth
      const bitDepth = bitsPerSample && bitsPerSample.length > 0 ? bitsPerSample[0] : 0;
      return bitDepth >= 16; // 16-bit or higher integer
    }

    return false;
  }
}
