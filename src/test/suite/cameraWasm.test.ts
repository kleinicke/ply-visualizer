import * as assert from 'assert';
import { stonexCameraProjector } from '../../wasmPointcloud';

suite('Point-cloud WASM camera projection', () => {
  test('projects indexed points and preserves invalid-point masks', () => {
    const pixels = stonexCameraProjector({
      fx: 100,
      fy: 200,
      cx: 10,
      cy: 20,
      coefficients: [0, 0, 0, 0],
      positions: new Float32Array([1, 2, 4, 0, 0, -1, 100, 0, 1]),
      indices: new Uint32Array([1, 0, 2]),
      transform: [1, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
      maxNormalizedX: 2,
      maxNormalizedY: 2,
    });
    assert.ok(pixels, 'the packaged point-cloud decoder must expose camera projection');
    assert.deepStrictEqual(Array.from(pixels!), [NaN, NaN, 60, 120, NaN, NaN]);
  });
});
