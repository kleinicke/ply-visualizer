import { mount, unmount } from 'svelte';
import type { ViewerLifetime } from './utils/viewerLifetime';
import LoadingOverlay from './components/LoadingOverlay.svelte';

/**
 * Deferred follow-up from docs/SVELTE_MIGRATION_PLAN.md's Svelte migration:
 * the centered first-load spinner is now driven entirely by
 * state/ui.svelte.ts - showLoading()/showImmediateLoading()/setLoadingDetail()
 * in main.ts just set store fields, this component renders them.
 */
export function mountLoadingOverlay(lifetime: ViewerLifetime): void {
  const target = document.getElementById('loading-mount');
  if (!target) {
    return;
  }
  {
    const component = mount(LoadingOverlay, { target });
    lifetime.add(() => {
      void unmount(component);
    });
  }
}
