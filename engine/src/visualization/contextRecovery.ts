import { mount, unmount } from 'svelte';
import { writable } from 'svelte/store';
import type { ViewerLifetime } from '../utils/viewerLifetime';
import ContextRecovery from '../components/ContextRecovery.svelte';

export type ContextRecoveryState = 'running' | 'lost' | 'paused';

/** A restored context must not automatically replay a possibly oversized upload. */
export function setupContextRecovery(
  canvas: HTMLCanvasElement,
  lifetime: ViewerLifetime,
  pause: () => void,
  resume: () => void
): void {
  let current: ContextRecoveryState = 'running';
  const state = writable<ContextRecoveryState>(current);
  const set = (next: ContextRecoveryState) => {
    current = next;
    state.set(next);
  };
  const target = document.createElement('div');
  document.body.appendChild(target);
  const component = mount(ContextRecovery, {
    target,
    props: {
      state,
      resume: () => {
        if (current !== 'paused' || lifetime.disposed) {
          return;
        }
        set('running');
        resume();
      },
    },
  });
  lifetime.listen(canvas, 'webglcontextlost', event => {
    event.preventDefault();
    pause();
    set('lost');
  });
  lifetime.listen(canvas, 'webglcontextrestored', () => {
    // Three.js recreates its internal state. Leave scene uploads paused.
    set('paused');
  });
  lifetime.add(() => {
    void unmount(component);
    target.remove();
  });
}
