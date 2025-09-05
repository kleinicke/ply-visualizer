import * as assert from 'assert';
import * as THREE from 'three';

// Since we can't directly import the main class due to DOM dependencies,
// we'll create a testable version with extracted utility methods
class PointCloudVisualizerTestUtils {
    
    // Extracted from ensureSrgbLUT method
    static createSrgbToLinearLUT(): number[] {
        const lut = new Array(256);
        for (let i = 0; i < 256; i++) {
            const normalized = i / 255;
            // sRGB to linear conversion
            if (normalized <= 0.04045) {
                lut[i] = normalized / 12.92;
            } else {
                lut[i] = Math.pow((normalized + 0.055) / 1.055, 2.4);
            }
        }
        return lut;
    }

    // Extracted from createRotationMatrix method
    static createRotationMatrix(axis: 'x' | 'y' | 'z', angle: number): THREE.Matrix4 {
        const radians = (angle * Math.PI) / 180;
        const matrix = new THREE.Matrix4();
        
        if (axis === 'x') {
            matrix.makeRotationX(radians);
        } else if (axis === 'y') {
            matrix.makeRotationY(radians);
        } else if (axis === 'z') {
            matrix.makeRotationZ(radians);
        }
        
        return matrix;
    }

    // Extracted from createTranslationMatrix method
    static createTranslationMatrix(x: number, y: number, z: number): THREE.Matrix4 {
        const matrix = new THREE.Matrix4();
        matrix.makeTranslation(x, y, z);
        return matrix;
    }

    // Extracted from createQuaternionMatrix method
    static createQuaternionMatrix(x: number, y: number, z: number, w: number): THREE.Matrix4 {
        const quaternion = new THREE.Quaternion(x, y, z, w);
        quaternion.normalize();
        const matrix = new THREE.Matrix4();
        matrix.makeRotationFromQuaternion(quaternion);
        return matrix;
    }

    // Extracted from createAngleAxisMatrix method
    static createAngleAxisMatrix(axis: THREE.Vector3, angle: number): THREE.Matrix4 {
        const normalizedAxis = axis.clone().normalize();
        const radians = (angle * Math.PI) / 180;
        const quaternion = new THREE.Quaternion();
        quaternion.setFromAxisAngle(normalizedAxis, radians);
        const matrix = new THREE.Matrix4();
        matrix.makeRotationFromQuaternion(quaternion);
        return matrix;
    }

    // Extracted from optimizeForPointCount method logic
    static getOptimalPointSize(pointCount: number): number {
        if (pointCount > 100000) {
            return 1.0; // Smaller points for very large datasets
        } else if (pointCount > 50000) {
            return 1.5; // Medium points for large datasets
        } else {
            return 2.0; // Default point size
        }
    }

    // Extracted from decimation logic
    static calculateDecimationFactor(cameraDistance: number): number {
        let decimationFactor = 1;
        if (cameraDistance > 100) decimationFactor = 20;     // Keep every 20th point
        else if (cameraDistance > 50) decimationFactor = 10; // Keep every 10th point
        else if (cameraDistance > 20) decimationFactor = 4;  // Keep every 4th point
        else if (cameraDistance > 10) decimationFactor = 2;  // Keep every 2nd point
        return decimationFactor;
    }

    // Matrix utilities for transformation testing
    static isMatrixIdentity(matrix: THREE.Matrix4): boolean {
        const identity = new THREE.Matrix4();
        return matrix.equals(identity);
    }

    static matrixToArray(matrix: THREE.Matrix4): number[] {
        return matrix.elements.slice();
    }

    static arrayToMatrix(array: number[]): THREE.Matrix4 {
        if (array.length !== 16) {
            throw new Error('Array must have exactly 16 elements for 4x4 matrix');
        }
        const matrix = new THREE.Matrix4();
        matrix.fromArray(array);
        return matrix;
    }

    // Extracted from color processing logic
    static validateColorArray(colors: number[]): boolean {
        if (colors.length % 3 !== 0) return false;
        for (let i = 0; i < colors.length; i++) {
            if (colors[i] < 0 || colors[i] > 1) return false;
        }
        return true;
    }

    // Sequence mode utilities
    static calculateSequenceIndex(currentIndex: number, totalFiles: number, direction: 'forward' | 'backward'): number {
        if (direction === 'forward') {
            return (currentIndex + 1) % totalFiles;
        } else {
            return (currentIndex - 1 + totalFiles) % totalFiles;
        }
    }

    static clampSequenceIndex(index: number, totalFiles: number): number {
        return Math.max(0, Math.min(index, totalFiles - 1));
    }

    // Camera parameter validation
    static validateCameraParams(params: {fx: number, fy: number, cx: number, cy: number}): boolean {
        return params.fx > 0 && params.fy > 0 && params.cx >= 0 && params.cy >= 0;
    }

    // Depth value processing
    static normalizeDepthValue(depth: number, minDepth: number, maxDepth: number): number {
        if (maxDepth <= minDepth) return 0;
        return (depth - minDepth) / (maxDepth - minDepth);
    }
}

suite('Point Cloud Visualizer Test Suite', () => {
    
    test('Should create correct sRGB to linear LUT', () => {
        const lut = PointCloudVisualizerTestUtils.createSrgbToLinearLUT();
        
        assert.strictEqual(lut.length, 256);
        assert.strictEqual(lut[0], 0); // Black should map to 0
        assert.ok(lut[255] > 0.9); // White should be close to 1
        
        // Test sRGB curve behavior
        assert.ok(lut[128] < 0.5); // Mid-gray should be less than 0.5 in linear space
        
        // Test monotonic increasing
        for (let i = 1; i < 256; i++) {
            assert.ok(lut[i] >= lut[i-1], `LUT should be monotonic increasing at index ${i}`);
        }
    });

    test('Should create correct rotation matrices', () => {
        // Test 90-degree rotations
        const rotX90 = PointCloudVisualizerTestUtils.createRotationMatrix('x', 90);
        const rotY90 = PointCloudVisualizerTestUtils.createRotationMatrix('y', 90);
        const rotZ90 = PointCloudVisualizerTestUtils.createRotationMatrix('z', 90);
        
        // Test that matrices are valid rotations (determinant should be 1)
        assert.ok(Math.abs(rotX90.determinant() - 1) < 0.0001);
        assert.ok(Math.abs(rotY90.determinant() - 1) < 0.0001);
        assert.ok(Math.abs(rotZ90.determinant() - 1) < 0.0001);
        
        // Test 0-degree rotation (should be identity)
        const rot0 = PointCloudVisualizerTestUtils.createRotationMatrix('x', 0);
        assert.ok(PointCloudVisualizerTestUtils.isMatrixIdentity(rot0));
        
        // Test 360-degree rotation (should be approximately identity due to floating point precision)
        const rot360 = PointCloudVisualizerTestUtils.createRotationMatrix('y', 360);
        const identity = new THREE.Matrix4();
        const elements1 = rot360.elements;
        const elements2 = identity.elements;
        let isApproximateIdentity = true;
        for (let i = 0; i < 16; i++) {
            if (Math.abs(elements1[i] - elements2[i]) > 0.0001) {
                isApproximateIdentity = false;
                break;
            }
        }
        assert.ok(isApproximateIdentity, '360-degree rotation should be approximately identity');
    });

    test('Should create correct translation matrices', () => {
        const trans = PointCloudVisualizerTestUtils.createTranslationMatrix(1, 2, 3);
        const elements = trans.elements;
        
        // Check translation components (Three.js uses column-major order)
        assert.strictEqual(elements[12], 1); // X translation
        assert.strictEqual(elements[13], 2); // Y translation
        assert.strictEqual(elements[14], 3); // Z translation
        
        // Test identity translation
        const identity = PointCloudVisualizerTestUtils.createTranslationMatrix(0, 0, 0);
        assert.ok(PointCloudVisualizerTestUtils.isMatrixIdentity(identity));
    });

    test('Should create correct quaternion matrices', () => {
        // Test identity quaternion
        const identityQuat = PointCloudVisualizerTestUtils.createQuaternionMatrix(0, 0, 0, 1);
        assert.ok(PointCloudVisualizerTestUtils.isMatrixIdentity(identityQuat));
        
        // Test 90-degree rotation around Z-axis
        const quatZ90 = PointCloudVisualizerTestUtils.createQuaternionMatrix(0, 0, Math.sin(Math.PI/4), Math.cos(Math.PI/4));
        assert.ok(Math.abs(quatZ90.determinant() - 1) < 0.0001);
        
        // Test normalization handling
        const unnormalized = PointCloudVisualizerTestUtils.createQuaternionMatrix(2, 0, 0, 2); // Should be normalized internally
        assert.ok(Math.abs(unnormalized.determinant() - 1) < 0.0001);
    });

    test('Should create correct angle-axis matrices', () => {
        const axis = new THREE.Vector3(0, 0, 1); // Z-axis
        const matrix = PointCloudVisualizerTestUtils.createAngleAxisMatrix(axis, 90);
        
        assert.ok(Math.abs(matrix.determinant() - 1) < 0.0001);
        
        // Test zero rotation
        const zeroRot = PointCloudVisualizerTestUtils.createAngleAxisMatrix(axis, 0);
        assert.ok(PointCloudVisualizerTestUtils.isMatrixIdentity(zeroRot));
        
        // Test axis normalization
        const unnormalizedAxis = new THREE.Vector3(0, 0, 10); // Should be normalized internally
        const normalizedMatrix = PointCloudVisualizerTestUtils.createAngleAxisMatrix(unnormalizedAxis, 45);
        assert.ok(Math.abs(normalizedMatrix.determinant() - 1) < 0.0001);
    });

    test('Should calculate optimal point sizes based on point count', () => {
        assert.strictEqual(PointCloudVisualizerTestUtils.getOptimalPointSize(1000), 2.0);
        assert.strictEqual(PointCloudVisualizerTestUtils.getOptimalPointSize(75000), 1.5);
        assert.strictEqual(PointCloudVisualizerTestUtils.getOptimalPointSize(200000), 1.0);
    });

    test('Should calculate correct decimation factors based on camera distance', () => {
        assert.strictEqual(PointCloudVisualizerTestUtils.calculateDecimationFactor(5), 1);
        assert.strictEqual(PointCloudVisualizerTestUtils.calculateDecimationFactor(15), 2);
        assert.strictEqual(PointCloudVisualizerTestUtils.calculateDecimationFactor(30), 4);
        assert.strictEqual(PointCloudVisualizerTestUtils.calculateDecimationFactor(75), 10);
        assert.strictEqual(PointCloudVisualizerTestUtils.calculateDecimationFactor(150), 20);
    });

    test('Should correctly identify identity matrices', () => {
        const identity = new THREE.Matrix4();
        assert.ok(PointCloudVisualizerTestUtils.isMatrixIdentity(identity));
        
        const nonIdentity = PointCloudVisualizerTestUtils.createTranslationMatrix(1, 0, 0);
        assert.ok(!PointCloudVisualizerTestUtils.isMatrixIdentity(nonIdentity));
    });

    test('Should convert matrices to and from arrays correctly', () => {
        const original = PointCloudVisualizerTestUtils.createRotationMatrix('x', 45);
        const array = PointCloudVisualizerTestUtils.matrixToArray(original);
        const restored = PointCloudVisualizerTestUtils.arrayToMatrix(array);
        
        assert.strictEqual(array.length, 16);
        assert.ok(original.equals(restored));
        
        // Test error handling for invalid array length
        assert.throws(() => {
            PointCloudVisualizerTestUtils.arrayToMatrix([1, 2, 3]);
        }, /Array must have exactly 16 elements/);
    });

    test('Should validate color arrays correctly', () => {
        // Valid color arrays
        assert.ok(PointCloudVisualizerTestUtils.validateColorArray([1, 0, 0])); // Red
        assert.ok(PointCloudVisualizerTestUtils.validateColorArray([0.5, 0.5, 0.5, 1, 1, 1])); // Two colors
        assert.ok(PointCloudVisualizerTestUtils.validateColorArray([])); // Empty array
        
        // Invalid color arrays
        assert.ok(!PointCloudVisualizerTestUtils.validateColorArray([1, 0])); // Not divisible by 3
        assert.ok(!PointCloudVisualizerTestUtils.validateColorArray([1, 0, -0.1])); // Negative value
        assert.ok(!PointCloudVisualizerTestUtils.validateColorArray([1, 0, 1.1])); // Value > 1
    });

    test('Should calculate sequence indices correctly', () => {
        // Forward direction
        assert.strictEqual(PointCloudVisualizerTestUtils.calculateSequenceIndex(0, 5, 'forward'), 1);
        assert.strictEqual(PointCloudVisualizerTestUtils.calculateSequenceIndex(4, 5, 'forward'), 0); // Wrap around
        
        // Backward direction
        assert.strictEqual(PointCloudVisualizerTestUtils.calculateSequenceIndex(1, 5, 'backward'), 0);
        assert.strictEqual(PointCloudVisualizerTestUtils.calculateSequenceIndex(0, 5, 'backward'), 4); // Wrap around
    });

    test('Should clamp sequence indices to valid range', () => {
        assert.strictEqual(PointCloudVisualizerTestUtils.clampSequenceIndex(-1, 5), 0);
        assert.strictEqual(PointCloudVisualizerTestUtils.clampSequenceIndex(10, 5), 4);
        assert.strictEqual(PointCloudVisualizerTestUtils.clampSequenceIndex(2, 5), 2);
    });

    test('Should validate camera parameters correctly', () => {
        // Valid parameters
        assert.ok(PointCloudVisualizerTestUtils.validateCameraParams({fx: 525, fy: 525, cx: 320, cy: 240}));
        
        // Invalid parameters
        assert.ok(!PointCloudVisualizerTestUtils.validateCameraParams({fx: 0, fy: 525, cx: 320, cy: 240}));
        assert.ok(!PointCloudVisualizerTestUtils.validateCameraParams({fx: 525, fy: -525, cx: 320, cy: 240}));
        assert.ok(!PointCloudVisualizerTestUtils.validateCameraParams({fx: 525, fy: 525, cx: -320, cy: 240}));
    });

    test('Should normalize depth values correctly', () => {
        assert.strictEqual(PointCloudVisualizerTestUtils.normalizeDepthValue(5, 0, 10), 0.5);
        assert.strictEqual(PointCloudVisualizerTestUtils.normalizeDepthValue(0, 0, 10), 0);
        assert.strictEqual(PointCloudVisualizerTestUtils.normalizeDepthValue(10, 0, 10), 1);
        
        // Edge case: invalid range
        assert.strictEqual(PointCloudVisualizerTestUtils.normalizeDepthValue(5, 10, 5), 0);
    });

    test('Should handle matrix composition correctly', () => {
        // Test that rotation followed by translation works correctly
        const rotation = PointCloudVisualizerTestUtils.createRotationMatrix('z', 90);
        const translation = PointCloudVisualizerTestUtils.createTranslationMatrix(1, 0, 0);
        
        const composed = new THREE.Matrix4().multiplyMatrices(translation, rotation);
        
        // Composed matrix should not be identity
        assert.ok(!PointCloudVisualizerTestUtils.isMatrixIdentity(composed));
        
        // Should still be a valid transformation matrix
        assert.ok(Math.abs(composed.determinant()) > 0.0001);
    });

    test('Should handle edge cases in utility functions', () => {
        // Test very small values
        const smallRot = PointCloudVisualizerTestUtils.createRotationMatrix('x', 0.001);
        assert.ok(Math.abs(smallRot.determinant() - 1) < 0.0001);
        
        // Test very large point counts
        const largePointSize = PointCloudVisualizerTestUtils.getOptimalPointSize(1000000);
        assert.strictEqual(largePointSize, 1.0);
        
        // Test extreme camera distances
        const extremeDecimation = PointCloudVisualizerTestUtils.calculateDecimationFactor(1000);
        assert.strictEqual(extremeDecimation, 20);
    });
});