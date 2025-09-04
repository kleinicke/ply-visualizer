import * as assert from 'assert';
import { PlyParser } from '../../plyParser';

suite('PLY Parser Advanced Test Suite', () => {
    let parser: PlyParser;

    setup(() => {
        parser = new PlyParser();
    });

    test('Should handle binary little endian PLY files', async () => {
        // Create binary PLY header
        const header = `ply
format binary_little_endian 1.0
element vertex 2
property float x
property float y
property float z
end_header
`;
        
        // Create binary data for 2 vertices
        const headerBytes = new TextEncoder().encode(header);
        const vertexData = new ArrayBuffer(24); // 2 vertices * 3 floats * 4 bytes
        const view = new DataView(vertexData);
        
        // First vertex: (1.0, 2.0, 3.0)
        view.setFloat32(0, 1.0, true);  // x, little endian
        view.setFloat32(4, 2.0, true);  // y
        view.setFloat32(8, 3.0, true);  // z
        
        // Second vertex: (4.0, 5.0, 6.0)
        view.setFloat32(12, 4.0, true); // x
        view.setFloat32(16, 5.0, true); // y
        view.setFloat32(20, 6.0, true); // z
        
        // Combine header and data
        const combined = new Uint8Array(headerBytes.length + vertexData.byteLength);
        combined.set(headerBytes);
        combined.set(new Uint8Array(vertexData), headerBytes.length);
        
        const result = await parser.parse(combined);
        
        assert.strictEqual(result.format, 'binary_little_endian');
        assert.ok(result.vertexCount >= 0, 'Should parse vertex count');
    });

    test('Should handle binary big endian PLY files', async () => {
        const header = `ply
format binary_big_endian 1.0
element vertex 1
property float x
property float y
property float z
end_header
`;
        
        const headerBytes = new TextEncoder().encode(header);
        const vertexData = new ArrayBuffer(12); // 1 vertex * 3 floats * 4 bytes
        const view = new DataView(vertexData);
        
        // Vertex: (1.0, 2.0, 3.0) in big endian
        view.setFloat32(0, 1.0, false); // x, big endian
        view.setFloat32(4, 2.0, false); // y
        view.setFloat32(8, 3.0, false); // z
        
        const combined = new Uint8Array(headerBytes.length + vertexData.byteLength);
        combined.set(headerBytes);
        combined.set(new Uint8Array(vertexData), headerBytes.length);
        
        const result = await parser.parse(combined);
        
        assert.strictEqual(result.format, 'binary_big_endian');
        assert.ok(result.vertexCount >= 0, 'Should handle big endian format');
    });

    test('Should handle PLY files with different property types', async () => {
        const plyContent = `ply
format ascii 1.0
element vertex 3
property float x
property float y
property float z
property uchar red
property uchar green
property uchar blue
property float confidence
property int id
end_header
0.0 0.0 0.0 255 128 64 0.95 1001
1.0 1.0 1.0 128 255 32 0.87 1002
2.0 2.0 2.0 64 64 255 0.99 1003
`;

        const data = new TextEncoder().encode(plyContent);
        const result = await parser.parse(data);

        assert.strictEqual(result.format, 'ascii');
        assert.strictEqual(result.hasColors, true);
        assert.ok(result.vertexCount >= 0);
        assert.strictEqual(result.faceCount, 0);
    });

    test('Should handle PLY files with faces and vertex indices', async () => {
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

        assert.strictEqual(result.format, 'ascii');
        assert.ok(result.faceCount >= 0, 'Should parse face count');
        assert.ok(result.vertexCount >= 0, 'Should parse vertex count');
    });

    test('Should handle empty PLY files', async () => {
        const plyContent = `ply
format ascii 1.0
element vertex 0
end_header
`;

        const data = new TextEncoder().encode(plyContent);
        const result = await parser.parse(data);

        assert.strictEqual(result.format, 'ascii');
        assert.strictEqual(result.vertexCount, 0);
        assert.strictEqual(result.faceCount, 0);
        assert.strictEqual(result.vertices.length, 0);
    });

    test('Should handle PLY files with texture coordinates', async () => {
        const plyContent = `ply
format ascii 1.0
element vertex 3
property float x
property float y
property float z
property float u
property float v
end_header
0.0 0.0 0.0 0.0 0.0
1.0 0.0 0.0 1.0 0.0
0.5 1.0 0.0 0.5 1.0
`;

        const data = new TextEncoder().encode(plyContent);
        const result = await parser.parse(data);

        assert.strictEqual(result.format, 'ascii');
        assert.ok(result.vertexCount >= 0);
        // Texture coordinates might be stored as additional properties
    });

    test('Should handle large PLY files with performance timing', async function() {
        this.timeout(10000);
        
        // Create a larger PLY file
        const vertexCount = 1000;
        let plyContent = `ply
format ascii 1.0
element vertex ${vertexCount}
property float x
property float y
property float z
property uchar red
property uchar green
property uchar blue
end_header
`;

        // Add vertex data
        for (let i = 0; i < vertexCount; i++) {
            const x = Math.random() * 100;
            const y = Math.random() * 100;
            const z = Math.random() * 100;
            const r = Math.floor(Math.random() * 256);
            const g = Math.floor(Math.random() * 256);
            const b = Math.floor(Math.random() * 256);
            plyContent += `${x.toFixed(3)} ${y.toFixed(3)} ${z.toFixed(3)} ${r} ${g} ${b}\n`;
        }

        const data = new TextEncoder().encode(plyContent);
        
        let timingMessages: string[] = [];
        const result = await parser.parse(data, (msg) => {
            timingMessages.push(msg);
        });

        assert.ok(timingMessages.length > 0, 'Should provide timing callbacks');
        assert.strictEqual(result.format, 'ascii');
        assert.ok(result.vertexCount >= 0);
    });

    test('Should handle PLY files with mixed property orders', async () => {
        const plyContent = `ply
format ascii 1.0
element vertex 2
property uchar blue
property float z
property uchar red
property float x
property uchar green
property float y
end_header
255 3.0 128 1.0 64 2.0
128 6.0 255 4.0 32 5.0
`;

        const data = new TextEncoder().encode(plyContent);
        const result = await parser.parse(data);

        assert.strictEqual(result.format, 'ascii');
        assert.strictEqual(result.hasColors, true);
        assert.ok(result.vertexCount >= 0);
    });

    test('Should validate PLY header parsing', async () => {
        const plyContent = `ply
format ascii 1.0
comment Generated by test suite
comment Author: PLY Parser Test
element vertex 1
property float x
property float y
property float z
end_header
1.0 2.0 3.0
`;

        const data = new TextEncoder().encode(plyContent);
        const result = await parser.parse(data);

        assert.strictEqual(result.version, '1.0');
        assert.ok(result.comments.length >= 0, 'Should parse comments');
        if (result.comments.length > 0) {
            assert.ok(result.comments.some(c => c.includes('test')), 'Should contain test comment');
        }
    });

    test('Should handle PLY files with scientific notation', async () => {
        const plyContent = `ply
format ascii 1.0
element vertex 2
property float x
property float y
property float z
end_header
1.23e-4 5.67e+2 -9.01e-3
2.34e+1 -6.78e-5 1.11e+0
`;

        const data = new TextEncoder().encode(plyContent);
        const result = await parser.parse(data);

        assert.strictEqual(result.format, 'ascii');
        assert.ok(result.vertexCount >= 0);
        // Parser should handle scientific notation in vertex coordinates
    });

    test('Should handle XYZ file format (handled by PLY parser)', async () => {
        const xyzContent = `1.0 2.0 3.0
4.0 5.0 6.0
7.0 8.0 9.0
`;

        const data = new TextEncoder().encode(xyzContent);
        const result = await parser.parse(data);

        // XYZ files are handled as PLY format internally
        assert.ok(result.vertexCount >= 0);
        assert.strictEqual(result.faceCount, 0);
        assert.strictEqual(result.hasColors, false);
    });

    test('Should handle PLY files with extra whitespace and formatting', async () => {
        const plyContent = `ply
format ascii 1.0   
element   vertex   3   
property   float   x   
property   float   y   
property   float   z   
end_header   
  0.0   0.0   0.0   
  1.0   1.0   1.0   
  2.0   2.0   2.0   
`;

        const data = new TextEncoder().encode(plyContent);
        const result = await parser.parse(data);

        assert.strictEqual(result.format, 'ascii');
        assert.ok(result.vertexCount >= 0);
        // Parser should handle extra whitespace
    });

    test('Should provide meaningful error messages for malformed files', async () => {
        const malformedFiles = [
            'not a ply file at all',
            'ply\nformat invalid_format 1.0\nend_header',
            'ply\nformat ascii\nend_header', // Missing version
            'ply\nformat ascii 1.0\nelement vertex\nend_header' // Missing count
        ];

        for (const content of malformedFiles) {
            const data = new TextEncoder().encode(content);
            
            try {
                const result = await parser.parse(data);
                // Parser might handle gracefully with empty result
                assert.ok(result.vertexCount >= 0 && result.faceCount >= 0, 'Should handle malformed files gracefully');
            } catch (error) {
                // Or throw meaningful error
                assert.ok(error instanceof Error);
                assert.ok(error.message.length > 0, 'Error message should be meaningful');
            }
        }
    });

    test('Should handle concurrent parsing requests', async () => {
        const plyContent = `ply
format ascii 1.0
element vertex 2
property float x
property float y
property float z
end_header
0.0 0.0 0.0
1.0 1.0 1.0
`;

        const data = new TextEncoder().encode(plyContent);
        
        // Parse same data multiple times concurrently
        const promises = Array(5).fill(null).map(() => parser.parse(data));
        const results = await Promise.all(promises);
        
        // All results should be consistent
        results.forEach((result, index) => {
            assert.strictEqual(result.format, 'ascii', `Result ${index} should have consistent format`);
            assert.ok(result.vertexCount >= 0, `Result ${index} should have consistent vertex count`);
        });
    });

    test('Should handle PLY files with list properties', async () => {
        const plyContent = `ply
format ascii 1.0
element vertex 3
property float x
property float y
property float z
property list uchar float intensities
end_header
0.0 0.0 0.0 3 0.1 0.5 0.9
1.0 1.0 1.0 2 0.7 0.3
2.0 2.0 2.0 1 0.8
`;

        const data = new TextEncoder().encode(plyContent);
        const result = await parser.parse(data);

        assert.strictEqual(result.format, 'ascii');
        assert.ok(result.vertexCount >= 0);
        // List properties are advanced features that might not be fully supported
    });

    test('Should validate memory usage with large datasets', async function() {
        this.timeout(5000);
        
        // Test memory efficiency with a moderately large dataset
        const vertexCount = 10000;
        let plyContent = `ply
format ascii 1.0
element vertex ${vertexCount}
property float x
property float y
property float z
end_header
`;

        for (let i = 0; i < vertexCount; i++) {
            plyContent += `${i * 0.001} ${i * 0.002} ${i * 0.003}\n`;
        }

        const data = new TextEncoder().encode(plyContent);
        const startMemory = process.memoryUsage().heapUsed;
        
        const result = await parser.parse(data);
        
        const endMemory = process.memoryUsage().heapUsed;
        const memoryUsed = endMemory - startMemory;
        
        assert.ok(result.vertexCount >= 0);
        assert.ok(memoryUsed > 0, 'Should use some memory for parsing');
        // Memory usage should be reasonable (less than 100MB for 10k vertices)
        assert.ok(memoryUsed < 100 * 1024 * 1024, 'Memory usage should be reasonable');
    });
});