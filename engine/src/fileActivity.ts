import { uiState } from './state/ui.svelte';

/** Let Svelte paint the busy dot before a synchronous, expensive update starts. */
function waitForActivityPaint(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => window.setTimeout(resolve, 0)));
}

/** Tracks one webview-side geometry or colour mutation for the shared activity dot. */
export async function runWithFileActivity<T>(task: () => T | Promise<T>): Promise<T> {
  uiState.backgroundChanges++;
  await waitForActivityPaint();
  try {
    return await task();
  } finally {
    uiState.backgroundChanges = Math.max(0, uiState.backgroundChanges - 1);
  }
}
