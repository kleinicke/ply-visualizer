import * as THREE from 'three';
import type { SpatialData } from '../interfaces';
import type { ViewerRenderer } from '../rendering/viewerRenderer';

interface ClipEntry {
  data?: SpatialData;
  bounds?: THREE.Box3;
  mode: 'volume' | 'bounds';
  ranges: Array<[number, number]>;
  transform: THREE.Matrix4;
}

/** Maintains slice-index clipping ranges and publishes them as global planes. */
export class SectionPlaneManager {
  private renderer: ViewerRenderer | null = null;
  private entries = new Map<number, ClipEntry>();

  attachRenderer(renderer: ViewerRenderer): void {
    this.renderer = renderer;
    this.publish();
  }

  getRange(fileIndex: number, axis: number, size: number): [number, number] {
    return this.entries.get(fileIndex)?.ranges[axis] ?? [0, Math.max(0, size - 1)];
  }

  getBoundsRange(fileIndex: number, axis: number): [number, number] {
    const entry = this.entries.get(fileIndex);
    return entry?.mode === 'bounds' ? entry.ranges[axis] : [0, 100];
  }

  setVolumeRange(
    fileIndex: number,
    data: SpatialData,
    axis: number,
    lower: number,
    upper: number,
    transform: THREE.Matrix4
  ): void {
    const sizes = data.metadata?.volumeSizes as number[] | undefined;
    if (!sizes || axis < 0 || axis > 2) {return;}
    const max = Math.max(0, sizes[axis] - 1);
    const range: [number, number] = [
      Math.max(0, Math.min(max, Math.min(lower, upper))),
      Math.max(0, Math.min(max, Math.max(lower, upper))),
    ];
    const entry = this.entries.get(fileIndex) ?? {
      data,
      mode: 'volume' as const,
      ranges: sizes.map(size => [0, Math.max(0, size - 1)] as [number, number]),
      transform: transform.clone(),
    };
    entry.data = data;
    entry.mode = 'volume';
    entry.ranges[axis] = range;
    entry.transform.copy(transform);
    this.entries.set(fileIndex, entry);
    this.publish();
  }

  setBoundsRange(
    fileIndex: number,
    bounds: THREE.Box3,
    axis: number,
    lowerPercent: number,
    upperPercent: number,
    transform: THREE.Matrix4
  ): void {
    if (bounds.isEmpty() || axis < 0 || axis > 2) {return;}
    const range: [number, number] = [
      Math.max(0, Math.min(100, Math.min(lowerPercent, upperPercent))),
      Math.max(0, Math.min(100, Math.max(lowerPercent, upperPercent))),
    ];
    const entry = this.entries.get(fileIndex) ?? {
      mode: 'bounds' as const,
      bounds: bounds.clone(),
      ranges: [
        [0, 100],
        [0, 100],
        [0, 100],
      ] as Array<[number, number]>,
      transform: transform.clone(),
    };
    entry.mode = 'bounds';
    entry.bounds = bounds.clone();
    entry.ranges[axis] = range;
    entry.transform.copy(transform);
    this.entries.set(fileIndex, entry);
    this.publish();
  }

  updateTransform(fileIndex: number, transform: THREE.Matrix4): void {
    const entry = this.entries.get(fileIndex);
    if (!entry) {return;}
    entry.transform.copy(transform);
    this.publish();
  }

  onFileRemoved(fileIndex: number): void {
    const shifted = new Map<number, ClipEntry>();
    for (const [index, entry] of this.entries) {
      if (index < fileIndex) {shifted.set(index, entry);}
      else if (index > fileIndex) {shifted.set(index - 1, entry);}
    }
    this.entries = shifted;
    this.publish();
  }

  private publish(): void {
    if (!this.renderer) {return;}
    const planes: THREE.Plane[] = [];
    for (const entry of this.entries.values()) {
      if (entry.mode === 'bounds' && entry.bounds) {
        for (let axis = 0; axis < 3; axis++) {
          const [lower, upper] = entry.ranges[axis];
          if (lower <= 0 && upper >= 100) {continue;}
          const pair = boundingBoxSectionPlanes(entry.bounds, axis, lower / 100, upper / 100);
          pair[0].applyMatrix4(entry.transform);
          pair[1].applyMatrix4(entry.transform);
          planes.push(...pair);
        }
        continue;
      }
      const sizes = entry.data?.metadata?.volumeSizes as number[] | undefined;
      const affine = entry.data?.metadata?.ijkToWorld as number[] | undefined;
      if (!sizes || !affine || affine.length < 12) {continue;}
      for (let axis = 0; axis < 3; axis++) {
        const [lower, upper] = entry.ranges[axis];
        if (lower <= 0 && upper >= sizes[axis] - 1) {continue;}
        const pair = volumeSectionPlanes(affine, axis, lower, upper);
        pair[0].applyMatrix4(entry.transform);
        pair[1].applyMatrix4(entry.transform);
        planes.push(...pair);
      }
    }
    this.renderer.clippingPlanes = planes;
  }
}

export function boundingBoxSectionPlanes(
  bounds: THREE.Box3,
  axis: number,
  lowerFraction: number,
  upperFraction: number
): [THREE.Plane, THREE.Plane] {
  const names: Array<'x' | 'y' | 'z'> = ['x', 'y', 'z'];
  const name = names[axis];
  const low = THREE.MathUtils.lerp(bounds.min[name], bounds.max[name], lowerFraction);
  const high = THREE.MathUtils.lerp(bounds.min[name], bounds.max[name], upperFraction);
  const normal = new THREE.Vector3(axis === 0 ? 1 : 0, axis === 1 ? 1 : 0, axis === 2 ? 1 : 0);
  return [new THREE.Plane(normal.clone(), -low), new THREE.Plane(normal.negate(), high)];
}

/** Builds the two world-space half-space planes that keep lower <= axis <= upper. */
export function volumeSectionPlanes(
  affine: readonly number[],
  axis: number,
  lower: number,
  upper: number
): [THREE.Plane, THREE.Plane] {
  const columns = [
    new THREE.Vector3(affine[0], affine[4], affine[8]),
    new THREE.Vector3(affine[1], affine[5], affine[9]),
    new THREE.Vector3(affine[2], affine[6], affine[10]),
  ];
  const origin = new THREE.Vector3(affine[3], affine[7], affine[11]);
  const first = columns[(axis + 1) % 3];
  const second = columns[(axis + 2) % 3];
  const normal = new THREE.Vector3().crossVectors(first, second).normalize();
  if (normal.dot(columns[axis]) < 0) {normal.negate();}

  const lowerPoint = origin.clone().addScaledVector(columns[axis], lower);
  const upperPoint = origin.clone().addScaledVector(columns[axis], upper);
  return [
    new THREE.Plane(normal.clone(), -normal.dot(lowerPoint)),
    new THREE.Plane(normal.clone().negate(), normal.dot(upperPoint)),
  ];
}
