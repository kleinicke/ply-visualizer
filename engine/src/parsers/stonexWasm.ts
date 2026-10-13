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

/**
 * The cross-station pass, which owns the archive's arrays for its duration and
 * hands each scan back as it finishes.
 */
export interface StonexStationSession {
  readonly scan_count: number;
  /** Colours one scan from every station; true when it wrote anything. */
  colour_scan(scanIndex: number): boolean;
  scan_colours(scanIndex: number): Uint8Array;
  scan_frame_indices(scanIndex: number): Uint16Array;
  readonly newly_colored: number;
  readonly recolored: number;
  readonly occluded_samples: number;
  take_colours(): Uint8Array;
  take_frame_indices(): Uint16Array;
  take_coloured(): Uint8Array;
  take_changed(): Uint8Array;
  free?(): void;
}

export interface StonexWasm {
  /** Holds the archive's frames and their decoded panoramas for the parse. */
  StonexColourSession: new (pixels: Uint8Array, framesJson: string) => StonexColourSession;
  /** Holds the archive for one cross-station colouring pass. */
  StonexStationSession: new (
    positions: Float32Array,
    pixels: Uint8Array,
    rawColours: Uint8Array,
    frameIndices: Uint16Array,
    coloured: Uint8Array,
    framesJson: string,
    scansJson: string,
    optionsJson: string
  ) => StonexStationSession;
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

export async function loadStonexWasm(): Promise<StonexWasm | null> {
  const wasm = (await loadRegistrationWasm()) as unknown as StonexWasm | null;
  return wasm && typeof (wasm as any).StonexColourSession === 'function' ? wasm : null;
}

/**
 * Frames' raw sensor planes, back to back: either gathered already, or still in
 * the archive as `[offset, length]` pairs in plane order. An archive in shared
 * memory is gathered by the thread that uses it, so the host never holds a
 * second copy of the photographs.
 */
export type StonexPixelSource = Uint8Array | { archive: Uint8Array; ranges: Float64Array };

export function gatherStonexPixels(source: StonexPixelSource): Uint8Array {
  if (source instanceof Uint8Array) {
    return source;
  }
  let bytes = 0;
  for (let index = 1; index < source.ranges.length; index += 2) {
    bytes += source.ranges[index];
  }
  const pixels = new Uint8Array(bytes);
  let cursor = 0;
  for (let index = 0; index < source.ranges.length; index += 2) {
    const offset = source.ranges[index];
    const length = source.ranges[index + 1];
    pixels.set(source.archive.subarray(offset, offset + length), cursor);
    cursor += length;
  }
  return pixels;
}

/** The frames' planes in `frames` order: their offsets into the gathered planes, and the source. */
export function stonexPixelSource(
  archive: Uint8Array,
  frames: ReadonlyArray<{ pixelsOffset: number; rawWidth: number; rawHeight: number }>
): { source: StonexPixelSource; offsets: number[] } {
  const ranges = new Float64Array(frames.length * 2);
  const offsets: number[] = [];
  let bytes = 0;
  frames.forEach((frame, index) => {
    const length = frame.rawWidth * frame.rawHeight;
    ranges[index * 2] = frame.pixelsOffset;
    ranges[index * 2 + 1] = length;
    offsets.push(bytes);
    bytes += length;
  });
  const shared =
    typeof SharedArrayBuffer !== 'undefined' && archive.buffer instanceof SharedArrayBuffer;
  const source = { archive, ranges };
  return { source: shared ? source : gatherStonexPixels(source), offsets };
}

/**
 * Photographic colouring of a group of scans that share frames, self-contained
 * so a host can run it on another thread: the scans' points and column
 * bookkeeping, and the raw planes of only the frames they use. Scans that share
 * a frame share a job, so each frame is still demosaiced once.
 */
export interface StonexColourScanJob {
  scans: Array<{
    positions: Float32Array;
    azimuths: Float64Array;
    counts: Uint32Array;
    /** Session-local indices of the scan's frames, in the order it lists them. */
    activeFrames: Uint32Array;
  }>;
  /** Raw planes of the group's frames, in archive order. */
  pixels: StonexPixelSource;
  /** Descriptors of those frames, offsets into the gathered planes. */
  descriptorsJson: string;
  /** Downscale for each frame's preview, made while its demosaic is at hand. */
  previewScale: number;
}

export interface StonexFramePreview {
  width: number;
  height: number;
  rgba: Uint8Array;
}

export interface StonexColourScanResult {
  scans: Array<{
    colours: Uint8Array;
    /** Session-local frame per point (the job's frame order), or no-frame. */
    frameIndices: Uint16Array;
    coloured: number;
    candidateTotal: number;
    pixelsInFrame: number;
  }>;
  /** One per job frame, in the job's (archive) order. */
  previews: StonexFramePreview[];
}

/**
 * Colours independent groups of scans at once, or returns null so the caller
 * colours them itself. Groups share no state: a session only caches each
 * frame's demosaic, and a group holds every frame its scans read.
 */
export type StonexColourScans = (
  jobs: StonexColourScanJob[]
) => Promise<StonexColourScanResult[] | null>;

/** Run one job in a fresh session (a worker, or a test comparing paths). */
export function runStonexColourScanJob(
  wasm: StonexWasm,
  job: StonexColourScanJob
): StonexColourScanResult {
  const session = new wasm.StonexColourSession(gatherStonexPixels(job.pixels), job.descriptorsJson);
  try {
    const scans = job.scans.map(scan => {
      const result = session.colour_scan(
        scan.positions,
        scan.azimuths,
        scan.counts,
        scan.activeFrames
      );
      try {
        return {
          colours: result.take_colours(),
          frameIndices: result.take_frame_indices(),
          coloured: result.coloured_points,
          candidateTotal: result.candidate_total,
          pixelsInFrame: result.pixels_in_frame,
        };
      } finally {
        result.free?.();
      }
    });
    const frames = (JSON.parse(job.descriptorsJson) as unknown[]).length;
    return { scans, previews: stonexFramePreviews(session, frames, job.previewScale) };
  } finally {
    session.free?.();
  }
}

/** Previews of a session's first `count` frames. */
export function stonexFramePreviews(
  session: StonexColourSession,
  count: number,
  scale: number
): StonexFramePreview[] {
  const previews: StonexFramePreview[] = [];
  for (let index = 0; index < count; index++) {
    const preview = session.frame_preview(index, scale);
    previews.push({ width: preview.width, height: preview.height, rgba: preview.take_rgba() });
    preview.free?.();
  }
  return previews;
}

/** One X3R record to decode on another thread, its layout already scanned. */
export interface StonexDecodeScanJob {
  /** The record's bytes; a view into a SharedArrayBuffer, so nothing is copied to post it. */
  record: Uint8Array;
  columns: number;
  rows: number;
  /** Offset of the first column within `record`. */
  columnOffset: number;
  columnStride: number;
  validPoints: number;
  /**
   * Where the points belong in the archive's combined arrays, when those are
   * in shared memory: they are written there, and the result carries none.
   */
  into?: { positions: Float32Array; intensity: Float32Array };
}

export interface StonexDecodeScanResult {
  /** Empty when `placed`. */
  positions: Float32Array;
  intensity: Float32Array;
  /** Written into the job's `into` arrays, which it exactly filled. */
  placed?: boolean;
  azimuths: Float64Array;
  counts: Uint32Array;
}

/** Decodes scans concurrently, or returns null so the caller decodes them itself. */
export type StonexDecodeScans = (
  jobs: StonexDecodeScanJob[],
  /** Called as each scan finishes, so its arrays can be consumed and dropped. */
  onDecoded?: (index: number, result: StonexDecodeScanResult) => void
) => Promise<StonexDecodeScanResult[] | null>;

/** Decode one record exactly as the parser's in-process path does. */
export function runStonexDecodeScanJob(
  wasm: StonexWasm,
  job: StonexDecodeScanJob
): StonexDecodeScanResult {
  const decoded = wasm.stonex_decode_scan_known_layout(
    job.record,
    job.columns,
    job.rows,
    job.columnOffset,
    job.columnStride,
    job.validPoints
  );
  try {
    const positions = decoded.take_positions();
    const intensity = decoded.take_intensity();
    const azimuths = decoded.take_column_azimuths();
    const counts = decoded.take_points_per_column();
    const into = job.into;
    if (
      into &&
      into.positions.length === positions.length &&
      into.intensity.length === intensity.length
    ) {
      into.positions.set(positions);
      into.intensity.set(intensity);
      return {
        positions: new Float32Array(0),
        intensity: new Float32Array(0),
        placed: true,
        azimuths,
        counts,
      };
    }
    return { positions, intensity, azimuths, counts };
  } finally {
    decoded.free?.();
  }
}
