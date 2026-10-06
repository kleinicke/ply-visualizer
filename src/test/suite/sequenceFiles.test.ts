import * as assert from 'assert';
import { SequenceFileReader } from '../../providerHandlers/sequenceFiles';

suite('Sequence file reads', () => {
  test('scrubbing keeps only the latest queued read and suppresses cancelled replies', async () => {
    const started: string[] = [];
    const signals: AbortSignal[] = [];
    const replies: any[] = [];
    const finish: ((bytes: Uint8Array) => void)[] = [];
    const reader = new SequenceFileReader(
      message => replies.push(message),
      (path, signal) => {
        started.push(path);
        signals.push(signal);
        return new Promise(resolve => finish.push(resolve));
      }
    );
    const running = reader.request({ path: '0.ply', index: 0, requestId: '0' });
    for (let index = 1; index <= 100; index++) {
      await reader.request({ path: `${index}.ply`, index, requestId: String(index) });
    }
    assert.deepStrictEqual(started, ['0.ply']);
    assert.ok(signals[0].aborted);
    finish[0](new Uint8Array([1]));
    await Promise.resolve();
    assert.deepStrictEqual(started, ['0.ply', '100.ply']);
    finish[1](new Uint8Array([2]));
    await running;
    assert.strictEqual(replies.length, 1);
    assert.strictEqual(replies[0].requestId, '100');
    reader.dispose();
  });

  test('dispose aborts the active read and drops queued work', async () => {
    let complete!: (bytes: Uint8Array) => void;
    let signal!: AbortSignal;
    const replies: unknown[] = [];
    const reader = new SequenceFileReader(
      message => replies.push(message),
      (_path, abort) => {
        signal = abort;
        return new Promise(resolve => {
          complete = resolve;
        });
      }
    );
    const running = reader.request({ path: 'a.ply', index: 0, requestId: 'a' });
    await reader.request({ path: 'b.ply', index: 1, requestId: 'b' });
    reader.dispose();
    assert.ok(signal.aborted);
    complete(new Uint8Array([1]));
    await running;
    assert.deepStrictEqual(replies, []);
  });
});
