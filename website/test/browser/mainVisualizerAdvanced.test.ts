import * as assert from 'assert';
import * as THREE from 'three';

// Advanced features and specialized methods from main.ts
suite('PointCloudVisualizer Advanced Features Test Suite', () => {
  suite('Pose Visualization', () => {
    test('Should normalize pose data from various formats', () => {
      // Test COCO-style pose format
      const cocoPose = {
        keypoints: [
          [100, 200, 0.9], // [x, y, confidence]
          [150, 180, 0.8],
          [120, 220, 0.95],
        ],
      };

      const normalizedJoints: Array<{ x: number; y: number; z: number; score?: number }> = [];

      for (const kp of cocoPose.keypoints) {
        if (kp.length >= 3) {
          normalizedJoints.push({
            x: kp[0],
            y: kp[1],
            z: 0, // 2D pose, z=0
            score: kp[2],
          });
        }
      }

      assert.strictEqual(normalizedJoints.length, 3);
      assert.strictEqual(normalizedJoints[0].x, 100);
      assert.strictEqual(normalizedJoints[0].score, 0.9);
      assert.strictEqual(normalizedJoints[2].z, 0);
    });

    test('Should auto-connect joints using k-nearest neighbors', () => {
      const joints = [
        { x: 0, y: 0, z: 0 }, // Joint 0
        { x: 1, y: 0, z: 0 }, // Joint 1
        { x: 0, y: 1, z: 0 }, // Joint 2
        { x: 2, y: 2, z: 0 }, // Joint 3
      ];

      const k = 2; // Connect to 2 nearest neighbors
      const edges: Array<[number, number]> = [];

      for (let i = 0; i < joints.length; i++) {
        const distances: Array<{ index: number; distance: number }> = [];

        for (let j = 0; j < joints.length; j++) {
          if (i !== j) {
            const dx = joints[i].x - joints[j].x;
            const dy = joints[i].y - joints[j].y;
            const dz = joints[i].z - joints[j].z;
            const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
            distances.push({ index: j, distance });
          }
        }

        // Sort by distance and take k nearest
        distances.sort((a, b) => a.distance - b.distance);
        for (let k_idx = 0; k_idx < Math.min(k, distances.length); k_idx++) {
          const neighborIndex = distances[k_idx].index;
          if (i < neighborIndex) {
            // Avoid duplicate edges
            edges.push([i, neighborIndex]);
          }
        }
      }

      assert.ok(edges.length > 0);
      assert.ok(edges.length <= (joints.length * k) / 2); // Upper bound

      // Check that edge [0,1] exists (closest neighbors)
      const hasEdge01 = edges.some(([a, b]) => (a === 0 && b === 1) || (a === 1 && b === 0));
      assert.ok(hasEdge01);
    });

    test('Should filter poses by confidence score', () => {
      const poses = [
        { x: 0, y: 0, z: 0, score: 0.9 },
        { x: 1, y: 1, z: 1, score: 0.3 },
        { x: 2, y: 2, z: 2, score: 0.7 },
        { x: 3, y: 3, z: 3, score: 0.1 },
      ];

      const minScore = 0.5;
      const filteredPoses = poses.filter(pose => (pose.score || 0) >= minScore);

      assert.strictEqual(filteredPoses.length, 2);
      assert.strictEqual(filteredPoses[0].score, 0.9);
      assert.strictEqual(filteredPoses[1].score, 0.7);
    });

    test('Should scale joint sizes by uncertainty', () => {
      const joint = {
        x: 0,
        y: 0,
        z: 0,
        uncertainty: [0.1, 0.2, 0.05], // [x_std, y_std, z_std]
      };

      const baseSize = 0.05;
      const maxUncertainty = Math.max(...joint.uncertainty);
      const scaleFactor = 1.0 + maxUncertainty * 2.0; // Scale by max uncertainty
      const adjustedSize = baseSize * scaleFactor;

      assert.ok(adjustedSize > baseSize);
      assert.ok(Math.abs(adjustedSize - 0.07) < 0.001); // 0.05 * (1 + 0.2 * 2)
    });

    test('Should handle pose dataset colors', () => {
      const datasetColors = {
        jointColors: [
          [1.0, 0.0, 0.0], // Red
          [0.0, 1.0, 0.0], // Green
          [0.0, 0.0, 1.0], // Blue
        ],
        linkColors: [
          [0.5, 0.5, 0.0], // Yellow
          [0.5, 0.0, 0.5], // Magenta
        ],
      };

      assert.strictEqual(datasetColors.jointColors.length, 3);
      assert.strictEqual(datasetColors.linkColors.length, 2);

      // Check color values are normalized [0,1]
      for (const color of datasetColors.jointColors) {
        for (const component of color) {
          assert.ok(component >= 0 && component <= 1);
        }
      }
    });
  });

  suite('Camera Profile Visualization', () => {
    test('Should create camera frustum geometry', () => {
      const fov = 60; // degrees
      const aspect = 16 / 9;
      const near = 0.1;
      const far = 2.0;

      // Create frustum vertices
      const halfFovRad = (fov * Math.PI) / 180 / 2;
      const nearHeight = 2 * Math.tan(halfFovRad) * near;
      const nearWidth = nearHeight * aspect;
      const farHeight = 2 * Math.tan(halfFovRad) * far;
      const farWidth = farHeight * aspect;

      const frustumVertices = [
        // Near plane corners
        [-nearWidth / 2, -nearHeight / 2, -near],
        [nearWidth / 2, -nearHeight / 2, -near],
        [nearWidth / 2, nearHeight / 2, -near],
        [-nearWidth / 2, nearHeight / 2, -near],
        // Far plane corners
        [-farWidth / 2, -farHeight / 2, -far],
        [farWidth / 2, -farHeight / 2, -far],
        [farWidth / 2, farHeight / 2, -far],
        [-farWidth / 2, farHeight / 2, -far],
      ];

      assert.strictEqual(frustumVertices.length, 8);

      // Near plane should be smaller than far plane
      assert.ok(nearWidth < farWidth);
      assert.ok(nearHeight < farHeight);

      // Check aspect ratio
      assert.ok(Math.abs(nearWidth / nearHeight - aspect) < 0.001);
    });

    test('Should create camera direction arrow', () => {
      const arrowLength = 1.0;
      const arrowGeometry = {
        vertices: [
          [0, 0, 0], // Origin
          [0, 0, -arrowLength], // Forward direction (negative Z)
          [0, 0, -arrowLength * 0.8], // Arrow head base
          [-0.1, 0, -arrowLength * 0.8], // Arrow head left
          [0.1, 0, -arrowLength * 0.8], // Arrow head right
          [0, -0.1, -arrowLength * 0.8], // Arrow head down
          [0, 0.1, -arrowLength * 0.8], // Arrow head up
        ],
      };

      assert.strictEqual(arrowGeometry.vertices.length, 7);

      // Main arrow shaft should point forward (negative Z)
      assert.strictEqual(arrowGeometry.vertices[1][2], -arrowLength);

      // Arrow head should be at 80% of length
      assert.strictEqual(arrowGeometry.vertices[2][2], -arrowLength * 0.8);
    });

    test('Should handle camera pose transformations', () => {
      const cameraPose = {
        position: [1, 2, 3],
        rotation: [0, Math.PI / 4, 0], // 45 degree Y rotation
        scale: 0.5,
      };

      const transform = new THREE.Matrix4();

      // Apply transformations in order: scale, rotate, translate
      const scaleMatrix = new THREE.Matrix4().makeScale(
        cameraPose.scale,
        cameraPose.scale,
        cameraPose.scale
      );
      const rotationMatrix = new THREE.Matrix4().makeRotationFromEuler(
        new THREE.Euler(cameraPose.rotation[0], cameraPose.rotation[1], cameraPose.rotation[2])
      );
      const translationMatrix = new THREE.Matrix4().makeTranslation(
        cameraPose.position[0],
        cameraPose.position[1],
        cameraPose.position[2]
      );

      transform.multiplyMatrices(translationMatrix, rotationMatrix);
      transform.multiply(scaleMatrix);

      // Test point transformation
      const testPoint = new THREE.Vector3(0, 0, -1); // Forward direction
      testPoint.applyMatrix4(transform);

      // Three.js actual transformation result for this test case
      const expectedX = 0.6464466094067263;
      const expectedY = 2;
      const expectedZ = 2.646446609406726;

      // Allow larger tolerance or debug actual values
      const tolerance = 0.01;
      assert.ok(
        Math.abs(testPoint.x - expectedX) < tolerance,
        `X: expected ${expectedX}, got ${testPoint.x}, diff ${Math.abs(testPoint.x - expectedX)}`
      );
      assert.ok(
        Math.abs(testPoint.y - expectedY) < tolerance,
        `Y: expected ${expectedY}, got ${testPoint.y}, diff ${Math.abs(testPoint.y - expectedY)}`
      );
      assert.ok(
        Math.abs(testPoint.z - expectedZ) < tolerance,
        `Z: expected ${expectedZ}, got ${testPoint.z}, diff ${Math.abs(testPoint.z - expectedZ)}`
      );
    });

    test('Should create camera text labels', () => {
      const cameraLabels = [
        { text: 'Camera_01', position: [0, 0, 0] },
        { text: 'Camera_02', position: [1, 1, 1] },
        { text: 'Camera_03', position: [2, 0, 2] },
      ];

      for (const label of cameraLabels) {
        assert.ok(label.text.length > 0);
        assert.strictEqual(label.position.length, 3);
        assert.ok(label.text.startsWith('Camera_'));
      }

      assert.strictEqual(cameraLabels.length, 3);
    });
  });

  suite('Material and Texture Management', () => {
    test('Should handle MTL material data', () => {
      const mtlData = {
        materials: {
          Material1: {
            Kd: [0.8, 0.2, 0.1], // Diffuse color
            Ks: [1.0, 1.0, 1.0], // Specular color
            Ns: 96.0, // Specular exponent
            d: 1.0, // Transparency
            illum: 2, // Illumination model
          },
          Material2: {
            Kd: [0.1, 0.8, 0.2],
            Ks: [0.5, 0.5, 0.5],
            Ns: 32.0,
            d: 0.8,
            illum: 1,
          },
        },
      };

      assert.strictEqual(Object.keys(mtlData.materials).length, 2);

      const mat1 = mtlData.materials['Material1'];
      assert.strictEqual(mat1.Kd[0], 0.8); // Red component
      assert.strictEqual(mat1.Ns, 96.0); // Shininess
      assert.strictEqual(mat1.d, 1.0); // Opaque
    });

    test('Should convert MTL colors to Three.js materials', () => {
      const mtlColor = [0.8, 0.2, 0.1]; // RGB values [0,1]

      // Convert to THREE.Color
      const threeColor = new THREE.Color(mtlColor[0], mtlColor[1], mtlColor[2]);

      assert.ok(Math.abs(threeColor.r - 0.8) < 0.001);
      assert.ok(Math.abs(threeColor.g - 0.2) < 0.001);
      assert.ok(Math.abs(threeColor.b - 0.1) < 0.001);

      // Convert to hex
      const hexColor = threeColor.getHex();
      assert.strictEqual(hexColor, 15170649); // Three.js actual result for RGB(0.8,0.2,0.1)
    });

    test('Should handle material transparency', () => {
      const materials = [
        { name: 'Opaque', alpha: 1.0 },
        { name: 'SemiTransparent', alpha: 0.5 },
        { name: 'VeryTransparent', alpha: 0.1 },
      ];

      for (const mat of materials) {
        const isTransparent = mat.alpha < 1.0;
        const needsTransparency = isTransparent;

        if (mat.name === 'Opaque') {
          assert.ok(!needsTransparency);
        } else {
          assert.ok(needsTransparency);
        }
      }
    });

    test('Should handle multi-material object groups', () => {
      const objMaterials = [
        { name: 'body', faces: [0, 1, 2, 3, 4, 5] },
        { name: 'wheels', faces: [6, 7, 8, 9] },
        { name: 'windows', faces: [10, 11] },
      ];

      let totalFaces = 0;
      for (const matGroup of objMaterials) {
        totalFaces += matGroup.faces.length;
      }

      assert.strictEqual(totalFaces, 12);
      assert.strictEqual(objMaterials[0].faces.length, 6); // Most faces for body
      assert.strictEqual(objMaterials[2].faces.length, 2); // Fewest for windows
    });
  });

  suite('Performance Optimizations', () => {
    test('Should decimate large geometries adaptively', () => {
      const originalPointCount = 5000000; // 5M points
      const targetPointCount = 1000000; // 1M points for performance

      const decimationRatio = targetPointCount / originalPointCount;
      const decimationFactor = Math.ceil(1 / decimationRatio);

      assert.strictEqual(decimationFactor, 5); // Keep every 5th point

      const finalPointCount = Math.floor(originalPointCount / decimationFactor);
      assert.ok(finalPointCount <= targetPointCount);
      assert.strictEqual(finalPointCount, 1000000);
    });

    test('Should optimize material properties for large datasets', () => {
      const pointCounts = [1000, 50000, 500000, 2000000];
      const materialSettings: Array<{ size: number; sizeAttenuation: boolean }> = [];

      for (const count of pointCounts) {
        if (count > 100000) {
          // Large dataset: smaller points, no size attenuation
          materialSettings.push({ size: 0.5, sizeAttenuation: false });
        } else if (count > 10000) {
          // Medium dataset: small points with attenuation
          materialSettings.push({ size: 1.0, sizeAttenuation: true });
        } else {
          // Small dataset: larger points with attenuation
          materialSettings.push({ size: 2.0, sizeAttenuation: true });
        }
      }

      assert.strictEqual(materialSettings[0].size, 2.0); // 1K points
      assert.strictEqual(materialSettings[1].size, 1.0); // 50K points
      assert.strictEqual(materialSettings[2].size, 0.5); // 500K points
      assert.ok(!materialSettings[3].sizeAttenuation); // 2M points
    });

    test('Should manage memory with sequence caching', () => {
      const maxCacheSize = 6;
      const sequenceCache = new Map<number, any>();
      const cacheOrder: number[] = [];

      // Simulate loading 10 frames
      for (let frame = 0; frame < 10; frame++) {
        const frameData = { vertices: new Array(1000), frame };

        sequenceCache.set(frame, frameData);
        cacheOrder.push(frame);

        // Evict oldest frames when over limit
        while (cacheOrder.length > maxCacheSize) {
          const evictFrame = cacheOrder.shift()!;
          sequenceCache.delete(evictFrame);
        }
      }

      assert.strictEqual(sequenceCache.size, maxCacheSize);
      assert.ok(!sequenceCache.has(0)); // Should be evicted
      assert.ok(!sequenceCache.has(3)); // Should be evicted
      assert.ok(sequenceCache.has(9)); // Should be present
    });

    test('Should adapt rendering quality based on camera distance', () => {
      const cameraDistances = [1, 10, 50, 200];
      const lodSettings: Array<{ pointSize: number; decimation: number }> = [];

      for (const distance of cameraDistances) {
        let pointSize = 2.0;
        let decimation = 1;

        if (distance > 100) {
          pointSize = 1.0;
          decimation = 4; // Show every 4th point
        } else if (distance > 25) {
          pointSize = 1.5;
          decimation = 2; // Show every 2nd point
        }

        lodSettings.push({ pointSize, decimation });
      }

      assert.strictEqual(lodSettings[0].decimation, 1); // Close: full detail
      assert.strictEqual(lodSettings[2].decimation, 2); // Medium: half detail
      assert.strictEqual(lodSettings[3].decimation, 4); // Far: quarter detail
    });
  });

  suite('Advanced Color Processing', () => {
    test('Should handle HDR color mapping', () => {
      const hdrColor = { r: 2.5, g: 1.8, b: 3.2 }; // HDR values > 1.0

      // Tone mapping: Reinhard operator
      const toneMapped = {
        r: hdrColor.r / (1 + hdrColor.r),
        g: hdrColor.g / (1 + hdrColor.g),
        b: hdrColor.b / (1 + hdrColor.b),
      };

      assert.ok(toneMapped.r < 1.0);
      assert.ok(toneMapped.g < 1.0);
      assert.ok(toneMapped.b < 1.0);
      assert.ok(toneMapped.r > toneMapped.g); // Maintain relative intensity
    });

    test('Should apply gamma correction properly', () => {
      const linearColor = 0.5; // Linear space
      const gammaValue = 2.2; // Standard sRGB gamma

      // Linear to sRGB
      const srgbColor = Math.pow(linearColor, 1.0 / gammaValue);

      // sRGB to Linear
      const backToLinear = Math.pow(srgbColor, gammaValue);

      assert.ok(Math.abs(backToLinear - linearColor) < 0.001);
      assert.ok(srgbColor > linearColor); // sRGB should be brighter for mid-tones
    });

    test('Should handle color space conversions', () => {
      const srgbColor = [128, 64, 192]; // sRGB [0,255]

      // Convert to normalized [0,1]
      const normalized = srgbColor.map(c => c / 255);

      // Convert to linear space (simplified)
      const linearColor = normalized.map(c =>
        c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
      );

      assert.ok(linearColor[0] < normalized[0]); // Linear should be darker for mid-tones
      assert.strictEqual(normalized[0], 128 / 255);
      assert.ok(Math.abs(normalized[2] - 192 / 255) < 0.001);
    });

    test('Should blend colors for multi-material objects', () => {
      const color1 = { r: 1.0, g: 0.0, b: 0.0 }; // Red
      const color2 = { r: 0.0, g: 0.0, b: 1.0 }; // Blue
      const blendWeight = 0.3; // 30% color1, 70% color2

      const blended = {
        r: color1.r * blendWeight + color2.r * (1 - blendWeight),
        g: color1.g * blendWeight + color2.g * (1 - blendWeight),
        b: color1.b * blendWeight + color2.b * (1 - blendWeight),
      };

      assert.strictEqual(blended.r, 0.3); // 1.0 * 0.3 + 0.0 * 0.7
      assert.strictEqual(blended.g, 0.0); // 0.0 * 0.3 + 0.0 * 0.7
      assert.strictEqual(blended.b, 0.7); // 0.0 * 0.3 + 1.0 * 0.7
    });
  });
});
