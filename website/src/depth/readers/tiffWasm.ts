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

/** Initialize the WASM module once. Resolves false if unavailable (→ fallback). */
export async function initTiffWasm(): Promise<boolean> {
  if (initPromise) {
    return initPromise;
  }
  initPromise = (async () => {
    try {
      if (typeof wasm_bindgen === 'undefined') {
        return false;
      }
      const url = (globalThis as any).__TIFF_WASM_URL__;
      if (!url) {
        return false;
      }
      // Object form is the non-deprecated wasm-bindgen init signature; a bare
      // string still works but logs a deprecation warning.
      await wasm_bindgen({ module_or_path: url });
      ready = typeof wasm_bindgen.decode_tiff_fast === 'function';
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

/**
 * Decode a TIFF with the WASM decoder. Returns null (caller should fall back)
 * if WASM is unavailable or the decode fails for any reason.
 */
export async function decodeTiffWasm(buffer: ArrayBuffer): Promise<TiffWasmResult | null> {
  const ok = await initTiffWasm();
  if (!ok) {
    return null;
  }
  let result: any = null;
  try {
    const bytes = new Uint8Array(buffer);
    result = wasm_bindgen.decode_tiff_fast(bytes);
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
