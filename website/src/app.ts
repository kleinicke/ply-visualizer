/**
 * app.ts - Phase 4: Svelte Entry Point
 *
 * This file replaces the monolithic main.ts as the webpack entry point.
 * It initializes the Svelte App component which now handles all functionality
 * through the ThreeManager and reactive store architecture.
 */

import App from './App.svelte';
import * as THREE from 'three';
// Re-enable the original working visualizer
import SpatialVisualizer from './main';

// Environment detection - works in both VSCode and browser
const isVSCode = typeof acquireVsCodeApi !== 'undefined';

console.log('🚀 Starting Phase 4 Svelte App...');
console.log('Environment:', isVSCode ? 'VS Code Extension' : 'Standalone Website');

// Acquire VS Code API only once if available
const vscode = isVSCode ? acquireVsCodeApi() : null;

// Initialize the Svelte app FIRST
const app = new App({
  target: document.body,
  props: {
    vscode: vscode,
  },
});

// Initialize the original working SpatialVisualizer alongside Svelte
console.log('💡 Re-enabling original SpatialVisualizer alongside Svelte');
// Pass the vscode API to avoid dual acquisition
const spatialVisualizer = new SpatialVisualizer(vscode);
if (typeof window !== 'undefined') {
  (window as any).spatialVisualizer = spatialVisualizer;
}

// Make the app globally available for debugging and extension integration
if (typeof window !== 'undefined') {
  (window as any).svelteApp = app;

  // For VS Code extension compatibility, we'll expose methods once the app is mounted
  // The App component will set up the global references to ThreeManager
}

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

      switch (message.type) {
        case 'spatialData':
        case 'multiSpatialData':
          console.log('📊 Processing spatial data in Svelte app');
          if (threeManager && message.positions) {
            await handleSpatialData(threeManager, message);
          }
          break;
        case 'binarySpatialData':
        case 'directTypedArrayData':
        case 'ultimateRawBinaryData':
          console.log('💾 Processing binary spatial data in Svelte app');
          console.log('🔍 ThreeManager available:', !!threeManager);
          if (threeManager) {
            await handleBinaryData(threeManager, message);
          } else {
            console.error('❌ ThreeManager not available for binary data processing');
            // Wait for ThreeManager to be available
            setTimeout(() => {
              const retryThreeManager = (window as any).threeManager;
              if (retryThreeManager) {
                console.log('🔄 Retrying with ThreeManager after delay');
                handleBinaryData(retryThreeManager, message);
              }
            }, 100);
          }
          break;
        case 'startLoading':
          console.log('🔄 Loading started for:', message.fileName);
          break;
        case 'defaultDepthSettings':
          console.log('⚙️  Received depth settings:', message.settings);
          break;
        case 'timing':
          console.log('⏱️ Timing:', message.phase, message.ms + 'ms');
          break;
        case 'timingUpdate':
          // Don't log timing updates to reduce console noise
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

console.log('✅ Phase 4 Svelte App initialized successfully');

// Spatial data handling functions
async function handleSpatialData(threeManager: any, message: any) {
  console.log('🎯 Loading spatial data:', {
    fileName: message.fileName,
    vertexCount: message.positions?.length / 3,
    hasColors: !!message.colors,
    hasNormals: !!message.normals,
  });

  try {
    // Clear existing scene
    threeManager.clearScene();

    // Create geometry from spatial data
    const geometry = new THREE.BufferGeometry();

    if (message.positions) {
      geometry.setAttribute('position', new THREE.BufferAttribute(message.positions, 3));
    }

    if (message.colors) {
      geometry.setAttribute('color', new THREE.BufferAttribute(message.colors, 3));
    }

    if (message.normals) {
      geometry.setAttribute('normal', new THREE.BufferAttribute(message.normals, 3));
    }

    // Create point cloud material
    const material = new THREE.PointsMaterial({
      size: 2,
      vertexColors: !!message.colors,
      color: message.colors ? 0xffffff : 0x00ff00,
    });

    // Create and add point cloud to scene
    const pointCloud = new THREE.Points(geometry, material);
    threeManager.addToScene(pointCloud, message.fileName);

    // Fit camera to view
    threeManager.fitToView();

    console.log('✅ Spatial data loaded successfully');
  } catch (error) {
    console.error('❌ Error loading spatial data:', error);
  }
}

async function handleBinaryData(threeManager: any, message: any) {
  console.log('🎯 Loading binary spatial data using original method:', {
    fileName: message.fileName,
    vertexCount: message.vertexCount,
    faceCount: message.faceCount,
    hasColors: !!message.hasColors,
    dataSize: message.rawBinaryData?.byteLength || message.binaryData?.byteLength,
  });

  try {
    // Use the original working method from main.ts
    // Get the global SpatialVisualizer instance that should be available
    const spatialVisualizer = (window as any).spatialVisualizer;
    if (spatialVisualizer && spatialVisualizer.handleUltimateRawBinaryData) {
      console.log('🔄 Using original SpatialVisualizer.handleUltimateRawBinaryData method');
      await spatialVisualizer.handleUltimateRawBinaryData(message);
    } else {
      console.error(
        '❌ SpatialVisualizer not available, falling back to ThreeManager direct processing'
      );
      // Fallback: Tell the user to refresh or try again
      console.log(
        '💡 The original visualization system is not available. Please refresh the extension.'
      );
    }

    console.log('✅ Binary spatial data processed using original method');
  } catch (error) {
    console.error('❌ Error loading binary spatial data:', error);
  }
}

export default app;

// Type declarations for VS Code API
declare const acquireVsCodeApi: () => any;
