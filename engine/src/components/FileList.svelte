<script lang="ts">
  import type { FileListHost } from './fileListTypes';
  import { filesState } from '../state/files.svelte';
  import { addTooltipsToTruncatedFilenames } from '../ui/dialogs';
  import AllPointColors from './AllPointColors.svelte';
  import AllPointSizes from './AllPointSizes.svelte';
  import FileItem from './FileItem.svelte';

  let { host }: { host: FileListHost } = $props();

  const entryRows = $derived(
    filesState.entries.map((entry, index) => ({ index, id: entry.id, kind: entry.kind })),
  );
  const totalEntries = $derived(entryRows.length);

  const isSequenceFrame = $derived(
    (filesState.entries, host.sequenceMode && host.sequenceFiles.length > 0),
  );
  const sequenceFrameInfo = $derived(
    (() => {
      if (!isSequenceFrame) {
        return null;
      }
      const fullPath = host.sequenceFiles[host.sequenceIndex] || '';
      const pathParts = fullPath.split(/[\\/]/);
      const name = pathParts.pop() || `Frame ${host.sequenceIndex + 1}`;
      const shortPath = pathParts.slice(-2).concat(name).join('/');
      return { name, shortPath };
    })(),
  );

  const pendingLoadLabel = $derived((filesState.entries, host.pendingLoadLabel));
  const pendingLoadDetail = $derived((filesState.entries, host.pendingLoadDetail));

  $effect(() => {
    filesState.entries;
    totalEntries;
    addTooltipsToTruncatedFilenames();
  });
</script>

{#if isSequenceFrame && sequenceFrameInfo}
  <div class="file-item">
    <div class="file-item-main">
      <input type="checkbox" id="file-0" checked disabled />
      <span class="color-indicator" style="background-color: #888"></span>
      <label for="file-0" class="file-name" data-short-path={sequenceFrameInfo.shortPath}
        >{sequenceFrameInfo.name}</label
      >
    </div>
    <div class="file-info">Frame {host.sequenceIndex + 1} of {host.sequenceFiles.length}</div>
  </div>
{:else if totalEntries === 0 && !pendingLoadLabel}
  <div class="no-files">No objects loaded</div>
{:else}
  {#each entryRows as row (row.id)}
    <FileItem
      {host}
      index={row.index}
      kind={row.kind === 'spatial' ? 'pointcloud' : row.kind}
    />
  {/each}
  {#if pendingLoadLabel !== null}
    <div class="file-item file-item-loading">
      <div class="file-item-main">
        <span class="spinner spinner-inline"></span>
        <span class="file-name">Loading {pendingLoadLabel}…</span>
      </div>
      <div class="file-info" id="pending-load-detail">{pendingLoadDetail}</div>
    </div>
  {/if}
  <AllPointSizes {host} />
  <AllPointColors {host} />
{/if}
