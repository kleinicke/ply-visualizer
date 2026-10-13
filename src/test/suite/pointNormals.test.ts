import * as assert from 'assert';
import { compactPointNormals, normalsAsFloat32 } from '../../../engine/src/utils/normals';
import type { SpatialData } from '../../../engine/src/interfaces';
import { addPointStreamPart, finishPointStream } from '../../../engine/src/hosts/pointStream';

function cloud(normals: number[], faceCount = 0): SpatialData {
  return {
    vertices: [],
    faces: [],
    format: 'binary_little_endian',
    version: '1.0',
    comments: [],
    vertexCount: normals.length / 3,
    faceCount,
    hasColors: false,
    hasNormals: true,
    normalsArray: new Float32Array(normals),
  } as SpatialData;
}

suite('compactPointNormals', () => {
  test('packs unit normals to snorm16 within half a step', () => {
    const source = [0, 0, 1, -1, 0, 0, 0.6, -0.8, 0, 1.00000012, 0, 0];
    const data = cloud(source);
    compactPointNormals(data);
    assert.ok(data.normalsArray instanceof Int16Array);
    const back = normalsAsFloat32(data.normalsArray!);
    source.forEach((value, i) =>
      assert.ok(Math.abs(back[i] - Math.max(-1, Math.min(1, value))) <= 0.5 / 32767, `${i}`)
    );
  });

  test('keeps non-unit, NaN and mesh normals as floats', () => {
    for (const data of [cloud([0, 0, 2]), cloud([0, Number.NaN, 1]), cloud([0, 0, 1], 1)]) {
      const before = data.normalsArray;
      compactPointNormals(data);
      assert.strictEqual(data.normalsArray, before);
    }
  });
});

suite('streamed point normals', () => {
  const part = (normals: number[]) => ({
    positions: new Float32Array(normals.length),
    normals: new Float32Array(normals),
  });

  test('parts are packed while they are joined', () => {
    addPointStreamPart('unit', part([0, 0, 1]));
    addPointStreamPart('unit', part([1, 0, 0]));
    const joined = finishPointStream('unit')!;
    assert.ok(joined.normalsArray instanceof Int16Array);
    assert.deepStrictEqual(Array.from(joined.normalsArray), [0, 0, 32767, 32767, 0, 0]);
  });

  test('one non-unit part keeps every normal as a float', () => {
    addPointStreamPart('mixed', part([0, 0, 1]));
    addPointStreamPart('mixed', part([0, 0, 5]));
    const joined = finishPointStream('mixed')!;
    assert.ok(joined.normalsArray instanceof Float32Array);
    assert.deepStrictEqual(Array.from(joined.normalsArray), [0, 0, 1, 0, 0, 5]);
  });
});
