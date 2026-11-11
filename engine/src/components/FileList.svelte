<script lang="ts">
  import { fileRows, type FileListHost } from './fileListTypes';
  import { filesState } from '../state/files.svelte';
  import { addTooltipsToTruncatedFilenames } from '../ui/dialogs';
  import AllPointColors from './AllPointColors.svelte';
  import AllPointSizes from './AllPointSizes.svelte';
  import FileItem from './FileItem.svelte';
  import FileGroups from './FileGroups.svelte';
  import FileActions from './FileActions.svelte';
  import { setSelectionOrder } from '../state/fileSelection.svelte';

  let { host }: { host: FileListHost } = $props();

  // Only the active scene's files are listed when grouping by prefix.
  const entryRows = $derived(
    fileRows(host, filesState.entries).filter((row) => host.solo.inScope(row.entry)),
  );
  const totalEntries = $derived(entryRows.length);

  const isSequenceFrame = $derived(
    (filesState.entries, host.sequenceMode && host.sequenceFiles.length > 0),
  );
  const sequenceFrameInfo = $derived(
    (() => {
      filesState.entries;
      if (!isSequenceFrame) {
        return null;
      }
      const fullPath = host.sequenceFiles[host.sequenceIndex] || '';
      const pathParts = fullPath.split(/[\\/]/);
      const name = pathParts.pop() || `Frame ${host.sequenceIndex + 1}`;
      const shortPath = pathParts.slice(-2).concat(name).join('/');
      return { name, shortPath, index: host.sequenceIndex, total: host.sequenceFiles.length };
    })(),
  );

  const pendingLoadLabel = $derived((filesState.entries, host.pendingLoadLabel));
  const pendingLoadDetail = $derived((filesState.entries, host.pendingLoadDetail));

  $effect(() => {
    setSelectionOrder(entryRows.map((row) => row.entry.id));
  });

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
    <div class="file-info">Frame {sequenceFrameInfo.index + 1} of {sequenceFrameInfo.total}</div>
  </div>
{:else if totalEntries === 0 && !pendingLoadLabel}
  <div class="no-files">No objects loaded</div>
{:else}
  <FileGroups {host} />
  <FileActions {host} />
  {#each entryRows as row (row.entry.id)}
    <FileItem
      {host}
      {row}
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
