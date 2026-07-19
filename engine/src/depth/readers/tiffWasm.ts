/**
 * Rust/WebAssembly TIFF decoder wrapper.
 *
 * Drop-in accelerator for the pure-JS geotiff.js path, mirroring the
 * tiff-visualizer sister extension's TiffWasmProcessor. The wasm-bindgen
 * "no-modules" glue is loaded via a <script> tag before the bundle and exposes
 * a global `wasm_bindgen` (init function + exports). The .wasm binary URL is
 * provided on `window.__TIFF_WASM_URL__` (set by index.html for the standalone
 * site, overridden with a webview-resource URI by the VS Code extension).
 *
 * Everything here is best-effort: if the global is missing, init fails, or a
 * decode throws, the caller falls back to geotiff.js — same behavior and
 * performance as before WASM existed.
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
  rejectedCount: number;
  nonConvergedCount: number;
}

export interface DepthProjectWasmParams {
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
    | ((...urls: string[]) => void)
    | undefined;
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
      const url = (globalThis as any).__TIFF_WASM_URL__;
      if (!url) {
        return false;
      }
      // Object form is the non-deprecated wasm-bindgen init signature; a bare
      // string still works but logs a deprecation warning.
      await wasmApi({ module_or_path: url });
      ready = typeof wasmApi.decode_tiff_fast === 'function';
      return ready;
    } catch (error) {
      console.warn('[TiffWasm] init failed, using geotiff.js fallback:', error);
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
    result = wasmApi.project_depth_fast(
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
      vertices: new Float32Array(result.take_positions()),
      colors: new Uint8Array(result.take_colors()),
      pointCount: result.point_count,
      width: result.width,
      height: result.height,
      pixelCoords: hasPixelCoords ? new Uint16Array(result.take_pixel_coords()) : undefined,
      rejectedCount: result.rejected_count,
      nonConvergedCount: result.non_converged_count,
    };
  } catch (error) {
    console.warn('[TiffWasm] depth projection failed, using JS fallback:', error);
    return null;
  } finally {
    try {
      result?.free?.();
    } catch {
      /* already freed */
    }
  }
}

export function projectCameraRayWasmSync(
  ray: readonly [number, number, number],
  params: CameraSolveWasmParams
): CameraSolveWasmResult<readonly [number, number]> | null {
  const wasmApi = getWasmBindgen();
  if (!ready || typeof wasmApi?.camera_project !== 'function') {return null;}
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

export function unprojectCameraPixelWasmSync(
  pixel: readonly [number, number],
  params: CameraSolveWasmParams
): CameraSolveWasmResult<readonly [number, number, number]> | null {
  const wasmApi = getWasmBindgen();
  if (!ready || typeof wasmApi?.camera_unproject !== 'function') {return null;}
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
      data: new Float32Array(result.take_data()),
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
 * Decode a TIFF with the WASM decoder. Returns null (caller should fall back)
 * if WASM is unavailable or the decode fails for any reason.
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
      data: new Float32Array(result.take_data_as_f32()),
      min: result.min_value,
      max: result.max_value,
    };
    return out;
  } catch (error) {
    console.warn('[TiffWasm] decode failed, using geotiff.js fallback:', error);
    return null;
  } finally {
    // Release wasm-side memory regardless of success.
    try {
      result?.free?.();
    } catch {
      /* already freed */
    }
  }
}
