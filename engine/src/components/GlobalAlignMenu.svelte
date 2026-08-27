<script lang="ts">
  import { filesState } from '../state/files.svelte';
  import { measurementState } from '../state/measurement.svelte';
  import { registrationState, stationPipelineUi } from '../state/registration.svelte';
  import { viewerState } from '../state/viewer.svelte';
  import * as registration from '../registrationFeature';
  import {
    canRunStationPipeline,
    firstArchiveScanIndex,
    runStationPipeline,
  } from '../stationPipelineTrigger';
  import { capturePlaces, setCapturePlaceVisible } from '../stationPipelineFeature';
  import { setStonexColorCorrection } from '../visualization/stonexCameras';
  import { normalizeStonexColorCorrection } from '../visualization/stonexColorCorrection';
  import RegistrationPanel from './RegistrationPanel.svelte';

  let { host }: { host: any } = $props();

  let open = $state(false);
  let showAlign = $state(false);
  let showOptions = $state(false);
  // The one-pair workspace, folded away by default: correcting a single pair is
  // what you reach for when an automatic run leaves one cloud wrong, not what
  // you start with.
  let showSingle = $state(false);

  /**
   * Opens the single-pair workspace on exactly the two clouds that need
   * joining, and starts the three-point route on them.
   *
   * The point of the suggestion is that the user should not have to work out
   * *which* pair to fix — the solver already knows, and asking them to hunt for
   * it is most of the work.
   */
  function linkByHand(
    group: {
      indices: number[];
      suggestion: { movingIndex: number; fixedIndex: number } | null;
    } | null
  ) {
    if (!group?.suggestion) return;
    singleFixed = group.suggestion.fixedIndex;
    showSingle = true;
    // The whole group moves against the whole placed scene, not one cloud
    // against one cloud. The group is already solved internally, so it needs a
    // single shared pose; and holding every placed cloud still means a feature
    // can be picked wherever it is recognisable rather than only on the cloud
    // the suggestion happened to name.
    registration.beginGroupSession(host, group.indices, registrationState.alignedIndices.length > 0
      ? registrationState.alignedIndices
      : [group.suggestion.fixedIndex]);
    registration.startGuidedMatching(host, false);
  }
  // Off by default, like every other correction: the viewer shows the capture.
  let bandWhiteBalance = $state(false);
  // Grow outward from the reference instead of matching everything to it.
  // Both off: one pass against the reference is the cheap answer and is right
  // whenever the reference genuinely overlaps everything. The two growing
  // strategies are opt-in because each costs extra solver passes.
  let nestedScene = $state(false);
  let complexScene = $state(false);

  // They describe the same walk with different amounts of work, so running both
  // means nothing; picking one clears the other.
  function chooseNested(on: boolean): void {
    nestedScene = on;
    if (on) {
      complexScene = false;
    }
  }
  function chooseComplex(on: boolean): void {
    complexScene = on;
    if (on) {
      nestedScene = false;
    }
  }
  let singleFixed = $state<number | null>(null);
  // null until the user picks one; the first loaded cloud is the default, which
  // is what someone who just opened a multi-scan archive almost always wants.
  let anchorChoice = $state<number | null>(null);

  // Recomputed on the file list's render tick rather than reactively: files
  // load and unload through main.ts's parallel arrays, which are not
  // themselves reactive.
  const alignable = $derived(
    (filesState.renderTick, registration.registrationCandidates(host, -1))
  );
  const hasObjects = $derived((filesState.renderTick, host.fileEntries.length > 0));
  // One cloud has nothing to align to, but the surrounding Tools menu also
  // contains measurement and viewer options and therefore remains useful.
  const available = $derived(alignable.length >= 2);
  const anchorIndex = $derived(
    anchorChoice !== null && alignable.includes(anchorChoice) ? anchorChoice : (alignable[0] ?? 0)
  );
  const movingCount = $derived(Math.max(0, alignable.length - 1));

  const singleFixedIndex = $derived(
    singleFixed !== null && alignable.includes(singleFixed) ? singleFixed : (alignable[0] ?? 0)
  );

  // Only archives carry the per-band reference patches this reads.
  const hasCameraProfiles = $derived((filesState.renderTick, (host.cameraGroups?.length ?? 0) > 0));

  function applyBandWhiteBalance(enabled: boolean) {
    bandWhiteBalance = enabled;
    for (const group of host.cameraGroups ?? []) {
      const current = normalizeStonexColorCorrection(group.userData?.colorCorrection);
      // Patch only the white-balance mode: exposure and manual gains are the
      // file panel's business and must survive this toggle.
      setStonexColorCorrection(host, group, {
        ...current,
        whiteBalance: enabled ? 'band' : 'off',
      });
    }
    host.requestRender();
  }

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

  // Capture places: everything shot from one tripod position, derived from
  // where the scans actually registered. They live here rather than in a
  // file's own panel because they are the colour run's scope — only checked
  // places are parsed, used as cameras and recoloured — and scope belongs
  // beside the button that consumes it.
  const archiveName = $derived(
    (filesState.renderTick,
    archiveIndex === null
      ? undefined
      : (host.spatialFiles?.[archiveIndex]?.metadata?.containerFileName as string | undefined))
  );
  const places = $derived(
    (filesState.renderTick, filesState.renderModeTick, capturePlaces(host, archiveName))
  );
  const placeVisible = (place: { fileIndices: number[] }) =>
    place.fileIndices.some(index => filesState.visibility[index] !== false);

  function togglePlace(place: any, event: Event) {
    setCapturePlaceVisible(host, place, (event.currentTarget as HTMLInputElement).checked);
    filesState.renderModeTick++;
  }

  function fileLabel(index: number): string {
    return host.spatialFiles?.[index]?.fileName || `File ${index + 1}`;
  }

  function onAnchorChange(event: Event) {
    anchorChoice = Number((event.currentTarget as HTMLSelectElement).value);
  }

  function toggleTools(): void {
    open = !open;
    if (!open) {
      showAlign = false;
    }
  }

  function toggleMeasurementMode(): void {
    const enabled = host.measurementManager?.togglePickMode();
    if (enabled === undefined) return;
    host.showStatus(
      enabled
        ? 'Measurement mode: ON — double-click or double-tap points to measure'
        : 'Measurement mode: OFF — double-click or double-tap moves the rotation center'
    );
  }

  function setRotationCenterToOrigin(): void {
    host.setRotationCenterToOrigin();
    host.updateRotationOriginButtonState();
  }

  $effect(() => {
    // A menu left open after everything is unloaded would reappear on the next
    // load in a state the user did not choose.
    if (!hasObjects) {
      open = false;
    }
    if (!available) showAlign = false;
  });
</script>

{#snippet whiteBalanceToggle()}
  {#if hasCameraProfiles}
    <label class="align-check" title="Per-camera-band gains measured from each frame's reference patch. Off by default: the viewer shows the raw capture.">
      <input
        type="checkbox"
        class="global-band-white-balance"
        checked={bandWhiteBalance}
        onchange={event => applyBandWhiteBalance((event.currentTarget as HTMLInputElement).checked)}
      />
      Band white balance
    </label>
  {/if}
{/snippet}

{#if hasObjects}
  <button
    id="global-align-toggle"
    class="primary-button global-align-toggle"
    class:active={open || measurementState.pickingEnabled}
    aria-expanded={open}
    aria-controls="global-align-menu"
    title="Alignment, measurement and useful viewer options"
    onclick={toggleTools}
  >
    Tools {open ? '▾' : '▸'}
  </button>
{/if}

{#if hasObjects && open}
  <div id="global-align-menu" class="align-menu">
    <div class="tool-menu-actions">
      <button
        id="tools-measure"
        class:active={measurementState.pickingEnabled}
        aria-pressed={measurementState.pickingEnabled}
        onclick={toggleMeasurementMode}
      >
        Measure points <span>{measurementState.pickingEnabled ? 'On' : 'Off'}</span>
      </button>
      <button
        id="tools-edl"
        class:active={viewerState.edlMode !== 'off'}
        aria-label={`Eye Dome Lighting: ${viewerState.edlMode}`}
        onclick={() => host.toggleEDL()}
        disabled={!host.effectComposer}
      >
        Eye Dome Lighting <span>{viewerState.edlMode[0].toUpperCase() + viewerState.edlMode.slice(1)} · E</span>
      </button>
      <button id="tools-world-origin" onclick={setRotationCenterToOrigin}>
        Rotation center: world origin <span>W</span>
      </button>
      {#if available}
        <button
          id="tools-align"
          class="tools-align-button"
          class:active={showAlign}
          aria-expanded={showAlign}
          onclick={() => (showAlign = !showAlign)}
        >
          Align point clouds <span>{showAlign ? '▾' : '▸'}</span>
        </button>
      {:else}
        <button
          id="tools-align"
          class="tools-align-button"
          disabled
          title="Load at least two point clouds to align them"
        >
          Align point clouds <span>2+ files</span>
        </button>
      {/if}
    </div>

    {#if available && showAlign}
    <div class="align-workspace">
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
          onclick={() =>
            registration.alignAllTo(host, anchorIndex, {
              nested: nestedScene,
              complex: complexScene,
            })}
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
        <label
          class="align-inline-check"
          title="Place what matches, add it to the target, and try the rest again. For scenes where a cloud may share nothing with the reference but plenty with its neighbour."
        >
          <input
            type="checkbox"
            class="global-align-nested"
            checked={nestedScene}
            onchange={event => chooseNested(event.currentTarget.checked)}
            disabled={registrationState.busy}
          />
          Nested scene
        </label>
        <label
          class="align-inline-check"
          title="The nested walk, plus two things it lacks: every remaining cloud is scored before one is committed, and the solver is offered the poses of the clouds already placed. Slower, and far less dependent on which cloud you make the reference."
        >
          <input
            type="checkbox"
            class="global-align-complex"
            checked={complexScene}
            onchange={event => chooseComplex(event.currentTarget.checked)}
            disabled={registrationState.busy}
          />
          Complex scene
        </label>
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

        {#if !registrationState.busy && registrationState.unattachedGroups.length > 0}
          <!-- A list of failures tells you something went wrong. This tells you
               what to do about it. The clouds that could not attach are grouped
               by whether they can see each other, so a group needs one link
               rather than one per cloud, and the pair named is the one the
               solver found most promising while still not trusting it. -->
          <div class="align-gap">
            <div class="align-gap-head">Needs one link to finish</div>
            {#each registrationState.unattachedGroups as group, groupIndex (groupIndex)}
              <div class="align-gap-group">
                <div class="align-gap-members">
                  {group.indices.length === 1 ? 'This cloud' : `These ${group.indices.length} clouds`}
                  stayed separate: <strong>{group.names.join(', ')}</strong>
                </div>
                {#if group.suggestion}
                  <div class="align-gap-suggest">
                    {group.indices.length > 1
                      ? 'They are already aligned to each other, so they move as one and need a single placement.'
                      : 'It needs one placement.'}
                    Look near <strong>{group.suggestion.movingName}</strong> and
                    <strong>{group.suggestion.fixedName}</strong> — that is where they overlap most
                    ({group.suggestion.overlapPercent}%), too little to trust automatically but
                    enough to pick three matching points by eye.
                  </div>
                  <button
                    class="global-align-link align-primary"
                    onclick={() => linkByHand(group)}
                    disabled={registrationState.busy}
                  >Place this group by hand</button>
                {:else}
                  <div class="align-gap-suggest">
                    No overlap with the placed scene was found at all. This group may be a separate
                    part of the site; align one of its clouds to any cloud you recognise.
                  </div>
                {/if}
              </div>
            {/each}
            <button
              class="global-align-continue"
              onclick={() =>
                registration.alignAllTo(host, anchorIndex, {
                  nested: nestedScene,
                  complex: complexScene,
                })}
              disabled={registrationState.busy}
            >Continue aligning</button>
            <p class="align-hint">
              One link is enough: everything else follows from pairs already measured.
            </p>
          </div>
        {/if}
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

        <button
          class="align-disclosure align-options-toggle"
          onclick={() => (showOptions = !showOptions)}
        >
          {showOptions ? '▾' : '▸'} Options
        </button>
        {#if showOptions}
          <label class="align-check">
            <input type="checkbox" bind:checked={stationPipelineUi.recolorAlreadyColored} />
            Also recolour scans that already have camera colour
          </label>
          {@render whiteBalanceToggle()}
          <label class="align-check">
            Up axis for the coarse search
            <select bind:value={registrationState.upAxis}>
              <option value="z">Z</option>
              <option value="y">Y</option>
              <option value="x">X</option>
            </select>
          </label>

          {#if places.length > 1}
            <div class="align-places">
              <span class="align-places-head">Capture places</span>
              {#each places as place (place.name)}
                <label class="align-check">
                  <input
                    type="checkbox"
                    class="capture-place-toggle"
                    data-place={place.name}
                    checked={placeVisible(place)}
                    onchange={event => togglePlace(place, event)}
                  />
                  {place.name}
                  <span class="align-places-count">
                    ({place.fileIndices.length} scan{place.fileIndices.length === 1 ? '' : 's'})
                  </span>
                </label>
              {/each}
              <p class="align-hint">
                Hides everything captured from one tripod position at once, panoramas included —
                and unchecked places are skipped by the colour run, which makes a focused run
                faster.
              </p>
            </div>
          {/if}

          <label class="align-check">
            Projection diagnostic
            <select
              class="station-projection-diagnostic"
              bind:value={stationPipelineUi.projectionDiagnostic}
              disabled={stationPipelineUi.busy || registrationState.busy}
            >
              <option value="normal">Normal calibrated projection</option>
              <option value="own-station-only">Own station cameras only</option>
              <option value="u-only">Upward camera (U) only</option>
              <option value="d-only">Downward camera (D) only</option>
              <option value="ideal-pinhole">Ignore lens distortion</option>
              <option value="reverse-pan">Reverse panorama rotation</option>
              <option value="invert-extrinsic">Invert camera extrinsic</option>
            </select>
          </label>
          {#if stationPipelineUi.projectionDiagnostic !== 'normal'}
            <p class="align-hint">
              Diagnostic runs replace existing camera colour so the selected model can be compared
              on the same nearby edges. Return this to “Normal” after testing.
            </p>
          {/if}
        {/if}
      </section>
    {:else}
      <button
          class="align-disclosure align-options-toggle"
          onclick={() => (showOptions = !showOptions)}
        >
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
        {@render whiteBalanceToggle()}
      {/if}
    {/if}

    <!-- Last, and collapsed. It used to live inside every file's row, which
         hid a whole-scene decision behind whichever row you happened to open
         and repeated the same controls once per cloud. -->
    <div class="align-single">
      <button
        class="align-disclosure align-single-toggle"
        onclick={() => (showSingle = !showSingle)}
      >
        {showSingle ? '▾' : '▸'} Align single clouds
      </button>
      {#if showSingle}
        <label class="align-check" for="global-align-single-fixed">
          Keep fixed
          <select
            id="global-align-single-fixed"
            value={singleFixedIndex}
            onchange={event =>
              (singleFixed = Number((event.currentTarget as HTMLSelectElement).value))}
          >
            {#each alignable as index (index)}
              <option value={index}>{fileLabel(index)}</option>
            {/each}
          </select>
        </label>
        <RegistrationPanel {host} fileIndex={singleFixedIndex} embedded={true} />
      {/if}
    </div>
    </div>
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
  .tool-menu-actions {
    display: grid;
    grid-template-columns: 1fr;
    gap: 4px;
  }
  .tool-menu-actions button {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    width: 100%;
    padding: 5px 7px;
    border: 1px solid var(--vscode-button-border);
    border-radius: 3px;
    background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
    font-size: 11px;
    text-align: left;
    cursor: pointer;
  }
  .tool-menu-actions button:hover:not(:disabled),
  .tool-menu-actions button.active {
    background: var(--vscode-button-secondaryHoverBackground);
  }
  .tool-menu-actions button.active {
    border-color: var(--vscode-focusBorder);
  }
  .tool-menu-actions .tools-align-button {
    margin-top: 3px;
    border-top-width: 2px;
  }
  .tool-menu-actions .tools-align-button.active {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border-color: var(--vscode-focusBorder);
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--vscode-focusBorder) 35%, transparent);
  }
  .tool-menu-actions .tools-align-button.active span {
    color: var(--vscode-button-foreground);
  }
  .tool-menu-actions button:disabled {
    cursor: default;
    opacity: 0.55;
  }
  .tool-menu-actions button span {
    flex: 0 0 auto;
    color: var(--vscode-descriptionForeground);
    font-size: 9px;
  }
  .align-workspace {
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid var(--vscode-panel-border);
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
  .align-gap {
    margin-top: 8px;
    padding: 8px 9px;
    border: 1px solid var(--vscode-editorWarning-foreground, #cca700);
    border-radius: 4px;
    background: color-mix(in srgb, var(--vscode-editorWarning-foreground, #cca700) 8%, transparent);
  }
  .align-gap-head {
    font-weight: 600;
    margin-bottom: 5px;
  }
  .align-gap-group {
    margin-bottom: 8px;
  }
  .align-gap-members,
  .align-gap-suggest {
    margin-bottom: 4px;
    line-height: 1.4;
  }
  .align-gap-suggest {
    opacity: 0.85;
  }
  .global-align-continue {
    margin-top: 4px;
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
  .align-inline-check {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    white-space: nowrap;
  }
  .align-check select {
    display: block;
    width: 100%;
    margin-top: 2px;
    font-size: 11px;
  }
  .align-single {
    margin-top: 7px;
    padding-top: 6px;
    border-top: 1px solid var(--vscode-panel-border);
  }
  .align-places {
    margin-top: 7px;
    padding-top: 6px;
    border-top: 1px solid var(--vscode-panel-border);
  }
  .align-places-head {
    font-weight: 600;
  }
  .align-places-count {
    opacity: 0.7;
  }
</style>
