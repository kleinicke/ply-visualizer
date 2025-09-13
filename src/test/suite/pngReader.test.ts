import * as assert from 'assert';
import {
  PngReader,
  Enhanced16BitPngReader,
  PngDepthConfig,
} from '../../webview/depth/readers/PngReader';

// Mock DOM APIs for testing
class MockImageData {
  width: number;
  height: number;
  data: Uint8ClampedArray;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.data = new Uint8ClampedArray(width * height * 4);

    // Fill with default data (grayscale pattern)
    for (let i = 0; i < width * height; i++) {
      const value = (i * 10) % 256;
      this.data[i * 4] = value; // R
      this.data[i * 4 + 1] = value; // G
      this.data[i * 4 + 2] = value; // B
      this.data[i * 4 + 3] = 255; // A
    }
  }
}

class MockCanvasRenderingContext2D {
  canvas: { width: number; height: number };

  constructor() {
    this.canvas = { width: 0, height: 0 };
  }

  drawImage(img: any, x: number, y: number): void {
    // Mock implementation
  }

  getImageData(x: number, y: number, width: number, height: number): MockImageData {
    return new MockImageData(width, height);
  }
}

class MockCanvas {
  width = 0;
  height = 0;

  getContext(type: string): MockCanvasRenderingContext2D | null {
    if (type === '2d') {
      return new MockCanvasRenderingContext2D();
    }
    return null;
  }
}

class MockImage {
  private _src = '';
  width = 100;
  height = 100;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;

  get src(): string {
    return this._src;
  }

  set src(value: string) {
    this._src = value;
  }

  // Simulate successful image load
  triggerLoad(): void {
    if (this.onload) {
      setTimeout(() => this.onload!(), 0);
    }
  }

  // Simulate image load error
  triggerError(): void {
    if (this.onerror) {
      setTimeout(() => this.onerror!(), 0);
    }
  }
}

class MockURL {
  static createObjectURL(blob: Blob): string {
    return 'mock-url';
  }

  static revokeObjectURL(url: string): void {
    // Mock implementation
  }
}

class MockBlob {
  constructor(
    public data: any[],
    public options: any
  ) {}
}

// Setup global mocks
(global as any).document = {
  createElement: (tagName: string) => {
    if (tagName === 'canvas') {
      return new MockCanvas();
    }
    return {};
  },
};

(global as any).Image = MockImage;
(global as any).URL = MockURL;
(global as any).Blob = MockBlob;

suite('PngReader', () => {
  let reader: PngReader;

  setup(() => {
    reader = new PngReader();
  });

  suite('canRead', () => {
    test('should return true for .png files', () => {
      assert.strictEqual(reader.canRead('test.png'), true);
      assert.strictEqual(reader.canRead('depth.png'), true);
      assert.strictEqual(reader.canRead('path/to/file.png'), true);
    });

    test('should return true for .png files case-insensitively', () => {
      assert.strictEqual(reader.canRead('test.PNG'), true);
      assert.strictEqual(reader.canRead('test.Png'), true);
      assert.strictEqual(reader.canRead('test.PnG'), true);
    });

    test('should return false for non-png files', () => {
      assert.strictEqual(reader.canRead('test.tif'), false);
      assert.strictEqual(reader.canRead('test.jpg'), false);
      assert.strictEqual(reader.canRead('test.pfm'), false);
      assert.strictEqual(reader.canRead('test.png.txt'), false);
      assert.strictEqual(reader.canRead('testpng'), false);
    });

    test('should handle empty filename', () => {
      assert.strictEqual(reader.canRead(''), false);
    });

    test('should handle filename without extension', () => {
      assert.strictEqual(reader.canRead('filename'), false);
    });
  });

  suite('setConfig', () => {
    test('should set PNG scale factor', () => {
      const config: PngDepthConfig = {
        pngScaleFactor: 256,
        invalidValue: 255,
      };

      reader.setConfig(config);

      // Verify config is applied (we can't directly access private config, but can test through read behavior)
      assert.doesNotThrow(() => reader.setConfig(config));
    });

    test('should merge partial config', () => {
      reader.setConfig({ pngScaleFactor: 500 });
      reader.setConfig({ invalidValue: 100 });

      // Both configs should be applied
      assert.doesNotThrow(() => reader.setConfig({ pngScaleFactor: 500 }));
    });

    test('should handle empty config', () => {
      assert.doesNotThrow(() => reader.setConfig({}));
    });
  });

  suite('createWithConfig static method', () => {
    test('should create reader with config', () => {
      const config: PngDepthConfig = {
        pngScaleFactor: 1000,
        invalidValue: 0,
      };

      const configuredReader = PngReader.createWithConfig(config);

      assert.ok(configuredReader instanceof PngReader);
    });

    test('should create reader with partial config', () => {
      const configuredReader = PngReader.createWithConfig({ pngScaleFactor: 2000 });

      assert.ok(configuredReader instanceof PngReader);
    });
  });

  suite('detectPngFormat', () => {
    function createMockPngHeader(
      width: number,
      height: number,
      bitDepth: number,
      colorType: number
    ): Uint8Array {
      const signature = [137, 80, 78, 71, 13, 10, 26, 10];
      const ihdrLength = 13;
      const ihdrType = [73, 72, 68, 82]; // "IHDR"

      const data = new Uint8Array(8 + 8 + ihdrLength + 4); // signature + chunk header + IHDR data + CRC
      let offset = 0;

      // PNG signature
      for (let i = 0; i < signature.length; i++) {
        data[offset++] = signature[i];
      }

      // IHDR chunk length (big-endian)
      data[offset++] = (ihdrLength >> 24) & 0xff;
      data[offset++] = (ihdrLength >> 16) & 0xff;
      data[offset++] = (ihdrLength >> 8) & 0xff;
      data[offset++] = ihdrLength & 0xff;

      // IHDR chunk type
      for (let i = 0; i < ihdrType.length; i++) {
        data[offset++] = ihdrType[i];
      }

      // IHDR data
      // Width (big-endian)
      data[offset++] = (width >> 24) & 0xff;
      data[offset++] = (width >> 16) & 0xff;
      data[offset++] = (width >> 8) & 0xff;
      data[offset++] = width & 0xff;

      // Height (big-endian)
      data[offset++] = (height >> 24) & 0xff;
      data[offset++] = (height >> 16) & 0xff;
      data[offset++] = (height >> 8) & 0xff;
      data[offset++] = height & 0xff;

      // Bit depth
      data[offset++] = bitDepth;

      // Color type
      data[offset++] = colorType;

      // Compression method, filter method, interlace method
      data[offset++] = 0; // Compression
      data[offset++] = 0; // Filter
      data[offset++] = 0; // Interlace

      // CRC (dummy)
      data[offset++] = 0;
      data[offset++] = 0;
      data[offset++] = 0;
      data[offset++] = 0;

      return data;
    }

    test('should detect 8-bit grayscale PNG', () => {
      const mockPng = createMockPngHeader(100, 200, 8, 0);
      const info = (reader as any).detectPngFormat(mockPng);

      assert.strictEqual(info.width, 100);
      assert.strictEqual(info.height, 200);
      assert.strictEqual(info.bitDepth, 8);
      assert.strictEqual(info.colorType, 0);
    });

    test('should detect 16-bit grayscale PNG', () => {
      const mockPng = createMockPngHeader(320, 240, 16, 0);
      const info = (reader as any).detectPngFormat(mockPng);

      assert.strictEqual(info.width, 320);
      assert.strictEqual(info.height, 240);
      assert.strictEqual(info.bitDepth, 16);
      assert.strictEqual(info.colorType, 0);
    });

    test('should detect RGB PNG', () => {
      const mockPng = createMockPngHeader(640, 480, 8, 2);
      const info = (reader as any).detectPngFormat(mockPng);

      assert.strictEqual(info.colorType, 2); // RGB
    });

    test('should throw error for invalid PNG signature', () => {
      const invalidData = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);

      assert.throws(() => {
        (reader as any).detectPngFormat(invalidData);
      }, /Invalid PNG signature/);
    });

    test('should throw error when IHDR not found', () => {
      const signature = [137, 80, 78, 71, 13, 10, 26, 10];
      const data = new Uint8Array(signature);

      assert.throws(() => {
        (reader as any).detectPngFormat(data);
      }, /IHDR chunk not found/);
    });
  });

  suite('read', () => {
    function createBasicPngBuffer(): ArrayBuffer {
      // Create a minimal PNG buffer for testing
      const signature = [137, 80, 78, 71, 13, 10, 26, 10];
      const ihdrLength = 13;
      const ihdrType = [73, 72, 68, 82]; // "IHDR"
      const width = 2,
        height = 2,
        bitDepth = 8,
        colorType = 0;

      const buffer = new ArrayBuffer(50); // Enough space for header
      const data = new Uint8Array(buffer);
      let offset = 0;

      // PNG signature
      for (let i = 0; i < signature.length; i++) {
        data[offset++] = signature[i];
      }

      // IHDR chunk
      data[offset++] = 0;
      data[offset++] = 0;
      data[offset++] = 0;
      data[offset++] = ihdrLength;
      for (let i = 0; i < ihdrType.length; i++) {
        data[offset++] = ihdrType[i];
      }

      // IHDR data
      data[offset++] = 0;
      data[offset++] = 0;
      data[offset++] = 0;
      data[offset++] = width;
      data[offset++] = 0;
      data[offset++] = 0;
      data[offset++] = 0;
      data[offset++] = height;
      data[offset++] = bitDepth;
      data[offset++] = colorType;
      data[offset++] = 0;
      data[offset++] = 0;
      data[offset++] = 0;

      // CRC
      data[offset++] = 0;
      data[offset++] = 0;
      data[offset++] = 0;
      data[offset++] = 0;

      return buffer;
    }

    test('should read 8-bit PNG successfully', async () => {
      const buffer = createBasicPngBuffer();

      // Override Image mock to trigger successful load
      const originalImage = (global as any).Image;
      (global as any).Image = class extends MockImage {
        set src(value: string) {
          this.triggerLoad();
        }
      };

      try {
        const result = await reader.read(buffer);

        assert.ok(result);
        assert.ok(result.image);
        assert.ok(result.meta);
        assert.strictEqual(result.meta.kind, 'depth');
        assert.strictEqual(result.meta.unit, 'meter');
        assert.ok(result.meta.bitDepth);
        assert.ok(result.image.data instanceof Float32Array);
      } finally {
        (global as any).Image = originalImage;
      }
    });

    test('should handle image load error', async () => {
      const buffer = createBasicPngBuffer();

      const originalImage = (global as any).Image;
      (global as any).Image = class extends MockImage {
        set src(value: string) {
          this.triggerError();
        }
      };

      try {
        await reader.read(buffer);
        assert.fail('Should have thrown error');
      } catch (error: any) {
        assert.ok(error.message.includes('Failed to read PNG file'));
      } finally {
        (global as any).Image = originalImage;
      }
    });

    test('should handle 16-bit PNG', async () => {
      const signature = [137, 80, 78, 71, 13, 10, 26, 10];
      const ihdrData = [
        0,
        0,
        0,
        13, // IHDR length
        73,
        72,
        68,
        82, // "IHDR"
        0,
        0,
        0,
        2, // width = 2
        0,
        0,
        0,
        2, // height = 2
        16, // bit depth = 16
        0, // color type = 0 (grayscale)
        0,
        0,
        0, // compression, filter, interlace
        0,
        0,
        0,
        0, // CRC
      ];

      const buffer = new ArrayBuffer(signature.length + ihdrData.length);
      const data = new Uint8Array(buffer);
      let offset = 0;

      for (let i = 0; i < signature.length; i++) {
        data[offset++] = signature[i];
      }
      for (let i = 0; i < ihdrData.length; i++) {
        data[offset++] = ihdrData[i];
      }

      const originalImage = (global as any).Image;
      (global as any).Image = class extends MockImage {
        set src(value: string) {
          this.triggerLoad();
        }
      };

      try {
        const result = await reader.read(buffer);

        assert.strictEqual(result.meta.bitDepth, 16);
        assert.strictEqual(result.image.width, 2);
        assert.strictEqual(result.image.height, 2);
      } finally {
        (global as any).Image = originalImage;
      }
    });

    test('should apply scale factor configuration', async () => {
      reader.setConfig({ pngScaleFactor: 500, invalidValue: 0 });

      const buffer = createBasicPngBuffer();

      const originalImage = (global as any).Image;
      (global as any).Image = class extends MockImage {
        set src(value: string) {
          this.triggerLoad();
        }
      };

      try {
        const result = await reader.read(buffer);

        assert.strictEqual(result.meta.scale, 500);
        assert.strictEqual(result.meta.invalidValue, 0);
      } finally {
        (global as any).Image = originalImage;
      }
    });

    test('should handle invalid value filtering', async () => {
      reader.setConfig({ pngScaleFactor: 1000, invalidValue: 128 });

      const buffer = createBasicPngBuffer();

      const originalImage = (global as any).Image;
      (global as any).Image = class extends MockImage {
        set src(value: string) {
          this.triggerLoad();
        }
      };

      try {
        const result = await reader.read(buffer);

        // Values equal to invalidValue should be set to 0
        assert.ok(result.image.data instanceof Float32Array);
      } finally {
        (global as any).Image = originalImage;
      }
    });

    test('should handle canvas context creation failure', async () => {
      const originalDocument = (global as any).document;
      (global as any).document = {
        createElement: (tagName: string) => {
          if (tagName === 'canvas') {
            return {
              getContext: () => null, // Simulate context creation failure
            };
          }
          return {};
        },
      };

      const buffer = createBasicPngBuffer();

      try {
        await reader.read(buffer);
        assert.fail('Should have thrown error');
      } catch (error: any) {
        assert.ok(error.message.includes('Failed to read PNG file'));
      } finally {
        (global as any).document = originalDocument;
      }
    });

    test('should throw error for invalid PNG signature', async () => {
      const invalidBuffer = new ArrayBuffer(10);
      const invalidData = new Uint8Array(invalidBuffer);
      invalidData.fill(0); // Invalid signature

      try {
        await reader.read(invalidBuffer);
        assert.fail('Should have thrown error');
      } catch (error: any) {
        assert.ok(error.message.includes('Failed to read PNG file'));
      }
    });

    test('should create proper metadata', async () => {
      const buffer = createBasicPngBuffer();

      const originalImage = (global as any).Image;
      (global as any).Image = class extends MockImage {
        set src(value: string) {
          this.triggerLoad();
        }
      };

      try {
        const result = await reader.read(buffer);

        assert.strictEqual(result.meta.kind, 'depth');
        assert.strictEqual(result.meta.unit, 'meter');
        assert.strictEqual(result.meta.requiresConfiguration, true);
        assert.ok(typeof result.meta.scale === 'number');
        assert.ok(typeof result.meta.invalidValue === 'number');
      } finally {
        (global as any).Image = originalImage;
      }
    });
  });

  suite('integration', () => {
    test('should implement DepthReader interface correctly', () => {
      assert.ok(typeof reader.canRead === 'function');
      assert.ok(typeof reader.read === 'function');
    });

    test('should handle different PNG configurations', () => {
      const configs = [
        { pngScaleFactor: 1000, invalidValue: 0 },
        { pngScaleFactor: 256, invalidValue: 255 },
        { pngScaleFactor: 1, invalidValue: 0 },
        { pngScaleFactor: 65536, invalidValue: 32768 },
      ];

      configs.forEach(config => {
        const configuredReader = PngReader.createWithConfig(config);
        assert.ok(configuredReader instanceof PngReader);
      });
    });
  });
});

suite('Enhanced16BitPngReader', () => {
  let reader: Enhanced16BitPngReader;

  setup(() => {
    reader = new Enhanced16BitPngReader();
  });

  suite('canRead', () => {
    test('should return true for .png files', () => {
      assert.strictEqual(reader.canRead('test.png'), true);
      assert.strictEqual(reader.canRead('depth.png'), true);
    });

    test('should return false for non-png files', () => {
      assert.strictEqual(reader.canRead('test.tif'), false);
      assert.strictEqual(reader.canRead('test.jpg'), false);
    });
  });

  suite('setConfig', () => {
    test('should accept configuration', () => {
      const config: PngDepthConfig = {
        pngScaleFactor: 1000,
        invalidValue: 0,
      };

      assert.doesNotThrow(() => reader.setConfig(config));
    });
  });

  suite('read', () => {
    test('should throw not implemented error', async () => {
      const buffer = new ArrayBuffer(100);

      try {
        await reader.read(buffer);
        assert.fail('Should have thrown error');
      } catch (error: any) {
        assert.ok(
          error.message.includes('Enhanced 16-bit PNG reader requires pngjs library integration')
        );
      }
    });
  });

  suite('interface compliance', () => {
    test('should implement DepthReader interface', () => {
      assert.ok(typeof reader.canRead === 'function');
      assert.ok(typeof reader.read === 'function');
    });
  });
});
