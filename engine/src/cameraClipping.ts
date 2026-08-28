import * as THREE from 'three';

export const FIXED_CAMERA_NEAR = 0.001;
export const FIXED_CAMERA_FAR = 10_000_000;

/** Restore the viewer's fixed clip range after fitting or resetting a camera. */
export function applyFixedClipPlanes(camera: THREE.PerspectiveCamera): void {
  camera.near = FIXED_CAMERA_NEAR;
  camera.far = FIXED_CAMERA_FAR;
  camera.updateProjectionMatrix();
}
