<!--
  PerformanceMonitor.svelte - Phase 5 Advanced Component
  Displays FPS, frame time, and GPU timing information
-->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  // Performance metrics using Svelte 5 $state
  let fps = $state(0);
  let frameTime = $state(0);
  let gpuTime = $state(0);
  let visible = $state(true);

  // Get SpatialVisualizer instance for performance data
  let spatialVisualizer: any = null;
  let updateInterval: number | null = null;

  onMount(() => {
    // Get the global SpatialVisualizer instance
    if (typeof window !== 'undefined') {
      spatialVisualizer = (window as any).spatialVisualizer;
    }

    // Update performance metrics every 500ms
    updateInterval = window.setInterval(() => {
      if (spatialVisualizer) {
        // Access private properties (they exist in the original implementation)
        fps = (spatialVisualizer as any).currentFps || 0;

        // Calculate average frame time from render times
        const frameTimes = (spatialVisualizer as any).frameRenderTimes || [];
        if (frameTimes.length > 0) {
          const avgFrameTime = frameTimes.reduce((a: number, b: number) => a + b, 0) / frameTimes.length;
          frameTime = Math.round(avgFrameTime * 100) / 100;
        } else {
          frameTime = 0;
        }

        // GPU time if available
        gpuTime = (spatialVisualizer as any).currentGpuTime || 0;
      }
    }, 500);
  });

  onDestroy(() => {
    if (updateInterval !== null) {
      clearInterval(updateInterval);
    }
  });

  function toggleVisibility() {
    visible = !visible;
  }
</script>

{#if visible}
  <div class="performance-monitor">
    <div class="perf-header">
      <span class="perf-title">⚡ Performance</span>
      <button class="minimize-btn" onclick={toggleVisibility} title="Hide">−</button>
    </div>
    <div class="perf-metrics">
      <div class="metric">
        <span class="metric-label">FPS:</span>
        <span class="metric-value">{fps}</span>
      </div>
      <div class="metric">
        <span class="metric-label">Frame:</span>
        <span class="metric-value">{frameTime > 0 ? `${frameTime}ms` : 'N/A'}</span>
      </div>
      {#if gpuTime > 0}
        <div class="metric">
          <span class="metric-label">GPU:</span>
          <span class="metric-value">{gpuTime.toFixed(2)}ms</span>
        </div>
      {/if}
    </div>
  </div>
{:else}
  <button class="show-perf-btn" onclick={toggleVisibility} title="Show Performance">
    ⚡
  </button>
{/if}

<style>
  .performance-monitor {
    position: absolute;
    top: 60px;
    right: 10px;
    background: rgba(0, 0, 0, 0.85);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 6px;
    padding: 8px 12px;
    font-family: var(--vscode-font-family, 'Segoe UI', monospace);
    font-size: 12px;
    color: #ffffff;
    z-index: 1000;
    min-width: 180px;
    backdrop-filter: blur(8px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }

  .perf-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
    padding-bottom: 6px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.15);
  }

  .perf-title {
    font-weight: 600;
    color: #00d4ff;
    font-size: 13px;
  }

  .minimize-btn,
  .show-perf-btn {
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 4px;
    color: #ffffff;
    cursor: pointer;
    padding: 2px 8px;
    font-size: 14px;
    transition: all 0.2s ease;
  }

  .minimize-btn:hover,
  .show-perf-btn:hover {
    background: rgba(255, 255, 255, 0.2);
    border-color: rgba(255, 255, 255, 0.4);
  }

  .show-perf-btn {
    position: absolute;
    top: 60px;
    right: 10px;
    z-index: 1000;
    padding: 6px 10px;
    font-size: 16px;
  }

  .perf-metrics {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .metric {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
  }

  .metric-label {
    color: rgba(255, 255, 255, 0.7);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .metric-value {
    font-weight: 600;
    color: #00ff88;
    font-family: 'Courier New', monospace;
    font-size: 13px;
  }

  /* Animation for FPS changes */
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }

  .metric-value {
    animation: pulse 2s ease-in-out infinite;
  }
</style>