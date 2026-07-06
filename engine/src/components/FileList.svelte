<script lang="ts">
  import { filesState } from '../state/files.svelte';
  import { addTooltipsToTruncatedFilenames } from '../ui/dialogs';
  import { escapeHtml } from '../ui/dialogs';
  import FileItem from './FileItem.svelte';

  let { host }: { host: any } = $props();

  // Re-reads host.spatialFiles/poseGroups/cameraGroups from scratch whenever
  // renderTick changes, mirroring the old updateFileList()'s
  // "regenerate everything on every call" model without needing every
  // underlying field to be individually reactive (see files.svelte.js).
  const spatialFilesCount = $derived((filesState.renderTick, host.spatialFiles.length));
  const poseGroupsCount = $derived((filesState.renderTick, host.poseGroups.length));
  const cameraGroupsCount = $derived((filesState.renderTick, host.cameraGroups.length));
  const totalEntries = $derived(spatialFilesCount + poseGroupsCount + cameraGroupsCount);

  const isSequenceFrame = $derived(
    (filesState.renderTick, host.sequenceMode && host.sequenceFiles.length > 0)
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
    })()
  );

  const pendingLoadLabel = $derived((filesState.renderTick, host.pendingLoadLabel));
  const pendingLoadDetail = $derived((filesState.renderTick, host.pendingLoadDetail));

  $effect(() => {
    // Dependency on renderTick + totalEntries so this re-runs after every
    // regeneration, same timing as the old post-innerHTML-set call.
    filesState.renderTick;
    totalEntries;
    addTooltipsToTruncatedFilenames();
  });
</script>

{#key filesState.renderTick}
  {#if filesState.renderTick === 0}
    <!-- updateFileList() has never been called yet (no file loaded/removed
    since page load) - stay empty, matching the pre-Phase-3 behavior where
    #file-list's innerHTML was never touched until the first real call. -->
  {:else if isSequenceFrame && sequenceFrameInfo}
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
    {#each Array.from({ length: spatialFilesCount }) as _, i (i)}
      <FileItem {host} index={i} kind="pointcloud" />
    {/each}
    {#each Array.from({ length: poseGroupsCount }) as _, p (spatialFilesCount + p)}
      <FileItem {host} index={spatialFilesCount + p} kind="pose" />
    {/each}
    {#each Array.from({ length: cameraGroupsCount }) as _, c (spatialFilesCount + poseGroupsCount + c)}
      <FileItem {host} index={spatialFilesCount + poseGroupsCount + c} kind="camera" />
    {/each}
    {#if pendingLoadLabel !== null}
      <div class="file-item file-item-loading">
        <div class="file-item-main">
          <span class="spinner spinner-inline"></span>
          <span class="file-name">Loading {escapeHtml(pendingLoadLabel)}…</span>
        </div>
        <div class="file-info" id="pending-load-detail">{escapeHtml(pendingLoadDetail)}</div>
      </div>
    {/if}
  {/if}
{/key}
