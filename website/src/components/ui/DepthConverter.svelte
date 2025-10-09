<!--
  DepthConverter.svelte - Phase 5 Advanced Component
  Interface for depth-to-point cloud conversion with camera parameter input
-->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  // Depth conversion state using Svelte 5 $state
  let isDepthFile = $state(false);
  let currentDepthFile = $state('');
  let showPanel = $state(false);

  // Camera parameters
  let fx = $state(0);
  let fy = $state(0);
  let cx = $state(0);
  let cy = $state(0);
  let baseline = $state(0);
  let depthScale = $state(1.0);
  let convention = $state('opengl'); // 'opengl' or 'opencv'

  // Get SpatialVisualizer instance
  let spatialVisualizer: any = null;
  let statusUpdateInterval: number | null = null;

  onMount(() => {
    // Get the global SpatialVisualizer instance
    if (typeof window !== 'undefined') {
      spatialVisualizer = (window as any).spatialVisualizer;
    }

    // Check for depth files periodically
    statusUpdateInterval = window.setInterval(() => {
      if (spatialVisualizer) {
        // Check if there are any depth-derived files
        const fileDepthData = (spatialVisualizer as any).fileDepthData;
        if (fileDepthData && fileDepthData.size > 0) {
          isDepthFile = true;
          // Get the first depth file info
          const firstDepth = fileDepthData.values().next().value;
          if (firstDepth) {
            currentDepthFile = firstDepth.fileName || 'Depth Image';
          }
        } else {
          isDepthFile = false;
        }
      }
    }, 500);
  });

  onDestroy(() => {
    if (statusUpdateInterval !== null) {
      clearInterval(statusUpdateInterval);
    }
  });

  function togglePanel() {
    showPanel = !showPanel;
  }

  function convertDepth() {
    if (spatialVisualizer && spatialVisualizer.depthToPointCloud) {
      // Call the original depth conversion method with parameters
      const params = {
        fx: fx || undefined,
        fy: fy || undefined,
        cx: cx || undefined,
        cy: cy || undefined,
        baseline: baseline || undefined,
        depthScale: depthScale,
        convention: convention
      };

      console.log('Converting depth with params:', params);

      // The actual conversion is handled by the original SpatialVisualizer
      // which has all the complex logic for different depth formats
      spatialVisualizer.depthToPointCloud(params);
    }
  }

  function loadDefaults() {
    if (spatialVisualizer && spatialVisualizer.getDepthFx) {
      fx = spatialVisualizer.getDepthFx() || 0;
      fy = spatialVisualizer.getDepthFy() || 0;
      cx = spatialVisualizer.getDepthCx() || 0;
      cy = spatialVisualizer.getDepthCy() || 0;
      baseline = spatialVisualizer.getDepthBaseline() || 0;
      convention = spatialVisualizer.getDepthConvention() || 'opengl';
    }
  }
</script>

{#if isDepthFile}
  <div class="depth-converter">
    <button class="toggle-btn" onclick={togglePanel} title="Depth Conversion Settings">
      🎞️ {showPanel ? '▼' : '▶'} Depth
    </button>

    {#if showPanel}
      <div class="depth-panel">
        <div class="panel-header">
          <span class="panel-title">Depth to Point Cloud</span>
          <button class="load-defaults-btn" onclick={loadDefaults} title="Load Default Parameters">
            📋 Defaults
          </button>
        </div>

        <div class="param-section">
          <div class="param-group">
            <label>Focal Length X (fx):</label>
            <input type="number" bind:value={fx} step="0.1" />
          </div>

          <div class="param-group">
            <label>Focal Length Y (fy):</label>
            <input type="number" bind:value={fy} step="0.1" />
          </div>

          <div class="param-group">
            <label>Principal Point X (cx):</label>
            <input type="number" bind:value={cx} step="0.1" />
          </div>

          <div class="param-group">
            <label>Principal Point Y (cy):</label>
            <input type="number" bind:value={cy} step="0.1" />
          </div>

          <div class="param-group">
            <label>Baseline (stereo):</label>
            <input type="number" bind:value={baseline} step="0.001" />
          </div>

          <div class="param-group">
            <label>Depth Scale:</label>
            <input type="number" bind:value={depthScale} step="0.001" />
          </div>

          <div class="param-group">
            <label>Convention:</label>
            <select bind:value={convention}>
              <option value="opengl">OpenGL (+Y up)</option>
              <option value="opencv">OpenCV (+Y down)</option>
            </select>
          </div>
        </div>

        <button class="convert-btn" onclick={convertDepth}>
          🔄 Convert to Point Cloud
        </button>
      </div>
    {/if}
  </div>
{/if}

<style>
  .depth-converter {
    position: absolute;
    top: 120px;
    right: 10px;
    z-index: 1000;
    font-family: var(--vscode-font-family, 'Segoe UI', sans-serif);
  }

  .toggle-btn {
    background: rgba(0, 100, 255, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 6px;
    color: #ffffff;
    cursor: pointer;
    padding: 8px 12px;
    font-size: 13px;
    font-weight: 600;
    transition: all 0.2s ease;
    white-space: nowrap;
  }

  .toggle-btn:hover {
    background: rgba(0, 120, 255, 0.9);
    border-color: rgba(255, 255, 255, 0.5);
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0, 100, 255, 0.4);
  }

  .depth-panel {
    margin-top: 8px;
    background: rgba(0, 0, 0, 0.9);
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 8px;
    padding: 12px;
    min-width: 300px;
    max-width: 350px;
    backdrop-filter: blur(10px);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  }

  .panel-title {
    font-weight: 600;
    color: #0096ff;
    font-size: 14px;
  }

  .load-defaults-btn {
    background: rgba(100, 100, 100, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 4px;
    color: #ffffff;
    cursor: pointer;
    padding: 4px 8px;
    font-size: 11px;
    transition: all 0.2s ease;
  }

  .load-defaults-btn:hover {
    background: rgba(150, 150, 150, 0.4);
    border-color: rgba(255, 255, 255, 0.4);
  }

  .param-section {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-bottom: 12px;
  }

  .param-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .param-group label {
    color: rgba(255, 255, 255, 0.8);
    font-size: 12px;
    font-weight: 500;
  }

  .param-group input,
  .param-group select {
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 4px;
    color: #ffffff;
    padding: 6px 8px;
    font-size: 13px;
    font-family: 'Courier New', monospace;
  }

  .param-group input:focus,
  .param-group select:focus {
    outline: none;
    border-color: #0096ff;
    background: rgba(255, 255, 255, 0.15);
  }

  .convert-btn {
    width: 100%;
    background: linear-gradient(135deg, rgba(0, 150, 255, 0.8), rgba(0, 200, 100, 0.8));
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 6px;
    color: #ffffff;
    cursor: pointer;
    padding: 10px;
    font-size: 14px;
    font-weight: 600;
    transition: all 0.2s ease;
  }

  .convert-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 150, 255, 0.5);
    border-color: rgba(255, 255, 255, 0.5);
  }

  .convert-btn:active {
    transform: translateY(0);
    box-shadow: 0 2px 6px rgba(0, 150, 255, 0.3);
  }
</style>