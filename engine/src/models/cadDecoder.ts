import type { CadResult, CadFormat } from './cadTypes';
import { cadWorkerSource } from './cadWorkerSource';

export async function decodeCad(
  bytes: Uint8Array<ArrayBuffer>,
  format: CadFormat
): Promise<CadResult> {
  // Webpack emits both upstream files as assets, fetched only for CAD imports.
  // @ts-ignore -- shared files are also checked by the CommonJS host tsconfig.
  const scriptUrl = new URL('occt-import-js/dist/occt-import-js.js', import.meta.url).href;
  // @ts-ignore -- this module only executes in the browser/webview.
  const wasmUrl = new URL('occt-import-js/dist/occt-import-js.wasm', import.meta.url).href;
  // VS Code's resource service worker can serve the page, but cannot service
  // importScripts from a blob worker. Fetch trusted packaged assets in the page
  // and hand them to the worker without eval or external worker requests.
  const [script, wasmBinary] = await Promise.all([
    fetch(scriptUrl, { signal: AbortSignal.timeout(30_000) }).then(async response => {
      if (!response.ok) {throw new Error(`Could not load CAD decoder: HTTP ${response.status}`);}
      return response.text();
    }),
    fetch(wasmUrl, { signal: AbortSignal.timeout(30_000) }).then(async response => {
      if (!response.ok) {throw new Error(`Could not load CAD WebAssembly: HTTP ${response.status}`);}
      return response.arrayBuffer();
    }),
  ]);
  const url = URL.createObjectURL(
    new Blob([script, '\n', cadWorkerSource], { type: 'text/javascript' })
  );
  let worker: Worker | undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    worker = new Worker(url);
    const activeWorker = worker;
    return await new Promise<CadResult>((resolve, reject) => {
      timeout = setTimeout(
        () => reject(new Error('CAD conversion exceeded two minutes.')),
        120_000
      );
      activeWorker.onmessage = event => {
        if (event.data.error) {
          reject(new Error(event.data.error));
        } else {
          resolve(event.data.result);
        }
      };
      activeWorker.onerror = event =>
        reject(new Error(event.message || 'CAD decoder worker failed.'));
      activeWorker.onmessageerror = () => reject(new Error('Could not receive CAD geometry.'));
      // Retain the caller's source bytes for reload/export.
      const copy = bytes.slice();
      activeWorker.postMessage({ bytes: copy, wasmBinary, format }, [copy.buffer, wasmBinary]);
    });
  } finally {
    clearTimeout(timeout);
    worker?.terminate();
    URL.revokeObjectURL(url);
  }
}
