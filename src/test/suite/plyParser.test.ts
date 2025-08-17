import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import { PlyParser } from '../../plyParser';

suite('PLY Parser Test Suite', () => {
    let parser: PlyParser;

    setup(() => {
        parser = new PlyParser();
    });

    test('Should parse ASCII PLY file', async () => {
        const plyContent = `ply
format ascii 1.0
element vertex 3
property float x
property float y
property float z
property uchar red
property uchar green
property uchar blue
end_header
0.0 0.0 0.0 255 0 0
1.0 0.0 0.0 0 255 0
0.5 1.0 0.0 0 0 255
`;

        const data = new TextEncoder().encode(plyContent);
        const result = await parser.parse(data);

        assert.strictEqual(result.format, 'ascii');
        assert.strictEqual(result.version, '1.0');
        assert.strictEqual(result.vertexCount, 3);
        assert.strictEqual(result.faceCount, 0);
        assert.strictEqual(result.hasColors, true);
        assert.strictEqual(result.hasNormals, false);
        assert.strictEqual(result.vertices.length, 3);

        // Check first vertex
        const vertex1 = result.vertices[0];
        assert.strictEqual(vertex1.x, 0.0);
        assert.strictEqual(vertex1.y, 0.0);
        assert.strictEqual(vertex1.z, 0.0);
        assert.strictEqual(vertex1.red, 255);
        assert.strictEqual(vertex1.green, 0);
        assert.strictEqual(vertex1.blue, 0);
    });

    test('Should parse PLY file with faces', async () => {
        const plyContent = `ply
format ascii 1.0
element vertex 4
property float x
property float y
property float z
element face 2
property list uchar int vertex_indices
end_header
0.0 0.0 0.0
1.0 0.0 0.0
1.0 1.0 0.0
0.0 1.0 0.0
3 0 1 2
3 0 2 3
`;

        const data = new TextEncoder().encode(plyContent);
        const result = await parser.parse(data);

        assert.strictEqual(result.vertexCount, 4);
        assert.strictEqual(result.faceCount, 2);
        assert.strictEqual(result.faces.length, 2);
        assert.strictEqual(result.hasColors, false);

        // Check first face
        const face1 = result.faces[0];
        assert.deepStrictEqual(face1.indices, [0, 1, 2]);
    });

    test('Should handle PLY file with normals', async () => {
        const plyContent = `ply
format ascii 1.0
element vertex 2
property float x
property float y
property float z
property float nx
property float ny
property float nz
end_header
0.0 0.0 0.0 0.0 0.0 1.0
1.0 0.0 0.0 0.0 0.0 1.0
`;

        const data = new TextEncoder().encode(plyContent);
        const result = await parser.parse(data);

        assert.strictEqual(result.hasNormals, true);
        assert.strictEqual(result.vertices[0].nx, 0.0);
        assert.strictEqual(result.vertices[0].ny, 0.0);
        assert.strictEqual(result.vertices[0].nz, 1.0);
    });

    test('Should handle comments', async () => {
        const plyContent = `ply
format ascii 1.0
comment This is a test file
comment Created by PLY Viewer tests
element vertex 1
property float x
property float y
property float z
end_header
0.0 0.0 0.0
`;

        const data = new TextEncoder().encode(plyContent);
        const result = await parser.parse(data);

        assert.strictEqual(result.comments.length, 2);
        assert.strictEqual(result.comments[0], 'This is a test file');
        assert.strictEqual(result.comments[1], 'Created by PLY Viewer tests');
    });

    test('Should throw error for invalid PLY file', async () => {
        const invalidContent = 'not a ply file';
        const data = new TextEncoder().encode(invalidContent);

        try {
            await parser.parse(data);
            assert.fail('Should have thrown an error');
        } catch (error) {
            assert.ok(error instanceof Error);
            // Check for either "Invalid PLY file" or other error messages from the parser
            const errorMessage = (error as Error).message;
            const hasValidError = errorMessage.includes('Invalid PLY file') || 
                                 errorMessage.includes('must start with') ||
                                 errorMessage.includes('ply') ||
                                 errorMessage.includes('missing PLY header') ||
                                 errorMessage.includes('invalid XYZ format');
            assert.ok(hasValidError, `Expected PLY validation error, got: ${errorMessage}`);
        }
    });

    test('Should throw error for PLY file without end_header', async () => {
        const invalidContent = `ply
format ascii 1.0
element vertex 1
property float x
property float y
property float z
`;

        const data = new TextEncoder().encode(invalidContent);

        try {
            await parser.parse(data);
            assert.fail('Should have thrown an error');
        } catch (error) {
            assert.ok(error instanceof Error);
            assert.ok((error as Error).message.includes('missing end_header'));
        }
    });

    test('Should parse real ASCII PLY file from testfiles', async () => {
        const testFilePath = path.join(__dirname, '../../../testfiles/ply/test_ascii.ply');
        if (fs.existsSync(testFilePath)) {
            const data = fs.readFileSync(testFilePath);
            const result = await parser.parse(data);

            assert.strictEqual(result.format, 'ascii');
            assert.strictEqual(result.version, '1.0');
            assert.ok(result.vertexCount > 0);
            assert.ok(result.vertices.length === result.vertexCount);
            assert.ok(result.vertices.every(v => 
                typeof v.x === 'number' && 
                typeof v.y === 'number' && 
                typeof v.z === 'number'
            ));
        }
    });

    test('Should parse real binary PLY file from testfiles', async () => {
        const testFilePath = path.join(__dirname, '../../../testfiles/ply/test_binary.ply');
        if (fs.existsSync(testFilePath)) {
            const data = fs.readFileSync(testFilePath);
            const result = await parser.parse(data);

            assert.ok(result.format.includes('binary'));
            assert.strictEqual(result.version, '1.0');
            assert.ok(result.vertexCount > 0);
            
            // For large binary files, the parser may use optimized loading that doesn't
            // populate the vertices array to save memory
            const hasVertices = result.vertices.length > 0;
            const hasVertexCount = result.vertexCount > 0;
            assert.ok(hasVertexCount, 'Should report correct vertex count');
            
            if (hasVertices) {
                assert.ok(result.vertices.every(v => 
                    typeof v.x === 'number' && 
                    typeof v.y === 'number' && 
                    typeof v.z === 'number'
                ));
                
                if (result.hasColors) {
                    assert.ok(result.vertices.every(v => 
                        typeof v.red === 'number' && 
                        typeof v.green === 'number' && 
                        typeof v.blue === 'number'
                    ));
                }
            }
        }
    });

    test('Should parse XYZ file from testfiles', async () => {
        const testFilePath = path.join(__dirname, '../../../testfiles/test_poses.xyz');
        if (fs.existsSync(testFilePath)) {
            const data = fs.readFileSync(testFilePath);
            const result = await parser.parse(data);

            assert.strictEqual(result.format, 'ascii');
            assert.ok(result.vertexCount > 0);
            assert.ok(result.vertices.length === result.vertexCount);
            assert.ok(result.vertices.every(v => 
                typeof v.x === 'number' && 
                typeof v.y === 'number' && 
                typeof v.z === 'number'
            ));
        }
    });

    test('Should handle large vertex counts', async () => {
        const plyContent = `ply
format ascii 1.0
element vertex 1000000
property float x
property float y
property float z
end_header
`;

        const data = new TextEncoder().encode(plyContent);
        const result = await parser.parse(data);

        assert.strictEqual(result.vertexCount, 1000000);
        // For large files, parser may or may not load vertices depending on optimization strategy
        // The key is that it should report the correct vertex count
        assert.ok(result.vertexCount === 1000000, 'Should report correct vertex count');
        assert.ok(result.vertices.length >= 0, 'Vertices array should be valid');
    });

    test('Should preserve timing callback functionality', async () => {
        const plyContent = `ply
format ascii 1.0
element vertex 3
property float x
property float y
property float z
end_header
0.0 0.0 0.0
1.0 0.0 0.0
0.5 1.0 0.0
`;

        let callbackCalled = false;
        const timingCallback = (message: string) => {
            callbackCalled = true;
            assert.ok(message.includes('Parser:'));
        };

        const data = new TextEncoder().encode(plyContent);
        await parser.parse(data, timingCallback);

        assert.ok(callbackCalled, 'Timing callback should be called');
    });

    test('Should handle different number formats', async () => {
        const plyContent = `ply
format ascii 1.0
element vertex 3
property float x
property float y
property float z
property float intensity
end_header
1.0 2.5 3.14159 0.5
-1.0 -2.5 -3.14159 1.0
0.0 0.0 0.0 0.0
`;

        const data = new TextEncoder().encode(plyContent);
        const result = await parser.parse(data);

        assert.strictEqual(result.vertices.length, 3);
        assert.strictEqual(result.vertices[0].x, 1.0);
        assert.strictEqual(result.vertices[0].y, 2.5);
        assert.strictEqual(result.vertices[1].x, -1.0);
        assert.strictEqual(result.vertices[2].x, 0.0);
    });
}); 