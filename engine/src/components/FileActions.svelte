<script lang="ts">
  import { fileActions, type FileAction } from '../fileActions';
  import type { FileListHost } from './fileListTypes';
  import type { FileEntry } from '../state/fileEntries';
  import { filesState } from '../state/files.svelte';
  import {
    fileSelection,
    fileActionUi,
    clearSelection,
    selectAllListed,
  } from '../state/fileSelection.svelte';

  let { host }: { host: FileListHost } = $props();

  const selected = $derived(
    (filesState.entries,
    fileSelection.ids
      .map((id) => host.fileEntries.get(id))
      .filter((entry): entry is FileEntry => !!entry)),
  );
  const targets = (action: FileAction) => selected.filter((e) => action.appliesTo(e, host));

  function trigger(action: FileAction) {
    fileActionUi.menu = null;
    const entries = targets(action);
    if (!entries.length) return;
    if (action.form) {
      fileActionUi.form = action.id;
      return;
    }
    action.run(host, entries);
  }

  // ---- subsample form ----
  const PREFS_KEY = 'ply-visualizer.subsampleLoaded.v1';
  function loadPrefs() {
    try {
      return { mode: 'percent', percent: 10, max: 1000000, ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') };
    } catch {
      return { mode: 'percent', percent: 10, max: 1000000 };
    }
  }
  const prefs = loadPrefs();
  let mode = $state<'percent' | 'max'>(prefs.mode === 'max' ? 'max' : 'percent');
  let percent = $state<number>(prefs.percent);
  let maxPoints = $state<number>(prefs.max);

  const subsampleAction = fileActions.find((a) => a.id === 'subsample')!;
  const formTargets = $derived(fileActionUi.form === 'subsample' ? targets(subsampleAction) : []);
  const formOptions = $derived(
    mode === 'percent'
      ? percent > 0 && percent < 100
        ? { fraction: percent / 100 }
        : null
      : maxPoints >= 1
        ? { maxPoints: Math.floor(maxPoints) }
        : null,
  );
  const formBefore = $derived(formTargets.reduce((sum, e) => sum + (e.spatial?.data.vertexCount ?? 0), 0));
  const formAfter = $derived(
    formOptions
      ? formTargets.reduce((sum, e) => {
          const n = e.spatial?.data.vertexCount ?? 0;
          return (
            sum +
            ('fraction' in formOptions
              ? Math.max(1, Math.round(n * formOptions.fraction))
              : Math.min(n, formOptions.maxPoints))
          );
        }, 0)
      : formBefore,
  );

  function applySubsample() {
    if (!formOptions || !formTargets.length) return;
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ mode, percent, max: maxPoints }));
    } catch {
      // per-viewer convenience only
    }
    subsampleAction.run(host, formTargets, formOptions);
    fileActionUi.form = null;
  }

  function formKey(event: KeyboardEvent) {
    // Keep the viewer's shortcuts (digits, arrows) out of the inputs.
    event.stopPropagation();
    if (event.key === 'Enter') applySubsample();
    if (event.key === 'Escape') fileActionUi.form = null;
  }

  $effect(() => {
    if (!selected.length) {
      fileActionUi.form = null;
      fileActionUi.menu = null;
    }
  });

  // ---- context menu ----
  function portal(node: HTMLElement) {
    document.body.appendChild(node);
    // Keep it on screen.
    const rect = node.getBoundingClientRect();
    if (rect.right > window.innerWidth - 4) node.style.left = `${Math.max(4, window.innerWidth - rect.width - 4)}px`;
    if (rect.bottom > window.innerHeight - 4) node.style.top = `${Math.max(4, window.innerHeight - rect.height - 4)}px`;
    const close = (event: Event) => {
      if (event.type === 'keydown') {
        if ((event as KeyboardEvent).key !== 'Escape') return;
        event.stopPropagation();
      } else if (node.contains(event.target as Node)) {
        return;
      }
      fileActionUi.menu = null;
    };
    window.addEventListener('pointerdown', close, true);
    window.addEventListener('keydown', close, true);
    window.addEventListener('blur', close);
    window.addEventListener('wheel', close, { capture: true, passive: true });
    return {
      destroy() {
        window.removeEventListener('pointerdown', close, true);
        window.removeEventListener('keydown', close, true);
        window.removeEventListener('blur', close);
        window.removeEventListener('wheel', close, true);
        node.remove();
      },
    };
  }

  const fmt = (n: number) => n.toLocaleString();
</script>

{#if selected.length}
  <div class="file-actions-bar" role="toolbar" aria-label="Actions for selected files">
    <span class="fa-count">{selected.length} selected</span>
    {#each fileActions as action (action.id)}
      {@const n = targets(action).length}
      <button
        class="fa-btn"
        class:danger={action.danger}
        class:on={fileActionUi.form === action.id}
        disabled={!n}
        title={n < selected.length && n ? `${action.title} (${n} of ${selected.length} apply)` : action.title}
        onclick={() => trigger(action)}>{action.label}</button
      >
    {/each}
    <span class="fa-spacer"></span>
    <button class="fa-btn" title="Select every listed file" onclick={selectAllListed}>All</button>
    <button class="fa-btn" title="Clear the selection" onclick={clearSelection}>✕</button>
  </div>
  {#if fileActionUi.form === 'subsample'}
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div class="fa-form" onkeydown={formKey} role="group" aria-label="Subsample">
      <label><input type="radio" bind:group={mode} value="percent" /> Keep
        <input type="number" min="0.01" max="99.99" step="any" bind:value={percent} disabled={mode !== 'percent'} /> % of points</label>
      <label><input type="radio" bind:group={mode} value="max" /> At most
        <input type="number" min="1" step="100000" bind:value={maxPoints} disabled={mode !== 'max'} /> points per file</label>
      <div class="fa-hint">
        {formTargets.length} cloud{formTargets.length === 1 ? '' : 's'}: {fmt(formBefore)} → {fmt(formAfter)} points.
        The dropped points are gone until you reopen the file.
      </div>
      <div class="fa-form-buttons">
        <button class="fa-btn" onclick={() => (fileActionUi.form = null)}>Cancel</button>
        <button class="fa-btn primary" disabled={!formOptions || formAfter >= formBefore} onclick={applySubsample}>Subsample</button>
      </div>
    </div>
  {/if}
{/if}

{#if fileActionUi.menu && selected.length}
  <div
    class="file-context-menu"
    role="menu"
    use:portal
    style="left: {fileActionUi.menu.x}px; top: {fileActionUi.menu.y}px;"
  >
    <div class="fcm-head">{selected.length} selected</div>
    {#each fileActions as action (action.id)}
      {@const n = targets(action).length}
      <button role="menuitem" class:danger={action.danger} disabled={!n} title={action.title} onclick={() => trigger(action)}
        >{action.label}{#if n && n < selected.length}<span class="fcm-n">{n}</span>{/if}</button
      >
    {/each}
  </div>
{/if}

<style>
  /* A plain toolbar row between separators, like the group and collapse rows. */
  .file-actions-bar {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px 4px;
    /* The collapse row above ends with a 4px margin: 4 + 4 matches the 8px below. */
    padding: 4px 0 8px;
    margin-bottom: 8px;
    border-bottom: 1px solid var(--vscode-sideBar-border, rgba(127, 127, 127, 0.3));
  }
  .fa-count {
    font-size: 11px;
    font-weight: 600;
    margin-left: 3px;
    margin-right: 6px;
  }
  .fa-spacer {
    flex: 1;
  }
  .fa-btn {
    font: inherit;
    font-size: 11px;
    color: var(--vscode-foreground);
    background: transparent;
    border: 1px solid var(--vscode-sideBar-border, #555);
    border-radius: 3px;
    padding: 1px 6px;
    cursor: pointer;
    white-space: nowrap;
  }
  .fa-btn:hover:not(:disabled) {
    background: var(--vscode-list-hoverBackground);
  }
  .fa-btn:disabled {
    opacity: 0.45;
    cursor: default;
  }
  .fa-btn.on,
  .fa-btn.primary:not(:disabled) {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border-color: var(--vscode-button-background);
  }
  .fa-btn.danger:not(:disabled):hover {
    border-color: #c74e39;
  }
  .fa-form {
    display: grid;
    gap: 6px;
    padding: 0 0 8px;
    margin-bottom: 8px;
    border-bottom: 1px solid var(--vscode-sideBar-border, rgba(127, 127, 127, 0.3));
    font-size: 11px;
  }
  .fa-form label {
    display: flex;
    align-items: center;
    gap: 5px;
    flex-wrap: wrap;
  }
  .fa-form input[type='number'] {
    width: 7em;
    font: inherit;
    padding: 1px 4px;
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border, #555);
    border-radius: 2px;
  }
  .fa-form input[type='number']:disabled {
    opacity: 0.5;
  }
  .fa-hint {
    color: var(--vscode-descriptionForeground);
  }
  .fa-form-buttons {
    display: flex;
    justify-content: flex-end;
    gap: 6px;
  }
  :global(.file-context-menu) {
    position: fixed;
    z-index: 2147483000;
    min-width: 150px;
    padding: 4px 0;
    background: var(--vscode-menu-background, var(--vscode-editor-background, #252526));
    color: var(--vscode-menu-foreground, var(--vscode-foreground, #ccc));
    border: 1px solid var(--vscode-menu-border, var(--vscode-sideBar-border, #454545));
    border-radius: 5px;
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
    font-size: 12px;
  }
  :global(.file-context-menu .fcm-head) {
    padding: 3px 12px 5px;
    font-size: 11px;
    color: var(--vscode-descriptionForeground, #999);
    border-bottom: 1px solid var(--vscode-menu-separatorBackground, rgba(127, 127, 127, 0.3));
    margin-bottom: 3px;
  }
  :global(.file-context-menu button) {
    display: flex;
    width: 100%;
    justify-content: space-between;
    gap: 12px;
    padding: 4px 12px;
    font: inherit;
    text-align: left;
    color: inherit;
    background: transparent;
    border: 0;
    cursor: pointer;
  }
  :global(.file-context-menu button:hover:not(:disabled)) {
    background: var(--vscode-menu-selectionBackground, var(--vscode-list-hoverBackground, #094771));
    color: var(--vscode-menu-selectionForeground, inherit);
  }
  :global(.file-context-menu button:disabled) {
    opacity: 0.45;
    cursor: default;
  }
  :global(.file-context-menu button.danger:not(:disabled)) {
    color: #f48771;
  }
  :global(.file-context-menu .fcm-n) {
    opacity: 0.6;
    font-size: 11px;
  }
</style>
