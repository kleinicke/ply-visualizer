import * as assert from 'assert';
import { PtsParser } from '../../ptsParser';

suite('PTS Parser Test Suite', () => {
    let parser: PtsParser;

    setup(() => {
        parser = new PtsParser();
    });

    test('Should parse basic XYZ PTS file', async () => {
        const ptsContent = `1.0 2.0 3.0
4.0 5.0 6.0
7.0 8.0 9.0`;

        const data = new TextEncoder().encode(ptsContent);
        const result = await parser.parse(data);

        assert.strictEqual(result.vertexCount, 3);
        assert.strictEqual(result.hasColors, false);
        assert.strictEqual(result.hasNormals, false);
        assert.strictEqual(result.hasIntensity, false);
        assert.strictEqual(result.detectedFormat, 'x y z');
        assert.strictEqual(result.vertices.length, 3);
        assert.strictEqual(result.vertices[0].x, 1.0);
        assert.strictEqual(result.vertices[0].y, 2.0);
        assert.strictEqual(result.vertices[0].z, 3.0);
    });

    test('Should parse PTS file with RGB colors', async () => {
        const ptsContent = `1.0 2.0 3.0 255 128 64
4.0 5.0 6.0 128 255 192`;

        const data = new TextEncoder().encode(ptsContent);
        const result = await parser.parse(data);

        assert.strictEqual(result.vertexCount, 2);
        assert.strictEqual(result.hasColors, true);
        assert.strictEqual(result.detectedFormat, 'x y z r g b');
        assert.strictEqual(result.vertices[0].red, 255);
        assert.strictEqual(result.vertices[0].green, 128);
        assert.strictEqual(result.vertices[0].blue, 64);
    });

    test('Should parse PTS file with intensity', async () => {
        const ptsContent = `1.0 2.0 3.0 0.8
4.0 5.0 6.0 0.6`;

        const data = new TextEncoder().encode(ptsContent);
        const result = await parser.parse(data);

        assert.strictEqual(result.vertexCount, 2);
        assert.strictEqual(result.hasIntensity, true);
        assert.strictEqual(result.detectedFormat, 'x y z intensity');
        assert.strictEqual(result.vertices[0].intensity, 0.8);
    });

    test('Should handle empty PTS file', async () => {
        const ptsContent = ``;

        const data = new TextEncoder().encode(ptsContent);
        const result = await parser.parse(data);

        assert.strictEqual(result.vertexCount, 0);
        assert.strictEqual(result.vertices.length, 0);
    });
});