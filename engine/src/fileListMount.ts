import { mount } from 'svelte';
import FileList from './components/FileList.svelte';

/**
 * Phase 3 (docs/SVELTE_MIGRATION_PLAN.md): replaces the ~1,600-line
 * updateFileList() HTML-string-building block and its ~70 addEventListener
 * calls. FileList.svelte owns rendering; main.ts's updateFileList() just
 * bumps state/files.svelte.js's renderTick to trigger a re-render.
 */
export function mountFileList(host: unknown): void {
  const target = document.getElementById('file-list');
  if (!target) {
    return;
  }
  mount(FileList, { target, props: { host } });
}
