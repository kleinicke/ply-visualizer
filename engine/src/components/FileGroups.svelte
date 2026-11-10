<script lang="ts">
  import type { FileListHost } from './fileListTypes';
  import { filesState } from '../state/files.svelte';
  import { fileGroupsState } from '../state/fileGroups.svelte';
  import { soloState } from '../state/solo.svelte';

  let { host }: { host: FileListHost } = $props();

  const hasFiles = $derived((filesState.entries, host.solo.topLevel().length > 0));
  const groups = $derived.by(() => {
    filesState.entries;
    fileGroupsState.enabled;
    fileGroupsState.depth;
    return host.solo.groups();
  });
  const active = $derived.by(() => {
    fileGroupsState.active;
    soloState.scopeIds;
    return host.solo.activeGroup(groups);
  });
  const activeIndex = $derived(active ? groups.indexOf(active) : -1);

  function setAllCollapsed(collapsed: boolean) {
    for (const entry of host.fileEntries.all) {
      entry.state.collapsed = collapsed;
    }
  }
</script>

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
      title="Treat files whose names start the same way as one scene; show one scene at a time"
      onclick={() => host.solo.setGroupingEnabled(!fileGroupsState.enabled)}>Group by prefix</button
    >
    {#if fileGroupsState.enabled}
      <button
        class="flt-btn"
        title="Shorter prefix (fewer name parts)"
        onclick={() => host.solo.setGroupDepth(fileGroupsState.depth - 1)}>−</button
      >
      <span class="flt-depth" title="Prefix length in name parts">{fileGroupsState.depth}</span>
      <button
        class="flt-btn"
        title="Longer prefix (more name parts)"
        onclick={() => host.solo.setGroupDepth(fileGroupsState.depth + 1)}>+</button
      >
    {/if}
  </div>

  {#if fileGroupsState.enabled && active}
    <div class="scene-switcher" title="← → or , . switch scenes">
      <span class="scene-label">Scene</span>
      <button class="flt-btn" title="Previous scene (← , PageUp)" onclick={() => host.solo.stepGroup(-1)}
        >‹</button
      >
      <select
        class="scene-select"
        value={active.prefix}
        title={active.prefix}
        onchange={(e) => host.solo.setActiveGroup((e.currentTarget as HTMLSelectElement).value)}
      >
        {#each groups as group (group.prefix)}
          <option value={group.prefix}>{group.prefix} ({group.members.length})</option>
        {/each}
      </select>
      <button class="flt-btn" title="Next scene (→ . PageDown)" onclick={() => host.solo.stepGroup(1)}
        >›</button
      >
      <span class="scene-pos">{activeIndex + 1}/{groups.length}</span>
    </div>
  {/if}
{/if}

<style>
  .file-list-toolbar {
    display: flex;
    align-items: center;
    gap: 3px;
    flex-wrap: wrap;
    margin-bottom: 6px;
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
  .flt-depth,
  .scene-pos {
    font-size: 11px;
    min-width: 12px;
    text-align: center;
    font-variant-numeric: tabular-nums;
    opacity: 0.75;
  }
  .scene-switcher {
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
  .scene-label {
    font-weight: 600;
  }
  .scene-select {
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
