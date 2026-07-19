<script lang="ts">
  import { uiState } from '../state/ui.svelte';

  let {
    onPlayPause,
    onPrev,
    onNext,
    onSeek,
  }: {
    onPlayPause: () => void;
    onPrev: () => void;
    onNext: () => void;
    onSeek: (index: number) => void;
  } = $props();

  function handleSliderInput(e: Event) {
    const value = parseInt((e.target as HTMLInputElement).value, 10) || 0;
    onSeek(value);
  }

  function resetSlider(e: MouseEvent) {
    e.preventDefault();
    onSeek(0);
  }
</script>

<div id="sequence-controls" class="sequence-controls" class:hidden={!uiState.sequenceMode}>
  <button id="seq-play-pause" class="control-button" onclick={onPlayPause}>
    {uiState.isSequencePlaying ? '⏸' : '▶'}
  </button>
  <button id="seq-prev" class="control-button" onclick={onPrev}>◀</button>
  <button id="seq-next" class="control-button" onclick={onNext}>▶</button>
  <input
    id="seq-slider"
    type="range"
    min="0"
    max={Math.max(0, uiState.sequenceTotal - 1)}
    value={uiState.sequenceIndex}
    class="seq-slider"
    oninput={handleSliderInput}
    ondblclick={resetSlider}
    title="Double-click to reset to the first frame"
  />
  <span id="seq-label" class="seq-label"
    >{uiState.sequenceTotal ? uiState.sequenceIndex + 1 : 0} / {uiState.sequenceTotal}</span
  >
</div>
