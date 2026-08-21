/**
 * One horizontal band of a depth image, unprojected.
 *
 * The unprojection is the one part of a depth load that is embarrassingly
 * parallel: every pixel is independent, and a band needs nothing but its own
 * rows plus a handful of intrinsics. Measured on a 16.8M-pixel image, eight of
 * these turn 2840ms into 520ms for an OpenCV pinhole and 1503ms into 263ms for
 * a KB3 fisheye — the two models where the per-pixel cost is an iterative
 * solve. See docs/performance-method.md.
 *
 * The band's *result* must be indistinguishable from the same rows of a
 * whole-image projection, which takes two things this worker cannot work out
 * for itself and so receives: the full image's depth range (the grey ramp is
 * logarithmic over it, so a per-band range bands the image) and the band's row
 * offset (for the returned pixel coordinates).
 */
import {
  ensureTiffWasmGlueLoaded,
  initTiffWasm,
  projectDepthBandWasmSync,
} from './readers/tiffWasm';
import type { DepthBandRequest, DepthBandResponse } from './depthProjectionPool';

const workerScope: any = self;

workerScope.onmessage = async (event: MessageEvent<DepthBandRequest>) => {
  const request = event.data;
  try {
    if (request.tiffWasmUrl) {
      (globalThis as any).__TIFF_WASM_URL__ = request.tiffWasmUrl;
    }
    ensureTiffWasmGlueLoaded(request.tiffWasmGlueUrl);
    if (!(await initTiffWasm())) {
      throw new Error('Depth projection worker could not start the camera-model kernel');
    }

    const band = projectDepthBandWasmSync(
      new Float32Array(request.depth),
      request.width,
      request.height,
      request.rowOffset,
      request.depthMin,
      request.depthMax,
      request.params
    );
    if (!band) {
      throw new Error('Depth projection worker produced no result');
    }

    const transfers: Transferable[] = [band.vertices.buffer, band.colors.buffer];
    if (band.pixelCoords) {
      transfers.push(band.pixelCoords.buffer);
    }
    const response: DepthBandResponse = { id: request.id, ok: true, band };
    workerScope.postMessage(response, transfers);
  } catch (error) {
    const response: DepthBandResponse = {
      id: request.id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
    workerScope.postMessage(response);
  }
};
