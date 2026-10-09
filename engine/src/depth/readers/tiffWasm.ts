/**
 * Rust/WebAssembly TIFF decoder wrapper.
 *
 * The only TIFF/EXR/PNG16 decoder in this extension — there is no JS fallback.
 * Ported from the tiff-visualizer sister extension's decoder. The wasm-bindgen
 * "no-modules" glue is loaded via a <script> tag before the bundle and exposes
 * a global `wasm_bindgen` (init function + exports). The .wasm binary URL is
 * provided on `window.__TIFF_WASM_URL__` (set by index.html for the standalone
 * site, overridden with a webview-resource URI by the VS Code extension).
 *
 * Init is best-effort and reports availability via a null/false return, but a
 * decode failure on an available module is a genuine error and propagates.
 */

// Provided by media/wasm/tiff_wasm.js (no-modules build). Lexical global.
declare const wasm_bindgen: any;

export interface DepthProjectWasmResult {
  vertices: Float32Array;
  colors: Uint8Array;
  pointCount: number;
  width: number;
  height: number;
  pixelCoords?: Uint16Array;
  sourceIndices?: Uint32Array;
  rejectedCount: number;
  nonConvergedCount: number;
}

export interface DepthProjectWasmParams {
  retainIndices?: boolean;
  kind?: string;
  cameraModel: string;
  convention?: string;
  fx: number;
  fy: number;
  cx: number;
  cy: number;
  coefficients: number[];
}

export interface CameraSolveWasmParams {
  cameraModel: string;
  fx: number;
  fy: number;
  cx: number;
  cy: number;
  coefficients: number[];
}

export interface CameraSolveWasmResult<T extends readonly number[]> {
  value: T;
  valid: boolean;
  converged: boolean;
  iterations: number;
}

export interface CameraProjectPointsWasmParams extends CameraSolveWasmParams {
  positions: Float32Array;
  indices: Uint32Array;
  transform: readonly number[];
  maxNormalizedX: number;
  maxNormalizedY: number;
}

export interface NormalizeDepthWasmParams {
  kind: string;
  unit?: string;
  scale?: number;
  depthScale?: number;
  depthBias?: number;
  fx?: number;
  baseline?: number;
  disparityOffset?: number;
  depthClamp?: { min?: number; max?: number };
}

export interface NormalizeDepthWasmResult {
  width: number;
  height: number;
  data: Float32Array;
  kind: string;
  unit: string;
}

export interface Png16WasmResult {
  width: number;
  height: number;
  channels: number;
  bitDepth: number;
  colorType: number;
  /** Interleaved samples at full 16-bit precision. */
  data: Uint16Array;
}

export interface ExrWasmResult {
  width: number;
  height: number;
  channels: number;
  /** Names of the channels present in the file, in file order. */
  channelNames: string[];
  /** Names of the channels actually packed into `data`, in packed order. */
  displayedChannels: string[];
  /** Interleaved float samples, `channels` per pixel. */
  data: Float32Array;
}

export interface TiffWasmResult {
  width: number;
  height: number;
  channels: number;
  bitsPerSample: number;
  sampleFormat: number; // 1=uint, 2=int, 3=float
  compression: number;
  predictor: number;
  data: Float32Array;
  min: number;
  max: number;
}

let initPromise: Promise<boolean> | null = null;
let ready = false;
let glueLoaded = false;

function getWasmBindgen(): any | null {
  try {
    return typeof wasm_bindgen === 'undefined' ? null : wasm_bindgen;
  } catch {
    return null;
  }
}

export function ensureTiffWasmGlueLoaded(glueUrl?: string): boolean {
  if (glueLoaded || getWasmBindgen()) {
    glueLoaded = true;
    return true;
  }

  const importScriptsFn = (globalThis as any).importScripts as
    ((...urls: string[]) => void) | undefined;
  const url = glueUrl || (globalThis as any).__TIFF_WASM_GLUE_URL__;
  if (!url || typeof importScriptsFn !== 'function') {
    return false;
  }

  try {
    importScriptsFn(url);
    glueLoaded = !!getWasmBindgen();
    return glueLoaded;
  } catch (error) {
    console.warn('[TiffWasm] glue load failed:', error);
    return false;
  }
}

let modulePromise: Promise<WebAssembly.Module | null> | null = null;

/**
 * The kernel, compiled once and shared with every depth worker.
 *
 * Each worker used to fetch and compile its own copy. Besides the repeated
 * compile, V8 tiers wasm up per compiled module and never swaps the code of a
 * call that is already running, so a fresh worker ran its one big band on
 * baseline code. A module compiled here and handed to the workers carries
 * whatever any of them has optimized. Inside a VS Code webview a blob worker
 * also cannot fetch the binary itself (utils/webviewWorker.ts). A worker that
 * received a module (`__TIFF_WASM_MODULE__`) uses that one.
 */
export function tiffWasmModule(): Promise<WebAssembly.Module | null> {
  if (modulePromise) {
    return modulePromise;
  }
  const handed = (globalThis as any).__TIFF_WASM_MODULE__ as WebAssembly.Module | undefined;
  if (handed) {
    modulePromise = Promise.resolve(handed);
    return modulePromise;
  }
  const url = (globalThis as any).__TIFF_WASM_URL__;
  if (!url) {
    return Promise.resolve(null);
  }
  modulePromise = (async () => {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        return null;
      }
      return await WebAssembly.compile(await response.arrayBuffer());
    } catch (error) {
      console.warn('[TiffWasm] could not compile the kernel:', error);
      return null;
    }
  })();
  return modulePromise;
}

// Note: every `take_*` accessor of the generated glue already returns a fresh
// copy (`.slice()` out of wasm memory); wrapping it in another typed-array
// constructor copied it a second time - tens of megabytes per projection.

/** Initialize the WASM module once. Resolves false if unavailable (→ fallback). */
export async function initTiffWasm(): Promise<boolean> {
  if (initPromise) {
    return initPromise;
  }
  initPromise = (async () => {
    try {
      ensureTiffWasmGlueLoaded();
      const wasmApi = getWasmBindgen();
      if (!wasmApi) {
        return false;
      }
      const module = await tiffWasmModule();
      const url = (globalThis as any).__TIFF_WASM_URL__;
      if (!module && !url) {
        return false;
      }
      // Object form is the non-deprecated wasm-bindgen init signature; a bare
      // string still works but logs a deprecation warning.
      await wasmApi({ module_or_path: module ?? url });
      ready = typeof wasmApi.decode_tiff_fast === 'function';
      return ready;
    } catch (error) {
      console.warn('[TiffWasm] init failed, image decoding is unavailable:', error);
      return false;
    }
  })();
  return initPromise;
}

export function isTiffWasmReady(): boolean {
  return ready;
}

export function projectDepthWasmSync(
  data: Float32Array,
  width: number,
  height: number,
  params: DepthProjectWasmParams
): DepthProjectWasmResult | null {
  const wasmApi = getWasmBindgen();
  if (!ready || typeof wasmApi?.project_depth_fast !== 'function') {
    return null;
  }

  let result: any = null;
  try {
    const project = params.retainIndices
      ? wasmApi.project_depth_inspection
      : wasmApi.project_depth_fast;
    result = project(
      data,
      width,
      height,
      params.kind || 'depth',
      params.cameraModel,
      params.convention || 'opengl',
      params.fx,
      params.fy,
      params.cx,
      params.cy,
      new Float64Array(params.coefficients)
    );

    const hasPixelCoords = !!result.has_pixel_coords;
    return {
      sourceIndices: params.retainIndices ? result.take_source_indices() : undefined,
      vertices: result.take_positions(),
      colors: result.take_colors(),
      pointCount: result.point_count,
      width: result.width,
      height: result.height,
      pixelCoords: hasPixelCoords ? result.take_pixel_coords() : undefined,
      rejectedCount: result.rejected_count,
      nonConvergedCount: result.non_converged_count,
    };
  } catch (error) {
    if (params.retainIndices) {
      throw error;
    }
    console.warn('[TiffWasm] depth projection failed:', error);
    return null;
  } finally {
    try {
      result?.free?.();
    } catch {
      /* already freed */
    }
  }
}

/**
 * One band of an image, with the whole image's depth range and its row offset.
 *
 * Same kernel as `projectDepthWasmSync`; the extra arguments are what make a
 * band's output equal to the same rows of a whole-image projection. The caller
 * must also pre-shift the principal point (`cy - rowOffset`), because the rays
 * are computed from row indices within the slice it hands over.
 */
/** A stripped TIFF's layout and block table (`TiffStripPlan` in the adapter). */
export interface TiffStripPlanInfo {
  width: number;
  height: number;
  channels: number;
  bitsPerSample: number;
  sampleFormat: number;
  compression: number;
  predictor: number;
  stackable: boolean;
  offsets: Float64Array;
  counts: Float64Array;
  fields: Float64Array;
}

/** Null when the module is not ready or the file is not a plain strip layout. */
export function tiffStripPlanSync(bytes: Uint8Array): TiffStripPlanInfo | null {
  const wasmApi = getWasmBindgen();
  if (!ready || typeof wasmApi?.tiff_strip_plan !== 'function') {
    return null;
  }
  const plan = wasmApi.tiff_strip_plan(bytes);
  if (!plan) {
    return null;
  }
  try {
    return {
      width: plan.width,
      height: plan.height,
      channels: plan.channels,
      bitsPerSample: plan.bits_per_sample,
      sampleFormat: plan.sample_format,
      compression: plan.compression,
      predictor: plan.predictor,
      stackable: plan.stackable,
      offsets: new Float64Array(plan.offsets()),
      counts: new Float64Array(plan.counts()),
      fields: new Float64Array(plan.fields()),
    };
  } finally {
    plan.free?.();
  }
}

/** A ZIP16 EXR's blocks and layout (`ExrZipPlanJs` in the adapter). */
export interface ExrZipPlanInfo {
  width: number;
  height: number;
  dataY: number;
  kinds: Uint32Array;
  selection: Int32Array;
  displayedChannels: string[];
  counts: Uint32Array;
  yCoordinates: Int32Array;
  compressed: Uint8Array;
}

/** Null when the module is not ready or the EXR is not a ZIP16 scanline file. */
export function exrZipPlanSync(bytes: Uint8Array): ExrZipPlanInfo | null {
  const wasmApi = getWasmBindgen();
  if (!ready || typeof wasmApi?.exr_zip_plan !== 'function') {
    return null;
  }
  const plan = wasmApi.exr_zip_plan(bytes);
  if (!plan) {
    return null;
  }
  try {
    return {
      width: plan.width,
      height: plan.height,
      dataY: plan.data_y,
      kinds: new Uint32Array(plan.channel_kinds),
      selection: new Int32Array(plan.selection),
      displayedChannels: Array.from(plan.displayed_names as string[]),
      counts: new Uint32Array(plan.counts),
      yCoordinates: new Int32Array(plan.y_coordinates),
      compressed: plan.take_compressed(),
    };
  } finally {
    plan.free?.();
  }
}

/** A run of ZIP16 blocks, as the interleaved channels `decode_exr_fast` gives. */
export function decodeExrZipBlocksSync(
  blob: Uint8Array,
  counts: Uint32Array,
  rows: Uint32Array,
  width: number,
  kinds: Uint32Array,
  selection: Int32Array
): Float32Array {
  const wasmApi = getWasmBindgen();
  if (!ready || typeof wasmApi?.decode_exr_zip_blocks !== 'function') {
    throw new Error('EXR block decoding is unavailable in this build');
  }
  return wasmApi.decode_exr_zip_blocks(blob, counts, rows, width, kinds, selection);
}

/** One run of strips, decoded to the f32 samples `decode_tiff_fast` gives. */
export function decodeTiffStripRangeSync(
  blob: Uint8Array,
  counts: Uint32Array,
  firstStrip: number,
  fields: Float64Array
): Float32Array {
  const wasmApi = getWasmBindgen();
  if (!ready || typeof wasmApi?.decode_tiff_strip_range !== 'function') {
    throw new Error('TIFF strip decoding is unavailable in this build');
  }
  return wasmApi.decode_tiff_strip_range(blob, counts, firstStrip, fields);
}

function bandResult(result: any): DepthProjectWasmResult {
  const hasPixelCoords = !!result.has_pixel_coords;
  return {
    vertices: result.take_positions(),
    colors: result.take_colors(),
    pointCount: result.point_count,
    width: result.width,
    height: result.height,
    pixelCoords: hasPixelCoords ? result.take_pixel_coords() : undefined,
    rejectedCount: result.rejected_count,
    nonConvergedCount: result.non_converged_count,
  };
}

function freeQuietly(result: any): void {
  try {
    result?.free?.();
  } catch {
    /* already freed */
  }
}

export function projectDepthBandWasmSync(
  data: Float32Array,
  width: number,
  height: number,
  rowOffset: number,
  depthMin: number,
  depthMax: number,
  params: DepthProjectWasmParams
): DepthProjectWasmResult | null {
  const wasmApi = getWasmBindgen();
  if (!ready || typeof wasmApi?.project_depth_band !== 'function') {
    return null;
  }
  let result: any = null;
  try {
    result = wasmApi.project_depth_band(
      data,
      width,
      height,
      rowOffset,
      depthMin,
      depthMax,
      params.kind || 'depth',
      params.cameraModel,
      params.convention || 'opengl',
      params.fx,
      params.fy,
      params.cx,
      params.cy,
      new Float64Array(params.coefficients)
    );
    return bandResult(result);
  } catch (error) {
    console.warn('[TiffWasm] band projection failed:', error);
    return null;
  } finally {
    freeQuietly(result);
  }
}

/**
 * A band's rows held in wasm memory (`DepthBandSession` in the adapter), so a
 * later projection of the same rows sends only the parameters. Null when the
 * module is not ready or predates sessions.
 */
export function createDepthBandSession(
  data: Float32Array,
  width: number,
  height: number,
  rowOffset: number
): { project(...args: unknown[]): unknown; free(): void } | null {
  const wasmApi = getWasmBindgen();
  if (!ready || typeof wasmApi?.DepthBandSession !== 'function') {
    return null;
  }
  return new wasmApi.DepthBandSession(data, width, height, rowOffset);
}

export function projectDepthBandSessionSync(
  session: { project(...args: unknown[]): unknown },
  depthMin: number,
  depthMax: number,
  params: DepthProjectWasmParams
): DepthProjectWasmResult | null {
  let result: any = null;
  try {
    result = session.project(
      depthMin,
      depthMax,
      params.kind || 'depth',
      params.cameraModel,
      params.convention || 'opengl',
      params.fx,
      params.fy,
      params.cx,
      params.cy,
      new Float64Array(params.coefficients)
    );
    return bandResult(result);
  } catch (error) {
    console.warn('[TiffWasm] band projection failed:', error);
    return null;
  } finally {
    freeQuietly(result);
  }
}

export function projectCameraRayWasmSync(
  ray: readonly [number, number, number],
  params: CameraSolveWasmParams
): CameraSolveWasmResult<readonly [number, number]> | null {
  const wasmApi = getWasmBindgen();
  if (!ready || typeof wasmApi?.camera_project !== 'function') {
    return null;
  }
  const raw = new Float64Array(
    wasmApi.camera_project(
      params.cameraModel,
      params.fx,
      params.fy,
      params.cx,
      params.cy,
      new Float64Array(params.coefficients),
      ray[0],
      ray[1],
      ray[2]
    )
  );
  return {
    valid: raw[0] === 1,
    converged: raw[1] === 1,
    iterations: raw[2],
    value: [raw[3], raw[4]],
  };
}

export function projectCameraPointsWasmSync(
  params: CameraProjectPointsWasmParams
): Float32Array | null {
  const wasmApi = getWasmBindgen();
  if (!ready || typeof wasmApi?.camera_project_points_indexed !== 'function') {
    return null;
  }
  return new Float32Array(
    wasmApi.camera_project_points_indexed(
      params.cameraModel,
      params.fx,
      params.fy,
      params.cx,
      params.cy,
      new Float64Array(params.coefficients),
      params.positions,
      params.indices,
      new Float64Array(params.transform),
      params.maxNormalizedX,
      params.maxNormalizedY
    )
  );
}

export function unprojectCameraPixelWasmSync(
  pixel: readonly [number, number],
  params: CameraSolveWasmParams
): CameraSolveWasmResult<readonly [number, number, number]> | null {
  const wasmApi = getWasmBindgen();
  if (!ready || typeof wasmApi?.camera_unproject !== 'function') {
    return null;
  }
  const raw = new Float64Array(
    wasmApi.camera_unproject(
      params.cameraModel,
      params.fx,
      params.fy,
      params.cx,
      params.cy,
      new Float64Array(params.coefficients),
      pixel[0],
      pixel[1]
    )
  );
  return {
    valid: raw[0] === 1,
    converged: raw[1] === 1,
    iterations: raw[2],
    value: [raw[3], raw[4], raw[5]],
  };
}

export function normalizeDepthWasmSync(
  data: Float32Array,
  width: number,
  height: number,
  params: NormalizeDepthWasmParams
): NormalizeDepthWasmResult | null {
  const wasmApi = getWasmBindgen();
  if (!ready || typeof wasmApi?.normalize_depth_fast !== 'function') {
    return null;
  }

  let result: any = null;
  try {
    result = wasmApi.normalize_depth_fast(
      data,
      width,
      height,
      params.kind,
      params.unit || 'meter',
      params.scale ?? 1,
      params.depthScale ?? 1,
      params.depthBias ?? 0,
      params.fx ?? 0,
      params.baseline ?? 0,
      params.disparityOffset ?? 0,
      params.depthClamp?.min !== undefined,
      params.depthClamp?.min ?? 0,
      params.depthClamp?.max !== undefined,
      params.depthClamp?.max ?? 0
    );

    return {
      width: result.width,
      height: result.height,
      data: result.take_data(),
      kind: result.kind,
      unit: result.unit,
    };
  } catch (error) {
    console.warn('[TiffWasm] depth normalization failed, using JS fallback:', error);
    return null;
  } finally {
    try {
      result?.free?.();
    } catch {
      /* already freed */
    }
  }
}

/**
 * Decode a 16-bit PNG at full precision. Returns null when WASM is
 * unavailable; throws when the buffer is not a PNG the decoder accepts.
 */
export async function decodePng16Wasm(
  buffer: ArrayBuffer,
  allowEight = false
): Promise<Png16WasmResult | null> {
  const ok = await initTiffWasm();
  const wasmApi = getWasmBindgen();
  if (!ok || typeof wasmApi?.decode_png16_fast !== 'function') {
    return null;
  }
  let result: any = null;
  try {
    result = (allowEight ? wasmApi.decode_png_samples_fast : wasmApi.decode_png16_fast)(
      new Uint8Array(buffer)
    );
    return {
      width: result.width,
      height: result.height,
      channels: result.channels,
      bitDepth: result.bit_depth,
      colorType: result.color_type,
      data: result.take_data_as_u16(),
    };
  } finally {
    try {
      result?.free?.();
    } catch {
      /* already freed */
    }
  }
}

/**
 * Decode an OpenEXR image. Returns null when WASM is unavailable; throws when
 * the buffer is not an EXR the decoder accepts.
 */
export async function decodeExrWasm(buffer: ArrayBuffer): Promise<ExrWasmResult | null> {
  const ok = await initTiffWasm();
  const wasmApi = getWasmBindgen();
  if (!ok || typeof wasmApi?.decode_exr_fast !== 'function') {
    return null;
  }
  let result: any = null;
  try {
    result = wasmApi.decode_exr_fast(new Uint8Array(buffer));
    const splitCsv = (csv: string): string[] =>
      typeof csv === 'string' && csv.length > 0 ? csv.split(',') : [];
    return {
      width: result.width,
      height: result.height,
      channels: result.channels,
      channelNames: splitCsv(result.channel_names_csv),
      displayedChannels: splitCsv(result.displayed_channels_csv),
      data: result.take_data_as_f32(),
    };
  } finally {
    try {
      result?.free?.();
    } catch {
      /* already freed */
    }
  }
}

/**
 * Decode a TIFF with the WASM decoder. Returns null only when the module is
 * unavailable; a decode failure throws so the caller can surface the real
 * reason instead of a generic "unsupported file".
 */
export async function decodeTiffWasm(buffer: ArrayBuffer): Promise<TiffWasmResult | null> {
  const ok = await initTiffWasm();
  if (!ok) {
    return null;
  }
  const wasmApi = getWasmBindgen();
  if (!wasmApi) {
    return null;
  }
  let result: any = null;
  try {
    const bytes = new Uint8Array(buffer);
    result = wasmApi.decode_tiff_fast(bytes);
    // Read metadata getters before take_data_as_f32() (which moves the buffer).
    const out: TiffWasmResult = {
      width: result.width,
      height: result.height,
      channels: result.channels,
      bitsPerSample: result.bits_per_sample,
      sampleFormat: result.sample_format,
      compression: result.compression,
      predictor: result.predictor,
      data: result.take_data_as_f32(),
      min: result.min_value,
      max: result.max_value,
    };
    return out;
  } finally {
    // Release wasm-side memory regardless of success.
    try {
      result?.free?.();
    } catch {
      /* already freed */
    }
  }
}

/** Decode COLMAP dense samples using the shared Rust decoder. */
export async function decodeColmapDepthWasm(bytes: Uint8Array): Promise<Float32Array> {
  if (!(await initTiffWasm())) {
    throw new Error('Depth WASM unavailable');
  }
  // wasm-bindgen already returns a fresh copy.
  return getWasmBindgen().decode_colmap_depth(bytes) as Float32Array;
}

export async function decodeDepthPfmWasm(bytes: Uint8Array) {
  if (!(await initTiffWasm())) {
    throw new Error('Depth WASM unavailable');
  }
  const result = getWasmBindgen().decode_depth_pfm(bytes);
  try {
    return {
      width: result.width as number,
      height: result.height as number,
      channels: result.channels as number,
      data: result.take_data(),
    };
  } finally {
    result.free();
  }
}
