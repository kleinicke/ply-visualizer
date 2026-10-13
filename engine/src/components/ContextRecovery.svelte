<script lang="ts">
  import type { Readable } from 'svelte/store';
  import type { ContextRecoveryState } from '../visualization/contextRecovery';
  let { state, resume }: { state: Readable<ContextRecoveryState>; resume: () => void } = $props();
</script>

{#if $state === 'lost' || $state === 'paused'}
  <aside class="context-recovery" role="alert" aria-label="GPU recovery">
    <strong>Rendering paused after a GPU reset</strong>
    <p>
      The graphics context was lost. This can happen under memory pressure or after a driver
      reset. Remove large files or close other viewers before resuming.
    </p>
    {#if $state === 'lost'}
      <p>Waiting for the graphics context to recover. If it does not recover, reopen this viewer.</p>
    {/if}
    <button onclick={resume} disabled={$state !== 'paused'}>Resume rendering</button>
  </aside>
{/if}

<style>
  .context-recovery {
    position: fixed;
    bottom: 16px;
    left: 16px;
    max-width: min(420px, calc(100vw - 64px));
    padding: 16px;
    z-index: 10000;
    border: 1px solid var(--vscode-focusBorder, #888);
    border-radius: 6px;
    background: var(--vscode-editor-background, #252526);
    color: var(--vscode-editor-foreground, #eee);
    box-shadow: 0 2px 12px #0006;
  }
  p { margin: 8px 0; }
</style>
