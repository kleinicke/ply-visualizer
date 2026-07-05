import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { EDLPass } from './postprocessing/EDLPass';

export interface EDLHost {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  edlEnabled: boolean;
  edlStrength: number;
  edlRadius: number;
  edlSecondRingWeight: number;
  effectComposer: EffectComposer | null;
  edlPass: EDLPass | null;
  requestRender(): void;
  showStatus(message: string): void;
}

export function initEDLComposer(host: EDLHost): void {
  const container = document.getElementById('viewer-container');
  if (!container) {
    return;
  }

  const width = container.clientWidth;
  const height = container.clientHeight;

  // EffectComposer manages the post-processing pipeline
  host.effectComposer = new EffectComposer(host.renderer);

  // EDLPass handles both scene rendering and the EDL effect in one pass
  host.edlPass = new EDLPass(host.scene, host.camera, width, height, {
    strength: host.edlStrength,
    radius: host.edlRadius,
    secondRingWeight: host.edlSecondRingWeight,
  });
  host.edlPass.renderToScreen = true;
  host.effectComposer.addPass(host.edlPass);

  console.log('🔦 EDL post-processing pipeline initialized');
}

/**
 * Toggle Eye Dome Lighting on/off.
 */
export function toggleEDL(host: EDLHost): void {
  host.edlEnabled = !host.edlEnabled;
  updateEDLButtonState(host);
  updateEDLSettingsVisibility(host);
  host.requestRender();
  host.showStatus(`Eye Dome Lighting: ${host.edlEnabled ? 'ON' : 'OFF'}`);
  console.log(`🔦 EDL ${host.edlEnabled ? 'enabled' : 'disabled'}`);
}

/**
 * Update EDL button active state.
 */
export function updateEDLButtonState(host: EDLHost): void {
  const btn = document.getElementById('toggle-edl');
  if (btn) {
    if (host.edlEnabled) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  }
}

/**
 * Show/hide the EDL strength and radius sliders.
 */
export function updateEDLSettingsVisibility(host: EDLHost): void {
  const settings = document.getElementById('edl-settings');
  if (settings) {
    settings.style.display = host.edlEnabled ? 'block' : 'none';
  }
}
