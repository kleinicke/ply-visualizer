import * as assert from 'assert';
import { compactScalarFields } from '../../../engine/src/utils/scalarFields';

suite('compactScalarFields', () => {
  test('stores whole-number fields at the narrowest exact type, values unchanged', () => {
    const fields = compactScalarFields({
      classification: new Float32Array([2, 6, 0, 255]),
      pointSourceId: new Float32Array([0, 1000, 65535]),
      scanAngle: new Float32Array([-90, 0, 45]),
      gpsTime: new Float32Array([0, 0.5, 12.25]),
      big: new Float32Array([0, 70000]),
      withNaN: new Float32Array([1, Number.NaN]),
      intensity: new Float32Array([1, 2, 3]),
    })!;
    assert.ok(fields.classification instanceof Uint8Array);
    assert.ok(fields.pointSourceId instanceof Uint16Array);
    assert.ok(fields.scanAngle instanceof Int16Array);
    assert.deepStrictEqual(Array.from(fields.classification), [2, 6, 0, 255]);
    assert.deepStrictEqual(Array.from(fields.pointSourceId), [0, 1000, 65535]);
    assert.deepStrictEqual(Array.from(fields.scanAngle), [-90, 0, 45]);
    // Fractions, out-of-range values, NaN and intensity stay floats.
    for (const name of ['gpsTime', 'big', 'withNaN', 'intensity']) {
      assert.ok(fields[name] instanceof Float32Array, name);
    }
  });
});
