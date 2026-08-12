/**
 * Loads the Rust Stonex kernels.
 *
 * Reuses the registration loader's resolution, which already knows where the
 * `pointcloud-parser` package sits in each of the four builds - extension host,
 * webview, standalone page and Node - after an absolute-path alias silently
 * failed to apply in one of them and left the webview unable to load anything.
 */

// Through the alias, never the relative path: the relative one resolves to the
// CommonJS loader in every build, including the webview, where `require` cannot
// work. The bundle guard in src/test/suite/webviewBundle.test.ts caught exactly
// that here.
import { loadRegistrationWasm } from '#registration-wasm-loader';

export interface StonexColourSession {
  colour_scan(
    positions: Float32Array,
    columnAzimuths: Float64Array,
    pointsPerColumn: Uint32Array,
    activeFrames: Uint32Array
  ): {
    coloured_points: number;
    take_colours(): Uint8Array;
    take_frame_indices(): Uint16Array;
    free?(): void;
  };
  frame_preview(
    frameIndex: number,
    previewScale: number
  ): {
    width: number;
    height: number;
    take_rgba(): Uint8Array;
    free?(): void;
  };
  free?(): void;
}

export interface StonexWasm {
  /** Holds the archive's frames and their decoded panoramas for the parse. */
  StonexColourSession: new (pixels: Uint8Array, framesJson: string) => StonexColourSession;
  /** Decodes one X3R record's points, with its per-column bookkeeping. */
  stonex_decode_scan(record: Uint8Array): {
    point_count: number;
    take_positions(): Float32Array;
    take_intensity(): Float32Array;
    take_column_azimuths(): Float64Array;
    take_points_per_column(): Uint32Array;
    free?(): void;
  };
}

/**
 * Forces the JavaScript colour path, for the differential test that proves the
 * Rust one produces the same image. Not a user-facing switch: the two are meant
 * to be interchangeable, and this exists to demonstrate that they are.
 */
let disabled = false;
export function setStonexWasmDisabledForTests(value: boolean): void {
  disabled = value;
}

export async function loadStonexWasm(): Promise<StonexWasm | null> {
  if (disabled) {
    return null;
  }
  const wasm = (await loadRegistrationWasm()) as unknown as StonexWasm | null;
  return wasm && typeof (wasm as any).StonexColourSession === 'function' ? wasm : null;
}
