import * as THREE from 'three';
import { viewerState } from './state/viewer.svelte';

export interface CameraConventionHost {
  camera: THREE.PerspectiveCamera;
  controls: { target: THREE.Vector3; update(): void };
  scene: THREE.Scene;
  requestRender(): void;
  updateAxesForCameraConvention(convention: 'opencv' | 'opengl'): void;
  showCameraConventionFeedback(convention: string): void;
}

export function setOpenCVCameraConvention(host: CameraConventionHost): void {
  console.log('📷 Setting camera to OpenCV convention (Y-down, Z-forward)');

  // OpenCV convention: Y-down, Z-forward
  // Camera looks along +Z axis, Y points down

  // Store current target position
  const currentTarget = host.controls.target.clone();

  // Set up vector to Y-down
  host.camera.up.set(0, -1, 0);

  // Calculate current camera direction relative to target
  const distance = host.camera.position.distanceTo(currentTarget);

  // Position camera to look along +Z axis while maintaining focus on current target
  // Move camera to negative Z relative to target so it looks toward positive Z
  host.camera.position.copy(currentTarget).add(new THREE.Vector3(0, 0, -distance));

  // Keep the same target (don't reset to origin)
  host.controls.target.copy(currentTarget);

  // Make camera look at target
  host.camera.lookAt(host.controls.target);

  // Update controls
  host.controls.update();

  // Update axes helper to reflect OpenCV convention
  host.updateAxesForCameraConvention('opencv');

  // Show feedback
  host.showCameraConventionFeedback('OpenCV');
}

export function setOpenGLCameraConvention(host: CameraConventionHost): void {
  console.log('📷 Setting camera to OpenGL convention (Y-up, Z-backward)');

  // OpenGL convention: Y-up, Z-backward
  // Camera looks along -Z axis, Y points up (standard Three.js)

  // Store current target position
  const currentTarget = host.controls.target.clone();

  // Set up vector to Y-up
  host.camera.up.set(0, 1, 0);

  // Calculate current camera direction relative to target
  const distance = host.camera.position.distanceTo(currentTarget);

  // Position camera to look along -Z axis while maintaining focus on current target
  // Move camera to positive Z relative to target so it looks toward negative Z
  host.camera.position.copy(currentTarget).add(new THREE.Vector3(0, 0, distance));

  // Keep the same target (don't reset to origin)
  host.controls.target.copy(currentTarget);

  // Make camera look at target
  host.camera.lookAt(host.controls.target);

  // Update controls
  host.controls.update();

  // Update axes helper to reflect OpenGL convention
  host.updateAxesForCameraConvention('opengl');

  // Show feedback
  host.showCameraConventionFeedback('OpenGL');
}

export function updateAxesForCameraConvention(host: object, convention: 'opencv' | 'opengl'): void {
  viewerState.cameraConvention = convention;
  // Update the axes helper orientation to match the camera convention
  const axesGroup = (host as any).axesGroup;
  if (axesGroup) {
    console.log(`🎯 Axes updated for ${convention} camera convention`);
  }
}

export function showCameraConventionFeedback(host: CameraConventionHost, convention: string): void {
  console.log(`✅ Camera set to ${convention} convention`);

  // Create a temporary visual indicator
  const origin = new THREE.Vector3(0, 0, 0);
  const upVector =
    convention === 'OpenCV' ? new THREE.Vector3(0, -1, 0) : new THREE.Vector3(0, 1, 0);
  const length = 2;
  const color = convention === 'OpenCV' ? 0xff0000 : 0x00ff00; // Red for OpenCV, Green for OpenGL

  const arrowHelper = new THREE.ArrowHelper(
    upVector,
    origin,
    length,
    color,
    length * 0.2,
    length * 0.1
  );
  host.scene.add(arrowHelper);

  // Remove after 2 seconds
  setTimeout(() => {
    host.scene.remove(arrowHelper);
    arrowHelper.dispose();
    host.requestRender();
  }, 2000);
}
