import * as assert from 'assert';
import { createWebviewReadyGate } from '../../providerHandlers/webviewReadyGate';

suite('Webview readiness gate', () => {
  test('holds work until the webview reports ready', async () => {
    const gate = createWebviewReadyGate();
    let settled = false;
    const waiting = gate.wait().then(ready => {
      settled = true;
      return ready;
    });

    await Promise.resolve();
    assert.strictEqual(settled, false);

    gate.markReady();
    assert.strictEqual(await waiting, true);
  });

  test('releases queued work as undeliverable when the panel is disposed', async () => {
    const gate = createWebviewReadyGate();
    const waiting = gate.wait();

    gate.dispose();

    assert.strictEqual(await waiting, false);
  });

  test('keeps the first terminal state', async () => {
    const readyGate = createWebviewReadyGate();
    readyGate.markReady();
    readyGate.dispose();
    assert.strictEqual(await readyGate.wait(), true);

    const disposedGate = createWebviewReadyGate();
    disposedGate.dispose();
    disposedGate.markReady();
    assert.strictEqual(await disposedGate.wait(), false);
  });
});
