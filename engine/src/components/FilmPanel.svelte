<script lang="ts">
  import { filmState } from '../state/film.svelte';

  let { host }: { host: any } = $props();

  let fileInput: HTMLInputElement;

  function manager() {
    return host.filmManager;
  }

  function onAddKeyframe() {
    manager()?.addKeyframeFromCamera();
  }
  function onGoTo(index: number) {
    manager()?.goToKeyframe(index);
  }
  function onOverwrite(index: number) {
    manager()?.overwriteKeyframe(index);
  }
  function onMove(index: number, delta: number) {
    manager()?.moveKeyframe(index, delta);
  }
  function onRemove(index: number) {
    manager()?.removeKeyframe(index);
  }
  function onDurationInput(index: number, e: Event) {
    const value = parseFloat((e.target as HTMLInputElement).value);
    manager()?.updateKeyframe(index, { duration: value });
  }
  function onDwellInput(index: number, e: Event) {
    const value = parseFloat((e.target as HTMLInputElement).value);
    manager()?.updateKeyframe(index, { dwell: value });
  }

  function onPlayStop() {
    if (filmState.playing) {
      manager()?.stop();
    } else {
      manager()?.play();
    }
  }
  function onToggleLoop() {
    filmState.loop = !filmState.loop;
  }
  function onToggleFrustums() {
    manager()?.setFrustumsVisible(!filmState.frustumsVisible);
  }
  function onRecord() {
    if (filmState.recording) {
      manager()?.stop();
    } else {
      manager()?.startRecording();
    }
  }

  function onSavePath() {
    manager()?.saveProject();
  }
  function onLoadPathClick() {
    fileInput?.click();
  }
  async function onLoadPathFile(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      manager()?.loadProject(await file.text());
    }
    input.value = '';
  }
</script>

<div class="control-buttons">
  <button id="film-add-keyframe" class="control-button" onclick={onAddKeyframe}>
    + Add Keyframe (current view)
  </button>
</div>

{#if filmState.keyframes.length > 0}
  <div id="film-keyframe-list" style="margin-top: 6px;">
    {#each filmState.keyframes as key, i}
      <div
        style="display: flex; align-items: center; gap: 4px; margin-bottom: 3px; font-size: 10px;"
      >
        <button
          class="control-button"
          style="flex: 1; min-width: 0; margin: 0; font-size: 10px; text-align: left; overflow: hidden; text-overflow: ellipsis;"
          title="Jump camera to this keyframe"
          onclick={() => onGoTo(i)}>{key.name}</button
        >
        <input
          type="number"
          min="0.1"
          step="0.5"
          value={key.duration}
          title="Seconds traveling to the next keyframe"
          style="width: 38px; font-size: 10px;"
          disabled={i === filmState.keyframes.length - 1}
          onchange={e => onDurationInput(i, e)}
        />
        <input
          type="number"
          min="0"
          step="0.5"
          value={key.dwell}
          title="Seconds holding still at this keyframe"
          style="width: 34px; font-size: 10px;"
          onchange={e => onDwellInput(i, e)}
        />
        <button
          class="control-button"
          style="width: 20px; margin: 0; padding: 2px;"
          title="Move up"
          disabled={i === 0}
          onclick={() => onMove(i, -1)}>↑</button
        >
        <button
          class="control-button"
          style="width: 20px; margin: 0; padding: 2px;"
          title="Move down"
          disabled={i === filmState.keyframes.length - 1}
          onclick={() => onMove(i, 1)}>↓</button
        >
        <button
          class="control-button"
          style="width: 20px; margin: 0; padding: 2px;"
          title="Re-capture this keyframe from the current view"
          onclick={() => onOverwrite(i)}>⟳</button
        >
        <button
          class="control-button"
          style="width: 20px; margin: 0; padding: 2px;"
          title="Delete keyframe"
          onclick={() => onRemove(i)}>✕</button
        >
      </div>
    {/each}
    <div style="font-size: 10px; color: var(--vscode-descriptionForeground); margin: 2px 0 6px;">
      Columns: travel seconds to next keyframe, dwell seconds. Total: {filmState.totalDuration.toFixed(
        1
      )}s
    </div>
  </div>

  <div class="control-buttons" style="margin-top: 4px;">
    <button
      id="film-play"
      class="control-button"
      class:active={filmState.playing && !filmState.recording}
      disabled={filmState.keyframes.length < 2}
      onclick={onPlayStop}
    >
      {filmState.playing && !filmState.recording ? '■ Stop Preview' : '▶ Play Preview'}
    </button>
    <button
      id="film-loop"
      class="control-button"
      class:active={filmState.loop}
      onclick={onToggleLoop}>Loop</button
    >
    <button
      id="film-frustums"
      class="control-button"
      class:active={filmState.frustumsVisible}
      onclick={onToggleFrustums}>Show Keyframe Cameras</button
    >
    <button
      id="film-record"
      class="control-button"
      class:active={filmState.recording}
      disabled={filmState.keyframes.length < 2 || (filmState.playing && !filmState.recording)}
      onclick={onRecord}
    >
      {filmState.recording ? '■ Stop Recording' : '● Record Video'}
    </button>
  </div>

  <div style="display: flex; gap: 4px; margin-top: 4px;">
    <button
      id="film-save-path"
      class="control-button"
      style="flex: 1; min-width: 0; font-size: 9px;"
      onclick={onSavePath}>Save Path JSON</button
    >
    <button
      id="film-load-path"
      class="control-button"
      style="flex: 1; min-width: 0; font-size: 9px;"
      onclick={onLoadPathClick}>Load Path JSON</button
    >
  </div>
{:else}
  <div style="display: flex; gap: 4px; margin-top: 4px;">
    <button
      id="film-load-path"
      class="control-button"
      style="flex: 1; min-width: 0; font-size: 9px;"
      onclick={onLoadPathClick}>Load Path JSON</button
    >
  </div>
  <p class="setting-description" style="margin-top: 6px;">
    Move the camera, then add keyframes. Playback flies smoothly through them; Record saves the
    flight as a video file.
  </p>
{/if}

<input
  bind:this={fileInput}
  type="file"
  accept=".json"
  style="display: none"
  onchange={onLoadPathFile}
/>
