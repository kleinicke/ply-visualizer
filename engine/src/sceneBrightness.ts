import * as THREE from 'three';
import { SpatialData } from './interfaces';

export interface SceneBrightnessHost {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  brightnessStops: number;
  backgroundBrightness: number;
  convertSrgbToLinear: boolean;
  useLinearColorSpace: boolean;
  spatialFiles: SpatialData[];
  meshes: (THREE.Mesh | THREE.Points | THREE.LineSegments | null)[];
  individualColorModes: string[];
  showStatus(message: string): void;
  requestRender(): void;
  updateGammaButtonState(): void;
  applyColorModeToGeometry(
    data: SpatialData,
    geometry: THREE.BufferGeometry,
    colorMode: string
  ): void;
  shouldUseVertexColors(data: SpatialData, colorMode: string): boolean;
  setupPointSrgbDecode(material: THREE.PointsMaterial): void;
  pointColorsNeedSrgbDecode(data: SpatialData, colorMode: string): boolean;
}

export function updateRendererColorSpace(host: SceneBrightnessHost): void {
  // Always output sRGB for correct display on standard monitors
  host.renderer.outputColorSpace = THREE.SRGBColorSpace;
  // concise summary already printed elsewhere
}

export function applySceneBrightness(host: SceneBrightnessHost): void {
  // Exposure affects rendered geometry, while the renderer clear/background color stays separate.
  host.renderer.toneMapping = THREE.LinearToneMapping;
  host.renderer.toneMappingExposure = Math.pow(2, host.brightnessStops);
}

export function getBackgroundCssColor(host: SceneBrightnessHost): string {
  const channel = THREE.MathUtils.clamp(
    Math.round((host.backgroundBrightness / 100) * 255),
    0,
    255
  );
  return `#${channel.toString(16).padStart(2, '0').repeat(3)}`;
}

export function getBackgroundBrightnessLabel(host: SceneBrightnessHost): string {
  return `${Math.round(host.backgroundBrightness)}% (${getBackgroundCssColor(host)})`;
}

export function applyBackgroundBrightness(host: SceneBrightnessHost): void {
  const backgroundColor = getBackgroundCssColor(host);
  host.scene.background = null;
  if (host.renderer) {
    host.renderer.setClearColor(0x000000, 0);
    host.renderer.setClearAlpha(0);
    host.renderer.domElement.style.backgroundColor = backgroundColor;
    host.renderer.domElement.style.filter = '';
  }
}

export function toggleGammaCorrection(host: SceneBrightnessHost): void {
  // Toggle whether we convert sRGB source colors to linear
  host.convertSrgbToLinear = !host.convertSrgbToLinear;
  // Keep the legacy flag loosely in sync (not used elsewhere for logic)
  host.useLinearColorSpace = !host.convertSrgbToLinear;
  const statusMessage = host.convertSrgbToLinear
    ? 'Treat source colors as sRGB (convert to linear before shading)'
    : 'Treat source colors as linear (no sRGB-to-linear conversion)';
  host.showStatus(statusMessage);
  host.updateGammaButtonState();
  // Rebuild color attributes to reflect new conversion setting
  rebuildAllColorAttributesForCurrentGammaSetting(host);
  host.requestRender();
}

export function updateGammaButtonState(host: SceneBrightnessHost): void {
  const btn = document.getElementById('toggle-gamma-correction');
  if (!btn) {
    return;
  }
  // Active (blue) when we apply additional gamma (i.e., we do NOT convert input sRGB → linear)
  // This matches the UX: blue means extra gamma appearance compared to default pipeline
  if (!host.convertSrgbToLinear) {
    btn.classList.add('active');
  } else {
    btn.classList.remove('active');
  }
  // Keep label text unchanged per request
}

export function rebuildAllColorAttributesForCurrentGammaSetting(host: SceneBrightnessHost): void {
  // Update colors for all meshes based on current convertSrgbToLinear flag
  try {
    for (let i = 0; i < host.spatialFiles.length && i < host.meshes.length; i++) {
      const spatialData = host.spatialFiles[i];
      const mesh = host.meshes[i];
      if (!mesh || !spatialData) {
        continue;
      }
      const geometry = (mesh as any).geometry;
      const colorMode = host.individualColorModes[i] || 'assigned';

      host.applyColorModeToGeometry(spatialData, geometry, colorMode);

      if (mesh instanceof THREE.Points && mesh.material instanceof THREE.PointsMaterial) {
        mesh.material.vertexColors = host.shouldUseVertexColors(spatialData, colorMode);
        // Point colors are raw 8-bit sRGB now; the gamma toggle flips in-shader
        // decoding rather than rebuilding the color array.
        host.setupPointSrgbDecode(mesh.material);
        mesh.material.userData.srgbDecode = host.pointColorsNeedSrgbDecode(spatialData, colorMode);
        mesh.material.needsUpdate = true;
      }
    }
  } catch (err) {
    console.warn('Gamma rebuild failed:', err);
  }
}
