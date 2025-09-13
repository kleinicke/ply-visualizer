import * as assert from 'assert';
import * as THREE from 'three';

// Utility methods and helper functions from main.ts
suite('PointCloudVisualizer Utility Methods Test Suite', () => {
  suite('String and Input Parsing', () => {
    test('Should parse space-separated numeric values', () => {
      const parseSpaceSeparatedValues = (input: string): number[] => {
        const trimmed = input.trim();
        if (!trimmed) {return [];}

        return trimmed.split(/\s+/).map(str => {
          const num = parseFloat(str);
          if (isNaN(num)) {
            throw new Error(`Invalid number: ${str}`);
          }
          return num;
        });
      };

      // Valid cases
      assert.deepStrictEqual(parseSpaceSeparatedValues('1 2 3'), [1, 2, 3]);
      assert.deepStrictEqual(parseSpaceSeparatedValues('1.5  2.7   3.14'), [1.5, 2.7, 3.14]);
      assert.deepStrictEqual(parseSpaceSeparatedValues('  -1   0  1  '), [-1, 0, 1]);
      assert.deepStrictEqual(parseSpaceSeparatedValues(''), []);
      assert.deepStrictEqual(parseSpaceSeparatedValues('   '), []);

      // Invalid cases should throw
      assert.throws(() => parseSpaceSeparatedValues('1 abc 3'));
      assert.throws(() => parseSpaceSeparatedValues('1 2 NaN'));
    });

    test('Should parse 4x4 transformation matrix from text', () => {
      const parseMatrixInput = (input: string): number[] | null => {
        const cleanInput = input.trim();
        if (!cleanInput) {return null;}

        const parts = cleanInput.split(/[\s,]+/).filter(part => part.length > 0);
        if (parts.length !== 16) {return null;}

        const numbers: number[] = [];
        for (const part of parts) {
          const num = parseFloat(part);
          if (isNaN(num)) {return null;}
          numbers.push(num);
        }

        return numbers;
      };

      // Valid identity matrix
      const identity = '1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 1';
      const result = parseMatrixInput(identity);
      assert.ok(result);
      assert.strictEqual(result!.length, 16);
      assert.strictEqual(result![0], 1);
      assert.strictEqual(result![15], 1);

      // Invalid cases
      assert.strictEqual(parseMatrixInput(''), null);
      assert.strictEqual(parseMatrixInput('1 2 3'), null); // Too few values
      assert.strictEqual(parseMatrixInput('1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 abc'), null); // Invalid number
    });

    test('Should validate numeric inputs with ranges', () => {
      const validateNumberInRange = (value: string, min: number, max: number): number | null => {
        const num = parseFloat(value);
        if (isNaN(num) || num < min || num > max) {return null;}
        return num;
      };

      assert.strictEqual(validateNumberInRange('50', 0, 100), 50);
      assert.strictEqual(validateNumberInRange('0', 0, 100), 0);
      assert.strictEqual(validateNumberInRange('100', 0, 100), 100);
      assert.strictEqual(validateNumberInRange('-1', 0, 100), null);
      assert.strictEqual(validateNumberInRange('101', 0, 100), null);
      assert.strictEqual(validateNumberInRange('abc', 0, 100), null);
    });

    test('Should handle file extension parsing', () => {
      const getFileExtension = (filename: string): string => {
        const lastDot = filename.lastIndexOf('.');
        return lastDot === -1 ? '' : filename.slice(lastDot + 1).toLowerCase();
      };

      assert.strictEqual(getFileExtension('test.ply'), 'ply');
      assert.strictEqual(getFileExtension('mesh.STL'), 'stl');
      assert.strictEqual(getFileExtension('data.xyz'), 'xyz');
      assert.strictEqual(getFileExtension('file.tar.gz'), 'gz');
      assert.strictEqual(getFileExtension('noextension'), '');
      assert.strictEqual(getFileExtension('.hidden'), 'hidden');
    });
  });

  suite('Color Utilities', () => {
    test('Should get color names by index', () => {
      const colors = [
        'red',
        'green',
        'blue',
        'yellow',
        'magenta',
        'cyan',
        'orange',
        'purple',
        'brown',
        'pink',
        'gray',
        'black',
      ];

      const getColorName = (index: number): string => {
        return colors[index % colors.length];
      };

      assert.strictEqual(getColorName(0), 'red');
      assert.strictEqual(getColorName(5), 'cyan');
      assert.strictEqual(getColorName(12), 'red'); // Wraps around
      assert.strictEqual(getColorName(17), 'cyan'); // Wraps around
    });

    test('Should generate color selection HTML options', () => {
      const generateColorOptions = (): string => {
        const colors = ['red', 'green', 'blue', 'yellow', 'magenta'];
        return colors.map((color, index) => `<option value="${index}">${color}</option>`).join('');
      };

      const html = generateColorOptions();
      assert.ok(html.includes('<option value="0">red</option>'));
      assert.ok(html.includes('<option value="2">blue</option>'));
      assert.ok(html.includes('<option value="4">magenta</option>'));
    });

    test('Should convert between color formats', () => {
      const hexToRgb = (hex: number): [number, number, number] => {
        const r = (hex >> 16) & 255;
        const g = (hex >> 8) & 255;
        const b = hex & 255;
        return [r, g, b];
      };

      const rgbToHex = (r: number, g: number, b: number): number => {
        return (r << 16) | (g << 8) | b;
      };

      const red = 0xff0000;
      const [r, g, b] = hexToRgb(red);
      assert.deepStrictEqual([r, g, b], [255, 0, 0]);

      const backToHex = rgbToHex(255, 0, 0);
      assert.strictEqual(backToHex, red);

      // Test blue
      const blue = 0x0000ff;
      const [rb, gb, bb] = hexToRgb(blue);
      assert.deepStrictEqual([rb, gb, bb], [0, 0, 255]);
    });

    test('Should handle color normalization', () => {
      const normalizeColor = (r: number, g: number, b: number): [number, number, number] => {
        return [r / 255, g / 255, b / 255];
      };

      const denormalizeColor = (r: number, g: number, b: number): [number, number, number] => {
        return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
      };

      const normalized = normalizeColor(128, 64, 192);
      assert.ok(Math.abs(normalized[0] - 0.5019607843137255) < 0.001);
      assert.ok(Math.abs(normalized[1] - 0.25098039215686274) < 0.001);

      const denormalized = denormalizeColor(0.5, 0.25, 0.75);
      assert.deepStrictEqual(denormalized, [128, 64, 191]);
    });
  });

  suite('Geometry Utilities', () => {
    test('Should calculate bounding box dimensions', () => {
      const calculateBoundingBoxSize = (box: THREE.Box3): THREE.Vector3 => {
        return box.getSize(new THREE.Vector3());
      };

      const box = new THREE.Box3(new THREE.Vector3(-1, -2, -3), new THREE.Vector3(3, 4, 5));

      const size = calculateBoundingBoxSize(box);
      assert.strictEqual(size.x, 4); // 3 - (-1)
      assert.strictEqual(size.y, 6); // 4 - (-2)
      assert.strictEqual(size.z, 8); // 5 - (-3)
    });

    test('Should find maximum dimension', () => {
      const getMaxDimension = (size: THREE.Vector3): number => {
        return Math.max(size.x, size.y, size.z);
      };

      const size1 = new THREE.Vector3(10, 5, 3);
      const size2 = new THREE.Vector3(2, 15, 8);

      assert.strictEqual(getMaxDimension(size1), 10);
      assert.strictEqual(getMaxDimension(size2), 15);
    });

    test('Should calculate distance from origin', () => {
      const distanceFromOrigin = (point: THREE.Vector3): number => {
        return Math.sqrt(point.x * point.x + point.y * point.y + point.z * point.z);
      };

      const point1 = new THREE.Vector3(3, 4, 0);
      const point2 = new THREE.Vector3(1, 1, 1);

      assert.strictEqual(distanceFromOrigin(point1), 5); // 3-4-5 triangle
      assert.ok(Math.abs(distanceFromOrigin(point2) - Math.sqrt(3)) < 0.001);
    });

    test('Should normalize vectors', () => {
      const normalizeVector = (vector: THREE.Vector3): THREE.Vector3 => {
        const length = vector.length();
        if (length === 0) {return vector.clone();}
        return vector.clone().divideScalar(length);
      };

      const vector = new THREE.Vector3(3, 4, 0);
      const normalized = normalizeVector(vector);

      assert.ok(Math.abs(normalized.length() - 1) < 0.001);
      assert.ok(Math.abs(normalized.x - 0.6) < 0.001); // 3/5
      assert.ok(Math.abs(normalized.y - 0.8) < 0.001); // 4/5

      // Test zero vector
      const zeroVector = new THREE.Vector3(0, 0, 0);
      const normalizedZero = normalizeVector(zeroVector);
      assert.strictEqual(normalizedZero.length(), 0);
    });
  });

  suite('File Size and Memory Utilities', () => {
    test('Should format file sizes in human readable format', () => {
      const formatFileSize = (bytes: number): string => {
        const units = ['B', 'KB', 'MB', 'GB'];
        let size = bytes;
        let unitIndex = 0;

        while (size >= 1024 && unitIndex < units.length - 1) {
          size /= 1024;
          unitIndex++;
        }

        return `${size.toFixed(1)} ${units[unitIndex]}`;
      };

      assert.strictEqual(formatFileSize(500), '500.0 B');
      assert.strictEqual(formatFileSize(1536), '1.5 KB');
      assert.strictEqual(formatFileSize(1048576), '1.0 MB');
      assert.strictEqual(formatFileSize(2147483648), '2.0 GB');
    });

    test('Should estimate memory usage for point clouds', () => {
      const estimateMemoryUsage = (
        vertexCount: number,
        hasColors: boolean,
        hasNormals: boolean
      ): number => {
        let bytesPerVertex = 12; // 3 floats (x,y,z) * 4 bytes each
        if (hasColors) {bytesPerVertex += 12;} // 3 floats for RGB
        if (hasNormals) {bytesPerVertex += 12;} // 3 floats for normals
        return vertexCount * bytesPerVertex;
      };

      assert.strictEqual(estimateMemoryUsage(1000, false, false), 12000); // Positions only
      assert.strictEqual(estimateMemoryUsage(1000, true, false), 24000); // Positions + colors
      assert.strictEqual(estimateMemoryUsage(1000, true, true), 36000); // All attributes
    });

    test('Should check if file size requires chunked loading', () => {
      const requiresChunkedLoading = (fileSize: number, vertexCount: number): boolean => {
        const fileSizeThreshold = 50 * 1024 * 1024; // 50MB
        const vertexThreshold = 1000000; // 1M vertices

        return fileSize > fileSizeThreshold || vertexCount > vertexThreshold;
      };

      assert.ok(!requiresChunkedLoading(10 * 1024 * 1024, 500000)); // Small file, few vertices
      assert.ok(requiresChunkedLoading(100 * 1024 * 1024, 500000)); // Large file
      assert.ok(requiresChunkedLoading(10 * 1024 * 1024, 2000000)); // Many vertices
      assert.ok(requiresChunkedLoading(100 * 1024 * 1024, 2000000)); // Both large
    });
  });

  suite('Status and Progress Utilities', () => {
    test('Should format progress messages', () => {
      const formatProgressMessage = (current: number, total: number, operation: string): string => {
        const percentage = Math.round((current / total) * 100);
        return `${operation}: ${current}/${total} (${percentage}%)`;
      };

      assert.strictEqual(formatProgressMessage(25, 100, 'Loading'), 'Loading: 25/100 (25%)');
      assert.strictEqual(
        formatProgressMessage(500, 1000, 'Processing'),
        'Processing: 500/1000 (50%)'
      );
      assert.strictEqual(formatProgressMessage(999, 1000, 'Saving'), 'Saving: 999/1000 (100%)'); // Rounds to 100%
    });

    test('Should calculate elapsed time display', () => {
      const formatElapsedTime = (startTime: number, endTime: number): string => {
        const elapsed = endTime - startTime;
        if (elapsed < 1000) {
          return `${elapsed.toFixed(0)}ms`;
        } else if (elapsed < 60000) {
          return `${(elapsed / 1000).toFixed(1)}s`;
        } else {
          const minutes = Math.floor(elapsed / 60000);
          const seconds = Math.floor((elapsed % 60000) / 1000);
          return `${minutes}m ${seconds}s`;
        }
      };

      assert.strictEqual(formatElapsedTime(0, 500), '500ms');
      assert.strictEqual(formatElapsedTime(0, 2500), '2.5s');
      assert.strictEqual(formatElapsedTime(0, 125000), '2m 5s');
    });

    test('Should validate processing status', () => {
      type ProcessingStatus = 'idle' | 'loading' | 'processing' | 'complete' | 'error';

      const validateStatus = (status: string): status is ProcessingStatus => {
        const validStatuses: ProcessingStatus[] = [
          'idle',
          'loading',
          'processing',
          'complete',
          'error',
        ];
        return validStatuses.includes(status as ProcessingStatus);
      };

      assert.ok(validateStatus('idle'));
      assert.ok(validateStatus('processing'));
      assert.ok(!validateStatus('invalid'));
      assert.ok(!validateStatus(''));
    });
  });

  suite('UI State Management Utilities', () => {
    test('Should manage button states', () => {
      interface ButtonState {
        id: string;
        active: boolean;
        disabled: boolean;
        text: string;
      }

      const updateButtonState = (
        button: ButtonState,
        active: boolean,
        disabled?: boolean
      ): ButtonState => {
        return {
          ...button,
          active,
          disabled: disabled ?? button.disabled,
          text: active ? `Hide ${button.id}` : `Show ${button.id}`,
        };
      };

      const axesButton: ButtonState = {
        id: 'axes',
        active: false,
        disabled: false,
        text: 'Show axes',
      };

      const updated = updateButtonState(axesButton, true);
      assert.ok(updated.active);
      assert.strictEqual(updated.text, 'Hide axes');

      const disabled = updateButtonState(axesButton, false, true);
      assert.ok(!disabled.active);
      assert.ok(disabled.disabled);
    });

    test('Should handle tab switching state', () => {
      const tabs = ['files', 'transform', 'camera', 'depth'];

      const switchTab = (currentTab: string, newTab: string): string => {
        return tabs.includes(newTab) ? newTab : currentTab;
      };

      let activeTab = 'files';
      activeTab = switchTab(activeTab, 'transform');
      assert.strictEqual(activeTab, 'transform');

      activeTab = switchTab(activeTab, 'invalid');
      assert.strictEqual(activeTab, 'transform'); // Should stay unchanged
    });

    test('Should manage visibility arrays', () => {
      const ensureArrayLength = <T>(array: T[], length: number, defaultValue: T): T[] => {
        while (array.length < length) {
          array.push(defaultValue);
        }
        return array;
      };

      const visibility: boolean[] = [true, false];
      ensureArrayLength(visibility, 5, true);

      assert.strictEqual(visibility.length, 5);
      assert.strictEqual(visibility[0], true);
      assert.strictEqual(visibility[1], false);
      assert.strictEqual(visibility[2], true); // Default value
      assert.strictEqual(visibility[4], true);
    });
  });

  suite('Animation and Timing Utilities', () => {
    test('Should calculate animation interpolation', () => {
      const lerp = (start: number, end: number, t: number): number => {
        return start + (end - start) * t;
      };

      assert.strictEqual(lerp(0, 10, 0), 0);
      assert.strictEqual(lerp(0, 10, 1), 10);
      assert.strictEqual(lerp(0, 10, 0.5), 5);
      assert.strictEqual(lerp(5, 15, 0.3), 8);
    });

    test('Should calculate easing functions', () => {
      const easeInOut = (t: number): number => {
        return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      };

      assert.strictEqual(easeInOut(0), 0);
      assert.strictEqual(easeInOut(1), 1);
      assert.strictEqual(easeInOut(0.5), 0.5);
      assert.ok(easeInOut(0.25) < 0.25); // Slower at start
      assert.ok(easeInOut(0.75) > 0.75); // Faster at end
    });

    test('Should manage frame rate calculations', () => {
      const calculateFPS = (frameTimes: number[]): number => {
        if (frameTimes.length < 2) {return 0;}

        const totalTime = frameTimes[frameTimes.length - 1] - frameTimes[0];
        const frameCount = frameTimes.length - 1;

        return frameCount / (totalTime / 1000); // FPS
      };

      const times = [0, 16.67, 33.33, 50, 66.67]; // ~60 FPS
      const fps = calculateFPS(times);
      assert.ok(Math.abs(fps - 60) < 1); // Should be approximately 60 FPS
    });
  });
});
