import {
  replaceSpatialGeometry,
  type GeometryReplacementHost,
} from '../visualization/replaceSpatialGeometry';
import type { FileEntryRegistry } from '../state/fileEntries';
import { CameraParams, DepthBytes, DepthConversionResult, SpatialData } from '../interfaces';
import { applyDepthResultTypedArrays } from './depthResultArrays';
import { runWithFileActivity } from '../fileActivity';
import { PerfTimer } from '../utils/perfLog';

export interface LiveDepthUpdateHost extends GeometryReplacementHost {
  smallViewAffordance?: { notifyGeometryReplaced(): void };
  getDepthSettings(fileIndex: number): CameraParams;
  processDepthToPointCloud(
    depthData: ArrayBuffer | DepthBytes,
    fileName: string,
    cameraParams: CameraParams,
    colorImageData?: ImageData,
    signal?: AbortSignal
  ): Promise<DepthConversionResult>;
  performRender(): void;
  updateFileStats(): void;
  showStatus(message: string): void;
  showError(message: string): void;
  fileEntries: FileEntryRegistry;
}

export function setLiveDepthUpdateEnabled(
  host: LiveDepthUpdateHost,
  fileIndex: number,
  enabled: boolean
): void {
  const entry = host.fileEntries.require(fileIndex);
  entry.state.liveDepth = enabled;
  if (!enabled) {
    entry.cancelDepthWork();
  }

  const applyButton = document.querySelector(
    `.apply-depth-settings[data-file-index="${fileIndex}"]`
  ) as HTMLButtonElement | null;
  if (applyButton) {
    applyButton.style.display = enabled ? 'none' : '';
  }
}

export function isDepthCommitTarget(
  target: EventTarget | null
): target is HTMLInputElement | HTMLSelectElement {
  if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) {
    return false;
  }
  return !target.classList.contains('live-depth-update');
}

export function scheduleLiveDepthUpdate(
  host: LiveDepthUpdateHost,
  fileIndex: number,
  delayMs: number = 60
): void {
  const entry = host.fileEntries.require(fileIndex);
  if (!entry.state.liveDepth) {
    return;
  }
  entry.cancelDepthWork();
  entry.depthUpdate.timer = window.setTimeout(() => {
    entry.depthUpdate.timer = undefined;
    const index = host.fileEntries.indexOf(entry.id);
    if (index >= 0) {
      void requestLiveDepthUpdate(host, index);
    }
  }, delayMs);
}

export async function requestLiveDepthUpdate(
  host: LiveDepthUpdateHost,
  fileIndex: number
): Promise<void> {
  const entry = host.fileEntries.require(fileIndex);
  if (!entry.state.liveDepth) {
    return;
  }
  const work = entry.depthUpdate;
  if (work.inFlight) {
    work.queued = true;
    return;
  }
  work.inFlight = true;
  try {
    await applyDepthSettings(host, fileIndex, work.version);
  } finally {
    work.inFlight = false;
    const index = host.fileEntries.indexOf(entry.id);
    if (work.queued && entry.state.liveDepth && index >= 0) {
      work.queued = false;
      scheduleLiveDepthUpdate(host, index, 0);
    }
  }
}

export function waitForNextFrame(): Promise<void> {
  return new Promise(resolve => {
    window.requestAnimationFrame(() => resolve());
  });
}

/**
 * Re-run one depth file's conversion and swap its geometry in.
 *
 * Everything expensive that *can* be off the main thread already is — the
 * decode and projection run in the depth worker. What is left has to be on the
 * main thread because it touches the WebGL context, so the goal is not "no
 * blocking" but "no blocking the user cannot see coming and no single block
 * long enough to swallow input": the busy dot is raised and painted first, and
 * the remaining work is broken at frame boundaries so the panel keeps
 * responding between chunks rather than locking up for the whole update.
 */
export async function applyDepthSettings(
  host: LiveDepthUpdateHost,
  fileIndex: number,
  liveVersion?: number
): Promise<void> {
  const entry = host.fileEntries.at(fileIndex);
  if (!entry) {
    return;
  }
  await runWithFileActivity(() => {
    const currentIndex = host.fileEntries.indexOf(entry.id);
    return currentIndex < 0
      ? Promise.resolve()
      : applyDepthSettingsInner(host, currentIndex, liveVersion);
  });
}

async function applyDepthSettingsInner(
  host: LiveDepthUpdateHost,
  fileIndex: number,
  liveVersion?: number
): Promise<void> {
  const entry = host.fileEntries.require(fileIndex);
  if (liveVersion !== undefined && liveVersion !== entry.depthUpdate.version) {
    return;
  }
  const signal = entry.beginDepthWork();
  const version = entry.depthUpdate.version;
  const current = () => {
    fileIndex = host.fileEntries.indexOf(entry.id);
    return fileIndex >= 0 && entry.depthUpdate.version === version && !signal.aborted;
  };
  const perf = new PerfTimer('depth/reapply');
  try {
    // Get the current values from the form using the helper method
    const newCameraParams = host.getDepthSettings(fileIndex);

    // DEBUG: Log what we read from the form
    console.log(
      `🔍 APPLY SETTINGS DEBUG for file ${fileIndex}:\n  Form read values: ${JSON.stringify(newCameraParams, null, 2)}\n  depthType specifically: ${newCameraParams.depthType}\n  baseline specifically: ${newCameraParams.baseline}`
    );

    // Validate parameters
    if (!newCameraParams.fx || newCameraParams.fx <= 0) {
      throw new Error('fx (focal length x) must be a positive number');
    }
    if (
      newCameraParams.depthType === 'disparity' &&
      (!newCameraParams.baseline || newCameraParams.baseline <= 0)
    ) {
      throw new Error('Baseline must be a positive number for disparity mode');
    }
    if (
      newCameraParams.pngScaleFactor !== undefined &&
      (!newCameraParams.pngScaleFactor || newCameraParams.pngScaleFactor <= 0)
    ) {
      throw new Error('Scale factor must be a positive number for PNG files');
    }

    // Check if we have cached depth data for this file
    const depthData = entry.spatial?.data.depthSource;
    if (!depthData) {
      throw new Error('No cached depth data found for this file. Please reload the depth file.');
    }

    const isPfm = /\.pfm$/i.test(depthData.fileName);
    const isNpy = /\.(npy|npz)$/i.test(depthData.fileName);
    const isPng = /\.png$/i.test(depthData.fileName);
    const fileType = isPfm ? 'PFM' : isNpy ? 'NPY' : isPng ? 'PNG' : 'TIF';
    host.showStatus(`Reprocessing ${fileType} with new settings...`);

    // Process the depth data with new parameters using the new system
    perf.file(depthData.fileName);
    perf.mark('read-form');
    const result = await host.processDepthToPointCloud(
      depthData.originalData,
      depthData.fileName,
      newCameraParams,
      depthData.colorImageData,
      signal
    );
    perf.mark('worker');
    const timings = result.timings;
    if (timings) {
      perf.note(timings.decodeCached ? 'decode(cached)' : 'decode', timings.decodeMs.toFixed(0));
      perf.note('project', timings.projectMs.toFixed(0));
      if (timings.thread) {
        perf.note('on', `${timings.thread}${timings.bands ? `/${timings.bands} bands` : ''}`);
      }
      if (timings.phases) {
        perf.note('stages', timings.phases);
      }
    }
    if (!current()) {
      return;
    }

    await waitForNextFrame();
    if (!current()) {
      return;
    }

    const spatialData: SpatialData = {
      ...entry.spatial!.data,
      depthSource: { ...depthData, cameraParams: newCameraParams },
    };
    applyDepthResultTypedArrays(spatialData, result);
    const comments: string[] = [
      `Converted from ${fileType} depth image: ${depthData.fileName}`,
      `Camera: ${newCameraParams.cameraModel}`,
      `Depth type: ${newCameraParams.depthType}`,
      `fx: ${newCameraParams.fx}px${newCameraParams.fy ? `, fy: ${newCameraParams.fy}px` : ''}`,
      ...(newCameraParams.baseline ? [`Baseline: ${newCameraParams.baseline}mm`] : []),
    ];

    // Add RGB24-specific settings if this is an RGB image
    if (fileType === 'PNG' && newCameraParams.rgb24ScaleFactor) {
      comments.push(`RGB24 depth image`);
      comments.push(`rgb24Scale=${newCameraParams.rgb24ScaleFactor}`);
      comments.push(`rgb24Mode=${newCameraParams.rgb24ConversionMode || 'shift'}`);
    }

    spatialData.comments = comments;

    perf.mark('arrays');
    replaceSpatialGeometry(host, entry, spatialData, fileIndex);

    perf.mark('geometry');
    // The cloud may have landed somewhere else entirely; let the fit prompt
    // treat "not on screen at all" as small until the user moves the camera.
    host.smallViewAffordance?.notifyGeometryReplaced();
    host.performRender();
    perf.mark('render');

    // Update UI
    host.updateFileStats();
    host.showStatus(`${fileType} settings applied successfully!`);
    perf.note('verts', spatialData.vertexCount ?? 0);
    perf.summary();
  } catch (error) {
    if (signal.aborted) {
      return;
    }
    console.error(`Error applying depth settings:`, error);
    host.showError(
      `Failed to apply depth settings: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
