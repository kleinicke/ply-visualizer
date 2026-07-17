import * as THREE from 'three';
import { TrackballControls } from 'three/examples/jsm/controls/TrackballControls.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export interface AxesFeatureHost {
  controls: { target: THREE.Vector3; update(): void } & Partial<{
    addEventListener(event: string, handler: any): void;
  }>;
  camera: THREE.PerspectiveCamera;
  scene: THREE.Scene;
  controlType: 'trackball' | 'orbit' | 'legacy-trackball' | 'arcball';
  axesPermanentlyVisible: boolean;
  requestRender(): void;
  updateAxesButtonState(): void;
  updateRotationOriginButtonState(): void;
  showUpVectorFeedback(upVector: THREE.Vector3): void;
  updateAxesForUpVector(upVector: THREE.Vector3): void;
  showUpVectorIndicator(upVector: THREE.Vector3): void;
}

export function setupAxesVisibility(host: AxesFeatureHost): void {
  // Track interaction state for axes visibility
  let axesHideTimeout: ReturnType<typeof setTimeout> | null = null;

  const showAxes = () => {
    const axesGroup = (host as any).axesGroup;
    const axesPermanentlyVisible = (host as any).axesPermanentlyVisible;

    if (axesGroup && !axesPermanentlyVisible) {
      axesGroup.visible = true;

      if (axesHideTimeout) {
        clearTimeout(axesHideTimeout);
        axesHideTimeout = null;
      }
    }
  };

  const hideAxesAfterDelay = () => {
    if (axesHideTimeout) {
      clearTimeout(axesHideTimeout);
    }

    axesHideTimeout = setTimeout(() => {
      const axesGroup = (host as any).axesGroup;
      const axesPermanentlyVisible = (host as any).axesPermanentlyVisible;

      if (axesGroup && !axesPermanentlyVisible) {
        axesGroup.visible = false;
        host.requestRender();
      }
      axesHideTimeout = null;
    }, 500);
  };

  // Add event listeners for axes visibility based on control type
  if (
    host.controlType === 'trackball' ||
    host.controlType === 'legacy-trackball' ||
    host.controlType === 'arcball'
  ) {
    (host.controls as any).addEventListener('start', showAxes);
    (host.controls as any).addEventListener('end', hideAxesAfterDelay);
    (host.controls as any).addEventListener('change', () => host.requestRender());
  } else {
    const orbitControls = host.controls as OrbitControls;
    orbitControls.addEventListener('start', showAxes);
    orbitControls.addEventListener('end', hideAxesAfterDelay);
    orbitControls.addEventListener('change', () => host.requestRender());
  }

  // Initialize button state
  host.updateAxesButtonState();
  // Only mark rotation-origin button active if target is exactly at origin right now
  host.updateRotationOriginButtonState();
}

export function addAxesHelper(host: AxesFeatureHost): void {
  // Create a group to hold axes and labels
  const axesGroup = new THREE.Group();

  // Create coordinate axes helper (X=red, Y=green, Z=blue)
  const axesHelper = new THREE.AxesHelper(1); // Size of 1 unit
  axesGroup.add(axesHelper);

  // Create text labels for each axis
  createAxisLabels(host, axesGroup);

  // Scale the axes based on the scene size once we have objects
  // For now, use a reasonable default size
  axesGroup.scale.setScalar(0.5);

  // Position at the rotation center (initially at origin)
  axesGroup.position.copy(host.controls.target);

  // Initially hide the axes
  axesGroup.visible = false;

  // Add to scene
  host.scene.add(axesGroup);

  // Store reference for updating position and size
  (host as any).axesGroup = axesGroup;
  (host as any).axesHelper = axesHelper;
}

export function createAxisLabels(host: AxesFeatureHost, axesGroup: THREE.Group): void {
  // Function to create text texture (creates new canvas for each call)
  const createTextTexture = (text: string, color: string) => {
    // Create separate canvas for each texture
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;
    canvas.width = 256;
    canvas.height = 256;

    // Set text properties
    context.font = 'Bold 48px Arial';
    context.fillStyle = color;
    context.textAlign = 'center';
    context.textBaseline = 'middle';

    // Draw text
    context.fillText(text, canvas.width / 2, canvas.height / 2);

    // Create texture
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  };

  // Create materials for each axis label (each gets its own canvas)
  const xTexture = createTextTexture('X', '#ff0000');
  const yTexture = createTextTexture('Y', '#00ff00');
  const zTexture = createTextTexture('Z', '#0080ff');

  const labelMaterial = (texture: THREE.Texture) =>
    new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      alphaTest: 0.1,
    });

  // Create sprite labels
  const xLabel = new THREE.Sprite(labelMaterial(xTexture));
  const yLabel = new THREE.Sprite(labelMaterial(yTexture));
  const zLabel = new THREE.Sprite(labelMaterial(zTexture));

  // Scale labels appropriately
  const labelScale = 0.3;
  xLabel.scale.set(labelScale, labelScale, labelScale);
  yLabel.scale.set(labelScale, labelScale, labelScale);
  zLabel.scale.set(labelScale, labelScale, labelScale);

  // Position labels at the end of each axis (will be scaled with the group)
  xLabel.position.set(1.2, 0, 0); // X-axis end
  yLabel.position.set(0, 1.2, 0); // Y-axis end
  zLabel.position.set(0, 0, 1.2); // Z-axis end

  // Add labels to the group
  axesGroup.add(xLabel);
  axesGroup.add(yLabel);
  axesGroup.add(zLabel);

  // Store references for potential updates
  (host as any).axisLabels = { x: xLabel, y: yLabel, z: zLabel };
}

export function toggleAxesVisibility(host: AxesFeatureHost): void {
  const axesGroup = (host as any).axesGroup;
  if (!axesGroup) {
    return;
  }

  // Flip persistent visibility flag
  host.axesPermanentlyVisible = !host.axesPermanentlyVisible;

  // Apply visibility immediately
  axesGroup.visible = host.axesPermanentlyVisible;

  // When permanently visible, keep axes shown regardless of idle timeout in setupAxesVisibility
  // When turned off, allow setupAxesVisibility handlers to hide them after interactions

  host.requestRender();
}

export function updateAxesButtonState(host: AxesFeatureHost): void {
  const toggleBtn = document.getElementById('toggle-axes');
  if (!toggleBtn) {
    return;
  }
  // Active (blue) when axes are permanently visible
  if (host.axesPermanentlyVisible) {
    toggleBtn.classList.add('active');
    toggleBtn.innerHTML = 'Show Axes <span class="button-shortcut">A</span>';
  } else {
    toggleBtn.classList.remove('active');
    toggleBtn.innerHTML = 'Show Axes <span class="button-shortcut">A</span>';
  }
}

export function setUpVector(host: AxesFeatureHost, upVector: THREE.Vector3): void {
  // Normalize the up vector
  upVector.normalize();

  // Set the camera's up vector
  host.camera.up.copy(upVector);

  // Force the camera to look at the current target with the new up vector
  host.camera.lookAt(host.controls.target);

  // Update the controls (works for both TrackballControls and OrbitControls)
  host.controls.update();

  // Show feedback
  host.showUpVectorFeedback(upVector);

  // Update axes helper to match the new up vector
  host.updateAxesForUpVector(upVector);

  // Show visual indicator
  host.showUpVectorIndicator(upVector);
}

export function showUpVectorFeedback(_host: AxesFeatureHost, _upVector: THREE.Vector3): void {
  // Placeholder for future feedback UI; axis name resolution intentionally omitted.
}

export function updateAxesForUpVector(host: AxesFeatureHost, _upVector: THREE.Vector3): void {
  // Update the axes helper orientation to match the new up vector
  const axesGroup = (host as any).axesGroup;
  if (axesGroup) {
    // Simple approach: just update the axes to reflect the current coordinate system
  }
}

export function showUpVectorIndicator(host: AxesFeatureHost, upVector: THREE.Vector3): void {
  // Create a temporary arrow indicator showing the up direction
  const origin = new THREE.Vector3(0, 0, 0);
  const direction = upVector.clone();
  const length = 2;
  const color = 0xffff00; // Yellow

  const arrowHelper = new THREE.ArrowHelper(
    direction,
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
