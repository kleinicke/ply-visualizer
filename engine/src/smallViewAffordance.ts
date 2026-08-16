import * as THREE from 'three';
import type { SpatialData } from './interfaces';
import { smallViewState } from './state/smallView.svelte';
import { shouldShowSmallView } from './smallViewThresholds';
import { robustPointBounds } from './visualization/robustBounds';

export const SMALL_VIEW_APPEAR_DELAY_MS = 500;
export const SMALL_VIEW_MIN_DISTANCE_RATIO = 1.5;

interface SmallViewHost {
  camera: THREE.PerspectiveCamera;
  spatialFiles: SpatialData[];
  meshes: (THREE.Mesh | THREE.Points | THREE.LineSegments)[];
  fileVisibility: boolean[];
  isFileLoading: boolean;
}

/** Detects a compact, distant, on-screen point cloud and drives the fit button. */
export class SmallViewAffordance {
  private readonly boundsCache = new WeakMap<SpatialData, THREE.Box3 | null>();
  private appearTimer: number | null = null;

  constructor(private readonly host: SmallViewHost) {}

  update(): void {
    const coverage = this.projectedCoverage();
    const isSmall = shouldShowSmallView(coverage, smallViewState.visible);
    smallViewState.coverage = coverage ?? 0;

    if (!isSmall) {
      this.cancelPending();
      smallViewState.visible = false;
      return;
    }
    if (smallViewState.visible || this.appearTimer !== null) {return;}

    this.appearTimer = window.setTimeout(() => {
      this.appearTimer = null;
      const currentCoverage = this.projectedCoverage();
      smallViewState.coverage = currentCoverage ?? 0;
      smallViewState.visible = shouldShowSmallView(currentCoverage, false);
    }, SMALL_VIEW_APPEAR_DELAY_MS);
  }

  hide(): void {
    this.cancelPending();
    smallViewState.visible = false;
  }

  private cancelPending(): void {
    if (this.appearTimer !== null) {
      clearTimeout(this.appearTimer);
      this.appearTimer = null;
    }
  }

  /** Null means intentional/no-data emptiness and suppresses the prompt. */
  private projectedCoverage(): number | null {
    if (this.host.isFileLoading || this.host.spatialFiles.length === 0) {return null;}

    const worldBounds = new THREE.Box3();
    let visibleClouds = 0;
    for (let index = 0; index < this.host.spatialFiles.length; index++) {
      const mesh = this.host.meshes[index];
      if (
        !(mesh instanceof THREE.Points) ||
        !mesh.visible ||
        this.host.fileVisibility[index] === false
      ) {
        continue;
      }
      const localBounds = this.boundsFor(this.host.spatialFiles[index], mesh.geometry);
      if (!localBounds) {continue;}
      mesh.updateWorldMatrix(true, false);
      worldBounds.union(localBounds.clone().applyMatrix4(mesh.matrixWorld));
      visibleClouds++;
    }
    if (visibleClouds === 0 || worldBounds.isEmpty()) {return null;}

    this.host.camera.updateMatrixWorld();
    const diagonal = worldBounds.getSize(_boundsSize).length();
    const distanceToBounds = worldBounds.distanceToPoint(this.host.camera.position);
    // A sparse cloud surrounding (or merely close to) the camera is not a tiny
    // object in the distance, even if its projected box corners are misleading.
    if (diagonal <= 1e-9 || distanceToBounds <= diagonal * SMALL_VIEW_MIN_DISTANCE_RATIO) {
      return null;
    }

    worldBounds.getCenter(_boundsCenter);
    _projected.copy(_boundsCenter).project(this.host.camera);
    if (
      Math.abs(_projected.x) > 1 ||
      Math.abs(_projected.y) > 1 ||
      _projected.z < -1 ||
      _projected.z > 1
    ) {
      return null;
    }

    const corners = boxCorners(worldBounds);
    let frontCorners = 0;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let nearestDepth = Infinity;
    for (const corner of corners) {
      _cameraPoint.copy(corner).applyMatrix4(this.host.camera.matrixWorldInverse);
      nearestDepth = Math.min(nearestDepth, -_cameraPoint.z);
      if (_cameraPoint.z >= -this.host.camera.near) {continue;}
      frontCorners++;
      _projected.copy(corner).project(this.host.camera);
      minX = Math.min(minX, _projected.x);
      minY = Math.min(minY, _projected.y);
      maxX = Math.max(maxX, _projected.x);
      maxY = Math.max(maxY, _projected.y);
    }

    if (frontCorners !== corners.length || nearestDepth >= this.host.camera.far) {return null;}

    const width = Math.max(0, Math.min(1, maxX) - Math.max(-1, minX));
    const height = Math.max(0, Math.min(1, maxY) - Math.max(-1, minY));
    if (width === 0 || height === 0) {return null;}
    return (width * height) / 4;
  }

  private boundsFor(data: SpatialData, geometry: THREE.BufferGeometry): THREE.Box3 | null {
    if (this.boundsCache.has(data)) {return this.boundsCache.get(data) ?? null;}
    let bounds = data.positionsArray ? robustPointBounds(data.positionsArray) : null;
    if (!bounds) {
      if (!geometry.boundingBox) {geometry.computeBoundingBox();}
      bounds = geometry.boundingBox?.clone() ?? null;
    }
    this.boundsCache.set(data, bounds);
    return bounds;
  }
}

function boxCorners(box: THREE.Box3): THREE.Vector3[] {
  const { min, max } = box;
  return [
    new THREE.Vector3(min.x, min.y, min.z),
    new THREE.Vector3(max.x, min.y, min.z),
    new THREE.Vector3(min.x, max.y, min.z),
    new THREE.Vector3(max.x, max.y, min.z),
    new THREE.Vector3(min.x, min.y, max.z),
    new THREE.Vector3(max.x, min.y, max.z),
    new THREE.Vector3(min.x, max.y, max.z),
    new THREE.Vector3(max.x, max.y, max.z),
  ];
}

const _cameraPoint = new THREE.Vector3();
const _projected = new THREE.Vector3();
const _boundsCenter = new THREE.Vector3();
const _boundsSize = new THREE.Vector3();
