import { mount, unmount } from 'svelte';
import SoloBar from './components/SoloBar.svelte';
import type { SoloController } from './soloMode';
import type { ViewerLifetime } from './utils/viewerLifetime';

/** Floating solo bar over the viewport; created here so every host gets it. */
export function mountSoloBar(
  lifetime: ViewerLifetime,
  solo: SoloController,
  sequenceMode: () => boolean
): void {
  const target = document.createElement('div');
  target.id = 'solo-bar-mount';
  document.body.appendChild(target);
  const component = mount(SoloBar, { target, props: { solo, sequenceMode } });
  lifetime.add(() => {
    void unmount(component);
    target.remove();
  });
}
