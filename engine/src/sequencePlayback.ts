import { isConvertedDepthCloud } from './colorMode';
import { estimateSequenceBytes } from './sequenceMemory';
import * as THREE from 'three';
import { hasIntensityData } from './utils/intensity';
import type { CameraParams, DepthConversionResult, SpatialData } from './interfaces';
import type { FileEntry, FileEntryRegistry } from './state/fileEntries';
import {
  buildFileObject,
  disposeFileResources,
  type FileObjectHost,
} from './visualization/fileObject';
import { decodeFileMessage } from './formats/fileMessage';
import { detectFileTypeWithContent } from './fileHandler';
import { applyDepthResultTypedArrays } from './depth/depthResultArrays';
import { uiState } from './state/ui.svelte';
import type { MessageOf } from './hosts/viewerProtocol';

export interface SequencePlaybackHost extends FileObjectHost {
  scene: THREE.Scene;
  vscode: { postMessage(message: unknown): void };
  fileEntries: FileEntryRegistry;
  defaultDepthSettings: CameraParams;
  processDepthToPointCloud(
    data: ArrayBuffer,
    fileName: string,
    params: CameraParams,
    color?: ImageData,
    signal?: AbortSignal
  ): Promise<DepthConversionResult>;
  sequenceMode: boolean;
  sequenceFiles: string[];
  sequenceIndex: number;
  sequenceTargetIndex: number;
  sequenceDidInitialFit: boolean;
  isSequencePlaying: boolean;
  sequenceCache: Map<number, FileEntry>;
  sequencePending: Map<
    number,
    { requestId: string; controller: AbortController; processing: boolean }
  >;
  sequenceDecoding: boolean;
  sequenceQueuedFrame: MessageOf<'sequence:file'> | null;
  sequenceGeneration: number;
  sequenceRequestId: number;
  sequenceTimer: number | null;
  sequenceFps: number;
  maxSequenceCache: number;
  maxSequenceCacheBytes: number;
  updateFileList(): void;
  requestRender(): void;
  removeFileByIndex(index: number): void;
  fitCameraToObject(obj: THREE.Object3D): void;
  showError(message: string): void;
}

function disposeFrame(entry: FileEntry): void {
  disposeFileResources(entry, entry.spatial?.object, entry.spatial?.data);
}

function cancelFrame(host: SequencePlaybackHost, index: number): void {
  const pending = host.sequencePending.get(index);
  if (!pending) {
    return;
  }
  pending.controller.abort();
  host.sequencePending.delete(index);
  host.vscode.postMessage({ type: 'sequence:cancelFile', requestId: pending.requestId });
  if (host.sequenceQueuedFrame?.requestId === pending.requestId) {
    host.sequenceQueuedFrame = null;
  }
}

export function disposeSequence(host: SequencePlaybackHost): void {
  pauseSequence(host);
  host.sequenceGeneration++;
  for (const index of host.sequencePending.keys()) {
    cancelFrame(host, index);
  }
  host.sequenceQueuedFrame = null;
  for (const entry of host.sequenceCache.values()) {
    disposeFrame(entry);
  }
  host.sequenceCache.clear();
  host.sequenceMode = false;
  host.sequenceFiles = [];
  uiState.sequenceMode = false;
}

export function initializeSequence(
  host: SequencePlaybackHost,
  files: string[],
  _wildcard: string
): void {
  disposeSequence(host);
  host.sequenceMode = true;
  host.sequenceFiles = files;
  host.sequenceIndex = 0;
  host.sequenceTargetIndex = 0;
  host.sequenceDidInitialFit = false;
  uiState.sequenceMode = true;
  updateSequenceUI(host);
  while (host.fileEntries.length) {
    host.removeFileByIndex(host.fileEntries.length - 1);
  }
  loadSequenceFrame(host, 0);
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

/** Requests and prefetch share the same pending map. IDs include the sequence generation. */
function requestFrame(host: SequencePlaybackHost, index: number): void {
  const path = host.sequenceFiles[index];
  if (
    !path ||
    host.sequenceCache.has(index) ||
    host.sequencePending.has(index) ||
    host.sequencePending.size >= 2
  ) {
    return;
  }
  const requestId = `${host.sequenceGeneration}:${++host.sequenceRequestId}`;
  host.sequencePending.set(index, {
    requestId,
    controller: new AbortController(),
    processing: false,
  });
  host.vscode.postMessage({ type: 'sequence:requestFile', path, index, requestId });
}

export function loadSequenceFrame(host: SequencePlaybackHost, index: number): void {
  // Scrubbing replaces intent instead of creating an unbounded decode queue.
  for (const pendingIndex of host.sequencePending.keys()) {
    if (pendingIndex !== index) {
      cancelFrame(host, pendingIndex);
    }
  }
  const cached = host.sequenceCache.get(index);
  if (cached) {
    showFrame(host, cached, index);
  } else {
    requestFrame(host, index);
  }
}

export async function handleSequenceFile(
  host: SequencePlaybackHost,
  message: MessageOf<'sequence:file'>
): Promise<void> {
  const pending = host.sequencePending.get(message.index);
  if (!pending || pending.processing || pending.requestId !== message.requestId) {
    return;
  }
  pending.processing = true;
  host.sequenceQueuedFrame = message;
  if (host.sequenceDecoding) {
    return;
  }
  host.sequenceDecoding = true;
  try {
    while (host.sequenceQueuedFrame) {
      const next = host.sequenceQueuedFrame;
      host.sequenceQueuedFrame = null;
      const request = host.sequencePending.get(next.index);
      if (request?.requestId === next.requestId) {
        await decodeFrame(host, next, request);
      }
    }
  } finally {
    host.sequenceDecoding = false;
  }
}

async function decodeFrame(
  host: SequencePlaybackHost,
  message: MessageOf<'sequence:file'>,
  pending: { requestId: string; controller: AbortController; processing: boolean }
): Promise<void> {
  const { signal } = pending.controller;
  let entry: FileEntry | undefined;
  let data: SpatialData | undefined;
  try {
    const bytes = message.data instanceof Uint8Array ? message.data : new Uint8Array(message.data);
    const type = await detectFileTypeWithContent(message.fileName, bytes);
    signal.throwIfAborted();
    if (type?.isDepthFile) {
      const params = { ...host.defaultDepthSettings, cx: undefined, cy: undefined };
      if (/\.png$/i.test(message.fileName)) {
        params.pngScaleFactor ||= 1000;
      }
      const result = await host.processDepthToPointCloud(
        bytes.slice().buffer,
        message.fileName,
        params,
        undefined,
        signal
      );
      data = {
        vertices: [],
        faces: [],
        vertexCount: 0,
        faceCount: 0,
        hasColors: false,
        hasNormals: false,
        format: 'ascii',
        version: '1.0',
        comments: [],
        fileName: message.fileName,
      };
      applyDepthResultTypedArrays(data, result);
    } else {
      data = await decodeFileMessage({ type: 'fileData', fileName: message.fileName, data: bytes });
    }
    signal.throwIfAborted();
    entry = host.fileEntries.prepare('spatial');
    entry.state.colorMode = isConvertedDepthCloud(data)
      ? '0'
      : data.hasColors
        ? 'original'
        : hasIntensityData(data)
          ? 'intensity'
          : 'assigned';
    entry.state.pointSize = 2.5;
    const object = buildFileObject(host, data, message.index, entry);
    entry.spatial = { data, object };
    if (object instanceof THREE.Points && object.material instanceof THREE.PointsMaterial) {
      object.material.sizeAttenuation = false;
    }
    // Frames never enter the ordinary file registry, even during decoding.
    host.sequenceCache.set(message.index, entry);
    entry = undefined;
    data = undefined;
    if (message.index === host.sequenceTargetIndex) {
      showFrame(host, host.sequenceCache.get(message.index)!, message.index);
    }
    evictFrames(host);
  } catch (error) {
    if (entry) {
      disposeFrame(entry);
    } else {
      data?.sceneModel?.dispose();
    }
    if (!signal.aborted) {
      host.showError(
        `Sequence frame failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  } finally {
    if (host.sequencePending.get(message.index) === pending) {
      host.sequencePending.delete(message.index);
    }
  }
}

export function handleSequenceError(
  host: SequencePlaybackHost,
  message: MessageOf<'sequence:file:error'>
): void {
  const pending = host.sequencePending.get(message.index);
  if (pending?.requestId !== message.requestId) {
    return;
  }
  pending.controller.abort();
  host.sequencePending.delete(message.index);
  if (message.index === host.sequenceTargetIndex) {
    pauseSequence(host);
    host.showError(`Sequence frame failed: ${message.error}`);
  }
}

function evictFrames(host: SequencePlaybackHost): void {
  for (const [index, entry] of host.sequenceCache) {
    if (
      host.sequenceCache.size <= Math.max(1, host.maxSequenceCache) &&
      estimateSequenceBytes(host.sequenceCache.values()) <= host.maxSequenceCacheBytes
    ) {
      break;
    }
    if (index === host.sequenceIndex) {
      continue;
    }
    host.sequenceCache.delete(index);
    disposeFrame(entry);
  }
}

function showFrame(host: SequencePlaybackHost, entry: FileEntry, index: number): void {
  const object = entry.spatial!.object;
  const previous = host.sequenceCache.get(host.sequenceIndex)?.spatial?.object;
  if (previous && previous !== object) {
    previous.removeFromParent();
  }
  host.scene.add(object);
  object.visible = true;
  host.sequenceIndex = index;
  // Refresh insertion order so recently viewed frames survive eviction.
  host.sequenceCache.delete(index);
  host.sequenceCache.set(index, entry);
  if (!host.sequenceDidInitialFit) {
    host.fitCameraToObject(object);
    host.sequenceDidInitialFit = true;
  }
  updateSequenceUI(host);
  host.updateFileList();
  host.requestRender();
  const next = (index + 1) % host.sequenceFiles.length;
  if (
    estimateSequenceBytes([entry]) < host.maxSequenceCacheBytes &&
    !/\.(tif|tiff|pfm|npy|npz|png|exr)$/i.test(host.sequenceFiles[next] ?? '')
  ) {
    requestFrame(host, next);
  }
}
