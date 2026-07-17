import { mount } from 'svelte';
import FilmPanel from './components/FilmPanel.svelte';

/**
 * Video-mode (camera keyframe) panel in the Camera tab. Rendered entirely
 * from state/film.svelte.js, which film/FilmManager.ts keeps in sync.
 */
export function mountFilmPanel(host: unknown): void {
  const target = document.getElementById('film-panel-mount');
  if (!target) {
    return;
  }
  mount(FilmPanel, { target, props: { host } });
}
