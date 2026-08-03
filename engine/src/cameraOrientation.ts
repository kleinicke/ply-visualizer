import * as THREE from 'three';

/**
 * Initial scene orientation for formats with a defined vertical axis.
 *
 * Three.js starts every camera Y-up, which is wrong for survey data: the E57
 * standard states "The Z-axis is in the UP direction, the Y-axis is the
 * northing and X-axis is the easting", LAS stores Z as elevation, and Stonex
 * archives measure their vertical angle about Z. Opening one of those files
 * with a Y-up camera tips the world on its side until the user orbits.
 *
 * Mesh and generic point formats (PLY, OBJ, STL, ...) carry no such promise —
 * plenty come out of Y-up authoring tools — so they are left alone.
 */
const Z_UP_FORMATS = new Set(['e57', 'las', 'laz', 'x3a', 'x3r']);

/**
 * Names are not always bare file names: a multi-scan E57 becomes
 * "site.e57 — scan 1", so the extension cannot be read as "text after the last
 * dot". Match the known suffixes wherever they appear as a whole token.
 */
const Z_UP_NAME = /\.(e57|las|laz|x3a|x3r)(?![a-z0-9])/i;

export const SCENE_UP_Z = new THREE.Vector3(0, 0, 1);

export function isZUpFormat(file: { fileName?: string; metadata?: { format?: unknown } }): boolean {
  const format = typeof file.metadata?.format === 'string' ? file.metadata.format : '';
  return Z_UP_FORMATS.has(format.toLowerCase()) || Z_UP_NAME.test(file.fileName ?? '');
}

export function shouldOrientZUp(
  files: Array<{ fileName?: string; metadata?: { format?: unknown } }>
): boolean {
  return files.some(isZUpFormat);
}

export interface SceneUpHost {
  camera: THREE.PerspectiveCamera;
  controls?: { target: THREE.Vector3; worldUp?: THREE.Vector3; update?: () => void } | null;
}

/** How far behind the capture origin the camera stands, in metres. */
const SCANNER_STANDOFF_METRES = 0.1;

function applySceneUp(host: SceneUpHost): void {
  host.camera.up.copy(SCENE_UP_Z);
  // Controls that keep their own up (TurntableControls) reapply it to the
  // camera while rotating, which would undo this on the first drag.
  host.controls?.worldUp?.copy(SCENE_UP_Z);
}

/**
 * Only meaningful before the first fit: it sets the up hint the subsequent
 * lookAt uses. Later loads must not touch it, or the user's own orientation
 * would be thrown away whenever a file is added.
 */
export function applyZUpOrientation(host: SceneUpHost): void {
  applySceneUp(host);
}

/**
 * Viewer-space position the scanner occupied, for formats that record it.
 *
 * Points are stored relative to a common origin (see the E57/LAS readers), so
 * this lands at or near (0, 0, 0) rather than out at the survey coordinates.
 */
export function scannerCapturePointFor(
  files: Array<{
    fileName?: string;
    sourceOrigin?: readonly number[];
    metadata?: Record<string, unknown>;
  }>
): THREE.Vector3 | null {
  for (const file of files) {
    const origin = file.sourceOrigin ?? [0, 0, 0];
    const pose = file.metadata?.pose as number[] | undefined;
    if (String(file.metadata?.format).toUpperCase() === 'E57' && pose?.length === 7) {
      return new THREE.Vector3(pose[0] - origin[0], pose[1] - origin[1], pose[2] - origin[2]);
    }
    // Stonex archives put the scanner at the model origin.
    if (file.metadata?.stonexCameraFrames || /\.(x3a|x3r)(?![a-z0-9])/i.test(file.fileName ?? '')) {
      return new THREE.Vector3(0, 0, 0);
    }
  }
  return null;
}

/**
 * Starts a terrestrial scan with its capture point at the view/orbit centre,
 * looking level into the scene. The eye needs a small non-zero offset from the
 * capture point because orbit controls cannot rotate a zero-length eye vector.
 */
export function applyScannerStartView(
  host: SceneUpHost,
  capturePoint: THREE.Vector3,
  objects: THREE.Object3D[]
): boolean {
  const box = new THREE.Box3();
  for (const object of objects) {
    box.expandByObject(object);
  }
  if (box.isEmpty()) {
    return false;
  }
  const centre = box.getCenter(new THREE.Vector3());
  const diagonal = box.getSize(new THREE.Vector3()).length();

  // Level gaze towards the bulk of the data. A scanner sitting at the centre
  // of its own scan gives no horizontal direction, so fall back to +X.
  const direction = centre.clone().sub(capturePoint).setZ(0);
  if (direction.lengthSq() < 1e-9) {
    direction.set(1, 0, 0);
  }
  direction.normalize();

  applySceneUp(host);
  // Pivot on the capture origin itself and stand just behind it, so orbiting
  // swings the view around the point the data was measured from rather than
  // around something out in the scene.
  host.camera.position.copy(capturePoint).addScaledVector(direction, -SCANNER_STANDOFF_METRES);
  host.camera.lookAt(capturePoint);
  host.camera.near = 0.01;
  host.camera.far = Math.max(diagonal * 20, 1000);
  host.camera.updateProjectionMatrix();
  if (host.controls) {
    host.controls.target.copy(capturePoint);
    host.controls.update?.();
  }
  return true;
}
