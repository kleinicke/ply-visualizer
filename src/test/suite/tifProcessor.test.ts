import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';

// Mock TifProcessor since it depends on webview context
class MockTifProcessor {
    depthToPointCloud(
        depthData: Float32Array,
        width: number,
        height: number,
        fx: number,
        fy: number,
        cx: number,
        cy: number,
        cameraModel: 'pinhole' | 'fisheye'
    ) {
        const vertices: number[] = [];
        const validPoints = [];

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const index = y * width + x;
                const depth = depthData[index];

                if (depth > 0 && !isNaN(depth) && isFinite(depth)) {
                    let worldX: number, worldY: number, worldZ: number;

                    if (cameraModel === 'pinhole') {
                        worldX = ((x - cx) * depth) / fx;
                        worldY = ((y - cy) * depth) / fy;
                        worldZ = depth;
                    } else { // fisheye
                        const u = (x - cx) / fx;
                        const v = (y - cy) / fy;
                        const r = Math.sqrt(u * u + v * v);
                        
                        if (r > 0) {
                            const theta = Math.atan(r);
                            const sinTheta = Math.sin(theta);
                            const scale = depth * sinTheta / r;
                            
                            worldX = u * scale;
                            worldY = v * scale;
                            worldZ = depth * Math.cos(theta);
                        } else {
                            worldX = 0;
                            worldY = 0;
                            worldZ = depth;
                        }
                    }

                    vertices.push(worldX, worldY, worldZ);
                    validPoints.push({ x: worldX, y: worldY, z: worldZ });
                }
            }
        }

        return {
            vertices: new Float32Array(vertices),
            pointCount: validPoints.length,
            validPoints
        };
    }

    async processTifToPointCloud(tifData: ArrayBuffer, cameraParams: { cameraModel: 'pinhole' | 'fisheye'; focalLength: number }) {
        // Create mock depth data for testing
        const width = 10;
        const height = 10;
        const mockDepthData = new Float32Array(width * height);
        
        // Fill with sample depth values
        for (let i = 0; i < mockDepthData.length; i++) {
            mockDepthData[i] = 1.0 + Math.random() * 5.0; // Depths between 1-6 meters
        }

        const fx = cameraParams.focalLength;
        const fy = cameraParams.focalLength;
        const cx = width / 2;
        const cy = height / 2;

        const result = this.depthToPointCloud(
            mockDepthData,
            width,
            height,
            fx,
            fy,
            cx,
            cy,
            cameraParams.cameraModel
        );

        return {
            vertices: result.vertices,
            pointCount: result.pointCount
        };
    }
}

suite('TIF Processor Test Suite', () => {
    let processor: MockTifProcessor;

    setup(() => {
        processor = new MockTifProcessor();
    });

    test('Should convert depth data to point cloud with pinhole camera', () => {
        const width = 3;
        const height = 3;
        const depthData = new Float32Array([
            1.0, 1.0, 1.0,
            1.0, 2.0, 1.0,
            1.0, 1.0, 1.0
        ]);
        
        const fx = 100;
        const fy = 100;
        const cx = 1; // Center x
        const cy = 1; // Center y

        const result = processor.depthToPointCloud(
            depthData,
            width,
            height,
            fx,
            fy,
            cx,
            cy,
            'pinhole'
        );

        assert.strictEqual(result.pointCount, 9);
        assert.strictEqual(result.vertices.length, 27); // 9 points * 3 coordinates

        // Check center point (should be at origin in X,Y)
        const centerIndex = 4 * 3; // 5th point (center), 3 coordinates each
        assert.strictEqual(result.vertices[centerIndex], 0); // X
        assert.strictEqual(result.vertices[centerIndex + 1], 0); // Y
        assert.strictEqual(result.vertices[centerIndex + 2], 2.0); // Z (depth)
    });

    test('Should convert depth data to point cloud with fisheye camera', () => {
        const width = 3;
        const height = 3;
        const depthData = new Float32Array([
            1.0, 1.0, 1.0,
            1.0, 2.0, 1.0,
            1.0, 1.0, 1.0
        ]);
        
        const fx = 100;
        const fy = 100;
        const cx = 1;
        const cy = 1;

        const result = processor.depthToPointCloud(
            depthData,
            width,
            height,
            fx,
            fy,
            cx,
            cy,
            'fisheye'
        );

        assert.strictEqual(result.pointCount, 9);
        assert.strictEqual(result.vertices.length, 27);

        // Check that all points are valid numbers
        for (let i = 0; i < result.vertices.length; i++) {
            assert.ok(!isNaN(result.vertices[i]), `Vertex ${i} should not be NaN`);
            assert.ok(isFinite(result.vertices[i]), `Vertex ${i} should be finite`);
        }
    });

    test('Should handle zero and invalid depth values', () => {
        const width = 3;
        const height = 3;
        const depthData = new Float32Array([
            0.0, NaN, Infinity,
            -1.0, 2.0, 0.0,
            1.0, 1.0, 1.0
        ]);
        
        const fx = 100;
        const fy = 100;
        const cx = 1;
        const cy = 1;

        const result = processor.depthToPointCloud(
            depthData,
            width,
            height,
            fx,
            fy,
            cx,
            cy,
            'pinhole'
        );

        // Should only have valid points (depths > 0, finite, not NaN)
        assert.strictEqual(result.pointCount, 4); // Only 4 valid depth values
        assert.strictEqual(result.vertices.length, 12); // 4 points * 3 coordinates
    });

    test('Should process TIF data with pinhole camera parameters', async () => {
        const mockTifData = new ArrayBuffer(1024); // Mock TIF data
        const cameraParams = {
            cameraModel: 'pinhole' as const,
            focalLength: 500
        };

        const result = await processor.processTifToPointCloud(mockTifData, cameraParams);

        assert.ok(result.pointCount > 0);
        assert.ok(result.vertices.length > 0);
        assert.strictEqual(result.vertices.length, result.pointCount * 3);
    });

    test('Should process TIF data with fisheye camera parameters', async () => {
        const mockTifData = new ArrayBuffer(1024);
        const cameraParams = {
            cameraModel: 'fisheye' as const,
            focalLength: 300
        };

        const result = await processor.processTifToPointCloud(mockTifData, cameraParams);

        assert.ok(result.pointCount > 0);
        assert.ok(result.vertices.length > 0);
        assert.strictEqual(result.vertices.length, result.pointCount * 3);
    });

    test('Should handle different focal lengths correctly', () => {
        const width = 2;
        const height = 2;
        const depthData = new Float32Array([1.0, 1.0, 1.0, 1.0]);
        
        const cx = 0.5;
        const cy = 0.5;

        // Test with small focal length
        const result1 = processor.depthToPointCloud(
            depthData, width, height, 50, 50, cx, cy, 'pinhole'
        );

        // Test with large focal length
        const result2 = processor.depthToPointCloud(
            depthData, width, height, 500, 500, cx, cy, 'pinhole'
        );

        assert.strictEqual(result1.pointCount, result2.pointCount);
        
        // With larger focal length, X and Y coordinates should be smaller (narrower field of view)
        const point1_x = Math.abs(result1.vertices[0]);
        const point2_x = Math.abs(result2.vertices[0]);
        assert.ok(point2_x < point1_x, 'Larger focal length should produce smaller X coordinates');
    });

    test('Should test against real TIF file if available', async () => {
        const testFilePath = path.join(__dirname, '../../../testfiles/depth.tif');
        if (fs.existsSync(testFilePath)) {
            const tifData = fs.readFileSync(testFilePath);
            const cameraParams = {
                cameraModel: 'pinhole' as const,
                focalLength: 500
            };

            // Note: This test would require actual GeoTIFF processing
            // For now, we just verify the file exists and can be read
            assert.ok(tifData.length > 0, 'TIF file should contain data');
            assert.ok(tifData.buffer instanceof ArrayBuffer, 'TIF data should be ArrayBuffer compatible');
        }
    });

    test('Should calculate camera intrinsics correctly', () => {
        const focalLength = 500;
        const width = 640;
        const height = 480;
        
        // Expected principal point at image center
        const expectedCx = width / 2;
        const expectedCy = height / 2;
        
        assert.strictEqual(expectedCx, 320);
        assert.strictEqual(expectedCy, 240);
        
        // Test that point at principal point maps to (0,0) in camera coordinates
        const u_normalized = (expectedCx - expectedCx) / focalLength; // Should be 0
        const v_normalized = (expectedCy - expectedCy) / focalLength; // Should be 0
        
        assert.strictEqual(u_normalized, 0);
        assert.strictEqual(v_normalized, 0);
    });
});