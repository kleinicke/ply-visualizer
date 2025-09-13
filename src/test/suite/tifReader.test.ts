import * as assert from 'assert';
import { TifReader } from '../../webview/depth/readers/TifReader';

// Mock GeoTIFF library
const mockGeoTIFF = {
  fromArrayBuffer: async (arrayBuffer: ArrayBuffer) => {
    const mockTiff = new MockTiff(arrayBuffer);
    return mockTiff;
  },
};

class MockTiffImage {
  private width: number;
  private height: number;
  private samplesPerPixel: number;
  private sampleFormat: number | null;
  private bitsPerSample: number[];
  private data: Float32Array | Float64Array | Array<any>;

  constructor(
    width: number,
    height: number,
    samplesPerPixel: number = 1,
    sampleFormat: number | null = 3,
    bitsPerSample: number[] = [32],
    data?: Float32Array | Float64Array | Array<any>
  ) {
    this.width = width;
    this.height = height;
    this.samplesPerPixel = samplesPerPixel;
    this.sampleFormat = sampleFormat;
    this.bitsPerSample = bitsPerSample;

    // Generate default data if not provided
    if (!data) {
      const size = width * height;
      this.data = new Float32Array(size);
      for (let i = 0; i < size; i++) {
        this.data[i] = i * 0.1; // Simple pattern
      }
    } else {
      this.data = data;
    }
  }

  getWidth(): number {
    return this.width;
  }
  getHeight(): number {
    return this.height;
  }
  getSamplesPerPixel(): number {
    return this.samplesPerPixel;
  }
  getSampleFormat(): number | null {
    return this.sampleFormat;
  }
  getBitsPerSample(): number[] {
    return this.bitsPerSample;
  }

  async readRasters(): Promise<Float32Array | Float64Array | Array<any>> {
    return this.data;
  }
}

class MockTiff {
  private arrayBuffer: ArrayBuffer;
  private mockImage: MockTiffImage;

  constructor(arrayBuffer: ArrayBuffer) {
    this.arrayBuffer = arrayBuffer;
    // Default to valid depth image
    this.mockImage = new MockTiffImage(10, 10);
  }

  setMockImage(image: MockTiffImage): void {
    this.mockImage = image;
  }

  async getImage(): Promise<MockTiffImage> {
    return this.mockImage;
  }
}

// Mock the global GeoTIFF
(global as any).GeoTIFF = mockGeoTIFF;

suite('TifReader', () => {
  let reader: TifReader;

  setup(() => {
    reader = new TifReader();
  });

  suite('canRead', () => {
    test('should return true for .tif files', () => {
      assert.strictEqual(reader.canRead('test.tif'), true);
      assert.strictEqual(reader.canRead('depth.tif'), true);
      assert.strictEqual(reader.canRead('path/to/file.tif'), true);
    });

    test('should return true for .tiff files', () => {
      assert.strictEqual(reader.canRead('test.tiff'), true);
      assert.strictEqual(reader.canRead('depth.tiff'), true);
      assert.strictEqual(reader.canRead('path/to/file.tiff'), true);
    });

    test('should return true for files case-insensitively', () => {
      assert.strictEqual(reader.canRead('test.TIF'), true);
      assert.strictEqual(reader.canRead('test.TIFF'), true);
      assert.strictEqual(reader.canRead('test.Tif'), true);
      assert.strictEqual(reader.canRead('test.Tiff'), true);
      assert.strictEqual(reader.canRead('test.TiF'), true);
      assert.strictEqual(reader.canRead('test.TiFf'), true);
    });

    test('should return false for non-tif files', () => {
      assert.strictEqual(reader.canRead('test.png'), false);
      assert.strictEqual(reader.canRead('test.jpg'), false);
      assert.strictEqual(reader.canRead('test.pfm'), false);
      assert.strictEqual(reader.canRead('test.tif.txt'), false);
      assert.strictEqual(reader.canRead('testtif'), false);
    });

    test('should handle empty filename', () => {
      assert.strictEqual(reader.canRead(''), false);
    });

    test('should handle filename without extension', () => {
      assert.strictEqual(reader.canRead('filename'), false);
    });
  });

  suite('read', () => {
    test('should read valid depth TIF (Float32)', async () => {
      const width = 4;
      const height = 3;
      const data = new Float32Array([1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 6.0, 6.5, 7.0]);

      const mockImage = new MockTiffImage(width, height, 1, 3, [32], data);

      // Override the mock to return our custom image
      const originalFromArrayBuffer = mockGeoTIFF.fromArrayBuffer;
      mockGeoTIFF.fromArrayBuffer = async (arrayBuffer: ArrayBuffer) => {
        const mockTiff = new MockTiff(arrayBuffer);
        mockTiff.setMockImage(mockImage);
        return mockTiff;
      };

      const buffer = new ArrayBuffer(100);
      const result = await reader.read(buffer);

      assert.strictEqual(result.image.width, width);
      assert.strictEqual(result.image.height, height);
      assert.strictEqual(result.image.data.length, width * height);
      assert.strictEqual(result.meta.kind, 'depth');
      assert.strictEqual(result.meta.unit, 'meter');

      // Verify data values
      for (let i = 0; i < data.length; i++) {
        assert.strictEqual(result.image.data[i], data[i]);
      }

      // Restore original mock
      mockGeoTIFF.fromArrayBuffer = originalFromArrayBuffer;
    });

    test('should read valid depth TIF (Float64)', async () => {
      const width = 2;
      const height = 2;
      const data = new Float64Array([1.1, 2.2, 3.3, 4.4]);

      const mockImage = new MockTiffImage(width, height, 1, 3, [64], data);

      const originalFromArrayBuffer = mockGeoTIFF.fromArrayBuffer;
      mockGeoTIFF.fromArrayBuffer = async (arrayBuffer: ArrayBuffer) => {
        const mockTiff = new MockTiff(arrayBuffer);
        mockTiff.setMockImage(mockImage);
        return mockTiff;
      };

      const buffer = new ArrayBuffer(100);
      const result = await reader.read(buffer);

      assert.strictEqual(result.image.width, width);
      assert.strictEqual(result.image.height, height);
      assert.strictEqual(result.image.data.length, width * height);
      assert.ok(result.image.data instanceof Float32Array);

      // Verify data was converted from Float64 to Float32
      for (let i = 0; i < data.length; i++) {
        assert.ok(Math.abs(result.image.data[i] - data[i]) < 0.0001);
      }

      mockGeoTIFF.fromArrayBuffer = originalFromArrayBuffer;
    });

    test('should read multi-band TIF (first band)', async () => {
      const width = 2;
      const height = 2;
      const band1 = new Float32Array([1.0, 2.0, 3.0, 4.0]);
      const band2 = new Float32Array([5.0, 6.0, 7.0, 8.0]);
      const data = [band1, band2];

      // Use single channel for depth validation but with array data
      const mockImage = new MockTiffImage(width, height, 1, 3, [32], data);

      const originalFromArrayBuffer = mockGeoTIFF.fromArrayBuffer;
      mockGeoTIFF.fromArrayBuffer = async (arrayBuffer: ArrayBuffer) => {
        const mockTiff = new MockTiff(arrayBuffer);
        mockTiff.setMockImage(mockImage);
        return mockTiff;
      };

      const buffer = new ArrayBuffer(100);
      const result = await reader.read(buffer);

      assert.strictEqual(result.image.width, width);
      assert.strictEqual(result.image.height, height);
      assert.strictEqual(result.image.data.length, width * height);

      // Should use first band
      for (let i = 0; i < band1.length; i++) {
        assert.strictEqual(result.image.data[i], band1[i]);
      }

      mockGeoTIFF.fromArrayBuffer = originalFromArrayBuffer;
    });

    test('should read multi-band TIF with Float64 first band', async () => {
      const width = 1;
      const height = 1;
      const band1 = new Float64Array([10.5]);
      const data = [band1];

      const mockImage = new MockTiffImage(width, height, 1, 3, [64], data);

      const originalFromArrayBuffer = mockGeoTIFF.fromArrayBuffer;
      mockGeoTIFF.fromArrayBuffer = async (arrayBuffer: ArrayBuffer) => {
        const mockTiff = new MockTiff(arrayBuffer);
        mockTiff.setMockImage(mockImage);
        return mockTiff;
      };

      const buffer = new ArrayBuffer(100);
      const result = await reader.read(buffer);

      assert.strictEqual(result.image.data[0], 10.5);

      mockGeoTIFF.fromArrayBuffer = originalFromArrayBuffer;
    });

    test('should convert integer array to Float32', async () => {
      const width = 2;
      const height = 1;
      const intData = [1000, 2000]; // Integer data
      const data = [intData];

      const mockImage = new MockTiffImage(width, height, 1, 1, [16], data);

      const originalFromArrayBuffer = mockGeoTIFF.fromArrayBuffer;
      mockGeoTIFF.fromArrayBuffer = async (arrayBuffer: ArrayBuffer) => {
        const mockTiff = new MockTiff(arrayBuffer);
        mockTiff.setMockImage(mockImage);
        return mockTiff;
      };

      const buffer = new ArrayBuffer(100);
      const result = await reader.read(buffer);

      assert.strictEqual(result.image.width, width);
      assert.strictEqual(result.image.height, height);
      assert.strictEqual(result.image.data[0], 1000);
      assert.strictEqual(result.image.data[1], 2000);

      mockGeoTIFF.fromArrayBuffer = originalFromArrayBuffer;
    });

    test('should handle 16-bit unsigned integer format', () => {
      const isDepth = (reader as any).isDepthTifImage(1, 1, [16]); // samplesPerPixel=1, sampleFormat=1 (uint), bitsPerSample=[16]
      assert.strictEqual(isDepth, true);
    });

    test('should handle 16-bit signed integer format', () => {
      const isDepth = (reader as any).isDepthTifImage(1, 2, [16]); // samplesPerPixel=1, sampleFormat=2 (signed int), bitsPerSample=[16]
      assert.strictEqual(isDepth, true);
    });

    test('should handle 32-bit float format', () => {
      const isDepth = (reader as any).isDepthTifImage(1, 3, [32]); // samplesPerPixel=1, sampleFormat=3 (float), bitsPerSample=[32]
      assert.strictEqual(isDepth, true);
    });

    test('should reject multi-channel images', () => {
      const isDepth = (reader as any).isDepthTifImage(3, 3, [8, 8, 8]); // RGB image
      assert.strictEqual(isDepth, false);
    });

    test('should reject 8-bit integer format', () => {
      const isDepth = (reader as any).isDepthTifImage(1, 1, [8]); // Too low bit depth for depth
      assert.strictEqual(isDepth, false);
    });

    test('should throw error for invalid depth image format', async () => {
      // Mock a 3-channel RGB image
      const mockImage = new MockTiffImage(10, 10, 3, 1, [8, 8, 8]);

      const originalFromArrayBuffer = mockGeoTIFF.fromArrayBuffer;
      mockGeoTIFF.fromArrayBuffer = async (arrayBuffer: ArrayBuffer) => {
        const mockTiff = new MockTiff(arrayBuffer);
        mockTiff.setMockImage(mockImage);
        return mockTiff;
      };

      const buffer = new ArrayBuffer(100);

      try {
        await reader.read(buffer);
        assert.fail('Should have thrown for non-depth image');
      } catch (error: any) {
        assert.ok(error.message.includes('Not a depth TIF image'));
      }

      mockGeoTIFF.fromArrayBuffer = originalFromArrayBuffer;
    });

    test('should throw error for unsupported raster data format', async () => {
      // Override readRasters to return unsupported data
      const mockImage = new MockTiffImage(2, 2, 1, 3, [32]);
      mockImage.readRasters = async () => null as any;

      const originalFromArrayBuffer = mockGeoTIFF.fromArrayBuffer;
      mockGeoTIFF.fromArrayBuffer = async (arrayBuffer: ArrayBuffer) => {
        const mockTiff = new MockTiff(arrayBuffer);
        mockTiff.setMockImage(mockImage);
        return mockTiff;
      };

      const buffer = new ArrayBuffer(100);

      try {
        await reader.read(buffer);
        assert.fail('Should have thrown for unsupported data format');
      } catch (error: any) {
        assert.ok(
          error.message.includes('Unsupported TIF raster data format') ||
            error.message.includes('Failed to read TIF file')
        );
      }

      mockGeoTIFF.fromArrayBuffer = originalFromArrayBuffer;
    });

    test('should throw error when GeoTIFF fails', async () => {
      const originalFromArrayBuffer = mockGeoTIFF.fromArrayBuffer;
      mockGeoTIFF.fromArrayBuffer = async (arrayBuffer: ArrayBuffer) => {
        throw new Error('Invalid TIFF file');
      };

      const buffer = new ArrayBuffer(100);

      try {
        await reader.read(buffer);
        assert.fail('Should have thrown when GeoTIFF fails');
      } catch (error: any) {
        assert.ok(error.message.includes('Failed to read TIF file'));
        assert.ok(error.message.includes('Invalid TIFF file'));
      }

      mockGeoTIFF.fromArrayBuffer = originalFromArrayBuffer;
    });

    test('should handle empty buffer', async () => {
      const originalFromArrayBuffer = mockGeoTIFF.fromArrayBuffer;
      mockGeoTIFF.fromArrayBuffer = async (arrayBuffer: ArrayBuffer) => {
        throw new Error('Invalid or empty TIFF data');
      };

      const buffer = new ArrayBuffer(0);

      try {
        await reader.read(buffer);
        assert.fail('Should have thrown for empty buffer');
      } catch (error: any) {
        assert.ok(error.message.includes('Failed to read TIF file'));
      }

      mockGeoTIFF.fromArrayBuffer = originalFromArrayBuffer;
    });

    test('should validate image dimensions', async () => {
      const mockImage = new MockTiffImage(0, 0); // Invalid dimensions

      const originalFromArrayBuffer = mockGeoTIFF.fromArrayBuffer;
      mockGeoTIFF.fromArrayBuffer = async (arrayBuffer: ArrayBuffer) => {
        const mockTiff = new MockTiff(arrayBuffer);
        mockTiff.setMockImage(mockImage);
        return mockTiff;
      };

      const buffer = new ArrayBuffer(100);
      const result = await reader.read(buffer);

      // Should still work but with 0 dimensions
      assert.strictEqual(result.image.width, 0);
      assert.strictEqual(result.image.height, 0);

      mockGeoTIFF.fromArrayBuffer = originalFromArrayBuffer;
    });
  });

  suite('isDepthTifImage private method', () => {
    test('should accept floating point single channel', () => {
      const isDepth = (reader as any).isDepthTifImage(1, 3, [32]);
      assert.strictEqual(isDepth, true);
    });

    test('should accept 16-bit unsigned integer', () => {
      const isDepth = (reader as any).isDepthTifImage(1, 1, [16]);
      assert.strictEqual(isDepth, true);
    });

    test('should accept 32-bit unsigned integer', () => {
      const isDepth = (reader as any).isDepthTifImage(1, 1, [32]);
      assert.strictEqual(isDepth, true);
    });

    test('should accept 16-bit signed integer', () => {
      const isDepth = (reader as any).isDepthTifImage(1, 2, [16]);
      assert.strictEqual(isDepth, true);
    });

    test('should reject multi-channel', () => {
      const isDepth = (reader as any).isDepthTifImage(3, 3, [8, 8, 8]);
      assert.strictEqual(isDepth, false);
    });

    test('should reject low bit depth integers', () => {
      const isDepth = (reader as any).isDepthTifImage(1, 1, [8]);
      assert.strictEqual(isDepth, false);
    });

    test('should handle null sample format', () => {
      const isDepth = (reader as any).isDepthTifImage(1, null, [16]);
      assert.strictEqual(isDepth, false);
    });

    test('should handle empty bits per sample', () => {
      const isDepth = (reader as any).isDepthTifImage(1, 1, []);
      assert.strictEqual(isDepth, false);
    });

    test('should handle unknown sample format', () => {
      const isDepth = (reader as any).isDepthTifImage(1, 99, [16]);
      assert.strictEqual(isDepth, false);
    });
  });

  suite('integration', () => {
    test('should implement DepthReader interface correctly', () => {
      assert.ok(typeof reader.canRead === 'function');
      assert.ok(typeof reader.read === 'function');
    });

    test('should return consistent results for same input', async () => {
      const buffer = new ArrayBuffer(100);

      const result1 = await reader.read(buffer);
      const result2 = await reader.read(buffer);

      assert.strictEqual(result1.image.width, result2.image.width);
      assert.strictEqual(result1.image.height, result2.image.height);
      assert.strictEqual(result1.meta.kind, result2.meta.kind);
      assert.strictEqual(result1.meta.unit, result2.meta.unit);
    });

    test('should handle realistic TIF scenarios', async () => {
      // Test different realistic scenarios
      const scenarios = [
        { width: 640, height: 480, format: 3, bits: [32] }, // Float32 depth
        { width: 1920, height: 1080, format: 1, bits: [16] }, // 16-bit uint disparity
        { width: 512, height: 384, format: 2, bits: [32] }, // 32-bit signed int
      ];

      for (const scenario of scenarios) {
        const mockImage = new MockTiffImage(
          scenario.width,
          scenario.height,
          1,
          scenario.format,
          scenario.bits
        );

        const originalFromArrayBuffer = mockGeoTIFF.fromArrayBuffer;
        mockGeoTIFF.fromArrayBuffer = async (arrayBuffer: ArrayBuffer) => {
          const mockTiff = new MockTiff(arrayBuffer);
          mockTiff.setMockImage(mockImage);
          return mockTiff;
        };

        const buffer = new ArrayBuffer(100);
        const result = await reader.read(buffer);

        assert.strictEqual(result.image.width, scenario.width);
        assert.strictEqual(result.image.height, scenario.height);
        assert.strictEqual(result.meta.kind, 'depth');
        assert.strictEqual(result.meta.unit, 'meter');

        mockGeoTIFF.fromArrayBuffer = originalFromArrayBuffer;
      }
    });
  });
});
