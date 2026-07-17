<script lang="ts">
  import { measurementState } from '../state/measurement.svelte';
  import { formatDistance } from '../MeasurementManager';

  let { host }: { host: any } = $props();

  function undo() {
    host.measurementManager?.undoLastPathPoint();
    host.requestRender();
  }

  function clearAll() {
    host.measurementManager?.clearAllPaths();
    host.requestRender();
    host.showStatus('All measurement paths cleared');
  }

  function toggleLoop() {
    host.measurementManager?.togglePathClosed();
    host.requestRender();
  }

  function toggleNewPath(mode: 'center' | 'free') {
    host.measurementManager?.togglePathStartMode(mode);
    host.requestRender();
  }
</script>

{#if measurementState.pathCount > 0}
  <div
    id="measurement-quick-actions"
    style="display: flex; align-items: center; flex-wrap: wrap; gap: 4px; padding: 6px 8px; border-top: 1px solid var(--vscode-panel-border); background: var(--vscode-sideBar-background); color: var(--vscode-foreground); font-size: 10px;"
  >
    <span style="margin-right: auto; white-space: nowrap;">
      Total: {formatDistance(measurementState.totalLength)}
    </span>
    <button
      id="measurement-quick-loop"
      class="control-button"
      class:active={measurementState.pathClosed}
      style="margin: 0; padding: 2px 6px; font-size: 10px;"
      onclick={toggleLoop}>Loop</button
    >
    <button
      id="measurement-quick-new-center"
      class="control-button"
      class:active={measurementState.pathStartMode === 'center'}
      style="margin: 0; padding: 2px 6px; font-size: 10px;"
      title="Start the next path at the rotation center"
      onclick={() => toggleNewPath('center')}>New Center</button
    >
    <button
      id="measurement-quick-new-free"
      class="control-button"
      class:active={measurementState.pathStartMode === 'free'}
      style="margin: 0; padding: 2px 6px; font-size: 10px;"
      title="Start the next path at the first picked point"
      onclick={() => toggleNewPath('free')}>New Free</button
    >
    <button
      id="measurement-quick-undo"
      class="control-button"
      style="margin: 0; padding: 2px 6px; font-size: 10px;"
      disabled={measurementState.pathPointCount === 0}
      onclick={undo}>Undo</button
    >
    <button
      id="measurement-quick-clear"
      class="control-button"
      style="margin: 0; padding: 2px 6px; font-size: 10px;"
      onclick={clearAll}>Clear All</button
    >
  </div>
{/if}
