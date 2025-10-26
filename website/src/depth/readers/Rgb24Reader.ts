/**
 * RGB24 to Depth Converter Utility
 *
 * Converts RGB images to single-channel depth data using various encoding schemes.
 * This is NOT a file reader - it operates on already-decoded ImageData.
 * TifReader and PngReader use this to convert RGB images after decoding.
 */

/**
 * Configuration for 24-bit RGB to depth conversion
 */
export interface Rgb24ConversionConfig {
  /**
   * How to extract/combine depth from RGB channels:
   * - 'shift': Pack as (R<<16 | G<<8 | B) / scaleFactor - standard 24-bit packing
   * - 'multiply': Use formula (R*255*255 + G*255 + B) / scaleFactor (paper misimplementation)
   * - 'red': Use only red channel (no scaling)
   * - 'green': Use only green channel (no scaling)
   * - 'blue': Use only blue channel (no scaling)
   */
  conversionMode: 'shift' | 'multiply' | 'red' | 'green' | 'blue';
  scaleFactor: number; // Divider for shift/multiply modes (e.g., 1000 to convert mm to m)
  invalidValue?: number; // RGB value representing invalid/missing pixels (e.g., 0 for black)
}

/**
 * Utility class for converting RGB images to depth data
 * Used by TifReader and PngReader after they decode images
 */
export class Rgb24Converter {
  /**
   * Check if ImageData is actually RGB (has color variation)
   * A purely grayscale image has R=G=B for all pixels
   */
  static isRgbImage(imageData: ImageData): boolean {
    const { data, width, height } = imageData;
    const sampleSize = Math.min(100, width * height); // Sample first 100 pixels
    let rgbPixelCount = 0;
    const samplePixels: Array<{ r: number; g: number; b: number; isGrayscale: boolean }> = [];

    for (let i = 0; i < sampleSize; i++) {
      const pixelIndex = i * 4;
      const r = data[pixelIndex];
      const g = data[pixelIndex + 1];
      const b = data[pixelIndex + 2];
      const isGrayscale = r === g && g === b;

      if (!isGrayscale) {
        rgbPixelCount++;
      }

      // Log first few pixels for debugging
      if (i < 5) {
        samplePixels.push({ r, g, b, isGrayscale });
      }
    }

    const isRgb = rgbPixelCount > sampleSize * 0.1;
    console.log(
      `[Rgb24Converter.isRgbImage] Sampled ${sampleSize} pixels, ${rgbPixelCount} are RGB (>10% = ${isRgb}). Sample: ${JSON.stringify(samplePixels)}`
    );

    return isRgb;
  }

  /**
   * Convert RGB ImageData to depth Float32Array
   * @param imageData Canvas ImageData (RGBA format)
   * @param config Conversion configuration (mode, scale factor, invalid value)
   * @returns Float32Array of depth values
   */
  static convertRgbToDepth(imageData: ImageData, config: Rgb24ConversionConfig): Float32Array {
    const { data, width, height } = imageData;
    const depthData = new Float32Array(width * height);

    console.log(
      `[Rgb24Converter.convertRgbToDepth] Converting ${width}×${height} RGB image. Mode: ${config.conversionMode}, Scale: ${config.scaleFactor}`
    );

    for (let i = 0; i < width * height; i++) {
      const pixelIndex = i * 4;
      const r = data[pixelIndex];
      const g = data[pixelIndex + 1];
      const b = data[pixelIndex + 2];

      let rawValue: number;

      // Extract depth based on conversion mode
      switch (config.conversionMode) {
        case 'shift':
          // Standard 24-bit packing: (R<<16 | G<<8 | B)
          rawValue = (r << 16) | (g << 8) | b;
          break;

        case 'multiply':
          // Paper misimplementation: R*255*255 + G*255 + B
          // This is mathematically equivalent to treating RGB as base-255 number
          rawValue = r * 255 * 255 + g * 255 + b;
          break;

        case 'red':
          // Use red channel directly (no scaling)
          rawValue = r;
          break;

        case 'green':
          // Use green channel directly (no scaling)
          rawValue = g;
          break;

        case 'blue':
          // Use blue channel directly (no scaling)
          rawValue = b;
          break;

        default:
          // Default to shift mode
          rawValue = (r << 16) | (g << 8) | b;
      }

      // Handle invalid pixels
      if (config.invalidValue !== undefined && rawValue === config.invalidValue) {
        depthData[i] = 0;
        continue;
      }

      // Apply scale factor to convert to meters (for shift/multiply modes)
      depthData[i] = rawValue / config.scaleFactor;
    }

    console.log(
      `[Rgb24Converter.convertRgbToDepth] Conversion complete: ${depthData.length} depth values`
    );

    return depthData;
  }
}
