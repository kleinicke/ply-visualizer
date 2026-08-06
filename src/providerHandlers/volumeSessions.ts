import * as vscode from 'vscode';
import type { SpatialData } from '../../engine/src/interfaces';
import type { VolumeData } from '../../engine/src/parsers/nrrdParser';
import {
  buildVolumeMeshAsync,
  defaultThreshold,
  volumeHistogram,
} from '../../engine/src/visualization/isosurface';
import { chooseStep } from '../../engine/src/visualization/marchingCubes';
import { buildVolumePointsAsync } from '../../engine/src/visualization/volumePoints';

export type VolumeRenderMode = 'surface' | 'points';

export interface VolumeExtractionOptions {
  threshold: number;
  step: [number, number, number];
  renderMode: VolumeRenderMode;
}

export interface VolumeSession {
  volume: VolumeData;
  options: VolumeExtractionOptions;
  histogram: { min: number; max: number; bins: number[] };
  generation: number;
}

const sessions = new Map<string, VolumeSession>();

export function retainVolume(key: string, volume: VolumeData): VolumeSession {
  const session: VolumeSession = {
    volume,
    options: {
      threshold: defaultThreshold(volume),
      step: chooseStep(volume.sizes, volume.ijkToWorld),
      renderMode: 'surface',
    },
    histogram: volumeHistogram(volume),
    generation: 0,
  };
  sessions.set(key, session);
  return session;
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
  const renderMode: VolumeRenderMode = message.renderMode === 'points' ? 'points' : 'surface';
  session.options = { threshold, step, renderMode };

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
      renderMode === 'points'
        ? await buildVolumePointsAsync(
            session.volume,
            { threshold, step, onProgress },
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
    void webviewPanel.webview.postMessage({
      type: 'volumeData',
      fileName: session.volume.fileName,
      data,
      replaceFileIndex: message.fileIndex,
      requestId: message.requestId,
    });
  } catch (error) {
    if (generation !== session.generation) {
      return;
    }
    void webviewPanel.webview.postMessage({
      type: 'volume:error',
      sessionId: key,
      requestId: message.requestId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
