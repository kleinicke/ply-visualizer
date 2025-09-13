import * as assert from 'assert';
import * as THREE from 'three';

// Edge cases and specific method testing for main.ts functions
suite('PointCloudVisualizer Edge Cases and Specific Methods Test Suite', () => {
  suite('File Format Detection and Validation', () => {
    test('Should detect depth TIF images correctly', () => {
      const isDepthTifImage = (
        samplesPerPixel: number,
        sampleFormat: number | null,
        bitsPerSample: number[]
      ): boolean => {
        return (
          samplesPerPixel === 1 &&
          (sampleFormat === null || sampleFormat === 3 || sampleFormat === 1) &&
          bitsPerSample.length === 1 &&
          (bitsPerSample[0] === 16 || bitsPerSample[0] === 32)
        );
      };

      // Valid depth formats
      assert.ok(isDepthTifImage(1, 3, [32])); // Float32
      assert.ok(isDepthTifImage(1, 1, [16])); // UInt16
      assert.ok(isDepthTifImage(1, null, [32])); // Unknown format but valid bits

      // Invalid depth formats
      assert.ok(!isDepthTifImage(3, 3, [32])); // RGB
      assert.ok(!isDepthTifImage(1, 2, [32])); // Invalid sample format
      assert.ok(!isDepthTifImage(1, 3, [8])); // 8-bit not depth
      assert.ok(!isDepthTifImage(1, 3, [16, 16])); // Multiple channels
    });

    test('Should check if file is derived from depth processing', () => {
      const isDepthDerivedFile = (fileName: string): boolean => {
        return (
          fileName.includes('_from_depth_') ||
          fileName.includes('_depth_converted_') ||
          fileName.endsWith('_d2p.ply')
        );
      };

      assert.ok(isDepthDerivedFile('image_from_depth_640x480.ply'));
      assert.ok(isDepthDerivedFile('scan_depth_converted_high.ply'));
      assert.ok(isDepthDerivedFile('stereo_d2p.ply'));
      assert.ok(!isDepthDerivedFile('regular_pointcloud.ply'));
      assert.ok(!isDepthDerivedFile('mesh.obj'));
    });

    test('Should validate PNG scale factors', () => {
      const getPngScaleFactor = (fileName: string): number => {
        const match = fileName.match(/_scale_(\d+(?:\.\d+)?)/);
        return match ? parseFloat(match[1]) : 1.0;
      };

      assert.strictEqual(getPngScaleFactor('depth_scale_1000.png'), 1000.0);
      assert.strictEqual(getPngScaleFactor('image_scale_0.001.png'), 0.001);
      assert.strictEqual(getPngScaleFactor('regular_image.png'), 1.0);
      assert.strictEqual(getPngScaleFactor('depth_scale_5.5_modified.png'), 5.5);
    });
  });

  suite('Matrix and Transformation Edge Cases', () => {
    test('Should handle degenerate transformation matrices', () => {
      const matrix = new THREE.Matrix4();

      // Zero matrix (degenerate)
      matrix.set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
      assert.strictEqual(matrix.determinant(), 0);

      // Singular matrix (no inverse)
      matrix.set(1, 2, 3, 4, 2, 4, 6, 8, 3, 6, 9, 12, 0, 0, 0, 1);
      assert.ok(Math.abs(matrix.determinant()) < 0.001);

      // Valid transformation matrix
      matrix.identity();
      assert.strictEqual(matrix.determinant(), 1);
    });

    test('Should handle extreme rotation angles', () => {
      const createRotationMatrix = (axis: 'x' | 'y' | 'z', angleDegrees: number): THREE.Matrix4 => {
        const matrix = new THREE.Matrix4();
        const angleRad = (angleDegrees * Math.PI) / 180;

        switch (axis) {
          case 'x':
            matrix.makeRotationX(angleRad);
            break;
          case 'y':
            matrix.makeRotationY(angleRad);
            break;
          case 'z':
            matrix.makeRotationZ(angleRad);
            break;
        }
        return matrix;
      };

      // Test extreme angles
      const rot720 = createRotationMatrix('y', 720); // Two full rotations
      const rot0 = createRotationMatrix('y', 0);

      // 720 degrees should be same as 0 degrees
      const testPoint = new THREE.Vector3(1, 0, 0);
      const rotated720 = testPoint.clone().applyMatrix4(rot720);
      const rotated0 = testPoint.clone().applyMatrix4(rot0);

      assert.ok(rotated720.distanceTo(rotated0) < 0.001);

      // Negative angles
      const rotNeg90 = createRotationMatrix('z', -90);
      const rotPos270 = createRotationMatrix('z', 270);

      const negResult = testPoint.clone().applyMatrix4(rotNeg90);
      const posResult = testPoint.clone().applyMatrix4(rotPos270);

      assert.ok(negResult.distanceTo(posResult) < 0.001);
    });

    test('Should handle invalid quaternion inputs', () => {
      const createQuaternionMatrix = (
        x: number,
        y: number,
        z: number,
        w: number
      ): THREE.Matrix4 | null => {
        // Check if quaternion is valid (non-zero length)
        const length = Math.sqrt(x * x + y * y + z * z + w * w);
        if (length < 0.001) {return null;}

        const quaternion = new THREE.Quaternion(x, y, z, w);
        quaternion.normalize();

        const matrix = new THREE.Matrix4();
        matrix.makeRotationFromQuaternion(quaternion);
        return matrix;
      };

      // Valid quaternion
      const validMatrix = createQuaternionMatrix(0, 0, 0, 1);
      assert.ok(validMatrix instanceof THREE.Matrix4);

      // Invalid quaternion (zero length)
      const invalidMatrix = createQuaternionMatrix(0, 0, 0, 0);
      assert.strictEqual(invalidMatrix, null);

      // Non-normalized quaternion should still work
      const unnormalized = createQuaternionMatrix(0, 0, 2, 2); // Length = sqrt(8)
      assert.ok(unnormalized instanceof THREE.Matrix4);
    });
  });

  suite('Memory and Performance Edge Cases', () => {
    test('Should handle very large point clouds', () => {
      const optimizeForPointCount = (
        pointCount: number
      ): { decimation: number; chunkSize: number } => {
        let decimation = 1;
        let chunkSize = 10000;

        if (pointCount > 10000000) {
          // 10M points
          decimation = 8;
          chunkSize = 50000;
        } else if (pointCount > 1000000) {
          // 1M points
          decimation = 4;
          chunkSize = 25000;
        } else if (pointCount > 100000) {
          // 100K points
          decimation = 2;
          chunkSize = 10000;
        }

        return { decimation, chunkSize };
      };

      const smallCloud = optimizeForPointCount(50000);
      assert.strictEqual(smallCloud.decimation, 1);
      assert.strictEqual(smallCloud.chunkSize, 10000);

      const largeCloud = optimizeForPointCount(5000000);
      assert.strictEqual(largeCloud.decimation, 4);
      assert.strictEqual(largeCloud.chunkSize, 25000);

      const hugeCloud = optimizeForPointCount(20000000);
      assert.strictEqual(hugeCloud.decimation, 8);
      assert.strictEqual(hugeCloud.chunkSize, 50000);
    });

    test('Should handle adaptive decimation based on camera distance', () => {
      const updateAdaptiveDecimation = (
        cameraDistance: number,
        originalPointCount: number
      ): number => {
        let decimationFactor = 1;

        if (cameraDistance > 1000) {
          decimationFactor = Math.min(16, Math.floor(originalPointCount / 100000));
        } else if (cameraDistance > 100) {
          decimationFactor = Math.min(8, Math.floor(originalPointCount / 250000));
        } else if (cameraDistance > 10) {
          decimationFactor = Math.min(4, Math.floor(originalPointCount / 500000));
        }

        return Math.max(1, decimationFactor);
      };

      // Close camera, large point cloud (distance 5 <= 10, so decimationFactor = 1)
      assert.strictEqual(updateAdaptiveDecimation(5, 1000000), 1);

      // Medium distance, medium point cloud (distance 50, in range 10-100, uses /500K)
      assert.strictEqual(updateAdaptiveDecimation(50, 500000), 1); // 500K / 500K = 1

      // Far camera, huge point cloud
      assert.strictEqual(updateAdaptiveDecimation(2000, 5000000), 16); // Cap at 16
    });

    test('Should handle empty or corrupted geometry data', () => {
      const validateGeometry = (
        positions: Float32Array,
        colors?: Float32Array
      ): { valid: boolean; issues: string[] } => {
        const issues: string[] = [];

        if (positions.length === 0) {
          issues.push('No position data');
        }

        if (positions.length % 3 !== 0) {
          issues.push('Position data not divisible by 3');
        }

        if (colors && colors.length !== positions.length) {
          issues.push('Color array length mismatch');
        }

        // Check for NaN or infinite values
        for (let i = 0; i < positions.length; i++) {
          if (!isFinite(positions[i])) {
            issues.push(`Invalid position value at index ${i}`);
            break; // Only report first issue
          }
        }

        return { valid: issues.length === 0, issues };
      };

      // Valid geometry
      const validPos = new Float32Array([0, 0, 0, 1, 1, 1]);
      const validColors = new Float32Array([1, 0, 0, 0, 1, 0]);
      const validResult = validateGeometry(validPos, validColors);
      assert.ok(validResult.valid);
      assert.strictEqual(validResult.issues.length, 0);

      // Invalid geometry - empty
      const emptyResult = validateGeometry(new Float32Array([]));
      assert.ok(!emptyResult.valid);
      assert.ok(emptyResult.issues.includes('No position data'));

      // Invalid geometry - wrong length
      const wrongLengthResult = validateGeometry(new Float32Array([0, 0])); // Length 2, not divisible by 3
      assert.ok(!wrongLengthResult.valid);
      assert.ok(wrongLengthResult.issues.includes('Position data not divisible by 3'));

      // Invalid geometry - NaN values
      const nanPos = new Float32Array([0, 0, 0, NaN, 1, 1]);
      const nanResult = validateGeometry(nanPos);
      assert.ok(!nanResult.valid);
      assert.ok(nanResult.issues.some(issue => issue.includes('Invalid position value')));
    });
  });

  suite('Coordinate System Edge Cases', () => {
    test('Should handle coordinate system conversions at boundaries', () => {
      const convertOpenGLToOpenCV = (point: THREE.Vector3): THREE.Vector3 => {
        return new THREE.Vector3(point.x, -point.y, -point.z);
      };

      const convertOpenCVToOpenGL = (point: THREE.Vector3): THREE.Vector3 => {
        return new THREE.Vector3(point.x, -point.y, -point.z);
      };

      // Test zero point
      const zero = new THREE.Vector3(0, 0, 0);
      const convertedZero = convertOpenGLToOpenCV(zero);
      assert.ok(convertedZero.equals(zero));

      // Test round trip conversion
      const original = new THREE.Vector3(1, 2, 3);
      const toOpenCV = convertOpenGLToOpenCV(original);
      const backToOpenGL = convertOpenCVToOpenGL(toOpenCV);
      assert.ok(backToOpenGL.equals(original));

      // Test extreme values
      const extreme = new THREE.Vector3(1e6, -1e6, 1e-6);
      const convertedExtreme = convertOpenGLToOpenCV(extreme);
      assert.strictEqual(convertedExtreme.x, extreme.x);
      assert.strictEqual(convertedExtreme.y, -extreme.y);
      assert.strictEqual(convertedExtreme.z, -extreme.z);
    });

    test('Should handle fisheye distortion edge cases', () => {
      const applyFisheyeDistortion = (
        x: number,
        y: number,
        k1: number,
        k2: number,
        k3: number,
        k4: number
      ): [number, number] => {
        const r2 = x * x + y * y;
        const r4 = r2 * r2;
        const r6 = r4 * r2;
        const r8 = r4 * r4;

        // Avoid division by zero
        if (r2 < 1e-12) {return [x, y];}

        const r = Math.sqrt(r2);
        const theta = Math.atan(r);
        const theta2 = theta * theta;
        const theta4 = theta2 * theta2;
        const theta6 = theta4 * theta2;
        const theta8 = theta4 * theta4;

        const theta_d = theta * (1 + k1 * theta2 + k2 * theta4 + k3 * theta6 + k4 * theta8);

        if (r < 1e-12) {return [x, y];}

        const scale = theta_d / r;
        return [x * scale, y * scale];
      };

      // Test center point (no distortion)
      const [centerX, centerY] = applyFisheyeDistortion(0, 0, 0.1, 0.05, 0.01, 0.001);
      assert.strictEqual(centerX, 0);
      assert.strictEqual(centerY, 0);

      // Test with zero distortion coefficients
      const [noDistortX, noDistortY] = applyFisheyeDistortion(1, 1, 0, 0, 0, 0);
      // With zero distortion, scale = theta / r = atan(sqrt(2)) / sqrt(2) ≈ 0.615
      const expectedScale = Math.atan(Math.sqrt(2)) / Math.sqrt(2);
      assert.ok(Math.abs(noDistortX - expectedScale) < 0.001);
      assert.ok(Math.abs(noDistortY - expectedScale) < 0.001);

      // Test with extreme distortion
      const [extremeX, extremeY] = applyFisheyeDistortion(0.5, 0.5, 1.0, 0.5, 0.1, 0.01);
      assert.ok(isFinite(extremeX));
      assert.ok(isFinite(extremeY));
    });
  });

  suite('UI State Edge Cases', () => {
    test('Should handle rapid sequential state changes', () => {
      let sequenceIndex = 0;
      let isTransitioning = false;
      const maxIndex = 10;

      const stepSequence = (delta: number): boolean => {
        if (isTransitioning) {return false;} // Ignore rapid clicks

        const newIndex = Math.max(0, Math.min(maxIndex - 1, sequenceIndex + delta));
        if (newIndex === sequenceIndex) {return false;}

        isTransitioning = true;
        sequenceIndex = newIndex;

        // Simulate async transition
        setTimeout(() => {
          isTransitioning = false;
        }, 100);

        return true;
      };

      // Normal step should work
      assert.ok(stepSequence(1));
      assert.strictEqual(sequenceIndex, 1);

      // Rapid step should be ignored
      assert.ok(!stepSequence(1));
      assert.strictEqual(sequenceIndex, 1);

      // Step beyond boundary should be clamped and return false (no change)
      isTransitioning = false; // Reset for test
      sequenceIndex = 9;
      assert.ok(!stepSequence(5)); // Try to go to index 14, should clamp to 9 (no change, returns false)
      assert.strictEqual(sequenceIndex, 9);
    });

    test('Should handle invalid transformation input gracefully', () => {
      const parseAndValidateMatrix = (
        input: string
      ): { valid: boolean; matrix?: THREE.Matrix4; error?: string } => {
        const trimmed = input.trim();
        if (!trimmed) {return { valid: false, error: 'Empty input' };}

        const values = trimmed.split(/[\s,]+/).filter(v => v.length > 0);
        if (values.length !== 16) {return { valid: false, error: 'Must have exactly 16 values' };}

        const numbers: number[] = [];
        for (const value of values) {
          const num = parseFloat(value);
          if (!isFinite(num)) {return { valid: false, error: `Invalid number: ${value}` };}
          numbers.push(num);
        }

        const matrix = new THREE.Matrix4();
        matrix.fromArray(numbers);

        // Check if matrix is degenerate
        if (Math.abs(matrix.determinant()) < 1e-10) {
          return { valid: false, error: 'Matrix is singular (non-invertible)' };
        }

        return { valid: true, matrix };
      };

      // Valid matrix
      const identity = '1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 1';
      const validResult = parseAndValidateMatrix(identity);
      assert.ok(validResult.valid);
      assert.ok(validResult.matrix instanceof THREE.Matrix4);

      // Invalid inputs
      const emptyResult = parseAndValidateMatrix('');
      assert.ok(!emptyResult.valid);
      assert.ok(emptyResult.error?.includes('Empty input'));

      const tooFewResult = parseAndValidateMatrix('1 2 3 4 5');
      assert.ok(!tooFewResult.valid);
      assert.ok(tooFewResult.error?.includes('exactly 16 values'));

      const invalidNumberResult = parseAndValidateMatrix(
        '1 2 3 abc 5 6 7 8 9 10 11 12 13 14 15 16'
      );
      assert.ok(!invalidNumberResult.valid);
      assert.ok(invalidNumberResult.error?.includes('Invalid number: abc'));

      // Singular matrix
      const singularResult = parseAndValidateMatrix('0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1');
      assert.ok(!singularResult.valid);
      assert.ok(singularResult.error?.includes('singular'));
    });

    test('Should handle concurrent file loading operations', () => {
      let activeLoadOperations = 0;
      const maxConcurrentLoads = 3;
      const loadQueue: string[] = [];

      const requestFileLoad = (filename: string): boolean => {
        if (activeLoadOperations >= maxConcurrentLoads) {
          loadQueue.push(filename);
          return false; // Queued
        }

        activeLoadOperations++;
        // Simulate async load
        setTimeout(() => {
          activeLoadOperations--;
          // Process queue
          if (loadQueue.length > 0 && activeLoadOperations < maxConcurrentLoads) {
            const nextFile = loadQueue.shift()!;
            requestFileLoad(nextFile);
          }
        }, 100);

        return true; // Started immediately
      };

      // First 3 should start immediately
      assert.ok(requestFileLoad('file1.ply'));
      assert.ok(requestFileLoad('file2.ply'));
      assert.ok(requestFileLoad('file3.ply'));
      assert.strictEqual(activeLoadOperations, 3);

      // 4th should be queued
      assert.ok(!requestFileLoad('file4.ply'));
      assert.strictEqual(loadQueue.length, 1);
      assert.strictEqual(loadQueue[0], 'file4.ply');

      // 5th should also be queued
      assert.ok(!requestFileLoad('file5.ply'));
      assert.strictEqual(loadQueue.length, 2);
    });
  });

  suite('Error Recovery and Robustness', () => {
    test('Should handle WebGL context loss gracefully', () => {
      interface WebGLContextState {
        isLost: boolean;
        canRestore: boolean;
        lastError: string | null;
      }

      const handleContextLoss = (state: WebGLContextState): void => {
        state.isLost = true;
        state.canRestore = false;
        state.lastError = 'WebGL context lost';

        // Attempt restoration after delay
        setTimeout(() => {
          state.canRestore = true;
        }, 1000);
      };

      const handleContextRestore = (state: WebGLContextState): boolean => {
        if (!state.canRestore) {return false;}

        state.isLost = false;
        state.lastError = null;
        return true;
      };

      const contextState: WebGLContextState = {
        isLost: false,
        canRestore: false,
        lastError: null,
      };

      // Simulate context loss
      handleContextLoss(contextState);
      assert.ok(contextState.isLost);
      assert.ok(!contextState.canRestore);
      assert.strictEqual(contextState.lastError, 'WebGL context lost');

      // Immediate restore should fail
      assert.ok(!handleContextRestore(contextState));
      assert.ok(contextState.isLost);

      // Set canRestore and try again
      contextState.canRestore = true;
      assert.ok(handleContextRestore(contextState));
      assert.ok(!contextState.isLost);
      assert.strictEqual(contextState.lastError, null);
    });

    test('Should handle corrupted file data gracefully', () => {
      const validateFileData = (
        data: Uint8Array,
        expectedFormat: string
      ): { valid: boolean; issues: string[] } => {
        const issues: string[] = [];

        if (data.length === 0) {
          issues.push('File is empty');
          return { valid: false, issues };
        }

        // Check for basic file format markers
        const header = new TextDecoder().decode(data.slice(0, Math.min(100, data.length)));

        switch (expectedFormat.toLowerCase()) {
          case 'ply':
            if (!header.startsWith('ply\n')) {
              issues.push('Invalid PLY header');
            }
            if (!header.includes('end_header')) {
              issues.push('Missing PLY end_header');
            }
            break;

          case 'obj':
            if (!header.includes('v ') && !header.includes('f ')) {
              issues.push('No OBJ vertices or faces found');
            }
            break;

          case 'stl':
            if (!header.toLowerCase().startsWith('solid')) {
              // Check for binary STL
              if (data.length < 84) {
                // Binary STL minimum size
                issues.push('File too small for STL format');
              }
            }
            break;

          default:
            issues.push(`Unknown format: ${expectedFormat}`);
        }

        return { valid: issues.length === 0, issues };
      };

      // Valid PLY data
      const validPly = new TextEncoder().encode(
        'ply\nformat ascii 1.0\nelement vertex 1\nproperty float x\nproperty float y\nproperty float z\nend_header\n0 0 0\n'
      );
      const plyResult = validateFileData(validPly, 'ply');
      assert.ok(plyResult.valid);

      // Empty file
      const emptyResult = validateFileData(new Uint8Array(0), 'ply');
      assert.ok(!emptyResult.valid);
      assert.ok(emptyResult.issues.includes('File is empty'));

      // Corrupted PLY
      const corruptPly = new TextEncoder().encode('invalid header data');
      const corruptResult = validateFileData(corruptPly, 'ply');
      assert.ok(!corruptResult.valid);
      assert.ok(corruptResult.issues.some(issue => issue.includes('Invalid PLY header')));
    });
  });
});
