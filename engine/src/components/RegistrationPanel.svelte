<script lang="ts">
  import { filesState } from '../state/files.svelte';
  import { registrationState, stationPipelineUi } from '../state/registration.svelte';
  import * as registration from '../registrationFeature';
  import {
    beginStationRecolor,
    capturePlaces,
    setCapturePlaceVisible,
  } from '../stationPipelineFeature';

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

  // X3A archives carry several scans from several stations in one file, and
  // only the scans a panorama was shot from arrive coloured. Everything below
  // is specific to that, so it stays hidden for every other format.
  const archiveName = $derived(
    (filesState.renderTick, host.spatialFiles?.[fileIndex]?.metadata?.containerFileName as string | undefined)
  );
  // The pipeline needs a process that still holds the archive, which only the
  // extension has; the standalone page never sees this control.
  const canRunPipeline = $derived(
    (filesState.renderTick, !!archiveName && host.runningInVSCode === true && !!host.vscode)
  );

  /**
   * The placement the viewer currently has for every scan of this archive,
   * keyed by scan stem.
   *
   * Colouring needs the scans in one frame, but it does not care how they got
   * there — "align all", a hand-built matrix, or an archive that was already
   * consistent all work. Sending what is on screen means the pipeline never
   * throws away alignment the user has already done or corrected.
   */
  function currentTransforms(scope: ReadonlySet<string>): Record<string, number[]> {
    const transforms: Record<string, number[]> = {};
    const alignedOnly =
      registrationState.alignmentAnchorIndex === fileIndex &&
      registrationState.alignedIndices.length > 0
        ? new Set(registrationState.alignedIndices)
        : null;
    for (let index = 0; index < (host.spatialFiles?.length ?? 0); index++) {
      const metadata = host.spatialFiles[index]?.metadata;
      if (metadata?.containerFileName !== archiveName || !metadata?.embeddedScanName) {
        continue;
      }
      if (alignedOnly && !alignedOnly.has(index)) {
        continue;
      }
      const stem = String(metadata.embeddedScanName).replace(/\.x3r$/i, '');
      if (!scope.has(stem)) {
        continue;
      }
      transforms[stem] = Array.from(host.transformationMatrices[index].elements);
    }
    return transforms;
  }

  /** Checked capture places are also the archive-processing scope. */
  function visibleArchiveStems(): string[] {
    const stems: string[] = [];
    for (let index = 0; index < (host.spatialFiles?.length ?? 0); index++) {
      const metadata = host.spatialFiles[index]?.metadata;
      if (
        metadata?.containerFileName !== archiveName ||
        !metadata?.embeddedScanName ||
        filesState.visibility[index] === false
      ) {
        continue;
      }
      stems.push(String(metadata.embeddedScanName).replace(/\.x3r$/i, ''));
    }
    // The action lives in this cloud's panel; never allow a stale visibility
    // signal to produce an empty, expensive no-op request.
    if (stems.length === 0) {
      const own = host.spatialFiles?.[fileIndex]?.metadata?.embeddedScanName;
      if (own) stems.push(String(own).replace(/\.x3r$/i, ''));
    }
    return stems;
  }

  function runPipeline(register: boolean) {
    const scopeScanStems = visibleArchiveStems();
    const scope = new Set(scopeScanStems);
    const diagnostic = stationPipelineUi.projectionDiagnostic;
    const diagnosticRun = diagnostic !== 'normal';
    const recolorExisting = stationPipelineUi.recolorAlreadyColored || diagnosticRun;
    stationPipelineUi.busy = true;
    stationPipelineUi.message = register
      ? 'Registering every scan, then colouring...'
      : diagnosticRun
        ? `Testing projection variant: ${diagnostic}...`
        : 'Colouring with the current alignment...';
    // Blank the archive and switch to the camera view first, so the scans
    // visibly fill in as the host reports each one instead of the view sitting
    // unchanged for a minute and then flipping.
    beginStationRecolor(host, archiveName!, !recolorExisting, scopeScanStems);
    host.vscode.postMessage({
      type: 'stationPipeline',
      options: {
        register,
        transforms: register ? undefined : currentTransforms(scope),
        colorUncolored: true,
        recolorAlreadyColored: recolorExisting,
        projectionDiagnostic: diagnostic,
        scopeScanStems,
        upAxis: registrationState.upAxis,
      },
    });
  }

  // Capture places, derived from where the scans actually registered. Before
  // registration they all sit on the origin and honestly form one group.
  const places = $derived(
    (filesState.renderTick, filesState.renderModeTick, capturePlaces(host, archiveName))
  );
  const placeVisible = (place: { fileIndices: number[] }) =>
    place.fileIndices.some(index => filesState.visibility[index] !== false);

  function togglePlace(place: any, event: Event) {
    setCapturePlaceVisible(host, place, (event.currentTarget as HTMLInputElement).checked);
    filesState.renderModeTick++;
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
      <span class="toggle-icon">{open ? '▼' : '▶'}</span> Align clouds to this one
    </button>

    {#if open}
      <div
        class="registration-content"
        style="background:var(--vscode-editor-background);border:1px solid var(--vscode-panel-border);border-radius:4px;padding:8px;margin-top:4px;font-size:10px;"
      >
        <div style="margin-bottom:6px;">
          <div style="font-weight:bold;">Keep fixed: {fileLabel(fileIndex)}</div>
          <label for={`registration-target-${fileIndex}`} style="display:block;margin-top:4px;">Move onto it:</label>
          <select
            id={`registration-target-${fileIndex}`}
            style="width:100%;margin-top:2px;font-size:10px;"
            value={movingIndex ?? candidates[0]}
            onchange={onTargetChange}
          >
            {#each candidates as candidate (candidate)}
              <option value={candidate}>{fileLabel(candidate)}</option>
            {/each}
          </select>
          <p class="setting-description" style="margin:3px 0 0;">
            This selector is for one-cloud corrections. To select every other cloud, use “Align &
            refine all to this cloud” below; it runs both auto-align and ICP.
          </p>
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
              Double-click a feature on the selected moving cloud, then the same feature on this
              fixed cloud. Three pairs are the minimum; four or more spread around the overlap are
              better.
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
          <span style="font-weight:bold;">3 · Every cloud at once</span>
          <div class="transform-buttons" style="margin-top:3px;">
            <button
              class="registration-align-all"
              onclick={() => registration.alignAllTo(host, fileIndex)}
              disabled={registrationState.busy}
            >
              Align & refine all to this cloud
            </button>
            <button
              class="registration-undo-all"
              onclick={() => registration.undoAlignAll(host)}
              disabled={!registrationState.canUndoAll || registrationState.busy}
            >
              Undo all
            </button>
          </div>
          <p class="setting-description" style="margin:3px 0 0;">
            Registers every other loaded cloud onto this fixed anchor. Each pair runs automatic
            coarse alignment followed by ICP refinement. One bad pair cannot drag the rest out of
            place; failures are listed and excluded from best-camera colouring.
          </p>
          {#if registrationState.alignAllResults.length > 0}
            <ul
              class="registration-align-all-results"
              style="margin:4px 0 0;padding-left:14px;font-family:monospace;"
            >
              {#each registrationState.alignAllResults as line (line)}
                <li>{line}</li>
              {/each}
            </ul>
          {/if}
        </div>

        <div style="margin-bottom:6px;">
          <span style="font-weight:bold;">4 · Refine selected pair</span>
          <div class="transform-buttons" style="margin-top:3px;">
            <button
              class="registration-icp"
              onclick={() => registration.refineIcp(host)}
              disabled={!active || registrationState.busy}
            >
              Refine selected (ICP)
            </button>
            <button
              class="registration-undo"
              onclick={() => registration.undo(host)}
              disabled={!active || !registrationState.canUndo || registrationState.busy}
            >
              Undo align
            </button>
          </div>
          <p class="setting-description" style="margin:3px 0 0;">
            Refines only “{movingIndex === null ? 'the selected cloud' : fileLabel(movingIndex)}”
            against this fixed cloud. “Align & refine all” above has already run ICP for every
            successful cloud.
          </p>
        </div>

        {#if canRunPipeline}
          <div style="margin-bottom:6px;border-top:1px solid var(--vscode-panel-border);padding-top:6px;">
            <span style="font-weight:bold;">Archive: {archiveName}</span>
            <div class="transform-buttons" style="margin-top:3px;">
              <button
                class="station-pipeline-run"
                onclick={() => runPipeline(false)}
                disabled={stationPipelineUi.busy || registrationState.busy}
              >
                {stationPipelineUi.busy ? 'Working...' : 'Colour using best aligned cameras'}
              </button>
              <button
                class="station-pipeline-register"
                onclick={() => runPipeline(true)}
                disabled={stationPipelineUi.busy || registrationState.busy}
              >
                Register first, then colour
              </button>
            </div>
            <label style="display:block;margin-top:3px;">
              <input type="checkbox" bind:checked={stationPipelineUi.recolorAlreadyColored} />
              Also recolour scans that already have camera colour
            </label>
            <label style="display:block;margin-top:5px;">
              Projection diagnostic
              <select
                class="station-projection-diagnostic"
                style="display:block;width:100%;margin-top:2px;font-size:10px;"
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
              <p class="setting-description" style="margin:3px 0 0;">
                Diagnostic runs replace existing camera colour so the selected model can be
                compared on the same nearby edges. Return this to “Normal” after testing.
              </p>
            {/if}
            <p class="setting-description" style="margin:3px 0 0;">
              Re-reads the archive so it can use the full-resolution photographs, then colours the
              scans no camera of their own station covered. For every point, exactly one valid
              camera wins: the best-centred view clear of frame edges. Occluded cameras are rejected.
              <br />
              After “Align & refine all”, only the anchor and successfully aligned scans are eligible;
              photographs from failed scans are excluded. Without a preceding align-all run, all
              current transforms are accepted so manually aligned archives still work. The second
              button re-derives alignment itself and discards what is on screen.
              Only scans in checked/visible capture places are parsed, used as cameras, and
              recoloured; hiding the other places therefore makes a focused run faster.
            </p>
            {#if places.length > 1}
              <div style="margin-top:6px;">
                <span style="font-weight:bold;">Capture places</span>
                {#each places as place (place.name)}
                  <label style="display:block;margin-top:2px;">
                    <input
                      type="checkbox"
                      class="capture-place-toggle"
                      data-place={place.name}
                      checked={placeVisible(place)}
                      onchange={event => togglePlace(place, event)}
                    />
                    {place.name}
                    <span style="opacity:0.7;">
                      ({place.fileIndices.length} scan{place.fileIndices.length === 1 ? '' : 's'})
                    </span>
                  </label>
                {/each}
                <p class="setting-description" style="margin:3px 0 0;">
                  Hides everything captured from one tripod position at once, its panoramas
                  included. Grouped by where the scans registered, so they only separate once the
                  archive has been aligned.
                </p>
              </div>
            {/if}

            {#if stationPipelineUi.message}
              <div class="station-pipeline-result" style="margin-top:4px;font-family:monospace;">
                {stationPipelineUi.message}
              </div>
            {/if}
          </div>
        {/if}

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
          balancing or loop closure. Pairwise results land in the selected moving file's transform.
        </p>
      </div>
    {/if}
  </div>
{/if}
