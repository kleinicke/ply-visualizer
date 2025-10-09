/**
 * app.ts - Phase 4: Svelte Entry Point
 *
 * This file replaces the monolithic main.ts as the webpack entry point.
 * It initializes the Svelte App component which now handles all functionality
 * through the ThreeManager and reactive store architecture.
 */

import App from './App.svelte';
import { mount } from 'svelte';
import * as THREE from 'three';
// Re-enable the original working visualizer
import SpatialVisualizer from './main';

// Environment detection - works in both VSCode and browser
const isVSCode = typeof acquireVsCodeApi !== 'undefined';

console.log('🚀 Starting Phase 4 Svelte App...');
console.log('Environment:', isVSCode ? 'VS Code Extension' : 'Standalone Website');

// Acquire VS Code API only once if available
const vscode = isVSCode ? acquireVsCodeApi() : null;

// Initialize the Svelte app FIRST using Svelte 5 mount() function
const app = mount(App, {
  target: document.body,
  props: {
    vscode: vscode,
  },
});

// Make the app globally available for debugging and extension integration
if (typeof window !== 'undefined') {
  (window as any).svelteApp = app;
}

// Message queue for messages that arrive before SpatialVisualizer is ready
const messageQueue: any[] = [];
let spatialVisualizerReady = false;

// Wait for ThreeManager to be initialized by Svelte, then create SpatialVisualizer
console.log('⏳ Waiting for ThreeManager to initialize...');
const waitForThreeManager = setInterval(() => {
  const threeManager = (window as any).threeManager;
  if (threeManager) {
    clearInterval(waitForThreeManager);
    console.log('✅ ThreeManager ready, initializing SpatialVisualizer...');

    // Initialize the original working SpatialVisualizer with the Svelte ThreeManager
    const spatialVisualizer = new SpatialVisualizer(vscode, threeManager);
    if (typeof window !== 'undefined') {
      (window as any).spatialVisualizer = spatialVisualizer;
    }
    console.log('✅ SpatialVisualizer initialized with shared ThreeManager');

    // Mark as ready and process queued messages
    spatialVisualizerReady = true;
    if (messageQueue.length > 0) {
      console.log(`📦 Processing ${messageQueue.length} queued messages...`);
      messageQueue.forEach(msg => {
        // Re-dispatch the message
        window.dispatchEvent(new MessageEvent('message', { data: msg }));
      });
      messageQueue.length = 0; // Clear the queue
    }
  }
}, 50); // Check every 50ms

// Setup message handling for VS Code extension
if (isVSCode && vscode) {
  // Listen for messages from the extension host
  window.addEventListener('message', async event => {
    const message = event.data;
    console.log('📨 Received message from extension:', message);

    // TODO: Implement Svelte-native message handling for depth images
    // For now, just log the message types we receive
    console.log('📋 Message type:', message.type);

    try {
      // Get the ThreeManager from the global app reference
      const threeManager = (window as any).threeManager;

      console.log(
        '🎯 Processing message type:',
        message.type,
        'for',
        message.fileName || 'unknown file'
      );

      // Queue messages if SpatialVisualizer isn't ready yet
      if (!spatialVisualizerReady) {
        console.log('📥 Queueing message (SpatialVisualizer not ready):', message.type);
        messageQueue.push(message);
        return;
      }

      // Route all messages to SpatialVisualizer
      const spatialVis = (window as any).spatialVisualizer;
      if (!spatialVis) {
        console.error('❌ SpatialVisualizer missing despite being marked ready!');
        return;
      }

      switch (message.type) {
        case 'spatialData':
        case 'multiSpatialData':
          console.log('📊 Processing spatial data using SpatialVisualizer');
          const dataArray = Array.isArray(message.data) ? message.data : [message.data];
          await spatialVis.displayFiles(dataArray);
          break;
        case 'binarySpatialData':
        case 'directTypedArrayData':
        case 'ultimateRawBinaryData':
          console.log('💾 Processing binary spatial data using SpatialVisualizer');
          await spatialVis.handleUltimateRawBinaryData(message);
          // Ensure camera is positioned to view the point cloud
          const threeManager = (window as any).threeManager;
          if (threeManager && threeManager.fitToView) {
            console.log('📷 Fitting camera to view point cloud');
            console.log('🔍 Scene children count:', threeManager.scene?.children?.length || 0);
            console.log(
              '🔍 Scene children:',
              threeManager.scene?.children?.map((c: any) => c.type) || []
            );
            console.log('🔍 Canvas elements on page:', document.querySelectorAll('canvas').length);
            document.querySelectorAll('canvas').forEach((c, i) => {
              console.log(
                `  Canvas ${i}: ${c.width}x${c.height}, visible: ${c.offsetWidth}x${c.offsetHeight}, parent: ${c.parentElement?.id || 'no-id'}`
              );
            });
            console.log(
              '🔍 ThreeManager renderer canvas:',
              threeManager.renderer?.domElement === document.querySelectorAll('canvas')[0]
                ? 'Canvas 0'
                : threeManager.renderer?.domElement === document.querySelectorAll('canvas')[1]
                  ? 'Canvas 1'
                  : 'Unknown'
            );
            threeManager.fitToView();
            // Force a render
            threeManager.requestRender();
            console.log('🔍 Requested render after fit to view');
            // Force continuous rendering for debugging
            setTimeout(() => {
              console.log('🔍 Forcing continuous render...');
              for (let i = 0; i < 10; i++) {
                setTimeout(() => threeManager.requestRender(), i * 100);
              }
            }, 100);
          }
          break;
        case 'startLoading':
        case 'defaultDepthSettings':
        case 'timing':
        case 'timingUpdate':
          // These are handled internally by SpatialVisualizer
          // Just pass through without logging
          break;
        default:
          console.log('🔄 Other message type received:', message.type);
      }
    } catch (error) {
      console.error('❌ Error handling message:', error);
    }
  });

  console.log('📡 VS Code message handler set up');
}

console.log('✅ Phase 5 Svelte App initialized successfully');

export default app;

// Type declarations for VS Code API
declare const acquireVsCodeApi: () => any;
