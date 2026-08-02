import * as path from 'path';
import { createRequire } from 'module';
import type {
  StonexCameraBatchProjector,
  StonexCameraProjectionRequest,
} from '../engine/src/parsers/stonexX3aParser';

// eslint-disable-next-line @typescript-eslint/naming-convention -- name is defined by webpack
declare const __non_webpack_require__: NodeRequire | undefined;

let moduleInstance: any = null;
let attempted = false;

function loadCameraWasm(): any {
  if (attempted) {
    return moduleInstance;
  }
  attempted = true;
  try {
    const req: NodeRequire =
      typeof __non_webpack_require__ !== 'undefined'
        ? __non_webpack_require__
        : createRequire(__filename);
    moduleInstance = req(path.join(__dirname, 'wasm', 'tiff-camera', 'tiff_wasm.js'));
  } catch (error) {
    console.warn('[camera-wasm] module unavailable:', error);
    moduleInstance = null;
  }
  return moduleInstance;
}

function projectCameraPoints(request: StonexCameraProjectionRequest): Float32Array | null {
  const wasm = loadCameraWasm();
  if (typeof wasm?.camera_project_points_indexed !== 'function') {
    return null;
  }
  return new Float32Array(
    wasm.camera_project_points_indexed(
      'pinhole-opencv',
      request.fx,
      request.fy,
      request.cx,
      request.cy,
      new Float64Array(request.coefficients),
      request.positions,
      request.indices,
      new Float64Array(request.transform),
      request.maxNormalizedX,
      request.maxNormalizedY
    )
  );
}

/** Batched shared Rust camera projector used by extension-host X3A parsing. */
export const stonexCameraProjector: StonexCameraBatchProjector = projectCameraPoints;
