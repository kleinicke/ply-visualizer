import * as assert from 'assert';
import {
  registerReader,
  registerDefaultReaders,
  findReader,
  readDepth,
  clearReaders,
} from '../../webview/depth/DepthRegistry';
import {
  DepthReader,
  DepthReaderResult,
  DepthImage,
  DepthMetadata,
} from '../../webview/depth/types';

// Mock depth reader for testing
class MockDepthReader implements DepthReader {
  private supportedExtensions: string[];
  private name: string;

  constructor(name: string, extensions: string[]) {
    this.name = name;
    this.supportedExtensions = extensions;
  }

  canRead(filename: string, mimeType?: string): boolean {
    const ext = filename.toLowerCase().split('.').pop() || '';
    return this.supportedExtensions.includes(ext);
  }

  async read(arrayBuffer: ArrayBuffer): Promise<DepthReaderResult> {
    const mockImage: DepthImage = {
      width: 10,
      height: 10,
      data: new Float32Array(100),
    };

    const mockMeta: DepthMetadata = {
      kind: 'depth',
      unit: 'meter',
    };

    return {
      image: mockImage,
      meta: mockMeta,
    };
  }

  getName(): string {
    return this.name;
  }
}

// Error-throwing mock reader for testing error cases
class ErrorThrowingMockReader implements DepthReader {
  canRead(filename: string, mimeType?: string): boolean {
    return filename.toLowerCase().endsWith('.error');
  }

  async read(arrayBuffer: ArrayBuffer): Promise<DepthReaderResult> {
    throw new Error('Mock reader error');
  }
}

suite('DepthRegistry', () => {
  // Clear registry before each test
  setup(() => {
    clearReaders();
  });

  suite('registerReader', () => {
    test('should register a new reader', () => {
      const mockReader = new MockDepthReader('TestReader', ['test']);
      assert.doesNotThrow(() => {
        registerReader(mockReader);
      });
    });

    test('should register multiple readers', () => {
      const reader1 = new MockDepthReader('Reader1', ['ext1']);
      const reader2 = new MockDepthReader('Reader2', ['ext2']);

      assert.doesNotThrow(() => {
        registerReader(reader1);
        registerReader(reader2);
      });
    });

    test('should allow registering the same reader multiple times', () => {
      const mockReader = new MockDepthReader('TestReader', ['test']);

      assert.doesNotThrow(() => {
        registerReader(mockReader);
        registerReader(mockReader);
      });
    });
  });

  suite('findReader', () => {
    test('should return undefined when no readers are registered', () => {
      const reader = findReader('test.png');
      assert.strictEqual(reader, undefined);
    });

    test('should find reader by file extension', () => {
      const mockReader = new MockDepthReader('PngReader', ['png']);
      registerReader(mockReader);

      const reader = findReader('test.png');
      assert.strictEqual(reader, mockReader);
    });

    test('should find reader by file extension case-insensitively', () => {
      const mockReader = new MockDepthReader('PngReader', ['png']);
      registerReader(mockReader);

      const reader = findReader('TEST.PNG');
      assert.strictEqual(reader, mockReader);
    });

    test('should return undefined for unsupported extension', () => {
      const mockReader = new MockDepthReader('PngReader', ['png']);
      registerReader(mockReader);

      const reader = findReader('test.xyz');
      assert.strictEqual(reader, undefined);
    });

    test('should return first matching reader when multiple readers support the same extension', () => {
      const reader1 = new MockDepthReader('Reader1', ['png']);
      const reader2 = new MockDepthReader('Reader2', ['png']);
      registerReader(reader1);
      registerReader(reader2);

      const foundReader = findReader('test.png');
      assert.strictEqual(foundReader, reader1);
    });

    test('should handle filenames without extension', () => {
      const mockReader = new MockDepthReader('TestReader', ['test']);
      registerReader(mockReader);

      const reader = findReader('filename_without_extension');
      assert.strictEqual(reader, undefined);
    });

    test('should handle empty filename', () => {
      const mockReader = new MockDepthReader('TestReader', ['test']);
      registerReader(mockReader);

      const reader = findReader('');
      assert.strictEqual(reader, undefined);
    });

    test('should pass mimeType to reader canRead method', () => {
      let receivedMimeType: string | undefined;

      class MimeTypeCheckingReader implements DepthReader {
        canRead(filename: string, mimeType?: string): boolean {
          receivedMimeType = mimeType;
          return filename.endsWith('.test');
        }

        async read(arrayBuffer: ArrayBuffer): Promise<DepthReaderResult> {
          throw new Error('Not implemented for test');
        }
      }

      const testReader = new MimeTypeCheckingReader();
      registerReader(testReader);

      findReader('test.test', 'image/test');
      assert.strictEqual(receivedMimeType, 'image/test');
    });
  });

  suite('readDepth', () => {
    test('should successfully read depth data with registered reader', async () => {
      const mockReader = new MockDepthReader('TestReader', ['test']);
      registerReader(mockReader);

      const buffer = new ArrayBuffer(100);
      const result = await readDepth('test.test', buffer);

      assert.ok(result);
      assert.ok(result.image);
      assert.ok(result.meta);
      assert.strictEqual(result.image.width, 10);
      assert.strictEqual(result.image.height, 10);
      assert.strictEqual(result.image.data.length, 100);
      assert.strictEqual(result.meta.kind, 'depth');
      assert.strictEqual(result.meta.unit, 'meter');
    });

    test('should throw error when no reader found for file', async () => {
      const buffer = new ArrayBuffer(100);

      try {
        await readDepth('unsupported.xyz', buffer);
        assert.fail('Should have thrown an error');
      } catch (error: any) {
        assert.ok(error.message.includes('No depth reader registered'));
        assert.ok(error.message.includes('unsupported.xyz'));
      }
    });

    test('should propagate errors from reader', async () => {
      const errorReader = new ErrorThrowingMockReader();
      registerReader(errorReader);

      const buffer = new ArrayBuffer(100);

      try {
        await readDepth('test.error', buffer);
        assert.fail('Should have thrown an error');
      } catch (error: any) {
        assert.strictEqual(error.message, 'Mock reader error');
      }
    });

    test('should pass correct arrayBuffer to reader', async () => {
      let receivedBuffer: ArrayBuffer | undefined;

      class BufferCheckingReader implements DepthReader {
        canRead(filename: string): boolean {
          return filename.endsWith('.buffer');
        }

        async read(arrayBuffer: ArrayBuffer): Promise<DepthReaderResult> {
          receivedBuffer = arrayBuffer;
          return {
            image: { width: 1, height: 1, data: new Float32Array(1) },
            meta: { kind: 'depth' },
          };
        }
      }

      const testReader = new BufferCheckingReader();
      registerReader(testReader);

      const testBuffer = new ArrayBuffer(256);
      await readDepth('test.buffer', testBuffer);

      assert.strictEqual(receivedBuffer, testBuffer);
    });

    test('should handle readers that return different data structures', async () => {
      class CustomDataReader implements DepthReader {
        canRead(filename: string): boolean {
          return filename.endsWith('.custom');
        }

        async read(arrayBuffer: ArrayBuffer): Promise<DepthReaderResult> {
          return {
            image: {
              width: 20,
              height: 15,
              data: new Float32Array(300),
            },
            meta: {
              kind: 'disparity',
              unit: 'millimeter',
              scale: 1000,
              fx: 500,
              fy: 500,
              cx: 320,
              cy: 240,
              baseline: 0.12,
            },
          };
        }
      }

      const customReader = new CustomDataReader();
      registerReader(customReader);

      const result = await readDepth('test.custom', new ArrayBuffer(100));

      assert.strictEqual(result.image.width, 20);
      assert.strictEqual(result.image.height, 15);
      assert.strictEqual(result.image.data.length, 300);
      assert.strictEqual(result.meta.kind, 'disparity');
      assert.strictEqual(result.meta.unit, 'millimeter');
      assert.strictEqual(result.meta.scale, 1000);
      assert.strictEqual(result.meta.fx, 500);
      assert.strictEqual(result.meta.baseline, 0.12);
    });
  });

  suite('registerDefaultReaders', () => {
    test('should register default readers without error', () => {
      // Mock require to avoid loading actual readers
      const originalRequire = require;
      const mockReaders = {
        PfmReader: class {
          canRead() {
            return false;
          }
          async read() {
            throw new Error('Mock');
          }
        },
        TifReader: class {
          canRead() {
            return false;
          }
          async read() {
            throw new Error('Mock');
          }
        },
        NpyReader: class {
          canRead() {
            return false;
          }
          async read() {
            throw new Error('Mock');
          }
        },
        PngReader: class {
          canRead() {
            return false;
          }
          async read() {
            throw new Error('Mock');
          }
        },
        ExrReader: class {
          canRead() {
            return false;
          }
          async read() {
            throw new Error('Mock');
          }
        },
      };

      (require as any) = function (moduleId: string) {
        if (moduleId.includes('readers/')) {
          const readerName = moduleId.split('/').pop()?.replace('.ts', '').replace('.js', '');
          if (readerName && mockReaders[readerName as keyof typeof mockReaders]) {
            return { [readerName]: mockReaders[readerName as keyof typeof mockReaders] };
          }
        }
        return originalRequire(moduleId);
      };

      assert.doesNotThrow(() => {
        registerDefaultReaders();
      });

      // Restore original require
      require = originalRequire;
    });
  });

  suite('integration tests', () => {
    test('should handle multiple readers for different formats', async () => {
      const pngReader = new MockDepthReader('PngReader', ['png']);
      const tifReader = new MockDepthReader('TifReader', ['tif', 'tiff']);
      const pfmReader = new MockDepthReader('PfmReader', ['pfm']);

      registerReader(pngReader);
      registerReader(tifReader);
      registerReader(pfmReader);

      // Test PNG
      const pngFoundReader = findReader('depth.png');
      assert.strictEqual(pngFoundReader, pngReader);

      // Test TIF
      const tifFoundReader = findReader('depth.tif');
      assert.strictEqual(tifFoundReader, tifReader);

      // Test TIFF
      const tiffFoundReader = findReader('depth.tiff');
      assert.strictEqual(tiffFoundReader, tifReader);

      // Test PFM
      const pfmFoundReader = findReader('depth.pfm');
      assert.strictEqual(pfmFoundReader, pfmReader);

      // Test unsupported
      const unsupportedReader = findReader('depth.xyz');
      assert.strictEqual(unsupportedReader, undefined);
    });

    test('should work with realistic file paths', async () => {
      const mockReader = new MockDepthReader('TestReader', ['png']);
      registerReader(mockReader);

      const testPaths = [
        '/path/to/depth.png',
        'C:\\Users\\test\\depth.png',
        'depth_001.png',
        'my-depth-image.PNG',
        '../relative/path/depth.png',
      ];

      for (const path of testPaths) {
        const reader = findReader(path);
        assert.ok(reader, `No reader found for path: ${path}`);
        assert.strictEqual(reader, mockReader, `Wrong reader for path: ${path}`);

        const result = await readDepth(path, new ArrayBuffer(100));
        assert.ok(result);
        assert.ok(result.image);
        assert.ok(result.meta);
      }
    });
  });
});
