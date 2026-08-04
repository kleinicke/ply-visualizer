import * as THREE from 'three';
import { IMAGE_PLANE_NAME } from './cameraFrustum';

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
  /**
   * Image corners in the frame group's local space. Used to frame the whole
   * image whatever its shape and roll; a single vertical FOV cannot do that,
   * since a portrait or rolled photo needs the horizontal extent instead.
   */
  corners?: THREE.Vector3[];
  /**
   * Scene vertical axis, for sources whose world has one.
   *
   * When set, look-through snaps the roll to the quarter turn that stands
   * closest to this axis, which is what makes a portrait-mounted scanner
   * camera come out portrait rather than on its side. E57 and X3A both define
   * +Z as up, so they set it.
   *
   * Leave it undefined when the world frame is arbitrary. A COLMAP
   * reconstruction is expressed in whatever frame the solve chose - commonly
   * Y-down - so snapping towards +Z there rotates a correctly-oriented camera
   * by a quarter turn. Those frames use their declared `up` verbatim.
   */
  rollSnapAxis?: THREE.Vector3;
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
      hasImagePlane: !!group.getObjectByName(IMAGE_PLANE_NAME),
      details: (group.userData.frameDetails as CameraFrameDetail[] | undefined) ?? [],
    }));
}

export function isCameraFrameImageVisible(group: THREE.Group): boolean {
  return group.getObjectByName(IMAGE_PLANE_NAME)?.visible === true;
}

export function setCameraFrameImageVisible(group: THREE.Group, visible: boolean): void {
  const plane = group.getObjectByName(IMAGE_PLANE_NAME);
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
  // Frames are modelled looking along local +Z (cameraFrustum.ts), which
  // covers every source that stores a real rotation on the group.
  const forwardLocal = view
    ? view.forward.clone()
    : new THREE.Vector3(0, 0, FALLBACK_TARGET_DISTANCE);
  const upLocal = view ? view.up.clone() : new THREE.Vector3(0, 1, 0);

  const position = new THREE.Vector3().setFromMatrixPosition(group.matrixWorld);
  const target = forwardLocal.applyMatrix4(group.matrixWorld);
  const imageUp = upLocal.transformDirection(group.matrixWorld).normalize();

  // Snap the roll to the image's own axes, choosing the quarter turn that
  // stands closest to the scene's vertical axis. A portrait-mounted camera is
  // rolled 90 degrees, so its picture ends up portrait on screen instead of on
  // its side, and the screen edges stay parallel to the image edges. Nothing
  // here invents an intermediate angle, and it does not read camera.up, which
  // the trackball controls rewrite while orbiting.
  //
  // Only for sources that declare which way is up. Applying it to a frame in an
  // arbitrary world frame rotates a correctly-oriented camera by a quarter turn
  // instead of correcting one - see CameraFrameView.rollSnapAxis.
  const direction = target.clone().sub(position).normalize();
  const up = imageUp.clone();
  const snapAxis = view?.rollSnapAxis;
  if (snapAxis) {
    let bestUpright = -Infinity;
    for (let quarter = 0; quarter < 4; quarter++) {
      const candidate = imageUp
        .clone()
        .applyAxisAngle(direction, (quarter * Math.PI) / 2)
        .normalize();
      const upright = candidate.dot(snapAxis);
      if (upright > bestUpright) {
        bestUpright = upright;
        up.copy(candidate);
      }
    }
  }

  host.camera.position.copy(position);
  host.camera.up.copy(up);
  host.camera.lookAt(target);
  if (view?.fovYDegrees && Number.isFinite(view.fovYDegrees)) {
    host.camera.fov = view.fovYDegrees;
  }
  host.camera.updateProjectionMatrix();
  fitFieldOfViewToImage(host, group, view);
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

/**
 * Widens the vertical FOV until every image corner is on screen.
 *
 * The image's own vertical FOV only frames it when the photo is upright and
 * its aspect is no wider than the viewport. A rolled or portrait frame needs
 * the horizontal extent, divided by the viewport aspect, instead.
 */
function fitFieldOfViewToImage(
  host: LookThroughHost,
  group: THREE.Group,
  view: CameraFrameView | undefined
): void {
  if (!view?.corners?.length) {
    return;
  }
  host.camera.updateMatrixWorld(true);
  const worldToCamera = new THREE.Matrix4().copy(host.camera.matrixWorld).invert();
  const aspect = host.camera.aspect || 1;
  let tangent = 0;
  for (const corner of view.corners) {
    const point = corner.clone().applyMatrix4(group.matrixWorld).applyMatrix4(worldToCamera);
    // Three.js cameras look down -Z; corners behind the camera cannot be framed.
    if (point.z >= -1e-6) {
      continue;
    }
    const depth = -point.z;
    tangent = Math.max(tangent, Math.abs(point.y) / depth, Math.abs(point.x) / depth / aspect);
  }
  if (tangent <= 0) {
    return;
  }
  // A little air so the border is not exactly on the viewport edge.
  host.camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(tangent * 1.04));
  host.camera.updateProjectionMatrix();
}
