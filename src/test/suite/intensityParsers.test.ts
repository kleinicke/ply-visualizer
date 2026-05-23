import * as assert from 'assert';
import { PcdParser } from '../../../website/src/parsers/pcdParser';
import { PlyParser } from '../../../website/src/parsers/plyParser';
import { PtsParser } from '../../../website/src/parsers/ptsParser';

suite('Intensity Parser Support', () => {
  test('PCD ASCII intensity is preserved as a scalar array', async () => {
    const pcdContent = `# Point Cloud Data file format
VERSION 0.7
FIELDS x y z intensity
SIZE 4 4 4 4
TYPE F F F F
COUNT 1 1 1 1
WIDTH 3
HEIGHT 1
VIEWPOINT 0 0 0 1 0 0 0
POINTS 3
DATA ascii
0 0 0 0
1 0 0 0.5
2 0 0 1`;

    const result = await new PcdParser().parse(new TextEncoder().encode(pcdContent));

    assert.strictEqual(result.vertexCount, 3);
    assert.strictEqual(result.hasColors, false);
    assert.strictEqual(result.hasIntensity, true);
    assert.deepStrictEqual(Array.from(result.intensityArray || []), [0, 0.5, 1]);
    assert.deepStrictEqual(Array.from(result.positionsArray), [0, 0, 0, 1, 0, 0, 2, 0, 0]);
  });

  test('PCD binary intensity is preserved and compacted with NaN positions', async () => {
    const header = `VERSION 0.7
FIELDS x y z intensity
SIZE 4 4 4 4
TYPE F F F F
COUNT 1 1 1 1
WIDTH 3
HEIGHT 1
VIEWPOINT 0 0 0 1 0 0 0
POINTS 3
DATA binary
`;
    const headerBytes = new TextEncoder().encode(header);
    const payload = new Uint8Array(3 * 4 * 4);
    const view = new DataView(payload.buffer);
    const values = [0, 0, 0, 0.1, Number.NaN, 1, 1, 0.9, 2, 0, 0, 0.7];
    values.forEach((value, index) => view.setFloat32(index * 4, value, true));

    const data = new Uint8Array(headerBytes.length + payload.length);
    data.set(headerBytes);
    data.set(payload, headerBytes.length);

    const result = await new PcdParser().parse(data);

    assert.strictEqual(result.vertexCount, 2);
    assert.strictEqual(result.hasIntensity, true);
    assert.deepStrictEqual(Array.from(result.positionsArray), [0, 0, 0, 2, 0, 0]);
    assert.deepStrictEqual(
      Array.from(result.intensityArray || []).map(value => Number(value.toFixed(3))),
      [0.1, 0.7]
    );
  });

  test('PTS intensity layouts preserve intensity values', async () => {
    const ptsContent = `0 0 0 0.25
1 0 0 0.75`;

    const result = await new PtsParser().parse(new TextEncoder().encode(ptsContent));

    assert.strictEqual(result.vertexCount, 2);
    assert.strictEqual(result.hasIntensity, true);
    assert.deepStrictEqual(Array.from(result.intensityArray || []), [0.25, 0.75]);
  });

  test('PLY ASCII intensity is preserved as a scalar array', async () => {
    const plyContent = `ply
format ascii 1.0
element vertex 2
property float x
property float y
property float z
property float intensity
end_header
0 0 0 2
1 0 0 4
`;

    const result = await new PlyParser().parse(new TextEncoder().encode(plyContent));

    assert.strictEqual(result.vertexCount, 2);
    assert.strictEqual(result.hasIntensity, true);
    assert.deepStrictEqual(Array.from(result.intensityArray || []), [2, 4]);
  });
});
