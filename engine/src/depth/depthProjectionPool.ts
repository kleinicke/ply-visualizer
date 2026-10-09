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
import {
  exrZipPlanSync,
  initTiffWasm,
  tiffStripPlanSync,
  tiffWasmModule,
  type DepthProjectWasmParams,
  type DepthProjectWasmResult,
} from './readers/tiffWasm';
import { spawnWorker, WorkerScript } from '../utils/webviewWorker';
import { BAND_ROWS_MISSING } from './depthBandProtocol';

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
  tiffWasmModule?: WebAssembly.Module;
  /**
   * Keep these rows in the worker under this key; an empty `depth` then means
   * "project the rows you kept".
   */
  bandKey?: string;
  /** Set instead of a projection: decode this run of TIFF strips. */
  strips?: { blob: ArrayBuffer; counts: Uint32Array; firstStrip: number; fields: Float64Array };
  /** Or this run of ZIP16 EXR blocks. */
  exrBlocks?: {
    blob: ArrayBuffer;
    counts: Uint32Array;
    rows: Uint32Array;
    width: number;
    kinds: Uint32Array;
    selection: Int32Array;
  };
}

export interface DepthBandResponse {
  id: number;
  ok: boolean;
  band?: DepthProjectWasmResult;
  samples?: Float32Array;
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

let workers: Promise<Worker[] | null> | undefined;
let nextRequestId = 1;
const pending = new Map<number, { resolve: (value: DepthBandResponse) => void }>();

/** The band worker's script, for a worker that will start this pool itself. */
export function bandWorkerScript(): WorkerScript {
  // @ts-ignore -- the extension-host tsconfig type-checks shared depth files
  // as CommonJS, while this expression is emitted only by the web bundle.
  return new WorkerScript(new URL('./depthProjectionWorker.ts', import.meta.url));
}

function getWorkers(): Promise<Worker[] | null> {
  workers ??= startWorkers();
  return workers;
}

async function startWorkers(): Promise<Worker[] | null> {
  if (typeof Worker === 'undefined') {
    return null;
  }
  try {
    const glueUrl = (globalThis as any).__TIFF_WASM_GLUE_URL__ as string | undefined;
    const scripts = glueUrl ? [new URL(glueUrl, location.href).href] : [];
    const started: Worker[] = [];
    // Set when a sibling fails while others are still starting: those are
    // stopped as they arrive, and the pool is never armed.
    let failed = false;
    const pool = await Promise.all(
      Array.from({ length: poolSize() }, async (_, index) => {
        const worker = await spawnWorker(bandWorkerScript(), {
          name: `depth-projection-${index}`,
          scripts,
        });
        started.push(worker);
        if (failed) {
          released.add(worker);
          worker.terminate();
          return worker;
        }
        worker.onmessage = (event: MessageEvent<DepthBandResponse>) => {
          const entry = pending.get(event.data.id);
          if (entry) {
            pending.delete(event.data.id);
            entry.resolve(event.data);
          }
        };
        worker.onerror = event => {
          // Handled here: the bands fail and the caller projects in one pass.
          // Left alone, the error would also reach the worker that owns this
          // pool and fail its whole conversion.
          event.preventDefault();
          failed = true;
          // A worker that failed - typically one that could not even start -
          // never answers again, and a later job posted to it would wait
          // forever. Give the pool up for good; callers then work in one pass.
          workers = Promise.resolve(null);
          startedPool = null;
          for (const other of started) {
            // Also refused by `runBand`, for a caller that already holds it.
            released.add(other);
            other.terminate();
          }
          for (const [id, entry] of pending) {
            pending.delete(id);
            entry.resolve({ id, ok: false, error: 'Depth projection worker error' });
          }
        };
        return worker;
      })
    );
    if (failed) {
      return null;
    }
    startedPool = pool;
    return pool;
  } catch (error) {
    console.warn('[DepthProjection] workers unavailable, projecting in one pass:', error);
    return null;
  }
}

/**
 * The pool is let go after this long without work. Each worker's wasm memory
 * only grows - to its largest band or strip run, tens of megabytes on a big
 * image - and seven of them idling for the life of the view is memory the
 * machine needs back. Starting them again is cheap: the script and the
 * compiled kernel are both kept.
 */
const IDLE_RELEASE_MS = 15_000;
let idleTimer: ReturnType<typeof setTimeout> | undefined;
/** The started pool, once known, so the release can run synchronously. */
let startedPool: Worker[] | null = null;
/** Released workers: a caller still holding one gets an immediate failure. */
const released = new WeakSet<Worker>();

function releaseWhenIdle(): void {
  clearTimeout(idleTimer);
  if (pending.size > 0) {
    return;
  }
  idleTimer = setTimeout(() => {
    // A pool given up after an error stays given up; only a healthy idle one
    // is let go.
    if (pending.size > 0 || !startedPool) {
      return;
    }
    const pool = startedPool;
    startedPool = null;
    workers = undefined;
    for (const worker of pool) {
      released.add(worker);
      worker.terminate();
    }
  }, IDLE_RELEASE_MS);
}

function runBand(worker: Worker, request: DepthBandRequest): Promise<DepthBandResponse> {
  clearTimeout(idleTimer);
  if (released.has(worker)) {
    return Promise.resolve({ id: request.id, ok: false, error: 'Depth worker was released' });
  }
  return new Promise<DepthBandResponse>(resolve => {
    pending.set(request.id, { resolve });
    worker.postMessage(request, [request.strips?.blob ?? request.exrBlocks?.blob ?? request.depth]);
  }).finally(releaseWhenIdle);
}

/** Below this a TIFF decodes faster on one thread than it splits. */
const MIN_PIXELS_TO_DECODE_IN_STRIPS = 4_000_000;

/**
 * Decode a large stripped TIFF on the pool, a run of strips per worker.
 *
 * The decode was the larger half of opening a big depth TIFF once projection
 * ran in bands: 410 ms of a 930 ms load for 26 megapixels of deflate float.
 * Strips are independent, so each worker gets a contiguous run of them (only
 * those compressed bytes cross) and the runs stack back in order into exactly
 * the samples `decode_tiff_fast` returns - verified byte for byte on every
 * TIFF layout the test data has. Null whenever the file or the page does not
 * suit it (tiles, planes, orientation, a small image, no workers); the caller
 * then decodes in one call as before.
 */
export async function decodeTiffInStrips(bytes: Uint8Array): Promise<{
  width: number;
  height: number;
  channels: number;
  bitsPerSample: number;
  sampleFormat: number;
  compression: number;
  predictor: number;
  data: Float32Array;
} | null> {
  if (!(await initTiffWasm())) {
    return null;
  }
  const plan = tiffStripPlanSync(bytes);
  if (
    !plan ||
    !plan.stackable ||
    plan.width * plan.height < MIN_PIXELS_TO_DECODE_IN_STRIPS ||
    plan.counts.length < 8
  ) {
    return null;
  }
  const [pool, tiffWasm] = await Promise.all([getWorkers(), tiffWasmModule()]);
  if (!pool || pool.length < 2) {
    return null;
  }
  const strips = plan.counts.length;
  const perRun = Math.ceil(strips / pool.length);
  const jobs: Array<Promise<DepthBandResponse>> = [];
  for (let first = 0, index = 0; first < strips; first += perRun, index++) {
    const end = Math.min(strips, first + perRun);
    const counts = new Uint32Array(end - first);
    let length = 0;
    for (let strip = first; strip < end; strip++) {
      counts[strip - first] = plan.counts[strip];
      length += plan.counts[strip];
    }
    const blob = new Uint8Array(length);
    let at = 0;
    for (let strip = first; strip < end; strip++) {
      const offset = plan.offsets[strip];
      const count = plan.counts[strip];
      if (offset + count > bytes.length) {
        return null; // truncated file: let the whole-file decoder report it
      }
      blob.set(bytes.subarray(offset, offset + count), at);
      at += count;
    }
    jobs.push(
      runBand(pool[index % pool.length], {
        ...decodeRequest(tiffWasm),
        strips: { blob: blob.buffer, counts, firstStrip: first, fields: plan.fields },
      })
    );
  }
  const responses = await Promise.all(jobs);
  if (responses.some(response => !response.ok || !response.samples)) {
    const failure = responses.find(response => !response.ok);
    console.warn('[DepthDecode] strip run failed, decoding in one call:', failure?.error);
    return null;
  }
  const data = concat(
    responses.map(response => response.samples!),
    length => new Float32Array(length)
  );
  if (data.length !== plan.width * plan.height * plan.channels) {
    return null;
  }
  return {
    width: plan.width,
    height: plan.height,
    channels: plan.channels,
    bitsPerSample: plan.bitsPerSample,
    sampleFormat: plan.sampleFormat,
    compression: plan.compression,
    predictor: plan.predictor,
    data,
  };
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

/** Which rows each worker keeps (see `DepthBandSession`). */
const heldBands = new WeakMap<Worker, string>();
const depthImageIds = new WeakMap<Float32Array, number>();
let nextDepthImageId = 1;

function depthImageId(data: Float32Array): number {
  let id = depthImageIds.get(data);
  if (id === undefined) {
    id = nextDepthImageId++;
    depthImageIds.set(data, id);
  }
  return id;
}

/**
 * Positive finite depth range, remembered per array: a settings change that
 * leaves the depth values alone (anything but scale, bias, disparity or
 * clamping) projects the same decoded array again, and the scan is 50 ms of a
 * 26-megapixel re-projection.
 */
const depthRanges = new WeakMap<Float32Array, { depthMin: number; depthMax: number }>();
function depthRange(data: Float32Array): { depthMin: number; depthMax: number } {
  const known = depthRanges.get(data);
  if (known) {
    return known;
  }
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
  const range = { depthMin, depthMax };
  depthRanges.set(data, range);
  return range;
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
): Promise<(DepthProjectWasmResult & { bands: number; phases: string }) | null> {
  if (width * height < MIN_PIXELS_TO_SPLIT || height < 8) {
    return null;
  }
  const [pool, tiffWasm] = await Promise.all([getWorkers(), tiffWasmModule()]);
  if (!pool || pool.length < 2) {
    return null;
  }

  // The grey ramp is logarithmic over the whole image's depth range, so it has
  // to be measured before the rows are split up. One pass over the depth values
  // is cheap next to the projection it feeds.
  const scanStarted = performance.now();
  const { depthMin, depthMax } = depthRange(data);
  if (!Number.isFinite(depthMin) || !Number.isFinite(depthMax)) {
    return null;
  }

  const postStarted = performance.now();
  const bandCount = Math.min(pool.length, height);
  const rowsPerBand = Math.ceil(height / bandCount);
  const glueUrl = (globalThis as any).__TIFF_WASM_GLUE_URL__;
  const wasmUrl = (globalThis as any).__TIFF_WASM_URL__;

  // Each band goes to the same worker every time, which keeps its rows in
  // wasm after the first projection (`DepthBandSession`): a parameter change
  // then sends only the parameters, not 100 MB of rows.
  const imageId = depthImageId(data);
  const project = (index: number, rowOffset: number, rows: number, withRows: boolean) => {
    const worker = pool[index];
    const bandKey = `${imageId}:${width}:${rowOffset}:${rows}`;
    const sendRows = withRows || heldBands.get(worker) !== bandKey;
    return runBand(worker, {
      id: nextRequestId++,
      // Only this band's rows cross, as a transfer rather than a copy - and
      // only when the worker does not hold them already.
      depth: sendRows
        ? data.slice(rowOffset * width, (rowOffset + rows) * width).buffer
        : new ArrayBuffer(0),
      bandKey,
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
      tiffWasmModule: tiffWasm ?? undefined,
    }).then(response => {
      if (response.ok) {
        heldBands.set(worker, bandKey);
      } else {
        heldBands.delete(worker);
      }
      return response;
    });
  };
  const jobs: Array<Promise<DepthBandResponse>> = [];
  for (let index = 0; index < bandCount; index++) {
    const rowOffset = index * rowsPerBand;
    const rows = Math.min(rowsPerBand, height - rowOffset);
    if (rows <= 0) {
      break;
    }
    jobs.push(
      project(index, rowOffset, rows, false).then(response =>
        // A worker that lost its rows (restarted) gets them once more.
        !response.ok && response.error === BAND_ROWS_MISSING
          ? project(index, rowOffset, rows, true)
          : response
      )
    );
  }

  const waitStarted = performance.now();
  const responses = await Promise.all(jobs);
  const joinStarted = performance.now();
  if (responses.some(response => !response.ok || !response.band)) {
    const failure = responses.find(response => !response.ok);
    console.warn('[DepthProjection] band failed, projecting in one pass:', failure?.error);
    return null;
  }

  const bands = responses.map(response => response.band!);
  const hasPixelCoords = bands.every(band => !!band.pixelCoords);
  const joined = {
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
    bands: bands.length,
    phases: '',
  };
  joined.phases =
    `range ${(postStarted - scanStarted).toFixed(0)} · split ${(waitStarted - postStarted).toFixed(0)} · ` +
    `bands ${(joinStarted - waitStarted).toFixed(0)} · join ${(performance.now() - joinStarted).toFixed(0)}`;
  return joined;
}

/** An empty projection request, for jobs that carry a decode instead. */
function decodeRequest(tiffWasm: WebAssembly.Module | null): DepthBandRequest {
  return {
    id: nextRequestId++,
    depth: new ArrayBuffer(0),
    width: 0,
    height: 0,
    rowOffset: 0,
    depthMin: 0,
    depthMax: 0,
    params: {} as DepthProjectWasmParams,
    tiffWasmGlueUrl: (globalThis as any).__TIFF_WASM_GLUE_URL__,
    tiffWasmUrl: (globalThis as any).__TIFF_WASM_URL__,
    tiffWasmModule: tiffWasm ?? undefined,
  };
}

/**
 * Decode a ZIP16 scanline EXR on the pool, a run of blocks per worker - the
 * EXR counterpart of `decodeTiffInStrips`, with the same guarantee: the runs
 * stack into exactly the samples `decode_exr_fast` returns (checked byte for
 * byte on every ZIP16 file in the test data). 540 ms in one call for a
 * 2736 x 2736 four-channel Blender depth pass. Null for any other layout, a
 * small image or no workers.
 */
export async function decodeExrInBlocks(bytes: Uint8Array): Promise<{
  width: number;
  height: number;
  channels: number;
  displayedChannels: string[];
  data: Float32Array;
} | null> {
  if (!(await initTiffWasm())) {
    return null;
  }
  const plan = exrZipPlanSync(bytes);
  if (
    !plan ||
    plan.width * plan.height < MIN_PIXELS_TO_DECODE_IN_STRIPS ||
    plan.counts.length < 8
  ) {
    return null;
  }
  const [pool, tiffWasm] = await Promise.all([getWorkers(), tiffWasmModule()]);
  if (!pool || pool.length < 2) {
    return null;
  }
  // ZIP compresses sixteen scanlines per block; the last block may be short.
  const end = plan.dataY + plan.height;
  const rows = Uint32Array.from(plan.yCoordinates, y => Math.max(0, Math.min(16, end - y)));
  const blocks = plan.counts.length;
  const perRun = Math.ceil(blocks / pool.length);
  const jobs: Array<Promise<DepthBandResponse>> = [];
  let offset = 0;
  for (let first = 0, index = 0; first < blocks; first += perRun, index++) {
    const last = Math.min(blocks, first + perRun);
    let length = 0;
    for (let block = first; block < last; block++) {
      length += plan.counts[block];
    }
    if (offset + length > plan.compressed.length) {
      return null;
    }
    const blob = plan.compressed.slice(offset, offset + length);
    offset += length;
    jobs.push(
      runBand(pool[index % pool.length], {
        ...decodeRequest(tiffWasm),
        exrBlocks: {
          blob: blob.buffer,
          counts: plan.counts.slice(first, last),
          rows: rows.slice(first, last),
          width: plan.width,
          kinds: plan.kinds,
          selection: plan.selection,
        },
      })
    );
  }
  const responses = await Promise.all(jobs);
  if (responses.some(response => !response.ok || !response.samples)) {
    const failure = responses.find(response => !response.ok);
    console.warn('[DepthDecode] EXR block run failed, decoding in one call:', failure?.error);
    return null;
  }
  const data = concat(
    responses.map(response => response.samples!),
    length => new Float32Array(length)
  );
  const channels = plan.selection.length;
  if (data.length !== plan.width * plan.height * channels) {
    return null;
  }
  return {
    width: plan.width,
    height: plan.height,
    channels,
    displayedChannels: plan.displayedChannels,
    data,
  };
}
