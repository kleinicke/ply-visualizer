import * as assert from 'assert';
import { buildScalarColorArray, mapIntensityValue } from '../../../engine/src/utils/intensity';

/**
 * Colouring by a scalar field re-runs over the whole cloud on every colormap
 * change, so it is one of the few loops a user can feel. It was rewritten to
 * stop allocating a three-element array per point — 116ms to 60ms at 8M points,
 * measured, which is more than porting it to Rust could have saved: the colours
 * have to be copied back into a JavaScript array for Three.js either way.
 *
 * These pin the values so the rewrite cannot have changed what anything looks
 * like.
 */
suite('Scalar colour mapping', () => {
  test('the ends and middle of each map are the stops themselves', () => {
    // Grayscale is the identity.
    assert.deepStrictEqual(mapIntensityValue(0, 'grayscale'), [0, 0, 0]);
    assert.deepStrictEqual(mapIntensityValue(1, 'grayscale'), [1, 1, 1]);

    const viridisLow = mapIntensityValue(0, 'viridis');
    assert.ok(Math.abs(viridisLow[0] - 0.267004) < 1e-9);
    assert.ok(Math.abs(viridisLow[2] - 0.329415) < 1e-9);
    const viridisHigh = mapIntensityValue(1, 'viridis');
    assert.ok(Math.abs(viridisHigh[0] - 0.993248) < 1e-9);
    assert.ok(Math.abs(viridisHigh[1] - 0.906157) < 1e-9);

    const colorsLow = mapIntensityValue(0, 'colors');
    assert.deepStrictEqual(colorsLow, [0, 0, 1]);
    const colorsHigh = mapIntensityValue(1, 'colors');
    assert.deepStrictEqual(colorsHigh, [1, 0, 0]);
  });

  test('interpolates linearly between two stops', () => {
    // Halfway between the first two `colors` stops: blue to green.
    const mid = mapIntensityValue(1 / 6, 'colors');
    assert.ok(Math.abs(mid[0] - 0) < 1e-9);
    assert.ok(Math.abs(mid[1] - 0.5) < 1e-9, `green ${mid[1]}`);
    assert.ok(Math.abs(mid[2] - 0.5) < 1e-9, `blue ${mid[2]}`);
  });

  test('the array builder agrees with the single-value mapping', () => {
    const values = new Float32Array([0, 2.5, 5, 7.5, 10]);
    for (const map of ['grayscale', 'viridis', 'colors'] as const) {
      const colors = buildScalarColorArray(values, values.length, map);
      for (let i = 0; i < values.length; i++) {
        const expected = mapIntensityValue(values[i] / 10, map);
        for (let channel = 0; channel < 3; channel++) {
          assert.ok(
            Math.abs(colors[i * 3 + channel] - expected[channel]) < 1e-6,
            `${map} point ${i} channel ${channel}: ${colors[i * 3 + channel]} vs ${expected[channel]}`
          );
        }
      }
    }
  });

  test('a constant field and non-finite values render at the neutral grey', () => {
    // No range to normalise against, so every point takes 0.75.
    const constant = buildScalarColorArray(new Float32Array([4, 4, 4]), 3, 'grayscale');
    for (let i = 0; i < 9; i++) {
      assert.ok(Math.abs(constant[i] - 0.75) < 1e-6, `channel ${i} is ${constant[i]}`);
    }

    const withNaN = buildScalarColorArray(new Float32Array([0, Number.NaN, 10]), 3, 'grayscale');
    assert.ok(Math.abs(withNaN[0] - 0) < 1e-6, 'the minimum is black');
    assert.ok(Math.abs(withNaN[3] - 0.75) < 1e-6, 'NaN takes the neutral grey');
    assert.ok(Math.abs(withNaN[6] - 1) < 1e-6, 'the maximum is white');
  });

  test('points beyond the end of the field still get a colour', () => {
    // `pointCount` can exceed the field when a file carries a short scalar.
    const colors = buildScalarColorArray(new Float32Array([0, 10]), 4, 'grayscale');
    assert.strictEqual(colors.length, 12);
    assert.ok(colors.every(value => Number.isFinite(value)));
  });
});
