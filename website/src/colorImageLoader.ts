/**
 * ColorImageLoader - Handles loading and processing color images for depth-derived point clouds
 *
 * Supports multiple formats:
 * - TIFF (8/16/32-bit, uint/float, RGB/grayscale)
 * - PNG, JPEG (regular image formats)
 * - PPM (ASCII P3 format)
 *
 * Auto-detects bit depth from actual data (getBitsPerSample() is unreliable)
 */

// GeoTIFF is loaded globally in the webview
declare const GeoTIFF: any;

export interface ColorImageDimensions {
  width: number;
  height: number;
}

export type StatusCallback = (message: string, type: 'success' | 'error' | 'warning') => void;

export class ColorImageLoader {
  private statusCallback?: StatusCallback;

  /**
   * Set callback for status messages (optional)
   */
  setStatusCallback(callback: StatusCallback): void {
    this.statusCallback = callback;
  }

  /**
   * Load and validate color image dimensions
   * Returns ImageData if successful, null otherwise
   */
  async loadAndValidate(
    file: File,
    expectedDimensions: ColorImageDimensions
  ): Promise<ImageData | null> {
    return new Promise(resolve => {
      if (!expectedDimensions) {
        this.showStatus('No depth image dimensions available for validation', 'error');
        resolve(null);
        return;
      }

      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      img.onload = () => {
        // Validate dimensions
        if (img.width !== expectedDimensions.width || img.height !== expectedDimensions.height) {
          this.showStatus(
            `Image dimensions (${img.width}×${img.height}) don't match depth image (${expectedDimensions.width}×${expectedDimensions.height})`,
            'error'
          );
          resolve(null);
          return;
        }

        // Extract image data
        canvas.width = img.width;
        canvas.height = img.height;
        ctx!.drawImage(img, 0, 0);
        const imageData = ctx!.getImageData(0, 0, img.width, img.height);

        resolve(imageData);
      };

      img.onerror = () => {
        this.showStatus('Failed to load color image', 'error');
        resolve(null);
      };

      // Handle different file types
      console.log(
        `Loading color image: ${file.name}, type: ${file.type}, size: ${file.size} bytes`
      );

      if (file.name.toLowerCase().endsWith('.ppm')) {
        // Handle PPM files
        console.log('Loading as PPM file');
        this.loadPpmImage(file, expectedDimensions, resolve);
      } else if (
        file.type.startsWith('image/') &&
        !file.type.includes('tiff') &&
        !file.type.includes('tif')
      ) {
        // Regular image files (PNG, JPEG, etc.) - not TIF
        console.log('Loading as regular image file');
        img.src = URL.createObjectURL(file);
      } else {
        // Handle TIF files using GeoTIFF
        console.log('Loading as TIF file using GeoTIFF');
        this.loadTiffImage(file, expectedDimensions, resolve);
      }
    });
  }

  /**
   * Load TIFF image using GeoTIFF library
   */
  private async loadTiffImage(
    file: File,
    dimensions: ColorImageDimensions,
    resolve: (value: ImageData | null) => void
  ): Promise<void> {
    const reader = new FileReader();
    reader.onload = async e => {
      try {
        const buffer = e.target!.result as ArrayBuffer;
        const tiff = await GeoTIFF.fromArrayBuffer(buffer);
        const image = await tiff.getImage();
        const rasters = await image.readRasters();

        // Validate dimensions
        const width = image.getWidth();
        const height = image.getHeight();

        if (width !== dimensions.width || height !== dimensions.height) {
          this.showStatus(
            `TIF dimensions (${width}×${height}) don't match depth image (${dimensions.width}×${dimensions.height})`,
            'error'
          );
          resolve(null);
          return;
        }

        // Convert TIF data to ImageData
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = width;
        canvas.height = height;

        const imageData = ctx!.createImageData(width, height);
        const data = imageData.data;

        // Detect bit depth and sample format for proper normalization
        const bitsPerSample = image.getBitsPerSample();
        const reportedBitDepth = bitsPerSample && bitsPerSample.length > 0 ? bitsPerSample[0] : 8;
        const sampleFormat = image.getSampleFormat();

        // Sample format: 1 = uint, 2 = int, 3 = float
        const isFloat = sampleFormat && sampleFormat.length > 0 && sampleFormat[0] === 3;

        console.log(
          `TIF color image reported bit depth: ${reportedBitDepth}, sample format: ${sampleFormat?.[0] || 'unknown'}, isFloat: ${isFloat}`
        );

        if (rasters.length >= 3) {
          // RGB TIF
          this.processRgbTiff(rasters, data, width, height, isFloat, reportedBitDepth);
        } else {
          // Grayscale TIF
          this.processGrayscaleTiff(rasters, data, width, height, isFloat, reportedBitDepth);
        }

        resolve(imageData);
      } catch (error) {
        console.error('Error processing TIF color image:', error);
        this.showStatus(
          `Failed to process TIF color image: ${error instanceof Error ? error.message : String(error)}`,
          'error'
        );
        resolve(null);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  /**
   * Process RGB TIFF data
   */
  private processRgbTiff(
    rasters: any[],
    data: Uint8ClampedArray,
    width: number,
    height: number,
    isFloat: boolean,
    reportedBitDepth: number
  ): void {
    const r = rasters[0];
    const g = rasters[1];
    const b = rasters[2];

    if (isFloat) {
      // Float data (float16/float32) - assume normalized [0, 1] range
      console.log('🎨 Processing float color image (assuming [0, 1] range)');
      for (let i = 0; i < width * height; i++) {
        data[i * 4] = Math.min(255, Math.max(0, Math.round(r[i] * 255)));
        data[i * 4 + 1] = Math.min(255, Math.max(0, Math.round(g[i] * 255)));
        data[i * 4 + 2] = Math.min(255, Math.max(0, Math.round(b[i] * 255)));
        data[i * 4 + 3] = 255; // Alpha
      }
    } else {
      // Integer data (uint8/uint16) - find actual min/max to detect value range
      let minR = Infinity,
        maxR = -Infinity;
      let minG = Infinity,
        maxG = -Infinity;
      let minB = Infinity,
        maxB = -Infinity;

      // Sample first to check actual range
      for (let i = 0; i < r.length; i++) {
        minR = Math.min(minR, r[i]);
        maxR = Math.max(maxR, r[i]);
        minG = Math.min(minG, g[i]);
        maxG = Math.max(maxG, g[i]);
        minB = Math.min(minB, b[i]);
        maxB = Math.max(maxB, b[i]);
      }

      const actualMaxValue = Math.max(maxR, maxG, maxB);

      // Auto-detect actual bit depth from data range (getBitsPerSample is unreliable)
      let detectedBitDepth: number;
      let maxPossibleValue: number;
      if (actualMaxValue <= 255) {
        detectedBitDepth = 8;
        maxPossibleValue = 255;
      } else if (actualMaxValue <= 65535) {
        detectedBitDepth = 16;
        maxPossibleValue = 65535;
      } else {
        detectedBitDepth = 32;
        maxPossibleValue = 4294967295;
      }

      console.log(`🎨 Processing uint color image (RGB):`);
      console.log(`   Reported bit depth: ${reportedBitDepth}`);
      console.log(`   Detected bit depth from data: ${detectedBitDepth}`);
      console.log(
        `   Actual value range - R: [${minR}, ${maxR}], G: [${minG}, ${maxG}], B: [${minB}, ${maxB}]`
      );
      console.log(`   Actual max: ${actualMaxValue}`);
      console.log(`   Using max possible value for normalization: ${maxPossibleValue}`);

      for (let i = 0; i < width * height; i++) {
        // Normalize from max possible value to 0-255
        data[i * 4] = Math.min(255, Math.max(0, Math.round((r[i] / maxPossibleValue) * 255)));
        data[i * 4 + 1] = Math.min(255, Math.max(0, Math.round((g[i] / maxPossibleValue) * 255)));
        data[i * 4 + 2] = Math.min(255, Math.max(0, Math.round((b[i] / maxPossibleValue) * 255)));
        data[i * 4 + 3] = 255; // Alpha
      }
    }
  }

  /**
   * Process grayscale TIFF data
   */
  private processGrayscaleTiff(
    rasters: any[],
    data: Uint8ClampedArray,
    width: number,
    height: number,
    isFloat: boolean,
    reportedBitDepth: number
  ): void {
    const gray = rasters[0];

    if (isFloat) {
      // Float data (float16/float32) - assume normalized [0, 1] range
      console.log('🎨 Processing float grayscale color image (assuming [0, 1] range)');
      for (let i = 0; i < width * height; i++) {
        const grayValue = Math.min(255, Math.max(0, Math.round(gray[i] * 255)));
        data[i * 4] = grayValue;
        data[i * 4 + 1] = grayValue;
        data[i * 4 + 2] = grayValue;
        data[i * 4 + 3] = 255; // Alpha
      }
    } else {
      // Integer data (uint8/uint16) - find actual min/max to detect value range
      let minGray = Infinity,
        maxGray = -Infinity;
      for (let i = 0; i < gray.length; i++) {
        minGray = Math.min(minGray, gray[i]);
        maxGray = Math.max(maxGray, gray[i]);
      }

      // Auto-detect actual bit depth from data range (getBitsPerSample is unreliable)
      let detectedBitDepth: number;
      let maxPossibleValue: number;
      if (maxGray <= 255) {
        detectedBitDepth = 8;
        maxPossibleValue = 255;
      } else if (maxGray <= 65535) {
        detectedBitDepth = 16;
        maxPossibleValue = 65535;
      } else {
        detectedBitDepth = 32;
        maxPossibleValue = 4294967295;
      }

      console.log(`🎨 Processing uint grayscale color image:`);
      console.log(`   Reported bit depth: ${reportedBitDepth}`);
      console.log(`   Detected bit depth from data: ${detectedBitDepth}`);
      console.log(`   Actual value range: [${minGray}, ${maxGray}]`);
      console.log(`   Using max possible value for normalization: ${maxPossibleValue}`);

      for (let i = 0; i < width * height; i++) {
        const grayValue = Math.min(
          255,
          Math.max(0, Math.round((gray[i] / maxPossibleValue) * 255))
        );
        data[i * 4] = grayValue;
        data[i * 4 + 1] = grayValue;
        data[i * 4 + 2] = grayValue;
        data[i * 4 + 3] = 255; // Alpha
      }
    }
  }

  /**
   * Load PPM image file and convert to ImageData
   */
  private loadPpmImage(
    file: File,
    dimensions: ColorImageDimensions,
    resolve: (value: ImageData | null) => void
  ): void {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const text = e.target!.result as string;
        const imageData = this.parsePpmImage(text, dimensions);
        resolve(imageData);
      } catch (error) {
        console.error('Error parsing PPM file:', error);
        this.showStatus(
          'Failed to parse PPM file: ' + (error instanceof Error ? error.message : String(error)),
          'error'
        );
        resolve(null);
      }
    };

    reader.onerror = () => {
      this.showStatus('Failed to read PPM file', 'error');
      resolve(null);
    };

    reader.readAsText(file);
  }

  /**
   * Parse PPM image format (P3 - ASCII RGB)
   */
  private parsePpmImage(text: string, expectedDimensions: ColorImageDimensions): ImageData {
    const lines = text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'));

    if (lines.length < 4) {
      throw new Error('Invalid PPM format: insufficient data');
    }

    // Check magic number
    if (lines[0] !== 'P3') {
      throw new Error('Unsupported PPM format: only P3 (ASCII RGB) is supported');
    }

    // Parse dimensions
    const dimensions = lines[1].split(/\s+/).map(Number);
    if (dimensions.length !== 2) {
      throw new Error('Invalid PPM format: invalid dimensions line');
    }

    const [width, height] = dimensions;

    // Validate dimensions match depth image
    if (width !== expectedDimensions.width || height !== expectedDimensions.height) {
      throw new Error(
        `PPM dimensions (${width}×${height}) don't match depth image (${expectedDimensions.width}×${expectedDimensions.height})`
      );
    }

    // Parse max value
    const maxVal = parseInt(lines[2]);
    if (isNaN(maxVal) || maxVal <= 0) {
      throw new Error('Invalid PPM format: invalid maximum value');
    }

    // Parse RGB data
    const rgbValues = [];
    for (let i = 3; i < lines.length; i++) {
      const values = lines[i].split(/\s+/).map(Number);
      rgbValues.push(...values);
    }

    // Validate RGB data length
    const expectedPixels = width * height * 3;
    if (rgbValues.length !== expectedPixels) {
      throw new Error(
        `Invalid PPM format: expected ${expectedPixels} RGB values, got ${rgbValues.length}`
      );
    }

    // Create ImageData
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const imageData = ctx.createImageData(width, height);

    // Convert PPM data to ImageData format
    for (let i = 0; i < rgbValues.length; i += 3) {
      const pixelIndex = (i / 3) * 4;
      const r = Math.round((rgbValues[i] / maxVal) * 255);
      const g = Math.round((rgbValues[i + 1] / maxVal) * 255);
      const b = Math.round((rgbValues[i + 2] / maxVal) * 255);

      imageData.data[pixelIndex] = r;
      imageData.data[pixelIndex + 1] = g;
      imageData.data[pixelIndex + 2] = b;
      imageData.data[pixelIndex + 3] = 255; // Alpha
    }

    console.log(`✅ Successfully parsed PPM image: ${width}×${height}, maxVal: ${maxVal}`);
    return imageData;
  }

  /**
   * Show status message via callback
   */
  private showStatus(message: string, type: 'success' | 'error' | 'warning'): void {
    if (this.statusCallback) {
      this.statusCallback(message, type);
    }
  }
}
