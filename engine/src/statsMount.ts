import { mount } from 'svelte';
import Stats from './components/Stats.svelte';

/**
 * Phase 4 (docs/SVELTE_MIGRATION_PLAN.md): replaces updateFileStats()'s
 * innerHTML building. main.ts's updateFileStats()/updateFileStatsImmediate()
 * just set state/files.svelte.js fields now.
 */
export function mountStats(host: unknown): void {
  const target = document.getElementById('file-stats-mount');
  if (!target) {
    return;
  }
  mount(Stats, { target, props: { host } });
}
