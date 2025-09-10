import * as assert from 'assert';
import { PcdParser } from '../../webview/parsers/pcdParser';

suite('PCD Parser Test Suite', () => {
    let parser: PcdParser;

    setup(() => {
        parser = new PcdParser();
    });

    test('Should parse ASCII PCD file', async () => {
        const pcdContent = `# Point Cloud Data file format
VERSION 0.7
FIELDS x y z
SIZE 4 4 4
TYPE F F F
COUNT 1 1 1
WIDTH 3
HEIGHT 1
VIEWPOINT 0 0 0 1 0 0 0
POINTS 3
DATA ascii
1.0 2.0 3.0
4.0 5.0 6.0
7.0 8.0 9.0`;

        const data = new TextEncoder().encode(pcdContent);
        const result = await parser.parse(data);

        assert.strictEqual(result.vertexCount, 3);
        assert.strictEqual(result.format, 'ascii');
        assert.strictEqual(result.hasColors, false);
        assert.strictEqual(result.hasNormals, false);
        assert.strictEqual(result.vertices.length, 3);
        assert.strictEqual(result.vertices[0].x, 1.0);
        assert.strictEqual(result.vertices[0].y, 2.0);
        assert.strictEqual(result.vertices[0].z, 3.0);
    });

    test('Should parse PCD file with colors', async () => {
        const pcdContent = `# Point Cloud Data file format
VERSION 0.7
FIELDS x y z r g b
SIZE 4 4 4 1 1 1
TYPE F F F U U U
COUNT 1 1 1 1 1 1
WIDTH 2
HEIGHT 1
VIEWPOINT 0 0 0 1 0 0 0
POINTS 2
DATA ascii
1.0 2.0 3.0 255 128 64
4.0 5.0 6.0 128 255 192`;

        const data = new TextEncoder().encode(pcdContent);
        const result = await parser.parse(data);

        assert.strictEqual(result.vertexCount, 2);
        assert.strictEqual(result.hasColors, true);
        assert.strictEqual(result.vertices[0].red, 255);
        assert.strictEqual(result.vertices[0].green, 128);
        assert.strictEqual(result.vertices[0].blue, 64);
    });

    test('Should handle empty PCD file', async () => {
        const pcdContent = `# Point Cloud Data file format
VERSION 0.7
FIELDS x y z
SIZE 4 4 4
TYPE F F F
COUNT 1 1 1
WIDTH 0
HEIGHT 1
POINTS 0
DATA ascii`;

        const data = new TextEncoder().encode(pcdContent);
        const result = await parser.parse(data);

        assert.strictEqual(result.vertexCount, 0);
        assert.strictEqual(result.vertices.length, 0);
    });
});