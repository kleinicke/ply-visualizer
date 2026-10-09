import { parentPort, workerData } from 'node:worker_threads';
import { loadRegistrationWasm } from '../../engine/src/registration/wasmLoader';
import { loadWebGlue } from './pointcloudWebGlue';
import { runRegistration } from '../../engine/src/registration/run';
import type { RegistrationRequest } from '../../engine/src/registration/registrationWorker';

// Instantiate the solver from the module the host compiled once (see
// parsePool.ts): pairs now run on several of these workers at once, and each
// compiling its own copy would run its first pair on baseline code.
const providedModule = (workerData as { wasmModule?: WebAssembly.Module } | null)?.wasmModule;
const glue = providedModule ? loadWebGlue() : null;
if (providedModule && glue) {
  const instance = glue.initSync({ module: providedModule });
  (globalThis as { plySharedPointcloudWasm?: unknown }).plySharedPointcloudWasm = {
    ...glue,
    memory: instance.memory,
  };
}

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
