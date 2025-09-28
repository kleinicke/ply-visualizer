import { writable } from 'svelte/store';

export interface FilesState {
  plyFiles: any[];
  meshes: any[];
  fileVisibility: boolean[];
  pointSizes: number[];
  individualColorModes: string[];
  currentFileIndex: number;
}

const initialState: FilesState = {
  plyFiles: [],
  meshes: [],
  fileVisibility: [],
  pointSizes: [],
  individualColorModes: [],
  currentFileIndex: -1,
};

export const filesStore = writable(initialState);

// Store actions - will be implemented in Phase 3
export const filesActions = {
  addFiles: (files: any[]) => {
    filesStore.update(state => ({
      ...state,
      plyFiles: [...state.plyFiles, ...files],
    }));
  },

  removeFile: (index: number) => {
    filesStore.update(state => ({
      ...state,
      plyFiles: state.plyFiles.filter((_, i) => i !== index),
    }));
  },

  toggleVisibility: (index: number) => {
    filesStore.update(state => {
      const newVisibility = [...state.fileVisibility];
      newVisibility[index] = !newVisibility[index];
      return {
        ...state,
        fileVisibility: newVisibility,
      };
    });
  },
};
