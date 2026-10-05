import { mount, unmount } from 'svelte';
import type { ViewerLifetime } from './utils/viewerLifetime';
import FilmPanel from './components/FilmPanel.svelte';

/**
 * Video-mode (camera keyframe) panel in the Camera tab. Rendered entirely
 * from state/film.svelte.js, which film/FilmManager.ts keeps in sync.
 */
export function mountFilmPanel(lifetime: ViewerLifetime, host: unknown): void {
  const target = document.getElementById('film-panel-mount');
  if (!target) {
    return;
  }
  {
    const component = mount(FilmPanel, { target, props: { host } });
    lifetime.add(() => {
      void unmount(component);
    });
  }
}
