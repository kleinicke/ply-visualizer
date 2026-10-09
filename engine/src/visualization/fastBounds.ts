import * as THREE from 'three';

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
export function computePositionBounds(geometry: THREE.BufferGeometry): void {
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
  const values = position.array;
  const end = position.count * 3;

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
  const box = new THREE.Box3(
    new THREE.Vector3(minX, minY, minZ),
    new THREE.Vector3(maxX, maxY, maxZ)
  );

  const center = new THREE.Vector3();
  box.getCenter(center);
  const cx = center.x;
  const cy = center.y;
  const cz = center.z;
  let maxRadiusSq = 0;
  for (let i = 0; i < end; i += 3) {
    const dx = cx - values[i];
    const dy = cy - values[i + 1];
    const dz = cz - values[i + 2];
    maxRadiusSq = Math.max(maxRadiusSq, dx * dx + dy * dy + dz * dz);
  }

  geometry.boundingBox = box;
  geometry.boundingSphere = new THREE.Sphere(center, Math.sqrt(maxRadiusSq));
}
