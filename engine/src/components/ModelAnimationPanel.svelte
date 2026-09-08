<script lang="ts">
  import type { SceneModelData } from '../interfaces';
  let { model, host }: { model: SceneModelData; host: { requestRender(): void } } = $props();
  const state = $derived(model.ui);
  function seek(time: number) { model.seek(time); host.requestRender(); }
</script>
<div class="model-animation-panel">
  <div class="model-material-note">Original model materials</div>
  {#if model.clips.length}
    <label>Animation
      <select aria-label="Animation clip" value={state.clip} onchange={event => { model.selectClip(Number(event.currentTarget.value)); host.requestRender(); }}>
        {#each model.clips as clip, index}<option value={index}>{clip.name || `Clip ${index + 1}`}</option>{/each}
      </select>
    </label>
    <div class="playback-buttons">
      <button onclick={() => { if (state.time >= state.duration) { seek(0); } state.playing = !state.playing; host.requestRender(); }}>{state.playing ? 'Pause animation' : 'Play animation'}</button>
      <label><input type="checkbox" bind:checked={state.loop} /> Loop</label>
    </div>
    <label>Time {state.time.toFixed(2)} / {state.duration.toFixed(2)} s
      <input aria-label="Animation time" type="range" min="0" max={state.duration} step="0.01" value={state.time} oninput={event => seek(Number(event.currentTarget.value))} ondblclick={() => seek(0)} title="Double-click to return to the start" />
    </label>
    <label>Speed
      <select aria-label="Animation speed" bind:value={state.speed}>
        {#each [0.25, 0.5, 1, 2, 4] as speed}<option value={speed}>{speed}×</option>{/each}
      </select>
    </label>
  {/if}
  {#if model.warnings.length}<details><summary>Model resource warnings ({model.warnings.length})</summary>{#each model.warnings as warning}<p>{warning}</p>{/each}</details>{/if}
</div>
<style>
  .model-animation-panel { display: grid; gap: 8px; margin-top: 8px; }
  label { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
  select { min-width: 0; max-width: 100%; }
  button, select { background: var(--vscode-input-background, #333); color: var(--vscode-input-foreground, #ddd); border: 1px solid var(--vscode-panel-border, #555); border-radius: 2px; padding: 3px 6px; font: inherit; }
  button { cursor: pointer; }
  input[type='range'] { width: 100%; }
  .playback-buttons { display: flex; gap: 8px; }
  .model-material-note { opacity: .7; font-size: 11px; }
  p { overflow-wrap: anywhere; }
</style>
