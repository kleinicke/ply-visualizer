<script lang="ts">
  import FolderTree from './FolderTree.svelte';
  import type { FolderEntry } from '../host';
  import type { FileRef } from '../documents';
  import { matchesFilter } from '../documents';
  let {
    entries,
    depth = 0,
    query = '',
    selected,
    active,
    onopen,
    ontoggle,
    onselect,
  }: {
    entries: FolderEntry[];
    depth?: number;
    query?: string;
    selected: Set<string>;
    active?: string;
    onopen: (ref: FileRef, pin?: boolean) => void;
    ontoggle: (entry: FolderEntry) => void;
    onselect: (ref: FileRef, checked: boolean) => void;
  } = $props();
</script>

{#each entries as entry (entry.path)}
  {#if entry.directory || matchesFilter(entry.name, query)}
    <div
      class="tree-row"
      class:current={entry.document?.id === active}
      style:padding-left={`${10 + depth * 14}px`}
    >
      {#if entry.directory}
        <button
          class="folder"
          onclick={() => ontoggle(entry)}
          aria-expanded={!!entry.expanded}
          title={entry.path}><span>{entry.expanded ? '▾' : '▸'}</span> {entry.name}</button
        >
      {:else if entry.document}
        <input
          aria-label={`Select ${entry.name}`}
          type="checkbox"
          checked={selected.has(entry.document.id)}
          onchange={e => onselect(entry.document!, e.currentTarget.checked)}
        />
        <button
          title={entry.path}
          onclick={() => onopen(entry.document!)}
          ondblclick={() => onopen(entry.document!, true)}>{entry.name}</button
        >
      {/if}
    </div>
    {#if entry.expanded && entry.children}
      <FolderTree
        entries={entry.children}
        depth={depth + 1}
        {query}
        {selected}
        {active}
        {onopen}
        {ontoggle}
        {onselect}
      />
    {/if}
  {/if}
{/each}

<style>
  .tree-row {
    display: flex;
    align-items: center;
    height: 29px;
    gap: 5px;
    padding-right: 6px;
  }
  .tree-row:hover {
    background: #25282c;
  }
  .current {
    background: #173a52 !important;
  }
  .tree-row button {
    text-align: left;
    border: 0;
    background: none;
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    padding: 4px 0;
    color: inherit;
    font: inherit;
    cursor: pointer;
  }
  .tree-row input {
    width: 12px;
    height: 12px;
    accent-color: #3694d6;
    margin: 0;
  }
  .folder span {
    color: #858e99;
    margin-right: 5px;
  }
</style>
