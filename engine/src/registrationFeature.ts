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
  /** X3A camera profiles, so panoramas follow the scans they were shot from. */
  cameraGroups?: THREE.Group[];
  setTransformationMatrix(fileIndex: number, matrix: THREE.Matrix4): void;
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
  pending: { point: THREE.Vector3; onSource: boolean } | null;
  /** Transform of the source file before this session touched it. */
  undoMatrix: THREE.Matrix4 | null;
  markers: THREE.Group | null;
  /** Cached once per session; the scene's scale does not change under it. */
  markerRadius: number | null;
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
    pending: null,
    undoMatrix: null,
    markers: null,
    markerRadius: null,
  };
  registrationState.status = '';
  registrationState.result = '';
  syncState();
}

export function endSession(host: RegistrationHost): void {
  if (session?.markers) {
    host.scene.remove(session.markers);
    disposeMarkers(session.markers);
  }
  session = null;
  registrationState.picking = false;
  syncState();
  host.requestRender();
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
  refreshMarkers(host);
  syncState();
}

export function removeLastPair(host: RegistrationHost): void {
  if (!session) {
    return;
  }
  if (session.pending) {
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
  return session.markerRadius;
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

  const group = new THREE.Group();
  group.name = 'registration-correspondences';
  // Markers sit on top of the geometry they annotate; without this they hide
  // inside the very surface the user is trying to aim at.
  const sphere = new THREE.SphereGeometry(markerRadius(host), 12, 8);
  const sourceMaterial = new THREE.MeshBasicMaterial({ color: 0xff8c1a, depthTest: false });
  const targetMaterial = new THREE.MeshBasicMaterial({ color: 0x2ad4ff, depthTest: false });
  const pendingMaterial = new THREE.MeshBasicMaterial({ color: 0xffe066, depthTest: false });
  const lineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, depthTest: false });

  const linePoints: number[] = [];
  for (const pair of session.pairs) {
    const source = new THREE.Mesh(sphere, sourceMaterial);
    source.position.copy(pair.source);
    source.renderOrder = 999;
    group.add(source);

    const target = new THREE.Mesh(sphere, targetMaterial);
    target.position.copy(pair.target);
    target.renderOrder = 999;
    group.add(target);

    linePoints.push(pair.source.x, pair.source.y, pair.source.z);
    linePoints.push(pair.target.x, pair.target.y, pair.target.z);
  }
  if (session.pending) {
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
  registrationState.status = 'Refining...';
  await new Promise(resolve => setTimeout(resolve, 0));
  try {
    const refined = await icpRefine(source, target);
    const result = refined?.icp ? { ...refined.icp, matrix: refined.matrix } : null;
    if (!result) {
      registrationState.result =
        'ICP found no correspondences - the clouds are too far apart to refine. Align coarsely first.';
      return;
    }
    applyDelta(host, result.matrix);
    registrationState.result =
      `RMS ${result.inlierRmse.toFixed(4)} over ${result.inlierCount.toLocaleString()} points · ` +
      `overlap ${(result.fitness * 100).toFixed(0)}% · ${result.iterations} iterations` +
      (result.converged ? '' : ' (hit the iteration cap)');
  } catch (error) {
    registrationState.result = describeFailure(error);
  } finally {
    registrationState.busy = false;
    registrationState.status = '';
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
 */
export async function alignAllTo(host: RegistrationHost, anchorIndex: number): Promise<void> {
  if (registrationState.busy) {
    return;
  }
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

  registrationState.busy = true;
  registrationState.alignAllResults = [];
  // Yield once so the panel shows the first status before the solver blocks
  // (it does, in a webview: see wasmLoader.browser.ts).
  await new Promise(resolve => setTimeout(resolve, 0));

  const undoAll = new Map<number, THREE.Matrix4>();
  let aligned = 0;
  try {
    for (let position = 0; position < targets.length; position++) {
      const fileIndex = targets[position];
      const name = host.spatialFiles[fileIndex]?.fileName ?? `File ${fileIndex + 1}`;
      registrationState.status = `Aligning ${name} (${position + 1}/${targets.length})...`;
      await new Promise(resolve => setTimeout(resolve, 0));

      const source = worldPoints(host, fileIndex);
      if (!source) {
        registrationState.alignAllResults.push(`${name}: no point data`);
        continue;
      }

      try {
        // A fresh copy of the anchor each time: the worker path transfers the
        // buffers it is given, so a shared one would be detached after the
        // first pair.
        const result = await registerPair(source, anchor.slice(), {
          coarse: { upAxis: registrationState.upAxis as UpAxis },
        });
        if (!result?.icp) {
          registrationState.alignAllResults.push(`${name}: no match found`);
          continue;
        }

        const previous = (host.transformationMatrices[fileIndex] ?? new THREE.Matrix4()).clone();
        undoAll.set(fileIndex, previous);
        host.setTransformationMatrix(fileIndex, result.matrix.clone().multiply(previous));
        host.updateMatrixTextarea(fileIndex);
        aligned++;

        const margin =
          result.coarse && result.coarse.runnerUpScore > 0
            ? result.coarse.score / result.coarse.runnerUpScore
            : Infinity;
        registrationState.alignAllResults.push(
          `${name}: RMS ${result.icp.inlierRmse.toFixed(3)} · ` +
            `overlap ${(result.icp.fitness * 100).toFixed(0)}%` +
            (Number.isFinite(margin) && margin < 1.2 ? ' · ambiguous, check it' : '')
        );
      } catch (error) {
        registrationState.alignAllResults.push(`${name}: ${describeFailure(error)}`);
      }
      host.requestRender();
    }

    followStations(host);
    if (undoAll.size > 0) {
      alignAllUndo = undoAll;
      registrationState.canUndoAll = true;
    }
    registrationState.result = `Aligned ${aligned} of ${targets.length} clouds to ${
      host.spatialFiles[anchorIndex]?.fileName ?? 'the anchor'
    } · ${registrationBackend()}`;
  } finally {
    registrationState.busy = false;
    registrationState.status = '';
    host.requestRender();
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
  registrationState.alignAllResults = [];
  registrationState.result = 'Reverted every transform that align-all changed.';
  host.requestRender();
}
