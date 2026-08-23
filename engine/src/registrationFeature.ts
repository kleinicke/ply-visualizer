/**
 * Host glue for scan-to-scan registration.
 *
 * Everything the solvers in `registration/` see is world space - the geometry
 * as it is actually drawn, which is the file's points run through its 4x4
 * transform. A solver therefore returns a *delta*, and applying it is
 * `newMatrix = delta * currentMatrix`. That composition is the whole reason
 * registration needs no new data model: it stacks on whatever the user already
 * did by hand, and undo is just putting the previous matrix back.
 */

import * as THREE from 'three';
import type { SpatialData } from './interfaces';
import { registrationState } from './state/registration.svelte';
import { updateStonexCameraStations } from './visualization/stonexCameras';
import { perfLog } from './utils/perfLog';
import {
  fitCorrespondences,
  icpRefine,
  registerPair,
  registrationBackend,
  type UpAxis,
} from './registration';

export interface RegistrationHost {
  scene: THREE.Scene;
  spatialFiles: SpatialData[];
  transformationMatrices: THREE.Matrix4[];
  fileVisibility?: boolean[];
  /** X3A camera profiles, so panoramas follow the scans they were shot from. */
  cameraGroups?: THREE.Group[];
  setTransformationMatrix(fileIndex: number, matrix: THREE.Matrix4): void;
  setFileEntryVisibility?(fileIndex: number, visible: boolean): void;
  updateMatrixTextarea(fileIndex: number): void;
  requestRender(): void;
}

/**
 * Turns a thrown solver error into something the panel can show.
 *
 * These calls cross a worker (or a wasm module) boundary, so they can fail for
 * reasons no caller anticipated — a worker that will not start, a module that
 * will not load. Swallowing that leaves a button that does nothing when
 * clicked, which is exactly how this surfaced in the VS Code webview.
 */
function describeFailure(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  console.error('[registration] failed:', error);
  return `Alignment failed (${registrationBackend()}): ${message}`;
}

/** One cluster of clouds the automatic run could not attach. */
export interface UnattachedGroup {
  indices: number[];
  names: string[];
  /** The most promising single pair to link this group back to the scene. */
  suggestion: {
    movingIndex: number;
    fixedIndex: number;
    movingName: string;
    fixedName: string;
    overlapPercent: number;
  } | null;
}

/** Correspondences are stored in world space, as picked. */
interface Correspondence {
  source: THREE.Vector3;
  target: THREE.Vector3;
}

interface Session {
  sourceIndex: number;
  targetIndex: number;
  pairs: Correspondence[];
  coarseFixed: THREE.Vector3[];
  coarseMoving: THREE.Vector3[];
  /** Per-landmark residual of the last applied coarse fit, in scene units. */
  coarseResiduals: number[];
  pending: { point: THREE.Vector3; onSource: boolean } | null;
  /** Transform of the source file before this session touched it. */
  undoMatrix: THREE.Matrix4 | null;
  markers: THREE.Group | null;
  /** Cached once per session; the scene's scale does not change under it. */
  markerRadius: number | null;
  savedVisibility: boolean[] | null;
}

let session: Session | null = null;

/**
 * Steps that are not picking but still need the landmarks drawn: the user is
 * being asked to judge the picks rather than add to them.
 */
function isReviewStep(workflow: string): boolean {
  return workflow === 'coarse-ready' || workflow === 'coarse-done';
}

/**
 * Cap on points handed to the solvers. Both stages downsample internally, so
 * more input buys accuracy that the voxel grid immediately throws away, while
 * costing a full copy of a multi-million-point cloud.
 */
const MAX_SOLVER_POINTS = 400_000;

function positionsOf(data: SpatialData | undefined): Float32Array | null {
  if (!data) {
    return null;
  }
  if (data.positionsArray && data.positionsArray.length >= 3) {
    return data.positionsArray;
  }
  if (data.vertices && data.vertices.length > 0) {
    const out = new Float32Array(data.vertices.length * 3);
    for (let i = 0; i < data.vertices.length; i++) {
      out[i * 3] = data.vertices[i].x;
      out[i * 3 + 1] = data.vertices[i].y;
      out[i * 3 + 2] = data.vertices[i].z;
    }
    return out;
  }
  return null;
}

/**
 * The file's points in world space, strided down to `MAX_SOLVER_POINTS`.
 *
 * Strided rather than random: a scan record is stored in acquisition order
 * (column by column), so a fixed stride samples the whole sweep evenly, and it
 * costs no extra pass.
 */
export function worldPoints(host: RegistrationHost, fileIndex: number): Float32Array | null {
  const source = positionsOf(host.spatialFiles[fileIndex]);
  if (!source) {
    return null;
  }
  const matrix = host.transformationMatrices[fileIndex] ?? new THREE.Matrix4();
  const count = Math.floor(source.length / 3);
  const stride = Math.max(1, Math.ceil(count / MAX_SOLVER_POINTS));
  const kept = Math.ceil(count / stride);
  const out = new Float32Array(kept * 3);

  const e = matrix.elements;
  let write = 0;
  for (let i = 0; i < count; i += stride) {
    const x = source[i * 3];
    const y = source[i * 3 + 1];
    const z = source[i * 3 + 2];
    out[write++] = e[0] * x + e[4] * y + e[8] * z + e[12];
    out[write++] = e[1] * x + e[5] * y + e[9] * z + e[13];
    out[write++] = e[2] * x + e[6] * y + e[10] * z + e[14];
  }
  return out.subarray(0, write);
}

/** Indices of the loaded point clouds a file can be registered against. */
export function registrationCandidates(host: RegistrationHost, exceptIndex: number): number[] {
  const candidates: number[] = [];
  for (let i = 0; i < host.spatialFiles.length; i++) {
    if (i !== exceptIndex && positionsOf(host.spatialFiles[i])) {
      candidates.push(i);
    }
  }
  return candidates;
}

function syncState(): void {
  registrationState.sourceIndex = session ? session.sourceIndex : null;
  registrationState.targetIndex = session ? session.targetIndex : null;
  registrationState.pairCount = session ? session.pairs.length : 0;
  registrationState.coarseFixedCount = session ? session.coarseFixed.length : 0;
  registrationState.coarseMovingCount = session ? session.coarseMoving.length : 0;
  registrationState.coarseResiduals = session ? [...session.coarseResiduals] : [];
  registrationState.awaiting = session?.pending
    ? session.pending.onSource
      ? 'target'
      : 'source'
    : null;
  registrationState.canUndo = !!session?.undoMatrix;
}

export function beginSession(
  host: RegistrationHost,
  sourceIndex: number,
  targetIndex: number
): void {
  if (session && session.sourceIndex === sourceIndex && session.targetIndex === targetIndex) {
    return;
  }
  endSession(host);
  session = {
    sourceIndex,
    targetIndex,
    pairs: [],
    coarseResiduals: [],
    coarseFixed: [],
    coarseMoving: [],
    pending: null,
    undoMatrix: null,
    markers: null,
    markerRadius: null,
    savedVisibility: null,
  };
  registrationState.workflow = 'choose';
  registrationState.status = '';
  registrationState.result = '';
  syncState();
}

export function endSession(host: RegistrationHost): void {
  restoreVisibility(host);
  if (session?.markers) {
    host.scene.remove(session.markers);
    disposeMarkers(session.markers);
  }
  session = null;
  registrationState.picking = false;
  registrationState.workflow = 'choose';
  syncState();
  host.requestRender();
}

function captureVisibility(host: RegistrationHost): void {
  if (!session || session.savedVisibility || !host.fileVisibility) {
    return;
  }
  session.savedVisibility = host.fileVisibility.map(value => value !== false);
}

function setWorkflowVisibility(host: RegistrationHost, visibleIndices: number[]): void {
  if (!session || !host.setFileEntryVisibility || !host.fileVisibility) {
    return;
  }
  // Opt-out, because isolating is right for the common case (two scans of one
  // room look alike, and picking the same corner twice is impossible with both
  // drawn) and wrong when the whole point is to see how far apart they are.
  if (!registrationState.isolateWhilePicking) {
    restoreVisibility(host);
    return;
  }
  captureVisibility(host);
  const visible = new Set(visibleIndices);
  for (let index = 0; index < host.fileVisibility.length; index++) {
    host.setFileEntryVisibility(index, visible.has(index));
  }
  host.requestRender();
}

function restoreVisibility(host: RegistrationHost): void {
  if (!session?.savedVisibility || !host.setFileEntryVisibility) {
    return;
  }
  session.savedVisibility.forEach((visible, index) => host.setFileEntryVisibility!(index, visible));
  session.savedVisibility = null;
  host.requestRender();
}

function showFixed(host: RegistrationHost): void {
  if (session) {
    setWorkflowVisibility(host, [session.targetIndex]);
  }
}

function showMoving(host: RegistrationHost): void {
  if (session) {
    setWorkflowVisibility(host, [session.sourceIndex]);
  }
}

function showPair(host: RegistrationHost): void {
  if (session) {
    setWorkflowVisibility(host, [session.targetIndex, session.sourceIndex]);
  }
}

/** Starts the guided manual route at either coarse landmarks or fine pairs. */
export function startGuidedMatching(host: RegistrationHost, alreadyCoarse: boolean): void {
  if (!session || registrationState.busy) {
    return;
  }
  session.pairs = [];
  session.pending = null;
  session.coarseFixed = [];
  session.coarseMoving = [];
  session.coarseResiduals = [];
  registrationState.picking = true;
  registrationState.result = '';
  if (alreadyCoarse) {
    registrationState.workflow = 'fine-fixed';
    registrationState.status =
      'Fine match — ⌘/Ctrl + double-click a distinctive feature on the fixed cloud.';
  } else {
    registrationState.workflow = 'coarse-fixed';
    registrationState.status =
      'Coarse match — ⌘/Ctrl + double-click 3 well-spread features on the fixed cloud.';
  }
  showFixed(host);
  refreshMarkers(host);
  syncState();
}

/**
 * Moves from a reviewed coarse match into fine matching, on purpose.
 *
 * The coarse landmarks are dropped rather than carried in: they were picked to
 * be roughly right over a large baseline, and averaging them into the precise
 * pairs that follow would drag the fine fit back towards them.
 */
export function startFineMatching(host: RegistrationHost): void {
  if (!session || registrationState.busy) {
    return;
  }
  startGuidedMatching(host, true);
}

/**
 * Re-apply the isolation rule for the step the workflow is on.
 *
 * Called when the toggle changes mid-pick: turning it off has to put the other
 * clouds back immediately, and turning it on has to hide them again, without
 * losing the picks made so far.
 */
export function refreshPickingVisibility(host: RegistrationHost): void {
  if (!session || !registrationState.picking) {
    return;
  }
  switch (registrationState.workflow) {
    case 'coarse-fixed':
    case 'fine-fixed':
      showFixed(host);
      break;
    case 'coarse-moving':
    case 'fine-moving':
      showMoving(host);
      break;
    default:
      showPair(host);
  }
}

/**
 * Leaves guided picking, restores the scene, and keeps the work.
 *
 * The pairs stay on the session so `resumeGuidedMatching` picks the thread back
 * up rather than starting over. Finishing is about getting the markers and the
 * isolation out of the way, not about discarding correspondences that took real
 * effort to place.
 */
export function finishGuidedMatching(host: RegistrationHost): void {
  if (!session) {
    return;
  }
  registrationState.picking = false;
  registrationState.workflow = 'choose';
  registrationState.status = '';
  session.pending = null;
  restoreVisibility(host);
  refreshMarkers(host);
  syncState();
}

/** Picks the fine-matching thread back up with the pairs already placed. */
export function resumeGuidedMatching(host: RegistrationHost): void {
  if (!session || registrationState.busy) {
    return;
  }
  session.pending = null;
  registrationState.picking = true;
  registrationState.workflow = 'fine-fixed';
  registrationState.status =
    session.pairs.length > 0
      ? `${session.pairs.length} pair${session.pairs.length === 1 ? '' : 's'} kept — ⌘/Ctrl + double-click the next feature on the fixed cloud.`
      : 'Fine match — ⌘/Ctrl + double-click a distinctive feature on the fixed cloud.';
  showFixed(host);
  refreshMarkers(host);
  syncState();
}

/**
 * Drop one pair and go back to picking, so it can be placed again.
 *
 * Removed rather than edited in place: a correspondence is two points that have
 * to agree, and replacing one half on its own is how a pair ends up describing
 * two different features. The replacement is appended, so the pairs after it
 * shift down by one.
 */
export function recapturePair(host: RegistrationHost, pairIndex: number): void {
  if (!session || registrationState.busy) {
    return;
  }
  if (pairIndex < 0 || pairIndex >= session.pairs.length) {
    return;
  }
  session.pairs.splice(pairIndex, 1);
  session.pending = null;
  registrationState.picking = true;
  registrationState.workflow = 'fine-fixed';
  registrationState.status = `Re-picking pair ${pairIndex + 1} — ⌘/Ctrl + double-click the feature on the fixed cloud.`;
  showFixed(host);
  refreshMarkers(host);
  syncState();
}

export function setPicking(host: RegistrationHost, picking: boolean): void {
  registrationState.picking = picking;
  if (!picking && session) {
    session.pending = null;
    refreshMarkers(host);
  }
  syncState();
}

export function clearPairs(host: RegistrationHost): void {
  if (!session) {
    return;
  }
  session.pairs = [];
  session.pending = null;
  session.coarseFixed = [];
  session.coarseMoving = [];
  session.coarseResiduals = [];
  refreshMarkers(host);
  syncState();
}

export function removeLastPair(host: RegistrationHost): void {
  if (!session) {
    return;
  }
  if (registrationState.workflow === 'coarse-done') {
    // The fit is already applied; stepping back one landmark would describe a
    // set that no longer matches the transform on screen. Redo or undo instead.
    return;
  }
  if (registrationState.workflow === 'coarse-ready') {
    session.coarseMoving.pop();
    registrationState.workflow = 'coarse-moving';
    registrationState.picking = true;
    registrationState.status =
      '⌘/Ctrl + double-click the third matching feature again on the moving cloud.';
    showMoving(host);
  } else if (registrationState.workflow === 'coarse-moving') {
    if (session.coarseMoving.length > 0) {
      session.coarseMoving.pop();
    } else {
      session.coarseFixed.pop();
      registrationState.workflow = 'coarse-fixed';
      registrationState.status =
        '⌘/Ctrl + double-click the last coarse feature again on the fixed cloud.';
      showFixed(host);
    }
  } else if (registrationState.workflow === 'coarse-fixed') {
    session.coarseFixed.pop();
  } else if (registrationState.workflow === 'fine-moving') {
    session.pending = null;
    registrationState.workflow = 'fine-fixed';
    registrationState.status = '⌘/Ctrl + double-click a feature on the fixed cloud.';
    showFixed(host);
  } else if (session.pending) {
    session.pending = null;
  } else {
    session.pairs.pop();
  }
  refreshMarkers(host);
  syncState();
}

/**
 * Squared distance from `point` to the nearest vertex of a file, in world
 * space. Used to decide which of the two clouds the user just clicked, since
 * the picker reports a position but not an owner.
 */
function nearestVertexDistanceSq(
  host: RegistrationHost,
  fileIndex: number,
  point: THREE.Vector3
): number {
  const positions = positionsOf(host.spatialFiles[fileIndex]);
  if (!positions) {
    return Infinity;
  }
  const e = (host.transformationMatrices[fileIndex] ?? new THREE.Matrix4()).elements;
  const count = Math.floor(positions.length / 3);
  let best = Infinity;
  for (let i = 0; i < count; i++) {
    const x = positions[i * 3];
    const y = positions[i * 3 + 1];
    const z = positions[i * 3 + 2];
    const dx = e[0] * x + e[4] * y + e[8] * z + e[12] - point.x;
    const dy = e[1] * x + e[5] * y + e[9] * z + e[13] - point.y;
    const dz = e[2] * x + e[6] * y + e[10] * z + e[14] - point.z;
    const squared = dx * dx + dy * dy + dz * dz;
    if (squared < best) {
      best = squared;
      if (best === 0) {
        break;
      }
    }
  }
  return best;
}

/**
 * Offers a picked world point to the active correspondence session.
 *
 * Takes a plain coordinate rather than a `THREE.Vector3` so the caller does not
 * have to hand over an object this module will keep: every point it retains is
 * its own copy.
 *
 * @returns true when the point was consumed, so the caller leaves the rotation
 *   center and the measurement path alone.
 */
export function handlePickedPoint(
  host: RegistrationHost,
  picked: { x: number; y: number; z: number }
): boolean {
  if (!session || !registrationState.picking) {
    return false;
  }
  const point = new THREE.Vector3(picked.x, picked.y, picked.z);

  if (registrationState.busy) {
    return true;
  }

  switch (registrationState.workflow) {
    case 'coarse-fixed': {
      if (session.coarseFixed.length < 3) {
        session.coarseFixed.push(point);
      }
      if (session.coarseFixed.length === 3) {
        registrationState.workflow = 'coarse-moving';
        registrationState.status =
          'Now pick the same 3 features, in the same order, on the moving cloud.';
        showMoving(host);
      } else {
        registrationState.status = `Coarse match — ${3 - session.coarseFixed.length} more feature${session.coarseFixed.length === 2 ? '' : 's'} on the fixed cloud (⌘/Ctrl + double-click).`;
      }
      refreshMarkers(host);
      syncState();
      return true;
    }
    case 'coarse-moving': {
      if (session.coarseMoving.length < 3) {
        session.coarseMoving.push(point);
      }
      if (session.coarseMoving.length === 3) {
        registrationState.workflow = 'coarse-ready';
        registrationState.picking = false;
        registrationState.status = 'Three coarse pairs ready — apply them, then refine.';
        showPair(host);
      } else {
        registrationState.status = `Coarse match — the same ${3 - session.coarseMoving.length} feature${session.coarseMoving.length === 2 ? '' : 's'} again on the moving cloud (⌘/Ctrl + double-click).`;
      }
      refreshMarkers(host);
      syncState();
      return true;
    }
    case 'fine-fixed': {
      session.pending = { point, onSource: false };
      registrationState.workflow = 'fine-moving';
      registrationState.status = '⌘/Ctrl + double-click the same feature on the moving cloud.';
      showMoving(host);
      refreshMarkers(host);
      syncState();
      return true;
    }
    case 'fine-moving': {
      if (!session.pending) {
        registrationState.workflow = 'fine-fixed';
        showFixed(host);
        syncState();
        return true;
      }
      session.pairs.push({ source: point, target: session.pending.point.clone() });
      session.pending = null;
      registrationState.workflow = 'fine-fixed';
      registrationState.status =
        session.pairs.length < 3
          ? `${session.pairs.length} fine pair${session.pairs.length === 1 ? '' : 's'} picked; ${3 - session.pairs.length} more before live adjustment.`
          : `Adjusting from ${session.pairs.length} fine pairs…`;
      showFixed(host);
      refreshMarkers(host);
      syncState();
      if (session.pairs.length >= 3) {
        void fitFinePairsLive(host);
      }
      return true;
    }
    default:
      break;
  }

  const sourceDistance = nearestVertexDistanceSq(host, session.sourceIndex, point);
  const targetDistance = nearestVertexDistanceSq(host, session.targetIndex, point);
  if (!Number.isFinite(sourceDistance) && !Number.isFinite(targetDistance)) {
    return false;
  }
  const onSource = sourceDistance <= targetDistance;

  const pending = session.pending;
  if (pending && pending.onSource !== onSource) {
    session.pairs.push({
      source: onSource ? point.clone() : pending.point.clone(),
      target: onSource ? pending.point.clone() : point.clone(),
    });
    session.pending = null;
    registrationState.status = `${session.pairs.length} pair${session.pairs.length === 1 ? '' : 's'} picked`;
  } else {
    // Same cloud twice in a row replaces the half-picked point rather than
    // stacking, which is what a user re-aiming after a bad click expects.
    session.pending = { point: point.clone(), onSource };
    registrationState.status = onSource
      ? 'Picked on the moving cloud - now pick the matching point on the fixed one'
      : 'Picked on the fixed cloud - now pick the matching point on the moving one';
  }

  refreshMarkers(host);
  syncState();
  return true;
}

function disposeMarkers(group: THREE.Group): void {
  group.traverse(object => {
    const mesh = object as THREE.Mesh | THREE.LineSegments;
    mesh.geometry?.dispose?.();
    const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(material)) {
      material.forEach(entry => entry.dispose());
    } else {
      material?.dispose?.();
    }
  });
}

/** Marker size relative to the scene, so they stay visible at any scale. */
function markerRadius(host: RegistrationHost): number {
  if (!session) {
    return 1;
  }
  if (session.markerRadius === null) {
    const box = new THREE.Box3();
    const points = worldPoints(host, session.targetIndex);
    const corner = new THREE.Vector3();
    if (points) {
      for (let i = 0; i < points.length; i += 3 * 97) {
        box.expandByPoint(corner.set(points[i], points[i + 1], points[i + 2]));
      }
    }
    const size = box.isEmpty() ? 1 : box.getSize(new THREE.Vector3()).length();
    session.markerRadius = Math.max(size * 0.004, 1e-4);
  }
  // Scaled at read time, not baked into the cached radius, so moving the
  // slider re-renders the existing picks instead of only affecting the next.
  return session.markerRadius * Math.max(0.05, registrationState.markerScale);
}

function refreshMarkers(host: RegistrationHost): void {
  if (!session) {
    return;
  }
  if (session.markers) {
    host.scene.remove(session.markers);
    disposeMarkers(session.markers);
    session.markers = null;
  }

  // Finishing hides the picks without discarding them: the session keeps every
  // pair so the work can be resumed, but a scene left covered in markers after
  // the user said they were done is clutter over the result they wanted to see.
  //
  // The two review steps are the exception. 'coarse-ready' asks the user to
  // confirm three landmarks and 'coarse-done' shows how well they ended up
  // matching, and neither question can be answered with the picks hidden.
  if (!registrationState.picking && !isReviewStep(registrationState.workflow)) {
    host.requestRender();
    return;
  }

  const group = new THREE.Group();
  group.name = 'registration-correspondences';
  // Markers sit on top of the geometry they annotate; without this they hide
  // inside the very surface the user is trying to aim at.
  const sphere = new THREE.SphereGeometry(markerRadius(host), 12, 8);
  const sourceMaterial = new THREE.MeshBasicMaterial({ color: 0xff8c1a, depthTest: false });
  const targetMaterial = new THREE.MeshBasicMaterial({ color: 0x2ad4ff, depthTest: false });
  const pendingMaterial = new THREE.MeshBasicMaterial({ color: 0xffe066, depthTest: false });
  const lineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, depthTest: false });

  // Markers follow whichever cloud is on screen. Picking the same corner twice
  // means looking for it without its answer already drawn on top: while the
  // moving cloud is up, the fixed cloud's picks are not just clutter, they are
  // a hint in the wrong place — they sit where the feature *will* be, not where
  // it is. Both sets return whenever both clouds are visible.
  const isolated = registrationState.isolateWhilePicking && registrationState.picking;
  const side: 'fixed' | 'moving' | 'both' = !isolated
    ? 'both'
    : registrationState.workflow === 'coarse-fixed' || registrationState.workflow === 'fine-fixed'
      ? 'fixed'
      : registrationState.workflow === 'coarse-moving' ||
          registrationState.workflow === 'fine-moving'
        ? 'moving'
        : 'both';
  const showFixedSide = side !== 'moving';
  const showMovingSide = side !== 'fixed';

  const linePoints: number[] = [];
  if (showFixedSide) {
    for (const point of session.coarseFixed) {
      const marker = new THREE.Mesh(sphere, targetMaterial);
      marker.position.copy(point);
      marker.renderOrder = 999;
      group.add(marker);
    }
  }
  for (let index = 0; index < session.coarseMoving.length; index++) {
    const point = session.coarseMoving[index];
    if (showMovingSide) {
      const marker = new THREE.Mesh(sphere, sourceMaterial);
      marker.position.copy(point);
      marker.renderOrder = 999;
      group.add(marker);
    }
    const fixed = session.coarseFixed[index];
    // A correspondence line only means anything with both ends on screen.
    if (fixed && side === 'both') {
      linePoints.push(point.x, point.y, point.z, fixed.x, fixed.y, fixed.z);
    }
  }
  for (const pair of session.pairs) {
    if (showMovingSide) {
      const source = new THREE.Mesh(sphere, sourceMaterial);
      source.position.copy(pair.source);
      source.renderOrder = 999;
      group.add(source);
    }
    if (showFixedSide) {
      const target = new THREE.Mesh(sphere, targetMaterial);
      target.position.copy(pair.target);
      target.renderOrder = 999;
      group.add(target);
    }
    if (side === 'both') {
      linePoints.push(pair.source.x, pair.source.y, pair.source.z);
      linePoints.push(pair.target.x, pair.target.y, pair.target.z);
    }
  }
  if (session.pending && (session.pending.onSource ? showMovingSide : showFixedSide)) {
    const marker = new THREE.Mesh(sphere, pendingMaterial);
    marker.position.copy(session.pending.point);
    marker.renderOrder = 999;
    group.add(marker);
  }
  if (linePoints.length > 0) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(linePoints, 3));
    const lines = new THREE.LineSegments(geometry, lineMaterial);
    lines.renderOrder = 999;
    group.add(lines);
  }

  if (group.children.length > 0) {
    session.markers = group;
    host.scene.add(group);
  } else {
    sphere.dispose();
    sourceMaterial.dispose();
    targetMaterial.dispose();
    pendingMaterial.dispose();
    lineMaterial.dispose();
  }
  host.requestRender();
}

/**
 * Composes `delta` onto the source file's transform and moves the picked source
 * markers with it, so they keep annotating the geometry they were picked on.
 */
function applyDelta(host: RegistrationHost, delta: THREE.Matrix4): void {
  if (!session) {
    return;
  }
  const previous = (
    host.transformationMatrices[session.sourceIndex] ?? new THREE.Matrix4()
  ).clone();
  if (!session.undoMatrix) {
    session.undoMatrix = previous;
  }
  host.setTransformationMatrix(session.sourceIndex, delta.clone().multiply(previous));
  host.updateMatrixTextarea(session.sourceIndex);

  // If this pair belongs to the latest anchor-wide workflow, a successful
  // manual/automatic correction makes the previously failed cloud trustworthy
  // for best-camera colouring too.
  if (
    registrationState.alignmentAnchorIndex === session.targetIndex &&
    !registrationState.alignedIndices.includes(session.sourceIndex)
  ) {
    registrationState.alignedIndices = [...registrationState.alignedIndices, session.sourceIndex];
  }

  for (const pair of session.pairs) {
    pair.source.applyMatrix4(delta);
  }
  // Coarse landmarks are source-side world points like any pair's source, so
  // they have to ride along or the review that follows would draw them where
  // the geometry used to be.
  for (const point of session.coarseMoving) {
    point.applyMatrix4(delta);
  }
  if (session.pending?.onSource) {
    session.pending.point.applyMatrix4(delta);
  }
  refreshMarkers(host);
  followStations(host);
  syncState();
  host.requestRender();
}

/**
 * Moves each X3A panorama onto the station that shot it.
 *
 * A camera frame's pose is only meaningful in its own station's frame, so any
 * change to a scan's transform has to be mirrored onto its cameras or they stay
 * piled on the origin.
 */
function followStations(host: RegistrationHost): void {
  if (host.cameraGroups?.length) {
    updateStonexCameraStations(host as never);
  }
}

export function undo(host: RegistrationHost): void {
  if (!session?.undoMatrix) {
    return;
  }
  const restore = session.undoMatrix;
  const current = (host.transformationMatrices[session.sourceIndex] ?? new THREE.Matrix4()).clone();
  const delta = restore.clone().multiply(current.invert());

  host.setTransformationMatrix(session.sourceIndex, restore.clone());
  host.updateMatrixTextarea(session.sourceIndex);
  for (const pair of session.pairs) {
    pair.source.applyMatrix4(delta);
  }
  for (const point of session.coarseMoving) {
    point.applyMatrix4(delta);
  }
  if (session.pending?.onSource) {
    session.pending.point.applyMatrix4(delta);
  }
  session.undoMatrix = null;
  if (registrationState.alignmentAnchorIndex === session.targetIndex) {
    const sourceIndex = session.sourceIndex;
    registrationState.alignedIndices = registrationState.alignedIndices.filter(
      index => index !== sourceIndex
    );
  }
  registrationState.result = 'Reverted to the transform from before the last alignment.';
  refreshMarkers(host);
  syncState();
  host.requestRender();
}

export async function alignFromPairs(host: RegistrationHost): Promise<void> {
  if (!session || session.pairs.length < 3 || registrationState.busy) {
    registrationState.result = 'Pick at least three correspondences first.';
    return;
  }
  const count = session.pairs.length;
  const source = new Float32Array(count * 3);
  const target = new Float32Array(count * 3);
  session.pairs.forEach((pair, i) => {
    source[i * 3] = pair.source.x;
    source[i * 3 + 1] = pair.source.y;
    source[i * 3 + 2] = pair.source.z;
    target[i * 3] = pair.target.x;
    target[i * 3 + 1] = pair.target.y;
    target[i * 3 + 2] = pair.target.z;
  });

  registrationState.busy = true;
  try {
    const fit = await fitCorrespondences(source, target);
    if (!fit) {
      registrationState.result =
        'Those correspondences are degenerate - pick points that are not all on one line.';
      return;
    }
    applyDelta(host, fit.matrix);
    registrationState.result =
      `Fitted ${count} pairs · RMS ${(fit.rmse ?? 0).toFixed(3)} · ` +
      `worst ${(fit.maxError ?? 0).toFixed(3)}`;
  } catch (error) {
    registrationState.result = describeFailure(error);
  } finally {
    registrationState.busy = false;
  }
}

export async function applyCoarseMatch(host: RegistrationHost): Promise<void> {
  if (
    !session ||
    session.coarseFixed.length !== 3 ||
    session.coarseMoving.length !== 3 ||
    registrationState.busy
  ) {
    return;
  }
  const fixed = new Float32Array(9);
  const moving = new Float32Array(9);
  for (let index = 0; index < 3; index++) {
    fixed.set(session.coarseFixed[index].toArray(), index * 3);
    moving.set(session.coarseMoving[index].toArray(), index * 3);
  }

  registrationState.busy = true;
  try {
    const fit = await fitCorrespondences(moving, fixed);
    if (!fit) {
      registrationState.result =
        'Those coarse points are degenerate. Pick three features that are well spread out.';
      return;
    }
    applyDelta(host, fit.matrix);
    // Stop here. Coarse matching is a complete operation, and running straight
    // into fine matching hid both of the things the user needs at this moment:
    // which features they actually picked, and how far apart the three of them
    // ended up. `applyDelta` has already carried the landmarks onto their new
    // positions, so the gap to each fixed point *is* the residual.
    session.coarseResiduals = session.coarseMoving.map((point, index) =>
      point.distanceTo(session!.coarseFixed[index])
    );
    session.pairs = [];
    session.pending = null;
    registrationState.workflow = 'coarse-done';
    registrationState.picking = false;
    const worst = Math.max(...session.coarseResiduals);
    registrationState.status =
      'Coarse match applied. Check the three landmarks below, then start fine matching or redo the coarse match.';
    registrationState.result = `Coarse match applied · RMS ${(fit.rmse ?? 0).toFixed(3)} · worst ${worst.toFixed(3)}`;
    showPair(host);
    refreshMarkers(host);
    syncState();
  } catch (error) {
    registrationState.result = describeFailure(error);
  } finally {
    registrationState.busy = false;
  }
}

async function fitFinePairsLive(host: RegistrationHost): Promise<void> {
  if (!session || session.pairs.length < 3 || registrationState.busy) {
    return;
  }
  const count = session.pairs.length;
  const source = new Float32Array(count * 3);
  const target = new Float32Array(count * 3);
  session.pairs.forEach((pair, index) => {
    source.set(pair.source.toArray(), index * 3);
    target.set(pair.target.toArray(), index * 3);
  });
  registrationState.busy = true;
  try {
    const fit = await fitCorrespondences(source, target);
    if (!fit) {
      registrationState.result =
        'The fine points are degenerate. Add points that are spread across the overlap.';
      return;
    }
    applyDelta(host, fit.matrix);
    registrationState.status =
      '⌘/Ctrl + double-click another feature on the fixed cloud, or finish.';
    registrationState.result =
      `Live fit from ${count} fine pairs · RMS ${(fit.rmse ?? 0).toFixed(4)} · ` +
      `worst ${(fit.maxError ?? 0).toFixed(4)}`;
  } catch (error) {
    registrationState.result = describeFailure(error);
  } finally {
    registrationState.busy = false;
  }
}

/**
 * The one-button path: sweep yaw, then refine each shortlisted candidate and
 * keep whichever ICP actually likes.
 *
 * The candidates matter. On real archives the correct yaw regularly wins the
 * correlation by only a few percent, so committing to the top peak and
 * refining only that one lands on the wrong pose about as often as the right
 * one; letting ICP arbitrate costs a few extra seconds and settles it.
 */
/**
 * The cloud (or clouds) the solver should hold still for this session.
 *
 * Normally that is the one the panel names. With `matchAgainstAllOthers` it is
 * every other loaded cloud at once, which is the honest option when you cannot
 * say in advance which single cloud is well enough placed to be a reference —
 * a scan that overlaps the named cloud barely and its neighbour heavily gets
 * both, and the extra geometry constrains directions one cloud alone leaves
 * free.
 */
function solverTarget(host: RegistrationHost): Float32Array | null {
  if (!session) {
    return null;
  }
  if (!registrationState.matchAgainstAllOthers) {
    return worldPoints(host, session.targetIndex);
  }
  const others: number[] = [];
  for (let index = 0; index < host.spatialFiles.length; index++) {
    if (index !== session.sourceIndex && positionsOf(host.spatialFiles[index])) {
      others.push(index);
    }
  }
  return others.length > 0 ? unionPoints(host, others) : null;
}

export async function autoAlign(host: RegistrationHost): Promise<void> {
  if (!session || registrationState.busy) {
    return;
  }
  const source = worldPoints(host, session.sourceIndex);
  const target = solverTarget(host);
  if (!source || !target) {
    registrationState.result = 'Both clouds need point data.';
    return;
  }

  registrationState.busy = true;
  registrationState.status = 'Sweeping yaw...';
  // Yield once so the status reaches the screen before the sweep blocks.
  await new Promise(resolve => setTimeout(resolve, 0));
  try {
    // The solver runs in a worker, so the sweep and the candidate ICP runs no
    // longer block the viewer; there is no per-candidate callback to report
    // across that boundary, and the whole call is a few seconds.
    const result = await registerPair(source, target, {
      coarse: { upAxis: registrationState.upAxis as UpAxis },
    });
    if (!result?.coarse) {
      registrationState.result = 'Automatic alignment found nothing to match.';
      return;
    }
    applyDelta(host, result.matrix);

    const coarse = result.coarse;
    const chosen = coarse.candidates[Math.max(0, result.candidateIndex)] ?? coarse;
    const margin = coarse.runnerUpScore > 0 ? coarse.score / coarse.runnerUpScore : Infinity;
    const icp = result.icp;
    registrationState.result =
      `Yaw ${chosen.yawDegrees.toFixed(0)}° of ${result.candidatesTried} tried · ` +
      (icp
        ? `RMS ${icp.inlierRmse.toFixed(3)} · overlap ${(icp.fitness * 100).toFixed(0)}%`
        : 'coarse only') +
      (Number.isFinite(margin) && margin < 1.2
        ? ' · the yaw sweep was ambiguous here, so check the result'
        : '') +
      ` · ${registrationBackend()}`;
  } catch (error) {
    registrationState.result = describeFailure(error);
  } finally {
    registrationState.busy = false;
    registrationState.status = '';
  }
}

export async function refineIcp(host: RegistrationHost): Promise<void> {
  if (!session || registrationState.busy) {
    return;
  }
  const source = worldPoints(host, session.sourceIndex);
  const target = solverTarget(host);
  if (!source || !target) {
    registrationState.result = 'Both clouds need point data.';
    return;
  }

  registrationState.busy = true;
  registrationState.status = `Refining with ICP (${registrationBackend()})...`;
  await new Promise(resolve => setTimeout(resolve, 0));
  const startedAt = performance.now();
  try {
    const refined = await icpRefine(source, target);
    const result = refined?.icp ? { ...refined.icp, matrix: refined.matrix } : null;
    if (!result) {
      registrationState.result =
        'ICP found no correspondences - the clouds are too far apart to refine. Align coarsely first.';
      return;
    }
    // A mathematical least-squares answer is not necessarily an alignment.
    // With almost no overlap ICP can fit one accidental patch and return a
    // perfectly finite transform; applying it is what made the button appear
    // to move clouds arbitrarily. Keep the current transform and explain what
    // happened instead.
    if (result.fitness < 0.03 || result.inlierCount < 30) {
      registrationState.result =
        `ICP found only ${(result.fitness * 100).toFixed(1)}% overlap ` +
        `(${result.inlierCount.toLocaleString()} points). Align coarsely or pick pairs first.`;
      return;
    }
    applyDelta(host, result.matrix);
    const elapsed = (performance.now() - startedAt) / 1000;
    registrationState.result =
      `RMS ${result.inlierRmse.toFixed(4)} over ${result.inlierCount.toLocaleString()} points · ` +
      `overlap ${(result.fitness * 100).toFixed(0)}% · ${result.iterations} iterations` +
      (result.converged ? '' : ' (hit the iteration cap)') +
      ` · ${elapsed.toFixed(1)}s · ${registrationBackend()}`;
  } catch (error) {
    registrationState.result = describeFailure(error);
  } finally {
    registrationState.busy = false;
    registrationState.status = '';
  }
}

/**
 * Subsample a set of world-space clouds into one target for the solver.
 *
 * The union is what makes the complex mode work: a cloud with no overlap at all
 * against the reference usually overlaps something that has already been
 * placed, and once that neighbour is in the union it becomes a valid target.
 */
function unionPoints(host: RegistrationHost, indices: readonly number[]): Float32Array | null {
  const parts: Float32Array[] = [];
  let total = 0;
  for (const index of indices) {
    const points = worldPoints(host, index);
    if (points && points.length >= 3) {
      parts.push(points);
      total += points.length;
    }
  }
  if (total === 0) {
    return null;
  }
  // The solver is priced per point, so a union of eight clouds must not cost
  // eight times one cloud; stride each part down to its share of the budget.
  const budget = MAX_SOLVER_POINTS * 3;
  const stride = Math.max(1, Math.ceil(total / budget));
  const out = new Float32Array(Math.ceil(total / stride) + 3);
  let write = 0;
  for (const part of parts) {
    for (let index = 0; index + 2 < part.length && write + 2 < out.length; index += stride * 3) {
      const base = index - (index % 3);
      out[write++] = part[base];
      out[write++] = part[base + 1];
      out[write++] = part[base + 2];
    }
  }
  return write >= 3 ? out.subarray(0, write - (write % 3)) : null;
}

/**
 * Points, cheaply, for the scouting pass that runs after a failed alignment.
 *
 * This stage only has to rank candidate partners, never to place anything, so
 * it can be far coarser than a real solve — and it runs once per unattached
 * cloud per candidate, so it has to be.
 */
const SCOUT_POINTS = 50_000;

function scoutPoints(host: RegistrationHost, fileIndex: number): Float32Array | null {
  const world = worldPoints(host, fileIndex);
  if (!world) {
    return null;
  }
  const count = Math.floor(world.length / 3);
  const stride = Math.max(1, Math.ceil(count / SCOUT_POINTS));
  if (stride === 1) {
    return world;
  }
  const out = new Float32Array(Math.ceil(count / stride) * 3);
  let write = 0;
  for (let i = 0; i < count; i += stride) {
    out[write++] = world[i * 3];
    out[write++] = world[i * 3 + 1];
    out[write++] = world[i * 3 + 2];
  }
  return out.subarray(0, write);
}

/**
 * Works out what a person would have to do to rescue a failed alignment.
 *
 * When the automatic run stops, the clouds it could not attach are not a random
 * set: they are the parts of the site that never shared enough surface with
 * anything already placed. Measured across three archives, the solver places a
 * pair reliably above roughly half shared surface and essentially never below
 * a third — so the clouds left over are the ones separated by a genuinely thin
 * connection, and there are usually very few such connections.
 *
 * That makes the useful question narrow enough to answer: which unattached
 * clouds belong together, and for each of those groups, which single pair of
 * clouds is the most promising bridge to the part of the scene that is already
 * placed. One correspondence on that pair is enough to make everything else
 * follow from measurements the solver has already taken.
 */
async function analyseUnattached(
  host: RegistrationHost,
  placed: readonly number[],
  unattached: readonly number[]
): Promise<void> {
  registrationState.unattachedGroups = [];
  if (unattached.length === 0 || placed.length === 0) {
    return;
  }
  registrationState.status = 'Working out what is missing...';
  await new Promise(resolve => setTimeout(resolve, 0));

  const points = new Map<number, Float32Array>();
  for (const index of [...unattached, ...placed]) {
    const sample = scoutPoints(host, index);
    if (sample) {
      points.set(index, sample);
    }
  }
  const overlapOf = async (a: number, b: number): Promise<number> => {
    const source = points.get(a);
    const target = points.get(b);
    if (!source || !target) {
      return 0;
    }
    try {
      const result = await registerPair(source, target.slice(), {
        coarse: { upAxis: registrationState.upAxis as UpAxis, resolution: 64 },
      });
      return result?.icp?.fitness ?? 0;
    } catch {
      return 0;
    }
  };

  // Group the unattached clouds by whether they can see each other. A group is
  // rescued by one link, not one link per cloud, and saying otherwise would ask
  // for far more work than the scene needs.
  const parent = new Map(unattached.map(index => [index, index]));
  const find = (index: number): number => {
    const up = parent.get(index)!;
    if (up === index) {
      return index;
    }
    const root = find(up);
    parent.set(index, root);
    return root;
  };
  for (let i = 0; i < unattached.length; i++) {
    for (let j = i + 1; j < unattached.length; j++) {
      if ((await overlapOf(unattached[i], unattached[j])) >= 0.25) {
        parent.set(find(unattached[i]), find(unattached[j]));
      }
    }
  }

  const grouped = new Map<number, number[]>();
  for (const index of unattached) {
    const root = find(index);
    grouped.set(root, [...(grouped.get(root) ?? []), index]);
  }

  const groups: UnattachedGroup[] = [];
  for (const members of grouped.values()) {
    let best: { from: number; to: number; overlap: number } | null = null;
    for (const from of members) {
      for (const to of placed) {
        const overlap = await overlapOf(from, to);
        if (!best || overlap > best.overlap) {
          best = { from, to, overlap };
        }
      }
    }
    groups.push({
      indices: members,
      names: members.map(index => host.spatialFiles[index]?.fileName ?? `File ${index + 1}`),
      suggestion:
        best && best.overlap > 0
          ? {
              movingIndex: best.from,
              fixedIndex: best.to,
              movingName: host.spatialFiles[best.from]?.fileName ?? `File ${best.from + 1}`,
              fixedName: host.spatialFiles[best.to]?.fileName ?? `File ${best.to + 1}`,
              overlapPercent: Math.round(best.overlap * 100),
            }
          : null,
    });
  }
  registrationState.unattachedGroups = groups;
  registrationState.status = '';
}

/**
 * Minimum overlap a placement has to reach before it is applied at all.
 *
 * The old floor was 3 %, which is barely distinguishable from noise: ICP can
 * lock a tight residual onto one accidental patch and report a perfectly finite
 * transform, and on a narrow window onto a flat wall it regularly does. A cloud
 * that only manages this much against everything placed so far is better left
 * for a later sweep, when the union it is being matched to has grown.
 */
const MIN_ACCEPT_FITNESS = 0.1;

/** The original floor, kept so the nested strategy behaves as it always did. */
const LEGACY_ACCEPT_FITNESS = 0.03;

type GrowStrategy = 'nested' | 'complex';

/**
 * Overlap at which a placement is taken without looking at the alternatives.
 *
 * Scoring every remaining cloud each sweep is what makes the order stop
 * mattering, but it costs a solver run per cloud per sweep. A match this strong
 * is not going to be beaten by a cloud further down the list, so taking it
 * immediately buys the robustness back at close to the old price.
 */
const CONFIDENT_FITNESS = 0.5;

/**
 * Below this, a cloud cannot be trusted to a blind search and has to wait for a
 * neighbour to inherit from.
 *
 * Measured on a nine-scan station archive: the five clouds whose surfaces face
 * more than one way score 0.125 to 0.190, and the four dominated by a single
 * wall score 0.006 to 0.032. Nothing lands between, so the threshold does not
 * have to be delicate.
 *
 * A cloud below it is never rejected, only deferred — and placed anyway once it
 * is all that is left, because a cloud left where it started is not a better
 * answer than a cloud placed imperfectly and reported as such.
 */
const WELL_CONDITIONED_POSITION = 0.08;

/**
 * How good a placement is, for choosing between candidates.
 *
 * Overlap alone is not enough, and the archive shows why: a scan that slid half
 * a metre along a wall kept 97 % overlap while its residual nearly doubled, so
 * ranking on overlap preferred the wrong pose. Rewarding overlap while
 * penalizing residual relative to the cell it was measured at ranks the honest
 * fit above both the slid one and the one that locked onto a single patch.
 *
 * This mirrors `icp_quality` in the Rust solver, which uses it to choose
 * between starting poses; the two stages should not disagree about what good
 * means.
 */
function placementQuality(result: NonNullable<Awaited<ReturnType<typeof registerPair>>>): number {
  const icp = result.icp;
  if (!icp) {
    return 0;
  }
  const cell = result.voxelCell > 0 ? result.voxelCell : 1e-6;
  return icp.fitness / (1 + icp.inlierRmse / cell);
}

/**
 * Starting poses to offer the solver for `fileIndex`: the pose of every cloud
 * already placed, expressed as the delta that would carry this one onto it.
 *
 * Scans shot from one station share a pose exactly, so a placed neighbour's
 * transform is not merely a hint, it is frequently the answer — and the yaw
 * sweep, which searches from nothing, is exactly the stage that cannot find it
 * on a narrow window onto a flat wall. Distinct poses only: a station that
 * contributed four scans would otherwise cost four identical screening runs.
 */
function inheritedStarts(
  host: RegistrationHost,
  placed: readonly number[],
  fileIndex: number
): THREE.Matrix4[] {
  const inverse = (host.transformationMatrices[fileIndex] ?? new THREE.Matrix4()).clone().invert();
  const starts: THREE.Matrix4[] = [];
  for (const index of placed) {
    const pose = host.transformationMatrices[index] ?? new THREE.Matrix4();
    const delta = pose.clone().multiply(inverse);
    if (!starts.some(existing => sameTransform(existing, delta))) {
      starts.push(delta);
    }
  }
  return starts;
}

function sameTransform(a: THREE.Matrix4, b: THREE.Matrix4): boolean {
  for (let i = 0; i < 16; i++) {
    if (Math.abs(a.elements[i] - b.elements[i]) > 1e-6) {
      return false;
    }
  }
  return true;
}

/**
 * One more pass over everything placed, now that every station is on screen.
 *
 * Placement order is a chicken-and-egg problem the growing walk cannot escape:
 * a cloud matched early can only inherit from what happened to be placed by
 * then, and a scan whose one reliable reference is its own station-mate will be
 * guessed at if that mate comes later. On a real archive that cost exactly one
 * scan a 0.46 m slide along a wall — its sweep pose scored 50 % overlap against
 * the right pose's 49 %, so no amount of ranking would have caught it.
 *
 * So: re-solve each cloud with ICP alone from the poses of the others, and keep
 * the result only when an inherited pose wins. "Stay where you are" is one of
 * the starts, and it wins by default, so a cloud that was already right is left
 * alone and only a cloud with a genuinely better story moves.
 */
async function settlePlacements(
  host: RegistrationHost,
  anchorIndex: number,
  placed: readonly number[],
  entryFor: (fileIndex: number) => { detail: string } | undefined
): Promise<void> {
  const movable = placed.filter(index => index !== anchorIndex);
  for (let position = 0; position < movable.length; position++) {
    const fileIndex = movable[position];
    const name = host.spatialFiles[fileIndex]?.fileName ?? `File ${fileIndex + 1}`;
    registrationState.status = `Settling ${position + 1} of ${movable.length} · ${name}...`;
    await new Promise(resolve => setTimeout(resolve, 0));

    const others = placed.filter(index => index !== fileIndex);
    const target = unionPoints(host, others);
    const source = worldPoints(host, fileIndex);
    if (!target || !source) {
      continue;
    }
    let result: Awaited<ReturnType<typeof registerPair>> = null;
    try {
      // No yaw sweep: this is a correction, not a search, and the sweep is the
      // stage that put the cloud where it is.
      result = await registerPair(source, target, {
        coarse: false,
        extraStarts: inheritedStarts(host, others, fileIndex),
      });
    } catch {
      continue;
    }
    if (!result?.icp || result.startedFrom !== 'given') {
      continue;
    }
    const previous = (host.transformationMatrices[fileIndex] ?? new THREE.Matrix4()).clone();
    host.setTransformationMatrix(fileIndex, result.matrix.clone().multiply(previous));
    host.updateMatrixTextarea(fileIndex);
    const entry = entryFor(fileIndex);
    if (entry) {
      entry.detail =
        `RMS ${result.icp.inlierRmse.toFixed(3)} · overlap ${(result.icp.fitness * 100).toFixed(0)}%` +
        ' · settled onto a placed scan';
    }
    host.requestRender();
  }
  registrationState.status = '';
}

/**
 * Complex-scene alignment: grow outward from the anchor instead of matching
 * everything to it.
 *
 * The star arrangement the simple mode uses assumes every cloud overlaps the
 * reference and is comparable to it. Neither holds on a real site: a reference
 * that is coarse but wide matches a dense local scan badly, and a cloud at the
 * far end of a corridor may share nothing with the reference while sharing
 * plenty with its neighbour.
 *
 * So this places what it can, adds it to the target, and tries again. Each
 * sweep attempts every unplaced cloud against the union of everything placed so
 * far; a sweep that places nothing ends the run. The cost is that a cloud can be
 * attempted several times — this mode is opt-in for that reason — and the
 * benefit is that the order stops mattering: a cloud only has to overlap
 * *something* already placed, not the reference in particular.
 *
 * Which cloud goes next is the decision that turned out to matter most. Taking
 * whichever one first scraped past the gate made the outcome depend on file
 * order: a marginal cloud placed early poisons the union that every later cloud
 * is matched against, and on a nine-scan archive that was the difference
 * between two clouds landing a metre out and none. So a sweep scores every
 * remaining cloud and places the best, short-circuiting as soon as one is
 * clearly good enough that nothing else could beat it.
 *
 * One-step undo still covers the whole run, and a cloud that never attaches is
 * reported rather than left silently wherever it was.
 */
async function growFromAnchor(
  host: RegistrationHost,
  anchorIndex: number,
  targets: readonly number[],
  anchor: Float32Array,
  startedAt: number,
  strategy: GrowStrategy
): Promise<void> {
  // 'nested' is the original walk: take the first cloud that clears a low bar,
  // and give the solver nothing but the yaw sweep to go on. 'complex' scores
  // every remaining cloud before committing and offers the solver the poses of
  // the clouds already placed. Measured against ground truth on a nine-scan
  // station archive the second placed every cloud from every anchor tried; the
  // first left two of nine a metre out.
  const rank = strategy === 'complex';
  const acceptFitness = rank ? MIN_ACCEPT_FITNESS : LEGACY_ACCEPT_FITNESS;
  let matchingMs = 0;
  let applyMs = 0;
  let sampledPoints = anchor.length / 3;
  let aligned = 0;
  let sweeps = 0;

  registrationState.busy = true;
  registrationState.alignEntries = targets.map(index => ({
    index,
    name: host.spatialFiles[index]?.fileName ?? `File ${index + 1}`,
    state: 'queued' as const,
    detail: '',
  }));
  registrationState.alignDone = 0;
  registrationState.alignmentAnchorIndex = anchorIndex;
  registrationState.alignedIndices = [anchorIndex];
  await new Promise(resolve => setTimeout(resolve, 0));

  const undoAll = new Map<number, THREE.Matrix4>();
  const placed = [anchorIndex];
  const remaining = new Set(targets);
  // How many passes each cloud was tried in before it stuck. A cloud that took
  // several is one whose placement leaned on clouds placed after it was first
  // considered, which is worth seeing next to its overlap.
  const attempts = new Map<number, number>();
  const entryFor = (fileIndex: number) =>
    registrationState.alignEntries.find(entry => entry.index === fileIndex);

  try {
    let progress = true;
    while (progress && remaining.size > 0) {
      progress = false;
      sweeps++;
      const target = unionPoints(host, placed);
      if (!target) {
        break;
      }
      type Scored = {
        fileIndex: number;
        result: NonNullable<Awaited<ReturnType<typeof registerPair>>>;
        trustworthy: boolean;
      };
      const scored: Scored[] = [];

      for (const fileIndex of [...remaining]) {
        const name = host.spatialFiles[fileIndex]?.fileName ?? `File ${fileIndex + 1}`;
        const entry = entryFor(fileIndex);
        if (entry) {
          entry.state = 'running';
        }
        // Each pass places exactly one cloud, so the run is at most one pass
        // per target and the total is knowable up front. "Sweep 7" on its own
        // says nothing about how much is left.
        registrationState.status =
          `Placing ${placed.length} of ${targets.length} · trying ${name} against ` +
          `${placed.length} placed cloud${placed.length === 1 ? '' : 's'}...`;
        await new Promise(resolve => setTimeout(resolve, 0));

        attempts.set(fileIndex, (attempts.get(fileIndex) ?? 0) + 1);
        const source = worldPoints(host, fileIndex);
        if (!source) {
          remaining.delete(fileIndex);
          if (entry) {
            entry.state = 'failed';
            entry.detail = 'no point data';
          }
          registrationState.alignDone = targets.length - remaining.size;
          continue;
        }
        sampledPoints += source.length / 3;

        let result: Awaited<ReturnType<typeof registerPair>> = null;
        const matchStarted = performance.now();
        try {
          result = await registerPair(source, target.slice(), {
            coarse: { upAxis: registrationState.upAxis as UpAxis },
            extraStarts: rank ? inheritedStarts(host, placed, fileIndex) : undefined,
          });
        } catch (error) {
          if (entry) {
            entry.state = 'queued';
            entry.detail = describeFailure(error);
          }
        } finally {
          matchingMs += performance.now() - matchStarted;
        }

        if (!result?.icp || result.icp.fitness < acceptFitness || result.icp.inlierCount < 30) {
          // Not failed — just not yet. The union grows with every placement, so
          // the same cloud may match on a later sweep.
          if (entry) {
            entry.state = 'queued';
            entry.detail = result?.icp
              ? `${(result.icp.fitness * 100).toFixed(1)}% overlap so far`
              : 'no match yet';
          }
          continue;
        }

        // A cloud that cannot feel its own position goes last. Left to the
        // sweep it slides along its wall, and its overlap rises as it does, so
        // ranking on score alone actively prefers the wrong pose. Waiting costs
        // a sweep and usually buys an inherited pose that is exactly right.
        const trustworthy =
          result.startedFrom === 'given' || result.sourceConditioning >= WELL_CONDITIONED_POSITION;
        scored.push({ fileIndex, result, trustworthy });
        if (entry) {
          entry.state = 'queued';
          entry.detail = trustworthy
            ? `${(result.icp.fitness * 100).toFixed(0)}% overlap`
            : `${(result.icp.fitness * 100).toFixed(0)}% overlap · could slide, waiting`;
        }
        // Nested commits to the first cloud over the bar, which is what makes
        // it cheap and what makes its outcome depend on file order.
        if (!rank || (trustworthy && result.icp.fitness >= CONFIDENT_FITNESS)) {
          break;
        }
      }

      if (scored.length > 0) {
        // Best overlap wins. RMS is deliberately not in the comparison: a wrong
        // pose that locked onto one small patch has an excellent RMS, and that
        // is the failure this ordering exists to avoid.
        scored.sort(
          (a, b) =>
            Number(b.trustworthy) - Number(a.trustworthy) ||
            placementQuality(b.result) - placementQuality(a.result)
        );
        const { fileIndex, result } = scored[0];
        const entry = entryFor(fileIndex);

        const applyStarted = performance.now();
        const previous = (host.transformationMatrices[fileIndex] ?? new THREE.Matrix4()).clone();
        undoAll.set(fileIndex, previous);
        host.setTransformationMatrix(fileIndex, result.matrix.clone().multiply(previous));
        host.updateMatrixTextarea(fileIndex);
        applyMs += performance.now() - applyStarted;

        placed.push(fileIndex);
        remaining.delete(fileIndex);
        aligned++;
        progress = true;
        registrationState.alignedIndices = [...registrationState.alignedIndices, fileIndex];
        registrationState.alignDone = targets.length - remaining.size;
        if (entry) {
          entry.state = 'aligned';
          entry.detail =
            `RMS ${result.icp!.inlierRmse.toFixed(3)} · overlap ${(result.icp!.fitness * 100).toFixed(0)}%` +
            (result.startedFrom === 'given' ? ' · from a placed scan' : '') +
            ((attempts.get(fileIndex) ?? 1) > 1 ? ` · ${attempts.get(fileIndex)} tries` : '') +
            (result.sourceConditioning < WELL_CONDITIONED_POSITION ? ' · could slide' : '');
        }
        host.requestRender();
      }
    }

    for (const fileIndex of remaining) {
      const entry = entryFor(fileIndex);
      if (entry) {
        entry.state = 'failed';
        entry.detail = entry.detail || 'never overlapped anything placed';
      }
    }
    registrationState.alignDone = targets.length;

    // A list of failures is not actionable. Which groups they form, and which
    // single pair would join each one back to the scene, is.
    if (remaining.size > 0) {
      await analyseUnattached(host, placed, [...remaining]);
    }

    if (rank && placed.length > 2) {
      await settlePlacements(host, anchorIndex, placed, entryFor);
    }

    if (undoAll.size > 0) {
      alignAllUndo = undoAll;
      registrationState.canUndoAll = true;
    }
    registrationState.result = `Placed ${aligned} of ${targets.length} clouds in ${sweeps} sweep${sweeps === 1 ? '' : 's'} · ${registrationBackend()}`;
  } finally {
    const followStarted = performance.now();
    followStations(host);
    applyMs += performance.now() - followStarted;
    registrationState.busy = false;
    registrationState.status = '';
    host.requestRender();
    const totalMs = performance.now() - startedAt;
    const anchorName = host.spatialFiles[anchorIndex]?.fileName ?? `file ${anchorIndex + 1}`;
    perfLog(
      `⏱️ PERF[registration/align-all-${strategy} ${anchorName}] ` +
        `match ${matchingMs.toFixed(1)}ms · apply ${applyMs.toFixed(1)}ms | ` +
        `total ${totalMs.toFixed(1)}ms  (${aligned}/${targets.length} clouds · ${sweeps} sweeps · ` +
        `${Math.round(sampledPoints).toLocaleString()} sampled pts · ${registrationBackend()})`
    );
  }
}

/**
 * Aligns every other loaded cloud onto one anchor.
 *
 * A star, not a chain: each cloud is registered directly against the anchor
 * rather than against its predecessor, so one bad pair cannot drag everything
 * after it out of place. The cost is that clouds sharing little overlap with
 * the anchor may fail where a chain would have walked them in — those are
 * reported rather than silently left wherever they landed, and the per-file
 * panel is still there to fix one by hand.
 *
 * The anchor keeps its own transform, so whatever frame it is already in
 * becomes the common frame.
 *
 * `refineOnly` skips the yaw sweep and runs ICP alone from wherever each cloud
 * currently sits. That is the right mode for an archive whose scans arrive
 * roughly placed, or for a second pass after a hand correction: it is far
 * cheaper, and it cannot re-derive a coarse hypothesis that throws away a
 * placement the user already trusts. It is the wrong mode for clouds that are
 * still far apart — ICP alone has no way back from that.
 */
export async function alignAllTo(
  host: RegistrationHost,
  anchorIndex: number,
  options: { refineOnly?: boolean; nested?: boolean; complex?: boolean } = {}
): Promise<void> {
  if (registrationState.busy) {
    return;
  }
  const refineOnly = options.refineOnly === true;
  // A suggestion from a previous run describes a scene that no longer exists.
  registrationState.unattachedGroups = [];
  // Two flavours of the growing strategy. `nested` is the original one, kept
  // because it is cheap and was what the archive-colouring workflow was tuned
  // against; `complex` is the same walk with the ordering and the extra
  // starting poses that a nine-scan station archive needed.
  const strategy: GrowStrategy | null = options.complex
    ? 'complex'
    : options.nested
      ? 'nested'
      : null;
  const startedAt = performance.now();
  let setupMs = 0;
  let samplingMs = 0;
  let matchingMs = 0;
  let applyMs = 0;
  let sampledPoints = 0;
  let aligned = 0;
  const targets = registrationCandidates(host, anchorIndex);
  if (targets.length === 0) {
    registrationState.result = 'Nothing else is loaded to align.';
    return;
  }

  const anchor = worldPoints(host, anchorIndex);
  if (!anchor) {
    registrationState.result = 'The anchor cloud has no point data.';
    return;
  }
  sampledPoints += anchor.length / 3;
  setupMs = performance.now() - startedAt;

  if (strategy && !refineOnly) {
    await growFromAnchor(host, anchorIndex, targets, anchor, startedAt, strategy);
    return;
  }

  registrationState.busy = true;
  // Seed every target as queued before the first solve, so the panel shows the
  // whole run up front instead of a list that grows out of nothing.
  registrationState.alignEntries = targets.map(index => ({
    index,
    name: host.spatialFiles[index]?.fileName ?? `File ${index + 1}`,
    state: 'queued' as const,
    detail: '',
  }));
  registrationState.alignDone = 0;
  registrationState.alignmentAnchorIndex = anchorIndex;
  registrationState.alignedIndices = [anchorIndex];
  // Yield once so the panel shows the first status before the solver blocks
  // (it does, in a webview: see wasmLoader.browser.ts).
  await new Promise(resolve => setTimeout(resolve, 0));

  const undoAll = new Map<number, THREE.Matrix4>();
  try {
    for (let position = 0; position < targets.length; position++) {
      const fileIndex = targets[position];
      const name = host.spatialFiles[fileIndex]?.fileName ?? `File ${fileIndex + 1}`;
      const finish = (state: 'aligned' | 'failed', detail: string) => {
        const entry = registrationState.alignEntries[position];
        if (entry) {
          entry.state = state;
          entry.detail = detail;
        }
        registrationState.alignDone = position + 1;
      };
      const running = registrationState.alignEntries[position];
      if (running) {
        running.state = 'running';
      }
      registrationState.status = `${refineOnly ? 'Refining' : 'Aligning'} ${name} (${
        position + 1
      }/${targets.length})...`;
      await new Promise(resolve => setTimeout(resolve, 0));

      const samplingStarted = performance.now();
      const source = worldPoints(host, fileIndex);
      samplingMs += performance.now() - samplingStarted;
      if (!source) {
        finish('failed', 'no point data');
        continue;
      }
      sampledPoints += source.length / 3;

      try {
        // A fresh copy of the anchor each time: the worker path transfers the
        // buffers it is given, so a shared one would be detached after the
        // first pair.
        const matchingStarted = performance.now();
        let result: Awaited<ReturnType<typeof registerPair>>;
        try {
          result = await registerPair(source, anchor.slice(), {
            coarse: refineOnly ? false : { upAxis: registrationState.upAxis as UpAxis },
          });
        } finally {
          matchingMs += performance.now() - matchingStarted;
        }
        if (!result?.icp) {
          finish('failed', refineOnly ? 'nothing to refine against' : 'no match found');
          continue;
        }
        if (result.icp.fitness < 0.03 || result.icp.inlierCount < 30) {
          finish('failed', `only ${(result.icp.fitness * 100).toFixed(1)}% overlap; excluded`);
          continue;
        }

        const applyStarted = performance.now();
        const previous = (host.transformationMatrices[fileIndex] ?? new THREE.Matrix4()).clone();
        undoAll.set(fileIndex, previous);
        host.setTransformationMatrix(fileIndex, result.matrix.clone().multiply(previous));
        host.updateMatrixTextarea(fileIndex);
        aligned++;
        registrationState.alignedIndices = [...registrationState.alignedIndices, fileIndex];
        applyMs += performance.now() - applyStarted;

        const margin =
          result.coarse && result.coarse.runnerUpScore > 0
            ? result.coarse.score / result.coarse.runnerUpScore
            : Infinity;
        finish(
          'aligned',
          `RMS ${result.icp.inlierRmse.toFixed(3)} · overlap ${(result.icp.fitness * 100).toFixed(0)}%` +
            (Number.isFinite(margin) && margin < 1.2 ? ' · ambiguous, check it' : '')
        );
      } catch (error) {
        finish('failed', describeFailure(error));
      }
      host.requestRender();
    }

    if (undoAll.size > 0) {
      alignAllUndo = undoAll;
      registrationState.canUndoAll = true;
    }
    registrationState.result = `${refineOnly ? 'Refined' : 'Aligned'} ${aligned} of ${
      targets.length
    } clouds to ${
      host.spatialFiles[anchorIndex]?.fileName ?? 'the anchor'
    } · ${registrationBackend()}`;
  } finally {
    const followStarted = performance.now();
    followStations(host);
    applyMs += performance.now() - followStarted;
    registrationState.busy = false;
    registrationState.status = '';
    host.requestRender();
    const totalMs = performance.now() - startedAt;
    const overheadMs = Math.max(0, totalMs - setupMs - samplingMs - matchingMs - applyMs);
    const anchorName = host.spatialFiles[anchorIndex]?.fileName ?? `file ${anchorIndex + 1}`;
    perfLog(
      `⏱️ PERF[registration/${refineOnly ? 'refine-all' : 'align-all'} ${anchorName}] ` +
        `setup ${setupMs.toFixed(1)}ms · ` +
        `sample ${samplingMs.toFixed(1)}ms · match ${matchingMs.toFixed(1)}ms · ` +
        `apply ${applyMs.toFixed(1)}ms · UI/overhead ${overheadMs.toFixed(1)}ms | ` +
        `total ${totalMs.toFixed(1)}ms  (${aligned}/${targets.length} clouds · ` +
        `${Math.round(sampledPoints).toLocaleString()} sampled pts · ${registrationBackend()})`
    );
  }
}

/** Transforms replaced by the last `alignAllTo`, for a single-step undo. */
let alignAllUndo: Map<number, THREE.Matrix4> | null = null;

export function undoAlignAll(host: RegistrationHost): void {
  if (!alignAllUndo) {
    return;
  }
  for (const [fileIndex, matrix] of alignAllUndo) {
    host.setTransformationMatrix(fileIndex, matrix.clone());
    host.updateMatrixTextarea(fileIndex);
  }
  followStations(host);
  alignAllUndo = null;
  registrationState.canUndoAll = false;
  registrationState.alignEntries = [];
  registrationState.alignDone = 0;
  registrationState.alignmentAnchorIndex = null;
  registrationState.alignedIndices = [];
  registrationState.result = 'Reverted every transform that align-all changed.';
  host.requestRender();
}
