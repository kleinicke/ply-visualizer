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
  refreshMarkers(host);
  syncState();
}

export function removeLastPair(host: RegistrationHost): void {
  if (!session) {
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
  if (!registrationState.picking) {
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
    // The coarse landmarks have done their job. The transform stays, but the
    // fine solve starts with a clean correspondence set so approximate points
    // cannot dilute the precise ones that follow.
    session.coarseFixed = [];
    session.coarseMoving = [];
    session.pairs = [];
    session.pending = null;
    registrationState.workflow = 'fine-fixed';
    registrationState.picking = true;
    registrationState.status =
      'Fine match — ⌘/Ctrl + double-click a distinctive feature on the fixed cloud.';
    registrationState.result = `Coarse match applied · RMS ${(fit.rmse ?? 0).toFixed(3)}`;
    showFixed(host);
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
export async function autoAlign(host: RegistrationHost): Promise<void> {
  if (!session || registrationState.busy) {
    return;
  }
  const source = worldPoints(host, session.sourceIndex);
  const target = worldPoints(host, session.targetIndex);
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
  const target = worldPoints(host, session.targetIndex);
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
 * One-step undo still covers the whole run, and a cloud that never attaches is
 * reported rather than left silently wherever it was.
 */
async function growFromAnchor(
  host: RegistrationHost,
  anchorIndex: number,
  targets: readonly number[],
  anchor: Float32Array,
  startedAt: number
): Promise<void> {
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
      for (const fileIndex of [...remaining]) {
        const name = host.spatialFiles[fileIndex]?.fileName ?? `File ${fileIndex + 1}`;
        const entry = entryFor(fileIndex);
        if (entry) {
          entry.state = 'running';
        }
        registrationState.status = `Sweep ${sweeps} · matching ${name} against ${placed.length} placed cloud${placed.length === 1 ? '' : 's'}...`;
        await new Promise(resolve => setTimeout(resolve, 0));

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
          });
        } catch (error) {
          if (entry) {
            entry.state = 'queued';
            entry.detail = describeFailure(error);
          }
        } finally {
          matchingMs += performance.now() - matchStarted;
        }

        if (!result?.icp || result.icp.fitness < 0.03 || result.icp.inlierCount < 30) {
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
            `RMS ${result.icp.inlierRmse.toFixed(3)} · overlap ${(result.icp.fitness * 100).toFixed(0)}%` +
            (sweeps > 1 ? ` · sweep ${sweeps}` : '');
        }
        host.requestRender();
        break; // The union changed; restart the sweep against the bigger target.
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
      `⏱️ PERF[registration/align-all-complex ${anchorName}] ` +
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
  options: { refineOnly?: boolean; complex?: boolean } = {}
): Promise<void> {
  if (registrationState.busy) {
    return;
  }
  const refineOnly = options.refineOnly === true;
  const complex = options.complex === true;
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

  if (complex && !refineOnly) {
    await growFromAnchor(host, anchorIndex, targets, anchor, startedAt);
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
