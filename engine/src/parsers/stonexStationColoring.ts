/**
 * Cross-station photographic colouring for X3A archives.
 *
 * An X3A holds several stations, and only the scan a panorama was shot from
 * gets colour out of the box — see `stonexX3aParser`'s stem matching. Every
 * other scan in the archive, typically the quick preview sweeps, arrives grey.
 * Once registration has put all of them in one frame, that is fixable: a
 * station's camera can colour any scan, because the mapping from another scan's
 * points into this camera is just a composition,
 * `viewerToCamera(frame) · T_station⁻¹ · T_scan`.
 *
 * Two things make the result trustworthy rather than merely colourful:
 *
 * - **Visibility.** A camera at station S must not paint a surface S could not
 *   see. Every scan is an organized sphere of ranges around its own origin, so
 *   S's own points give a depth buffer in S's frame for free: bin them by
 *   azimuth and elevation, keep the nearest range per bin, and reject any point
 *   that sits well behind what S actually measured in that direction. Without
 *   this, colour bleeds through walls onto whatever is behind them.
 * - **Best view wins.** A point seen by several frames takes the colour from
 *   the one that saw it closest to the image centre and furthest from an edge,
 *   scored exactly as the parser's own first pass does, so a point coloured
 *   here is scored on the same scale as one coloured from its own station.
 */

import type { StonexCameraBatchProjector } from './stonexX3aParser';

/** A camera frame, with everything needed to project and sample it. */
export interface StationFrame {
  /** Index into the archive's frame list, stored per point for colour correction. */
  frameNumber: number;
  /** Scan stem the frame was shot from; identifies its station. */
  scanStem: string;
  panDegrees: number;
  imageWidth: number;
  imageHeight: number;
  fx: number;
  fy: number;
  cx: number;
  cy: number;
  distortionCoefficients: readonly number[];
  /** Viewer-to-camera transform for this frame, in its own station's frame. */
  viewerToCamera: readonly number[];
  maxNormalizedX: number;
  maxNormalizedY: number;
  /** Samples the decoded image; returns null outside it. */
  sample(pixelX: number, pixelY: number): [number, number, number] | null;
}

export interface StationScan {
  /** Scan stem, matching `StationFrame.scanStem` for the station it belongs to. */
  scanStem: string;
  pointOffset: number;
  pointCount: number;
  /** Column-major 4x4 mapping this scan's points into the common frame. */
  transform: readonly number[];
}

export interface StationColoringOptions {
  /** Recolour points that already have photographic colour, not just the grey. */
  recolorAlreadyColored?: boolean;
  /** Diagnostic: do not let photographs from another registered station compete. */
  ownStationOnly?: boolean;
  /**
   * Called once a scan has been through every station's cameras, so a caller
   * can publish it while the rest are still running.
   */
  onScanColored?: (scan: StationScan) => void | Promise<void>;
  /**
   * How far behind a station's own measured range a point may sit and still be
   * treated as visible from it, as a constant plus a fraction of the range.
   */
  occlusionTolerance?: number;
  occlusionRelativeTolerance?: number;
}

/** Elevation span of an X300 sweep; matches the parser's own constants. */
const ELEVATION_MIN_DEGREES = -25;
const ELEVATION_SPAN_DEGREES = 90;
const AZIMUTH_BINS = 2048;
const ELEVATION_BINS = 512;

/** Frames only see so far around; matches the parser's per-column pre-filter. */
const FRAME_AZIMUTH_WINDOW_DEGREES = 30;

function angularDifference(a: number, b: number): number {
  return Math.abs(((a - b + 540) % 360) - 180);
}

/**
 * Nearest measured range per direction, as seen from one station.
 *
 * Built from the station's own points, which are already expressed in its
 * frame, so this costs one pass and no transform.
 */
class StationDepth {
  private readonly ranges: Float32Array;

  constructor(positions: Float32Array, pointOffset: number, pointCount: number) {
    this.ranges = new Float32Array(AZIMUTH_BINS * ELEVATION_BINS).fill(Infinity);
    for (let i = 0; i < pointCount; i++) {
      const index = (pointOffset + i) * 3;
      const x = positions[index];
      const y = positions[index + 1];
      const z = positions[index + 2];
      const range = Math.hypot(x, y, z);
      if (!(range > 0)) {
        continue;
      }
      const bin = this.binOf(x, y, z, range);
      if (bin >= 0 && range < this.ranges[bin]) {
        this.ranges[bin] = range;
      }
    }
  }

  private binOf(x: number, y: number, z: number, range: number): number {
    const azimuth = (Math.atan2(y, x) * 180) / Math.PI;
    const elevation = (Math.asin(Math.max(-1, Math.min(1, z / range))) * 180) / Math.PI;
    const elevationT = (elevation - ELEVATION_MIN_DEGREES) / ELEVATION_SPAN_DEGREES;
    if (elevationT < 0 || elevationT >= 1) {
      return -1;
    }
    const azimuthBin = Math.floor((((azimuth + 360) % 360) / 360) * AZIMUTH_BINS) % AZIMUTH_BINS;
    const elevationBin = Math.min(ELEVATION_BINS - 1, Math.floor(elevationT * ELEVATION_BINS));
    return elevationBin * AZIMUTH_BINS + azimuthBin;
  }

  /**
   * True when a point at `range` in this direction is at or in front of what
   * the station measured. A direction the station never sampled counts as
   * visible: it cannot be shown to be hidden, and refusing those would strip
   * colour from everything above and below the sweep.
   */
  isVisible(x: number, y: number, z: number, tolerance: number, relative: number): boolean {
    const range = Math.hypot(x, y, z);
    if (!(range > 0)) {
      return false;
    }
    const bin = this.binOf(x, y, z, range);
    if (bin < 0) {
      return true;
    }
    const measured = this.ranges[bin];
    return !Number.isFinite(measured) || range <= measured + tolerance + relative * measured;
  }
}

/**
 * Row-major transpose of a column-major 4x4, and vice versa.
 *
 * The two conventions genuinely meet here and the mix is not obvious from the
 * types, because both are `number[16]`. Scan placements come from three.js and
 * are column-major; a frame's `viewerToCamera` is built straight from the CAL
 * file's `Model2CameraMatrix`, which the XML declares `RowOrder`, and the Rust
 * projector expects it in that layout. Composing one with the other without
 * this conversion produces a transform that is correct only when the other
 * factor is the identity — which is exactly the same-station case, so the bug
 * hid behind scans that already looked right.
 */
function transpose(m: readonly number[]): number[] {
  const out = new Array<number>(16).fill(0);
  for (let row = 0; row < 4; row++) {
    for (let column = 0; column < 4; column++) {
      out[column * 4 + row] = m[row * 4 + column];
    }
  }
  return out;
}

/** `a * b` for row-major 4x4s, the layout the camera projector takes. */
function multiplyRowMajor(a: readonly number[], b: readonly number[]): number[] {
  const out = new Array<number>(16).fill(0);
  for (let row = 0; row < 4; row++) {
    for (let column = 0; column < 4; column++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) {
        sum += a[row * 4 + k] * b[k * 4 + column];
      }
      out[row * 4 + column] = sum;
    }
  }
  return out;
}

/** `a * b` for column-major 4x4s. */
function multiply(a: readonly number[], b: readonly number[]): number[] {
  const out = new Array<number>(16).fill(0);
  for (let column = 0; column < 4; column++) {
    for (let row = 0; row < 4; row++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) {
        sum += a[k * 4 + row] * b[column * 4 + k];
      }
      out[column * 4 + row] = sum;
    }
  }
  return out;
}

/** Inverse of a rigid column-major 4x4, from the transpose of its rotation. */
function invertRigid(m: readonly number[]): number[] {
  const out = new Array<number>(16).fill(0);
  for (let row = 0; row < 3; row++) {
    for (let column = 0; column < 3; column++) {
      out[column * 4 + row] = m[row * 4 + column];
    }
  }
  out[15] = 1;
  const [tx, ty, tz] = [m[12], m[13], m[14]];
  out[12] = -(out[0] * tx + out[4] * ty + out[8] * tz);
  out[13] = -(out[1] * tx + out[5] * ty + out[9] * tz);
  out[14] = -(out[2] * tx + out[6] * ty + out[10] * tz);
  return out;
}

function transformPoint(
  m: readonly number[],
  x: number,
  y: number,
  z: number
): [number, number, number] {
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14],
  ];
}

/**
 * Scores a projected pixel the way the parser's first colouring pass does:
 * centre-weighted, with a smooth falloff toward the frame edge.
 */
function viewScore(frame: StationFrame, pixelX: number, pixelY: number): number {
  const centerX = (pixelX - frame.cx) / (frame.imageWidth * 0.5);
  const centerY = (pixelY - frame.cy) / (frame.imageHeight * 0.5);
  const offCentre = centerX * centerX + centerY * centerY;
  const edgeDistance = Math.min(
    pixelX,
    pixelY,
    frame.imageWidth - 1 - pixelX,
    frame.imageHeight - 1 - pixelY
  );
  const edgeMargin = Math.min(frame.imageWidth, frame.imageHeight) * 0.08;
  const edgeT = Math.max(0, Math.min(1, edgeDistance / edgeMargin));
  const edgeWeight = edgeT * edgeT * (3 - 2 * edgeT);
  return edgeWeight / (0.05 + offCentre) ** 2;
}

export interface StationColoringResult {
  /** Points that gained colour they did not have before. */
  newlyColored: number;
  /** Points whose colour was replaced by a better view. */
  recolored: number;
  /**
   * Point-station pairs rejected because that station could not see the point.
   * Counted per attempt, not per point: one point hidden from three stations
   * contributes three.
   */
  occludedSamples: number;
}

/**
 * Colours points from every station's frames, in place.
 *
 * `rawColors` and `frameIndices` are the parser's raw (un-white-balanced)
 * arrays; the caller re-runs `stonexColorCorrection` afterwards so the modes
 * stay switchable.
 */
export async function colorFromAllStations(
  positions: Float32Array,
  rawColors: Uint8Array,
  frameIndices: Uint16Array,
  colored: Uint8Array,
  /** Set to 1 for every point this pass writes; lets callers ship only the
   * scans that actually changed rather than every colour in the archive. */
  changed: Uint8Array,
  scans: readonly StationScan[],
  frames: readonly StationFrame[],
  project: StonexCameraBatchProjector,
  options: StationColoringOptions = {}
): Promise<StationColoringResult> {
  const tolerance = options.occlusionTolerance ?? 0.08;
  const relative = options.occlusionRelativeTolerance ?? 0.02;
  const result: StationColoringResult = {
    newlyColored: 0,
    recolored: 0,
    occludedSamples: 0,
  };

  const scanByStem = new Map(scans.map(scan => [scan.scanStem, scan]));
  const depthByStem = new Map<string, StationDepth>();
  // Frames whose station has no scan in this archive cannot be placed.
  const usableFrames = frames.filter(frame => scanByStem.has(frame.scanStem));
  if (usableFrames.length === 0) {
    return result;
  }

  const bestWeights = new Float64Array(positions.length / 3);
  // Seed with the weights implied by the existing colouring, so a point already
  // coloured from its own station is only overwritten by a demonstrably better
  // view rather than by whichever frame happens to be processed last.
  for (let i = 0; i < colored.length; i++) {
    bestWeights[i] = colored[i] ? 1e-6 : 0;
  }

  // Frames grouped by the station that shot them: the expensive part of a pass
  // is per *station* (one transform and one visibility test per point), not per
  // frame, so hoisting it out of the frame loop is worth an order of magnitude
  // on an archive with ten frames a station.
  const framesByStation = new Map<string, StationFrame[]>();
  for (const frame of usableFrames) {
    const list = framesByStation.get(frame.scanStem);
    if (list) {
      list.push(frame);
    } else {
      framesByStation.set(frame.scanStem, [frame]);
    }
  }

  for (const scan of scans) {
    // Nothing to do for a scan that is already fully coloured, and in the
    // default mode that is every scan a camera of its own station covered —
    // the big ones. Skipping them here rather than per point turns an archive
    // with three photographed stations from a walk over every point once per
    // station into a walk over just the grey preview sweeps.
    if (!options.recolorAlreadyColored) {
      let needsColor = false;
      const scanEnd = scan.pointOffset + scan.pointCount;
      for (let index = scan.pointOffset; index < scanEnd; index++) {
        if (!colored[index]) {
          needsColor = true;
          break;
        }
      }
      if (!needsColor) {
        continue;
      }
    }

    for (const [stationStem, stationFrames] of framesByStation) {
      if (options.ownStationOnly && stationStem !== scan.scanStem) {
        continue;
      }
      const frameStation = scanByStem.get(stationStem)!;
      // Points from this scan into the photographing station's own frame.
      const scanToStation = multiply(invertRigid(frameStation.transform), scan.transform);

      if (!depthByStem.has(stationStem)) {
        depthByStem.set(
          stationStem,
          new StationDepth(positions, frameStation.pointOffset, frameStation.pointCount)
        );
      }
      const depth = depthByStem.get(stationStem)!;

      // One pass over the scan's points assigns them to whichever of this
      // station's frames could be looking their way.
      const candidates = stationFrames.map(() => [] as number[]);
      const end = scan.pointOffset + scan.pointCount;
      for (let index = scan.pointOffset; index < end; index++) {
        if (!options.recolorAlreadyColored && colored[index]) {
          // Default: fill in the grey and leave existing colour alone. The
          // check is on the point, not on whether this is its own station — a
          // camera one station away is not automatically an improvement on the
          // one that stood right next to the surface.
          continue;
        }
        const offset = index * 3;
        const [x, y, z] = transformPoint(
          scanToStation,
          positions[offset],
          positions[offset + 1],
          positions[offset + 2]
        );
        // Scanner azimuth, matching the parser's column headers: viewer x is
        // the model's Y and viewer y its X, and the sweep measures
        // atan2(modelX, modelY).
        const azimuth = (Math.atan2(y, x) * 180) / Math.PI;

        let anyFrame = false;
        for (let f = 0; f < stationFrames.length; f++) {
          if (
            angularDifference(stationFrames[f].panDegrees, azimuth) <= FRAME_AZIMUTH_WINDOW_DEGREES
          ) {
            if (!anyFrame) {
              // Only pay for visibility once a frame actually wants this point.
              if (!depth.isVisible(x, y, z, tolerance, relative)) {
                result.occludedSamples++;
                break;
              }
              anyFrame = true;
            }
            candidates[f].push(index);
          }
        }
      }

      for (let f = 0; f < stationFrames.length; f++) {
        const frame = stationFrames[f];
        const indices = candidates[f];
        if (indices.length === 0) {
          continue;
        }

        // The projector reads straight from `positions`, so it needs the full
        // composition down to camera coordinates.
        const pixels = project({
          positions,
          indices: new Uint32Array(indices),
          fx: frame.fx,
          fy: frame.fy,
          cx: frame.cx,
          cy: frame.cy,
          coefficients: frame.distortionCoefficients,
          // `viewerToCamera` is row-major and `scanToStation` column-major, so
          // the composition happens in the projector's own layout.
          // `viewerToCamera` is row-major and `scanToStation` column-major, so
          // the composition happens in the projector's own layout.
          transform: multiplyRowMajor(frame.viewerToCamera, transpose(scanToStation)),
          maxNormalizedX: frame.maxNormalizedX,
          maxNormalizedY: frame.maxNormalizedY,
        });
        if (!pixels || pixels.length !== indices.length * 2) {
          continue;
        }

        for (let i = 0; i < indices.length; i++) {
          const pixelX = pixels[i * 2];
          const pixelY = pixels[i * 2 + 1];
          if (
            !Number.isFinite(pixelX) ||
            !Number.isFinite(pixelY) ||
            pixelX < 1 ||
            pixelY < 1 ||
            pixelX >= frame.imageWidth - 1 ||
            pixelY >= frame.imageHeight - 1
          ) {
            continue;
          }
          const weight = viewScore(frame, pixelX, pixelY);
          const pointIndex = indices[i];
          if (weight <= bestWeights[pointIndex]) {
            continue;
          }
          const color = frame.sample(pixelX, pixelY);
          if (!color) {
            continue;
          }

          bestWeights[pointIndex] = weight;
          const offset = pointIndex * 3;
          rawColors[offset] = Math.round(color[0]);
          rawColors[offset + 1] = Math.round(color[1]);
          rawColors[offset + 2] = Math.round(color[2]);
          frameIndices[pointIndex] = frame.frameNumber;
          changed[pointIndex] = 1;
          if (colored[pointIndex]) {
            result.recolored++;
          } else {
            colored[pointIndex] = 1;
            result.newlyColored++;
          }
        }
      }
    }
    // Publish each completed scan before starting the next one. In the VS Code
    // host a long synchronous archive pass otherwise queues every postMessage
    // until all stations are done, which looks exactly like no progressive
    // colouring exists even though callbacks are issued per scan.
    await options.onScanColored?.(scan);
    await new Promise<void>(resolve => setTimeout(resolve, 0));
  }

  return result;
}
