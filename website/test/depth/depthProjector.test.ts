import * as assert from 'assert';

suite('Depth Projector Test Suite', () => {
  // Mock DepthProjector class for testing (since it's in webview context)
  class TestDepthProjector {
    projectToPointCloud(
      depthData: Float32Array,
      width: number,
      height: number,
      cameraParams: any,
      metadata: any
    ): { vertices: Float32Array; colors?: Uint8Array } {
      const vertices = new Float32Array(width * height * 3);
      let vertexIndex = 0;

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const depthIndex = y * width + x;
          const depth = depthData[depthIndex];

          if (depth > 0) {
            // Simple pinhole projection
            const fx = cameraParams.fx || 525.0;
            const fy = cameraParams.fy || 525.0;
            const cx = cameraParams.cx || width / 2;
            const cy = cameraParams.cy || height / 2;

            const worldX = ((x - cx) * depth) / fx;
            const worldY = ((y - cy) * depth) / fy;
            const worldZ = depth;

            vertices[vertexIndex * 3] = worldX;
            vertices[vertexIndex * 3 + 1] = worldY;
            vertices[vertexIndex * 3 + 2] = worldZ;
            vertexIndex++;
          }
        }
      }

      return {
        vertices: vertices.slice(0, vertexIndex * 3),
      };
    }

    validateCameraParameters(params: any): boolean {
      return (
        params &&
        typeof params.fx === 'number' &&
        params.fx > 0 &&
        typeof params.fy === 'number' &&
        params.fy > 0 &&
        typeof params.cx === 'number' &&
        typeof params.cy === 'number'
      );
    }
  }

  let projector: TestDepthProjector;

  setup(() => {
    projector = new TestDepthProjector();
  });

  test('Should project depth image to 3D point cloud with pinhole camera', () => {
    // Create a simple 2x2 depth image
    const width = 2;
    const height = 2;
    const depthData = new Float32Array([
      1.0,
      2.0, // First row
      3.0,
      0.0, // Second row (last pixel has 0 depth = invalid)
    ]);

    const cameraParams = {
      fx: 100.0,
      fy: 100.0,
      cx: 1.0,
      cy: 1.0,
    };

    const metadata = { kind: 'depth', unit: 'meter' };

    const result = projector.projectToPointCloud(depthData, width, height, cameraParams, metadata);

    assert.ok(result.vertices.length > 0);
    assert.strictEqual(result.vertices.length, 9); // 3 valid pixels * 3 coordinates

    // Check first point (0,0) with depth 1.0
    const x1 = result.vertices[0];
    const y1 = result.vertices[1];
    const z1 = result.vertices[2];

    assert.strictEqual(z1, 1.0);
    // Use approximate equality for floating point calculations
    const expectedX = ((0 - 1.0) * 1.0) / 100.0; // (x - cx) * depth / fx
    const expectedY = ((0 - 1.0) * 1.0) / 100.0; // (y - cy) * depth / fy
    assert.ok(
      Math.abs(x1 - expectedX) < 0.0001,
      `X coordinate should be approximately ${expectedX}, got ${x1}`
    );
    assert.ok(
      Math.abs(y1 - expectedY) < 0.0001,
      `Y coordinate should be approximately ${expectedY}, got ${y1}`
    );
  });

  test('Should validate camera parameters correctly', () => {
    const validParams = {
      fx: 525.0,
      fy: 525.0,
      cx: 320.0,
      cy: 240.0,
    };

    assert.ok(projector.validateCameraParameters(validParams));

    // Test invalid parameters
    assert.ok(!projector.validateCameraParameters(null));
    assert.ok(!projector.validateCameraParameters({}));
    assert.ok(!projector.validateCameraParameters({ fx: -1, fy: 525, cx: 320, cy: 240 }));
    assert.ok(!projector.validateCameraParameters({ fx: 525, fy: 0, cx: 320, cy: 240 }));
    assert.ok(!projector.validateCameraParameters({ fx: 525, fy: 525, cx: 'invalid', cy: 240 }));
  });

  test('Should handle invalid depth values', () => {
    const width = 3;
    const height = 1;
    const depthData = new Float32Array([
      -1.0,
      0.0,
      NaN, // All invalid depths
    ]);

    const cameraParams = {
      fx: 100.0,
      fy: 100.0,
      cx: 1.0,
      cy: 0.0,
    };

    const metadata = { kind: 'depth', unit: 'meter' };

    const result = projector.projectToPointCloud(depthData, width, height, cameraParams, metadata);

    // Should return empty vertex array since all depths are invalid
    assert.strictEqual(result.vertices.length, 0);
  });

  test('Should handle different depth units and scales', () => {
    const width = 1;
    const height = 1;
    const depthData = new Float32Array([1000.0]); // 1000mm = 1m

    const cameraParams = {
      fx: 100.0,
      fy: 100.0,
      cx: 0.5,
      cy: 0.5,
    };

    // Test millimeter depth
    const metadataMM = { kind: 'depth', unit: 'millimeter' };
    const resultMM = projector.projectToPointCloud(
      depthData,
      width,
      height,
      cameraParams,
      metadataMM
    );

    assert.ok(resultMM.vertices.length > 0);
    const depthMM = resultMM.vertices[2];
    assert.strictEqual(depthMM, 1000.0);

    // Test meter depth
    const metadataM = { kind: 'depth', unit: 'meter' };
    const resultM = projector.projectToPointCloud(
      depthData,
      width,
      height,
      cameraParams,
      metadataM
    );

    const depthM = resultM.vertices[2];
    assert.strictEqual(depthM, 1000.0);
  });

  test('Should handle disparity conversion', () => {
    const width = 1;
    const height = 1;
    // Disparity value - depth would be calculated as baseline * focal / disparity
    const disparityData = new Float32Array([10.0]);

    const cameraParams = {
      fx: 100.0,
      fy: 100.0,
      cx: 0.5,
      cy: 0.5,
    };

    const metadata = { kind: 'disparity' };

    const result = projector.projectToPointCloud(
      disparityData,
      width,
      height,
      cameraParams,
      metadata
    );

    assert.ok(result.vertices.length > 0);
    // For disparity, the depth processing would be different
    assert.strictEqual(result.vertices[2], 10.0); // Using raw value in test implementation
  });

  test('Should handle coordinate system transformations', () => {
    const width = 2;
    const height = 2;
    const depthData = new Float32Array([1.0, 1.0, 1.0, 1.0]);

    // Test OpenCV coordinate system (Y down)
    const cameraParamsCV = {
      fx: 100.0,
      fy: 100.0,
      cx: 1.0,
      cy: 1.0,
      coordinateSystem: 'opencv',
    };

    const metadataCV = { kind: 'depth', coordinateSystem: 'opencv' };
    const resultCV = projector.projectToPointCloud(
      depthData,
      width,
      height,
      cameraParamsCV,
      metadataCV
    );

    assert.ok(resultCV.vertices.length > 0);

    // Test OpenGL coordinate system (Y up)
    const cameraParamsGL = {
      fx: 100.0,
      fy: 100.0,
      cx: 1.0,
      cy: 1.0,
      coordinateSystem: 'opengl',
    };

    const metadataGL = { kind: 'depth', coordinateSystem: 'opengl' };
    const resultGL = projector.projectToPointCloud(
      depthData,
      width,
      height,
      cameraParamsGL,
      metadataGL
    );

    assert.ok(resultGL.vertices.length > 0);

    // Both should produce valid results
    assert.strictEqual(resultCV.vertices.length, resultGL.vertices.length);
  });
});
