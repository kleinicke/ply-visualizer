<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  
  let canvasContainer: HTMLElement;
  let status = 'Initializing...';
  let isReady = false;
  let visualizer: any = null;
  
  onMount(async () => {
    console.log('ThreeJS Viewer mounted, initializing full PointCloudVisualizer...');
    
    if (canvasContainer) {
      try {
        // Import the full PointCloudVisualizer system
        const { createSpatialVisualizer } = await import('../../main');
        
        // Initialize the complete visualizer (includes all 15K lines of functionality)
        visualizer = await createSpatialVisualizer(canvasContainer);
        
        if (visualizer) {
          console.log('✅ Full PointCloudVisualizer initialized successfully');
          status = 'Ready - Full Functionality Restored';
          isReady = true;
          
          // Make visualizer globally available for tests and VS Code
          if (typeof window !== 'undefined') {
            (window as any).PointCloudVisualizer = visualizer;
            (window as any).visualizer = visualizer;
          }
          
          // Set up the container as the Three.js target
          // The PointCloudVisualizer will handle all the Three.js setup
          console.log('🎯 PointCloudVisualizer ready for file loading');
        } else {
          throw new Error('Failed to create spatial visualizer');
        }
      } catch (error) {
        console.error('❌ Failed to initialize PointCloudVisualizer:', error);
        status = 'Error: ' + (error as Error).message;
      }
    }
  });
  
  onDestroy(() => {
    // Cleanup visualizer if needed
    if (visualizer && typeof visualizer.dispose === 'function') {
      visualizer.dispose();
    }
    
    // Cleanup global references
    if (typeof window !== 'undefined') {
      delete (window as any).PointCloudVisualizer;
      delete (window as any).visualizer;
    }
  });
</script>

<div bind:this={canvasContainer} class="threejs-container" id="three-canvas">
  <!-- Three.js canvas will be inserted here -->
  <div class="status-overlay">
    <span id="status-text">{status}</span>
  </div>
</div>

<style>
  .threejs-container {
    flex: 1;
    position: relative;
    min-height: 400px;
    width: 100%;
  }
  
  .status-overlay {
    position: absolute;
    top: 10px;
    left: 10px;
    background: rgba(0, 0, 0, 0.7);
    color: white;
    padding: 5px 10px;
    border-radius: 3px;
    font-size: 12px;
    z-index: 100;
  }
</style>