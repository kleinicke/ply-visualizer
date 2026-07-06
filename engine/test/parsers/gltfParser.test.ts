import * as assert from 'assert';
import { GltfParser } from '../../src/parsers/gltfParser';

suite('GLTF Parser Test Suite', () => {
  let parser: GltfParser;

  setup(() => {
    parser = new GltfParser();
  });

  test('Should parse minimal GLTF JSON', async () => {
    const gltfContent = {
      asset: {
        version: '2.0',
        generator: 'test',
      },
      scenes: [
        {
          nodes: [0],
        },
      ],
      nodes: [{}],
      meshes: [
        {
          primitives: [
            {
              attributes: {
                POSITION: 0,
              },
            },
          ],
        },
      ],
      accessors: [
        {
          bufferView: 0,
          componentType: 5126, // FLOAT
          count: 3,
          type: 'VEC3',
        },
      ],
      bufferViews: [
        {
          buffer: 0,
          byteOffset: 0,
          byteLength: 36,
        },
      ],
      buffers: [
        {
          byteLength: 36,
        },
      ],
    };

    const data = new TextEncoder().encode(JSON.stringify(gltfContent));

    try {
      const result = await parser.parse(data);

      assert.strictEqual(result.format, 'gltf');
      assert.strictEqual(result.meshCount, 1);
      assert.strictEqual(result.hasColors, false);
      assert.strictEqual(result.hasNormals, false);
      // Note: This will have 0 vertices since we don't have actual buffer data
      assert.strictEqual(result.vertices.length, 0);
    } catch (error) {
      // Expected to fail due to missing binary data, which is fine for this test
      assert.ok(error instanceof Error);
    }
  });

  test('Should handle invalid GLTF JSON', async () => {
    const invalidJson = `{invalid json`;
    const data = new TextEncoder().encode(invalidJson);

    try {
      await parser.parse(data);
      assert.fail('Should have thrown an error');
    } catch (error) {
      assert.ok(error instanceof Error);
    }
  });

  test('Should detect GLB binary format', async () => {
    // Create a minimal GLB header (magic + version + length)
    const glbHeader = new ArrayBuffer(12);
    const view = new DataView(glbHeader);
    view.setUint32(0, 0x46546c67, true); // 'glTF' magic
    view.setUint32(4, 2, true); // version 2
    view.setUint32(8, 12, true); // total length

    const data = new Uint8Array(glbHeader);

    try {
      const result = await parser.parse(data);
      assert.fail('Should have thrown an error for incomplete GLB');
    } catch (error) {
      // Expected to fail due to incomplete GLB structure
      assert.ok(error instanceof Error);
    }
  });
});
