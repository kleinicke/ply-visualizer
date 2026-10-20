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

workerScope.onmessage = async (
  event: MessageEvent<RegistrationRequest | { type: 'initialize'; module: WebAssembly.Module }>
) => {
  const request = event.data;
  if ('type' in request && request.type === 'initialize') {
    // eslint-disable-next-line @typescript-eslint/naming-convention -- wasm-bindgen API
    initPromise ??= initWasm({ module_or_path: request.module });
    try {
      await initPromise;
      workerScope.postMessage({ ready: true });
    } catch (error) {
      workerScope.postMessage({ ready: false, error: String(error) });
    }
    return;
  }
  if (!('kind' in request)) {
    return;
  }
  try {
    if (!initPromise) {
      throw new Error('Registration worker was not initialized');
    }
    await initPromise;
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
