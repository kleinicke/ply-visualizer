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
import { RECOLORED_MODE } from './colorMode';
import { filesState } from './state/files.svelte';
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
  /**
   * Set on a partial update: colours cover the scan's own points only, so the
   * host can send each scan as it finishes rather than the archive at the end.
   */
  partial?: boolean;
  /** Column-major 4x4 placing the scan in the archive's common frame. */
  transform: number[] | null;
  /** Present only when this scan's colour changed. */
  rawColors?: Uint8Array;
  frameIndices?: Uint16Array;
  photographicallyColoredPoints?: number;
}

export interface StationPipelineHost {
  spatialFiles: SpatialData[];
  transformationMatrices: THREE.Matrix4[];
  individualColorModes?: string[];
  onFileColorModeChange?(fileIndex: number, mode: string): void;
  updateFileList?(): void;
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

/**
 * The scan's cross-station colour buffer, created white on first use.
 *
 * White rather than a copy of the native colour, so selecting the mode before
 * the result lands shows plainly which points have been reached and which have
 * not — and so a scan that was grey to begin with does not silently look
 * finished.
 */
function ensureRecoloredArray(data: SpatialData): Uint8Array {
  const metadata = (data.metadata ??= {});
  const existing = metadata.stationRecoloredColors;
  const count = data.vertexCount || (data.positionsArray?.length ?? 0) / 3;
  if (existing instanceof Uint8Array && existing.length === count * 3) {
    return existing;
  }
  const created = new Uint8Array(count * 3).fill(255);
  metadata.stationRecoloredColors = created;
  return created;
}

/** Switches a file to the recoloured mode if it is not already on it. */
function selectRecoloredMode(host: StationPipelineHost, fileIndex: number): void {
  if (host.individualColorModes?.[fileIndex] === RECOLORED_MODE) {
    return;
  }
  host.onFileColorModeChange?.(fileIndex, RECOLORED_MODE);
  filesState.colorModes[fileIndex] = RECOLORED_MODE;
}

/** Pushes the recoloured buffer at the GPU when it is what is being drawn. */
function refreshRecoloredAttribute(
  host: StationPipelineHost,
  fileIndex: number,
  data: SpatialData
): void {
  const geometry = (host.meshes[fileIndex] as THREE.Mesh | undefined)?.geometry;
  const attribute = geometry?.getAttribute('color');
  const recolored = data.metadata?.stationRecoloredColors;
  if (attribute && (attribute.array as unknown) === recolored) {
    attribute.needsUpdate = true;
  }
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

    if (!update.rawColors || !update.frameIndices) {
      continue;
    }
    const metadata = (data.metadata ??= {});

    // Into its own array, never over `colorsArray`: the scan's native colour
    // has to stay switchable, and comparing the two is the point.
    const recolored = ensureRecoloredArray(data);
    // A partial update carries only this scan's points, which is the whole
    // archive's array sliced to its range; a full one replaces everything.
    const target =
      update.partial && update.rawColors.length < recolored.length
        ? recolored.subarray(0, update.rawColors.length)
        : recolored;
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
        target
      );
    } else {
      target.set(update.rawColors);
    }
    metadata.stationRecoloredRaw = update.rawColors;
    metadata.stationRecoloredFrames = update.frameIndices;
    if (typeof update.photographicallyColoredPoints === 'number') {
      metadata.stationRecoloredPoints = update.photographicallyColoredPoints;
    }

    // Show it straight away — a result you have to go and find is a result most
    // people never see.
    const pending = pendingRecolor.get(fileIndex);
    if (pending) {
      pending.filled = true;
    }
    selectRecoloredMode(host, fileIndex);
    refreshRecoloredAttribute(host, fileIndex, data);
    outcome.recolored++;
  }

  // Panoramas live in their own station's frame, so they move with the scans.
  if (host.cameraGroups?.length) {
    updateStonexCameraStations(host as never);
  }
  // Rebuild the rows. The colour picker's "camera (all stations)" entry is
  // gated on renderTick, while the *selected* mode is written straight into a
  // reactive array - without this the select ends up pointing at an option that
  // was never rendered, which shows as a blank picker with no way back.
  host.updateFileList?.();
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
  /** A scan finished; more are still coming, so the run stays busy. */
  partial?: boolean;
}

/**
 * Paints the archive's scans white and switches them to the camera view, before
 * any result exists.
 *
 * The point is to make the run legible: the scans go blank, then fill in as the
 * host reports each one. Without it the view sits unchanged for a minute and
 * flips in a single step, which reads as "nothing is happening".
 */
/**
 * Scans blanked for the current run, with the colour mode each had beforehand.
 *
 * Needed because a run can legitimately colour nothing: a single-station
 * archive has no other camera to offer, so "all stations" is the same view it
 * already had. Those scans have to be handed back rather than left white.
 */
const pendingRecolor = new Map<number, { previousMode: string; filled: boolean }>();

export function beginStationRecolor(host: StationPipelineHost, archiveName: string): number {
  pendingRecolor.clear();
  let prepared = 0;
  for (let index = 0; index < host.spatialFiles.length; index++) {
    const data = host.spatialFiles[index];
    if (data?.metadata?.containerFileName !== archiveName || !data.metadata?.embeddedScanName) {
      continue;
    }
    const recolored = ensureRecoloredArray(data);
    recolored.fill(255);
    pendingRecolor.set(index, {
      previousMode: host.individualColorModes?.[index] ?? 'original',
      filled: false,
    });
    selectRecoloredMode(host, index);
    refreshRecoloredAttribute(host, index, data);
    prepared++;
  }
  if (prepared > 0) {
    host.updateFileList?.();
    host.requestRender();
  }
  return prepared;
}

/**
 * Completes every scan the run had nothing to add to.
 *
 * "All stations" is a view, not a diff, so it has to exist for every scan of
 * the archive — including the ones no other camera could improve. For those the
 * answer is already on hand: with nothing else reaching them, the all-stations
 * result *is* their own station's colour, so it is copied locally rather than
 * shipped back across a postMessage that would carry tens of megabytes to say
 * nothing new.
 *
 * A scan with no colour at all is the one case with nothing to copy; that one
 * goes back to the mode it came from rather than sitting white.
 */
function completeUntouchedScans(host: StationPipelineHost): { filled: number; released: number } {
  let filled = 0;
  let released = 0;
  for (const [fileIndex, pending] of pendingRecolor) {
    if (pending.filled) {
      continue;
    }
    const data = host.spatialFiles[fileIndex];
    const recolored = data?.metadata?.stationRecoloredColors;
    if (data?.colorsArray && recolored instanceof Uint8Array) {
      recolored.set(data.colorsArray.subarray(0, recolored.length));
      refreshRecoloredAttribute(host, fileIndex, data);
      filled++;
      continue;
    }
    if (data?.metadata) {
      delete data.metadata.stationRecoloredColors;
    }
    host.onFileColorModeChange?.(fileIndex, pending.previousMode);
    filesState.colorModes[fileIndex] = pending.previousMode;
    released++;
  }
  pendingRecolor.clear();
  return { filled, released };
}

/** Entry point for the `stationPipelineResult` message from the host. */
export function handleStationPipelineResult(
  host: StationPipelineHost,
  message: StationPipelineMessage
): void {
  if (message.partial) {
    // Progress, not the end of the run: paint it and leave the button busy.
    applyStationPipelineUpdates(host, message.updates ?? []);
    return;
  }
  stationPipelineUi.busy = false;
  const untouched = completeUntouchedScans(host);
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
      (outcome.recolored > 0 ? `, recoloured ${outcome.recolored}` : '') +
      (untouched.filled > 0
        ? ` · ${untouched.filled} unchanged (no other station reaches them)`
        : '') +
      (untouched.released > 0 ? ` · ${untouched.released} had no colour to show` : '');
  } catch (error) {
    console.error('[station-pipeline] applying the result failed:', error);
    stationPipelineUi.message = `Could not apply the result: ${
      error instanceof Error ? error.message : String(error)
    }`;
  }
}

/** A capture place: every scan that registered to the same spot. */
export interface CapturePlace {
  /** Stable label, taken from the scan that carries the station's cameras. */
  name: string;
  /** Unified file indices of the scans standing at this place. */
  fileIndices: number[];
  /** Scan stems, for matching the camera frames shot from here. */
  scanStems: string[];
}

/** Two origins within this distance are treated as one tripod position. */
const SAME_PLACE_METRES = 0.5;

/**
 * Groups an archive's scans by where they were actually captured.
 *
 * Clustering registered origins rather than reading a field, because no field
 * exists: an X3A says nothing about which sweep belongs to which setup. After
 * registration the answer is obvious — a station's quick preview sweeps land on
 * top of its full scan, metres away from the next tripod position — and before
 * registration everything sits on the origin and honestly is one group.
 */
export function capturePlaces(
  host: StationPipelineHost,
  archiveName: string | undefined
): CapturePlace[] {
  if (!archiveName) {
    return [];
  }
  const places: (CapturePlace & { origin: THREE.Vector3 })[] = [];
  const photographic = new Set<string>();
  for (const data of host.spatialFiles) {
    for (const frame of (data?.metadata?.stonexCameraFrames ?? []) as { scanStem?: string }[]) {
      if (frame.scanStem) {
        photographic.add(frame.scanStem);
      }
    }
  }

  for (let index = 0; index < host.spatialFiles.length; index++) {
    const metadata = host.spatialFiles[index]?.metadata;
    if (metadata?.containerFileName !== archiveName || !metadata?.embeddedScanName) {
      continue;
    }
    const stem = String(metadata.embeddedScanName).replace(/\.x3r$/i, '');
    const origin = new THREE.Vector3().setFromMatrixPosition(host.transformationMatrices[index]);
    const existing = places.find(place => place.origin.distanceTo(origin) <= SAME_PLACE_METRES);
    const place =
      existing ??
      (places.push({ name: stem, fileIndices: [], scanStems: [], origin }),
      places[places.length - 1]);
    place.fileIndices.push(index);
    place.scanStems.push(stem);
    // A station is best named after the sweep its cameras belong to.
    if (photographic.has(stem)) {
      place.name = stem;
    }
  }

  return places.map(({ name, fileIndices, scanStems }) => ({ name, fileIndices, scanStems }));
}

export interface CapturePlaceHost extends StationPipelineHost {
  setFileEntryVisibility(fileIndex: number, visible: boolean): void;
  fileVisibility: boolean[];
}

/** Shows or hides everything captured from one place, cameras included. */
export function setCapturePlaceVisible(
  host: CapturePlaceHost,
  place: CapturePlace,
  visible: boolean
): void {
  for (const fileIndex of place.fileIndices) {
    host.setFileEntryVisibility(fileIndex, visible);
  }
  const stems = new Set(place.scanStems);
  for (const profile of host.cameraGroups ?? []) {
    for (const child of profile.children) {
      const stem =
        (child.userData?.frame as { scanStem?: string } | undefined)?.scanStem ??
        (child.userData?.stationStem as string | undefined);
      if (stem && stems.has(stem)) {
        child.visible = visible;
      }
    }
  }
  host.requestRender();
}
