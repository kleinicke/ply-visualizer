/**
 * Applies a station-pipeline result to already-loaded X3A scans.
 *
 * The pipeline itself runs in the extension host, inside a fresh parse, because
 * that is the only moment the full-resolution X3I frames exist — only a
 * 1/8-scale preview survives into the webview, and a preview pixel spans about
 * thirteen points vertically, which would visibly smear the colour.
 *
 * What comes back is deliberately *not* a new set of clouds: re-sending 26
 * million points to replace points that did not move would cost far more than
 * the result is. Only two things travel — a 4x4 per scan, and new colours for
 * the scans whose colour actually changed, which in the default "fill in the
 * grey ones" mode is just the small preview sweeps.
 */

import * as THREE from 'three';
import type { SpatialData } from './interfaces';
import { stationPipelineUi } from './state/registration.svelte';
import { updateStonexCameraStations } from './visualization/stonexCameras';
import {
  applyStonexColorCorrectionToPoints,
  computeStonexFrameMultipliers,
  DEFAULT_STONEX_COLOR_CORRECTION,
  type StonexColorCalibration,
} from './visualization/stonexColorCorrection';

export interface StationPipelineUpdate {
  /** `metadata.embeddedScanName`, the archive member this update belongs to. */
  scanName: string;
  /** Column-major 4x4 placing the scan in the archive's common frame. */
  transform: number[] | null;
  /** Present only when this scan's colour changed. */
  rawColors?: Uint8Array;
  frameIndices?: Uint16Array;
  photographicallyColoredPoints?: number;
}

export interface StationPipelineHost {
  spatialFiles: SpatialData[];
  /** X3A camera profiles, so panoramas follow the scans they were shot from. */
  cameraGroups?: THREE.Group[];
  meshes: (THREE.Mesh | THREE.Points | THREE.LineSegments | null)[];
  setTransformationMatrix(fileIndex: number, matrix: THREE.Matrix4): void;
  updateMatrixTextarea(fileIndex: number): void;
  requestRender(): void;
  updateFileStats?(): void;
}

export interface StationPipelineOutcome {
  placed: number;
  recolored: number;
}

export function applyStationPipelineUpdates(
  host: StationPipelineHost,
  updates: readonly StationPipelineUpdate[]
): StationPipelineOutcome {
  const outcome: StationPipelineOutcome = { placed: 0, recolored: 0 };

  for (const update of updates) {
    const fileIndex = host.spatialFiles.findIndex(
      data => data?.metadata?.embeddedScanName === update.scanName
    );
    if (fileIndex < 0) {
      continue;
    }
    const data = host.spatialFiles[fileIndex];

    if (update.transform && update.transform.length === 16) {
      // Absolute, not composed: the pipeline expresses every scan relative to
      // the same anchor, so re-running it must not stack onto the previous run.
      host.setTransformationMatrix(fileIndex, new THREE.Matrix4().fromArray(update.transform));
      host.updateMatrixTextarea(fileIndex);
      outcome.placed++;
    }

    if (!update.rawColors || !update.frameIndices || !data.colorsArray) {
      continue;
    }
    const metadata = (data.metadata ??= {});
    metadata.stonexRawColors = update.rawColors;
    metadata.stonexFrameIndices = update.frameIndices;
    if (typeof update.photographicallyColoredPoints === 'number') {
      metadata.photographicallyColoredPoints = update.photographicallyColoredPoints;
    }

    // Re-derive the corrected array the GPU shares, under whatever correction
    // this file is currently displaying.
    const calibration = metadata.stonexColorCalibration as StonexColorCalibration | undefined;
    const correction =
      (metadata.stonexColorCorrection as typeof DEFAULT_STONEX_COLOR_CORRECTION | undefined) ??
      DEFAULT_STONEX_COLOR_CORRECTION;
    if (calibration) {
      applyStonexColorCorrectionToPoints(
        update.rawColors,
        update.frameIndices,
        computeStonexFrameMultipliers(calibration, correction),
        correction,
        data.colorsArray
      );
    } else {
      data.colorsArray.set(update.rawColors);
    }
    data.hasColors = true;

    // Only flag the attribute when it is the shared colorsArray; other colour
    // modes rebuild from it when the user switches back to "original".
    const geometry = (host.meshes[fileIndex] as THREE.Mesh | undefined)?.geometry;
    const attribute = geometry?.getAttribute('color');
    if (attribute && (attribute.array as unknown) === data.colorsArray) {
      attribute.needsUpdate = true;
    }
    outcome.recolored++;
  }

  // Panoramas live in their own station's frame, so they move with the scans.
  if (host.cameraGroups?.length) {
    updateStonexCameraStations(host as never);
  }
  host.updateFileStats?.();
  host.requestRender();
  return outcome;
}

/** Progress line from the host's run, shown while the button is busy. */
export function reportStationPipelineProgress(message: unknown): void {
  if (typeof message === 'string' && message.length > 0) {
    stationPipelineUi.message = message;
  }
}

export interface StationPipelineMessage {
  updates?: StationPipelineUpdate[];
  summary?: string;
  error?: string;
}

/** Entry point for the `stationPipelineResult` message from the host. */
export function handleStationPipelineResult(
  host: StationPipelineHost,
  message: StationPipelineMessage
): void {
  stationPipelineUi.busy = false;
  if (message.error) {
    stationPipelineUi.message = `Station pipeline failed: ${message.error}`;
    return;
  }
  // Applying touches geometry and the file list, so a failure here must land
  // in front of the user rather than as an unhandled rejection in a listener.
  try {
    const outcome = applyStationPipelineUpdates(host, message.updates ?? []);
    stationPipelineUi.message =
      `${message.summary ?? 'Done'} · placed ${outcome.placed} scans` +
      (outcome.recolored > 0 ? `, recoloured ${outcome.recolored}` : '');
  } catch (error) {
    console.error('[station-pipeline] applying the result failed:', error);
    stationPipelineUi.message = `Could not apply the result: ${
      error instanceof Error ? error.message : String(error)
    }`;
  }
}
