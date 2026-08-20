<script lang="ts">
  import { filesState } from '../state/files.svelte';
  import { registrationState } from '../state/registration.svelte';
  import * as registration from '../registrationFeature';

  let { host, fileIndex }: { host: any; fileIndex: number } = $props();

  let open = $state(false);

  // Recomputed on the file list's render tick rather than reactively: files
  // load and unload through main.ts's parallel arrays, which are not
  // themselves reactive.
  const candidates = $derived(
    filesState.renderTick >= 0 ? registration.registrationCandidates(host, fileIndex) : []
  );
  // This panel's cloud is the anchor. The selected *other* cloud moves onto it.
  const active = $derived(registrationState.targetIndex === fileIndex);
  const movingIndex = $derived(active ? registrationState.sourceIndex : null);
  const picking = $derived(active && registrationState.picking);

  function fileLabel(index: number): string {
    const data = host.spatialFiles?.[index];
    return data?.fileName || `File ${index + 1}`;
  }

  function toggle() {
    open = !open;
    if (open && candidates.length > 0 && !active) {
      registration.beginSession(host, candidates[0], fileIndex);
    }
  }

  function onTargetChange(event: Event) {
    const value = Number((event.currentTarget as HTMLSelectElement).value);
    registration.beginSession(host, value, fileIndex);
  }

  function togglePicking() {
    if (!active) {
      return;
    }
    registration.setPicking(host, !registrationState.picking);
  }
</script>

{#if candidates.length > 0}
  <div class="registration-section">
    <button class="registration-toggle" data-file-index={fileIndex} onclick={toggle}>
      <span class="toggle-icon">{open ? '▼' : '▶'}</span> Align one cloud to this one
    </button>

    {#if open}
      <!-- Deliberately just the one-pair workspace. Aligning everything, undoing
           it, colouring the archive and its scope all belong to the whole scene
           and live in the Align menu beside "+ Add Point Cloud"; duplicating
           them here is how two copies of one control end up disagreeing. -->
      <div class="pair-panel">
        <div class="pair-header">
          <span class="pair-fixed" title={fileLabel(fileIndex)}
            >Fixed: {fileLabel(fileIndex)}</span
          >
        </div>

        <label class="pair-row" for={`registration-target-${fileIndex}`}>
          <span>Move</span>
          <select
            id={`registration-target-${fileIndex}`}
            value={movingIndex ?? candidates[0]}
            onchange={onTargetChange}
          >
            {#each candidates as candidate (candidate)}
              <option value={candidate}>{fileLabel(candidate)}</option>
            {/each}
          </select>
        </label>

        <!-- Two routes to the same place, in the order you would reach for
             them: let the solver try, or show it three points when it cannot. -->
        <div class="pair-route">
          <div class="pair-route-head">Solve it</div>
          <div class="pair-actions">
            <button
              class="registration-coarse pair-primary"
              onclick={() => registration.autoAlign(host)}
              disabled={!active || registrationState.busy}
              title="Yaw sweep, then refine the best few hypotheses"
            >
              Auto-align
            </button>
            <button
              class="registration-icp"
              onclick={() => registration.refineIcp(host)}
              disabled={!active || registrationState.busy}
              title="ICP from where the cloud sits now"
            >
              Refine (ICP)
            </button>
            <button
              class="registration-undo"
              onclick={() => registration.undo(host)}
              disabled={!active || !registrationState.canUndo || registrationState.busy}
            >
              Undo
            </button>
          </div>
        </div>

        <div class="pair-route">
          <div class="pair-route-head">
            Or point at it
            {#if registrationState.pairCount > 0 || registrationState.awaiting}
              <span class="pair-count">{registrationState.pairCount} pair{registrationState.pairCount === 1 ? '' : 's'}</span>
            {/if}
          </div>
          <div class="pair-actions">
            <button
              class="registration-pick pair-primary"
              class:active={picking}
              onclick={togglePicking}
              disabled={!active || registrationState.busy}
            >
              {picking ? 'Stop picking' : 'Pick pairs'}
            </button>
            <button
              class="registration-fit"
              onclick={() => registration.alignFromPairs(host)}
              disabled={!active || registrationState.pairCount < 3 || registrationState.busy}
            >
              Fit
            </button>
            <button
              class="registration-undo-pair"
              onclick={() => registration.removeLastPair(host)}
              disabled={!active || (registrationState.pairCount === 0 && !registrationState.awaiting)}
            >
              Undo pick
            </button>
            <button
              class="registration-clear"
              onclick={() => registration.clearPairs(host)}
              disabled={!active || registrationState.pairCount === 0}
            >
              Clear
            </button>
          </div>
          {#if picking}
            <p class="pair-hint">
              {#if registrationState.awaiting === 'target'}
                Now the same feature on this fixed cloud.
              {:else}
                Double-click a feature on “{movingIndex === null
                  ? 'the moving cloud'
                  : fileLabel(movingIndex)}”.
              {/if}
              Three pairs are the minimum; four or more spread around the overlap are better.
            </p>
          {/if}
        </div>

        {#if active && registrationState.status}
          <div class="pair-status">{registrationState.status}</div>
        {/if}
        {#if active && registrationState.result}
          <div class="pair-status registration-result">{registrationState.result}</div>
        {/if}
      </div>
    {/if}
  </div>
{/if}

<style>
  .registration-section {
    margin-top: 6px;
  }
  .registration-toggle {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 2px;
    background: none;
    border: none;
    color: var(--vscode-foreground);
    cursor: pointer;
    font-size: 10px;
  }
  .pair-panel {
    background-color: var(--vscode-editor-background);
    border: 1px solid var(--vscode-panel-border);
    border-radius: 4px;
    padding: 8px;
    margin-top: 4px;
    font-size: 11px;
  }
  .pair-header {
    margin-bottom: 5px;
  }
  .pair-fixed {
    display: block;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .pair-row {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 8px;
  }
  .pair-row select {
    flex: 1;
    min-width: 0;
    font-size: 11px;
  }
  .pair-route + .pair-route {
    margin-top: 8px;
    border-top: 1px solid var(--vscode-panel-border);
    padding-top: 7px;
  }
  .pair-route-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    font-weight: 600;
    margin-bottom: 4px;
  }
  .pair-count {
    font-weight: 400;
    opacity: 0.7;
  }
  .pair-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 3px;
  }
  .pair-actions button {
    font-size: 11px;
  }
  .pair-primary {
    background-color: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: none;
    border-radius: 3px;
    padding: 4px 10px;
    cursor: pointer;
  }
  .pair-primary:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .pair-hint {
    margin: 5px 0 0;
    opacity: 0.7;
    line-height: 1.4;
  }
  .pair-status {
    margin-top: 6px;
    opacity: 0.85;
  }
</style>
