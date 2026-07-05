import { mount } from 'svelte';
import ErrorOverlay from './components/ErrorOverlay.svelte';

/**
 * Phase 2 leaf island (docs/SVELTE_MIGRATION_PLAN.md): the error overlay is
 * driven entirely by state/ui.svelte.ts now - ui/status.ts's
 * showError/clearError just set store fields, this component renders them.
 */
export function mountErrorOverlay(): void {
  const target = document.getElementById('error-mount');
  if (!target) {
    return;
  }
  mount(ErrorOverlay, { target });
}
