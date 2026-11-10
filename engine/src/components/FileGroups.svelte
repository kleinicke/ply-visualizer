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

  function onPick(event: Event) {
    const select = event.currentTarget as HTMLSelectElement;
    if (select.value) {
      draft = select.value;
      apply(select.value);
    }
    select.value = '';
  }

  function setAllCollapsed(collapsed: boolean) {
    for (const entry of host.fileEntries.all) {
      entry.state.collapsed = collapsed;
    }
  }

  function onWindowPointerDown(event: PointerEvent) {
    if (helpOpen && !(event.target as HTMLElement).closest('.group-help, .group-help-btn')) {
      helpOpen = false;
    }
  }
  function onWindowKeydown(event: KeyboardEvent) {
    if (helpOpen && event.key === 'Escape') helpOpen = false;
  }
</script>

<svelte:window onpointerdown={onWindowPointerDown} onkeydown={onWindowKeydown} />

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
      <select class="group-recent" title="Recent patterns and presets" onchange={onPick} value="">
        <option value="" disabled>Recent…</option>
        {#if fileGroupsState.recent.length}
          <optgroup label="Recent">
            {#each fileGroupsState.recent as source (source)}
              <option value={source}>{source}</option>
            {/each}
          </optgroup>
        {/if}
        <optgroup label="Presets">
          {#each presets as preset (preset.source)}
            <option value={preset.source}>{preset.label}: {preset.source}</option>
          {/each}
        </optgroup>
      </select>
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
    width: 74px;
    font: inherit;
    font-size: 11px;
    color: var(--vscode-dropdown-foreground, var(--vscode-foreground));
    background: var(--vscode-dropdown-background, var(--vscode-input-background));
    border: 1px solid var(--vscode-dropdown-border, var(--vscode-input-border));
    border-radius: 3px;
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
