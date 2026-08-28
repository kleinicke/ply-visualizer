import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { EDLPass } from './postprocessing/EDLPass';
import { viewerState } from './state/viewer.svelte';
import { SpatialData } from './interfaces';
import { shouldUseVertexColors } from './colorMode';

export type EDLMode = 'auto' | 'all' | 'off';

const EDL_MODE_ORDER: readonly EDLMode[] = ['auto', 'all', 'off'];

export interface EDLHost {
  /**
   * Null on the WebGPU backend. EDL is an EffectComposer pass with raw GLSL and
   * has no WebGPU implementation, so the whole feature switches itself off
   * rather than half-working. See docs/WEBGPU_READINESS.md.
   */
  webglRenderer: THREE.WebGLRenderer | null;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  meshes: THREE.Object3D[];
  spatialFiles: SpatialData[];
  fileVisibility: boolean[];
  individualColorModes: string[];
  edlEnabled: boolean;
  edlMode: EDLMode;
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
  if (!host.webglRenderer) {
    host.edlEnabled = false;
    host.edlMode = 'off';
    viewerState.edlEnabled = false;
    viewerState.edlMode = 'off';
    console.log('🔦 EDL unavailable: the WebGPU backend has no EDL implementation');
    return;
  }

  const width = container.clientWidth;
  const height = container.clientHeight;

  // EffectComposer manages the post-processing pipeline
  host.effectComposer = new EffectComposer(host.webglRenderer);

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
 * Cycle Eye Dome Lighting through Auto, All and Off.
 */
export function toggleEDL(host: EDLHost): void {
  if (!host.effectComposer) {
    host.showStatus('Eye Dome Lighting is not available on the WebGPU backend');
    return;
  }
  const current = EDL_MODE_ORDER.indexOf(host.edlMode);
  host.edlMode = EDL_MODE_ORDER[(current + 1) % EDL_MODE_ORDER.length];
  host.edlEnabled = host.edlMode !== 'off';
  viewerState.edlEnabled = host.edlEnabled;
  viewerState.edlMode = host.edlMode;
  updateEDLButtonState(host);
  updateEDLSettingsVisibility(host);
  host.requestRender();
  const label = host.edlMode === 'auto' ? 'AUTO (uniform colours)' : host.edlMode.toUpperCase();
  host.showStatus(`Eye Dome Lighting: ${label}`);
  console.log(`🔦 EDL ${label}`);
}

/**
 * Visible point clouds whose active colour mode is a single material colour.
 * Per-point RGB, projected/recoloured, intensity and scalar colour modes are
 * deliberately excluded even if the source file also offers a flat mode.
 */
export function getAutoEDLPointClouds(host: EDLHost): THREE.Points[] {
  const eligible: THREE.Points[] = [];
  for (let index = 0; index < host.spatialFiles.length; index++) {
    const object = host.meshes[index];
    const data = host.spatialFiles[index];
    if (
      object instanceof THREE.Points &&
      host.fileVisibility[index] !== false &&
      object.visible &&
      !shouldUseVertexColors(data, host.individualColorModes[index] ?? 'assigned')
    ) {
      eligible.push(object);
    }
  }
  return eligible;
}

/** Prepare the pass for this frame and report whether it should run at all. */
export function prepareEDLFrame(host: EDLHost): boolean {
  if (!host.edlEnabled || host.edlMode === 'off' || !host.effectComposer || !host.edlPass) {
    return false;
  }
  if (host.edlMode === 'all') {
    host.edlPass.setEligibleObjects(null);
    return true;
  }
  const eligible = getAutoEDLPointClouds(host);
  host.edlPass.setEligibleObjects(eligible);
  return eligible.length > 0;
}

/**
 * Update EDL button active state.
 */
export function updateEDLButtonState(host: EDLHost): void {
  const btn = document.getElementById('toggle-edl');
  if (btn) {
    if (host.edlMode !== 'off') {
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
    settings.style.display = host.edlMode !== 'off' ? 'block' : 'none';
  }
}
