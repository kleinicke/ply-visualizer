/**
 * A small pool of workers that unproject depth images in horizontal bands.
 *
 * Why a pool and not one worker per call: the workers each hold an instantiated
 * copy of the camera-model WASM module, and instantiating it costs more than a
 * band of work. They are created on first use and kept.
 *
 * Why bands and not one worker per image: a single image is the whole job. This
 * is the one place in the project where splitting the work also splits the data
 * it needs — a band wants its own rows and nothing else — which is what makes
 * it worth doing here and not for the archive colouring, where every point can
 * need every photograph.
 *
 * Everything degrades to the caller's synchronous path: a webview that refuses
 * to start workers, a kernel that will not load, an image too small to be worth
 * splitting, all return null rather than throwing.
 */
import type { DepthProjectWasmParams, DepthProjectWasmResult } from './readers/tiffWasm';

export interface DepthBandRequest {
  id: number;
  depth: ArrayBuffer;
  width: number;
  height: number;
  rowOffset: number;
  depthMin: number;
  depthMax: number;
  params: DepthProjectWasmParams;
  tiffWasmGlueUrl?: string;
  tiffWasmUrl?: string;
}

export interface DepthBandResponse {
  id: number;
  ok: boolean;
  band?: DepthProjectWasmResult;
  error?: string;
}

/**
 * Below this, splitting costs more than it saves: each band pays a structured
 * clone of its rows and a round trip, and a small image's projection is a few
 * milliseconds. Chosen an order of magnitude under the sizes where the win was
 * measured (16.8M px), not tuned — the shape of the curve matters more than the
 * exact knee, and a wrong guess here only forfeits a speedup.
 */
const MIN_PIXELS_TO_SPLIT = 1_000_000;

/** Leave a core for the main thread and the decode; never fewer than two. */
function poolSize(): number {
  const cores = (globalThis.navigator?.hardwareConcurrency ?? 4) as number;
  return Math.max(2, Math.min(8, cores - 1));
}

let workers: Worker[] | null | undefined;
let nextRequestId = 1;
const pending = new Map<number, { resolve: (value: DepthBandResponse) => void }>();

function getWorkers(): Worker[] | null {
  if (workers !== undefined) {
    return workers;
  }
  if (typeof Worker === 'undefined') {
    workers = null;
    return workers;
  }
  try {
    workers = Array.from({ length: poolSize() }, (_, index) => {
      // @ts-ignore -- the extension-host tsconfig type-checks shared depth files
      // as CommonJS, while this expression is emitted only by the web bundle.
      const worker = new Worker(new URL('./depthProjectionWorker.ts', import.meta.url), {
        name: `depth-projection-${index}`,
      });
      worker.onmessage = (event: MessageEvent<DepthBandResponse>) => {
        const entry = pending.get(event.data.id);
        if (entry) {
          pending.delete(event.data.id);
          entry.resolve(event.data);
        }
      };
      worker.onerror = () => {
        // Individual failures surface as unresolved bands; the caller times out
        // into its synchronous path rather than hanging.
        for (const [id, entry] of pending) {
          pending.delete(id);
          entry.resolve({ id, ok: false, error: 'Depth projection worker error' });
        }
      };
      return worker;
    });
  } catch (error) {
    console.warn('[DepthProjection] workers unavailable, projecting in one pass:', error);
    workers = null;
  }
  return workers;
}

function runBand(worker: Worker, request: DepthBandRequest): Promise<DepthBandResponse> {
  return new Promise(resolve => {
    pending.set(request.id, { resolve });
    worker.postMessage(request, [request.depth]);
  });
}

function concat<T extends Float32Array | Uint8Array | Uint16Array>(
  parts: T[],
  create: (length: number) => T
): T {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = create(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/**
 * Project `data` in parallel, or return null when the caller should do it
 * itself.
 *
 * @returns the same result a whole-image projection produces — verified band
 *   for band, not just point count, in engine/test/depth-band-projection.spec.ts
 */
export async function projectDepthInBands(
  data: Float32Array,
  width: number,
  height: number,
  params: DepthProjectWasmParams
): Promise<DepthProjectWasmResult | null> {
  if (width * height < MIN_PIXELS_TO_SPLIT || height < 8) {
    return null;
  }
  const pool = getWorkers();
  if (!pool || pool.length < 2) {
    return null;
  }

  // The grey ramp is logarithmic over the whole image's depth range, so it has
  // to be measured before the rows are split up. One pass over the depth values
  // is cheap next to the projection it feeds.
  let depthMin = Infinity;
  let depthMax = -Infinity;
  for (let index = 0; index < data.length; index++) {
    const value = data[index];
    if (value > 0 && Number.isFinite(value)) {
      if (value < depthMin) {
        depthMin = value;
      }
      if (value > depthMax) {
        depthMax = value;
      }
    }
  }
  if (!Number.isFinite(depthMin) || !Number.isFinite(depthMax)) {
    return null;
  }

  const bandCount = Math.min(pool.length, height);
  const rowsPerBand = Math.ceil(height / bandCount);
  const glueUrl = (globalThis as any).__TIFF_WASM_GLUE_URL__;
  const wasmUrl = (globalThis as any).__TIFF_WASM_URL__;

  const jobs: Array<Promise<DepthBandResponse>> = [];
  for (let index = 0; index < bandCount; index++) {
    const rowOffset = index * rowsPerBand;
    const rows = Math.min(rowsPerBand, height - rowOffset);
    if (rows <= 0) {
      break;
    }
    // Only this band's rows cross, and they cross as a transfer rather than a
    // copy on the way in.
    const slice = data.slice(rowOffset * width, (rowOffset + rows) * width);
    jobs.push(
      runBand(pool[index], {
        id: nextRequestId++,
        depth: slice.buffer,
        width,
        height: rows,
        rowOffset,
        depthMin,
        depthMax,
        // The rays are computed from row indices inside the slice, so the
        // principal point moves with it.
        params: { ...params, cy: params.cy - rowOffset },
        tiffWasmGlueUrl: glueUrl,
        tiffWasmUrl: wasmUrl,
      })
    );
  }

  const responses = await Promise.all(jobs);
  if (responses.some(response => !response.ok || !response.band)) {
    const failure = responses.find(response => !response.ok);
    console.warn('[DepthProjection] band failed, projecting in one pass:', failure?.error);
    return null;
  }

  const bands = responses.map(response => response.band!);
  const hasPixelCoords = bands.every(band => !!band.pixelCoords);
  return {
    vertices: concat(
      bands.map(band => band.vertices),
      length => new Float32Array(length)
    ),
    colors: concat(
      bands.map(band => band.colors),
      length => new Uint8Array(length)
    ),
    pointCount: bands.reduce((sum, band) => sum + band.pointCount, 0),
    width,
    height,
    pixelCoords: hasPixelCoords
      ? concat(
          bands.map(band => band.pixelCoords!),
          length => new Uint16Array(length)
        )
      : undefined,
    rejectedCount: bands.reduce((sum, band) => sum + band.rejectedCount, 0),
    nonConvergedCount: bands.reduce((sum, band) => sum + band.nonConvergedCount, 0),
  };
}
