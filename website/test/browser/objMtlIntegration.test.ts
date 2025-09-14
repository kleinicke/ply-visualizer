import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import { ObjParser } from '../../src/parsers/objParser';
import { MtlParser } from '../../src/parsers/mtlParser';

suite('OBJ+MTL Integration Test Suite', () => {
  let objParser: ObjParser;
  let mtlParser: MtlParser;

  setup(() => {
    objParser = new ObjParser();
    mtlParser = new MtlParser();
  });

  test('Should parse OBJ and its referenced MTL file', async () => {
    const objContent = `mtllib test.mtl
usemtl red
v 0.0 0.0 0.0
v 1.0 0.0 0.0
v 0.5 1.0 0.0
l 1 2
l 2 3
l 3 1
`;

    const mtlContent = `newmtl red
Kd 1.0 0.0 0.0
Ka 0.0 0.0 0.0
Ks 0.0 0.0 0.0
d 1.0
illum 1
`;

    const objData = new TextEncoder().encode(objContent);
    const mtlData = new TextEncoder().encode(mtlContent);

    const objResult = await objParser.parse(objData);
    const mtlResult = await mtlParser.parse(mtlData);

    // Verify OBJ parsing
    assert.strictEqual(objResult.materialFile, 'test.mtl');
    assert.strictEqual(objResult.currentMaterial, 'red');
    assert.strictEqual(objResult.vertexCount, 3);
    assert.strictEqual(objResult.lineCount, 3);

    // Verify MTL parsing
    assert.strictEqual(mtlResult.materials.size, 1);
    assert.ok(mtlResult.materials.has('red'));

    // Verify material matches OBJ reference
    const redMaterial = mtlResult.materials.get('red')!;
    assert.strictEqual(redMaterial.name, objResult.currentMaterial);
    assert.deepStrictEqual(redMaterial.diffuseColor, { r: 1.0, g: 0.0, b: 0.0 });
  });

  test('Should handle OBJ with multiple material switches', async () => {
    const objContent = `mtllib multi.mtl
usemtl red
v 0.0 0.0 0.0
v 1.0 0.0 0.0
l 1 2
usemtl blue
v 0.0 1.0 0.0
v 1.0 1.0 0.0
l 3 4
`;

    const mtlContent = `newmtl red
Kd 1.0 0.0 0.0

newmtl blue
Kd 0.0 0.0 1.0
`;

    const objData = new TextEncoder().encode(objContent);
    const mtlData = new TextEncoder().encode(mtlContent);

    const objResult = await objParser.parse(objData);
    const mtlResult = await mtlParser.parse(mtlData);

    // OBJ should track the last material used
    assert.strictEqual(objResult.currentMaterial, 'blue');
    assert.strictEqual(objResult.materialFile, 'multi.mtl');

    // MTL should have both materials
    assert.strictEqual(mtlResult.materials.size, 2);
    assert.ok(mtlResult.materials.has('red'));
    assert.ok(mtlResult.materials.has('blue'));

    // Verify material colors
    const redMaterial = mtlResult.materials.get('red')!;
    const blueMaterial = mtlResult.materials.get('blue')!;
    assert.deepStrictEqual(redMaterial.diffuseColor, { r: 1.0, g: 0.0, b: 0.0 });
    assert.deepStrictEqual(blueMaterial.diffuseColor, { r: 0.0, g: 0.0, b: 1.0 });
  });

  test('Should handle OBJ without MTL reference gracefully', async () => {
    const objContent = `v 0.0 0.0 0.0
v 1.0 0.0 0.0
l 1 2
`;

    const objData = new TextEncoder().encode(objContent);
    const objResult = await objParser.parse(objData);

    // Should work without MTL reference
    assert.strictEqual(objResult.materialFile, undefined);
    assert.strictEqual(objResult.currentMaterial, undefined);
    assert.strictEqual(objResult.vertexCount, 2);
    assert.strictEqual(objResult.lineCount, 1);
  });

  test('Should parse real facemesh wireframe OBJ+MTL files', async () => {
    const objFilePath = path.join(
      __dirname,
      '../../../testfiles/new_formats/facemesh_wireframe 1.obj'
    );
    const mtlFilePath = path.join(
      __dirname,
      '../../../testfiles/new_formats/facemesh_wireframe 1.mtl'
    );

    // Only run this test if both files exist
    if (fs.existsSync(objFilePath) && fs.existsSync(mtlFilePath)) {
      const objData = fs.readFileSync(objFilePath);
      const mtlData = fs.readFileSync(mtlFilePath);

      const objResult = await objParser.parse(objData);
      const mtlResult = await mtlParser.parse(mtlData);

      // Verify OBJ structure
      assert.ok(objResult.vertexCount > 0, 'Should have vertices');
      assert.ok(objResult.lineCount > 0, 'Should have line segments');
      assert.strictEqual(objResult.materialFile, 'facemesh_wireframe.mtl');
      assert.strictEqual(objResult.currentMaterial, 'red');

      // Verify MTL structure
      assert.ok(mtlResult.materials.size > 0, 'Should have materials');
      assert.ok(mtlResult.materials.has('red'), 'Should have red material');

      // Verify material consistency
      const redMaterial = mtlResult.materials.get('red')!;
      assert.strictEqual(redMaterial.name, objResult.currentMaterial);
      assert.deepStrictEqual(redMaterial.diffuseColor, { r: 1.0, g: 0.0, b: 0.0 });

      console.log(
        `Facemesh integration test: ${objResult.vertexCount} vertices, ${objResult.lineCount} lines, ${mtlResult.materials.size} material(s)`
      );
    } else {
      console.log('Skipping real file integration test - facemesh files not found');
    }
  });

  test('Should handle wireframe visualization data preparation', async () => {
    const objContent = `mtllib wireframe.mtl
usemtl red
v 0.0 0.0 0.0
v 1.0 0.0 0.0
v 1.0 1.0 0.0
v 0.0 1.0 0.0
l 1 2
l 2 3
l 3 4
l 4 1
`;

    const mtlContent = `newmtl red
Kd 0.8 0.2 0.1
Ka 0.1 0.0 0.0
d 1.0
illum 2
`;

    const objData = new TextEncoder().encode(objContent);
    const mtlData = new TextEncoder().encode(mtlContent);

    const objResult = await objParser.parse(objData);
    const mtlResult = await mtlParser.parse(mtlData);

    // Simulate what the webview would do to prepare Three.js LineSegments
    const linePositions: number[] = [];

    for (const line of objResult.lines) {
      const startVertex = objResult.vertices[line.start];
      const endVertex = objResult.vertices[line.end];

      // Add start vertex
      linePositions.push(startVertex.x, startVertex.y, startVertex.z);
      // Add end vertex
      linePositions.push(endVertex.x, endVertex.y, endVertex.z);
    }

    // Should have 4 lines * 2 vertices per line * 3 coordinates per vertex = 24 values
    assert.strictEqual(linePositions.length, 24);

    // Verify first line segment (0,0,0) -> (1,0,0)
    assert.strictEqual(linePositions[0], 0.0); // start x
    assert.strictEqual(linePositions[1], 0.0); // start y
    assert.strictEqual(linePositions[2], 0.0); // start z
    assert.strictEqual(linePositions[3], 1.0); // end x
    assert.strictEqual(linePositions[4], 0.0); // end y
    assert.strictEqual(linePositions[5], 0.0); // end z

    // Simulate color conversion for Three.js (RGB 0-1 to hex)
    const material = mtlResult.materials.get('red')!;
    const rgb = material.diffuseColor;
    const hexColor =
      (Math.round(rgb.r * 255) << 16) | (Math.round(rgb.g * 255) << 8) | Math.round(rgb.b * 255);

    // 0.8*255=204, 0.2*255=51, 0.1*255=25.5≈26
    // 204 << 16 | 51 << 8 | 26 = 13382426
    const expectedHex = (204 << 16) | (51 << 8) | 26;
    assert.strictEqual(hexColor, expectedHex);

    // Verify hex string representation
    const hexString = hexColor.toString(16).padStart(6, '0');
    assert.strictEqual(hexString, 'cc331a');
  });

  test('Should handle invalid material references gracefully', async () => {
    const objContent = `mtllib missing.mtl
usemtl nonexistent
v 0.0 0.0 0.0
v 1.0 0.0 0.0
l 1 2
`;

    const mtlContent = `newmtl different
Kd 0.5 0.5 0.5
`;

    const objData = new TextEncoder().encode(objContent);
    const mtlData = new TextEncoder().encode(mtlContent);

    const objResult = await objParser.parse(objData);
    const mtlResult = await mtlParser.parse(mtlData);

    // OBJ should still parse successfully
    assert.strictEqual(objResult.currentMaterial, 'nonexistent');
    assert.strictEqual(objResult.vertexCount, 2);
    assert.strictEqual(objResult.lineCount, 1);

    // MTL should parse but not contain the referenced material
    assert.strictEqual(mtlResult.materials.size, 1);
    assert.ok(!mtlResult.materials.has('nonexistent'));
    assert.ok(mtlResult.materials.has('different'));

    // Application should handle this by using default colors
  });

  test('Should handle wireframe generation from face edges', async () => {
    const objContent = `# OBJ with faces only (no explicit lines)
v 0.0 0.0 0.0
v 1.0 0.0 0.0
v 1.0 1.0 0.0
v 0.0 1.0 0.0
f 1 2 3
f 1 3 4
`;

    const objData = new TextEncoder().encode(objContent);
    const objResult = await objParser.parse(objData);

    // Should have faces but no lines
    assert.strictEqual(objResult.vertexCount, 4);
    assert.strictEqual(objResult.faceCount, 2);
    assert.strictEqual(objResult.lineCount, 0);

    // Verify that wireframe can be generated from faces
    // Two triangles sharing an edge should create 5 unique edges:
    // Triangle 1 (0-1-2): edges 0-1, 1-2, 2-0
    // Triangle 2 (0-2-3): edges 0-2 (shared), 2-3, 3-0
    // Unique edges: 0-1, 1-2, 0-2, 2-3, 3-0 = 5 edges

    // Simulate edge extraction (like the webview does)
    const edgeSet = new Set<string>();
    const edges: Array<[number, number]> = [];

    for (const face of objResult.faces) {
      const indices = face.indices;
      for (let i = 0; i < indices.length; i++) {
        const start = indices[i];
        const end = indices[(i + 1) % indices.length];

        const edgeKey = start < end ? `${start}-${end}` : `${end}-${start}`;

        if (!edgeSet.has(edgeKey)) {
          edgeSet.add(edgeKey);
          edges.push([start, end]);
        }
      }
    }

    assert.strictEqual(edges.length, 5, 'Should generate 5 unique edges from the two triangles');

    // Verify the edges exist
    const edgeStrings = edges.map(([a, b]) => (a < b ? `${a}-${b}` : `${b}-${a}`));
    assert.ok(edgeStrings.includes('0-1'), 'Should have edge 0-1');
    assert.ok(edgeStrings.includes('1-2'), 'Should have edge 1-2');
    assert.ok(edgeStrings.includes('0-2'), 'Should have edge 0-2');
    assert.ok(edgeStrings.includes('2-3'), 'Should have edge 2-3');
    assert.ok(edgeStrings.includes('0-3'), 'Should have edge 0-3');
  });
});
