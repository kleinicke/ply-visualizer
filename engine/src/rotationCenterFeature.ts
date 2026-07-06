import * as THREE from 'three';
import { RotationCenterManager } from './RotationCenterManager';

export interface RotationCenterFeatureHost {
  controls: { target: THREE.Vector3; update(): void } & Partial<{
    removeEventListener(event: string, handler: any): void;
    addEventListener(event: string, handler: any): void;
  }>;
  camera: THREE.PerspectiveCamera;
  scene: THREE.Scene;
  rotationCenterManager: RotationCenterManager;
  requestRender(): void;
}

export function setRotationCenterToOrigin(host: RotationCenterFeatureHost): void {
  // Temporarily remove change listener to prevent continuous rendering
  const changeHandler = () => host.requestRender();
  if (host.controls) {
    (host.controls as any).removeEventListener('change', changeHandler);
  }

  // Set rotation center (target) to origin (0, 0, 0)
  host.controls.target.set(0, 0, 0);
  host.controls.update();

  // Update axes position to the new rotation center
  const axesGroup = (host as any).axesGroup;
  if (axesGroup) {
    axesGroup.position.copy(host.controls.target);
  }

  // Re-add change listener
  if (host.controls) {
    (host.controls as any).addEventListener('change', changeHandler);
  }

  // Show axes temporarily to indicate new rotation center
  const showAxesTemporarily = (host as any).showAxesTemporarily;
  if (showAxesTemporarily) {
    showAxesTemporarily();
  }

  // Single render request for the rotation center change
  host.requestRender();

  updateRotationOriginButtonState(host);
}

export function setRotationCenter(host: RotationCenterFeatureHost, point: THREE.Vector3): void {
  const axesGroup = (host as any).axesGroup;

  host.rotationCenterManager.setRotationCenter(
    point,
    host.camera,
    host.controls as any,
    axesGroup,
    {
      updateRotationOriginButtonState: () => updateRotationOriginButtonState(host),
      showAxesTemporarily: (host as any).showAxesTemporarily,
      requestRender: () => host.requestRender(),
    }
  );

  // Visual feedback
  showRotationCenterFeedback(host, host.controls.target);
}

export function showRotationCenterFeedback(
  host: RotationCenterFeatureHost,
  point: THREE.Vector3
): void {
  // Create a temporary visual indicator at the rotation center
  const geometry = new THREE.SphereGeometry(0.01, 8, 6);
  const material = new THREE.MeshBasicMaterial({
    color: 0xff0000,
    transparent: true,
    opacity: 0.8,
  });
  const sphere = new THREE.Mesh(geometry, material);
  sphere.position.copy(point);

  host.scene.add(sphere);

  // Remove the indicator after 2 seconds
  setTimeout(() => {
    host.scene.remove(sphere);
    geometry.dispose();
    material.dispose();
    host.requestRender();
  }, 2000);
}

export function updateRotationOriginButtonState(host: RotationCenterFeatureHost): void {
  const btn = document.getElementById('set-rotation-origin');
  if (!btn) {
    return;
  }
  const t = host.controls?.target;
  const atOrigin = !!t && Math.abs(t.x) < 1e-9 && Math.abs(t.y) < 1e-9 && Math.abs(t.z) < 1e-9;
  if (atOrigin) {
    btn.classList.add('active');
  } else {
    btn.classList.remove('active');
  }
}
