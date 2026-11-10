<script lang="ts">
  import { onMount } from 'svelte';
  import { filesState } from '../state/files.svelte';
  import { soloState, soloLayout, saveSoloLayout } from '../state/solo.svelte';
  import { fileGroupsState } from '../state/fileGroups.svelte';
  import type { FileEntry } from '../state/fileEntries';
  import type { SoloController } from '../soloMode';
  import { smartAbbreviate } from '../utils/smartAbbreviate';
  import { maskPointerInput } from '../utils/pointerMask';

  let { solo, sequenceMode }: { solo: SoloController; sequenceMode: () => boolean } = $props();

  const items = $derived.by(() => {
    filesState.entries;
    soloState.scopeIds;
    return solo.soloable();
  });
  const sceneName = $derived.by(() => {
    filesState.entries;
    soloState.scopeIds;
    fileGroupsState.enabled;
    fileGroupsState.active;
    return fileGroupsState.enabled ? (solo.activeGroup()?.prefix ?? '') : '';
  });
  const active = $derived(soloState.ids.length > 0);
  const show = $derived(
    (filesState.entries,
    (items.length >= 2 || (!!sceneName && solo.groups().length > 1)) && !sequenceMode()),
  );
  const names = $derived(items.map(entryName));
  const shortNames = $derived(smartAbbreviate(names));
  const primaryIndex = $derived(items.findIndex((item) => item.id === soloState.primaryId));

  function entryName(entry: FileEntry): string {
    return (
      entry.spatial?.data.fileName ??
      entry.pose?.meta.fileName ??
      entry.camera?.name ??
      `Object ${entry.id}`
    );
  }

  function onItem(event: MouseEvent, entry: FileEntry) {
    if (event.ctrlKey || event.metaKey || event.shiftKey) {
      solo.toggleAdditive(entry.id);
    } else {
      solo.soloExclusive(entry.id);
    }
  }

  /**
   * Shows the full name when it fits and the smart abbreviation only when it
   * does not; CSS ellipsis remains the last resort. Re-checks on resize.
   */
  function fitName(node: HTMLElement, params: { full: string; short: string; enabled: boolean }) {
    let current = params;
    const fit = () => {
      node.textContent = current.full;
      if (current.enabled && current.short !== current.full && node.scrollWidth > node.clientWidth) {
        node.textContent = current.short;
      }
    };
    const observer = new ResizeObserver(fit);
    observer.observe(node);
    fit();
    return {
      update(next: typeof params) {
        current = next;
        fit();
      },
      destroy() {
        observer.disconnect();
      },
    };
  }

  // ---- floating, draggable, resizable panel --------------------------------
  let panel = $state<HTMLDivElement | null>(null);
  const MIN_W = 220;
  const MIN_H = 90;

  function defaultRect() {
    const w = Math.min(640, window.innerWidth - 32);
    const h = 150;
    return { x: Math.round((window.innerWidth - w) / 2), y: window.innerHeight - h - 16, w, h };
  }

  function clampRect(rect: { x: number; y: number; w: number; h: number }) {
    const w = Math.max(MIN_W, Math.min(rect.w, window.innerWidth - 8));
    const h = Math.max(MIN_H, Math.min(rect.h, window.innerHeight - 8));
    return {
      w,
      h,
      x: Math.max(4, Math.min(rect.x, window.innerWidth - w - 4)),
      y: Math.max(4, Math.min(rect.y, window.innerHeight - h - 4)),
    };
  }

  let rect = $state(clampRect(soloLayout.rect ?? defaultRect()));

  function persistRect() {
    soloLayout.rect = { ...rect };
    saveSoloLayout();
  }

  function onHeaderPointerDown(event: PointerEvent) {
    if ((event.target as HTMLElement).closest('button')) return;
    const startX = event.clientX;
    const startY = event.clientY;
    const origin = { ...rect };
    const header = event.currentTarget as HTMLElement;
    header.setPointerCapture(event.pointerId);
    const unmask = maskPointerInput('move');
    const move = (e: PointerEvent) => {
      rect = clampRect({ ...origin, x: origin.x + e.clientX - startX, y: origin.y + e.clientY - startY });
    };
    const up = () => {
      header.removeEventListener('pointermove', move);
      header.removeEventListener('pointerup', up);
      header.removeEventListener('pointercancel', up);
      unmask();
      persistRect();
    };
    header.addEventListener('pointermove', move);
    header.addEventListener('pointerup', up);
    header.addEventListener('pointercancel', up);
  }

  function onResizePointerDown(event: PointerEvent) {
    event.preventDefault();
    const startX = event.clientX;
    const startY = event.clientY;
    const origin = { ...rect };
    const grip = event.currentTarget as HTMLElement;
    grip.setPointerCapture(event.pointerId);
    const unmask = maskPointerInput('nwse-resize');
    const move = (e: PointerEvent) => {
      rect = clampRect({
        ...origin,
        w: origin.w + e.clientX - startX,
        h: origin.h + e.clientY - startY,
      });
    };
    const up = () => {
      grip.removeEventListener('pointermove', move);
      grip.removeEventListener('pointerup', up);
      grip.removeEventListener('pointercancel', up);
      unmask();
      persistRect();
    };
    grip.addEventListener('pointermove', move);
    grip.addEventListener('pointerup', up);
    grip.addEventListener('pointercancel', up);
  }

  onMount(() => {
    const onWindowResize = () => (rect = clampRect(rect));
    window.addEventListener('resize', onWindowResize);
    return () => window.removeEventListener('resize', onWindowResize);
  });

  function setMode(mode: 'list' | 'tiles') {
    soloLayout.mode = mode;
    saveSoloLayout();
  }
  function setColumns(delta: number) {
    soloLayout.columns = Math.min(12, Math.max(1, soloLayout.columns + delta));
    saveSoloLayout();
  }
  function toggleAbbreviate() {
    soloLayout.abbreviate = !soloLayout.abbreviate;
    saveSoloLayout();
  }

  // Keep the soloed item in view when stepping with the keyboard.
  $effect(() => {
    soloState.primaryId;
    const el = panel?.querySelector('.solo-item.primary');
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  });
</script>

{#if show}
  {#if soloState.barCollapsed}
    <button
      class="solo-pill"
      class:lit={active}
      style:left="{rect.x}px"
      style:top="{rect.y + rect.h - 28}px"
      title={active && primaryIndex >= 0 ? `Solo: ${names[primaryIndex]}` : 'Show solo panel'}
      onclick={() => (soloState.barCollapsed = false)}
      >S{active && primaryIndex >= 0 ? ` · ${shortNames[primaryIndex]}` : ''}</button
    >
  {:else}
    <div
      bind:this={panel}
      class="solo-panel"
      role="toolbar"
      aria-label="Solo"
      style:left="{rect.x}px"
      style:top="{rect.y}px"
      style:width="{rect.w}px"
      style:height="{rect.h}px"
    >
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="solo-header" onpointerdown={onHeaderPointerDown} title="Drag to move">
        <span class="solo-label" class:lit={active}>SOLO</span>
        <span class="solo-count">{active ? `${soloState.ids.length}/${items.length}` : items.length}</span>
        {#if sceneName}
          <button class="hb" title="Previous scene (←)" onclick={() => solo.stepGroup(-1)}>«</button>
          <span class="solo-scene" title={`Scene: ${sceneName}`}>{sceneName}</span>
          <button class="hb" title="Next scene (→)" onclick={() => solo.stepGroup(1)}>»</button>
        {/if}
        <button class="hb" title="Previous ([ or ↑)" onclick={() => solo.step(-1)}>‹</button>
        <button class="hb" title="Next (] or ↓)" onclick={() => solo.step(1)}>›</button>
        <span class="spacer"></span>
        <div class="seg" role="group" aria-label="Layout">
          <button class:on={soloLayout.mode === 'list'} title="List" onclick={() => setMode('list')}>☰</button>
          <button class:on={soloLayout.mode === 'tiles'} title="Tiles" onclick={() => setMode('tiles')}>▦</button>
        </div>
        {#if soloLayout.mode === 'tiles'}
          <button class="hb" title="Fewer columns" onclick={() => setColumns(-1)}>−</button>
          <span class="solo-cols" title="Columns">{soloLayout.columns}</span>
          <button class="hb" title="More columns" onclick={() => setColumns(1)}>+</button>
        {/if}
        <button
          class="hb"
          class:on={soloLayout.abbreviate}
          aria-pressed={soloLayout.abbreviate}
          title="Shorten long names by collapsing the parts all names share"
          onclick={toggleAbbreviate}>a…z</button
        >
        {#if active}
          <button class="hb" title="Exit solo (0 or Esc)" onclick={() => solo.exit()}>✕</button>
        {/if}
        <button class="hb" title="Minimize" onclick={() => (soloState.barCollapsed = true)}>▾</button>
      </div>
      <div
        class="solo-body"
        class:list={soloLayout.mode === 'list'}
        style:grid-template-columns={soloLayout.mode === 'tiles'
          ? `repeat(${soloLayout.columns}, minmax(0, 1fr))`
          : '1fr'}
      >
        {#each items as entry, i (entry.id)}
          {@const lit = soloState.ids.includes(entry.id)}
          <button
            class="solo-item"
            class:lit
            class:primary={entry.id === soloState.primaryId}
            class:dim={active && !lit}
            class:muted={!active && entry.state.visible === false}
            title={`${names[i]}\nClick: solo · Ctrl/Shift-click: add to solo${i < 9 ? ` · key ${i + 1}` : ''}`}
            onclick={(e) => onItem(e, entry)}
          >
            <span class="solo-key">{i + 1}</span>
            <span
              class="solo-name"
              use:fitName={{ full: names[i], short: shortNames[i], enabled: soloLayout.abbreviate }}
            ></span>
          </button>
        {/each}
      </div>
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="solo-grip" title="Resize" onpointerdown={onResizePointerDown}></div>
    </div>
  {/if}
{/if}

<style>
  .solo-panel {
    position: fixed;
    z-index: 900;
    display: flex;
    flex-direction: column;
    border-radius: 8px;
    background: color-mix(in srgb, var(--vscode-editor-background, #1e1e1e) 90%, transparent);
    border: 1px solid var(--vscode-panel-border, #444);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
    font-family: var(--vscode-font-family, system-ui, sans-serif);
    font-size: 12px;
    color: var(--vscode-foreground, #ccc);
    backdrop-filter: blur(6px);
    user-select: none;
    overflow: hidden;
  }
  .solo-header {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 3px 6px;
    cursor: move;
    border-bottom: 1px solid var(--vscode-panel-border, #444);
    flex-shrink: 0;
  }
  .spacer {
    flex: 1;
  }
  .solo-label {
    font-weight: 700;
    letter-spacing: 0.08em;
    font-size: 10px;
    padding: 0 4px;
    opacity: 0.6;
  }
  .solo-label.lit {
    color: #f5c518;
    opacity: 1;
  }
  .solo-scene {
    font-weight: 600;
    max-width: 180px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .solo-count,
  .solo-cols {
    font-size: 10px;
    opacity: 0.6;
    padding: 0 3px;
    font-variant-numeric: tabular-nums;
  }
  button {
    font: inherit;
    color: inherit;
    cursor: pointer;
    border: 1px solid transparent;
    border-radius: 5px;
    background: transparent;
    padding: 2px 6px;
    white-space: nowrap;
  }
  button:hover {
    background: var(--vscode-toolbar-hoverBackground, rgba(255, 255, 255, 0.08));
  }
  .hb {
    opacity: 0.8;
  }
  .hb.on,
  .seg button.on {
    background: rgba(127, 127, 127, 0.28);
    opacity: 1;
  }
  .seg {
    display: flex;
    border: 1px solid var(--vscode-panel-border, #444);
    border-radius: 5px;
    overflow: hidden;
    margin: 0 4px;
  }
  .seg button {
    border-radius: 0;
    padding: 1px 6px;
  }
  .solo-body {
    flex: 1;
    min-height: 0;
    overflow: auto;
    display: grid;
    gap: 4px;
    padding: 6px;
    align-content: start;
    scrollbar-width: thin;
  }
  .solo-body.list {
    gap: 2px;
  }
  .solo-item {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    text-align: left;
    border-color: var(--vscode-panel-border, #444);
  }
  .solo-body.list .solo-item {
    border-color: transparent;
  }
  .solo-item.lit {
    background: #f5c518;
    border-color: #f5c518;
    color: #1a1a1a;
    font-weight: 600;
  }
  .solo-item.primary {
    outline: 1px solid #f5c518;
    outline-offset: 1px;
  }
  .solo-item.dim {
    opacity: 0.55;
  }
  .solo-item.muted .solo-name {
    text-decoration: line-through;
    opacity: 0.6;
  }
  .solo-key {
    flex-shrink: 0;
    font-size: 10px;
    font-weight: 700;
    min-width: 16px;
    height: 15px;
    line-height: 15px;
    text-align: center;
    border-radius: 3px;
    background: rgba(127, 127, 127, 0.25);
    font-variant-numeric: tabular-nums;
  }
  .solo-item.lit .solo-key {
    background: rgba(0, 0, 0, 0.18);
  }
  .solo-name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .solo-grip {
    position: absolute;
    right: 0;
    bottom: 0;
    width: 14px;
    height: 14px;
    cursor: nwse-resize;
    background: linear-gradient(
      135deg,
      transparent 50%,
      rgba(127, 127, 127, 0.6) 50%,
      rgba(127, 127, 127, 0.6) 60%,
      transparent 60%,
      transparent 70%,
      rgba(127, 127, 127, 0.6) 70%,
      rgba(127, 127, 127, 0.6) 80%,
      transparent 80%
    );
  }
  .solo-pill {
    position: fixed;
    z-index: 900;
    max-width: 360px;
    overflow: hidden;
    text-overflow: ellipsis;
    border: 1px solid var(--vscode-panel-border, #444);
    background: color-mix(in srgb, var(--vscode-editor-background, #1e1e1e) 90%, transparent);
    font-family: var(--vscode-font-family, system-ui, sans-serif);
    font-size: 12px;
    color: var(--vscode-foreground, #ccc);
  }
  .solo-pill.lit {
    background: #f5c518;
    color: #1a1a1a;
    font-weight: 600;
  }
</style>
