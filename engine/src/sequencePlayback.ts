import * as THREE from 'three';
import { SpatialData } from './interfaces';
import { uiState } from './state/ui.svelte';

/**
 * Everything the sequence-playback functions need from PointCloudVisualizer.
 * Extracted as a narrow structural interface so these functions can move out
 * of main.ts without migrating the underlying state fields (which are also
 * read/written from unrelated parts of the visualizer).
 */
export interface SequencePlaybackHost {
  scene: THREE.Scene;
  vscode: { postMessage(message: any): void };

  meshes: (THREE.Mesh | THREE.Points | THREE.LineSegments)[];
  spatialFiles: SpatialData[];
  multiMaterialGroups: (THREE.Group | null)[];
  materialMeshes: (THREE.Object3D[] | null)[];
  fileVisibility: boolean[];
  pointSizes: number[];
  individualColorModes: string[];

  sequenceMode: boolean;
  sequenceFiles: string[];
  sequenceIndex: number;
  sequenceTargetIndex: number;
  sequenceDidInitialFit: boolean;
  isSequencePlaying: boolean;
  sequenceCache: Map<number, THREE.Object3D>;
  sequenceCacheOrder: number[];
  sequenceTimer: number | null;
  sequenceFps: number;
  maxSequenceCache: number;

  updateFileList(): void;
  requestRender(): void;
  fitCameraToObject(obj: THREE.Object3D): void;
  displayFiles(dataArray: SpatialData[]): Promise<void>;
  handleUltimateRawBinaryData(message: any): Promise<void>;
  handleXyzData(message: any): Promise<void>;
  handleObjData(message: any): Promise<void>;
  handleStlData(message: any): Promise<void>;
  handleDepthData(message: any): Promise<void>;
}

export function initializeSequence(
  host: SequencePlaybackHost,
  files: string[],
  wildcard: string
): void {
  host.sequenceMode = true;
  host.sequenceFiles = files;
  host.sequenceIndex = 0;
  host.sequenceTargetIndex = 0;
  host.sequenceDidInitialFit = false;
  host.isSequencePlaying = false;
  host.sequenceCache.clear();
  host.sequenceCacheOrder = [];
  uiState.sequenceMode = true;
  updateSequenceUI(host);
  // Clear any existing meshes from normal mode
  for (const obj of host.meshes) {
    host.scene.remove(obj);
  }
  host.meshes = [];
  host.spatialFiles = [];
  // Load first frame
  if (files.length > 0) {
    loadSequenceFrame(host, 0);
  }
  host.updateFileList();
}

export function updateSequenceUI(host: SequencePlaybackHost): void {
  uiState.sequenceTotal = host.sequenceFiles.length;
  uiState.sequenceIndex = Math.min(
    host.sequenceIndex,
    host.sequenceFiles.length ? host.sequenceFiles.length - 1 : 0
  );
}

export function playSequence(host: SequencePlaybackHost): void {
  if (!host.sequenceFiles.length) {
    return;
  }
  if (host.isSequencePlaying) {
    return;
  }
  host.isSequencePlaying = true;
  uiState.isSequencePlaying = true;
  const intervalMs = Math.max(50, Math.floor(1000 / host.sequenceFps));
  host.sequenceTimer = window.setInterval(() => {
    const nextIndex = (host.sequenceIndex + 1) % host.sequenceFiles.length;
    seekSequence(host, nextIndex);
  }, intervalMs) as unknown as number;
}

export function pauseSequence(host: SequencePlaybackHost): void {
  host.isSequencePlaying = false;
  uiState.isSequencePlaying = false;
  if (host.sequenceTimer !== null) {
    window.clearInterval(host.sequenceTimer as unknown as number);
    host.sequenceTimer = null;
  }
}

export function stopSequence(host: SequencePlaybackHost): void {
  pauseSequence(host);
}

export function stepSequence(host: SequencePlaybackHost, delta: number): void {
  if (!host.sequenceFiles.length) {
    return;
  }
  pauseSequence(host); // do not auto-play when stepping
  const count = host.sequenceFiles.length;
  const next = (host.sequenceIndex + delta + count) % count;
  seekSequence(host, next);
}

export function seekSequence(host: SequencePlaybackHost, index: number): void {
  if (!host.sequenceFiles.length) {
    return;
  }
  const clamped = Math.max(0, Math.min(index, host.sequenceFiles.length - 1));
  host.sequenceTargetIndex = clamped;
  loadSequenceFrame(host, clamped);
}

export async function sequenceHandleUltimate(
  host: SequencePlaybackHost,
  message: any
): Promise<void> {
  const plyMsg = { ...message, type: 'ultimateRawBinaryData', messageType: 'addFiles' };
  const startFilesLen = host.spatialFiles.length;
  await host.handleUltimateRawBinaryData(plyMsg);
  const created = host.meshes[host.meshes.length - 1];
  if (created) {
    if (message.index === host.sequenceTargetIndex) {
      useSequenceObject(host, created, message.index);
    } else {
      cacheSequenceOnly(host, created, message.index);
    }
  }
  trimNormalModeArraysFrom(host, startFilesLen);
}

export async function sequenceHandlePly(host: SequencePlaybackHost, message: any): Promise<void> {
  const startFilesLen = host.spatialFiles.length;
  await host.displayFiles([message.data]);
  const created = host.meshes[host.meshes.length - 1];
  if (created) {
    if (message.index === host.sequenceTargetIndex) {
      useSequenceObject(host, created, message.index);
    } else {
      cacheSequenceOnly(host, created, message.index);
    }
  }
  trimNormalModeArraysFrom(host, startFilesLen);
}

export async function sequenceHandleXyz(host: SequencePlaybackHost, message: any): Promise<void> {
  const startFilesLen = host.spatialFiles.length;
  await host.handleXyzData({
    type: 'xyzData',
    fileName: message.fileName,
    data: message.data,
    isAddFile: true,
  });
  const created = host.meshes[host.meshes.length - 1];
  if (created) {
    if (message.index === host.sequenceTargetIndex) {
      useSequenceObject(host, created, message.index);
    } else {
      cacheSequenceOnly(host, created, message.index);
    }
  }
  trimNormalModeArraysFrom(host, startFilesLen);
}

export async function sequenceHandleObj(host: SequencePlaybackHost, message: any): Promise<void> {
  const startFilesLen = host.spatialFiles.length;
  await host.handleObjData({
    type: 'objData',
    fileName: message.fileName,
    data: message.data,
    isAddFile: true,
  });
  const created = host.meshes[host.meshes.length - 1];
  if (created) {
    if (message.index === host.sequenceTargetIndex) {
      useSequenceObject(host, created, message.index);
    } else {
      cacheSequenceOnly(host, created, message.index);
    }
  }
  trimNormalModeArraysFrom(host, startFilesLen);
}

export async function sequenceHandleStl(host: SequencePlaybackHost, message: any): Promise<void> {
  const startFilesLen = host.spatialFiles.length;
  await host.handleStlData({
    type: 'stlData',
    fileName: message.fileName,
    data: message.data,
    isAddFile: true,
  });
  const created = host.meshes[host.meshes.length - 1];
  if (created) {
    if (message.index === host.sequenceTargetIndex) {
      useSequenceObject(host, created, message.index);
    } else {
      cacheSequenceOnly(host, created, message.index);
    }
  }
  trimNormalModeArraysFrom(host, startFilesLen);
}

export async function sequenceHandleDepth(host: SequencePlaybackHost, message: any): Promise<void> {
  const startFilesLen = host.spatialFiles.length;
  await host.handleDepthData({
    type: 'depthData',
    fileName: message.fileName,
    data: message.data,
    isAddFile: true,
  });
  const created = host.meshes[host.meshes.length - 1];
  if (created) {
    useSequenceObject(host, created, message.index);
  }
  trimNormalModeArraysFrom(host, startFilesLen);
}

export function trimNormalModeArraysFrom(host: SequencePlaybackHost, startIndex: number): void {
  if (host.spatialFiles.length > startIndex) {
    host.spatialFiles.splice(startIndex);
  }
  if (host.multiMaterialGroups.length > startIndex) {
    host.multiMaterialGroups.splice(startIndex);
  }
  if (host.materialMeshes.length > startIndex) {
    host.materialMeshes.splice(startIndex);
  }
  if (host.fileVisibility.length > startIndex) {
    host.fileVisibility.splice(startIndex);
  }
  if (host.pointSizes.length > startIndex) {
    host.pointSizes.splice(startIndex);
  }
  if (host.individualColorModes.length > startIndex) {
    host.individualColorModes.splice(startIndex);
  }
}

export async function loadSequenceFrame(host: SequencePlaybackHost, index: number): Promise<void> {
  const filePath = host.sequenceFiles[index];
  if (!filePath) {
    return;
  }
  // If cached, display immediately
  const cached = host.sequenceCache.get(index);
  if (cached) {
    swapSequenceObject(host, cached, index);
    return;
  }
  // If a request is in-flight and for a different index, let it finish but ignore on arrival
  const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  // Request from extension with requestId for matching
  host.vscode.postMessage({ type: 'sequence:requestFile', path: filePath, index, requestId });
  // Show a lightweight loading hint
  try {
    (document.getElementById('loading') as HTMLElement)?.classList.remove('hidden');
  } catch {}
}

export function useSequenceObject(
  host: SequencePlaybackHost,
  obj: THREE.Object3D,
  index: number
): void {
  // Cache management
  if (!host.sequenceCache.has(index)) {
    host.sequenceCache.set(index, obj);
    host.sequenceCacheOrder.push(index);
    // Evict if over capacity
    while (host.sequenceCacheOrder.length > host.maxSequenceCache) {
      const evictIndex = host.sequenceCacheOrder.shift()!;
      if (evictIndex !== host.sequenceIndex) {
        const evictObj = host.sequenceCache.get(evictIndex);
        if (evictObj) {
          host.scene.remove(evictObj);
          if ((evictObj as any).geometry) {
            (evictObj as any).geometry.dispose?.();
          }
          if ((evictObj as any).material) {
            const mat = (evictObj as any).material;
            if (Array.isArray(mat)) {
              mat.forEach(m => m.dispose?.());
            } else {
              mat.dispose?.();
            }
          }
        }
        host.sequenceCache.delete(evictIndex);
      }
    }
  }
  swapSequenceObject(host, obj, index);
}

export function cacheSequenceOnly(
  host: SequencePlaybackHost,
  obj: THREE.Object3D,
  index: number
): void {
  if (obj.parent) {
    host.scene.remove(obj);
  }
  if (!host.sequenceCache.has(index)) {
    host.sequenceCache.set(index, obj);
    host.sequenceCacheOrder.push(index);
    while (host.sequenceCacheOrder.length > host.maxSequenceCache) {
      const evictIndex = host.sequenceCacheOrder.shift()!;
      const evictObj = host.sequenceCache.get(evictIndex);
      if (evictObj) {
        host.scene.remove(evictObj);
        if ((evictObj as any).geometry) {
          (evictObj as any).geometry.dispose?.();
        }
        if ((evictObj as any).material) {
          const mat = (evictObj as any).material;
          if (Array.isArray(mat)) {
            mat.forEach(m => m.dispose?.());
          } else {
            mat.dispose?.();
          }
        }
      }
      host.sequenceCache.delete(evictIndex);
    }
  }
}

export function swapSequenceObject(
  host: SequencePlaybackHost,
  obj: THREE.Object3D,
  index: number
): void {
  // Remove current
  const current = host.sequenceCache.get(host.sequenceIndex);
  if (current && current !== obj) {
    current.visible = false;
    host.scene.remove(current);
  }
  // Add new
  if (!obj.parent) {
    host.scene.add(obj);
  }
  obj.visible = true;
  // Hide axes when new object is added to rule out looking-only-at-axes confusion
  try {
    (host as any).axesGroup.visible = true;
  } catch {}

  host.requestRender();
  host.sequenceIndex = index;
  // Make points clearly visible in sequence mode
  ensureSequenceVisibility(obj);
  // Fit camera only once on the first visible frame
  if (!host.sequenceDidInitialFit) {
    host.fitCameraToObject(obj);
    host.sequenceDidInitialFit = true;
  }
  updateSequenceUI(host);
  host.updateFileList();
  // Hide loading if it was shown
  try {
    (document.getElementById('loading') as HTMLElement)?.classList.add('hidden');
  } catch {}
  // Preload next
  const next = (index + 1) % host.sequenceFiles.length;
  const nextPath = host.sequenceFiles[next] || '';
  const isDepth = /\.(tif|tiff|pfm|npy|npz|png|exr)$/i.test(nextPath);
  if (!isDepth && !host.sequenceCache.get(next)) {
    host.vscode.postMessage({ type: 'sequence:requestFile', path: nextPath, index: next });
  }
}

export function ensureSequenceVisibility(obj: THREE.Object3D): void {
  if (
    (obj as any).isPoints &&
    (obj as any).material &&
    (obj as any).material instanceof THREE.PointsMaterial
  ) {
    const mat = (obj as any).material as THREE.PointsMaterial;
    // Use a sensible on-screen size for sequence mode; avoid tiny defaults
    if (!mat.size || mat.size < 0.5) {
      mat.size = 2.5;
    }
    // Use screen-space size for clarity regardless of distance
    mat.sizeAttenuation = false;
    mat.needsUpdate = true;
  }
}
