import { mount } from 'svelte';
import SequenceControls from './components/SequenceControls.svelte';

/**
 * Phase 2 leaf island (docs/SVELTE_MIGRATION_PLAN.md): the sequence playback
 * bar is driven entirely by state/ui.svelte.ts now. This also fixes a
 * pre-existing bug where the bar's visibility toggle targeted a
 * `#sequence-overlay` element that no longer exists in index.html (and the
 * play/pause button looked for `#seq-play`/`#seq-pause`/`#seq-stop` ids that
 * were never in the markup, which only has a single `#seq-play-pause`
 * toggle) - the bar was always hidden and the toggle button never worked.
 */
export function mountSequenceControls(callbacks: {
  onPlayPause: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSeek: (index: number) => void;
}): void {
  const target = document.getElementById('sequence-controls-mount');
  if (!target) {
    return;
  }
  mount(SequenceControls, { target, props: callbacks });
}
