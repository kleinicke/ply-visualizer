import { describe, it, expect } from 'vitest';
import { parsePointCloudBinaryData } from '../website/src/utils/binaryDataParser';

describe('NaN Handling in Binary Parser', () => {
  it('should filter out NaN values and replace with defaults', () => {
    const vertexCount = 3;
    const stride = 12; // Just positions for simplicity
    const buffer = new ArrayBuffer(vertexCount * stride);
    const view = new DataView(buffer);

    // Create data with some NaN values
    // Vertex 0: valid data
    view.setFloat32(0, 1.0, true);
    view.setFloat32(4, 2.0, true);
    view.setFloat32(8, 3.0, true);

    // Vertex 1: NaN in x coordinate
    view.setFloat32(12, NaN, true);
    view.setFloat32(16, 4.0, true);
    view.setFloat32(20, 5.0, true);

    // Vertex 2: valid data
    view.setFloat32(24, 6.0, true);
    view.setFloat32(28, 7.0, true);
    view.setFloat32(32, 8.0, true);

    const message = {
      type: 'ultimateRawBinaryData',
      fileName: 'nan_test.ply',
      vertexCount,
      faceCount: 0,
      hasColors: false,
      hasNormals: false,
      format: 'binary_little_endian',
      rawBinaryData: buffer,
      vertexStride: stride,
      propertyOffsets: [
        'x',
        { type: 'float', size: 4 },
        'y',
        { type: 'float', size: 4 },
        'z',
        { type: 'float', size: 4 },
      ], // x, y, z with metadata
      littleEndian: true,
    };

    const result = parsePointCloudBinaryData(message);

    // Should have replaced NaN with 0
    expect(result.positions[0]).toBe(1.0); // Vertex 0 x
    expect(result.positions[1]).toBe(2.0); // Vertex 0 y
    expect(result.positions[2]).toBe(3.0); // Vertex 0 z

    expect(result.positions[3]).toBe(0.0); // Vertex 1 x (was NaN, now 0)
    expect(result.positions[4]).toBe(4.0); // Vertex 1 y
    expect(result.positions[5]).toBe(5.0); // Vertex 1 z

    expect(result.positions[6]).toBe(6.0); // Vertex 2 x
    expect(result.positions[7]).toBe(7.0); // Vertex 2 y
    expect(result.positions[8]).toBe(8.0); // Vertex 2 z

    // All positions should be finite
    for (let i = 0; i < result.positions.length; i++) {
      expect(isFinite(result.positions[i])).toBe(true);
    }
  });

  it('should use propertyOffsets when provided', () => {
    const vertexCount = 2;
    const stride = 20; // Custom stride
    const buffer = new ArrayBuffer(vertexCount * stride);
    const view = new DataView(buffer);

    // Custom layout: [unused, unused, x, y, z, unused, ...]
    // Vertex 0
    view.setFloat32(8, 10.0, true); // x at offset 8
    view.setFloat32(12, 20.0, true); // y at offset 12
    view.setFloat32(16, 30.0, true); // z at offset 16

    // Vertex 1
    view.setFloat32(28, 40.0, true); // x at offset 28 (8 + 20)
    view.setFloat32(32, 50.0, true); // y at offset 32 (12 + 20)
    view.setFloat32(36, 60.0, true); // z at offset 36 (16 + 20)

    const message = {
      type: 'ultimateRawBinaryData',
      fileName: 'custom_layout.ply',
      vertexCount,
      faceCount: 0,
      hasColors: false,
      hasNormals: false,
      format: 'binary_little_endian',
      rawBinaryData: buffer,
      vertexStride: stride,
      propertyOffsets: [
        'padding1',
        { type: 'uint32', size: 4 },
        'padding2',
        { type: 'uint32', size: 4 },
        'x',
        { type: 'float', size: 4 },
        'y',
        { type: 'float', size: 4 },
        'z',
        { type: 'float', size: 4 },
      ], // Custom layout with x,y,z at offsets 8,12,16
      littleEndian: true,
    };

    const result = parsePointCloudBinaryData(message);

    expect(result.positions[0]).toBe(10.0);
    expect(result.positions[1]).toBe(20.0);
    expect(result.positions[2]).toBe(30.0);
    expect(result.positions[3]).toBe(40.0);
    expect(result.positions[4]).toBe(50.0);
    expect(result.positions[5]).toBe(60.0);
  });
});
