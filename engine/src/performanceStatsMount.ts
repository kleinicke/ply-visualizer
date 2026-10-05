import { mount, unmount } from 'svelte';
import type { ViewerLifetime } from './utils/viewerLifetime';
import PerformanceStats from './components/PerformanceStats.svelte';

/**
 * Phase 2 leaf island (docs/SVELTE_MIGRATION_PLAN.md): the FPS/frame-time
 * readout is driven entirely by state/ui.svelte.ts's perfStatsText now -
 * renderStats.ts's updateFPSDisplay just sets the store field at the same
 * 250ms throttle interval it always used, no more direct DOM writes.
 */
export function mountPerformanceStats(lifetime: ViewerLifetime): void {
  const target = document.getElementById('performance-stats-mount');
  if (!target) {
    return;
  }
  {
    const component = mount(PerformanceStats, { target });
    lifetime.add(() => {
      void unmount(component);
    });
  }
}
