import * as THREE from 'three';

/** Points per chunk: about 120 chunks for an 8M-point cloud. */
export const CHUNK_POINTS = 1 << 16;

/** Smaller clouds are cheap to draw whole; bounds for them would only cost memory. */
export const CHUNKED_MIN_POINTS = 1 << 19;

/** Longest a single background slice may hold the main thread. */
const SLICE_MS = 4;

/**
 * Work starts only for an attribute still drawn after this long, and stops
 * once the attribute is no longer drawn (see `retainChunkBounds`): a sequence
 * replaces its positions every frame, and bounds for frames already gone would
 * be wasted work.
 */
const SETTLE_MS = 250;

/** The position attributes the last frame drew; work for any other stops. */
let live = new Set<THREE.BufferAttribute>();

/**
 * Called by the renderer with every attribute it draws, each frame. A render
 * loop that has gone to sleep keeps the last set, so the bounds of a static
 * scene still finish.
 */
export function retainChunkBounds(attributes: Set<THREE.BufferAttribute>): void {
  live = attributes;
}

interface ChunkBoundsEntry {
  version: number;
  /** min xyz, max xyz per chunk; complete once `next` reaches the chunk count. */
  boxes: Float32Array;
  next: number;
  scheduled: boolean;
  firstRequested: number;
  /** Told once when the bounds are complete, so a frame can use them. */
  onReady?: () => void;
}

const entries = new WeakMap<THREE.BufferAttribute, ChunkBoundsEntry>();

/**
 * Axis-aligned bounds of each run of `CHUNK_POINTS` consecutive points, or null
 * while they are still being computed. The pass over an 8M-point cloud takes
 * tens of milliseconds, so it runs in short timer slices instead of inside a
 * frame; callers draw the full range until the bounds are ready.
 *
 * A chunk whose points are all NaN gets an empty box (min > max), whose depth
 * is not finite, so callers keep it. The bounds are tied to the attribute's
 * version, so an in-place edit recomputes them.
 */
export function chunkBoxes(
  attribute: THREE.BufferAttribute,
  onReady?: () => void
): Float32Array | null {
  if (
    !(attribute.array instanceof Float32Array) ||
    attribute.itemSize !== 3 ||
    attribute.normalized ||
    attribute.count < CHUNKED_MIN_POINTS
  ) {
    return null;
  }
  const chunks = Math.ceil(attribute.count / CHUNK_POINTS);
  let entry = entries.get(attribute);
  if (!entry || entry.version !== attribute.version || entry.boxes.length !== chunks * 6) {
    entry = {
      version: attribute.version,
      boxes: new Float32Array(chunks * 6),
      next: 0,
      scheduled: false,
      firstRequested: performance.now(),
    };
    entries.set(attribute, entry);
  }
  entry.onReady = onReady;
  if (entry.next >= chunks) {
    return entry.boxes;
  }
  schedule(attribute, entry);
  return null;
}

function schedule(attribute: THREE.BufferAttribute, entry: ChunkBoundsEntry): void {
  if (entry.scheduled) {
    return;
  }
  entry.scheduled = true;
  const wait = Math.max(0, entry.firstRequested + SETTLE_MS - performance.now());
  setTimeout(() => {
    entry.scheduled = false;
    if (
      entries.get(attribute) !== entry ||
      entry.version !== attribute.version ||
      !live.has(attribute)
    ) {
      // Replaced, edited or no longer drawn; a later request starts again.
      return;
    }
    const positions = attribute.array as Float32Array;
    const count = attribute.count;
    const chunks = entry.boxes.length / 6;
    const deadline = performance.now() + SLICE_MS;
    while (entry.next < chunks && performance.now() < deadline) {
      writeChunkBox(positions, count, entry.next, entry.boxes);
      entry.next++;
    }
    if (entry.next < chunks) {
      schedule(attribute, entry);
    } else {
      entry.onReady?.();
    }
  }, wait);
}

function writeChunkBox(
  positions: Float32Array,
  count: number,
  chunk: number,
  boxes: Float32Array
): void {
  const end = Math.min(count, (chunk + 1) * CHUNK_POINTS) * 3;
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  for (let i = chunk * CHUNK_POINTS * 3; i < end; i += 3) {
    const x = positions[i];
    const y = positions[i + 1];
    const z = positions[i + 2];
    // Comparisons with NaN are false, so NaN coordinates never widen a box.
    if (x < minX) {
      minX = x;
    }
    if (x > maxX) {
      maxX = x;
    }
    if (y < minY) {
      minY = y;
    }
    if (y > maxY) {
      maxY = y;
    }
    if (z < minZ) {
      minZ = z;
    }
    if (z > maxZ) {
      maxZ = z;
    }
  }
  boxes.set([minX, minY, minZ, maxX, maxY, maxZ], chunk * 6);
}

/**
 * Smallest view depth (`-mvPosition.z`) any point of a box can have under
 * `modelView`. Depth is affine in the point, so its minimum is at the corner
 * chosen axis by axis — exact, with no corner transforms.
 */
export function nearestBoxDepth(
  boxes: Float32Array,
  chunk: number,
  modelView: THREE.Matrix4
): number {
  const e = modelView.elements;
  const o = chunk * 6;
  // Largest view-space z (closest to the camera) over the box.
  const z =
    Math.max(e[2] * boxes[o], e[2] * boxes[o + 3]) +
    Math.max(e[6] * boxes[o + 1], e[6] * boxes[o + 4]) +
    Math.max(e[10] * boxes[o + 2], e[10] * boxes[o + 5]) +
    e[14];
  return -z;
}
