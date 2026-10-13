import * as assert from 'assert';
import { orderStatistics } from '../../../engine/src/visualization/robustBounds';
import { packUnitNormals } from '../../../engine/src/utils/normals';

/** Deterministic, so a failure reproduces. */
function random(seed: number): () => number {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

suite('orderStatistics', () => {
  test('matches TypedArray#sort, including NaN, signed zero, infinities and ties', () => {
    const next = random(7);
    const specials = [0, -0, NaN, Infinity, -Infinity, 1, 1, 2, -3.5];
    for (let trial = 0; trial < 3000; trial++) {
      const length = 1 + Math.floor(next() * (trial % 10 === 0 ? 3000 : 200));
      const values = new Float32Array(length);
      for (let i = 0; i < length; i++) {
        const pick = next();
        values[i] =
          pick < 0.3
            ? specials[Math.floor(next() * specials.length)]
            : pick < 0.6
              ? Math.floor(next() * 5)
              : next() * 10 - 5;
      }
      const low = Math.floor(length * 0.01);
      const high = Math.min(length - 1, Math.ceil(length * 0.99));
      const sorted = values.slice().sort();
      const [lowValue, highValue] = orderStatistics(values.slice(), low, high);
      assert.ok(Object.is(lowValue, sorted[low]), `trial ${trial}: low`);
      assert.ok(Object.is(highValue, sorted[high]), `trial ${trial}: high`);
    }
  });

  test('stays fast on already sorted input', () => {
    const values = new Float32Array(200000).map((_, i) => i);
    const started = Date.now();
    assert.deepStrictEqual(orderStatistics(values, 2000, 198000), [2000, 198000]);
    assert.ok(Date.now() - started < 1000);
  });
});

suite('packUnitNormals', () => {
  test('rounds exactly like Math.round', () => {
    const next = random(11);
    const source = new Float32Array(200000);
    for (let i = 0; i < source.length; i++) {
      // Includes exact half steps, where round-half-up matters.
      source[i] = i % 4 === 0 ? (Math.floor(next() * 65535) - 32767 + 0.5) / 32767 : next() * 2 - 1;
    }
    const packed = new Int16Array(source.length);
    assert.ok(packUnitNormals(source, packed, 0));
    // `| 0`: Math.round gives -0 for small negatives, which Int16 stores as 0.
    source.forEach((value, i) =>
      assert.strictEqual(packed[i], Math.round(value * 32767) | 0, `${i}`)
    );
  });
});
