import { mount, unmount } from 'svelte';
import type { ViewerLifetime } from './utils/viewerLifetime';
import SceneGuides from './components/SceneGuides.svelte';

export function mountSceneGuides(lifetime: ViewerLifetime, host: unknown): void {
  const container = document.getElementById('viewer-container');
  if (!container || document.getElementById('scene-guides-mount')) {
    return;
  }
  const target = document.createElement('div');
  target.id = 'scene-guides-mount';
  Object.assign(target.style, {
    position: 'absolute',
    inset: '0',
    pointerEvents: 'none',
    zIndex: '5',
  });
  container.appendChild(target);
  {
    const component = mount(SceneGuides, { target, props: { host } });
    lifetime.add(() => {
      void unmount(component);
    });
  }
}
