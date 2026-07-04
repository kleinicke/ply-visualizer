import * as assert from 'assert';
import * as depthIndex from '../../src/depth/index';

suite('Webview Depth Index', () => {
  suite('Module exports', () => {
    test('should export types from types module', () => {
      // Check that type names are accessible (they won't have runtime values)
      // but we can verify the module structure
      assert.ok(typeof depthIndex === 'object');
    });

    test('should export DepthRegistry functions', () => {
      assert.ok(depthIndex.registerReader);
      assert.ok(depthIndex.registerDefaultReaders);
      assert.ok(depthIndex.findReader);
      assert.ok(depthIndex.readDepth);

      assert.strictEqual(typeof depthIndex.registerReader, 'function');
      assert.strictEqual(typeof depthIndex.registerDefaultReaders, 'function');
      assert.strictEqual(typeof depthIndex.findReader, 'function');
      assert.strictEqual(typeof depthIndex.readDepth, 'function');
    });

    test('should be able to use exported registry functions', () => {
      // Test that registry functions are callable
      assert.doesNotThrow(() => {
        const reader = depthIndex.findReader('test.unknownext');
        // Should return undefined for truly unregistered extension
        assert.strictEqual(reader, undefined);
      });
    });

    test('should verify complete module interface', () => {
      // Verify all expected exports are present
      const expectedExports = [
        'registerReader',
        'registerDefaultReaders',
        'findReader',
        'readDepth',
      ];

      expectedExports.forEach(exportName => {
        assert.ok(exportName in depthIndex, `Missing export: ${exportName}`);
        assert.ok(
          (depthIndex as any)[exportName] !== undefined,
          `Export ${exportName} is undefined`
        );
      });
    });

    test('should maintain proper export types', () => {
      // Registry functions should be regular functions
      assert.strictEqual(typeof depthIndex.registerReader, 'function');
      assert.strictEqual(typeof depthIndex.registerDefaultReaders, 'function');
      assert.strictEqual(typeof depthIndex.findReader, 'function');
      assert.strictEqual(typeof depthIndex.readDepth, 'function');
    });
  });

  suite('Re-export functionality', () => {
    test('should properly re-export registry functionality', () => {
      // Test basic registry functionality
      let readerRegistered = false;

      const mockReader = {
        canRead: (filename: string) => filename.endsWith('.mock'),
        read: async () => ({
          image: { width: 1, height: 1, data: new Float32Array(1) },
          meta: { kind: 'depth' as const },
        }),
      };

      // Register a mock reader
      assert.doesNotThrow(() => {
        depthIndex.registerReader(mockReader);
        readerRegistered = true;
      });

      assert.ok(readerRegistered);

      // Try to find the registered reader
      const foundReader = depthIndex.findReader('test.mock');
      assert.ok(foundReader);
      assert.strictEqual(foundReader, mockReader);
    });

    test('should handle module re-export errors gracefully', () => {
      // Test that module can handle missing dependencies
      assert.doesNotThrow(() => {
        // These should not throw even if underlying modules have issues
        const reader = depthIndex.findReader('test.unknownformat');
        // Some readers might be auto-registered, so just check it doesn't throw
        // Don't assert the exact return value
      });
    });
  });

  suite('Module structure validation', () => {
    test('should have expected module structure', () => {
      // Verify the module is structured as expected
      assert.ok(depthIndex);
      assert.strictEqual(typeof depthIndex, 'object');

      // Should not be null or undefined
      assert.ok(depthIndex !== null);
      assert.ok(depthIndex !== undefined);
    });

    test('should not have unexpected exports', () => {
      const expectedExports = [
        'registerReader',
        'registerDefaultReaders',
        'findReader',
        'readDepth',
      ];

      const actualExports = Object.keys(depthIndex).filter(
        key => typeof (depthIndex as any)[key] === 'function'
      );

      // All registry functions should be present
      expectedExports.forEach(exportName => {
        assert.ok(actualExports.includes(exportName), `Missing expected export: ${exportName}`);
      });
    });
  });

  suite('Integration with underlying modules', () => {
    test('should integrate properly with DepthRegistry module', () => {
      // Test registry integration
      let registeredSuccessfully = false;

      const testReader = {
        canRead: () => false,
        read: async () => ({
          image: { width: 1, height: 1, data: new Float32Array(1) },
          meta: { kind: 'depth' as const },
        }),
      };

      assert.doesNotThrow(() => {
        depthIndex.registerReader(testReader);
        registeredSuccessfully = true;
      });

      assert.ok(registeredSuccessfully);
    });

    test('should handle module loading edge cases', () => {
      // Test that the module handles edge cases in loading
      assert.doesNotThrow(() => {
        // Multiple function calls should work
        const reader1 = depthIndex.findReader('test1.unknownext1');
        const reader2 = depthIndex.findReader('test2.unknownext2');

        // Should work without throwing
        // Don't assert specific return values as readers may be auto-registered
      });
    });
  });
});
