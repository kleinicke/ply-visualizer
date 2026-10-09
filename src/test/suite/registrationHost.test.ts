import { Worker } from 'node:worker_threads';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import * as assert from 'assert';
import {
  handleRegistrationRequest,
  cancelRegistrationRequest,
} from '../../providerHandlers/registration';
import {
  configureRegistrationExtensionHost,
  fitCorrespondences,
  handleRegistrationExtensionResult,
  registrationBackend,
} from '../../../engine/src/registration';

suite('Registration extension-host bridge', () => {
  test('the packaged Node worker resolves its bundled WASM', async function () {
    const workerPath = resolve(__dirname, '../../../registrationWorker.js');
    if (!existsSync(workerPath)) {
      this.skip();
    }
    const worker = new Worker(workerPath);
    try {
      const points = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
      const reply = new Promise<any>((resolve, reject) => {
        worker.once('message', resolve);
        worker.once('error', reject);
      });
      worker.postMessage({ kind: 'fit', source: points, target: points, settingsJson: '{}' });
      const result = await reply;
      assert.strictEqual(result?.error, undefined);
      assert.ok(result?.matrix instanceof Float64Array);
    } finally {
      await worker.terminate();
    }
  });

  test('runs a request and returns the solver result to the webview', async () => {
    const source = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
    const target = new Float32Array([2, -1, 0.5, 3, -1, 0.5, 2, 0, 0.5, 2, -1, 1.5]);
    const replies: any[] = [];
    const panel = {
      webview: {
        postMessage: async (message: unknown) => {
          replies.push(message);
          return true;
        },
      },
    };

    await handleRegistrationRequest(panel as never, {
      id: 'test-registration',
      kind: 'fit',
      source,
      target,
      settingsJson: '{}',
    });

    assert.strictEqual(replies.length, 1);
    assert.strictEqual(replies[0].type, 'registrationResult');
    assert.strictEqual(replies[0].id, 'test-registration');
    assert.ok(replies[0].matrix instanceof Float64Array);
    assert.strictEqual(replies[0].error, undefined);
    assert.ok(Math.abs(replies[0].matrix[12] - 2) < 1e-6);
    assert.ok(Math.abs(replies[0].matrix[13] + 1) < 1e-6);
    assert.ok(Math.abs(replies[0].matrix[14] - 0.5) < 1e-6);
    cancelRegistrationRequest(panel as never);
  });

  test('cancels a panel worker and accepts a fresh request afterwards', async () => {
    const replies: any[] = [];
    const panel = {
      webview: {
        postMessage: async (message: unknown) => {
          replies.push(message);
          return true;
        },
      },
    };
    const points = new Float32Array(300_000);
    for (let index = 0; index < points.length; index++) {
      points[index] = Math.sin(index);
    }
    const running = handleRegistrationRequest(panel as never, {
      id: 'cancelled',
      kind: 'register',
      source: points,
      target: points,
    });
    cancelRegistrationRequest(panel as never, 'unrelated-id');
    cancelRegistrationRequest(panel as never, 'cancelled');
    await running;
    assert.strictEqual(replies.length, 0);
    const triangle = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
    await handleRegistrationRequest(panel as never, {
      id: 'fresh',
      kind: 'fit',
      source: triangle,
      target: triangle,
    });
    assert.strictEqual(replies.length, 1);
    assert.strictEqual(replies[0].id, 'fresh');
    assert.ok(replies[0].matrix);
    cancelRegistrationRequest(panel as never);
  });

  test('cancelling the running jobs still starts the queued ones', async () => {
    const replies: any[] = [];
    const panel = {
      webview: {
        postMessage: async (message: unknown) => {
          replies.push(message);
          return true;
        },
      },
    };
    const points = new Float32Array(300_000);
    for (let index = 0; index < points.length; index++) {
      points[index] = Math.sin(index);
    }
    // More slow jobs than the pool has workers (at most six), so the quick
    // one has to wait in the queue behind them.
    const slow = Array.from({ length: 7 }, (_, index) =>
      handleRegistrationRequest(panel as never, {
        id: `slow-${index}`,
        kind: 'register',
        source: points,
        target: points,
      })
    );
    const triangle = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
    const quick = handleRegistrationRequest(panel as never, {
      id: 'queued',
      kind: 'fit',
      source: triangle,
      target: triangle,
    });
    for (let index = 0; index < slow.length; index++) {
      cancelRegistrationRequest(panel as never, `slow-${index}`);
    }
    await Promise.all(slow);
    await quick;
    assert.deepStrictEqual(
      replies.map(reply => reply.id),
      ['queued']
    );
    cancelRegistrationRequest(panel as never);
  });

  test('client cancellation rejects promptly, sends a cancel message and ignores a late reply', async () => {
    const messages: any[] = [];
    configureRegistrationExtensionHost(message => {
      messages.push(message);
    });
    try {
      const controller = new AbortController();
      const points = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
      const result = fitCorrespondences(points, points, controller.signal);
      await new Promise(resolve => setImmediate(resolve));
      const rejected = assert.rejects(result, { name: 'AbortError' });
      controller.abort();
      await rejected;
      assert.strictEqual(messages.length, 2);
      assert.strictEqual(messages[1].type, 'registrationCancel');
      assert.strictEqual(messages[1].id, messages[0].id);
      assert.strictEqual(
        handleRegistrationExtensionResult({ id: messages[0].id, matrix: null }),
        false
      );
    } finally {
      configureRegistrationExtensionHost(null);
    }
  });

  // The extension host queues and runs several requests itself (align-all
  // solves its pairs side by side), so the client sends each at once and a
  // cancellation names exactly the request it cancels.
  test('cancelling one client request leaves the other in flight alone', async () => {
    const messages: any[] = [];
    configureRegistrationExtensionHost(message => messages.push(message));
    try {
      const points = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
      const first = fitCorrespondences(points, points);
      await new Promise(resolve => setImmediate(resolve));
      const controller = new AbortController();
      const queued = fitCorrespondences(points, points, controller.signal);
      const rejected = assert.rejects(queued, { name: 'AbortError' });
      controller.abort();
      await rejected;
      assert.deepStrictEqual(
        messages.map(message => message.type),
        ['registrationRequest', 'registrationRequest', 'registrationCancel']
      );
      assert.strictEqual(messages[2].id, messages[1].id);
      handleRegistrationExtensionResult({ id: messages[0].id, matrix: null });
      assert.strictEqual(await first, null);
    } finally {
      configureRegistrationExtensionHost(null);
    }
  });

  test('returns an actionable error for malformed point data', async () => {
    const replies: any[] = [];
    const panel = {
      webview: {
        postMessage: async (message: unknown) => {
          replies.push(message);
          return true;
        },
      },
    };

    await handleRegistrationRequest(panel as never, {
      id: 'bad-registration',
      kind: 'icp',
      source: [0, 0, 0],
      target: new Float32Array(9),
    });

    assert.match(replies[0].error, /Float32Array/);
  });

  test('the webview client resolves replies from the extension host', async () => {
    configureRegistrationExtensionHost(message => {
      queueMicrotask(() =>
        handleRegistrationExtensionResult({
          id: message.id,
          matrix: new Float64Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 2, -1, 0.5, 1]),
          stats: JSON.stringify({ rmse: 0, maxError: 0 }),
        })
      );
    });

    const points = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
    const result = await fitCorrespondences(points, points);

    assert.ok(result);
    assert.deepStrictEqual(result!.matrix.elements.slice(12, 15), [2, -1, 0.5]);
    assert.strictEqual(registrationBackend(), 'extension host');
    configureRegistrationExtensionHost(null);
  });
});
