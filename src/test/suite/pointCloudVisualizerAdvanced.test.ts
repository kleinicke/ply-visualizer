import * as assert from 'assert';
import * as THREE from 'three';

// Extended testable utility methods from PointCloudVisualizer
class PointCloudVisualizerAdvancedUtils {
  // Extracted from parseMatrixInput method
  static parseMatrixInput(input: string): number[] | null {
    const cleanInput = input.trim();
    if (!cleanInput) {return null;}

    // Split by whitespace and/or commas, filter out empty strings
    const parts = cleanInput.split(/[\s,]+/).filter(part => part.length > 0);

    if (parts.length !== 16) {
      return null;
    }

    const numbers: number[] = [];
    for (const part of parts) {
      const num = parseFloat(part);
      if (isNaN(num)) {
        return null;
      }
      numbers.push(num);
    }

    return numbers;
  }

  // Extracted from normalizePose method logic
  static normalizePose(raw: any): {
    joints: Array<{ x: number; y: number; z: number; score?: number; valid?: boolean }>;
    edges: Array<[number, number]>;
  } {
    let joints: Array<{ x: number; y: number; z: number; score?: number; valid?: boolean }> = [];
    let edges: Array<[number, number]> = [];

    if (!raw) {
      return { joints, edges };
    }

    // Handle different pose formats
    if (Array.isArray(raw)) {
      // Array of people/poses
      if (raw.length > 0 && raw[0].keypoints) {
        // Likely a pose estimation result
        const firstPerson = raw[0];
        joints = this.extractJointsFromKeypoints(firstPerson.keypoints);
      } else if (raw.length > 0 && typeof raw[0] === 'object' && 'x' in raw[0]) {
        // Array of joint objects
        joints = raw.map((joint: any) => ({
          x: joint.x || 0,
          y: joint.y || 0,
          z: joint.z || 0,
          score: joint.score,
          valid: joint.valid !== false,
        }));
      }
    } else if (raw.keypoints) {
      joints = this.extractJointsFromKeypoints(raw.keypoints);
    }

    // Auto-generate edges if not provided
    if (joints.length > 1 && edges.length === 0) {
      edges = this.generateBasicSkeleton(joints.length);
    }

    return { joints, edges };
  }

  private static extractJointsFromKeypoints(
    keypoints: any[]
  ): Array<{ x: number; y: number; z: number; score?: number; valid?: boolean }> {
    return keypoints.map((kp: any) => ({
      x: kp.x || kp[0] || 0,
      y: kp.y || kp[1] || 0,
      z: kp.z || kp[2] || 0,
      score: kp.score || kp.confidence,
      valid: kp.valid !== false && (kp.score || kp.confidence || 1) > 0.1,
    }));
  }

  private static generateBasicSkeleton(jointCount: number): Array<[number, number]> {
    const edges: Array<[number, number]> = [];

    // Create a simple chain connection
    for (let i = 0; i < jointCount - 1; i++) {
      edges.push([i, i + 1]);
    }

    return edges;
  }

  // Extracted from autoConnectKnn method
  static autoConnectKnn(
    joints: Array<{ x: number; y: number; z: number }>,
    k: number
  ): Array<[number, number]> {
    if (joints.length < 2 || k <= 0) {
      return [];
    }

    const edges: Array<[number, number]> = [];
    const maxK = Math.min(k, joints.length - 1);

    for (let i = 0; i < joints.length; i++) {
      const distances: Array<{ index: number; distance: number }> = [];

      // Calculate distances to all other joints
      for (let j = 0; j < joints.length; j++) {
        if (i === j) {continue;}

        const dx = joints[i].x - joints[j].x;
        const dy = joints[i].y - joints[j].y;
        const dz = joints[i].z - joints[j].z;
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

        distances.push({ index: j, distance });
      }

      // Sort by distance and take k nearest
      distances.sort((a, b) => a.distance - b.distance);

      // Add edges to k nearest neighbors (avoiding duplicates)
      for (let n = 0; n < maxK; n++) {
        const neighborIndex = distances[n].index;
        const edge: [number, number] = i < neighborIndex ? [i, neighborIndex] : [neighborIndex, i];

        // Check if edge already exists
        const edgeExists = edges.some(e => e[0] === edge[0] && e[1] === edge[1]);
        if (!edgeExists) {
          edges.push(edge);
        }
      }
    }

    return edges;
  }

  // Camera parameter utilities
  static validateCameraLocation(location: number[]): boolean {
    return (
      location.length === 3 && location.every(coord => typeof coord === 'number' && !isNaN(coord))
    );
  }

  static validateRotationQuaternion(quat: number[]): boolean {
    if (quat.length !== 4) {return false;}
    if (quat.some(val => typeof val !== 'number' || isNaN(val))) {return false;}

    // Check if quaternion is normalized (approximately)
    const magnitude = Math.sqrt(
      quat[0] * quat[0] + quat[1] * quat[1] + quat[2] * quat[2] + quat[3] * quat[3]
    );
    return Math.abs(magnitude - 1.0) < 0.1; // Allow some tolerance
  }

  // PLY content generation utilities
  static generatePlyHeader(
    vertexCount: number,
    faceCount: number,
    hasColors: boolean,
    hasNormals: boolean
  ): string {
    let header = 'ply\nformat ascii 1.0\n';
    header += `element vertex ${vertexCount}\n`;
    header += 'property float x\n';
    header += 'property float y\n';
    header += 'property float z\n';

    if (hasNormals) {
      header += 'property float nx\n';
      header += 'property float ny\n';
      header += 'property float nz\n';
    }

    if (hasColors) {
      header += 'property uchar red\n';
      header += 'property uchar green\n';
      header += 'property uchar blue\n';
    }

    if (faceCount > 0) {
      header += `element face ${faceCount}\n`;
      header += 'property list uchar int vertex_indices\n';
    }

    header += 'end_header\n';
    return header;
  }

  static formatPlyVertex(vertex: {
    x: number;
    y: number;
    z: number;
    red?: number;
    green?: number;
    blue?: number;
    nx?: number;
    ny?: number;
    nz?: number;
  }): string {
    let line = `${vertex.x} ${vertex.y} ${vertex.z}`;

    if (vertex.nx !== undefined && vertex.ny !== undefined && vertex.nz !== undefined) {
      line += ` ${vertex.nx} ${vertex.ny} ${vertex.nz}`;
    }

    if (vertex.red !== undefined && vertex.green !== undefined && vertex.blue !== undefined) {
      // Ensure color values are in 0-255 range
      const r = Math.max(0, Math.min(255, Math.round(vertex.red)));
      const g = Math.max(0, Math.min(255, Math.round(vertex.green)));
      const b = Math.max(0, Math.min(255, Math.round(vertex.blue)));
      line += ` ${r} ${g} ${b}`;
    }

    return line;
  }

  // Depth form utilities
  static validateDepthFormValues(formValues: any): boolean {
    if (!formValues) {return false;}

    const requiredFields = ['fx', 'fy', 'cx', 'cy'];
    return requiredFields.every(field => {
      const value = formValues[field];
      return typeof value === 'number' && !isNaN(value) && value > 0;
    });
  }

  static sanitizeDepthFormValues(formValues: any): any {
    if (!formValues) {return {};}

    const sanitized: any = {};
    const numericFields = ['fx', 'fy', 'cx', 'cy', 'baseline', 'doffs'];

    for (const field of numericFields) {
      if (formValues[field] !== undefined) {
        const value = parseFloat(formValues[field]);
        sanitized[field] = isNaN(value) ? 0 : value;
      }
    }

    // Handle boolean fields
    if (formValues.invertDepth !== undefined) {
      sanitized.invertDepth = Boolean(formValues.invertDepth);
    }

    return sanitized;
  }

  // Color processing utilities
  static applyGammaCorrection(color: number, gamma: number): number {
    if (gamma <= 0) {return color;}
    return Math.pow(Math.max(0, Math.min(1, color)), 1 / gamma);
  }

  static linearToSrgb(linear: number): number {
    if (linear <= 0.0031308) {
      return linear * 12.92;
    } else {
      return 1.055 * Math.pow(linear, 1 / 2.4) - 0.055;
    }
  }

  static srgbToLinear(srgb: number): number {
    if (srgb <= 0.04045) {
      return srgb / 12.92;
    } else {
      return Math.pow((srgb + 0.055) / 1.055, 2.4);
    }
  }

  // Distance and bounding calculations
  static calculateBoundingBox(vertices: Array<{ x: number; y: number; z: number }>): {
    min: { x: number; y: number; z: number };
    max: { x: number; y: number; z: number };
  } {
    if (vertices.length === 0) {
      return {
        min: { x: 0, y: 0, z: 0 },
        max: { x: 0, y: 0, z: 0 },
      };
    }

    const min = { x: vertices[0].x, y: vertices[0].y, z: vertices[0].z };
    const max = { x: vertices[0].x, y: vertices[0].y, z: vertices[0].z };

    for (let i = 1; i < vertices.length; i++) {
      const v = vertices[i];
      min.x = Math.min(min.x, v.x);
      min.y = Math.min(min.y, v.y);
      min.z = Math.min(min.z, v.z);
      max.x = Math.max(max.x, v.x);
      max.y = Math.max(max.y, v.y);
      max.z = Math.max(max.z, v.z);
    }

    return { min, max };
  }

  static calculateCentroid(vertices: Array<{ x: number; y: number; z: number }>): {
    x: number;
    y: number;
    z: number;
  } {
    if (vertices.length === 0) {
      return { x: 0, y: 0, z: 0 };
    }

    let sumX = 0,
      sumY = 0,
      sumZ = 0;
    for (const vertex of vertices) {
      sumX += vertex.x;
      sumY += vertex.y;
      sumZ += vertex.z;
    }

    return {
      x: sumX / vertices.length,
      y: sumY / vertices.length,
      z: sumZ / vertices.length,
    };
  }
}

suite('Point Cloud Visualizer Advanced Test Suite', () => {
  test('Should parse matrix input correctly', () => {
    // Valid 4x4 identity matrix
    const identityStr = '1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 1';
    const identity = PointCloudVisualizerAdvancedUtils.parseMatrixInput(identityStr);
    assert.ok(identity);
    assert.strictEqual(identity.length, 16);
    assert.deepStrictEqual(identity, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

    // Valid matrix with commas
    const commaStr = '1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1';
    const commaParsed = PointCloudVisualizerAdvancedUtils.parseMatrixInput(commaStr);
    assert.deepStrictEqual(commaParsed, identity);

    // Valid matrix with mixed separators
    const mixedStr = '1, 0 0 0,0 1 0,0 0,0 1 0 0 0,0 1';
    const mixedParsed = PointCloudVisualizerAdvancedUtils.parseMatrixInput(mixedStr);
    assert.deepStrictEqual(mixedParsed, identity);

    // Invalid inputs
    assert.strictEqual(PointCloudVisualizerAdvancedUtils.parseMatrixInput(''), null);
    assert.strictEqual(PointCloudVisualizerAdvancedUtils.parseMatrixInput('1 2 3'), null); // Too few elements
    assert.strictEqual(
      PointCloudVisualizerAdvancedUtils.parseMatrixInput('1 2 3 a b c d e f g h i j k l m'),
      null
    ); // Invalid numbers
  });

  test('Should normalize pose data correctly', () => {
    // Test with keypoints format
    const keypointsData = {
      keypoints: [
        { x: 1, y: 2, z: 3, score: 0.9 },
        { x: 4, y: 5, z: 6, score: 0.8 },
        { x: 7, y: 8, z: 9, score: 0.7 },
      ],
    };

    const normalized = PointCloudVisualizerAdvancedUtils.normalizePose(keypointsData);
    assert.strictEqual(normalized.joints.length, 3);
    assert.strictEqual(normalized.joints[0].x, 1);
    assert.strictEqual(normalized.joints[0].score, 0.9);
    assert.ok(normalized.edges.length > 0); // Should auto-generate edges

    // Test with array format
    const arrayData = [
      {
        keypoints: [
          { x: 1, y: 1, z: 1 },
          { x: 2, y: 2, z: 2 },
        ],
      },
    ];
    const arrayNormalized = PointCloudVisualizerAdvancedUtils.normalizePose(arrayData);
    assert.strictEqual(arrayNormalized.joints.length, 2);

    // Test with empty/null data
    const emptyNormalized = PointCloudVisualizerAdvancedUtils.normalizePose(null);
    assert.strictEqual(emptyNormalized.joints.length, 0);
    assert.strictEqual(emptyNormalized.edges.length, 0);
  });

  test('Should auto-connect K-nearest neighbors correctly', () => {
    const joints = [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
      { x: 2, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 },
    ];

    // Test k=1 (each joint connected to nearest neighbor)
    const edges1 = PointCloudVisualizerAdvancedUtils.autoConnectKnn(joints, 1);
    assert.ok(edges1.length > 0);

    // Each edge should be a valid pair
    edges1.forEach(edge => {
      assert.ok(edge[0] < edge[1]); // Should be sorted
      assert.ok(edge[0] >= 0 && edge[0] < joints.length);
      assert.ok(edge[1] >= 0 && edge[1] < joints.length);
    });

    // Test k=2
    const edges2 = PointCloudVisualizerAdvancedUtils.autoConnectKnn(joints, 2);
    assert.ok(edges2.length >= edges1.length);

    // Test edge cases
    assert.deepStrictEqual(PointCloudVisualizerAdvancedUtils.autoConnectKnn([], 1), []);
    assert.deepStrictEqual(PointCloudVisualizerAdvancedUtils.autoConnectKnn(joints, 0), []);
  });

  test('Should validate camera parameters correctly', () => {
    // Valid location
    assert.ok(PointCloudVisualizerAdvancedUtils.validateCameraLocation([1, 2, 3]));
    assert.ok(PointCloudVisualizerAdvancedUtils.validateCameraLocation([0, 0, 0]));
    assert.ok(PointCloudVisualizerAdvancedUtils.validateCameraLocation([-1, -2, -3]));

    // Invalid locations
    assert.ok(!PointCloudVisualizerAdvancedUtils.validateCameraLocation([1, 2])); // Too few
    assert.ok(!PointCloudVisualizerAdvancedUtils.validateCameraLocation([1, 2, 3, 4])); // Too many
    assert.ok(!PointCloudVisualizerAdvancedUtils.validateCameraLocation([1, 'a' as any, 3])); // Non-numeric
    assert.ok(!PointCloudVisualizerAdvancedUtils.validateCameraLocation([1, NaN, 3])); // NaN

    // Valid quaternions (approximately normalized)
    assert.ok(PointCloudVisualizerAdvancedUtils.validateRotationQuaternion([0, 0, 0, 1])); // Identity
    assert.ok(PointCloudVisualizerAdvancedUtils.validateRotationQuaternion([1, 0, 0, 0])); // 180° around x
    assert.ok(PointCloudVisualizerAdvancedUtils.validateRotationQuaternion([0.707, 0, 0, 0.707])); // 90° around x

    // Invalid quaternions
    assert.ok(!PointCloudVisualizerAdvancedUtils.validateRotationQuaternion([0, 0, 1])); // Too few
    assert.ok(!PointCloudVisualizerAdvancedUtils.validateRotationQuaternion([10, 0, 0, 0])); // Not normalized
    assert.ok(!PointCloudVisualizerAdvancedUtils.validateRotationQuaternion([NaN, 0, 0, 1])); // NaN
  });

  test('Should generate PLY headers correctly', () => {
    // Basic header
    const basicHeader = PointCloudVisualizerAdvancedUtils.generatePlyHeader(100, 0, false, false);
    assert.ok(basicHeader.includes('ply'));
    assert.ok(basicHeader.includes('element vertex 100'));
    assert.ok(basicHeader.includes('property float x'));
    assert.ok(basicHeader.includes('end_header'));
    assert.ok(!basicHeader.includes('red')); // No colors
    assert.ok(!basicHeader.includes('nx')); // No normals

    // Header with colors and normals
    const fullHeader = PointCloudVisualizerAdvancedUtils.generatePlyHeader(50, 25, true, true);
    assert.ok(fullHeader.includes('element vertex 50'));
    assert.ok(fullHeader.includes('element face 25'));
    assert.ok(fullHeader.includes('property uchar red'));
    assert.ok(fullHeader.includes('property float nx'));
  });

  test('Should format PLY vertices correctly', () => {
    // Basic vertex
    const basicVertex = { x: 1.5, y: 2.5, z: 3.5 };
    const basicFormatted = PointCloudVisualizerAdvancedUtils.formatPlyVertex(basicVertex);
    assert.strictEqual(basicFormatted, '1.5 2.5 3.5');

    // Vertex with colors
    const colorVertex = { x: 1, y: 2, z: 3, red: 255, green: 128, blue: 0 };
    const colorFormatted = PointCloudVisualizerAdvancedUtils.formatPlyVertex(colorVertex);
    assert.ok(colorFormatted.includes('255 128 0'));

    // Vertex with normals
    const normalVertex = { x: 1, y: 2, z: 3, nx: 0.5, ny: -0.5, nz: 0.707 };
    const normalFormatted = PointCloudVisualizerAdvancedUtils.formatPlyVertex(normalVertex);
    assert.ok(normalFormatted.includes('0.5 -0.5 0.707'));

    // Vertex with everything
    const fullVertex = { x: 1, y: 2, z: 3, nx: 1, ny: 0, nz: 0, red: 255, green: 0, blue: 0 };
    const fullFormatted = PointCloudVisualizerAdvancedUtils.formatPlyVertex(fullVertex);
    assert.ok(fullFormatted.includes('1 2 3'));
    assert.ok(fullFormatted.includes('1 0 0'));
    assert.ok(fullFormatted.includes('255 0 0'));
  });

  test('Should validate and sanitize depth form values', () => {
    // Valid form values
    const validForm = { fx: 525, fy: 525, cx: 320, cy: 240 };
    assert.ok(PointCloudVisualizerAdvancedUtils.validateDepthFormValues(validForm));

    // Invalid form values
    assert.ok(!PointCloudVisualizerAdvancedUtils.validateDepthFormValues(null));
    assert.ok(!PointCloudVisualizerAdvancedUtils.validateDepthFormValues({ fx: 525 })); // Missing fields
    assert.ok(
      !PointCloudVisualizerAdvancedUtils.validateDepthFormValues({
        fx: 0,
        fy: 525,
        cx: 320,
        cy: 240,
      })
    ); // Zero value

    // Test sanitization
    const dirtyForm = { fx: '525.5', fy: 'invalid', cx: '320', invertDepth: 'true' };
    const sanitized = PointCloudVisualizerAdvancedUtils.sanitizeDepthFormValues(dirtyForm);
    assert.strictEqual(sanitized.fx, 525.5);
    assert.strictEqual(sanitized.fy, 0); // Invalid becomes 0
    assert.strictEqual(sanitized.cx, 320);
    assert.strictEqual(sanitized.invertDepth, true);
  });

  test('Should apply gamma correction correctly', () => {
    // Test standard gamma correction
    assert.ok(
      Math.abs(
        PointCloudVisualizerAdvancedUtils.applyGammaCorrection(0.5, 2.2) - Math.pow(0.5, 1 / 2.2)
      ) < 0.0001
    );

    // Test edge cases
    assert.strictEqual(PointCloudVisualizerAdvancedUtils.applyGammaCorrection(0, 2.2), 0);
    assert.strictEqual(PointCloudVisualizerAdvancedUtils.applyGammaCorrection(1, 2.2), 1);
    assert.strictEqual(PointCloudVisualizerAdvancedUtils.applyGammaCorrection(0.5, 0), 0.5); // Invalid gamma
  });

  test('Should convert between linear and sRGB correctly', () => {
    // Test sRGB to linear conversion
    assert.strictEqual(PointCloudVisualizerAdvancedUtils.srgbToLinear(0), 0);
    assert.strictEqual(PointCloudVisualizerAdvancedUtils.srgbToLinear(1), 1);

    // Test linear to sRGB conversion (allowing for floating point precision)
    assert.strictEqual(PointCloudVisualizerAdvancedUtils.linearToSrgb(0), 0);
    assert.ok(Math.abs(PointCloudVisualizerAdvancedUtils.linearToSrgb(1) - 1) < 0.0001);

    // Test round-trip conversion
    const testValue = 0.5;
    const linear = PointCloudVisualizerAdvancedUtils.srgbToLinear(testValue);
    const backToSrgb = PointCloudVisualizerAdvancedUtils.linearToSrgb(linear);
    assert.ok(Math.abs(testValue - backToSrgb) < 0.0001);
  });

  test('Should calculate bounding boxes correctly', () => {
    const vertices = [
      { x: 1, y: 2, z: 3 },
      { x: -1, y: 5, z: 0 },
      { x: 3, y: -2, z: 7 },
    ];

    const bbox = PointCloudVisualizerAdvancedUtils.calculateBoundingBox(vertices);
    assert.deepStrictEqual(bbox.min, { x: -1, y: -2, z: 0 });
    assert.deepStrictEqual(bbox.max, { x: 3, y: 5, z: 7 });

    // Test empty array
    const emptyBbox = PointCloudVisualizerAdvancedUtils.calculateBoundingBox([]);
    assert.deepStrictEqual(emptyBbox.min, { x: 0, y: 0, z: 0 });
    assert.deepStrictEqual(emptyBbox.max, { x: 0, y: 0, z: 0 });
  });

  test('Should calculate centroids correctly', () => {
    const vertices = [
      { x: 0, y: 0, z: 0 },
      { x: 2, y: 4, z: 6 },
      { x: 4, y: 8, z: 12 },
    ];

    const centroid = PointCloudVisualizerAdvancedUtils.calculateCentroid(vertices);
    assert.deepStrictEqual(centroid, { x: 2, y: 4, z: 6 });

    // Test single vertex
    const singleCentroid = PointCloudVisualizerAdvancedUtils.calculateCentroid([
      { x: 5, y: 10, z: 15 },
    ]);
    assert.deepStrictEqual(singleCentroid, { x: 5, y: 10, z: 15 });

    // Test empty array
    const emptyCentroid = PointCloudVisualizerAdvancedUtils.calculateCentroid([]);
    assert.deepStrictEqual(emptyCentroid, { x: 0, y: 0, z: 0 });
  });
});
