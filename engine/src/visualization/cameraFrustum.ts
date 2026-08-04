import * as THREE from 'three';

/**
 * The camera frame every source draws.
 *
 * There used to be two visualisations. X3A and E57 drew a wireframe frustum
 * with the photograph on its image plane; JSON camera profiles and COLMAP drew
 * a small green pyramid with a red up-arrow, which showed neither the field of
 * view nor the picture. This is the frustum, generalised so any source can use
 * it: intrinsics when a source has them, a plain field of view when it does
 * not, and an optional texture.
 *
 * The frame is built in **camera space** - looking down +Z with +Y down, the
 * computer-vision convention shared by X3A, E57 and COLMAP - and the caller
 * orients the group. `IMAGE_PLANE_NAME` marks the textured quad so
 * cameraFrames.ts can toggle it without knowing which loader built it.
 */

export const IMAGE_PLANE_NAME = 'cameraImagePlane';
export const FRUSTUM_NAME = 'cameraFrustum';

/** Pinhole intrinsics in pixels, for sources that know them. */
export interface FrustumIntrinsics {
  fx: number;
  fy: number;
  cx: number;
  cy: number;
  imageWidth: number;
  imageHeight: number;
}

export interface FrustumOptions {
  /** Distance from the optical centre to the image plane, in world units. */
  depth: number;
  /** Preferred when known; the frustum then matches the real field of view. */
  intrinsics?: FrustumIntrinsics;
  /**
   * Fallback shape when intrinsics are unknown (JSON camera profiles carry
   * only a pose). A generic 50 degrees reads as "a camera" without claiming a
   * field of view the file never specified.
   */
  fovYDegrees?: number;
  aspect?: number;
  color?: number;
  /** Image to show on the plane. Without one the plane is omitted entirely. */
  texture?: THREE.Texture | null;
}

const DEFAULT_FOV_Y_DEGREES = 50;
const DEFAULT_ASPECT = 4 / 3;
const DEFAULT_COLOR = 0x4caf50;

/**
 * The four image corners at `depth`, in camera space.
 *
 * With intrinsics this is the exact sensor footprint. Without them it is a
 * symmetric frustum from the fallback field of view.
 */
export function frustumCorners(options: FrustumOptions): THREE.Vector3[] {
  const { depth } = options;
  if (options.intrinsics) {
    const { fx, fy, cx, cy, imageWidth, imageHeight } = options.intrinsics;
    const at = (u: number, v: number) =>
      new THREE.Vector3(((u - cx) / fx) * depth, ((v - cy) / fy) * depth, depth);
    // Top-left, top-right, bottom-right, bottom-left - the order the plane's
    // triangles and UVs below depend on.
    return [at(0, 0), at(imageWidth, 0), at(imageWidth, imageHeight), at(0, imageHeight)];
  }

  const fovY = ((options.fovYDegrees ?? DEFAULT_FOV_Y_DEGREES) * Math.PI) / 180;
  const halfHeight = Math.tan(fovY / 2) * depth;
  const halfWidth = halfHeight * (options.aspect ?? DEFAULT_ASPECT);
  return [
    new THREE.Vector3(-halfWidth, -halfHeight, depth),
    new THREE.Vector3(halfWidth, -halfHeight, depth),
    new THREE.Vector3(halfWidth, halfHeight, depth),
    new THREE.Vector3(-halfWidth, halfHeight, depth),
  ];
}

/**
 * The textured quad on its own, for images that arrive after the frame is
 * already in the scene.
 *
 * A COLMAP reconstruction shows its cloud and cameras immediately and decodes
 * photographs afterwards, so the plane has to be addable later. The options
 * must be the ones the frame was built with, or the plane will not sit on the
 * frustum - frames record them in `userData.frustumOptions`.
 */
export function createImagePlane(options: FrustumOptions, texture: THREE.Texture): THREE.Mesh {
  const corners = frustumCorners(options);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      corners.flatMap(corner => corner.toArray()),
      3
    )
  );
  // Row zero of a decoded image is its top row, which is the first corner.
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 1, 1, 1, 0, 0, 0], 2));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);

  const plane = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({
      map: texture,
      side: THREE.DoubleSide,
      // Reference imagery: keep decoded sRGB independent of the exposure
      // control that applies to geometry.
      toneMapped: false,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
    })
  );
  plane.name = IMAGE_PLANE_NAME;
  plane.visible = false;
  plane.renderOrder = 2;
  return plane;
}

/**
 * Builds the frame: four rays from the optical centre to the image corners,
 * the rectangle closing them, and the textured plane when an image exists.
 *
 * Returned as loose children rather than a group so callers can add them to
 * their own frame group alongside labels and source-specific extras.
 */
export function createFrustumObjects(options: FrustumOptions): THREE.Object3D[] {
  const corners = frustumCorners(options);
  const objects: THREE.Object3D[] = [];

  const linePoints: THREE.Vector3[] = [];
  for (const corner of corners) {
    linePoints.push(new THREE.Vector3(), corner);
  }
  for (let i = 0; i < corners.length; i++) {
    linePoints.push(corners[i], corners[(i + 1) % corners.length]);
  }
  const frustum = new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints(linePoints),
    new THREE.LineBasicMaterial({ color: options.color ?? DEFAULT_COLOR })
  );
  frustum.name = FRUSTUM_NAME;
  objects.push(frustum);

  if (options.texture) {
    objects.push(createImagePlane(options, options.texture));
  }

  return objects;
}

/**
 * A frustum depth that suits the scene.
 *
 * A fixed size cannot work across sources: terrestrial scans are in metres,
 * while a COLMAP reconstruction is in arbitrary units and can span 2 units or
 * 2000. Sizing from the scene's own extent keeps frames visible without
 * swamping the geometry, and the per-file scale control still adjusts it.
 */
export function frustumDepthForExtent(extent: number): number {
  if (!Number.isFinite(extent) || extent <= 0) {
    return 1;
  }
  return extent * 0.04;
}
