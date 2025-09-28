/**
 * Visualizer Store - Phase 3: Reactive state management for Three.js core
 *
 * This store manages the core Three.js visualization state including
 * scene, camera, renderer, and performance metrics.
 */

import { writable } from 'svelte/store';
import * as THREE from 'three';
import type { ThreeManager } from '../lib/three-manager';

export interface VisualizerState {
  threeManager: ThreeManager | null;
  scene: THREE.Scene | null;
  camera: THREE.PerspectiveCamera | null;
  renderer: THREE.WebGLRenderer | null;
  controls: any | null;
  needsRender: boolean;
  currentFps: number;
  frameTime: number;
  gpuTime: number;
  isInitialized: boolean;
}

const initialState: VisualizerState = {
  threeManager: null,
  scene: null,
  camera: null,
  renderer: null,
  controls: null,
  needsRender: false,
  currentFps: 0,
  frameTime: 0,
  gpuTime: 0,
  isInitialized: false,
};

export const visualizerStore = writable<VisualizerState>(initialState);

// Phase 3: Enhanced store actions with ThreeManager integration
export const visualizerActions = {
  initialize: (threeManager: ThreeManager) => {
    visualizerStore.update(state => ({
      ...state,
      threeManager,
      scene: threeManager.getScene(),
      camera: threeManager.getCamera(),
      renderer: threeManager.getRenderer(),
      controls: threeManager.getControls(),
      isInitialized: true,
    }));
  },

  requestRender: () => {
    visualizerStore.update(state => ({
      ...state,
      needsRender: true,
    }));
  },

  updatePerformanceMetrics: (fps: number, frameTime: number, gpuTime: number = 0) => {
    visualizerStore.update(state => ({
      ...state,
      currentFps: fps,
      frameTime,
      gpuTime,
    }));
  },

  setRenderCompleted: () => {
    visualizerStore.update(state => ({
      ...state,
      needsRender: false,
    }));
  },

  dispose: () => {
    visualizerStore.set(initialState);
  },
};
