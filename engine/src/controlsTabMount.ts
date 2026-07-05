import { mount } from 'svelte';
import ControlsTabTop from './components/ControlsTabTop.svelte';
import ControlsTabBottom from './components/ControlsTabBottom.svelte';
import CameraControlsPanel from './components/CameraControlsPanel.svelte';

/**
 * Phase 4 (docs/SVELTE_MIGRATION_PLAN.md): replaces the static Controls-tab
 * button grids and the camera-controls-panel innerHTML patching in
 * transformationMatrix.ts. The Theme section (index.html) stays untouched -
 * setupThemeSwitcher() wires it before PointCloudVisualizer even exists, so
 * folding it into one of these components would race that setup.
 */
export function mountControlsTab(host: unknown): void {
  const top = document.getElementById('controls-tab-top-mount');
  if (top) {
    mount(ControlsTabTop, { target: top, props: { host } });
  }
  const bottom = document.getElementById('controls-tab-bottom-mount');
  if (bottom) {
    mount(ControlsTabBottom, { target: bottom, props: { host } });
  }
  const camera = document.getElementById('camera-controls-panel');
  if (camera) {
    mount(CameraControlsPanel, { target: camera, props: { host } });
  }
}
