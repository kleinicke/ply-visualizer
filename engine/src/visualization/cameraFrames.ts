import * as THREE from 'three';

/**
 * Per-camera access shared by every camera source.
 *
 * Camera profiles (cameraProfile.ts), Stonex X3A archives (stonexCameras.ts)
 * and E57 embedded images (e57Cameras.ts) all build one profile group holding
 * one `camera_*` child group per camera, so the panel can list them without
 * knowing which loader produced them. Sources describe themselves through two
 * optional userData fields on the child group:
 *
 * - `frameDetails`: label/value rows rendered verbatim in the panel.
 * - `view`: the look-through basis, needed where the group's own rotation is
 *   not the camera orientation (the X3A viewer transform mirrors an axis, so
 *   its frames carry transformed points instead of a rotation).
 */
export interface CameraFrameDetail {
  label: string;
  value: string;
}

export interface CameraFrameView {
  /** Point the camera looks at, in the frame group's local space. */
  forward: THREE.Vector3;
  /** Up direction of the image, in the frame group's local space. */
  up: THREE.Vector3;
  /** Vertical field of view matching the image, in degrees. */
  fovYDegrees?: number;
}

export interface CameraFrameInfo {
  group: THREE.Group;
  name: string;
  position: { x: number; y: number; z: number } | null;
  hasImagePlane: boolean;
  details: CameraFrameDetail[];
}

export interface LookThroughHost {
  camera: THREE.PerspectiveCamera;
  controls?: { target: THREE.Vector3; update?: () => void } | null;
  axesGroup?: THREE.Object3D;
  requestRender(): void;
  updateCameraMatrix?(): void;
  updateCameraControlsPanel?(): void;
}

/** Distance of the look-at target for frames that do not declare a view. */
const FALLBACK_TARGET_DISTANCE = 5;

/**
 * Orbit radius left after moving the pivot onto the optical centre. Controls
 * derive their eye vector from camera - target, so a true zero would be
 * degenerate; this matches RotationCenterManager's own minimum distance and
 * makes rotation read as turning the camera in place.
 */
const PIVOT_EPSILON = 0.0001;

export function listCameraFrames(profile: THREE.Group | null | undefined): CameraFrameInfo[] {
  if (!profile) {
    return [];
  }
  return profile.children
    .filter((child): child is THREE.Group => child instanceof THREE.Group)
    .filter(child => child.name.startsWith('camera_'))
    .map(group => ({
      group,
      name: group.name.replace(/^camera_/, '').replace(/\.x3i$/i, ''),
      position: (group as any).originalPosition ?? null,
      hasImagePlane: !!group.getObjectByName('stonexImagePlane'),
      details: (group.userData.frameDetails as CameraFrameDetail[] | undefined) ?? [],
    }));
}

export function isCameraFrameImageVisible(group: THREE.Group): boolean {
  return group.getObjectByName('stonexImagePlane')?.visible === true;
}

export function setCameraFrameImageVisible(group: THREE.Group, visible: boolean): void {
  const plane = group.getObjectByName('stonexImagePlane');
  if (plane) {
    plane.visible = visible;
  }
}

/**
 * Places the viewer camera at a frame's optical centre, aimed the way that
 * camera was aimed. This is the only viewpoint where an image plane and the
 * geometry behind it line up: the planes sit tens of centimetres off the
 * scanner origin, so any other eye position shows parallax between them.
 */
export function lookThroughCameraFrame(host: LookThroughHost, group: THREE.Group): void {
  group.updateWorldMatrix(true, false);
  const view = group.userData.view as CameraFrameView | undefined;
  // Camera bodies are modelled looking along local +Z with +Y up
  // (createCameraBodyGeometry), which covers every source that stores a real
  // rotation on the group.
  const forwardLocal = view
    ? view.forward.clone()
    : new THREE.Vector3(0, 0, FALLBACK_TARGET_DISTANCE);
  const upLocal = view ? view.up.clone() : new THREE.Vector3(0, 1, 0);

  const position = new THREE.Vector3().setFromMatrixPosition(group.matrixWorld);
  const target = forwardLocal.applyMatrix4(group.matrixWorld);
  const up = upLocal.transformDirection(group.matrixWorld).normalize();

  host.camera.position.copy(position);
  host.camera.up.copy(up);
  host.camera.lookAt(target);
  if (view?.fovYDegrees && Number.isFinite(view.fovYDegrees)) {
    host.camera.fov = view.fovYDegrees;
  }
  host.camera.updateProjectionMatrix();
  if (host.controls) {
    // Pivot on the optical centre rather than the image plane, so rotating
    // turns the view without leaving the camera's viewpoint. Sitting a hair
    // in front of the camera keeps the orientation just established.
    const pivot = target
      .clone()
      .sub(position)
      .normalize()
      .multiplyScalar(PIVOT_EPSILON)
      .add(position);
    host.controls.target.copy(pivot);
    host.controls.update?.();
    host.axesGroup?.position.copy(pivot);
  }
  host.updateCameraMatrix?.();
  host.updateCameraControlsPanel?.();
  host.requestRender();
}
