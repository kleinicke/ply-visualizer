import { mount } from 'svelte';
import TabNav from './components/TabNav.svelte';

/**
 * Phase 6 (docs/SVELTE_MIGRATION_PLAN.md): replaces the static
 * .tab-navigation button row and its manual addEventListener wiring in
 * setupEventListeners(). Active-tab highlighting reads uiState.activeTab,
 * which switchTab() (ui/status.ts) already wrote through to since Phase 1.
 */
export function mountTabNav(host: unknown): void {
  const target = document.getElementById('tab-nav-mount');
  if (!target) {
    return;
  }
  mount(TabNav, { target, props: { host } });
}
