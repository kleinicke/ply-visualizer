import * as assert from 'assert';
import * as THREE from 'three';

// Mathematical and Geometry utility functions extracted from main.ts
class MainGeometryMathUtils {
    
    // From parseSpaceSeparatedValues method
    static parseSpaceSeparatedValues(input: string): number[] {
        const trimmed = input.trim();
        if (!trimmed) return [];
        
        return trimmed.split(/\s+/).map(str => {
            const num = parseFloat(str);
            if (isNaN(num)) {
                throw new Error(`Invalid number: ${str}`);
            }
            return num;
        });
    }

    // From updateCameraMatrix method - extract camera matrix calculations
    static calculateCameraMatrix(position: THREE.Vector3, target: THREE.Vector3, up: THREE.Vector3): THREE.Matrix4 {
        const matrix = new THREE.Matrix4();
        matrix.lookAt(position, target, up);
        return matrix;
    }

    // From onDoubleClick method - ray intersection logic
    static calculateRayIntersection(mouse: THREE.Vector2, camera: THREE.PerspectiveCamera, objects: THREE.Object3D[]): THREE.Intersection[] {
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, camera);
        return raycaster.intersectObjects(objects, true);
    }

    // From fitCameraToObject method - bounding box calculations
    static calculateObjectBoundingBox(object: THREE.Object3D): THREE.Box3 {
        const box = new THREE.Box3();
        box.setFromObject(object);
        return box;
    }

    // From fitCameraToAllObjects method - combined bounding box
    static calculateCombinedBoundingBox(objects: THREE.Object3D[]): THREE.Box3 {
        const combinedBox = new THREE.Box3();
        
        for (const object of objects) {
            if (object.visible) {
                const objectBox = new THREE.Box3().setFromObject(object);
                if (!objectBox.isEmpty()) {
                    combinedBox.union(objectBox);
                }
            }
        }
        
        return combinedBox;
    }

    // From fitCameraToObject method - optimal camera distance calculation
    static calculateOptimalCameraDistance(boundingBox: THREE.Box3, fov: number): number {
        const size = boundingBox.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const distance = maxDim / (2 * Math.tan((fov * Math.PI) / 360));
        return Math.max(distance, 0.1); // Minimum distance
    }

    // From setRotationCenter method - rotation center calculations
    static calculateRotationCenter(intersections: THREE.Intersection[]): THREE.Vector3 | null {
        if (intersections.length === 0) return null;
        
        // Use the first valid intersection point
        const intersection = intersections[0];
        return intersection.point.clone();
    }

    // From createGeometryFromPlyData method - vertex processing
    static processVerticesForGeometry(vertices: Array<{x: number, y: number, z: number, red?: number, green?: number, blue?: number}>): {
        positions: Float32Array;
        colors?: Float32Array;
    } {
        const positions = new Float32Array(vertices.length * 3);
        let colors: Float32Array | undefined;
        
        const hasColors = vertices.some(v => v.red !== undefined || v.green !== undefined || v.blue !== undefined);
        if (hasColors) {
            colors = new Float32Array(vertices.length * 3);
        }
        
        for (let i = 0; i < vertices.length; i++) {
            const vertex = vertices[i];
            positions[i * 3] = vertex.x;
            positions[i * 3 + 1] = vertex.y;
            positions[i * 3 + 2] = vertex.z;
            
            if (colors && hasColors) {
                colors[i * 3] = (vertex.red || 0) / 255;
                colors[i * 3 + 1] = (vertex.green || 0) / 255;
                colors[i * 3 + 2] = (vertex.blue || 0) / 255;
            }
        }
        
        return { positions, colors };
    }

    // From createNormalsVisualizer method - normal calculations
    static calculateVertexNormals(vertices: Array<{x: number, y: number, z: number, nx?: number, ny?: number, nz?: number}>): {
        hasNormals: boolean;
        normals: Float32Array;
    } {
        const hasNormals = vertices.some(v => v.nx !== undefined || v.ny !== undefined || v.nz !== undefined);
        const normals = new Float32Array(vertices.length * 6); // Start and end points for each normal line
        
        for (let i = 0; i < vertices.length; i++) {
            const vertex = vertices[i];
            const baseIndex = i * 6;
            
            // Start point (vertex position)
            normals[baseIndex] = vertex.x;
            normals[baseIndex + 1] = vertex.y;
            normals[baseIndex + 2] = vertex.z;
            
            // End point (vertex position + normal)
            if (hasNormals && vertex.nx !== undefined && vertex.ny !== undefined && vertex.nz !== undefined) {
                const normalLength = 0.1; // Visualization length
                normals[baseIndex + 3] = vertex.x + vertex.nx * normalLength;
                normals[baseIndex + 4] = vertex.y + vertex.ny * normalLength;
                normals[baseIndex + 5] = vertex.z + vertex.nz * normalLength;
            } else {
                // Default normal pointing up
                normals[baseIndex + 3] = vertex.x;
                normals[baseIndex + 4] = vertex.y + 0.1;
                normals[baseIndex + 5] = vertex.z;
            }
        }
        
        return { hasNormals, normals };
    }

    // From convertDepthResultToVertices method - depth to 3D conversion
    static convertDepthToVertices(depthData: Float32Array, width: number, height: number, cameraParams: {fx: number, fy: number, cx: number, cy: number}): Array<{x: number, y: number, z: number}> {
        const vertices: Array<{x: number, y: number, z: number}> = [];
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const index = y * width + x;
                const depth = depthData[index];
                
                if (depth > 0 && isFinite(depth)) {
                    // Convert pixel coordinates to 3D coordinates
                    const x3d = (x - cameraParams.cx) * depth / cameraParams.fx;
                    const y3d = (y - cameraParams.cy) * depth / cameraParams.fy;
                    const z3d = depth;
                    
                    vertices.push({ x: x3d, y: y3d, z: z3d });
                }
            }
        }
        
        return vertices;
    }

    // From isDepthTifImage method - TIF format detection
    static validateTifDepthFormat(samplesPerPixel: number, sampleFormat: number | null, bitsPerSample: number[]): boolean {
        // Single channel (grayscale)
        if (samplesPerPixel !== 1) return false;
        
        // Float format or unsigned integer
        if (sampleFormat !== null && sampleFormat !== 3 && sampleFormat !== 1) return false;
        
        // 16-bit or 32-bit
        if (bitsPerSample.length !== 1) return false;
        const bits = bitsPerSample[0];
        if (bits !== 16 && bits !== 32) return false;
        
        return true;
    }

    // From decimateGeometryByDistance method - geometry decimation logic
    static calculateDecimationIndices(totalPoints: number, decimationFactor: number): number[] {
        if (decimationFactor <= 1) {
            return Array.from({ length: totalPoints }, (_, i) => i);
        }
        
        const indices: number[] = [];
        for (let i = 0; i < totalPoints; i += decimationFactor) {
            indices.push(i);
        }
        return indices;
    }

    // From updatePointSize method - point size calculations
    static calculateAdaptivePointSize(baseSize: number, distance: number, minSize: number = 0.5, maxSize: number = 10): number {
        // Scale point size based on camera distance
        const scaleFactor = Math.max(0.1, Math.min(2.0, 10 / distance));
        const adaptiveSize = baseSize * scaleFactor;
        return Math.max(minSize, Math.min(maxSize, adaptiveSize));
    }
}

suite('Main Geometry and Math Functions Test Suite', () => {
    
    test('Should parse space-separated values correctly', () => {
        // Valid inputs
        assert.deepStrictEqual(MainGeometryMathUtils.parseSpaceSeparatedValues('1 2 3'), [1, 2, 3]);
        assert.deepStrictEqual(MainGeometryMathUtils.parseSpaceSeparatedValues('1.5  2.7   3.14'), [1.5, 2.7, 3.14]);
        assert.deepStrictEqual(MainGeometryMathUtils.parseSpaceSeparatedValues('  -1   0  1  '), [-1, 0, 1]);
        assert.deepStrictEqual(MainGeometryMathUtils.parseSpaceSeparatedValues(''), []);
        assert.deepStrictEqual(MainGeometryMathUtils.parseSpaceSeparatedValues('   '), []);
        
        // Invalid inputs should throw
        assert.throws(() => MainGeometryMathUtils.parseSpaceSeparatedValues('1 abc 3'));
        assert.throws(() => MainGeometryMathUtils.parseSpaceSeparatedValues('1 2 NaN'));
    });

    test('Should calculate camera matrix correctly', () => {
        const position = new THREE.Vector3(0, 0, 5);
        const target = new THREE.Vector3(0, 0, 0);
        const up = new THREE.Vector3(0, 1, 0);
        
        const matrix = MainGeometryMathUtils.calculateCameraMatrix(position, target, up);
        
        // Matrix should be valid transformation matrix
        assert.ok(Math.abs(matrix.determinant()) > 0.001);
        
        // Check that applying matrix to position gives expected result
        const transformedPos = position.clone().applyMatrix4(matrix);
        assert.ok(transformedPos.length() > 0);
    });

    test('Should calculate ray intersections', () => {
        // Create simple test scene
        const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
        camera.position.set(0, 0, 5);
        camera.updateMatrixWorld();
        
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshBasicMaterial();
        const cube = new THREE.Mesh(geometry, material);
        cube.updateMatrixWorld();
        
        // Use Three.js Raycaster directly
        const raycaster = new THREE.Raycaster();
        
        // Mouse at center should intersect cube
        const mouse = new THREE.Vector2(0, 0);
        raycaster.setFromCamera(mouse, camera);
        const intersections = raycaster.intersectObjects([cube]);
        
        assert.strictEqual(intersections.length, 2);
        assert.strictEqual(intersections[0].object, cube);
        
        // Mouse far off center should not intersect
        const farMouse = new THREE.Vector2(0.9, 0.9);
        raycaster.setFromCamera(farMouse, camera);
        const noIntersections = raycaster.intersectObjects([cube]);
        assert.strictEqual(noIntersections.length, 0);
    });

    test('Should calculate object bounding boxes', () => {
        const geometry = new THREE.BoxGeometry(2, 4, 6);
        const material = new THREE.MeshBasicMaterial();
        const mesh = new THREE.Mesh(geometry, material);
        
        const boundingBox = MainGeometryMathUtils.calculateObjectBoundingBox(mesh);
        const size = boundingBox.getSize(new THREE.Vector3());
        
        assert.ok(Math.abs(size.x - 2) < 0.001);
        assert.ok(Math.abs(size.y - 4) < 0.001);
        assert.ok(Math.abs(size.z - 6) < 0.001);
    });

    test('Should calculate combined bounding boxes', () => {
        const cube1 = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
        cube1.position.set(0, 0, 0);
        
        const cube2 = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
        cube2.position.set(2, 0, 0);
        
        const combinedBox = MainGeometryMathUtils.calculateCombinedBoundingBox([cube1, cube2]);
        const size = combinedBox.getSize(new THREE.Vector3());
        const center = combinedBox.getCenter(new THREE.Vector3());
        
        // Should span from -0.5 to 2.5 in X direction (total width 3)
        assert.ok(Math.abs(size.x - 3) < 0.001);
        assert.ok(Math.abs(center.x - 1) < 0.001);
        
        // Test with invisible objects (should be ignored)
        cube2.visible = false;
        const singleBox = MainGeometryMathUtils.calculateCombinedBoundingBox([cube1, cube2]);
        const singleSize = singleBox.getSize(new THREE.Vector3());
        assert.ok(Math.abs(singleSize.x - 1) < 0.001);
    });

    test('Should calculate optimal camera distance', () => {
        const boundingBox = new THREE.Box3(
            new THREE.Vector3(-1, -1, -1),
            new THREE.Vector3(1, 1, 1)
        );
        const fov = 75; // degrees
        
        const distance = MainGeometryMathUtils.calculateOptimalCameraDistance(boundingBox, fov);
        
        // Should be positive and reasonable
        assert.ok(distance > 0);
        assert.ok(distance < 100); // Should not be extremely large
        
        // Larger objects should require larger distances
        const largeBoundingBox = new THREE.Box3(
            new THREE.Vector3(-5, -5, -5),
            new THREE.Vector3(5, 5, 5)
        );
        const largeDistance = MainGeometryMathUtils.calculateOptimalCameraDistance(largeBoundingBox, fov);
        assert.ok(largeDistance > distance);
        
        // Minimum distance enforcement
        const tinyBox = new THREE.Box3(
            new THREE.Vector3(-0.01, -0.01, -0.01),
            new THREE.Vector3(0.01, 0.01, 0.01)
        );
        const tinyDistance = MainGeometryMathUtils.calculateOptimalCameraDistance(tinyBox, fov);
        assert.strictEqual(tinyDistance, 0.1); // Should be clamped to minimum
    });

    test('Should calculate rotation center from intersections', () => {
        const intersection1 = {
            point: new THREE.Vector3(1, 2, 3),
            object: new THREE.Object3D()
        } as THREE.Intersection;
        
        const intersection2 = {
            point: new THREE.Vector3(4, 5, 6),
            object: new THREE.Object3D()
        } as THREE.Intersection;
        
        // Should return first intersection point
        const center = MainGeometryMathUtils.calculateRotationCenter([intersection1, intersection2]);
        assert.ok(center);
        assert.ok(center.equals(new THREE.Vector3(1, 2, 3)));
        
        // Empty intersections should return null
        assert.strictEqual(MainGeometryMathUtils.calculateRotationCenter([]), null);
    });

    test('Should process vertices for geometry creation', () => {
        const vertices = [
            { x: 1, y: 2, z: 3, red: 255, green: 128, blue: 0 },
            { x: 4, y: 5, z: 6, red: 0, green: 255, blue: 128 },
            { x: 7, y: 8, z: 9 } // No color
        ];
        
        const result = MainGeometryMathUtils.processVerticesForGeometry(vertices);
        
        // Check positions
        assert.strictEqual(result.positions.length, 9); // 3 vertices * 3 components
        assert.strictEqual(result.positions[0], 1);
        assert.strictEqual(result.positions[1], 2);
        assert.strictEqual(result.positions[2], 3);
        
        // Check colors (should exist since some vertices have colors)
        assert.ok(result.colors);
        assert.strictEqual(result.colors.length, 9);
        assert.ok(Math.abs(result.colors[0] - 1.0) < 0.001); // 255/255
        assert.ok(Math.abs(result.colors[1] - (128/255)) < 0.001);
        assert.strictEqual(result.colors[2], 0); // Blue component
    });

    test('Should process vertices without colors', () => {
        const vertices = [
            { x: 1, y: 2, z: 3 },
            { x: 4, y: 5, z: 6 }
        ];
        
        const result = MainGeometryMathUtils.processVerticesForGeometry(vertices);
        
        assert.strictEqual(result.positions.length, 6);
        assert.strictEqual(result.colors, undefined);
    });

    test('Should calculate vertex normals', () => {
        const vertices = [
            { x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 1 },
            { x: 1, y: 0, z: 0, nx: 1, ny: 0, nz: 0 },
            { x: 0, y: 1, z: 0 } // No normal
        ];
        
        const result = MainGeometryMathUtils.calculateVertexNormals(vertices);
        
        assert.strictEqual(result.hasNormals, true);
        assert.strictEqual(result.normals.length, 18); // 3 vertices * 6 components (start + end point)
        
        // First vertex normal (pointing in Z direction)
        assert.strictEqual(result.normals[0], 0); // Start X
        assert.strictEqual(result.normals[1], 0); // Start Y
        assert.strictEqual(result.normals[2], 0); // Start Z
        assert.strictEqual(result.normals[3], 0); // End X
        assert.strictEqual(result.normals[4], 0); // End Y
        assert.ok(Math.abs(result.normals[5] - 0.1) < 0.001); // End Z (start + normal * length)
    });

    test('Should convert depth data to vertices', () => {
        const width = 2;
        const height = 2;
        const depthData = new Float32Array([1.0, 2.0, 0.0, 1.5]); // One invalid depth (0.0)
        const cameraParams = { fx: 100, fy: 100, cx: 1, cy: 1 };
        
        const vertices = MainGeometryMathUtils.convertDepthToVertices(depthData, width, height, cameraParams);
        
        // Should have 3 valid vertices (excluding the zero depth)
        assert.strictEqual(vertices.length, 3);
        
        // Check first vertex (pixel 0,0 -> depth 1.0)
        const firstVertex = vertices[0];
        assert.ok(Math.abs(firstVertex.x - ((0 - 1) * 1.0 / 100)) < 0.001);
        assert.ok(Math.abs(firstVertex.y - ((0 - 1) * 1.0 / 100)) < 0.001);
        assert.strictEqual(firstVertex.z, 1.0);
    });

    test('Should validate TIF depth format', () => {
        // Valid formats
        assert.ok(MainGeometryMathUtils.validateTifDepthFormat(1, 3, [32])); // Single channel, float, 32-bit
        assert.ok(MainGeometryMathUtils.validateTifDepthFormat(1, 1, [16])); // Single channel, uint, 16-bit
        assert.ok(MainGeometryMathUtils.validateTifDepthFormat(1, null, [32])); // No sample format specified
        
        // Invalid formats
        assert.ok(!MainGeometryMathUtils.validateTifDepthFormat(3, 3, [32])); // Multi-channel (RGB)
        assert.ok(!MainGeometryMathUtils.validateTifDepthFormat(1, 2, [32])); // Invalid sample format
        assert.ok(!MainGeometryMathUtils.validateTifDepthFormat(1, 3, [8])); // 8-bit not supported
        assert.ok(!MainGeometryMathUtils.validateTifDepthFormat(1, 3, [32, 32])); // Multiple bits per sample
    });

    test('Should calculate decimation indices', () => {
        // No decimation
        const noDecimation = MainGeometryMathUtils.calculateDecimationIndices(5, 1);
        assert.deepStrictEqual(noDecimation, [0, 1, 2, 3, 4]);
        
        // Every other point
        const everyOther = MainGeometryMathUtils.calculateDecimationIndices(10, 2);
        assert.deepStrictEqual(everyOther, [0, 2, 4, 6, 8]);
        
        // Every third point
        const everyThird = MainGeometryMathUtils.calculateDecimationIndices(10, 3);
        assert.deepStrictEqual(everyThird, [0, 3, 6, 9]);
        
        // Zero decimation factor should behave like 1
        const zeroDecimation = MainGeometryMathUtils.calculateDecimationIndices(3, 0);
        assert.deepStrictEqual(zeroDecimation, [0, 1, 2]);
    });

    test('Should calculate adaptive point size', () => {
        const baseSize = 2.0;
        
        // Close distance should increase size
        const closeSize = MainGeometryMathUtils.calculateAdaptivePointSize(baseSize, 1.0);
        assert.ok(closeSize > baseSize);
        
        // Far distance should decrease size
        const farSize = MainGeometryMathUtils.calculateAdaptivePointSize(baseSize, 100.0);
        assert.ok(farSize < baseSize);
        
        // Size should be clamped to min/max
        const minSize = MainGeometryMathUtils.calculateAdaptivePointSize(0.1, 1000.0, 0.5, 10);
        assert.strictEqual(minSize, 0.5);
        
        const maxSize = MainGeometryMathUtils.calculateAdaptivePointSize(100, 0.1, 0.5, 10);
        assert.strictEqual(maxSize, 10);
    });

    test('Should handle edge cases in geometry calculations', () => {
        // Empty bounding box
        const emptyBox = new THREE.Box3();
        emptyBox.makeEmpty();
        const emptyDistance = MainGeometryMathUtils.calculateOptimalCameraDistance(emptyBox, 75);
        assert.strictEqual(emptyDistance, 0.1); // Should return minimum distance
        
        // Very small FOV
        const normalBox = new THREE.Box3(new THREE.Vector3(-1, -1, -1), new THREE.Vector3(1, 1, 1));
        const smallFovDistance = MainGeometryMathUtils.calculateOptimalCameraDistance(normalBox, 1);
        assert.ok(smallFovDistance > 100); // Should require very large distance
        
        // Very large FOV should return minimum distance
        const largeFovDistance = MainGeometryMathUtils.calculateOptimalCameraDistance(normalBox, 179);
        assert.strictEqual(largeFovDistance, 0.1); // Should be clamped to minimum
    });

    test('Should handle malformed depth data gracefully', () => {
        const width = 2;
        const height = 2;
        const badDepthData = new Float32Array([NaN, -1, Infinity, 1.5]);
        const cameraParams = { fx: 100, fy: 100, cx: 1, cy: 1 };
        
        const vertices = MainGeometryMathUtils.convertDepthToVertices(badDepthData, width, height, cameraParams);
        
        // Should only process the valid depth value (1.5)
        assert.strictEqual(vertices.length, 1);
        assert.strictEqual(vertices[0].z, 1.5);
    });
});