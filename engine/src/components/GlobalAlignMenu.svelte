<script lang="ts">
  import { filesState } from '../state/files.svelte';
  import { registrationState, stationPipelineUi } from '../state/registration.svelte';
  import * as registration from '../registrationFeature';
  import {
    canRunStationPipeline,
    firstArchiveScanIndex,
    runStationPipeline,
  } from '../stationPipelineTrigger';

  let { host }: { host: any } = $props();

  let open = $state(false);
  let showOptions = $state(false);
  // null until the user picks one; the first loaded cloud is the default, which
  // is what someone who just opened a multi-scan archive almost always wants.
  let anchorChoice = $state<number | null>(null);

  // Recomputed on the file list's render tick rather than reactively: files
  // load and unload through main.ts's parallel arrays, which are not
  // themselves reactive.
  const alignable = $derived(
    (filesState.renderTick, registration.registrationCandidates(host, -1))
  );
  // One cloud has nothing to align to, so the control does not exist until a
  // second one is loaded — that is also what keeps "+ Add Point Cloud" at full
  // width in the ordinary single-file case.
  const available = $derived(alignable.length >= 2);
  const anchorIndex = $derived(
    anchorChoice !== null && alignable.includes(anchorChoice) ? anchorChoice : (alignable[0] ?? 0)
  );
  const movingCount = $derived(Math.max(0, alignable.length - 1));

  const archiveIndex = $derived((filesState.renderTick, firstArchiveScanIndex(host)));
  // Colouring needs the photographs and the camera profile out of the archive,
  // which only the extension host still has open. Hidden everywhere else.
  const canRecolor = $derived((filesState.renderTick, canRunStationPipeline(host, archiveIndex)));

  const entries = $derived(registrationState.alignEntries);
  const alignedCount = $derived(entries.filter(entry => entry.state === 'aligned').length);
  const failedCount = $derived(entries.filter(entry => entry.state === 'failed').length);
  // Percent of the run, not percent of success: the bar answers "how much
  // longer", and a failed cloud is as finished as an aligned one.
  const alignPercent = $derived(
    entries.length === 0 ? 0 : Math.round((registrationState.alignDone / entries.length) * 100)
  );

  const scans = $derived(stationPipelineUi.scans);
  const coloredCount = $derived(scans.filter(scan => scan.colored).length);
  const colorPercent = $derived(
    scans.length === 0 ? 0 : Math.round((coloredCount / scans.length) * 100)
  );

  const STATE_ICON = { queued: '·', running: '◐', aligned: '✓', failed: '✕' } as const;

  function fileLabel(index: number): string {
    return host.spatialFiles?.[index]?.fileName || `File ${index + 1}`;
  }

  function onAnchorChange(event: Event) {
    anchorChoice = Number((event.currentTarget as HTMLSelectElement).value);
  }

  $effect(() => {
    // A menu left open after everything is unloaded would reappear on the next
    // load in a state the user did not choose.
    if (!available) {
      open = false;
    }
  });
</script>

{#if available}
  <button
    id="global-align-toggle"
    class="primary-button global-align-toggle"
    class:active={open}
    aria-expanded={open}
    aria-controls="global-align-menu"
    title="Align the loaded point clouds to one another"
    onclick={() => (open = !open)}
  >
    Align {open ? '▾' : '▸'}
  </button>
{/if}

{#if available && open}
  <div id="global-align-menu" class="align-menu">
    <!-- One reference for both stages: aligning and colouring are the same
         decision made twice, and asking for it twice is how they end up
         disagreeing. -->
    <div class="align-reference">
      <label for="global-align-anchor">Reference <span class="align-reference-note">(stays fixed)</span></label>
      <select id="global-align-anchor" value={anchorIndex} onchange={onAnchorChange}>
        {#each alignable as index (index)}
          <option value={index}>{fileLabel(index)}</option>
        {/each}
      </select>
    </div>

    <section class="align-stage">
      <header>
        {#if canRecolor}<span class="align-step">1</span>{/if}
        <h5>Align {movingCount} cloud{movingCount === 1 ? '' : 's'} to it</h5>
      </header>
      <div class="align-actions">
        <button
          class="global-align-run align-primary"
          onclick={() => registration.alignAllTo(host, anchorIndex)}
          disabled={registrationState.busy}
          title="Coarse yaw search followed by ICP, for every other cloud"
        >
          Align &amp; refine
        </button>
        <button
          class="global-align-refine"
          onclick={() => registration.alignAllTo(host, anchorIndex, { refineOnly: true })}
          disabled={registrationState.busy}
          title="ICP only, from where each cloud sits now — for clouds already roughly placed"
        >
          Refine only
        </button>
        <button
          class="global-align-undo"
          onclick={() => registration.undoAlignAll(host)}
          disabled={!registrationState.canUndoAll || registrationState.busy}
        >
          Undo
        </button>
      </div>

      {#if entries.length > 0}
        <div
          class="align-bar"
          role="progressbar"
          aria-valuenow={alignPercent}
          aria-valuemin="0"
          aria-valuemax="100"
          aria-label="Alignment progress"
        >
          <div class="align-bar-fill" style="width: {alignPercent}%"></div>
        </div>
        <div class="align-summary">
          {#if registrationState.busy}
            {registrationState.alignDone} of {entries.length} · {registrationState.status ||
              'working…'}
          {:else}
            {alignedCount} aligned{failedCount > 0 ? ` · ${failedCount} failed` : ''}
          {/if}
        </div>
        <ul class="global-align-results align-list">
          {#each entries as entry (entry.index)}
            <li class={`align-row align-row-${entry.state}`}>
              <span class="align-icon">{STATE_ICON[entry.state]}</span>
              <span class="align-name" title={entry.name}>{entry.name}</span>
              <span class="align-detail">{entry.detail}</span>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="align-hint">
          Each cloud is matched against the reference on its own, so one bad pair cannot drag the
          rest out of place. Failures are listed and excluded from colouring.
        </p>
      {/if}
    </section>

    {#if canRecolor && archiveIndex !== null}
      <section class="align-stage">
        <header>
          <span class="align-step">2</span>
          <h5>Colour from the archive's cameras</h5>
        </header>
        <div class="align-actions">
          <button
            class="global-align-recolor align-primary"
            onclick={() => runStationPipeline(host, archiveIndex, false)}
            disabled={stationPipelineUi.busy || registrationState.busy}
            title="Uses the alignment currently on screen"
          >
            Recolour all
          </button>
          <button
            class="global-align-recolor-register"
            onclick={() => runStationPipeline(host, archiveIndex, true)}
            disabled={stationPipelineUi.busy || registrationState.busy}
            title="Re-derives the alignment in the host first, discarding what is on screen"
          >
            Register first
          </button>
        </div>

        {#if scans.length > 0}
          <div
            class="align-bar"
            role="progressbar"
            aria-valuenow={colorPercent}
            aria-valuemin="0"
            aria-valuemax="100"
            aria-label="Colouring progress"
          >
            <div class="align-bar-fill" style="width: {colorPercent}%"></div>
          </div>
          <div class="align-summary">
            {coloredCount} of {scans.length} scans coloured
          </div>
          <ul class="align-list align-scan-list">
            {#each scans as scan (scan.name)}
              <li class={`align-row ${scan.colored ? 'align-row-aligned' : 'align-row-queued'}`}>
                <span class="align-icon">{scan.colored ? '✓' : stationPipelineUi.busy ? '◐' : '·'}</span>
                <span class="align-name" title={scan.name}>{scan.name}</span>
              </li>
            {/each}
          </ul>
        {/if}
        {#if stationPipelineUi.message}
          <div class="align-message">{stationPipelineUi.message}</div>
        {/if}

        <button class="align-disclosure" onclick={() => (showOptions = !showOptions)}>
          {showOptions ? '▾' : '▸'} Options
        </button>
        {#if showOptions}
          <label class="align-check">
            <input type="checkbox" bind:checked={stationPipelineUi.recolorAlreadyColored} />
            Also recolour scans that already have camera colour
          </label>
          <label class="align-check">
            Up axis for the coarse search
            <select bind:value={registrationState.upAxis}>
              <option value="z">Z</option>
              <option value="y">Y</option>
              <option value="x">X</option>
            </select>
          </label>
          <p class="align-hint">
            Capture-place scope and the projection diagnostics stay in the file's own panel — they
            are about one archive's geometry, not about this run.
          </p>
        {/if}
      </section>
    {:else}
      <button class="align-disclosure" onclick={() => (showOptions = !showOptions)}>
        {showOptions ? '▾' : '▸'} Options
      </button>
      {#if showOptions}
        <label class="align-check">
          Up axis for the coarse search
          <select bind:value={registrationState.upAxis}>
            <option value="z">Z</option>
            <option value="y">Y</option>
            <option value="x">X</option>
          </select>
        </label>
      {/if}
    {/if}
  </div>
{/if}

<style>
  .global-align-toggle {
    /* The add button keeps `flex: 1`; this one stays at its natural width so
       the pair shares the row without a second layout rule. */
    flex: 0 0 auto;
    white-space: nowrap;
  }
  .global-align-toggle.active {
    background-color: var(--vscode-button-hoverBackground);
  }
  .align-menu {
    /* Breaks out of the flex row that holds the two buttons, so the menu is a
       full-width panel underneath them rather than a third column. */
    flex-basis: 100%;
    background-color: var(--vscode-editor-background);
    border: 1px solid var(--vscode-panel-border);
    border-radius: 4px;
    padding: 8px;
    font-size: 11px;
  }
  .align-reference {
    padding-bottom: 8px;
    border-bottom: 1px solid var(--vscode-panel-border);
  }
  .align-reference label {
    display: block;
    font-weight: 600;
    margin-bottom: 3px;
  }
  .align-reference select {
    /* Full width on its own line: scan names are long and truncating the one
       control that says what everything else is relative to is not a trade
       worth making for one saved row. */
    display: block;
    width: 100%;
    font-size: 11px;
  }
  .align-reference-note {
    font-weight: 400;
    opacity: 0.6;
  }
  .align-stage {
    padding-top: 8px;
  }
  .align-stage + .align-stage {
    margin-top: 8px;
    border-top: 1px solid var(--vscode-panel-border);
  }
  .align-stage header {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 5px;
  }
  .align-stage h5 {
    margin: 0;
    font-size: 11px;
    font-weight: 600;
  }
  .align-step {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 15px;
    height: 15px;
    border-radius: 50%;
    background-color: var(--vscode-badge-background);
    color: var(--vscode-badge-foreground);
    font-size: 9px;
  }
  .align-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .align-actions button {
    font-size: 11px;
  }
  .align-primary {
    /* The one action per stage that a first-time user should press. */
    background-color: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: none;
    border-radius: 3px;
    padding: 4px 10px;
    cursor: pointer;
  }
  .align-primary:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .align-bar {
    height: 4px;
    margin-top: 7px;
    border-radius: 2px;
    background-color: var(--vscode-panel-border);
    overflow: hidden;
  }
  .align-bar-fill {
    height: 100%;
    background-color: var(--vscode-progressBar-background, var(--vscode-button-background));
    transition: width 0.2s ease-out;
  }
  .align-summary {
    margin-top: 4px;
    opacity: 0.85;
  }
  .align-list {
    list-style: none;
    margin: 4px 0 0;
    padding: 0;
    /* Long captures run to dozens of scans; the list scrolls rather than
       pushing the file list off the panel. */
    max-height: 132px;
    overflow-y: auto;
  }
  .align-row {
    display: flex;
    /* Wraps rather than truncates. A scan name and its result together are
       wider than the sidebar at any realistic width, and clipping "overlap
       37%" to "overlap 3" turns the one number worth reading into a lie. */
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0 5px;
    padding: 1px 0;
  }
  .align-icon {
    width: 9px;
    text-align: center;
    flex: 0 0 auto;
  }
  .align-name {
    /* The name is the one thing that may truncate, and only once it has taken
       the whole row: half a scan name still identifies the row. */
    flex: 0 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .align-detail {
    flex: 0 0 auto;
    /* Right-aligned when it shares the row, indented under the name when it
       wraps to its own — either way it is never cut off. */
    margin-left: auto;
    padding-left: 14px;
    font-family: var(--vscode-editor-font-family, monospace);
    opacity: 0.75;
    white-space: nowrap;
  }
  .align-row-queued {
    opacity: 0.5;
  }
  .align-row-running .align-icon {
    color: var(--vscode-progressBar-background, var(--vscode-button-background));
  }
  .align-row-aligned .align-icon {
    color: var(--vscode-testing-iconPassed, #4caf50);
  }
  .align-row-failed .align-icon {
    color: var(--vscode-testing-iconFailed, #f44336);
  }
  .align-message {
    margin-top: 5px;
    opacity: 0.85;
  }
  .align-hint {
    margin: 5px 0 0;
    opacity: 0.7;
    line-height: 1.4;
  }
  .align-disclosure {
    margin-top: 7px;
    padding: 0;
    background: none;
    border: none;
    color: var(--vscode-foreground);
    opacity: 0.75;
    cursor: pointer;
    font-size: 10px;
  }
  .align-check {
    display: block;
    margin-top: 5px;
  }
</style>
