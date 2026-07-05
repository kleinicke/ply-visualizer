<script lang="ts">
  import { filesState } from '../state/files.svelte';
  import { formatFileSize } from '../utils/format';

  let { host }: { host: any } = $props();
</script>

<div id="file-stats">
  {#if filesState.statsLoadingFileName === null && filesState.statsTick === 0}
    <!-- updateFileStats()/updateFileStatsImmediate() haven't been called yet
    (no file loaded since page load) - stay empty, matching pre-Phase-4
    behavior where #file-stats's innerHTML was never touched until then. -->
  {:else if filesState.statsLoadingFileName !== null}
    <div class="stat">
      <span class="label">File:</span>
      <span class="value">{filesState.statsLoadingFileName}</span>
    </div>
    <div class="stat">
      <span class="label">Status:</span>
      <span class="value">Loading...</span>
    </div>
  {:else}
    {#key filesState.statsTick}
      {#if host.spatialFiles.length === 0 && host.poseGroups.length === 0 && host.cameraGroups.length === 0}
        <div>No objects loaded</div>
      {:else if host.spatialFiles.length + host.poseGroups.length + host.cameraGroups.length === 1 && host.spatialFiles.length === 1}
        {@const data = host.spatialFiles[0]}
        {@const renderingMode = data.faceCount === 0 ? 'Points' : 'Mesh'}
        <div><strong>File Size:</strong> {formatFileSize(data.fileSizeInBytes)}</div>
        <div><strong>Vertices:</strong> {data.vertexCount.toLocaleString()}</div>
        <div><strong>Faces:</strong> {data.faceCount.toLocaleString()}</div>
        <div><strong>Format:</strong> {data.format}</div>
        <div><strong>Colors:</strong> {data.hasColors ? 'Yes' : 'No'}</div>
        <div><strong>Intensity:</strong> {host.hasIntensityData(data) ? 'Yes' : 'No'}</div>
        <div><strong>Normals:</strong> {data.hasNormals ? 'Yes' : 'No'}</div>
        <div><strong>Rendering Mode:</strong> {renderingMode}</div>
        {#if Array.isArray(data.comments) && data.comments.length > 0}
          <div>
            <strong>Comments:</strong><br />
            {#each data.comments as comment, i (i)}
              {comment}<br />
            {/each}
          </div>
        {/if}
      {:else}
        {@const totalVertices = host.spatialFiles.reduce((sum: number, data: any) => sum + data.vertexCount, 0)}
        {@const totalFaces = host.spatialFiles.reduce((sum: number, data: any) => sum + data.faceCount, 0)}
        {@const totalSize = host.spatialFiles.reduce((sum: number, data: any) => sum + (data.fileSizeInBytes || 0), 0)}
        {@const totalObjects = host.spatialFiles.length + host.poseGroups.length + host.cameraGroups.length}
        <div>
          <strong>Total Objects:</strong>
          {totalObjects} (Pointclouds: {host.spatialFiles.length}, Poses: {host.poseGroups.length}, Cameras:
          {host.cameraGroups.length})
        </div>
        <div><strong>Total Size:</strong> {formatFileSize(totalSize)}</div>
        <div><strong>Total Vertices:</strong> {totalVertices.toLocaleString()}</div>
        <div><strong>Total Faces:</strong> {totalFaces.toLocaleString()}</div>
      {/if}
    {/key}
  {/if}
</div>
