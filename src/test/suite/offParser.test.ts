import * as assert from 'assert';
import { OffParser } from '../../webview/parsers/offParser';

suite('OFF Parser Test Suite', () => {
    let parser: OffParser;

    setup(() => {
        parser = new OffParser();
    });

    test('Should parse basic OFF file', async () => {
        const offContent = `OFF
4 2 0
1.0 0.0 0.0
0.0 1.0 0.0
0.0 0.0 1.0
0.0 0.0 0.0
3 0 1 2
3 0 2 3`;

        const data = new TextEncoder().encode(offContent);
        const result = await parser.parse(data);

        assert.strictEqual(result.vertexCount, 4);
        assert.strictEqual(result.faceCount, 2);
        assert.strictEqual(result.hasColors, false);
        assert.strictEqual(result.hasNormals, false);
        assert.strictEqual(result.offVariant, 'OFF');
        assert.strictEqual(result.vertices.length, 4);
        assert.strictEqual(result.faces.length, 2);
        assert.strictEqual(result.vertices[0].x, 1.0);
        assert.strictEqual(result.faces[0].indices.length, 3);
    });

    test('Should parse COFF file with colors', async () => {
        const offContent = `COFF
2 0 0
1.0 0.0 0.0 255 128 64
0.0 1.0 0.0 128 255 192`;

        const data = new TextEncoder().encode(offContent);
        const result = await parser.parse(data);

        assert.strictEqual(result.vertexCount, 2);
        assert.strictEqual(result.hasColors, true);
        assert.strictEqual(result.offVariant, 'COFF');
        assert.strictEqual(result.vertices[0].red, 255);
        assert.strictEqual(result.vertices[0].green, 128);
        assert.strictEqual(result.vertices[0].blue, 64);
    });

    test('Should handle OFF with quad faces (triangulated)', async () => {
        const offContent = `OFF
4 1 0
1.0 0.0 0.0
0.0 1.0 0.0
0.0 0.0 1.0
1.0 1.0 0.0
4 0 1 2 3`;

        const data = new TextEncoder().encode(offContent);
        const result = await parser.parse(data);

        assert.strictEqual(result.vertexCount, 4);
        assert.strictEqual(result.faceCount, 2); // Quad should be split into 2 triangles
        assert.strictEqual(result.faces[0].indices.length, 3);
        assert.strictEqual(result.faces[1].indices.length, 3);
    });

    test('Should handle empty OFF file', async () => {
        const offContent = `OFF
0 0 0`;

        const data = new TextEncoder().encode(offContent);
        const result = await parser.parse(data);

        assert.strictEqual(result.vertexCount, 0);
        assert.strictEqual(result.faceCount, 0);
        assert.strictEqual(result.vertices.length, 0);
        assert.strictEqual(result.faces.length, 0);
    });
});