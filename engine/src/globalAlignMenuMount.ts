import { mount, unmount } from 'svelte';
import type { ViewerLifetime } from './utils/viewerLifetime';
import GlobalAlignMenu from './components/GlobalAlignMenu.svelte';

/**
 * The align control that sits beside "+ Add Point Cloud".
 *
 * Aligning was only reachable from inside an expanded file's own panel, which
 * hid the one operation that is about the whole scene rather than one file. The
 * component decides for itself whether to render anything (two or more clouds
 * with point data), so mounting is unconditional.
 */
export function mountGlobalAlignMenu(lifetime: ViewerLifetime, host: unknown): void {
  const target = document.getElementById('global-align-mount');
  if (!target) {
    return;
  }
  {
    const component = mount(GlobalAlignMenu, { target, props: { host } });
    lifetime.add(() => {
      void unmount(component);
    });
  }
}
