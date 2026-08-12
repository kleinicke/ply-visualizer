import * as assert from 'assert';
import { handleRegistrationRequest } from '../../providerHandlers/registration';
import {
  configureRegistrationExtensionHost,
  fitCorrespondences,
  handleRegistrationExtensionResult,
  registrationBackend,
} from '../../../engine/src/registration';

suite('Registration extension-host bridge', () => {
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
