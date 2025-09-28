/**
 * Camera Store - Phase 3: Reactive state management for camera controls
 *
 * This store manages camera position, rotation, controls, and viewing settings.
 */

import { writable } from 'svelte/store';
import * as THREE from 'three';

export interface CameraState {
  // Phase 3: Enhanced camera state
  position: THREE.Vector3;
  rotation: THREE.Quaternion;
  target: THREE.Vector3;
  fov: number;
  near: number;
  far: number;
  controlType: 'trackball' | 'orbit' | 'inverse-trackball' | 'arcball' | 'cloudcompare';
  enableDamping: boolean;
  dampingFactor: number;
  autoRotate: boolean;
  autoRotateSpeed: number;
  enableZoom: boolean;
  zoomSpeed: number;
  enablePan: boolean;
  panSpeed: number;
  matrix: Float32Array; // 4x4 transformation matrix
  isUserControlled: boolean; // true when user is actively controlling camera
  boundingBox: THREE.Box3 | null;

  // Legacy compatibility (will be phased out)
  convention: string;
  matrixLegacy: number[];
}

const initialState: CameraState = {
  // Phase 3: Enhanced state
  position: new THREE.Vector3(1, 1, 1),
  rotation: new THREE.Quaternion(),
  target: new THREE.Vector3(0, 0, 0),
  fov: 75,
  near: 0.001,
  far: 1000000,
  controlType: 'trackball',
  enableDamping: true,
  dampingFactor: 0.25,
  autoRotate: false,
  autoRotateSpeed: 2.0,
  enableZoom: true,
  zoomSpeed: 1.0,
  enablePan: true,
  panSpeed: 1.0,
  matrix: new Float32Array(16),
  isUserControlled: false,
  boundingBox: null,

  // Legacy compatibility
  convention: 'opengl',
  matrixLegacy: [],
};

export const cameraStore = writable<CameraState>(initialState);

// Phase 3: Enhanced camera management actions
export const cameraActions = {
  updatePosition: (position: THREE.Vector3) => {
    cameraStore.update(state => ({
      ...state,
      position: position.clone(),
    }));
  },

  updateRotation: (rotation: THREE.Quaternion) => {
    cameraStore.update(state => ({
      ...state,
      rotation: rotation.clone(),
    }));
  },

  updateTarget: (target: THREE.Vector3) => {
    cameraStore.update(state => ({
      ...state,
      target: target.clone(),
    }));
  },

  updateMatrix: (camera: THREE.PerspectiveCamera) => {
    const matrix = new Float32Array(16);
    camera.matrix.toArray(matrix);

    cameraStore.update(state => ({
      ...state,
      position: camera.position.clone(),
      rotation: camera.quaternion.clone(),
      matrix,
    }));
  },

  setControlType: (controlType: CameraState['controlType']) => {
    cameraStore.update(state => ({
      ...state,
      controlType,
    }));
  },

  updateControlSettings: (
    settings: Partial<
      Pick<
        CameraState,
        | 'enableDamping'
        | 'dampingFactor'
        | 'autoRotate'
        | 'autoRotateSpeed'
        | 'enableZoom'
        | 'zoomSpeed'
        | 'enablePan'
        | 'panSpeed'
      >
    >
  ) => {
    cameraStore.update(state => ({
      ...state,
      ...settings,
    }));
  },

  setUserControlled: (isControlled: boolean) => {
    cameraStore.update(state => ({
      ...state,
      isUserControlled: isControlled,
    }));
  },

  setBoundingBox: (boundingBox: THREE.Box3 | null) => {
    cameraStore.update(state => ({
      ...state,
      boundingBox,
    }));
  },

  fitToView: (boundingBox: THREE.Box3, camera: THREE.PerspectiveCamera) => {
    const center = boundingBox.getCenter(new THREE.Vector3());
    const size = boundingBox.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = camera.fov * (Math.PI / 180);
    const distance = maxDim / (2 * Math.tan(fov / 2));

    const newPosition = center.clone();
    newPosition.z += distance * 1.5;

    cameraStore.update(state => ({
      ...state,
      position: newPosition,
      target: center.clone(),
      boundingBox,
    }));
  },

  // Legacy compatibility methods (will be removed in later phases)
  setConvention: (convention: string) => {
    cameraStore.update(state => ({
      ...state,
      convention,
    }));
  },

  updateMatrixLegacy: (matrix: number[]) => {
    cameraStore.update(state => ({
      ...state,
      matrixLegacy: [...matrix],
    }));
  },

  reset: () => {
    cameraStore.set(initialState);
  },
};
