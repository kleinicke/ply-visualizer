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
  const active = $derived(registrationState.sourceIndex === fileIndex);
  const targetIndex = $derived(active ? registrationState.targetIndex : null);

  function fileLabel(index: number): string {
    const data = host.spatialFiles?.[index];
    return data?.fileName || `File ${index + 1}`;
  }

  function toggle() {
    open = !open;
    if (open && candidates.length > 0 && !active) {
      registration.beginSession(host, fileIndex, candidates[0]);
    }
  }

  function onTargetChange(event: Event) {
    const value = Number((event.currentTarget as HTMLSelectElement).value);
    registration.beginSession(host, fileIndex, value);
  }

  function togglePicking() {
    if (!active) {
      return;
    }
    registration.setPicking(host, !registrationState.picking);
  }
</script>

{#if candidates.length > 0}
  <div class="registration-section" style="margin-top:6px;">
    <button
      class="registration-toggle"
      data-file-index={fileIndex}
      style="background:none;border:none;color:var(--vscode-foreground);cursor:pointer;display:flex;align-items:center;gap:4px;padding:2px;font-size:10px;"
      onclick={toggle}
    >
      <span class="toggle-icon">{open ? '▼' : '▶'}</span> Align to another cloud
    </button>

    {#if open}
      <div
        class="registration-content"
        style="background:var(--vscode-editor-background);border:1px solid var(--vscode-panel-border);border-radius:4px;padding:8px;margin-top:4px;font-size:10px;"
      >
        <div style="margin-bottom:6px;">
          <label for={`registration-target-${fileIndex}`} style="font-weight:bold;">Keep fixed:</label>
          <select
            id={`registration-target-${fileIndex}`}
            style="width:100%;margin-top:2px;font-size:10px;"
            value={targetIndex ?? candidates[0]}
            onchange={onTargetChange}
          >
            {#each candidates as candidate (candidate)}
              <option value={candidate}>{fileLabel(candidate)}</option>
            {/each}
          </select>
        </div>

        <div style="margin-bottom:6px;">
          <span style="font-weight:bold;">1 · Manual pairs</span>
          <div class="transform-buttons" style="margin-top:3px;">
            <button
              class="registration-pick"
              class:active={active && registrationState.picking}
              onclick={togglePicking}
              disabled={!active || registrationState.busy}
            >
              {active && registrationState.picking ? 'Stop picking' : 'Pick pairs'}
            </button>
            <button
              class="registration-fit"
              onclick={() => registration.alignFromPairs(host)}
              disabled={!active || registrationState.pairCount < 3 || registrationState.busy}
            >
              Fit ({registrationState.pairCount})
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
          {#if active && registrationState.picking}
            <p class="setting-description" style="margin:3px 0 0;">
              Double-click a feature on this cloud, then the same feature on the fixed one. Three
              pairs are the minimum; four or more spread around the overlap are better.
            </p>
          {/if}
        </div>

        <div style="margin-bottom:6px;">
          <span style="font-weight:bold;">2 · Automatic</span>
          <div class="transform-buttons" style="margin-top:3px;align-items:center;">
            <button
              class="registration-coarse"
              onclick={() => registration.autoAlign(host)}
              disabled={!active || registrationState.busy}
            >
              Auto-align
            </button>
            <label for={`registration-up-${fileIndex}`} style="margin-left:4px;">Up:</label>
            <select
              id={`registration-up-${fileIndex}`}
              style="font-size:10px;"
              bind:value={registrationState.upAxis}
            >
              <option value="z">Z</option>
              <option value="y">Y</option>
              <option value="x">X</option>
            </select>
          </div>
          <p class="setting-description" style="margin:3px 0 0;">
            Sweeps yaw, then refines the best few hypotheses and keeps the one that fits. Assumes
            both scans are level, so it only searches yaw and translation - true for a tripod
            scanner, wrong for a handheld or drone capture. Takes a few seconds per station pair.
          </p>
        </div>

        <div style="margin-bottom:6px;">
          <span style="font-weight:bold;">3 · Refine further</span>
          <div class="transform-buttons" style="margin-top:3px;">
            <button
              class="registration-icp"
              onclick={() => registration.refineIcp(host)}
              disabled={!active || registrationState.busy}
            >
              Refine (ICP)
            </button>
            <button
              class="registration-undo"
              onclick={() => registration.undo(host)}
              disabled={!active || !registrationState.canUndo || registrationState.busy}
            >
              Undo align
            </button>
          </div>
        </div>

        {#if active && registrationState.status}
          <div class="registration-status" style="margin-top:4px;opacity:0.8;">
            {registrationState.status}
          </div>
        {/if}
        {#if active && registrationState.result}
          <div class="registration-result" style="margin-top:4px;font-family:monospace;">
            {registrationState.result}
          </div>
        {/if}

        <p class="setting-description" style="margin:6px 0 0;">
          Viewing aid, not a survey adjustment: pairs are aligned one at a time with no network
          balancing or loop closure. The result lands in this file's transform matrix above.
        </p>
      </div>
    {/if}
  </div>
{/if}
