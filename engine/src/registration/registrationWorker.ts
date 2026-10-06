import { runRegistration } from './run';
/**
 * Worker host for the Rust registration solvers.
 *
 * Registration is seconds of solid compute — a yaw sweep plus several ICP runs
 * — so running it on the render thread freezes the viewer for exactly as long
 * as the operation takes. The kernels themselves live in
 * `wasm/pointcloud-parser/src/registration/`; this file only carries requests
 * across and hands the point buffers back.
 */

import initWasm, * as wasm from '../../../wasm/pointcloud-parser/pkg-web/pointcloud_parser';

export type RegistrationKind = 'register' | 'coarse' | 'icp' | 'fit';

export interface RegistrationRequest {
  id: number;
  kind: RegistrationKind;
  source: Float32Array;
  target: Float32Array;
  settingsJson: string;
}

// Keep WebWorker globals local to this module, as lidarWorker.ts does: a
// triple-slash WebWorker lib reference pollutes the shared DOM compilation.
const workerScope: any = self;

let initPromise: Promise<unknown> | null = null;

function ensureInitialized(): Promise<unknown> {
  if (!initPromise) {
    initPromise = initWasm();
  }
  return initPromise;
}

// Announced once the module is live, so the page can tell "this worker works"
// from "this environment refused to start one" before it hands over any data.
// A VS Code webview is the second case: its bundle is served from a different
// origin than the document, so the Worker constructor rejects the script.
ensureInitialized().then(
  () => workerScope.postMessage({ ready: true }),
  (error: unknown) =>
    workerScope.postMessage({
      ready: false,
      error: error instanceof Error ? error.message : String(error),
    })
);

workerScope.onmessage = async (event: MessageEvent<RegistrationRequest>) => {
  const request = event.data;
  try {
    await ensureInitialized();
    const result = runRegistration(
      wasm,
      request.kind,
      request.source,
      request.target,
      request.settingsJson
    );
    workerScope.postMessage(
      { id: request.id, matrix: result?.matrix ?? null, stats: result?.stats ?? null },
      result ? [result.matrix.buffer] : []
    );
  } catch (error) {
    workerScope.postMessage({
      id: request.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
