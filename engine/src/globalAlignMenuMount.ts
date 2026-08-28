import { mount } from 'svelte';
import GlobalAlignMenu from './components/GlobalAlignMenu.svelte';

/**
 * The align control that sits beside "+ Add Point Cloud".
 *
 * Aligning was only reachable from inside an expanded file's own panel, which
 * hid the one operation that is about the whole scene rather than one file. The
 * component decides for itself whether to render anything (two or more clouds
 * with point data), so mounting is unconditional.
 */
export function mountGlobalAlignMenu(host: unknown): void {
  const target = document.getElementById('global-align-mount');
  if (!target) {
    return;
  }
  mount(GlobalAlignMenu, { target, props: { host } });
}
