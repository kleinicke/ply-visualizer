/**
 * Stores Index - Phase 3: Central export for all Svelte stores
 *
 * This file provides a single import point for all reactive stores
 * used throughout the application.
 */

// Core stores
export { visualizerStore, visualizerActions } from './visualizer';
export type { VisualizerState } from './visualizer';

export { filesStore, filesActions } from './files';
export type { FilesState, FileInfo, FileProperties } from './files';

export { cameraStore, cameraActions } from './camera';
export type { CameraState } from './camera';

export { uiStore, uiActions } from './ui';
export type { UIState, PanelState } from './ui';

// Import the actions for internal use
import { visualizerActions } from './visualizer';
import { filesActions } from './files';
import { cameraActions } from './camera';
import { uiActions } from './ui';

// Store utilities
export const resetAllStores = () => {
  visualizerActions.dispose();
  filesActions.clearAll();
  cameraActions.reset();
  uiActions.reset();
};

// Combined store actions for convenience
export const storeActions = {
  visualizer: visualizerActions,
  files: filesActions,
  camera: cameraActions,
  ui: uiActions,
  resetAll: resetAllStores,
};
