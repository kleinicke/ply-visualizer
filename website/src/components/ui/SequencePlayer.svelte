<!--
  SequencePlayer.svelte - Phase 5 Advanced Component
  Controls for playing sequences of point cloud files
-->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  // Sequence state using Svelte 5 $state
  let isPlaying = $state(false);
  let currentFrame = $state(0);
  let totalFrames = $state(0);
  let fps = $state(10); // Default 10 FPS
  let isSequenceMode = $state(false);

  // Get SpatialVisualizer instance
  let spatialVisualizer: any = null;
  let statusUpdateInterval: number | null = null;

  onMount(() => {
    // Get the global SpatialVisualizer instance
    if (typeof window !== 'undefined') {
      spatialVisualizer = (window as any).spatialVisualizer;
    }

    // Update sequence status periodically
    statusUpdateInterval = window.setInterval(() => {
      if (spatialVisualizer) {
        isSequenceMode = (spatialVisualizer as any).sequenceMode || false;
        currentFrame = (spatialVisualizer as any).sequenceIndex || 0;

        const sequenceFiles = (spatialVisualizer as any).sequenceFiles || [];
        totalFrames = sequenceFiles.length;

        isPlaying = (spatialVisualizer as any).sequencePlaying || false;
      }
    }, 100);
  });

  onDestroy(() => {
    if (statusUpdateInterval !== null) {
      clearInterval(statusUpdateInterval);
    }
  });

  function play() {
    if (spatialVisualizer && spatialVisualizer.playSequence) {
      spatialVisualizer.playSequence();
    }
  }

  function pause() {
    if (spatialVisualizer && spatialVisualizer.pauseSequence) {
      spatialVisualizer.pauseSequence();
    }
  }

  function stop() {
    if (spatialVisualizer && spatialVisualizer.stopSequence) {
      spatialVisualizer.stopSequence();
    }
  }

  function stepForward() {
    if (spatialVisualizer && spatialVisualizer.stepSequence) {
      spatialVisualizer.stepSequence(1);
    }
  }

  function stepBackward() {
    if (spatialVisualizer && spatialVisualizer.stepSequence) {
      spatialVisualizer.stepSequence(-1);
    }
  }

  function seek(event: Event) {
    const target = event.target as HTMLInputElement;
    const frame = parseInt(target.value, 10);
    if (spatialVisualizer && spatialVisualizer.seekSequence) {
      spatialVisualizer.seekSequence(frame);
    }
  }

  function changeFps(event: Event) {
    const target = event.target as HTMLInputElement;
    fps = parseInt(target.value, 10);
    // Update the sequence FPS in SpatialVisualizer if method exists
    if (spatialVisualizer && typeof (spatialVisualizer as any).setSequenceFps === 'function') {
      (spatialVisualizer as any).setSequenceFps(fps);
    }
  }
</script>

{#if isSequenceMode}
  <div class="sequence-player">
    <div class="sequence-header">
      <span class="sequence-title">🎬 Sequence Player</span>
      <span class="frame-counter">{currentFrame + 1} / {totalFrames}</span>
    </div>

    <div class="sequence-controls">
      <button
        class="control-btn"
        onclick={stepBackward}
        disabled={currentFrame === 0}
        title="Previous Frame"
      >
        ⏮
      </button>

      {#if isPlaying}
        <button class="control-btn play-btn" onclick={pause} title="Pause">
          ⏸
        </button>
      {:else}
        <button class="control-btn play-btn" onclick={play} title="Play">
          ▶
        </button>
      {/if}

      <button class="control-btn" onclick={stop} title="Stop">
        ⏹
      </button>

      <button
        class="control-btn"
        onclick={stepForward}
        disabled={currentFrame >= totalFrames - 1}
        title="Next Frame"
      >
        ⏭
      </button>
    </div>

    <div class="sequence-slider">
      <input
        type="range"
        min="0"
        max={totalFrames - 1}
        value={currentFrame}
        oninput={seek}
        class="frame-slider"
      />
    </div>

    <div class="fps-control">
      <label for="fps-input">FPS:</label>
      <input
        id="fps-input"
        type="number"
        min="1"
        max="60"
        value={fps}
        oninput={changeFps}
        class="fps-input"
      />
    </div>
  </div>
{/if}

<style>
  .sequence-player {
    position: absolute;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.9);
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 8px;
    padding: 12px 16px;
    font-family: var(--vscode-font-family, 'Segoe UI', sans-serif);
    font-size: 13px;
    color: #ffffff;
    z-index: 1000;
    min-width: 400px;
    backdrop-filter: blur(10px);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
  }

  .sequence-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  }

  .sequence-title {
    font-weight: 600;
    color: #ff9500;
    font-size: 14px;
  }

  .frame-counter {
    color: rgba(255, 255, 255, 0.8);
    font-family: 'Courier New', monospace;
    font-size: 12px;
  }

  .sequence-controls {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
  }

  .control-btn {
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 6px;
    color: #ffffff;
    cursor: pointer;
    padding: 8px 16px;
    font-size: 16px;
    transition: all 0.2s ease;
    min-width: 44px;
  }

  .control-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.2);
    border-color: rgba(255, 255, 255, 0.5);
    transform: scale(1.05);
  }

  .control-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .play-btn {
    background: rgba(76, 175, 80, 0.3);
    border-color: rgba(76, 175, 80, 0.6);
  }

  .play-btn:hover:not(:disabled) {
    background: rgba(76, 175, 80, 0.5);
    border-color: rgba(76, 175, 80, 0.8);
  }

  .sequence-slider {
    margin-bottom: 12px;
  }

  .frame-slider {
    width: 100%;
    height: 6px;
    border-radius: 3px;
    background: rgba(255, 255, 255, 0.2);
    outline: none;
    -webkit-appearance: none;
  }

  .frame-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #ff9500;
    cursor: pointer;
    border: 2px solid #ffffff;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  }

  .frame-slider::-moz-range-thumb {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #ff9500;
    cursor: pointer;
    border: 2px solid #ffffff;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  }

  .fps-control {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 8px;
  }

  .fps-control label {
    color: rgba(255, 255, 255, 0.7);
    font-size: 12px;
  }

  .fps-input {
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 4px;
    color: #ffffff;
    padding: 4px 8px;
    font-size: 13px;
    width: 60px;
    text-align: center;
    font-family: 'Courier New', monospace;
  }

  .fps-input:focus {
    outline: none;
    border-color: #ff9500;
    background: rgba(255, 255, 255, 0.15);
  }
</style>