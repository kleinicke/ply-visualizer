<script lang="ts">
  import type { FileListHost } from './fileListTypes';
  import { filesState } from '../state/files.svelte';
  import { fileGroupsState } from '../state/fileGroups.svelte';
  import { soloState } from '../state/solo.svelte';
  import { compileGroupRegex, groupRegexPresets, NO_MATCH } from '../utils/regexGroups';

  let { host }: { host: FileListHost } = $props();

  const hasFiles = $derived((filesState.entries, host.solo.topLevel().length > 0));
  const groups = $derived.by(() => {
    filesState.entries;
    fileGroupsState.enabled;
    fileGroupsState.regex;
    return host.solo.groups();
  });
  const active = $derived.by(() => {
    fileGroupsState.active;
    soloState.scopeIds;
    return host.solo.activeGroup(groups);
  });
  const activeIndex = $derived(active ? groups.indexOf(active) : -1);
  const presets = groupRegexPresets();

  // The field is edited locally and applied on Enter / leaving the field, so
  // a half-typed pattern never regroups the scene.
  let draft = $state(fileGroupsState.regex);
  $effect(() => {
    draft = fileGroupsState.regex;
  });
  const draftCheck = $derived(compileGroupRegex(draft));
  const noMatchCount = $derived(groups.find((g) => g.key === NO_MATCH)?.members.length ?? 0);

  let helpOpen = $state(false);

  function apply(source = draft) {
    host.solo.setGroupRegex(source.trim(), true);
  }

  function onRegexKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      apply();
      (event.currentTarget as HTMLInputElement).blur();
    } else if (event.key === 'Escape') {
      draft = fileGroupsState.regex;
      (event.currentTarget as HTMLInputElement).blur();
    }
  }

  // Recent patterns + presets menu. A custom menu rather than a <select>:
  // the native popup opens left-aligned and as wide as its longest pattern,
  // which runs off the right edge of the window. This one is right-aligned
  // to the button, width-capped and positioned in viewport coordinates so the
  // panel's own scrolling/clipping cannot cut it off.
  type MenuItem = { source: string; label: string | null };
  const menuItems = $derived<{ heading: string; items: MenuItem[] }[]>([
    ...(fileGroupsState.recent.length
      ? [{ heading: 'Recent', items: fileGroupsState.recent.map((source: string) => ({ source, label: null })) }]
      : []),
    { heading: 'Presets', items: presets.map((p) => ({ source: p.source, label: p.label })) },
  ]);
  const flatItems = $derived(menuItems.flatMap((section) => section.items));
  let menuOpen = $state(false);
  let menuButton = $state<HTMLButtonElement | null>(null);
  let menuEl = $state<HTMLDivElement | null>(null);
  let menuPos = $state({ top: 0, right: 0, maxHeight: 300, maxWidth: 420 });
  let highlighted = $state(-1);

  function placeMenu() {
    if (!menuButton) return;
    const rect = menuButton.getBoundingClientRect();
    const margin = 8;
    menuPos = {
      top: rect.bottom + 2,
      right: Math.max(margin, window.innerWidth - rect.right),
      maxHeight: Math.max(120, window.innerHeight - rect.bottom - margin - 2),
      // Long patterns ellipsize (hover shows them in full) instead of
      // stretching the menu across the window.
      maxWidth: Math.max(200, Math.min(480, rect.right - margin)),
    };
  }

  function openMenu() {
    placeMenu();
    highlighted = flatItems.findIndex((item) => item.source === fileGroupsState.regex);
    menuOpen = true;
    queueMicrotask(() => menuEl?.focus());
  }

  function closeMenu(refocus = true) {
    menuOpen = false;
    if (refocus) menuButton?.focus();
  }

  function pick(source: string) {
    draft = source;
    apply(source);
    closeMenu();
  }

  function onMenuKeydown(event: KeyboardEvent) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      const delta = event.key === 'ArrowDown' ? 1 : -1;
      highlighted = (highlighted + delta + flatItems.length) % flatItems.length;
      menuEl?.querySelectorAll('.group-menu-item')[highlighted]?.scrollIntoView({ block: 'nearest' });
    } else if (event.key === 'Enter' && highlighted >= 0) {
      pick(flatItems[highlighted].source);
    } else if (event.key === 'Escape' || event.key === 'Tab') {
      closeMenu(event.key === 'Escape');
    } else {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
  }

  function setAllCollapsed(collapsed: boolean) {
    for (const entry of host.fileEntries.all) {
      entry.state.collapsed = collapsed;
    }
  }

  function onWindowPointerDown(event: PointerEvent) {
    const target = event.target as HTMLElement;
    if (helpOpen && !target.closest('.group-help, .group-help-btn')) {
      helpOpen = false;
    }
    if (menuOpen && !target.closest('.group-menu, .group-recent')) {
      closeMenu(false);
    }
  }
  function onWindowKeydown(event: KeyboardEvent) {
    if (helpOpen && event.key === 'Escape') helpOpen = false;
  }
</script>

<svelte:window
  onpointerdown={onWindowPointerDown}
  onkeydown={onWindowKeydown}
  onresize={() => menuOpen && placeMenu()}
/>

{#if hasFiles}
  <div class="file-list-toolbar">
    <button class="flt-btn" title="Collapse all objects" onclick={() => setAllCollapsed(true)}
      >▶ Collapse all</button
    >
    <button class="flt-btn" title="Expand all objects" onclick={() => setAllCollapsed(false)}
      >▼ Expand all</button
    >
    <span class="flt-spacer"></span>
    <button
      class="flt-btn"
      class:on={fileGroupsState.enabled}
      aria-pressed={fileGroupsState.enabled}
      title="Group files by a pattern in their names and show one group at a time"
      onclick={() => host.solo.setGroupingEnabled(!fileGroupsState.enabled)}>Group</button
    >
    <button
      class="flt-btn group-help-btn"
      class:on={helpOpen}
      title="How grouping works"
      aria-expanded={helpOpen}
      onclick={() => (helpOpen = !helpOpen)}>?</button
    >
  </div>

  {#if helpOpen}
    <div class="group-help" role="dialog" aria-label="How grouping works">
      <p>
        <b>Group</b> splits the open files into groups and shows <b>one group at a time</b> — in
        the 3D view, this list and the solo panel. Switch groups with <kbd>←</kbd> <kbd>→</kbd>
        (or <kbd>,</kbd> <kbd>.</kbd>).
      </p>
      <p>
        A <b>regular expression</b> is matched against each file's name. The text its
        <b>capture group</b> <code>( … )</code> matches is the group: files that capture the same
        text belong together. Without a capture group the whole match is used; files that don't
        match go to “{NO_MATCH}”.
      </p>
      <p>
        A file's name is its path inside an opened folder (e.g.
        <code>kitchen{presets[0].source.includes('\\\\') ? '\\' : '/'}methodA.ply</code>), or just its
        file name.
      </p>
      <table>
        <tbody>
          <tr><td><code>{presets[0].source}</code></td><td>by top-level folder</td></tr>
          <tr><td><code>^([^_]+)_</code></td><td>text before the first “_”</td></tr>
          <tr><td><code>_(\d+)\.ply$</code></td><td>by a trailing number</td></tr>
          <tr><td><code>(gt|ours|baseline)</code></td><td>by one of several words</td></tr>
        </tbody>
      </table>
      <p>
        When you switch groups, a solo moves to the file whose name is the same apart from the
        captured text — e.g. from <code>kitchen/methodA</code> to <code>office/methodA</code>.
      </p>
      <p class="muted">Each file's own visibility checkbox is kept and comes back when grouping is turned off.</p>
    </div>
  {/if}

  {#if fileGroupsState.enabled}
    <div class="group-regex-row">
      <input
        class="group-regex"
        class:invalid={!draftCheck.ok}
        spellcheck="false"
        autocomplete="off"
        aria-label="Grouping regular expression"
        title="Regular expression; its first capture group is the group. Enter to apply, Esc to cancel."
        bind:value={draft}
        onkeydown={onRegexKeydown}
        onblur={() => draft !== fileGroupsState.regex && apply()}
      />
      <button
        bind:this={menuButton}
        class="group-recent"
        class:open={menuOpen}
        title="Recent patterns and presets"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onclick={() => (menuOpen ? closeMenu() : openMenu())}
        onkeydown={(e) => {
          if (e.key === 'ArrowDown' && !menuOpen) {
            e.preventDefault();
            openMenu();
          }
        }}>Recent ▾</button
      >
      {#if menuOpen}
        <div
          bind:this={menuEl}
          class="group-menu"
          role="menu"
          tabindex="-1"
          aria-label="Recent patterns and presets"
          style:top="{menuPos.top}px"
          style:right="{menuPos.right}px"
          style:max-height="{menuPos.maxHeight}px"
          style:max-width="{menuPos.maxWidth}px"
          onkeydown={onMenuKeydown}
        >
          {#each menuItems as section (section.heading)}
            <div class="group-menu-heading">{section.heading}</div>
            {#each section.items as item (section.heading + item.source)}
              {@const index = flatItems.indexOf(item)}
              <button
                class="group-menu-item"
                class:highlighted={index === highlighted}
                class:current={item.source === fileGroupsState.regex}
                role="menuitem"
                tabindex="-1"
                title={item.label ? `${item.label}\n${item.source}` : item.source}
                onpointerenter={() => (highlighted = index)}
                onclick={() => pick(item.source)}
              >
                {#if item.label}<span class="group-menu-label">{item.label}</span>{/if}
                <code class="group-menu-source">{item.source}</code>
              </button>
            {/each}
          {/each}
        </div>
      {/if}
    </div>
    {#if !draftCheck.ok}
      <div class="group-status error">{draftCheck.error}</div>
    {:else if groups.length}
      <div class="group-status">
        {groups.length} group{groups.length === 1 ? '' : 's'}{noMatchCount
          ? ` · ${noMatchCount} file${noMatchCount === 1 ? '' : 's'} not matched`
          : ''}
      </div>
    {/if}

    {#if active}
      <div class="group-switcher" title="← → or , . switch groups">
        <span class="group-label">Group</span>
        <button class="flt-btn" title="Previous group (← , PageUp)" onclick={() => host.solo.stepGroup(-1)}
          >‹</button
        >
        <select
          class="group-select"
          value={active.key}
          title={active.key}
          onchange={(e) => host.solo.setActiveGroup((e.currentTarget as HTMLSelectElement).value)}
        >
          {#each groups as group (group.key)}
            <option value={group.key}>{group.key} ({group.members.length})</option>
          {/each}
        </select>
        <button class="flt-btn" title="Next group (→ . PageDown)" onclick={() => host.solo.stepGroup(1)}
          >›</button
        >
        <span class="group-pos">{activeIndex + 1}/{groups.length}</span>
      </div>
    {/if}
  {/if}
{/if}

<style>
  .file-list-toolbar {
    display: flex;
    align-items: center;
    gap: 3px;
    flex-wrap: wrap;
    margin-bottom: 6px;
    position: relative;
  }
  .flt-spacer {
    flex: 1;
  }
  .flt-btn {
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
  .flt-btn:hover {
    background: var(--vscode-list-hoverBackground);
  }
  .flt-btn.on {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border-color: var(--vscode-button-background);
  }
  .group-help-btn {
    border-radius: 50%;
    width: 18px;
    height: 18px;
    padding: 0;
    font-weight: 700;
  }
  .group-help {
    margin-bottom: 8px;
    padding: 8px 10px;
    border: 1px solid var(--vscode-focusBorder, #0078d4);
    border-radius: 5px;
    background: var(--vscode-editorWidget-background, var(--vscode-sideBar-background));
    font-size: 11px;
    line-height: 1.45;
    user-select: text;
  }
  .group-help p {
    margin: 0 0 6px;
  }
  .group-help table {
    border-collapse: collapse;
    margin: 0 0 6px;
  }
  .group-help td {
    padding: 1px 8px 1px 0;
    vertical-align: top;
  }
  .group-help code,
  .group-help kbd {
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: 10.5px;
    background: rgba(127, 127, 127, 0.18);
    border-radius: 3px;
    padding: 0 3px;
    white-space: nowrap;
  }
  .group-help .muted {
    opacity: 0.7;
    margin: 0;
  }
  .group-regex-row {
    display: flex;
    gap: 4px;
    margin-bottom: 3px;
  }
  .group-regex {
    flex: 1;
    min-width: 0;
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: 11.5px;
    color: var(--vscode-input-foreground);
    background: var(--vscode-input-background);
    border: 1px solid var(--vscode-input-border, #555);
    border-radius: 3px;
    padding: 2px 5px;
  }
  .group-regex.invalid {
    border-color: var(--vscode-inputValidation-errorBorder, #be1100);
  }
  .group-recent {
    flex-shrink: 0;
    font: inherit;
    font-size: 11px;
    white-space: nowrap;
    cursor: pointer;
    padding: 1px 6px;
    color: var(--vscode-dropdown-foreground, var(--vscode-foreground));
    background: var(--vscode-dropdown-background, var(--vscode-input-background));
    border: 1px solid var(--vscode-dropdown-border, var(--vscode-input-border));
    border-radius: 3px;
  }
  .group-recent.open {
    border-color: var(--vscode-focusBorder, #0078d4);
  }
  .group-menu {
    position: fixed;
    z-index: 1000;
    min-width: 220px;
    overflow-y: auto;
    padding: 4px 0;
    border: 1px solid var(--vscode-menu-border, var(--vscode-focusBorder, #454545));
    border-radius: 5px;
    background: var(--vscode-menu-background, var(--vscode-editorWidget-background, #252526));
    color: var(--vscode-menu-foreground, var(--vscode-foreground));
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
    font-size: 11.5px;
    outline: none;
  }
  .group-menu-heading {
    padding: 4px 10px 2px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    opacity: 0.6;
  }
  .group-menu-item {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 1px;
    width: 100%;
    padding: 3px 10px;
    border: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  .group-menu-item.highlighted {
    background: var(--vscode-menu-selectionBackground, var(--vscode-list-activeSelectionBackground, #04395e));
    color: var(--vscode-menu-selectionForeground, inherit);
  }
  .group-menu-item.current .group-menu-source::after {
    content: '  ✓';
  }
  .group-menu-label {
    font-size: 11px;
    opacity: 0.85;
  }
  .group-menu-label,
  .group-menu-source {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .group-menu-source {
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: 11px;
  }
  .group-status {
    font-size: 10.5px;
    opacity: 0.7;
    margin: 0 0 6px 2px;
  }
  .group-status.error {
    color: var(--vscode-errorForeground, #f48771);
    opacity: 1;
  }
  .group-pos {
    font-size: 11px;
    min-width: 12px;
    text-align: center;
    font-variant-numeric: tabular-nums;
    opacity: 0.75;
  }
  .group-switcher {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 5px 6px;
    margin-bottom: 6px;
    border: 1px solid var(--vscode-sideBar-border);
    border-left: 3px solid var(--vscode-focusBorder, #0078d4);
    border-radius: 4px;
    background: var(--vscode-list-hoverBackground);
    font-size: 11px;
  }
  .group-label {
    font-weight: 600;
  }
  .group-select {
    flex: 1;
    min-width: 0;
    font: inherit;
    font-size: 12px;
    font-weight: 600;
    color: var(--vscode-dropdown-foreground, var(--vscode-foreground));
    background: var(--vscode-dropdown-background, var(--vscode-input-background));
    border: 1px solid var(--vscode-dropdown-border, var(--vscode-input-border));
    border-radius: 3px;
    padding: 1px 2px;
  }
</style>
