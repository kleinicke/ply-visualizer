import * as vscode from 'vscode';
import type { SpatialData } from '../../engine/src/interfaces';
import type { VolumeData } from '../../engine/src/parsers/nrrdParser';
import { buildVolumeMeshAsync, volumeHistogram } from '../../engine/src/visualization/isosurface';
import { chooseStep } from '../../engine/src/visualization/marchingCubes';
import {
  buildVolumePoints,
  buildVolumePointsAsync,
} from '../../engine/src/visualization/volumePoints';
import { buildVolumeSlicesAsync } from '../../engine/src/visualization/volumeSlices';
import { resolveVolumeWindow } from '../../engine/src/visualization/volumePresentation';

export type VolumeRenderMode = 'points' | 'mesh' | 'slices';

export interface VolumeExtractionOptions {
  threshold: number;
  step: [number, number, number];
  renderMode: VolumeRenderMode;
  windowCenter: number;
  windowWidth: number;
  sliceIndices: [number, number, number];
}

export interface VolumeSession {
  volume: VolumeData;
  options: VolumeExtractionOptions;
  histogram: { min: number; max: number; bins: number[] };
  generation: number;
}

const sessions = new Map<string, VolumeSession>();

export function retainVolume(key: string, volume: VolumeData): VolumeSession {
  const histogram = volumeHistogram(volume);
  const window = resolveVolumeWindow(volume, histogram);
  const session: VolumeSession = {
    volume,
    options: {
      // Start with every voxel present. Raising this value is the only thing
      // that removes points from the canonical DICOM point representation.
      threshold: histogram.min,
      step: chooseStep(volume.sizes, volume.ijkToWorld),
      renderMode: 'points',
      windowCenter: window.center,
      windowWidth: window.width,
      sliceIndices: volume.sizes.map(size => Math.floor((size - 1) / 2)) as [
        number,
        number,
        number,
      ],
    },
    histogram,
    generation: 0,
  };
  sessions.set(key, session);
  return session;
}

/** Build the canonical first view: one windowed-grey point per source voxel. */
export function buildInitialVolumeData(session: VolumeSession): SpatialData {
  return buildVolumePoints(session.volume, {
    threshold: session.options.threshold,
    step: [1, 1, 1],
    windowCenter: session.options.windowCenter,
    windowWidth: session.options.windowWidth,
  }).data;
}

export function clearVolume(key: string): void {
  const session = sessions.get(key);
  if (session) {
    session.generation++;
  }
  sessions.delete(key);
}

export function decorateVolumeData(
  data: SpatialData,
  key: string,
  session: VolumeSession
): SpatialData {
  data.metadata = {
    ...data.metadata,
    volumeSessionId: key,
    volumeHistogram: session.histogram.bins,
    volumeRange: { min: session.histogram.min, max: session.histogram.max },
    volumeRenderMode: session.options.renderMode,
    windowCenter: session.options.windowCenter,
    windowWidth: session.options.windowWidth,
    meshExtractionStep: session.options.step,
    sliceIndices: session.options.sliceIndices,
    photometricInterpretation: session.volume.header['photometric interpretation'],
  };
  return data;
}

export async function reextractVolume(
  key: string,
  webviewPanel: vscode.WebviewPanel,
  message: any
): Promise<void> {
  const session = sessions.get(key);
  if (!session) {
    void webviewPanel.webview.postMessage({
      type: 'volume:error',
      sessionId: key,
      requestId: message.requestId,
      error: 'The source volume is no longer retained. Reopen the document and try again.',
    });
    return;
  }

  const generation = ++session.generation;
  const range = session.histogram;
  const threshold = Math.max(
    range.min,
    Math.min(range.max, Number(message.threshold ?? session.options.threshold))
  );
  const incomingStep = Array.isArray(message.step) ? message.step : session.options.step;
  const step = incomingStep.map((value: unknown, axis: number) =>
    Math.max(1, Math.min(session.volume.sizes[axis] - 1, Math.floor(Number(value) || 1)))
  ) as [number, number, number];
  const renderMode: VolumeRenderMode =
    message.renderMode === 'mesh' || message.renderMode === 'surface'
      ? 'mesh'
      : message.renderMode === 'slices'
        ? 'slices'
        : 'points';
  const windowCenter = Number.isFinite(Number(message.windowCenter))
    ? Number(message.windowCenter)
    : session.options.windowCenter;
  const windowWidth = Math.max(
    Number.EPSILON,
    Number.isFinite(Number(message.windowWidth))
      ? Number(message.windowWidth)
      : session.options.windowWidth
  );
  const incomingSlices = Array.isArray(message.sliceIndices)
    ? message.sliceIndices
    : session.options.sliceIndices;
  const sliceIndices = incomingSlices.map((value: unknown, axis: number) =>
    Math.max(0, Math.min(session.volume.sizes[axis] - 1, Math.round(Number(value) || 0)))
  ) as [number, number, number];
  session.options = {
    threshold,
    step,
    renderMode,
    windowCenter,
    windowWidth,
    sliceIndices,
  };

  let lastProgress = -1;
  const onProgress = (fraction: number) => {
    const percent = Math.floor(fraction * 100);
    if (percent < lastProgress + 5 && percent !== 100) {
      return;
    }
    lastProgress = percent;
    void webviewPanel.webview.postMessage({
      type: 'volume:progress',
      sessionId: key,
      requestId: message.requestId,
      fraction,
    });
  };

  try {
    // Yield once so the progress state paints before the CPU-heavy extraction.
    await new Promise<void>(resolve => setImmediate(resolve));
    if (generation !== session.generation) {
      return;
    }
    const result =
      renderMode === 'slices'
        ? await buildVolumeSlicesAsync(
            session.volume,
            { windowCenter, windowWidth, slices: sliceIndices, onProgress },
            () => generation !== session.generation
          )
        : renderMode === 'points'
          ? await buildVolumePointsAsync(
              session.volume,
              {
                threshold,
                step: [1, 1, 1],
                windowCenter,
                windowWidth,
                onProgress,
              },
              () => generation !== session.generation
            )
          : await buildVolumeMeshAsync(
              session.volume,
              { threshold, step, onProgress },
              () => generation !== session.generation
            );
    if (!result || generation !== session.generation) {
      return;
    }
    const data = result.data;
    decorateVolumeData(data, key, session);
    const delivered = await webviewPanel.webview.postMessage({
      type: 'volumeData',
      fileName: session.volume.fileName,
      data,
      replaceFileIndex: message.fileIndex,
      requestId: message.requestId,
    });
    if (!delivered) {
      throw new Error('The viewer rejected the extracted volume geometry.');
    }
  } catch (error) {
    if (generation !== session.generation) {
      return;
    }
    const errorMessage = error instanceof Error ? error.message : String(error);
    const delivered = await webviewPanel.webview.postMessage({
      type: 'volume:error',
      sessionId: key,
      requestId: message.requestId,
      error: errorMessage,
    });
    if (!delivered) {
      void vscode.window.showErrorMessage(`Volume update failed: ${errorMessage}`);
    }
  }
}
