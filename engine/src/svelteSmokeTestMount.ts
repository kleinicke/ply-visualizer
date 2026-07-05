import { mount } from 'svelte';
import SvelteSmokeTest from './components/SvelteSmokeTest.svelte';

/**
 * Phase 0 tooling smoke test (docs/SVELTE_MIGRATION_PLAN.md). Mounts an
 * invisible marker element so Playwright / the extension test suite can
 * assert the Svelte pipeline actually ran inside the real webview bundle.
 * Remove this file and its call site once Phase 0 is confirmed via F5.
 */
export function mountSvelteSmokeTest(): void {
  const target = document.createElement('div');
  target.id = 'svelte-smoke-test-root';
  target.style.display = 'none';
  document.body.appendChild(target);
  mount(SvelteSmokeTest, { target });
}
