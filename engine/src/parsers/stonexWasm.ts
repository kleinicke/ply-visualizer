/**
 * Loads the Rust Stonex kernels.
 *
 * Reuses the registration loader's resolution, which already knows where the
 * `pointcloud-parser` package sits in each of the four builds - extension host,
 * webview, standalone page and Node - after an absolute-path alias silently
 * failed to apply in one of them and left the webview unable to load anything.
 */

// Browser builds replace this exact request with the browser loader. The
// relative request itself always resolves to a real module, so a missed build
// mapping cannot turn into an activation-time missing-module stub.
import { loadRegistrationWasm } from '../registration/wasmLoader';

export interface StonexColourSession {
  colour_scan(
    positions: Float32Array,
    columnAzimuths: Float64Array,
    pointsPerColumn: Uint32Array,
    activeFrames: Uint32Array
  ): {
    coloured_points: number;
    candidate_total: number;
    pixels_in_frame: number;
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
  stonex_decode_scan_known_layout(
    record: Uint8Array,
    columns: number,
    rows: number,
    columnOffset: number,
    columnStride: number,
    validPoints: number
  ): ReturnType<StonexWasm['stonex_decode_scan']>;
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
