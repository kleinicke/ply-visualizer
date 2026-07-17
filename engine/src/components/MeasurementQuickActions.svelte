<script lang="ts">
  import { measurementState } from '../state/measurement.svelte';
  import { formatDistance } from '../MeasurementManager';
  import measureIcon from '../../media/icons/measurement/measure.svg';
  import loopIcon from '../../media/icons/measurement/loop.svg';
  import newFreeIcon from '../../media/icons/measurement/new-free.svg';
  import undoIcon from '../../media/icons/measurement/undo.svg';
  import clearIcon from '../../media/icons/measurement/clear.svg';

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
    style="display: flex; align-items: center; flex-wrap: nowrap; gap: 4px; padding: 6px 8px; border-top: 1px solid var(--vscode-panel-border); background: var(--vscode-sideBar-background); color: var(--vscode-foreground); font-size: 10px; white-space: nowrap;"
    aria-label="Measurement controls"
  >
    <span
      style="display: flex; align-items: center; gap: 4px; min-width: 0; margin-right: auto; overflow: hidden; text-overflow: ellipsis;"
    >
      <img src={measureIcon} alt="" width="16" height="16" />
      {formatDistance(measurementState.totalLength)}
    </span>
    <button
      id="measurement-quick-loop"
      class="control-button quick-tooltip"
      class:active={measurementState.pathClosed}
      data-tooltip="Loop"
      style="flex: 0 0 24px; width: 24px; min-width: 24px; height: 22px; margin: 0; padding: 0; justify-content: center;"
      aria-label="Toggle measurement loop"
      aria-pressed={measurementState.pathClosed}
      onclick={toggleLoop}><img src={loopIcon} alt="" width="17" height="17" /></button
    >
    <button
      id="measurement-quick-new-free"
      class="control-button quick-tooltip"
      class:active={measurementState.pathStartMode === 'free'}
      data-tooltip="New path"
      style="flex: 0 0 29px; width: 29px; min-width: 29px; height: 22px; margin: 0; padding: 0; justify-content: center;"
      aria-label="New free measurement path"
      aria-pressed={measurementState.pathStartMode === 'free'}
      onclick={() => toggleNewPath('free')}
      ><img src={newFreeIcon} alt="" width="18" height="18" /></button
    >
    <button
      id="measurement-quick-undo"
      class="control-button quick-tooltip"
      data-tooltip="Undo"
      style="flex: 0 0 24px; width: 24px; min-width: 24px; height: 22px; margin: 0; padding: 0; justify-content: center;"
      disabled={measurementState.pathPointCount === 0}
      aria-label="Undo last measurement point"
      onclick={undo}><img src={undoIcon} alt="" width="17" height="17" /></button
    >
    <button
      id="measurement-quick-clear"
      class="control-button quick-tooltip"
      data-tooltip="Clear all"
      style="flex: 0 0 24px; width: 24px; min-width: 24px; height: 22px; margin: 0; padding: 0; justify-content: center;"
      aria-label="Clear all measurement paths"
      onclick={clearAll}><img src={clearIcon} alt="" width="17" height="17" /></button
    >
  </div>
{/if}
