<script lang="ts">
  import { filmState } from '../state/film.svelte';

  let { host }: { host: any } = $props();

  let fileInput: HTMLInputElement;
  let recordingSettingsOpen = $state(false);

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
    manager()?.toggleLoop();
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
  function updateRecordingResolution(e: Event) {
    manager()?.updateRecordingSettings({ resolution: (e.target as HTMLSelectElement).value });
  }
  function updateRecordingFps(e: Event) {
    manager()?.updateRecordingSettings({ fps: Number((e.target as HTMLSelectElement).value) });
  }
  function updateRecordingQuality(e: Event) {
    manager()?.updateRecordingSettings({ bitrate: Number((e.target as HTMLSelectElement).value) });
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
          title="Seconds traveling to the next keyframe (for the last keyframe: back to the first when Loop is on)"
          style="width: 38px; font-size: 10px;"
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
      Columns: travel seconds to next keyframe, dwell seconds (0 = fly through without stopping).
      Total: {filmState.totalDuration.toFixed(1)}s
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
    <div style="display: flex; gap: 4px; width: 100%;">
      <button
        id="film-record"
        class="control-button"
        class:active={filmState.recording}
        style="flex: 1; margin: 0;"
        disabled={filmState.keyframes.length < 2}
        title="Records one full pass from the beginning (also while a preview is playing)"
        onclick={onRecord}
      >
        {filmState.recording ? '■ Stop Recording' : '● Record Video'}
      </button>
      <button
        id="film-record-settings"
        class="control-button"
        class:active={recordingSettingsOpen}
        style="flex: 0 0 auto; margin: 0; padding: 2px 8px;"
        disabled={filmState.recording}
        title="Recording settings"
        aria-label="Recording settings"
        onclick={() => (recordingSettingsOpen = !recordingSettingsOpen)}>Settings</button
      >
    </div>
  </div>

  {#if recordingSettingsOpen}
    <div
      id="film-record-settings-panel"
      style="display: grid; grid-template-columns: auto 1fr; gap: 5px 8px; align-items: center; margin-top: 5px; padding: 6px; border: 1px solid var(--vscode-panel-border); border-radius: 3px; font-size: 10px;"
    >
      <label for="film-record-resolution">Resolution</label>
      <select
        id="film-record-resolution"
        value={filmState.recordingResolution}
        onchange={updateRecordingResolution}
      >
        <option value="viewport">Current viewport</option>
        <option value="720p">HD (1280 × 720)</option>
        <option value="1080p">Full HD (1920 × 1080)</option>
        <option value="4k">4K UHD (3840 × 2160)</option>
      </select>
      <label for="film-record-fps">Frame rate</label>
      <select
        id="film-record-fps"
        value={String(filmState.recordingFps)}
        onchange={updateRecordingFps}
      >
        <option value="30">30 fps</option>
        <option value="60">60 fps</option>
      </select>
      <label for="film-record-quality">Quality</label>
      <select
        id="film-record-quality"
        value={String(filmState.recordingBitrate)}
        onchange={updateRecordingQuality}
      >
        <option value="6000000">Compact (6 Mbps)</option>
        <option value="12000000">High (12 Mbps)</option>
        <option value="20000000">Very high (20 Mbps)</option>
      </select>
      <div style="grid-column: 1 / -1; color: var(--vscode-descriptionForeground);">
        Fixed 16:9 sizes preserve the view with neutral bars when needed.
      </div>
    </div>
  {/if}

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
