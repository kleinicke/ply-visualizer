import { spawnWorker, WorkerScript } from '../utils/webviewWorker';
import { pointcloudWasmModule } from './wasmLoader.browser';

/** Kept behind a browser-only dynamic import: Node must not evaluate import.meta.url. */
export async function createRegistrationWorker(): Promise<Worker> {
  const module = await pointcloudWasmModule();
  if (!module) {
    throw new Error('Could not compile registration WebAssembly');
  }
  const worker = await spawnWorker(
    // @ts-ignore -- emitted by webpack; the host also checks this file as CommonJS.
    new WorkerScript(new URL('./registrationWorker.ts', import.meta.url))
  );
  // A blob worker cannot fetch packaged assets through VS Code's resource service.
  worker.postMessage({ type: 'initialize', module });
  return worker;
}
