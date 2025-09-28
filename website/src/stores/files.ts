/**
 * Files Store - Phase 3: Reactive state management for loaded files
 *
 * This store manages all loaded files including PLY files, meshes,
 * their visibility, properties, and transformations.
 */

import { writable } from 'svelte/store';
import * as THREE from 'three';

export interface FileInfo {
  id: string;
  name: string;
  type: 'ply' | 'obj' | 'stl' | 'depth' | 'json';
  size: number;
  vertexCount?: number;
  faceCount?: number;
  loadTime: number;
  isVisible: boolean;
  mesh?: THREE.Object3D;
  originalData?: any;
}

export interface FileProperties {
  pointSize: number;
  colorMode: string;
  opacity: number;
  wireframe: boolean;
  transformation: THREE.Matrix4;
}

export interface FilesState {
  // Phase 3: Enhanced file management
  files: FileInfo[];
  fileProperties: Map<string, FileProperties>;
  selectedFileId: string | null;
  isLoading: boolean;
  loadingProgress: number;
  totalVertices: number;
  totalFaces: number;

  // Legacy compatibility (will be phased out)
  plyFiles: any[];
  meshes: any[];
  fileVisibility: boolean[];
  pointSizes: number[];
  individualColorModes: string[];
  currentFileIndex: number;
}

const initialState: FilesState = {
  // Phase 3: New reactive state
  files: [],
  fileProperties: new Map(),
  selectedFileId: null,
  isLoading: false,
  loadingProgress: 0,
  totalVertices: 0,
  totalFaces: 0,

  // Legacy compatibility
  plyFiles: [],
  meshes: [],
  fileVisibility: [],
  pointSizes: [],
  individualColorModes: [],
  currentFileIndex: -1,
};

export const filesStore = writable<FilesState>(initialState);

// Phase 3: Enhanced file management actions
export const filesActions = {
  addFile: (fileInfo: FileInfo, properties?: Partial<FileProperties>) => {
    filesStore.update(state => {
      const defaultProperties: FileProperties = {
        pointSize: 1.0,
        colorMode: 'original',
        opacity: 1.0,
        wireframe: false,
        transformation: new THREE.Matrix4(),
      };

      const newFiles = [...state.files, fileInfo];
      const newProperties = new Map(state.fileProperties);
      newProperties.set(fileInfo.id, { ...defaultProperties, ...properties });

      return {
        ...state,
        files: newFiles,
        fileProperties: newProperties,
        totalVertices: state.totalVertices + (fileInfo.vertexCount || 0),
        totalFaces: state.totalFaces + (fileInfo.faceCount || 0),
      };
    });
  },

  removeFile: (fileId: string) => {
    filesStore.update(state => {
      const fileToRemove = state.files.find(f => f.id === fileId);
      const newFiles = state.files.filter(f => f.id !== fileId);
      const newProperties = new Map(state.fileProperties);
      newProperties.delete(fileId);

      return {
        ...state,
        files: newFiles,
        fileProperties: newProperties,
        selectedFileId: state.selectedFileId === fileId ? null : state.selectedFileId,
        totalVertices: state.totalVertices - (fileToRemove?.vertexCount || 0),
        totalFaces: state.totalFaces - (fileToRemove?.faceCount || 0),
      };
    });
  },

  updateFileVisibility: (fileId: string, isVisible: boolean) => {
    filesStore.update(state => ({
      ...state,
      files: state.files.map(file => (file.id === fileId ? { ...file, isVisible } : file)),
    }));
  },

  updateFileProperties: (fileId: string, properties: Partial<FileProperties>) => {
    filesStore.update(state => {
      const newProperties = new Map(state.fileProperties);
      const currentProps = newProperties.get(fileId);
      if (currentProps) {
        newProperties.set(fileId, { ...currentProps, ...properties });
      }
      return {
        ...state,
        fileProperties: newProperties,
      };
    });
  },

  selectFile: (fileId: string | null) => {
    filesStore.update(state => ({
      ...state,
      selectedFileId: fileId,
    }));
  },

  setLoading: (isLoading: boolean, progress: number = 0) => {
    filesStore.update(state => ({
      ...state,
      isLoading,
      loadingProgress: progress,
    }));
  },

  // Legacy compatibility methods (will be removed in later phases)
  addFiles: (files: any[]) => {
    filesStore.update(state => ({
      ...state,
      plyFiles: [...state.plyFiles, ...files],
    }));
  },

  removeFileByIndex: (index: number) => {
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

  clearAll: () => {
    filesStore.set(initialState);
  },
};
