import { writable } from 'svelte/store';

export interface VisualizerState {
  scene: any;
  camera: any;
  renderer: any;
  needsRender: boolean;
  currentFps: number;
  isInitialized: boolean;
}

const initialState: VisualizerState = {
  scene: null,
  camera: null,
  renderer: null,
  needsRender: false,
  currentFps: 0,
  isInitialized: false,
};

export const visualizerStore = writable(initialState);

// Store actions - will be implemented in Phase 3
export const visualizerActions = {
  initialize: (scene: any, camera: any, renderer: any) => {
    visualizerStore.update(state => ({
      ...state,
      scene,
      camera,
      renderer,
      isInitialized: true,
    }));
  },

  requestRender: () => {
    visualizerStore.update(state => ({
      ...state,
      needsRender: true,
    }));
  },

  updateFps: (fps: number) => {
    visualizerStore.update(state => ({
      ...state,
      currentFps: fps,
    }));
  },
};
