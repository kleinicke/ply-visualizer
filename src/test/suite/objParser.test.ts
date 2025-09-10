import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import { ObjParser } from '../../webview/parsers/objParser';

suite('OBJ Parser Test Suite', () => {
    let parser: ObjParser;

    setup(() => {
        parser = new ObjParser();
    });

    test('Should parse basic OBJ with vertices only', async () => {
        const objContent = `# Basic OBJ with vertices
v 0.0 0.0 0.0
v 1.0 0.0 0.0
v 0.5 1.0 0.0
`;

        const data = new TextEncoder().encode(objContent);
        const result = await parser.parse(data);

        assert.strictEqual(result.vertexCount, 3);
        assert.strictEqual(result.lineCount, 0);
        assert.strictEqual(result.faceCount, 0);
        
        assert.strictEqual(result.vertices[0].x, 0.0);
        assert.strictEqual(result.vertices[0].y, 0.0);
        assert.strictEqual(result.vertices[0].z, 0.0);
        
        assert.strictEqual(result.vertices[1].x, 1.0);
        assert.strictEqual(result.vertices[1].y, 0.0);
        assert.strictEqual(result.vertices[1].z, 0.0);
        
        assert.strictEqual(result.vertices[2].x, 0.5);
        assert.strictEqual(result.vertices[2].y, 1.0);
        assert.strictEqual(result.vertices[2].z, 0.0);
    });

    test('Should parse OBJ with vertices and lines', async () => {
        const objContent = `# OBJ with wireframe
v 0.0 0.0 0.0
v 1.0 0.0 0.0
v 0.5 1.0 0.0
l 1 2
l 2 3
l 3 1
`;

        const data = new TextEncoder().encode(objContent);
        const result = await parser.parse(data);

        assert.strictEqual(result.vertexCount, 3);
        assert.strictEqual(result.lineCount, 3);
        assert.strictEqual(result.faceCount, 0);
        
        // Check line connectivity (OBJ uses 1-based indexing, converted to 0-based)
        assert.strictEqual(result.lines[0].start, 0); // 1 -> 0
        assert.strictEqual(result.lines[0].end, 1);   // 2 -> 1
        
        assert.strictEqual(result.lines[1].start, 1); // 2 -> 1
        assert.strictEqual(result.lines[1].end, 2);   // 3 -> 2
        
        assert.strictEqual(result.lines[2].start, 2); // 3 -> 2
        assert.strictEqual(result.lines[2].end, 0);   // 1 -> 0
    });

    test('Should parse OBJ with material references', async () => {
        const objContent = `# OBJ with materials
mtllib test.mtl
usemtl red
v 0.0 0.0 0.0
v 1.0 0.0 0.0
l 1 2
`;

        const data = new TextEncoder().encode(objContent);
        const result = await parser.parse(data);

        assert.strictEqual(result.materialFile, 'test.mtl');
        assert.strictEqual(result.currentMaterial, 'red');
        assert.strictEqual(result.vertexCount, 2);
        assert.strictEqual(result.lineCount, 1);
    });

    test('Should parse OBJ with faces', async () => {
        const objContent = `# OBJ with faces
v 0.0 0.0 0.0
v 1.0 0.0 0.0
v 0.5 1.0 0.0
f 1 2 3
`;

        const data = new TextEncoder().encode(objContent);
        const result = await parser.parse(data);

        assert.strictEqual(result.vertexCount, 3);
        assert.strictEqual(result.lineCount, 0);
        assert.strictEqual(result.faceCount, 1);
        
        // Check face indices (converted from 1-based to 0-based)
        assert.deepStrictEqual(result.faces[0].indices, [0, 1, 2]);
    });

    test('Should ignore comments and empty lines', async () => {
        const objContent = `# This is a comment

# Another comment
v 0.0 0.0 0.0
# Comment between vertices
v 1.0 0.0 0.0

l 1 2
# Final comment
`;

        const data = new TextEncoder().encode(objContent);
        const result = await parser.parse(data);

        assert.strictEqual(result.vertexCount, 2);
        assert.strictEqual(result.lineCount, 1);
    });

    test('Should handle multi-vertex lines correctly', async () => {
        const objContent = `v 0.0 0.0 0.0
v 1.0 0.0 0.0
v 2.0 0.0 0.0
v 3.0 0.0 0.0
l 1 2 3 4
`;

        const data = new TextEncoder().encode(objContent);
        const result = await parser.parse(data);

        assert.strictEqual(result.vertexCount, 4);
        assert.strictEqual(result.lineCount, 3); // 4 vertices = 3 line segments
        
        // Check line segments: 1-2, 2-3, 3-4
        assert.strictEqual(result.lines[0].start, 0);
        assert.strictEqual(result.lines[0].end, 1);
        
        assert.strictEqual(result.lines[1].start, 1);
        assert.strictEqual(result.lines[1].end, 2);
        
        assert.strictEqual(result.lines[2].start, 2);
        assert.strictEqual(result.lines[2].end, 3);
    });

    test('Should parse real facemesh wireframe file', async () => {
        const testFilePath = path.join(__dirname, '../../../testfiles/new_formats/facemesh_wireframe 1.obj');
        
        // Only run this test if the file exists
        if (fs.existsSync(testFilePath)) {
            const data = fs.readFileSync(testFilePath);
            const result = await parser.parse(data);

            // The facemesh should have vertices and lines
            assert.ok(result.vertexCount > 0, 'Should have vertices');
            assert.ok(result.lineCount > 0, 'Should have line segments');
            
            // Should reference MTL file
            assert.strictEqual(result.materialFile, 'facemesh_wireframe.mtl');
            assert.strictEqual(result.currentMaterial, 'red');
            
            console.log(`Facemesh parsed: ${result.vertexCount} vertices, ${result.lineCount} lines, ${result.faceCount} faces`);
        } else {
            console.log('Skipping real file test - facemesh_wireframe 1.obj not found');
        }
    });

    test('Should handle complex faces with texture/normal indices', async () => {
        const objContent = `v 0.0 0.0 0.0
v 1.0 0.0 0.0
v 0.5 1.0 0.0
vt 0.0 0.0
vt 1.0 0.0
vt 0.5 1.0
vn 0.0 0.0 1.0
f 1/1/1 2/2/1 3/3/1
`;

        const data = new TextEncoder().encode(objContent);
        const result = await parser.parse(data);

        assert.strictEqual(result.vertexCount, 3);
        assert.strictEqual(result.faceCount, 1);
        
        // Should extract only vertex indices, ignoring texture and normal indices
        assert.deepStrictEqual(result.faces[0].indices, [0, 1, 2]);
    });

    test('Should handle empty file gracefully', async () => {
        const objContent = ``;
        const data = new TextEncoder().encode(objContent);
        const result = await parser.parse(data);

        assert.strictEqual(result.vertexCount, 0);
        assert.strictEqual(result.lineCount, 0);
        assert.strictEqual(result.faceCount, 0);
        assert.strictEqual(result.vertices.length, 0);
        assert.strictEqual(result.lines.length, 0);
        assert.strictEqual(result.faces.length, 0);
    });

    test('Should parse OBJ with texture coordinates', async () => {
        const objContent = `v 0.0 0.0 0.0
v 1.0 0.0 0.0
v 0.5 1.0 0.0
vt 0.0 0.0
vt 1.0 0.0
vt 0.5 1.0
f 1/1 2/2 3/3
`;

        const data = new TextEncoder().encode(objContent);
        const result = await parser.parse(data);

        assert.strictEqual(result.vertexCount, 3);
        assert.strictEqual(result.textureCoordCount, 3);
        assert.strictEqual(result.faceCount, 1);
        assert.strictEqual(result.hasTextures, true);
        assert.strictEqual(result.hasNormals, false);

        // Check texture coordinates
        assert.strictEqual(result.textureCoords[0].u, 0.0);
        assert.strictEqual(result.textureCoords[0].v, 0.0);
        assert.strictEqual(result.textureCoords[1].u, 1.0);
        assert.strictEqual(result.textureCoords[1].v, 0.0);
        assert.strictEqual(result.textureCoords[2].u, 0.5);
        assert.strictEqual(result.textureCoords[2].v, 1.0);

        // Check face with texture indices
        assert.deepStrictEqual(result.faces[0].indices, [0, 1, 2]);
        assert.deepStrictEqual(result.faces[0].textureIndices, [0, 1, 2]);
    });

    test('Should parse OBJ with vertex normals', async () => {
        const objContent = `v 0.0 0.0 0.0
v 1.0 0.0 0.0
v 0.5 1.0 0.0
vn 0.0 0.0 1.0
vn 0.0 0.0 1.0
vn 0.0 0.0 1.0
f 1//1 2//2 3//3
`;

        const data = new TextEncoder().encode(objContent);
        const result = await parser.parse(data);

        assert.strictEqual(result.vertexCount, 3);
        assert.strictEqual(result.normalCount, 3);
        assert.strictEqual(result.faceCount, 1);
        assert.strictEqual(result.hasTextures, false);
        assert.strictEqual(result.hasNormals, true);

        // Check normals
        assert.strictEqual(result.normals[0].nx, 0.0);
        assert.strictEqual(result.normals[0].ny, 0.0);
        assert.strictEqual(result.normals[0].nz, 1.0);

        // Check face with normal indices
        assert.deepStrictEqual(result.faces[0].indices, [0, 1, 2]);
        assert.deepStrictEqual(result.faces[0].normalIndices, [0, 1, 2]);
    });

    test('Should parse OBJ with full vertex/texture/normal format', async () => {
        const objContent = `v 0.0 0.0 0.0
v 1.0 0.0 0.0
v 0.5 1.0 0.0
vt 0.0 0.0
vt 1.0 0.0
vt 0.5 1.0
vn 0.0 0.0 1.0
vn 0.0 0.0 1.0
vn 0.0 0.0 1.0
f 1/1/1 2/2/2 3/3/3
`;

        const data = new TextEncoder().encode(objContent);
        const result = await parser.parse(data);

        assert.strictEqual(result.vertexCount, 3);
        assert.strictEqual(result.textureCoordCount, 3);
        assert.strictEqual(result.normalCount, 3);
        assert.strictEqual(result.faceCount, 1);
        assert.strictEqual(result.hasTextures, true);
        assert.strictEqual(result.hasNormals, true);

        // Check face with all indices
        const face = result.faces[0];
        assert.deepStrictEqual(face.indices, [0, 1, 2]);
        assert.deepStrictEqual(face.textureIndices, [0, 1, 2]);
        assert.deepStrictEqual(face.normalIndices, [0, 1, 2]);
    });

    test('Should handle quad faces (converted to triangles)', async () => {
        const objContent = `v 0.0 0.0 0.0
v 1.0 0.0 0.0
v 1.0 1.0 0.0
v 0.0 1.0 0.0
f 1 2 3 4
`;

        const data = new TextEncoder().encode(objContent);
        const result = await parser.parse(data);

        assert.strictEqual(result.vertexCount, 4);
        assert.strictEqual(result.faceCount, 1);

        // Quad should be stored as a single face with 4 indices
        assert.deepStrictEqual(result.faces[0].indices, [0, 1, 2, 3]);
    });

    test('Should handle mixed format faces', async () => {
        const objContent = `v 0.0 0.0 0.0
v 1.0 0.0 0.0
v 0.5 1.0 0.0
vt 0.0 0.0
vt 1.0 0.0
vt 0.5 1.0
vn 0.0 0.0 1.0
f 1/1/1 2/2 3//1
`;

        const data = new TextEncoder().encode(objContent);
        const result = await parser.parse(data);

        assert.strictEqual(result.faceCount, 1);
        
        const face = result.faces[0];
        assert.deepStrictEqual(face.indices, [0, 1, 2]);
        // Only first and third vertices have texture coordinates specified
        assert.deepStrictEqual(face.textureIndices, [0, 1]);
        // First and third vertices have normals
        assert.deepStrictEqual(face.normalIndices, [0, 0]);
    });

    test('Should handle 3D texture coordinates with w component', async () => {
        const objContent = `vt 0.0 0.0 1.0
vt 1.0 0.0 0.5
vt 0.5 1.0 0.0
`;

        const data = new TextEncoder().encode(objContent);
        const result = await parser.parse(data);

        assert.strictEqual(result.textureCoordCount, 3);
        assert.strictEqual(result.hasTextures, true);

        assert.strictEqual(result.textureCoords[0].w, 1.0);
        assert.strictEqual(result.textureCoords[1].w, 0.5);
        assert.strictEqual(result.textureCoords[2].w, 0.0);
    });

    test('Should parse typical mesh OBJ file (faces only)', async () => {
        const objContent = `# Typical mesh OBJ
mtllib mesh.mtl
usemtl material1
v -1.0 -1.0 0.0
v 1.0 -1.0 0.0
v 1.0 1.0 0.0
v -1.0 1.0 0.0
vn 0.0 0.0 1.0
vn 0.0 0.0 1.0
vn 0.0 0.0 1.0
vn 0.0 0.0 1.0
f 1//1 2//2 3//3
f 1//1 3//3 4//4
`;

        const data = new TextEncoder().encode(objContent);
        const result = await parser.parse(data);

        assert.strictEqual(result.vertexCount, 4);
        assert.strictEqual(result.normalCount, 4);
        assert.strictEqual(result.faceCount, 2);
        assert.strictEqual(result.lineCount, 0);
        assert.strictEqual(result.hasNormals, true);
        assert.strictEqual(result.materialFile, 'mesh.mtl');
        assert.strictEqual(result.currentMaterial, 'material1');
    });
});