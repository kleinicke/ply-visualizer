<script lang="ts">
  import { filesState } from '../state/files.svelte';

  let { host }: { host: any } = $props();

  /**
   * One size for every loaded cloud, at the foot of the file list.
   *
   * Absolute rather than a multiplier: the per-file sliders show real sizes, and
   * a hidden factor between what they read and what is drawn is worse than
   * simply setting them.
   *
   * It stays *inactive* until used, and goes back to inactive whenever the
   * clouds disagree — which happens the moment someone adjusts one row on its
   * own. An active control claiming a single number while the scene holds three
   * different ones would be lying, and stepping such a slider would silently
   * flatten sizes the user had deliberately set.
   */
  const sizes = $derived(
    (filesState.renderTick,
    filesState.renderModeTick,
    (host.spatialFiles ?? []).map((_: unknown, index: number) => filesState.pointSizes[index] ?? 0))
  );
  const cloudCount = $derived(sizes.length);
  const inSync = $derived(
    cloudCount > 0 && sizes.every((size: number) => Math.abs(size - sizes[0]) < 1e-9)
  );

  // Dimmed means one thing only: the clouds are not all on the same size, so
  // there is no single number for this control to honestly show. Clouds that
  // already agree - the normal case on load - leave it live.
  const active = $derived(inSync);
  const shownSize = $derived(inSync && cloudCount > 0 ? sizes[0] : 0);
  const sliderMax = $derived(Math.max(0.05, shownSize * 2));

  function applyToAll(size: number) {
    if (!(size > 0)) {
      return;
    }
    for (let index = 0; index < (host.spatialFiles ?? []).length; index++) {
      if (!host.spatialFiles[index]) {
        continue;
      }
      host.updatePointSize(index, size);
      filesState.pointSizes[index] = size;
    }
    // The per-file rows read their slider positions from this tick.
    filesState.renderModeTick++;
    host.requestRender();
  }

  function onSliderInput(event: Event) {
    applyToAll(parseFloat((event.target as HTMLInputElement).value));
  }

  /** Typed entry, so a size beyond the slider's range is still reachable. */
  function onNumberCommit(event: Event) {
    const input = event.target as HTMLInputElement;
    const size = parseFloat(input.value);
    if (size > 0) {
      applyToAll(size);
    } else {
      input.value = inSync && shownSize ? shownSize.toFixed(4) : '';
    }
  }

  function onNumberKey(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      (event.target as HTMLInputElement).blur();
    }
  }

  /**
   * Clicking a dimmed control adopts the first cloud's size for everything,
   * which is what makes it meaningful again - and it is an explicit action
   * rather than a silent flattening of sizes someone chose per file.
   */
  function engage() {
    if (!inSync) {
      applyToAll(sizes[0] || 0.005);
    }
  }
</script>

{#if cloudCount > 1}
  <!-- The file rows' own frame, without their class: several specs count
       `.file-item`, and this is a footer control rather than a file. -->
  <div
    class="all-point-sizes"
    style="background-color: var(--vscode-list-hoverBackground); border: 1px solid var(--vscode-sideBar-border); border-radius: 4px; margin-bottom: 8px; padding: 8px; font-size: 11px; opacity: {active
      ? 1
      : 0.65};"
  >
    <!-- Same markup and classes as a file row's own point-size control, so the
         shared one reads as the same kind of thing rather than as a stray
         widget with its own look. -->
    <div class="point-size-control" style="margin-top: 0;">
      <label for="all-point-sizes-slider">All Sizes:</label>
      <input
        type="range"
        id="all-point-sizes-slider"
        class="size-slider"
        min="0.0001"
        max={sliderMax}
        step="0.0001"
        value={shownSize}
        style="width: 100%;"
        oninput={onSliderInput}
        onpointerdown={engage}
        title={active
          ? 'Sets every loaded cloud'
          : 'The clouds are at different sizes - click to put them all on one'}
      />
      <input
        type="text"
        id="all-point-sizes-value"
        class="size-input"
        value={inSync ? shownSize.toFixed(4) : ''}
        placeholder="mixed"
        style="font-size: 10px; width: 44px; border: none; background: transparent; color: var(--vscode-foreground); text-align: left; padding: 0; margin: 0; outline: none; cursor: text;"
        title="Type a size, including one beyond the slider's range"
        onblur={onNumberCommit}
        onkeydown={onNumberKey}
        onfocus={(event) => (event.target as HTMLInputElement).select()}
      />
    </div>
  </div>
{/if}
