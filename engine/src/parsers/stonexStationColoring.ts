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
 * The pass itself lives in `stonex::stations`, which owns the depth buffers,
 * the projection and the sampling; what is left here is marshalling. It runs
 * scan by scan so a finished scan can be published while the rest are still
 * going, and it samples through the parser's own reader, so a point coloured
 * from another station gets the same pixel a point coloured from its own would.
 */

import { loadStonexWasm } from './stonexWasm';

/** A camera frame, with everything needed to project and sample it. */
export interface StationFrame {
  /** Index into the archive's frame list, stored per point for colour correction. */
  frameNumber: number;
  /** Scan stem the frame was shot from; identifies its station. */
  scanStem: string;
  panDegrees: number;
  /** Where this frame's raw sensor plane sits in the shared pixel buffer. */
  pixelOffset: number;
  rawWidth: number;
  rawHeight: number;
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
 * stay switchable. `pixels` holds every frame's raw sensor plane back to back,
 * with `StationFrame.pixelOffset` pointing into it.
 */
export async function colorFromAllStations(
  positions: Float32Array,
  rawColors: Uint8Array,
  frameIndices: Uint16Array,
  colored: Uint8Array,
  /** Set to 1 for every point this pass writes; lets callers ship only the
   * scans that actually changed rather than every colour in the archive. */
  changed: Uint8Array,
  pixels: Uint8Array,
  scans: readonly StationScan[],
  frames: readonly StationFrame[],
  options: StationColoringOptions = {}
): Promise<StationColoringResult> {
  const empty: StationColoringResult = { newlyColored: 0, recolored: 0, occludedSamples: 0 };

  // Stations are addressed by index in Rust, so the stems are resolved here and
  // frames whose station has no scan in this archive — which cannot be placed —
  // drop out with them.
  const stationOfStem = new Map(scans.map((scan, index) => [scan.scanStem, index]));
  const usableFrames = frames.filter(frame => stationOfStem.has(frame.scanStem));
  if (usableFrames.length === 0 || scans.length === 0) {
    return empty;
  }

  const wasm = await loadStonexWasm();
  if (!wasm) {
    return empty;
  }

  const session = new wasm.StonexStationSession(
    positions,
    pixels,
    rawColors,
    frameIndices,
    colored,
    JSON.stringify(
      usableFrames.map(frame => ({
        frameNumber: frame.frameNumber,
        station: stationOfStem.get(frame.scanStem)!,
        panDegrees: frame.panDegrees,
        pixelOffset: frame.pixelOffset,
        rawWidth: frame.rawWidth,
        rawHeight: frame.rawHeight,
        imageWidth: frame.imageWidth,
        imageHeight: frame.imageHeight,
        fx: frame.fx,
        fy: frame.fy,
        cx: frame.cx,
        cy: frame.cy,
        distortion: [...frame.distortionCoefficients],
        viewerToCamera: [...frame.viewerToCamera],
        maxNormalizedX: frame.maxNormalizedX,
        maxNormalizedY: frame.maxNormalizedY,
      }))
    ),
    JSON.stringify(
      scans.map((scan, index) => ({
        station: index,
        pointOffset: scan.pointOffset,
        pointCount: scan.pointCount,
        transform: [...scan.transform],
      }))
    ),
    JSON.stringify({
      occlusionTolerance: options.occlusionTolerance ?? 0.08,
      occlusionRelativeTolerance: options.occlusionRelativeTolerance ?? 0.02,
      recolorAlreadyColored: options.recolorAlreadyColored === true,
      ownStationOnly: options.ownStationOnly === true,
    })
  );

  try {
    for (let index = 0; index < scans.length; index++) {
      const wrote = session.colour_scan(index);
      if (wrote) {
        // Copy this scan's result back before publishing it: the host reads
        // from its own arrays, and the rest of the archive is still being
        // worked on inside the session.
        const scan = scans[index];
        rawColors.set(session.scan_colours(index), scan.pointOffset * 3);
        frameIndices.set(session.scan_frame_indices(index), scan.pointOffset);
      }
      // Publish each completed scan before starting the next one. In the VS
      // Code host a long uninterrupted archive pass otherwise queues every
      // postMessage until all stations are done, which looks exactly like no
      // progressive colouring exists even though callbacks are issued per scan.
      await options.onScanColored?.(scans[index]);
      await new Promise<void>(resolve => setTimeout(resolve, 0));
    }

    const result: StationColoringResult = {
      newlyColored: session.newly_colored,
      recolored: session.recolored,
      occludedSamples: session.occluded_samples,
    };
    // The per-scan copies above cover everything the pass wrote, but `colored`
    // and `changed` are archive-wide bookkeeping the caller reads afterwards.
    colored.set(session.take_coloured());
    changed.set(session.take_changed());
    return result;
  } finally {
    session.free?.();
  }
}
