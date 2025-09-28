import { writable } from 'svelte/store';

export interface CameraState {
  position: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
  controlType: string;
  convention: string;
  matrix: number[];
}

const initialState: CameraState = {
  position: { x: 0, y: 0, z: 5 },
  target: { x: 0, y: 0, z: 0 },
  controlType: 'trackball',
  convention: 'opengl',
  matrix: [],
};

export const cameraStore = writable(initialState);

// Store actions - will be implemented in Phase 3
export const cameraActions = {
  setControlType: (type: string) => {
    cameraStore.update(state => ({
      ...state,
      controlType: type,
    }));
  },

  setConvention: (convention: string) => {
    cameraStore.update(state => ({
      ...state,
      convention,
    }));
  },

  updateMatrix: (matrix: number[]) => {
    cameraStore.update(state => ({
      ...state,
      matrix: [...matrix],
    }));
  },
};
