import * as assert from 'assert';
import { compactTypedArrayViews } from '../../providerHandlers/webviewTransport';

suite('Webview transport', () => {
  test('copies views that do not cover their buffer, and nothing else', () => {
    const archive = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    const frames = new Uint16Array([10, 11, 12, 13]);
    const whole = new Float32Array([1, 2, 3]);
    const message = {
      type: 'stationPipelineResult',
      updates: [{ rawColors: archive.subarray(2, 5), frameIndices: frames.subarray(1, 3), whole }],
      meta: { label: 'x' },
    };
    const sent = compactTypedArrayViews(message) as typeof message;

    const update = sent.updates[0];
    assert.deepStrictEqual(Array.from(update.rawColors), [3, 4, 5]);
    assert.strictEqual(update.rawColors.buffer.byteLength, 3);
    assert.ok(update.frameIndices instanceof Uint16Array);
    assert.deepStrictEqual(Array.from(update.frameIndices), [11, 12]);
    assert.strictEqual(update.frameIndices.buffer.byteLength, 4);
    // A whole-buffer array is passed through as is, as is untouched structure.
    assert.strictEqual(update.whole, whole);
    assert.strictEqual(sent.meta, message.meta);
    // The caller's message is not modified.
    assert.strictEqual(message.updates[0].rawColors.buffer, archive.buffer);
  });

  test('copies a view of shared memory even when it covers the buffer', () => {
    const shared = new Float32Array(new SharedArrayBuffer(12));
    shared.set([1, 2, 3]);
    const sent = compactTypedArrayViews({ positions: shared });

    assert.deepStrictEqual(Array.from(sent.positions), [1, 2, 3]);
    assert.strictEqual(sent.positions.buffer.byteLength, 12);
    assert.ok(!(sent.positions.buffer instanceof SharedArrayBuffer));
  });

  test('returns the same object when nothing needs compacting', () => {
    const message = { type: 'spatialData', positions: new Float32Array(6), names: ['a'] };
    assert.strictEqual(compactTypedArrayViews(message), message);
  });
});
