import * as THREE from 'three';

/**
 * Type of rotation center behavior when double-clicking to set rotation center
 */
export type RotationCenterMode = 'move-camera' | 'keep-camera' | 'keep-distance';

/**
 * Interface for controls that have a target property
 */
interface ControlsWithTarget {
  target: THREE.Vector3;
  update(): void;
  removeEventListener?(event: string, handler: any): void;
  addEventListener?(event: string, handler: any): void;
}

/**
 * Manages rotation center behavior and UI state
 */
export class RotationCenterManager {
  private mode: RotationCenterMode = 'move-camera';

  /**
   * Get the current rotation center mode
   */
  getMode(): RotationCenterMode {
    return this.mode;
  }

  /**
   * Set the rotation center mode
   */
  setMode(mode: RotationCenterMode): void {
    this.mode = mode;
  }

  /**
   * Update the rotation center mode button states in the UI
   */
  updateModeButtons(): void {
    const moveCameraBtn = document.getElementById('rotation-center-move-camera');
    const keepCameraBtn = document.getElementById('rotation-center-keep-camera');
    const keepDistanceBtn = document.getElementById('rotation-center-keep-distance');

    if (moveCameraBtn) {
      if (this.mode === 'move-camera') {
        moveCameraBtn.classList.add('active');
      } else {
        moveCameraBtn.classList.remove('active');
      }
    }

    if (keepCameraBtn) {
      if (this.mode === 'keep-camera') {
        keepCameraBtn.classList.add('active');
      } else {
        keepCameraBtn.classList.remove('active');
      }
    }

    if (keepDistanceBtn) {
      if (this.mode === 'keep-distance') {
        keepDistanceBtn.classList.add('active');
      } else {
        keepDistanceBtn.classList.remove('active');
      }
    }
  }

  /**
   * Set the rotation center to a new point, adjusting camera and target based on current mode
   *
   * @param point - The 3D point to set as the new rotation center
   * @param camera - The Three.js camera
   * @param controls - The camera controls (trackball, orbit, etc.)
   * @param axesGroup - Optional axes helper group to update position
   * @param callbacks - Optional callbacks for UI updates and rendering
   */
  setRotationCenter(
    point: THREE.Vector3,
    camera: THREE.PerspectiveCamera,
    controls: ControlsWithTarget,
    axesGroup?: THREE.Group,
    callbacks?: {
      updateRotationOriginButtonState?: () => void;
      showAxesTemporarily?: () => void;
      requestRender?: () => void;
    }
  ): void {
    // Temporarily remove change listener to prevent continuous rendering
    const changeHandler = () => callbacks?.requestRender?.();
    if (controls && controls.removeEventListener) {
      controls.removeEventListener('change', changeHandler);
    }

    // Check if the point is too close to the camera or behind it
    const cameraToPoint = point.clone().sub(camera.position);
    const distance = cameraToPoint.length();
    const minDistance = 0.0001; // Minimum distance to prevent issues

    // If point is too close or behind camera, adjust it
    if (distance < minDistance) {
      // Move the point away from camera along the camera's forward direction
      const cameraDirection = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
      const adjustedPoint = camera.position
        .clone()
        .add(cameraDirection.multiplyScalar(minDistance));

      // Set the adjusted point as rotation center
      controls.target.copy(adjustedPoint);

      // Update axes position
      if (axesGroup) {
        axesGroup.position.copy(adjustedPoint);
      }

      callbacks?.updateRotationOriginButtonState?.();
    } else {
      // Point is at a safe distance, use it directly based on mode
      this.applyRotationCenterMode(point, camera, controls);

      // Update axes position to the new rotation center
      if (axesGroup) {
        axesGroup.position.copy(point);
      }

      callbacks?.updateRotationOriginButtonState?.();
    }

    // Show axes temporarily for 1 second to indicate new rotation center
    callbacks?.showAxesTemporarily?.();

    // Update controls
    controls.update();

    // Re-add change listener
    if (controls && controls.addEventListener) {
      controls.addEventListener('change', changeHandler);
    }

    // Request a render
    callbacks?.requestRender?.();
  }

  /**
   * Apply the rotation center behavior based on the current mode
   */
  private applyRotationCenterMode(
    point: THREE.Vector3,
    camera: THREE.PerspectiveCamera,
    controls: ControlsWithTarget
  ): void {
    if (this.mode === 'move-camera') {
      // Default behavior: Camera moves laterally on its view plane
      // The clicked point becomes centered in view without changing camera distance to view plane

      // Get camera's forward direction (view direction)
      const cameraForward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);

      // Get vector from old target to new point
      const targetShift = point.clone().sub(controls.target);

      // Project the shift onto the plane perpendicular to camera forward
      // This ensures we only move laterally (parallel to view plane)
      const projectedShift = targetShift
        .clone()
        .sub(cameraForward.clone().multiplyScalar(targetShift.dot(cameraForward)));

      // Set new rotation center
      controls.target.copy(point);

      // Move camera by the same lateral shift to keep it on the same view plane
      camera.position.add(projectedShift);
    } else if (this.mode === 'keep-distance') {
      // Keep distance behavior: Camera moves to maintain the same distance from new center
      // Calculate the current direction from camera to target
      const currentDirection = controls.target.clone().sub(camera.position).normalize();
      const currentDistance = camera.position.distanceTo(controls.target);

      // Set new rotation center
      controls.target.copy(point);

      // Move camera to maintain the same relative position and viewing direction
      // Keep the same distance from the new target
      const newCameraPosition = point.clone().sub(currentDirection.multiplyScalar(currentDistance));
      camera.position.copy(newCameraPosition);
    } else {
      // Keep camera behavior: Keep camera position fixed
      // Only the rotation target changes, camera stays in place
      controls.target.copy(point);
    }
  }
}
