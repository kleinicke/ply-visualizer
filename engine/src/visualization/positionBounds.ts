/*
 * Kept free of three.js so a worker can import it without the whole library;
 * `fastBounds.ts` turns the result into three.js boxes and spheres.
 */

/** A position array's bounds, as `computePositionBounds` derives them. */
export interface PositionBounds {
  min: [number, number, number];
  max: [number, number, number];
  center: [number, number, number];
  radius: number;
  /** Points they were computed over, to check they belong to an array. */
  count: number;
}

/**
 * The bounds of `count` xyz points, with three.js's arithmetic (see above).
 * Free of three.js so a worker can compute them next to the data - the depth
 * worker does, which takes two passes over every point off the main thread.
 */
export function positionBounds(values: Float32Array, count: number): PositionBounds {
  const end = count * 3;
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < end; i += 3) {
    const x = values[i];
    const y = values[i + 1];
    const z = values[i + 2];
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    minZ = Math.min(minZ, z);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
    maxZ = Math.max(maxZ, z);
  }
  // As Box3.getCenter: the origin for an empty box, else (min + max) * 0.5.
  const empty = maxX < minX || maxY < minY || maxZ < minZ;
  const cx = empty ? 0 : (minX + maxX) * 0.5;
  const cy = empty ? 0 : (minY + maxY) * 0.5;
  const cz = empty ? 0 : (minZ + maxZ) * 0.5;
  let maxRadiusSq = 0;
  for (let i = 0; i < end; i += 3) {
    const dx = cx - values[i];
    const dy = cy - values[i + 1];
    const dz = cz - values[i + 2];
    maxRadiusSq = Math.max(maxRadiusSq, dx * dx + dy * dy + dz * dz);
  }
  return {
    min: [minX, minY, minZ],
    max: [maxX, maxY, maxZ],
    center: [cx, cy, cz],
    radius: Math.sqrt(maxRadiusSq),
    count,
  };
}
