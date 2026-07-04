import * as assert from 'assert';
import { OffParser } from '../../src/parsers/offParser';

suite('OFF Parser Test Suite', () => {
  let parser: OffParser;

  setup(() => {
    parser = new OffParser();
  });

  test('Should parse basic OFF file', async () => {
    const offContent = `OFF
3 1 0
0.0 0.0 0.0
1.0 0.0 0.0
0.5 1.0 0.0
3 0 1 2
`;

    const data = new TextEncoder().encode(offContent);
    const result = await parser.parse(data);

    assert.strictEqual(result.vertexCount, 3);
    assert.strictEqual(result.faceCount, 1);
    assert.strictEqual(result.vertices.length, 3);
    assert.strictEqual(result.faces.length, 1);

    // Check first vertex
    assert.strictEqual(result.vertices[0].x, 0.0);
    assert.strictEqual(result.vertices[0].y, 0.0);
    assert.strictEqual(result.vertices[0].z, 0.0);

    // Check face
    assert.deepStrictEqual(result.faces[0].indices, [0, 1, 2]);
  });

  test('Should handle invalid OFF content', async () => {
    const invalidContent = 'not an off file';
    const data = new TextEncoder().encode(invalidContent);

    try {
      await parser.parse(data);
      assert.fail('Should have thrown an error');
    } catch (error) {
      assert.ok(error instanceof Error);
    }
  });

  test('Should handle empty OFF file', async () => {
    const emptyData = new Uint8Array(0);

    try {
      await parser.parse(emptyData);
      assert.fail('Should have thrown an error');
    } catch (error) {
      assert.ok(error instanceof Error);
    }
  });
});
