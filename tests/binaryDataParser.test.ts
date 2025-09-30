import { describe, it, expect } from 'vitest';
import {
  parsePointCloudBinaryData,
  type PointCloudMessage,
} from '../website/src/utils/binaryDataParser';

describe('Binary Data Parser', () => {
  it('should parse simple point cloud with positions only', () => {
    // Create test binary data (3 points, positions only)
    const vertexCount = 3;
    const stride = 12; // 3 floats * 4 bytes = 12 bytes per vertex
    const totalSize = vertexCount * stride;

    const buffer = new ArrayBuffer(totalSize);
    const view = new DataView(buffer);

    // Write test positions
    const expectedPositions = [
      [0.0, 0.0, 0.0], // Point 1
      [1.0, 0.0, 0.0], // Point 2
      [0.0, 1.0, 0.0], // Point 3
    ];

    let offset = 0;
    for (const [x, y, z] of expectedPositions) {
      view.setFloat32(offset, x, true); // x
      view.setFloat32(offset + 4, y, true); // y
      view.setFloat32(offset + 8, z, true); // z
      offset += stride;
    }

    const message: PointCloudMessage = {
      type: 'ultimateRawBinaryData',
      fileName: 'test.ply',
      vertexCount,
      faceCount: 0,
      hasColors: false,
      hasNormals: false,
      format: 'binary_little_endian',
      rawBinaryData: buffer,
      vertexStride: stride,
      propertyOffsets: [0, 4, 8],
      littleEndian: true,
    };

    const result = parsePointCloudBinaryData(message);

    expect(result.vertexCount).toBe(3);
    expect(result.positions).toHaveLength(9); // 3 vertices * 3 components
    expect(result.colors).toBeUndefined();
    expect(result.normals).toBeUndefined();

    // Check position values
    for (let i = 0; i < vertexCount; i++) {
      expect(result.positions[i * 3]).toBeCloseTo(expectedPositions[i][0], 5);
      expect(result.positions[i * 3 + 1]).toBeCloseTo(expectedPositions[i][1], 5);
      expect(result.positions[i * 3 + 2]).toBeCloseTo(expectedPositions[i][2], 5);
    }
  });

  it('should parse point cloud with positions and colors', () => {
    // Create test binary data (2 points, positions + colors)
    const vertexCount = 2;
    const stride = 15; // 3 floats (12 bytes) + 3 uint8 colors (3 bytes) = 15 bytes per vertex
    const totalSize = vertexCount * stride;

    const buffer = new ArrayBuffer(totalSize);
    const view = new DataView(buffer);

    // Write test data
    const testData = [
      { pos: [1.0, 2.0, 3.0], color: [255, 0, 0] }, // Red point
      { pos: [4.0, 5.0, 6.0], color: [0, 255, 0] }, // Green point
    ];

    let offset = 0;
    for (const { pos, color } of testData) {
      // Write position (3 floats)
      view.setFloat32(offset, pos[0], true);
      view.setFloat32(offset + 4, pos[1], true);
      view.setFloat32(offset + 8, pos[2], true);

      // Write color (3 uint8)
      view.setUint8(offset + 12, color[0]);
      view.setUint8(offset + 13, color[1]);
      view.setUint8(offset + 14, color[2]);

      offset += stride;
    }

    const message: PointCloudMessage = {
      type: 'ultimateRawBinaryData',
      fileName: 'test_colored.ply',
      vertexCount,
      faceCount: 0,
      hasColors: true,
      hasNormals: false,
      format: 'binary_little_endian',
      rawBinaryData: buffer,
      vertexStride: stride,
      propertyOffsets: [0, 4, 8, 12, 13, 14],
      littleEndian: true,
    };

    const result = parsePointCloudBinaryData(message);

    expect(result.vertexCount).toBe(2);
    expect(result.positions).toHaveLength(6); // 2 vertices * 3 components
    expect(result.colors).toHaveLength(6); // 2 vertices * 3 components
    expect(result.normals).toBeUndefined();

    // Check position values
    expect(result.positions[0]).toBeCloseTo(1.0, 5);
    expect(result.positions[1]).toBeCloseTo(2.0, 5);
    expect(result.positions[2]).toBeCloseTo(3.0, 5);
    expect(result.positions[3]).toBeCloseTo(4.0, 5);
    expect(result.positions[4]).toBeCloseTo(5.0, 5);
    expect(result.positions[5]).toBeCloseTo(6.0, 5);

    // Check color values (normalized to 0-1)
    expect(result.colors![0]).toBeCloseTo(1.0, 5); // Red = 255/255 = 1.0
    expect(result.colors![1]).toBeCloseTo(0.0, 5); // Green = 0/255 = 0.0
    expect(result.colors![2]).toBeCloseTo(0.0, 5); // Blue = 0/255 = 0.0
    expect(result.colors![3]).toBeCloseTo(0.0, 5); // Red = 0/255 = 0.0
    expect(result.colors![4]).toBeCloseTo(1.0, 5); // Green = 255/255 = 1.0
    expect(result.colors![5]).toBeCloseTo(0.0, 5); // Blue = 0/255 = 0.0
  });

  it('should handle the actual message format from your console output', () => {
    // This test uses the exact format from your console:
    // vertexCount: 1250, vertexStride: 51, hasColors: true, hasNormals: true
    const vertexCount = 3; // Use smaller number for test
    const stride = 51;
    const totalSize = vertexCount * stride;

    const buffer = new ArrayBuffer(totalSize);
    const view = new DataView(buffer);

    // Create realistic test data matching PLY format
    const testVertices = [
      { pos: [0.1, 0.2, 0.3], normal: [0.0, 0.0, 1.0], color: [128, 64, 192] },
      { pos: [1.1, 1.2, 1.3], normal: [0.0, 1.0, 0.0], color: [255, 128, 64] },
      { pos: [2.1, 2.2, 2.3], normal: [1.0, 0.0, 0.0], color: [64, 255, 128] },
    ];

    for (let i = 0; i < vertexCount; i++) {
      const offset = i * stride;
      const vertex = testVertices[i];

      // Position (floats at offset 0, 4, 8)
      view.setFloat32(offset + 0, vertex.pos[0], true);
      view.setFloat32(offset + 4, vertex.pos[1], true);
      view.setFloat32(offset + 8, vertex.pos[2], true);

      // Normal (floats at offset 12, 16, 20)
      view.setFloat32(offset + 12, vertex.normal[0], true);
      view.setFloat32(offset + 16, vertex.normal[1], true);
      view.setFloat32(offset + 20, vertex.normal[2], true);

      // Color (uint8 at offset 24, 25, 26) - assuming this is where colors are
      view.setUint8(offset + 24, vertex.color[0]);
      view.setUint8(offset + 25, vertex.color[1]);
      view.setUint8(offset + 26, vertex.color[2]);
    }

    const message: PointCloudMessage = {
      type: 'ultimateRawBinaryData',
      fileName: 'sample_pointcloud.ply',
      vertexCount,
      faceCount: 0,
      hasColors: true,
      hasNormals: true,
      format: 'binary_little_endian',
      rawBinaryData: buffer,
      vertexStride: stride,
      propertyOffsets: [0, 4, 8, 12, 16, 20, 24, 25, 26], // x,y,z,nx,ny,nz,r,g,b
      littleEndian: true,
    };

    const result = parsePointCloudBinaryData(message);

    expect(result.vertexCount).toBe(3);
    expect(result.positions).toHaveLength(9);
    expect(result.colors).toHaveLength(9);
    expect(result.normals).toHaveLength(9);

    // Verify first vertex
    expect(result.positions[0]).toBeCloseTo(0.1, 5);
    expect(result.positions[1]).toBeCloseTo(0.2, 5);
    expect(result.positions[2]).toBeCloseTo(0.3, 5);

    expect(result.normals![0]).toBeCloseTo(0.0, 5);
    expect(result.normals![1]).toBeCloseTo(0.0, 5);
    expect(result.normals![2]).toBeCloseTo(1.0, 5);

    expect(result.colors![0]).toBeCloseTo(128 / 255, 5);
    expect(result.colors![1]).toBeCloseTo(64 / 255, 5);
    expect(result.colors![2]).toBeCloseTo(192 / 255, 5);
  });

  it('should throw error when no binary data is provided', () => {
    const message: PointCloudMessage = {
      type: 'ultimateRawBinaryData',
      fileName: 'test.ply',
      vertexCount: 10,
      faceCount: 0,
      hasColors: false,
      hasNormals: false,
      format: 'binary_little_endian',
      // No rawBinaryData or binaryData
      vertexStride: 12,
      propertyOffsets: [0, 4, 8],
      littleEndian: true,
    };

    expect(() => parsePointCloudBinaryData(message)).toThrow('No binary data found in message');
  });
});
