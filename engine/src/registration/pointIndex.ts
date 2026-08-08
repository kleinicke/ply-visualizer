/**
 * Uniform-grid spatial index and the two preprocessing steps ICP needs:
 * voxel downsampling and PCA normal estimation.
 *
 * A uniform grid, not a KD-tree, for the reason the cloud-to-cloud distance
 * plan in docs/BACKLOG.md gives: after voxel downsampling the points are close
 * to uniformly dense, so bucketing is O(n) to build, allocates three typed
 * arrays, and a query touches a fixed number of cells. A KD-tree would win only
 * on the pathological density variation the downsample already removed.
 *
 * Buckets are stored CSR-style (`cellStart` + `items`) rather than as an array
 * of arrays: a station scan downsamples to a few hundred thousand points, and
 * one small object per occupied cell is the difference between a smooth refine
 * and a garbage-collection stutter mid-iteration.
 */

import { symmetricEigen } from './linalg';

/** Cap on grid cells, so a tiny cell size on a large scene cannot blow up memory. */
const MAX_CELLS = 1 << 22;

export class PointGrid {
  readonly points: Float32Array;
  readonly cellSize: number;
  private readonly minX: number;
  private readonly minY: number;
  private readonly minZ: number;
  private readonly nx: number;
  private readonly ny: number;
  private readonly nz: number;
  private readonly cellStart: Int32Array;
  private readonly items: Int32Array;

  /**
   * @param points Flat xyz triples. Retained by reference, not copied.
   * @param cellSize Requested cell size; enlarged if the bounding box would
   *   need more than `MAX_CELLS` cells.
   */
  constructor(points: Float32Array, cellSize: number) {
    this.points = points;
    const count = Math.floor(points.length / 3);

    let minX = Infinity;
    let minY = Infinity;
    let minZ = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let maxZ = -Infinity;
    for (let i = 0; i < count; i++) {
      const x = points[i * 3];
      const y = points[i * 3 + 1];
      const z = points[i * 3 + 2];
      if (x < minX) {minX = x;}
      if (y < minY) {minY = y;}
      if (z < minZ) {minZ = z;}
      if (x > maxX) {maxX = x;}
      if (y > maxY) {maxY = y;}
      if (z > maxZ) {maxZ = z;}
    }
    if (count === 0) {
      minX = minY = minZ = 0;
      maxX = maxY = maxZ = 0;
    }

    const spanX = Math.max(maxX - minX, 1e-6);
    const spanY = Math.max(maxY - minY, 1e-6);
    const spanZ = Math.max(maxZ - minZ, 1e-6);
    let size = Math.max(cellSize, 1e-6);
    // Grow the cell until the lattice fits the budget. Each doubling cuts the
    // cell count by 8, so this terminates in a handful of steps.
    while (
      Math.ceil(spanX / size) * Math.ceil(spanY / size) * Math.ceil(spanZ / size) >
      MAX_CELLS
    ) {
      size *= 2;
    }

    this.cellSize = size;
    this.minX = minX;
    this.minY = minY;
    this.minZ = minZ;
    this.nx = Math.max(1, Math.ceil(spanX / size) + 1);
    this.ny = Math.max(1, Math.ceil(spanY / size) + 1);
    this.nz = Math.max(1, Math.ceil(spanZ / size) + 1);

    // Counting sort into CSR buckets: one pass to count, prefix sum, one pass
    // to place.
    const cellCount = this.nx * this.ny * this.nz;
    const counts = new Int32Array(cellCount + 1);
    const cellOf = new Int32Array(count);
    for (let i = 0; i < count; i++) {
      const cell = this.cellIndex(points[i * 3], points[i * 3 + 1], points[i * 3 + 2]);
      cellOf[i] = cell;
      counts[cell + 1]++;
    }
    for (let c = 0; c < cellCount; c++) {
      counts[c + 1] += counts[c];
    }
    this.cellStart = counts;
    this.items = new Int32Array(count);
    const cursor = counts.slice(0, cellCount);
    for (let i = 0; i < count; i++) {
      this.items[cursor[cellOf[i]]++] = i;
    }
  }

  private cellIndex(x: number, y: number, z: number): number {
    const ix = Math.min(this.nx - 1, Math.max(0, Math.floor((x - this.minX) / this.cellSize)));
    const iy = Math.min(this.ny - 1, Math.max(0, Math.floor((y - this.minY) / this.cellSize)));
    const iz = Math.min(this.nz - 1, Math.max(0, Math.floor((z - this.minZ) / this.cellSize)));
    return (iz * this.ny + iy) * this.nx + ix;
  }

  /**
   * Index of the closest indexed point within `maxDistance`, or -1.
   *
   * Bounded rather than unbounded on purpose: an ICP correspondence beyond the
   * gate is rejected anyway, and the bound is what keeps the number of visited
   * cells constant.
   */
  nearest(x: number, y: number, z: number, maxDistance: number): number {
    const ring = Math.max(1, Math.ceil(maxDistance / this.cellSize));
    const cx = Math.floor((x - this.minX) / this.cellSize);
    const cy = Math.floor((y - this.minY) / this.cellSize);
    const cz = Math.floor((z - this.minZ) / this.cellSize);

    let best = -1;
    let bestSq = maxDistance * maxDistance;
    for (let iz = Math.max(0, cz - ring); iz <= Math.min(this.nz - 1, cz + ring); iz++) {
      for (let iy = Math.max(0, cy - ring); iy <= Math.min(this.ny - 1, cy + ring); iy++) {
        const rowBase = (iz * this.ny + iy) * this.nx;
        const fromX = Math.max(0, cx - ring);
        const toX = Math.min(this.nx - 1, cx + ring);
        for (let ix = fromX; ix <= toX; ix++) {
          const cell = rowBase + ix;
          const end = this.cellStart[cell + 1];
          for (let slot = this.cellStart[cell]; slot < end; slot++) {
            const index = this.items[slot];
            const dx = this.points[index * 3] - x;
            const dy = this.points[index * 3 + 1] - y;
            const dz = this.points[index * 3 + 2] - z;
            const squared = dx * dx + dy * dy + dz * dz;
            if (squared < bestSq) {
              bestSq = squared;
              best = index;
            }
          }
        }
      }
    }
    return best;
  }

  /** Indices within `radius` of the query, appended to `out`, up to `limit`. */
  neighbors(x: number, y: number, z: number, radius: number, limit: number, out: number[]): void {
    out.length = 0;
    const ring = Math.max(1, Math.ceil(radius / this.cellSize));
    const cx = Math.floor((x - this.minX) / this.cellSize);
    const cy = Math.floor((y - this.minY) / this.cellSize);
    const cz = Math.floor((z - this.minZ) / this.cellSize);
    const radiusSq = radius * radius;

    for (let iz = Math.max(0, cz - ring); iz <= Math.min(this.nz - 1, cz + ring); iz++) {
      for (let iy = Math.max(0, cy - ring); iy <= Math.min(this.ny - 1, cy + ring); iy++) {
        const rowBase = (iz * this.ny + iy) * this.nx;
        for (let ix = Math.max(0, cx - ring); ix <= Math.min(this.nx - 1, cx + ring); ix++) {
          const cell = rowBase + ix;
          const end = this.cellStart[cell + 1];
          for (let slot = this.cellStart[cell]; slot < end; slot++) {
            const index = this.items[slot];
            const dx = this.points[index * 3] - x;
            const dy = this.points[index * 3 + 1] - y;
            const dz = this.points[index * 3 + 2] - z;
            if (dx * dx + dy * dy + dz * dz <= radiusSq) {
              out.push(index);
              if (out.length >= limit) {
                return;
              }
            }
          }
        }
      }
    }
  }
}

/**
 * Averages the points falling in each `voxelSize` cell down to one point.
 *
 * Averaging rather than picking a representative: a station scan is far denser
 * near the scanner than at range, and keeping an arbitrary member of each cell
 * leaves that density gradient in the residual, which biases the ICP fit toward
 * whatever is closest to the tripod.
 */
export function voxelDownsample(points: Float32Array, voxelSize: number): Float32Array {
  const count = Math.floor(points.length / 3);
  if (count === 0 || !(voxelSize > 0)) {
    return new Float32Array(0);
  }

  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  for (let i = 0; i < count; i++) {
    minX = Math.min(minX, points[i * 3]);
    minY = Math.min(minY, points[i * 3 + 1]);
    minZ = Math.min(minZ, points[i * 3 + 2]);
  }

  const sums = new Map<string, { x: number; y: number; z: number; n: number }>();
  for (let i = 0; i < count; i++) {
    const x = points[i * 3];
    const y = points[i * 3 + 1];
    const z = points[i * 3 + 2];
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
      continue;
    }
    const key = `${Math.floor((x - minX) / voxelSize)},${Math.floor((y - minY) / voxelSize)},${Math.floor((z - minZ) / voxelSize)}`;
    const bucket = sums.get(key);
    if (bucket) {
      bucket.x += x;
      bucket.y += y;
      bucket.z += z;
      bucket.n++;
    } else {
      sums.set(key, { x, y, z, n: 1 });
    }
  }

  const out = new Float32Array(sums.size * 3);
  let write = 0;
  for (const bucket of sums.values()) {
    out[write++] = bucket.x / bucket.n;
    out[write++] = bucket.y / bucket.n;
    out[write++] = bucket.z / bucket.n;
  }
  return out;
}

/**
 * Per-point surface normals from the smallest principal component of the
 * neighborhood within `radius`.
 *
 * Orientation is left arbitrary. Point-to-plane ICP squares the plane residual,
 * so a flipped normal costs nothing, and consistently orienting them across a
 * scan is a much harder problem than the solver actually needs solved.
 *
 * Points with too few neighbors get a zero normal; `icp` treats that as "no
 * usable plane here" and skips the correspondence.
 */
export function estimateNormals(grid: PointGrid, radius: number, minNeighbors = 6): Float32Array {
  const points = grid.points;
  const count = Math.floor(points.length / 3);
  const normals = new Float32Array(count * 3);
  const neighborhood: number[] = [];

  for (let i = 0; i < count; i++) {
    const x = points[i * 3];
    const y = points[i * 3 + 1];
    const z = points[i * 3 + 2];
    grid.neighbors(x, y, z, radius, 48, neighborhood);
    if (neighborhood.length < minNeighbors) {
      continue;
    }

    let cx = 0;
    let cy = 0;
    let cz = 0;
    for (const index of neighborhood) {
      cx += points[index * 3];
      cy += points[index * 3 + 1];
      cz += points[index * 3 + 2];
    }
    const n = neighborhood.length;
    cx /= n;
    cy /= n;
    cz /= n;

    let xx = 0;
    let xy = 0;
    let xz = 0;
    let yy = 0;
    let yz = 0;
    let zz = 0;
    for (const index of neighborhood) {
      const dx = points[index * 3] - cx;
      const dy = points[index * 3 + 1] - cy;
      const dz = points[index * 3 + 2] - cz;
      xx += dx * dx;
      xy += dx * dy;
      xz += dx * dz;
      yy += dy * dy;
      yz += dy * dz;
      zz += dz * dz;
    }

    const eigen = symmetricEigen([xx, xy, xz, xy, yy, yz, xz, yz, zz], 3);
    const normal = eigen.vectors[2];
    const length = Math.hypot(normal[0], normal[1], normal[2]);
    if (length > 1e-12) {
      normals[i * 3] = normal[0] / length;
      normals[i * 3 + 1] = normal[1] / length;
      normals[i * 3 + 2] = normal[2] / length;
    }
  }

  return normals;
}

/**
 * Robust working diameter of a cloud: twice the 90th-percentile distance from
 * its median centre.
 *
 * The bounding box is the wrong scale reference for a station scan. Half the
 * points of a real scan sit within a few metres of the tripod while a thin tail
 * of long-range returns stretches the box to a hundred metres or more, so any
 * parameter derived from the box (a voxel size, a raster cell) ends up an order
 * of magnitude too coarse for the geometry that two stations actually share.
 */
export function robustExtent(points: Float32Array, maxSamples = 100_000): number {
  const count = Math.floor(points.length / 3);
  if (count === 0) {
    return 0;
  }
  const stride = Math.max(1, Math.ceil(count / maxSamples));
  const axes: number[][] = [[], [], []];
  for (let i = 0; i < count; i += stride) {
    for (let axis = 0; axis < 3; axis++) {
      axes[axis].push(points[i * 3 + axis]);
    }
  }
  const centre = axes.map(values => {
    const sorted = values.slice().sort((x, y) => x - y);
    return sorted[Math.floor(sorted.length / 2)];
  });

  const radii: number[] = [];
  for (let i = 0; i < axes[0].length; i++) {
    radii.push(Math.hypot(axes[0][i] - centre[0], axes[1][i] - centre[1], axes[2][i] - centre[2]));
  }
  radii.sort((x, y) => x - y);
  return Math.max(radii[Math.floor(radii.length * 0.9)] * 2, 1e-6);
}
