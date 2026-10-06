import { parentPort } from 'node:worker_threads';
import { loadRegistrationWasm } from '../../engine/src/registration/wasmLoader';
import { runRegistration } from '../../engine/src/registration/run';
import type { RegistrationRequest } from '../../engine/src/registration/registrationWorker';

parentPort!.on('message', async (request: Omit<RegistrationRequest, 'id'>) => {
  try {
    const wasm = await loadRegistrationWasm();
    if (!wasm) {
      throw new Error('The registration WebAssembly module failed to load.');
    }
    const result = runRegistration(
      wasm,
      request.kind,
      request.source,
      request.target,
      request.settingsJson
    );
    parentPort!.postMessage(result, result ? [result.matrix.buffer as ArrayBuffer] : []);
  } catch (error) {
    parentPort!.postMessage({ error: error instanceof Error ? error.message : String(error) });
  }
});
