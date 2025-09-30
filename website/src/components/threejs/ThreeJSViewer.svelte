<!-- 
  ThreeJSViewer - Phase 4: Core Three.js visualization component
  
  This component manages the 3D visualization using ThreeManager and 
  integrates with the Svelte reactive store system.
-->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { ThreeManager } from '../../lib/three-manager';
  import { visualizerStore, visualizerActions } from '../../stores';
  
  // Svelte 5 props syntax
  interface Props {
    class?: string;
    className?: string;
    style?: string;
  }
  
  let { 
    class: cls = '', 
    className = '', 
    style = '' 
  }: Props = $props();
  
  // Component state - use Svelte 5 $state for better reactivity
  let canvasContainer: HTMLElement;
  let threeManager: ThreeManager;
  let isInitialized = $state(false);
  let status = $state('Initializing Three.js...');
  
  // Simplified store handling - avoid $effect for now
  let unsubscribeVisualizer: (() => void) | undefined;
  
  onDestroy(() => {
    unsubscribeVisualizer?.();
  });
  
  function updateThreeManagerFromStore() {
    if (!threeManager) return;
    
    // This function will be called when the visualizer store updates
    // For now, we just ensure the render is requested
    threeManager.requestRender();
  }
  
  onMount(async () => {
    // Subscribe to visualizer store the traditional way
    unsubscribeVisualizer = visualizerStore.subscribe(value => {
      if (value.isInitialized && threeManager) {
        // React to store changes and update ThreeManager accordingly
        updateThreeManagerFromStore();
      }
    });
    console.log('ThreeJSViewer mounting with ThreeManager...');
    
    if (!canvasContainer) {
      console.error('Canvas container not found');
      status = 'Error: Container not found';
      return;
    }
    
    try {
      // Phase 4: Initialize ThreeManager
      threeManager = new ThreeManager();
      threeManager.initialize(canvasContainer);
      
      // Update the store with the initialized ThreeManager
      visualizerActions.initialize(threeManager);
      
      // Set up camera change callback to update stores
      threeManager.setOnCameraChangeCallback(() => {
        // This will be called when camera changes
        // Update performance metrics from ThreeManager
        const fps = threeManager.getCurrentFps();
        visualizerActions.updatePerformanceMetrics(fps, 0, 0);
      });
      
      isInitialized = true;
      status = 'Ready - ThreeManager initialized';
      console.log('✅ ThreeJSViewer initialized successfully with ThreeManager');
      
      // Make visualizer globally available for compatibility
      if (typeof window !== 'undefined') {
        (window as any).threeManager = threeManager;
        (window as any).visualizer = threeManager; // Legacy compatibility
      }
      
    } catch (error) {
      console.error('❌ Failed to initialize ThreeJSViewer:', error);
      status = 'Error: ' + (error as Error).message;
      isInitialized = false;
    }
  });
  
  onDestroy(() => {
    console.log('ThreeJSViewer destroying...');
    
    if (threeManager) {
      threeManager.dispose();
    }
    
    // Reset the visualizer store
    visualizerActions.dispose();
    
    // Cleanup global references
    if (typeof window !== 'undefined') {
      delete (window as any).threeManager;
      delete (window as any).visualizer;
    }
    
    isInitialized = false;
  });
  
  // Public methods that can be called by parent components
  export function requestRender() {
    if (threeManager) {
      threeManager.requestRender();
    }
  }
  
  export function fitToView() {
    if (threeManager) {
      threeManager.fitToView();
    }
  }
  
  export function getThreeManager() {
    return threeManager;
  }
</script>

<!-- Phase 4: Core Three.js container -->
<div 
  bind:this={canvasContainer} 
  class="threejs-container {className}"
  {style}
  data-testid="threejs-viewer"
  id="viewer-container"
>
  {#if !isInitialized}
    <div class="loading-overlay">
      <div class="loading-spinner"></div>
      <div class="loading-text">{status}</div>
    </div>
  {:else}
    <div class="status-overlay">
      <span class="status-text">{status}</span>
    </div>
  {/if}
</div>

<style>
  .threejs-container {
    width: 100%;
    height: 100%;
    position: relative;
    overflow: hidden;
    background: #222222;
    min-height: 400px;
  }
  
  .loading-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: rgba(34, 34, 34, 0.9);
    color: #ffffff;
    z-index: 1000;
  }
  
  .loading-spinner {
    width: 40px;
    height: 40px;
    border: 3px solid rgba(255, 255, 255, 0.3);
    border-top: 3px solid #ffffff;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 16px;
  }
  
  .loading-text {
    font-size: 14px;
    font-family: var(--vscode-font-family, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif);
  }
  
  .status-overlay {
    position: absolute;
    top: 10px;
    left: 10px;
    background: linear-gradient(135deg, rgba(0, 0, 0, 0.8), rgba(50, 50, 50, 0.8));
    color: #00ff88;
    padding: 6px 12px;
    border-radius: 4px;
    font-size: 12px;
    z-index: 100;
    pointer-events: none;
    border: 1px solid #00ff88;
    font-weight: 500;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  }
  
  .status-text {
    font-family: var(--vscode-font-family, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif);
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  
  /* Ensure the Three.js canvas takes full container size */
  .threejs-container :global(canvas) {
    width: 100% !important;
    height: 100% !important;
    display: block;
  }
</style>