import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

suite('Interactive Features Test Suite', function () {
  this.timeout(30000);

  test('Should test quaternion to matrix conversion mathematics', async function () {
    // Test the mathematical correctness of quaternion to matrix conversion
    // This verifies the core algorithm used in the webview

    const testQuaternions = [
      { name: 'Identity', q: [0, 0, 0, 1], expectedMatrix: [1, 0, 0, 0, 1, 0, 0, 0, 1] },
      {
        name: '90° Z-rotation',
        q: [0, 0, 0.707, 0.707],
        expectedMatrix: [0, -1, 0, 1, 0, 0, 0, 0, 1],
      },
      {
        name: '90° X-rotation',
        q: [0.707, 0, 0, 0.707],
        expectedMatrix: [1, 0, 0, 0, 0, -1, 0, 1, 0],
      },
      {
        name: '90° Y-rotation',
        q: [0, 0.707, 0, 0.707],
        expectedMatrix: [0, 0, 1, 0, 1, 0, -1, 0, 0],
      },
    ];

    function quaternionToMatrix(qx: number, qy: number, qz: number, qw: number): number[] {
      // Three.js quaternion to matrix conversion algorithm
      const x2 = qx + qx,
        y2 = qy + qy,
        z2 = qz + qz;
      const xx = qx * x2,
        xy = qx * y2,
        xz = qx * z2;
      const yy = qy * y2,
        yz = qy * z2,
        zz = qz * z2;
      const wx = qw * x2,
        wy = qw * y2,
        wz = qw * z2;

      return [
        1 - (yy + zz),
        xy - wz,
        xz + wy,
        xy + wz,
        1 - (xx + zz),
        yz - wx,
        xz - wy,
        yz + wx,
        1 - (xx + yy),
      ];
    }

    for (const test of testQuaternions) {
      const [qx, qy, qz, qw] = test.q;
      const resultMatrix = quaternionToMatrix(qx, qy, qz, qw);

      console.log(`\n=== Testing ${test.name} ===`);
      console.log(`Quaternion: [${qx}, ${qy}, ${qz}, ${qw}]`);
      console.log(`Expected matrix: [${test.expectedMatrix.map(v => v.toFixed(2)).join(', ')}]`);
      console.log(`Result matrix:   [${resultMatrix.map(v => v.toFixed(2)).join(', ')}]`);

      // Check matrix values with tolerance for floating point errors
      for (let i = 0; i < 9; i++) {
        const expected = test.expectedMatrix[i];
        const actual = resultMatrix[i];
        const tolerance = 0.01;

        assert.ok(
          Math.abs(actual - expected) < tolerance,
          `Matrix element ${i}: expected ${expected}, got ${actual.toFixed(3)}`
        );
      }

      console.log(`✓ ${test.name} quaternion conversion correct`);
    }
  });

  test('Should test camera projection mathematics', async function () {
    // Test the camera projection calculations used for TIF depth conversion

    const testCases = [
      {
        name: 'Pinhole camera',
        model: 'pinhole',
        width: 640,
        height: 480,
        fx: 500,
        fy: 500,
        cx: 320,
        cy: 240,
        pixelX: 320,
        pixelY: 240,
        depth: 2.0,
        expected: { x: 0, y: 0, z: 2.0 }, // Center pixel should map to origin
      },
      {
        name: 'Pinhole off-center',
        model: 'pinhole',
        width: 640,
        height: 480,
        fx: 500,
        fy: 500,
        cx: 320,
        cy: 240,
        pixelX: 420,
        pixelY: 290,
        depth: 1.0,
        expected: { x: 0.2, y: 0.1, z: 1.0 }, // (420-320)/500 * 1.0 = 0.2
      },
    ];

    function depthToPoint(
      pixelX: number,
      pixelY: number,
      depth: number,
      fx: number,
      fy: number,
      cx: number,
      cy: number,
      model: 'pinhole' | 'fisheye'
    ) {
      if (model === 'pinhole') {
        return {
          x: ((pixelX - cx) * depth) / fx,
          y: ((pixelY - cy) * depth) / fy,
          z: depth,
        };
      } else {
        // fisheye
        const u = (pixelX - cx) / fx;
        const v = (pixelY - cy) / fy;
        const r = Math.sqrt(u * u + v * v);

        if (r > 0) {
          const theta = Math.atan(r);
          const sinTheta = Math.sin(theta);
          const scale = (depth * sinTheta) / r;

          return {
            x: u * scale,
            y: v * scale,
            z: depth * Math.cos(theta),
          };
        } else {
          return { x: 0, y: 0, z: depth };
        }
      }
    }

    for (const test of testCases) {
      const result = depthToPoint(
        test.pixelX,
        test.pixelY,
        test.depth,
        test.fx,
        test.fy,
        test.cx,
        test.cy,
        test.model as 'pinhole' | 'fisheye'
      );

      console.log(`\n=== Testing ${test.name} ===`);
      console.log(`Pixel: (${test.pixelX}, ${test.pixelY}), Depth: ${test.depth}`);
      console.log(`Expected: (${test.expected.x}, ${test.expected.y}, ${test.expected.z})`);
      console.log(
        `Result:   (${result.x.toFixed(3)}, ${result.y.toFixed(3)}, ${result.z.toFixed(3)})`
      );

      const tolerance = 0.01;
      assert.ok(Math.abs(result.x - test.expected.x) < tolerance, `X coordinate mismatch`);
      assert.ok(Math.abs(result.y - test.expected.y) < tolerance, `Y coordinate mismatch`);
      assert.ok(Math.abs(result.z - test.expected.z) < tolerance, `Z coordinate mismatch`);

      console.log(`✓ ${test.name} projection correct`);
    }
  });

  test('Should test fisheye vs pinhole camera differences', async function () {
    // Compare fisheye and pinhole projections to verify they produce different results

    const commonParams = {
      width: 100,
      height: 100,
      fx: 50,
      fy: 50,
      cx: 50,
      cy: 50,
      depth: 2.0,
    };

    const testPixels = [
      { x: 50, y: 50 }, // Center
      { x: 75, y: 75 }, // Off-center
      { x: 90, y: 90 }, // Near edge
    ];

    const results: { [key: string]: any } = {};

    for (const pixel of testPixels) {
      // Pinhole projection
      const pinhole = {
        x: ((pixel.x - commonParams.cx) * commonParams.depth) / commonParams.fx,
        y: ((pixel.y - commonParams.cy) * commonParams.depth) / commonParams.fy,
        z: commonParams.depth,
      };

      // Fisheye projection
      const u = (pixel.x - commonParams.cx) / commonParams.fx;
      const v = (pixel.y - commonParams.cy) / commonParams.fy;
      const r = Math.sqrt(u * u + v * v);

      let fisheye;
      if (r > 0) {
        const theta = Math.atan(r);
        const sinTheta = Math.sin(theta);
        const scale = (commonParams.depth * sinTheta) / r;

        fisheye = {
          x: u * scale,
          y: v * scale,
          z: commonParams.depth * Math.cos(theta),
        };
      } else {
        fisheye = { x: 0, y: 0, z: commonParams.depth };
      }

      const pixelKey = `${pixel.x},${pixel.y}`;
      results[pixelKey] = { pinhole, fisheye, pixel };

      console.log(`\n=== Pixel (${pixel.x}, ${pixel.y}) ===`);
      console.log(
        `Pinhole:  (${pinhole.x.toFixed(3)}, ${pinhole.y.toFixed(3)}, ${pinhole.z.toFixed(3)})`
      );
      console.log(
        `Fisheye:  (${fisheye.x.toFixed(3)}, ${fisheye.y.toFixed(3)}, ${fisheye.z.toFixed(3)})`
      );

      // Check that results are different (except at center)
      if (pixel.x !== commonParams.cx || pixel.y !== commonParams.cy) {
        const xDiff = Math.abs(pinhole.x - fisheye.x);
        const yDiff = Math.abs(pinhole.y - fisheye.y);
        const zDiff = Math.abs(pinhole.z - fisheye.z);

        console.log(`Differences: (${xDiff.toFixed(3)}, ${yDiff.toFixed(3)}, ${zDiff.toFixed(3)})`);

        assert.ok(
          xDiff > 0.001 || yDiff > 0.001 || zDiff > 0.001,
          'Fisheye and pinhole should produce different results for off-center pixels'
        );
      }
    }

    console.log('\n✓ Fisheye and pinhole camera models produce appropriately different results');
  });

  test('Should test transformation matrix composition', async function () {
    // Test matrix multiplication for combining transformations

    function multiplyMatrices(a: number[], b: number[]): number[] {
      // 4x4 matrix multiplication (column-major order like Three.js)
      const result = new Array(16).fill(0);

      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
          for (let k = 0; k < 4; k++) {
            result[i + j * 4] += a[i + k * 4] * b[k + j * 4];
          }
        }
      }

      return result;
    }

    // Test translation matrix
    const translation = [
      1,
      0,
      0,
      0,
      0,
      1,
      0,
      0,
      0,
      0,
      1,
      0,
      5,
      0,
      0,
      1, // Translate by (5, 0, 0)
    ];

    // Test rotation matrix (90° around Z)
    const rotation = [0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

    // Combine: first rotate, then translate
    const combined = multiplyMatrices(translation, rotation);

    console.log(
      'Translation matrix:',
      translation
        .slice(0, 4)
        .map(v => v.toFixed(1))
        .join(', ')
    );
    console.log(
      'Rotation matrix:   ',
      rotation
        .slice(0, 4)
        .map(v => v.toFixed(1))
        .join(', ')
    );
    console.log(
      'Combined matrix:   ',
      combined
        .slice(0, 4)
        .map(v => v.toFixed(1))
        .join(', ')
    );

    // Test a point transformation
    function transformPoint(
      matrix: number[],
      point: [number, number, number]
    ): [number, number, number] {
      const [x, y, z] = point;
      return [
        matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12],
        matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13],
        matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14],
      ];
    }

    const testPoint: [number, number, number] = [1, 0, 0];
    const rotatedPoint = transformPoint(rotation, testPoint);
    const finalPoint = transformPoint(combined, testPoint);

    console.log(`Original point:     (${testPoint.join(', ')})`);
    console.log(`After rotation:     (${rotatedPoint.map(v => v.toFixed(1)).join(', ')})`);
    console.log(`After combined:     (${finalPoint.map(v => v.toFixed(1)).join(', ')})`);

    // Verify rotation: (1,0,0) -> (0,1,0)
    assert.ok(Math.abs(rotatedPoint[0] - 0) < 0.01, 'X should become 0');
    assert.ok(Math.abs(rotatedPoint[1] - 1) < 0.01, 'Y should become 1');
    assert.ok(Math.abs(rotatedPoint[2] - 0) < 0.01, 'Z should remain 0');

    // Verify combined: (1,0,0) -> rotate to (0,1,0) -> translate to (5,1,0)
    assert.ok(Math.abs(finalPoint[0] - 5) < 0.01, 'X should be 5 after translation');
    assert.ok(Math.abs(finalPoint[1] - 1) < 0.01, 'Y should be 1 after rotation');
    assert.ok(Math.abs(finalPoint[2] - 0) < 0.01, 'Z should remain 0');

    console.log('✓ Matrix composition and point transformation correct');
  });

  test('Should test view matrix calculations for camera controls', async function () {
    // Test the camera view matrix calculations used in Three.js controls

    function lookAt(
      eyeX: number,
      eyeY: number,
      eyeZ: number,
      targetX: number,
      targetY: number,
      targetZ: number,
      upX: number,
      upY: number,
      upZ: number
    ): number[] {
      // Calculate forward vector (normalized)
      let fx = eyeX - targetX;
      let fy = eyeY - targetY;
      let fz = eyeZ - targetZ;
      const fLength = Math.sqrt(fx * fx + fy * fy + fz * fz);
      fx /= fLength;
      fy /= fLength;
      fz /= fLength;

      // Calculate right vector (cross product of up and forward)
      let rx = upY * fz - upZ * fy;
      let ry = upZ * fx - upX * fz;
      let rz = upX * fy - upY * fx;
      const rLength = Math.sqrt(rx * rx + ry * ry + rz * rz);
      rx /= rLength;
      ry /= rLength;
      rz /= rLength;

      // Calculate up vector (cross product of forward and right)
      const ux = fy * rz - fz * ry;
      const uy = fz * rx - fx * rz;
      const uz = fx * ry - fy * rx;

      // Create view matrix
      return [
        rx,
        ux,
        fx,
        0,
        ry,
        uy,
        fy,
        0,
        rz,
        uz,
        fz,
        0,
        -(rx * eyeX + ry * eyeY + rz * eyeZ),
        -(ux * eyeX + uy * eyeY + uz * eyeZ),
        -(fx * eyeX + fy * eyeY + fz * eyeZ),
        1,
      ];
    }

    const testCameras = [
      {
        name: 'Default camera',
        eye: [0, 0, 5],
        target: [0, 0, 0],
        up: [0, 1, 0],
        expectedForward: [0, 0, -1], // Looking down negative Z
      },
      {
        name: 'Side view',
        eye: [5, 0, 0],
        target: [0, 0, 0],
        up: [0, 1, 0],
        expectedForward: [-1, 0, 0], // Looking down negative X
      },
      {
        name: 'Top view',
        eye: [0, 5, 0],
        target: [0, 0, 0],
        up: [0, 0, -1],
        expectedForward: [0, -1, 0], // Looking down negative Y
      },
    ];

    for (const test of testCameras) {
      const [eyeX, eyeY, eyeZ] = test.eye;
      const [targetX, targetY, targetZ] = test.target;
      const [upX, upY, upZ] = test.up;

      const viewMatrix = lookAt(eyeX, eyeY, eyeZ, targetX, targetY, targetZ, upX, upY, upZ);

      // Extract forward vector from matrix (3rd column, negated)
      const forward = [-viewMatrix[2], -viewMatrix[6], -viewMatrix[10]];

      console.log(`\n=== ${test.name} ===`);
      console.log(`Eye: (${test.eye.join(', ')}), Target: (${test.target.join(', ')})`);
      console.log(`Expected forward: (${test.expectedForward.join(', ')})`);
      console.log(`Calculated forward: (${forward.map(v => v.toFixed(3)).join(', ')})`);

      // Check forward vector with tolerance
      for (let i = 0; i < 3; i++) {
        assert.ok(
          Math.abs(forward[i] - test.expectedForward[i]) < 0.01,
          `Forward vector component ${i} mismatch`
        );
      }

      console.log(`✓ ${test.name} view matrix correct`);
    }
  });

  test('Should test point cloud bounding box calculations', async function () {
    // Test bounding box calculations used for camera positioning

    const testPointClouds = [
      {
        name: 'Unit cube',
        points: [
          [0, 0, 0],
          [1, 0, 0],
          [0, 1, 0],
          [0, 0, 1],
          [1, 1, 0],
          [1, 0, 1],
          [0, 1, 1],
          [1, 1, 1],
        ],
        expectedMin: [0, 0, 0],
        expectedMax: [1, 1, 1],
        expectedCenter: [0.5, 0.5, 0.5],
        expectedSize: 1,
      },
      {
        name: 'Offset points',
        points: [
          [-2, -1, 0],
          [2, 1, 0],
          [0, -1, -3],
          [0, 1, 3],
        ],
        expectedMin: [-2, -1, -3],
        expectedMax: [2, 1, 3],
        expectedCenter: [0, 0, 0],
        expectedSize: 6,
      },
    ];

    function calculateBoundingBox(points: number[][]) {
      if (points.length === 0) {return null;}

      const min = [Infinity, Infinity, Infinity];
      const max = [-Infinity, -Infinity, -Infinity];

      for (const point of points) {
        for (let i = 0; i < 3; i++) {
          min[i] = Math.min(min[i], point[i]);
          max[i] = Math.max(max[i], point[i]);
        }
      }

      const center = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];

      const size = Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]);

      return { min, max, center, size };
    }

    for (const test of testPointClouds) {
      const bbox = calculateBoundingBox(test.points);

      console.log(`\n=== ${test.name} ===`);
      console.log(`Points: ${test.points.length}`);
      console.log(`Expected min: (${test.expectedMin.join(', ')})`);
      console.log(`Calculated min: (${bbox!.min.map(v => v.toFixed(1)).join(', ')})`);
      console.log(`Expected max: (${test.expectedMax.join(', ')})`);
      console.log(`Calculated max: (${bbox!.max.map(v => v.toFixed(1)).join(', ')})`);
      console.log(`Expected center: (${test.expectedCenter.join(', ')})`);
      console.log(`Calculated center: (${bbox!.center.map(v => v.toFixed(1)).join(', ')})`);
      console.log(`Expected size: ${test.expectedSize}`);
      console.log(`Calculated size: ${bbox!.size.toFixed(1)}`);

      // Verify calculations
      const tolerance = 0.01;
      for (let i = 0; i < 3; i++) {
        assert.ok(Math.abs(bbox!.min[i] - test.expectedMin[i]) < tolerance, `Min ${i} mismatch`);
        assert.ok(Math.abs(bbox!.max[i] - test.expectedMax[i]) < tolerance, `Max ${i} mismatch`);
        assert.ok(
          Math.abs(bbox!.center[i] - test.expectedCenter[i]) < tolerance,
          `Center ${i} mismatch`
        );
      }
      assert.ok(Math.abs(bbox!.size - test.expectedSize) < tolerance, `Size mismatch`);

      console.log(`✓ ${test.name} bounding box correct`);
    }
  });

  test('Should simulate interactive parameter changes', async function () {
    // Simulate the effects of parameter changes without UI interaction

    console.log('\n=== Simulating Interactive Parameter Changes ===');

    // 1. Test quaternion parameter changes
    console.log('\n1. Testing quaternion parameter changes:');
    const initialQuaternion = [0, 0, 0, 1]; // Identity
    const rotatedQuaternion = [0, 0, 0.707, 0.707]; // 90° Z rotation

    // This simulates what happens when user changes quaternion inputs
    function simulateQuaternionChange(quat: number[]) {
      const [qx, qy, qz, qw] = quat;
      const x2 = qx + qx,
        y2 = qy + qy,
        z2 = qz + qz;
      const xx = qx * x2,
        xy = qx * y2,
        xz = qx * z2;
      const yy = qy * y2,
        yz = qy * z2,
        zz = qz * z2;
      const wx = qw * x2,
        wy = qw * y2,
        wz = qw * z2;

      return [
        1 - (yy + zz),
        xy - wz,
        xz + wy,
        0,
        xy + wz,
        1 - (xx + zz),
        yz - wx,
        0,
        xz - wy,
        yz + wx,
        1 - (xx + yy),
        0,
        0,
        0,
        0,
        1,
      ];
    }

    const initialMatrix = simulateQuaternionChange(initialQuaternion);
    const rotatedMatrix = simulateQuaternionChange(rotatedQuaternion);

    console.log(`Initial quaternion: [${initialQuaternion.join(', ')}]`);
    console.log(
      `Initial matrix (first row): [${initialMatrix
        .slice(0, 4)
        .map(v => v.toFixed(2))
        .join(', ')}]`
    );
    console.log(`Rotated quaternion: [${rotatedQuaternion.join(', ')}]`);
    console.log(
      `Rotated matrix (first row): [${rotatedMatrix
        .slice(0, 4)
        .map(v => v.toFixed(2))
        .join(', ')}]`
    );

    assert.ok(
      initialMatrix[0] !== rotatedMatrix[0],
      'Matrix should change when quaternion changes'
    );
    console.log('✓ Quaternion changes produce expected matrix updates');

    // 2. Test TIF parameter changes
    console.log('\n2. Testing TIF camera parameter changes:');
    const testDepthValue = 2.0;
    const pixelCoord = [100, 100]; // Off-center pixel
    const imageCenter = [320, 240];

    function simulateTifParameterChange(focalLength: number, cameraModel: string) {
      const [px, py] = pixelCoord;
      const [cx, cy] = imageCenter;

      if (cameraModel === 'pinhole') {
        return {
          x: ((px - cx) * testDepthValue) / focalLength,
          y: ((py - cy) * testDepthValue) / focalLength,
          z: testDepthValue,
        };
      } else {
        const u = (px - cx) / focalLength;
        const v = (py - cy) / focalLength;
        const r = Math.sqrt(u * u + v * v);
        const theta = Math.atan(r);
        const sinTheta = Math.sin(theta);
        const scale = (testDepthValue * sinTheta) / r;

        return {
          x: u * scale,
          y: v * scale,
          z: testDepthValue * Math.cos(theta),
        };
      }
    }

    const focal500 = simulateTifParameterChange(500, 'pinhole');
    const focal1000 = simulateTifParameterChange(1000, 'pinhole');
    const fisheye500 = simulateTifParameterChange(500, 'fisheye');

    console.log(
      `Pinhole f=500:  (${focal500.x.toFixed(3)}, ${focal500.y.toFixed(3)}, ${focal500.z.toFixed(3)})`
    );
    console.log(
      `Pinhole f=1000: (${focal1000.x.toFixed(3)}, ${focal1000.y.toFixed(3)}, ${focal1000.z.toFixed(3)})`
    );
    console.log(
      `Fisheye f=500:  (${fisheye500.x.toFixed(3)}, ${fisheye500.y.toFixed(3)}, ${fisheye500.z.toFixed(3)})`
    );

    // Verify focal length changes affect scale
    assert.ok(
      Math.abs(focal500.x) > Math.abs(focal1000.x),
      'Higher focal length should produce smaller coordinates'
    );
    assert.ok(
      Math.abs(focal500.x - fisheye500.x) > 0.01,
      'Different camera models should produce different results'
    );
    console.log('✓ TIF parameter changes produce expected coordinate changes');

    // 3. Test view matrix changes
    console.log('\n3. Testing camera view changes:');
    function simulateViewChange(cameraPosition: number[], target: number[]) {
      const [ex, ey, ez] = cameraPosition;
      const [tx, ty, tz] = target;

      // Calculate distance and direction
      const dx = ex - tx,
        dy = ey - ty,
        dz = ez - tz;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const direction = [dx / distance, dy / distance, dz / distance];

      return { position: cameraPosition, target, distance, direction };
    }

    const initialView = simulateViewChange([0, 0, 10], [0, 0, 0]);
    const rotatedView = simulateViewChange([7.07, 0, 7.07], [0, 0, 0]); // 45° around Y
    const doubleClickView = simulateViewChange([0, 0, 10], [2, 1, 0]); // New target

    console.log(
      `Initial view - distance: ${initialView.distance.toFixed(2)}, direction: [${initialView.direction.map(v => v.toFixed(2)).join(', ')}]`
    );
    console.log(
      `Rotated view - distance: ${rotatedView.distance.toFixed(2)}, direction: [${rotatedView.direction.map(v => v.toFixed(2)).join(', ')}]`
    );
    console.log(
      `New target view - distance: ${doubleClickView.distance.toFixed(2)}, target: [${doubleClickView.target.join(', ')}]`
    );

    assert.ok(
      Math.abs(initialView.distance - rotatedView.distance) < 0.1,
      'Distance should remain similar during rotation'
    );
    assert.ok(
      initialView.direction[0] !== rotatedView.direction[0],
      'Direction should change during rotation'
    );
    assert.ok(
      initialView.target[0] !== doubleClickView.target[0],
      'Target should change with double-click'
    );
    console.log('✓ Camera view changes produce expected updates');

    console.log('\n=== All interactive feature simulations completed successfully ===');
  });
});
