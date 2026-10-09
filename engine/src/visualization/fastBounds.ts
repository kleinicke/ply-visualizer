import * as THREE from 'three';
import { positionBounds, type PositionBounds } from './positionBounds';

export { positionBounds, type PositionBounds };

/**
 * Bounding box and sphere of a geometry's positions, in two tight loops.
 *
 * three.js computes both through `fromBufferAttribute` and generic per-vertex
 * accessors - a box pass in `computeBoundingBox`, and another box pass plus a
 * distance pass in `computeBoundingSphere`, which the renderer runs on the
 * first frame for frustum culling. For an eight-million-point cloud that was
 * about 200 ms of every load. These loops do the same arithmetic in the same
 * order (`Math.min`/`Math.max` from an empty box, centre `(min + max) * 0.5`,
 * squared distance `centre - point`), so the results are bit-identical,
 * including how NaN coordinates propagate.
 *
 * Anything other than a plain Float32 xyz attribute without morph targets
 * takes three.js's own path.
 */
/**
 * @param known bounds already computed for exactly this attribute's points
 *   (`positionBounds`, e.g. in the depth worker); used instead of two passes.
 */
export function computePositionBounds(
  geometry: THREE.BufferGeometry,
  known?: PositionBounds | null
): void {
  const position = geometry.getAttribute('position');
  if (
    !(position instanceof THREE.BufferAttribute) ||
    !(position.array instanceof Float32Array) ||
    position.itemSize !== 3 ||
    position.normalized ||
    geometry.morphAttributes.position
  ) {
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return;
  }
  const bounds =
    known && known.count === position.count
      ? known
      : positionBounds(position.array, position.count);
  geometry.boundingBox = new THREE.Box3(
    new THREE.Vector3(...bounds.min),
    new THREE.Vector3(...bounds.max)
  );
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(...bounds.center), bounds.radius);
}
