<!-- 
  Phase 4: Core Svelte App Component with ThreeJSViewer
  This component now uses the new ThreeManager-based architecture
  with reactive store integration.
-->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import ThreeJSViewer from './components/threejs/ThreeJSViewer.svelte';
  import { visualizerStore, uiStore } from './stores';
  
  // Svelte 5 props syntax
  interface Props {
    vscode?: any;
  }
  
  let { vscode = null }: Props = $props();
  
  let threeJSViewer: ThreeJSViewer;
  let status = $state('Phase 4: Initializing Svelte + ThreeManager...');
  
  // Use Svelte 5 $state for better reactivity
  let currentTheme = $state('dark');
  
  let unsubscribeVisualizer: (() => void) | undefined;
  let unsubscribeUI: (() => void) | undefined;
  
  onMount(() => {
    console.log('App.svelte mounted - Phase 4 architecture');
    
    // Subscribe to stores the traditional way
    unsubscribeVisualizer = visualizerStore.subscribe(value => {
      if (value.isInitialized) {
        status = 'Phase 4: Ready - Svelte + ThreeManager active';
      }
    });
    
    unsubscribeUI = uiStore.subscribe(value => {
      currentTheme = value.theme;
    });
    
    // Make the viewer available globally for VS Code extension compatibility
    if (typeof window !== 'undefined') {
      (window as any).threeJSViewer = threeJSViewer;
    }
  });
  
  onDestroy(() => {
    unsubscribeVisualizer?.();
    unsubscribeUI?.();
  });
  
  // Public methods for external access (VS Code extension)
  export function getThreeManager() {
    return threeJSViewer?.getThreeManager();
  }
  
  export function requestRender() {
    threeJSViewer?.requestRender();
  }
  
  export function fitToView() {
    threeJSViewer?.fitToView();
  }
</script>

<!-- Phase 4: Modern Svelte component architecture -->
<div class="app-container" data-theme={currentTheme}>
  <div class="migration-status">
    {status}
  </div>
  
  <!-- Phase 4: ThreeJSViewer component with ThreeManager -->
  <ThreeJSViewer 
    bind:this={threeJSViewer}
    class="main-viewer"
  />
</div>

<style>
  .app-container {
    width: 100%;
    height: 100%;
    position: relative;
    display: flex;
    flex-direction: column;
    background: var(--app-bg-color, #222222);
  }
  
  .app-container[data-theme="dark"] {
    --app-bg-color: #222222;
    --status-bg-color: rgba(0, 150, 255, 0.1);
    --status-text-color: #0096ff;
  }
  
  .app-container[data-theme="light"] {
    --app-bg-color: #ffffff;
    --status-bg-color: rgba(0, 120, 200, 0.1);
    --status-text-color: #0078c8;
  }
  
  .migration-status {
    position: absolute;
    top: 10px;
    right: 10px;
    background: linear-gradient(135deg, rgba(0, 150, 255, 0.15), rgba(0, 200, 100, 0.15));
    color: var(--status-text-color, #0096ff);
    padding: 8px 16px;
    font-size: 13px;
    border-radius: 8px;
    z-index: 1000;
    pointer-events: none;
    font-family: var(--vscode-font-family, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif);
    font-weight: 600;
    border: 2px solid var(--status-text-color, #0096ff);
    box-shadow: 0 4px 12px rgba(0, 150, 255, 0.3);
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
    animation: pulse-glow 3s ease-in-out infinite;
  }
  
  @keyframes pulse-glow {
    0%, 100% { 
      box-shadow: 0 4px 12px rgba(0, 150, 255, 0.3);
      transform: scale(1);
    }
    50% { 
      box-shadow: 0 6px 20px rgba(0, 150, 255, 0.5);
      transform: scale(1.02);
    }
  }
  
  .app-container :global(.main-viewer) {
    flex: 1;
    width: 100%;
    height: 100%;
  }
</style>