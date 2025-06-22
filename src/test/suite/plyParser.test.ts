import * as assert from 'assert';
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
            assert.ok((error as Error).message.includes('Invalid PLY file'));
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
}); 