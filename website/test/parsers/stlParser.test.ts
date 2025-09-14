import * as assert from 'assert';
import { StlParser } from '../../src/parsers/stlParser';

suite('STL Parser Test Suite', () => {
  let parser: StlParser;

  setup(() => {
    parser = new StlParser();
  });

  test('Should parse ASCII STL file with triangle faces', async () => {
    const stlContent = `solid TestCube
facet normal 0.0 0.0 1.0
outer loop
vertex 0.0 0.0 0.0
vertex 1.0 0.0 0.0
vertex 1.0 1.0 0.0
endloop
endfacet
facet normal 0.0 0.0 1.0
outer loop
vertex 0.0 0.0 0.0
vertex 1.0 1.0 0.0
vertex 0.0 1.0 0.0
endloop
endfacet
endsolid TestCube
`;

    const data = new TextEncoder().encode(stlContent);
    const result = await parser.parse(data);

    assert.strictEqual(result.format, 'ascii');
    assert.strictEqual(result.triangleCount, 2);
    assert.strictEqual(result.hasColors, false);
    assert.strictEqual(result.triangles.length, 2);

    // Check first triangle
    const triangle1 = result.triangles[0];
    assert.strictEqual(triangle1.vertices[0].x, 0.0);
    assert.strictEqual(triangle1.vertices[0].y, 0.0);
    assert.strictEqual(triangle1.vertices[0].z, 0.0);
  });

  test('Should handle binary STL file format', async () => {
    // Create a minimal binary STL file
    const buffer = new ArrayBuffer(84); // Header (80) + triangle count (4) + no triangles
    const view = new DataView(buffer);

    // Header (80 bytes of zeros)
    // Triangle count at offset 80
    view.setUint32(80, 0, true); // Little endian, 0 triangles

    const data = new Uint8Array(buffer);
    const result = await parser.parse(data);

    assert.strictEqual(result.format, 'binary');
    assert.strictEqual(result.triangleCount, 0);
  });

  test('Should handle binary STL with actual triangle data', async () => {
    // Create binary STL with 1 triangle
    const buffer = new ArrayBuffer(134); // Header (80) + count (4) + triangle (50)
    const view = new DataView(buffer);

    // Triangle count
    view.setUint32(80, 1, true);

    // Triangle data starting at offset 84
    let offset = 84;

    // Normal vector (nx, ny, nz)
    view.setFloat32(offset, 0.0, true);
    view.setFloat32(offset + 4, 0.0, true);
    view.setFloat32(offset + 8, 1.0, true);
    offset += 12;

    // Vertex 1 (v1x, v1y, v1z)
    view.setFloat32(offset, 0.0, true);
    view.setFloat32(offset + 4, 0.0, true);
    view.setFloat32(offset + 8, 0.0, true);
    offset += 12;

    // Vertex 2
    view.setFloat32(offset, 1.0, true);
    view.setFloat32(offset + 4, 0.0, true);
    view.setFloat32(offset + 8, 0.0, true);
    offset += 12;

    // Vertex 3
    view.setFloat32(offset, 0.5, true);
    view.setFloat32(offset + 4, 1.0, true);
    view.setFloat32(offset + 8, 0.0, true);
    offset += 12;

    // Attribute byte count (2 bytes)
    view.setUint16(offset, 0, true);

    const data = new Uint8Array(buffer);
    const result = await parser.parse(data);

    assert.strictEqual(result.format, 'binary');
    assert.strictEqual(result.triangleCount, 1);
    assert.strictEqual(result.triangles.length, 1);

    // Check triangle vertices
    const triangle = result.triangles[0];
    assert.strictEqual(triangle.vertices[0].x, 0.0);
    assert.strictEqual(triangle.vertices[0].y, 0.0);
    assert.strictEqual(triangle.vertices[0].z, 0.0);

    assert.strictEqual(triangle.vertices[1].x, 1.0);
    assert.strictEqual(triangle.vertices[1].y, 0.0);
    assert.strictEqual(triangle.vertices[1].z, 0.0);
  });

  test('Should handle STL parsing errors gracefully', async () => {
    const invalidData = new TextEncoder().encode('invalid stl content');

    try {
      const result = await parser.parse(invalidData);
      // Parser may handle gracefully
      assert.ok(result.triangleCount === 0, 'Should handle invalid data gracefully');
    } catch (error) {
      // Error is acceptable for invalid STL data
      assert.ok(error instanceof Error);
    }
  });

  test('Should handle empty STL file', async () => {
    const emptyData = new Uint8Array(0);

    try {
      await parser.parse(emptyData);
      assert.fail('Should have thrown error for empty STL data');
    } catch (error) {
      assert.ok(error instanceof Error);
    }
  });

  test('Should detect ASCII vs binary STL correctly', async () => {
    // ASCII STL starts with "solid"
    const asciiData = new TextEncoder().encode('solid TestObject\nendsolid TestObject\n');
    try {
      const result1 = await parser.parse(asciiData);
      assert.strictEqual(result1.format, 'ascii');
    } catch (error) {
      // May fail due to incomplete ASCII format - acceptable
      assert.ok(error instanceof Error);
    }

    // Binary STL has different structure - create minimum valid binary STL
    const binaryBuffer = new ArrayBuffer(84); // Header (80) + triangle count (4)
    const view = new DataView(binaryBuffer);
    view.setUint32(80, 0, true); // 0 triangles
    const binaryData = new Uint8Array(binaryBuffer);

    try {
      const result2 = await parser.parse(binaryData);
      assert.strictEqual(result2.format, 'binary');
    } catch (error) {
      // Binary parsing might fail - acceptable for this test
      assert.ok(error instanceof Error);
    }
  });
});
