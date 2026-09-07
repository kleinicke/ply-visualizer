<script lang="ts">
  import { localSessionState as state } from '../state/localSession.svelte';
  let { fit }: { fit: () => void } = $props();
  function toggleSettings() {
    state.ui = state.ui === 'full' ? 'collapsed' : 'full';
    document.documentElement.dataset.sessionUi = state.ui;
  }
</script>

{#if state.ui !== 'none'}
  <div class="session-toolbar" aria-label="Training viewer">
    <button onclick={toggleSettings} aria-expanded={state.ui === 'full'}>Settings</button>
    <button onclick={fit}>Fit scene</button>
    <button onclick={() => state.paused = !state.paused} aria-pressed={state.paused}>
      {state.paused ? 'Resume updates' : 'Pause updates'}
    </button>
    {#if state.batches.length > 1}
      <select aria-label="Batch sample" bind:value={state.selected}>
        {#each state.batches as label, index}<option value={index}>{label}</option>{/each}
      </select>
    {/if}
    {#if state.step !== null}<span>Step {state.step}</span>{/if}
    {#if state.error}<span role="status">{state.error}</span>{/if}
  </div>
{/if}

<style>
  .session-toolbar { position: fixed; z-index: 1100; top: 10px; left: 10px;
    display: flex; flex-wrap: wrap; gap: 6px; max-width: calc(100% - 20px);
    align-items: center; padding: 6px; border-radius: 6px;
    background: var(--vscode-editor-background, #222); color: var(--vscode-foreground, white); }
  button, select {
    padding: 5px 8px;
    cursor: pointer;
    border: 1px solid var(--vscode-panel-border, #555);
    border-radius: 4px;
    background: var(--vscode-button-secondaryBackground, #333);
    color: var(--vscode-foreground, #eee);
    font: inherit;
    font-size: 12px;
  }
  :global(html[data-session-ui='collapsed'] #main-ui-panel),
  :global(html[data-session-ui='none'] #main-ui-panel),
  :global(html[data-session-ui='collapsed'] .bottom-right-nav),
  :global(html[data-session-ui='none'] .bottom-right-nav) { display: none !important; }
</style>
