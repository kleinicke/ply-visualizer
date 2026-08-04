import * as THREE from 'three';

/**
 * Bounds that ignore a few stray points.
 *
 * The initial fit frames the scene by its bounding box and orbits around the
 * box centre. That works until a handful of points sit far from everything
 * else, which is routine for structure-from-motion: COLMAP's sparse cloud
 * always contains some badly triangulated points. One of them is enough to
 * stretch the box by an order of magnitude, so the camera pulls far back and
 * the orbit pivot ends up in empty space away from the actual scene.
 *
 * Taking a percentile range instead of the extremes gives the box the geometry
 * actually occupies. Callers decide when to prefer it - see
 * `boundsAreOutlierDominated`.
 */

/** Fraction trimmed from each end of each axis. */
const TRIM = 0.01;

/**
 * Points sampled when estimating percentiles. Sorting every coordinate of a
 * multi-million-point cloud would cost more than the fit is worth, and framing
 * does not need that precision.
 */
const MAX_SAMPLES = 50_000;

/**
 * Percentile bounds of a packed xyz array, or null when there are too few
 * points for trimming to mean anything.
 */
export function robustPointBounds(positions: Float32Array): THREE.Box3 | null {
  const count = Math.floor(positions.length / 3);
  if (count < 100) {
    return null;
  }

  const stride = Math.max(1, Math.floor(count / MAX_SAMPLES));
  const sampleCount = Math.floor((count + stride - 1) / stride);
  const axes = [
    new Float32Array(sampleCount),
    new Float32Array(sampleCount),
    new Float32Array(sampleCount),
  ];

  let written = 0;
  for (let index = 0; index < count; index += stride) {
    axes[0][written] = positions[index * 3];
    axes[1][written] = positions[index * 3 + 1];
    axes[2][written] = positions[index * 3 + 2];
    written++;
  }

  const min = new THREE.Vector3();
  const max = new THREE.Vector3();
  const components: Array<'x' | 'y' | 'z'> = ['x', 'y', 'z'];
  for (let axis = 0; axis < 3; axis++) {
    const values = axes[axis].subarray(0, written);
    values.sort();
    const low = Math.floor(written * TRIM);
    const high = Math.min(written - 1, Math.ceil(written * (1 - TRIM)));
    min[components[axis]] = values[low];
    max[components[axis]] = values[high];
  }

  if (!Number.isFinite(min.x) || !Number.isFinite(max.x)) {
    return null;
  }
  return new THREE.Box3(min, max);
}

/**
 * Whether the full box is stretched enough by outliers to be worth replacing.
 *
 * The threshold keeps well-behaved clouds on exactly the framing they had
 * before: for those, trimming a percent barely moves the extremes and this
 * returns false. It only fires when the trimmed extent is less than half the
 * full one on some axis, which means most of the box is empty space spanned by
 * a few far-off points.
 */
export function boundsAreOutlierDominated(full: THREE.Box3, robust: THREE.Box3): boolean {
  const fullSize = full.getSize(new THREE.Vector3());
  const robustSize = robust.getSize(new THREE.Vector3());
  const components: Array<'x' | 'y' | 'z'> = ['x', 'y', 'z'];
  return components.some(axis => {
    const extent = fullSize[axis];
    return extent > 1e-9 && robustSize[axis] < extent * 0.5;
  });
}
