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
    const low = Math.floor(written * TRIM);
    const high = Math.min(written - 1, Math.ceil(written * (1 - TRIM)));
    const [lowValue, highValue] = orderStatistics(values, low, high);
    min[components[axis]] = lowValue;
    max[components[axis]] = highValue;
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

/** `a` sorts before `b` in TypedArray#sort order: -0 before +0 (NaN is handled by the caller). */
function sortsBefore(a: number, b: number): boolean {
  return a < b || (a === 0 && b === 0 && Object.is(a, -0) && !Object.is(b, -0));
}

/**
 * `values[low]` and `values[high]` as they would be after `values.sort()`
 * (NaN last, -0 before +0), reordering `values` in place. Two quickselects
 * rather than a sort: framing needs two percentiles per axis, and sorting the
 * three 50k-sample axes was ~10-20 ms of every large load.
 */
export function orderStatistics(values: Float32Array, low: number, high: number): [number, number] {
  // NaNs go to the end, where sort puts them; the rest is selected among.
  let finite = values.length;
  for (let i = 0; i < finite;) {
    if (Number.isNaN(values[i])) {
      finite--;
      values[i] = values[finite];
      values[finite] = NaN;
    } else {
      i++;
    }
  }
  if (low >= finite) {
    return [NaN, NaN];
  }
  select(values, 0, finite - 1, low);
  if (high >= finite) {
    return [values[low], NaN];
  }
  // Everything before `low` is now no greater than values[low].
  select(values, low, finite - 1, high);
  return [values[low], values[high]];
}

/** Hoare quickselect: puts the element of sorted rank `k` at `values[k]`, within [lo, hi]. */
function select(values: Float32Array, lo: number, hi: number, k: number): void {
  while (hi > lo) {
    const mid = (lo + hi) >>> 1;
    // Median of three, so already sorted input does not go quadratic.
    if (sortsBefore(values[mid], values[lo])) {
      swap(values, mid, lo);
    }
    if (sortsBefore(values[hi], values[lo])) {
      swap(values, hi, lo);
    }
    if (sortsBefore(values[hi], values[mid])) {
      swap(values, hi, mid);
    }
    const pivot = values[mid];
    let i = lo;
    let j = hi;
    while (i <= j) {
      while (sortsBefore(values[i], pivot)) {
        i++;
      }
      while (sortsBefore(pivot, values[j])) {
        j--;
      }
      if (i <= j) {
        swap(values, i, j);
        i++;
        j--;
      }
    }
    if (k <= j) {
      hi = j;
    } else if (k >= i) {
      lo = i;
    } else {
      return;
    }
  }
}

function swap(values: Float32Array, a: number, b: number): void {
  const t = values[a];
  values[a] = values[b];
  values[b] = t;
}
