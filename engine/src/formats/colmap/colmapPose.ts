import * as THREE from 'three';
import { focalYIndex, type ColmapImage } from './colmapModel';

/**
 * COLMAP image pose -> viewer placement.
 *
 * This is the part that is easy to get subtly wrong and hard to notice, so it
 * is isolated and unit-tested (test/colmap-pose.spec.ts) rather than
 * checked by eye against a render.
 *
 * Two conversions happen here.
 *
 * **1. Direction of the stored transform.** COLMAP stores *world-to-camera*:
 * a world point maps to camera coordinates by `x_cam = R * x_world + t`, with
 * `R` from the quaternion `[qw, qx, qy, qz]`. Placing a camera in the scene
 * needs the inverse, so the camera centre is `C = -R^T * t` and the
 * camera-to-world rotation is `R^T`. Using `t` directly as a position is the
 * classic mistake: it is only the same when `R` is the identity.
 *
 * **2. Axis convention.** COLMAP camera axes are **X right, Y down, Z
 * forward**. The viewer's camera bodies (cameraProfile.createCameraBodyGeometry)
 * are modelled looking along **+Z with +Y up**. Those two bases differ by a
 * negated Y, which is a reflection, not a rotation - no orientation of the
 * group can satisfy both the direction and the roll.
 *
 * So the group carries the honest COLMAP-to-world rotation, and the two
 * consumers are told about the convention separately:
 *
 * - the body mesh gets a 180 degrees roll about its own Z, a proper rotation
 *   that maps its +Y up onto COLMAP's -Y up while leaving +Z forward alone;
 * - look-through uses `cameraFrames`'s `view` escape hatch, declaring forward
 *   as local +Z and up as local -Y.
 */

/** Rotation applied to the body mesh so its up-arrow points the camera's up. */
export const BODY_ROLL_ABOUT_Z = Math.PI;

export interface ColmapPlacement {
  /** Camera centre in world coordinates. */
  position: THREE.Vector3;
  /** Camera-to-world rotation, in COLMAP camera axes (X right, Y down, Z fwd). */
  quaternion: THREE.Quaternion;
}

/**
 * World-to-camera rotation as a Three.js quaternion.
 *
 * COLMAP orders the components `[qw, qx, qy, qz]`; Three.js takes
 * `(x, y, z, w)`. Getting this backwards produces a rotation that still looks
 * plausible, which is exactly why it is called out here.
 */
export function worldToCameraQuaternion(qvec: ColmapImage['qvec']): THREE.Quaternion {
  const [qw, qx, qy, qz] = qvec;
  return new THREE.Quaternion(qx, qy, qz, qw).normalize();
}

/** Camera centre `C = -R^T * t`. */
export function cameraCentre(image: ColmapImage): THREE.Vector3 {
  const worldToCamera = worldToCameraQuaternion(image.qvec);
  const cameraToWorld = worldToCamera.clone().invert();
  return new THREE.Vector3(image.tvec[0], image.tvec[1], image.tvec[2])
    .applyQuaternion(cameraToWorld)
    .negate();
}

export function placementFor(image: ColmapImage): ColmapPlacement {
  return {
    position: cameraCentre(image),
    quaternion: worldToCameraQuaternion(image.qvec).invert(),
  };
}

/**
 * Viewing direction in world space - where the camera actually looks.
 * COLMAP's optical axis is camera-space +Z.
 */
export function viewDirection(image: ColmapImage): THREE.Vector3 {
  return new THREE.Vector3(0, 0, 1).applyQuaternion(placementFor(image).quaternion).normalize();
}

/**
 * Vertical field of view in degrees, for framing a look-through.
 *
 * Which slot holds `fy` depends on the model, so the lookup lives with the
 * model table (colmapModel.focalYIndex). An equirectangular camera has no
 * focal length - it covers the full sphere - and returns undefined, leaving
 * look-through on the viewer's own FOV rather than inventing one.
 */
export function verticalFovDegrees(
  model: string,
  params: readonly number[],
  imageHeight: number
): number | undefined {
  const index = focalYIndex(model);
  if (index === null) {
    return undefined;
  }
  const fy = params[index];
  if (!Number.isFinite(fy) || fy <= 0 || !Number.isFinite(imageHeight) || imageHeight <= 0) {
    return undefined;
  }
  return 2 * Math.atan(imageHeight / (2 * fy)) * (180 / Math.PI);
}
