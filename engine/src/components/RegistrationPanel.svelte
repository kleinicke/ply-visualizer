<script lang="ts">
  import { filesState } from '../state/files.svelte';
  import { registrationState } from '../state/registration.svelte';
  import * as registration from '../registrationFeature';

  let {
    host,
    fileIndex,
    // Rendered inside the Align menu rather than inside a file's row: there is
    // no disclosure of its own then, and the fixed cloud comes from the menu's
    // selector instead of from which row you opened.
    embedded = false,
  }: { host: any; fileIndex: number; embedded?: boolean } = $props();

  let open = $state(false);
  const shown = $derived(embedded || open);

  // Embedded, the session follows the caller's choice of fixed cloud.
  $effect(() => {
    if (embedded && candidates.length > 0 && registrationState.targetIndex !== fileIndex) {
      registration.beginSession(host, candidates[0], fileIndex);
    }
  });

  // Recomputed on the file list's render tick rather than reactively: files
  // load and unload through main.ts's parallel arrays, which are not
  // themselves reactive.
  const candidates = $derived(
    filesState.renderTick >= 0 ? registration.registrationCandidates(host, fileIndex) : []
  );
  // This panel's cloud is the anchor. The selected *other* cloud moves onto it.
  const active = $derived(registrationState.targetIndex === fileIndex);
  const movingIndex = $derived(active ? registrationState.sourceIndex : null);
  const workflow = $derived(active ? registrationState.workflow : 'choose');

  // Which step the workflow is on, and therefore which side the next click
  // belongs to. `viewOverride` changes what is *shown*, never whose turn it is.
  const coarseStep = $derived(workflow.startsWith('coarse'));
  const onFixedStep = $derived(workflow === 'coarse-fixed' || workflow === 'fine-fixed');
  const shownSide = $derived(
    registrationState.viewOverride ??
      (onFixedStep ? 'fixed' : workflow === 'choose' ? 'both' : 'moving')
  );
  const fixedPicked = $derived(
    coarseStep
      ? registrationState.coarseFixedCount
      : registrationState.pairCount + (registrationState.awaiting === 'source' ? 1 : 0)
  );
  const movingPicked = $derived(
    coarseStep
      ? registrationState.coarseMovingCount
      : registrationState.pairCount + (registrationState.awaiting === 'target' ? 1 : 0)
  );
  /**
   * One chip per pick so far: complete pairs, plus the half-finished one.
   * Seeing three chips where you expected two is how a mis-click gets caught
   * before it becomes a bad correspondence.
   */
  const picks = $derived.by(() => {
    const out = [];
    if (coarseStep) {
      for (let i = 0; i < registrationState.coarseFixedCount; i++) {
        out.push({ state: i < registrationState.coarseMovingCount ? 'pair' : 'fixed' });
      }
    } else {
      for (let i = 0; i < registrationState.pairCount; i++) out.push({ state: 'pair' });
      if (registrationState.awaiting === 'source') out.push({ state: 'fixed' });
      else if (registrationState.awaiting === 'target') out.push({ state: 'moving' });
    }
    return out;
  });

  const worstCoarseResidual = $derived(
    registrationState.coarseResiduals.length > 0
      ? Math.max(...registrationState.coarseResiduals)
      : 0
  );

  // Scene units are metres on every scanner archive this is used with, and a
  // three-point fit lands in the centimetre range, so millimetres are the
  // resolution that makes one bad landmark stand out.
  function formatResidual(value: number): string {
    return value < 1 ? `${(value * 1000).toFixed(0)} mm` : `${value.toFixed(3)} m`;
  }

  function fileLabel(index: number): string {
    const data = host.spatialFiles?.[index];
    return data?.fileName || `File ${index + 1}`;
  }

  function toggle() {
    open = !open;
    if (open && candidates.length > 0 && !active) {
      registration.beginSession(host, candidates[0], fileIndex);
    } else if (!open && active) {
      registration.endSession(host);
    }
  }

  function onTargetChange(event: Event) {
    const value = Number((event.currentTarget as HTMLSelectElement).value);
    registration.beginSession(host, value, fileIndex);
  }

</script>

{#if candidates.length > 0}
  <div class="registration-section">
    {#if !embedded}
      <button class="registration-toggle" data-file-index={fileIndex} onclick={toggle}>
        <span class="toggle-icon">{open ? '▼' : '▶'}</span> Align one cloud to this one
      </button>
    {/if}

    {#if shown}
      <!-- Deliberately just the one-pair workspace. Aligning everything, undoing
           it, colouring the archive and its scope all belong to the whole scene
           and live in the Align menu beside "+ Add Point Cloud"; duplicating
           them here is how two copies of one control end up disagreeing. -->
      <div class="pair-panel" class:pair-panel-embedded={embedded}>
        <!-- Embedded, the Align menu is already the window and its own selector
             already named the fixed cloud; a second frame around it and a
             heading repeating the choice are both noise. -->
        {#if !embedded}
          <div class="pair-header">
            <span class="pair-fixed" title={fileLabel(fileIndex)}
              >Fixed: {fileLabel(fileIndex)}</span
            >
          </div>
        {/if}

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

        <!-- Which cloud holds still is a guess you often cannot make before
             seeing the result, so it can be declined: solve against everything
             else at once and let the extra geometry decide. -->
        <label class="pair-row pair-against" for={`registration-all-others-${fileIndex}`}>
          <span>Onto</span>
          <span class="pair-against-choice">
            <input
              id={`registration-all-others-${fileIndex}`}
              type="checkbox"
              class="registration-all-others"
              bind:checked={registrationState.matchAgainstAllOthers}
              disabled={!active || registrationState.busy}
            />
            {#if registrationState.matchAgainstAllOthers}
              all other clouds ({candidates.length + 1})
            {:else}
              {fileLabel(fileIndex)} only
            {/if}
          </span>
        </label>

        <!-- Two routes to the same place, in the order you would reach for
             them: let the solver try, or show it three points when it cannot. -->
        <div class="pair-route">
          <div class="pair-route-head">Solve it</div>
          <div class="pair-actions">
            <button
              class="registration-coarse pair-primary"
              onclick={() => registration.autoAlign(host)}
              disabled={!active || registrationState.busy || workflow !== 'choose'}
              title="Yaw sweep, then refine the best few hypotheses"
            >
              Auto-align
            </button>
            <button
              class="registration-icp"
              onclick={() => registration.refineIcp(host)}
              disabled={!active || registrationState.busy || workflow !== 'choose'}
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
          <div class="pair-route-head">Manual matching</div>
          {#if workflow === 'choose'}
            <!-- Start from the situation on screen, not from the name of an
                 algorithm: the question people can answer while looking at two
                 clouds is "are these on top of each other or not". -->
            <p class="pair-hint">Pick the route that matches what you see:</p>
            <div class="pair-route-choice">
              <button
                class="registration-needs-coarse pair-primary"
                onclick={() => registration.startGuidedMatching(host, false)}
                disabled={!active || registrationState.busy}
              >Far apart or rotated</button>
              <span class="pair-route-note"
                >3 matching features, applied as one step. Fine matching is a separate choice
                afterwards.</span
              >
            </div>
            <div class="pair-route-choice">
              <button
                class="registration-already-coarse"
                onclick={() => registration.startGuidedMatching(host, true)}
                disabled={!active || registrationState.busy}
              >Already roughly on top</button>
              <span class="pair-route-note"
                >Straight to matched pairs; the fit updates from the third pair on.</span
              >
            </div>
            <p class="pair-hint">Picking is <strong>⌘/Ctrl + double-click</strong>. A plain double-click still moves the rotation centre, so you can navigate while picking.</p>
            {#if registrationState.pairCount > 0}
              <!-- Finishing hid the markers; the pairs are still here. -->
              <div class="pair-actions" style="margin-top:5px;">
                <button
                  class="registration-resume pair-primary"
                  onclick={() => registration.resumeGuidedMatching(host)}
                  disabled={!active || registrationState.busy}
                >Resume fine matching</button>
              </div>
            {/if}
          {:else}
            <!-- Which of the two stages, which cloud is on screen, how far in:
                 the three things you need to know to make the next click. -->
            <div class="guided-step">
              <span class="guided-stage"
                >{workflow.startsWith('coarse') ? 'Step 1 · coarse' : 'Step 2 · fine'}</span
              >
              {#if workflow === 'coarse-fixed'}
                fixed cloud · {registrationState.coarseFixedCount}/3
              {:else if workflow === 'coarse-moving'}
                moving cloud · {registrationState.coarseMovingCount}/3
              {:else if workflow === 'coarse-ready'}
                ready to apply
              {:else if workflow === 'coarse-done'}
                applied · review the 3 landmarks
              {:else if workflow === 'fine-fixed'}
                fixed cloud · {registrationState.pairCount} pair{registrationState.pairCount === 1
                  ? ''
                  : 's'} done
              {:else}
                moving cloud · matching pair {registrationState.pairCount + 1}
              {/if}
            </div>
            <p class="pair-hint">{registrationState.status}</p>

            <!-- What you have picked, and a way to look at either cloud without
                 losing your place. Both exist for the same reason: the hard part
                 of picking the same feature twice is knowing whether it is even
                 visible in the other scan, and counting picks in your head while
                 the view keeps switching is how pairs end up describing two
                 different corners. -->
            <div class="pick-status">
              <div class="pick-tally">
                <span class="pick-side" class:pick-side-active={onFixedStep}>
                  Fixed <strong>{fixedPicked}</strong>{coarseStep ? '/3' : ''}
                </span>
                <span class="pick-side" class:pick-side-active={!onFixedStep}>
                  Moving <strong>{movingPicked}</strong>{coarseStep ? '/3' : ''}
                </span>
              </div>
              <div class="pick-views">
                <span class="pick-views-label">Look at</span>
                <button
                  class="registration-view-fixed"
                  class:pick-view-on={shownSide === 'fixed'}
                  onclick={() => registration.showSide(host, 'fixed')}
                  title="Show only the fixed cloud"
                >Fixed</button>
                <button
                  class="registration-view-moving"
                  class:pick-view-on={shownSide === 'moving'}
                  onclick={() => registration.showSide(host, 'moving')}
                  title="Show only the moving cloud"
                >Moving</button>
                <button
                  class="registration-view-both"
                  class:pick-view-on={shownSide === 'both'}
                  onclick={() => registration.showSide(host, 'both')}
                  title="Show both clouds at once"
                >Both</button>
              </div>
              {#if picks.length > 0}
                <div class="pick-chips">
                  {#each picks as pick, pickIndex (pickIndex)}
                    <span
                      class={`pick-chip pick-chip-${pick.state}`}
                      title={pick.state === 'pair'
                        ? 'Picked on both clouds'
                        : pick.state === 'fixed'
                          ? 'Picked on the fixed cloud, still needs its match'
                          : 'Picked on the moving cloud, still needs its match'}
                    >{pickIndex + 1}</span>
                  {/each}
                </div>
              {/if}
            </div>
            <div class="pair-actions">
              {#if workflow === 'coarse-ready'}
                <button
                  class="registration-apply-coarse pair-primary"
                  onclick={() => registration.applyCoarseMatch(host)}
                  disabled={registrationState.busy}
                >Apply coarse match</button>
              {/if}
              {#if workflow === 'coarse-done'}
                <!-- Coarse matching is finished work. Fine matching is the next
                     job, not the second half of this one, so it takes a click. -->
                <button
                  class="registration-start-fine pair-primary"
                  onclick={() => registration.startFineMatching(host)}
                  disabled={registrationState.busy}
                >Start fine matching</button>
                <button
                  class="registration-redo-coarse"
                  onclick={() => registration.startGuidedMatching(host, false)}
                  disabled={registrationState.busy}
                >Redo coarse match</button>
              {:else}
                <button
                  class="registration-undo-pair"
                  onclick={() => registration.removeLastPair(host)}
                  disabled={registrationState.busy || (registrationState.coarseFixedCount === 0 && registrationState.coarseMovingCount === 0 && registrationState.pairCount === 0 && !registrationState.awaiting)}
                >Undo pick</button>
              {/if}
              <button
                class="registration-finish"
                onclick={() => registration.finishGuidedMatching(host)}
                disabled={registrationState.busy}
              >Finish</button>
            </div>
            {#if workflow === 'fine-fixed' || workflow === 'fine-moving'}
              <p class="pair-hint">From three fine pairs onward, the transform updates after every completed pair. Coarse landmarks are not reused in the fine fit.</p>
            {/if}

            <!-- Both of these exist because the markers and the second cloud
                 are the two things that hide the feature you are trying to
                 click on. -->
            <label class="pick-aid" for={`registration-marker-${fileIndex}`}>
              <span>Marker size</span>
              <input
                id={`registration-marker-${fileIndex}`}
                class="registration-marker-size"
                type="range"
                min="0.1"
                max="1.5"
                step="0.05"
                title="Size of the picked-point balls, relative to the scene. Double-click to reset."
                bind:value={registrationState.markerScale}
                oninput={() => host.requestRender()}
                ondblclick={() => {
                  registrationState.markerScale = 0.35;
                  host.requestRender();
                }}
              />
            </label>
            <label class="pick-aid">
              <input
                type="checkbox"
                class="registration-isolate"
                bind:checked={registrationState.isolateWhilePicking}
                onchange={() => registration.refreshPickingVisibility(host)}
              />
              <span>Show only the cloud being picked</span>
            </label>
          {/if}
        </div>

        {#if active && registrationState.coarseResiduals.length > 0}
          <!-- The three landmarks that were actually used, each with the gap
               that survived the fit. One bad row is a mis-picked corner, and
               that is invisible in the aggregate RMS. -->
          <div class="pair-list">
            <div class="pair-route-head">
              Coarse landmarks<span class="pair-count">after fit</span>
            </div>
            {#each registrationState.coarseResiduals as residual, landmarkIndex (landmarkIndex)}
              <div class="pair-list-row">
                <span class="pair-list-number">{landmarkIndex + 1}</span>
                <span
                  class="coarse-residual"
                  class:coarse-residual-worst={residual >= worstCoarseResidual &&
                    registrationState.coarseResiduals.length > 1}
                  title="Distance between this landmark and the feature it was matched to, after the fit"
                >{formatResidual(residual)}</span>
              </div>
            {/each}
          </div>
        {/if}

        {#if active && registrationState.pairCount > 0}
          <!-- One row per pair, so a bad correspondence can be replaced without
               starting the whole set again. Re-picking removes the pair and
               appends its replacement, which is why the numbers can shift. -->
          <div class="pair-list">
            <div class="pair-route-head">
              Pairs<span class="pair-count">{registrationState.pairCount} kept</span>
            </div>
            {#each Array(registrationState.pairCount) as _, pairIndex (pairIndex)}
              <div class="pair-list-row">
                <span class="pair-list-number">{pairIndex + 1}</span>
                <button
                  class="registration-recapture"
                  data-pair-index={pairIndex}
                  onclick={() => registration.recapturePair(host, pairIndex)}
                  disabled={!active || registrationState.busy}
                  title="Drop this pair and pick both of its points again"
                >Re-pick</button>
              </div>
            {/each}
          </div>
        {/if}

        {#if active && registrationState.status && workflow === 'choose'}
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
  .pair-panel-embedded {
    background: none;
    border: none;
    border-radius: 0;
    padding: 0;
    margin-top: 2px;
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
  .pair-list {
    margin-top: 8px;
    border-top: 1px solid var(--vscode-panel-border);
    padding-top: 6px;
  }
  .pair-list-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 1px 0;
  }
  .pair-list-number {
    width: 16px;
    text-align: right;
    opacity: 0.75;
    font-family: var(--vscode-editor-font-family, monospace);
  }
  .pair-list-row button {
    font-size: 10px;
    padding: 1px 6px;
  }
  .pick-status {
    margin-top: 6px;
    padding: 6px 7px;
    border: 1px solid var(--vscode-widget-border, rgba(128, 128, 128, 0.35));
    border-radius: 4px;
  }
  .pick-tally {
    display: flex;
    gap: 10px;
    margin-bottom: 5px;
  }
  .pick-side {
    opacity: 0.6;
  }
  /* The side the next click belongs to, so the tally also answers "whose turn". */
  .pick-side-active {
    opacity: 1;
    font-weight: 600;
  }
  .pick-views {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .pick-views-label {
    opacity: 0.7;
    margin-right: 2px;
  }
  .pick-views button {
    font-size: 10px;
    padding: 1px 7px;
  }
  .pick-view-on {
    outline: 1px solid var(--vscode-focusBorder, #007fd4);
  }
  .pick-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 3px;
    margin-top: 5px;
  }
  .pick-chip {
    min-width: 16px;
    text-align: center;
    border-radius: 3px;
    font-size: 10px;
    padding: 0 3px;
    font-family: var(--vscode-editor-font-family, monospace);
  }
  .pick-chip-pair {
    background: color-mix(in srgb, var(--vscode-charts-green, #89d185) 30%, transparent);
  }
  .pick-chip-fixed {
    background: color-mix(in srgb, var(--vscode-charts-blue, #2ad4ff) 30%, transparent);
  }
  .pick-chip-moving {
    background: color-mix(in srgb, var(--vscode-charts-orange, #ff8c1a) 30%, transparent);
  }
  .coarse-residual {
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: 10px;
    opacity: 0.85;
    font-variant-numeric: tabular-nums;
  }
  /* The worst of three is the one worth re-picking, so it is the one that
     should catch the eye without reading all three numbers. */
  .coarse-residual-worst {
    color: var(--vscode-editorWarning-foreground, #cca700);
    opacity: 1;
  }
  .pair-against-choice {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .pick-aid {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 5px;
  }
  .pick-aid input[type='range'] {
    flex: 1;
    min-width: 0;
  }
  .pair-route-choice {
    display: flex;
    align-items: baseline;
    gap: 6px;
    margin-bottom: 4px;
  }
  .pair-route-choice button {
    flex: 0 0 auto;
    font-size: 11px;
  }
  .pair-route-note {
    opacity: 0.7;
    line-height: 1.35;
  }
  .guided-stage {
    font-weight: 600;
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
