import { mount, unmount } from 'svelte';
import type { ViewerLifetime } from './utils/viewerLifetime';
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
export function mountControlsTab(lifetime: ViewerLifetime, host: unknown): void {
  const top = document.getElementById('controls-tab-top-mount');
  if (top) {
    {
      const component = mount(ControlsTabTop, { target: top, props: { host } });
      lifetime.add(() => {
        void unmount(component);
      });
    }
  }
  const bottom = document.getElementById('controls-tab-bottom-mount');
  if (bottom) {
    {
      const component = mount(ControlsTabBottom, { target: bottom, props: { host } });
      lifetime.add(() => {
        void unmount(component);
      });
    }
  }
  const camera = document.getElementById('camera-controls-panel');
  if (camera) {
    {
      const component = mount(CameraControlsPanel, { target: camera, props: { host } });
      lifetime.add(() => {
        void unmount(component);
      });
    }
  }
}
