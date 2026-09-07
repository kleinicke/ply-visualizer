import { mount } from 'svelte';
import SceneGuides from './components/SceneGuides.svelte';

export function mountSceneGuides(host: unknown): void {
  const container = document.getElementById('viewer-container');
  if (!container || document.getElementById('scene-guides-mount')) {return;}
  const target = document.createElement('div');
  target.id = 'scene-guides-mount';
  Object.assign(target.style, {
    position: 'absolute',
    inset: '0',
    pointerEvents: 'none',
    zIndex: '5',
  });
  container.appendChild(target);
  mount(SceneGuides, { target, props: { host } });
}
