import * as THREE from 'three';
import { CameraParams, DepthConversionResult, SpatialData } from '../interfaces';
import { applyDepthResultTypedArrays } from './depthResultArrays';

export interface LiveDepthUpdateHost {
  liveDepthUpdateFiles: Set<number>;
  liveDepthUpdateInFlight: Set<number>;
  liveDepthUpdateQueued: Set<number>;
  liveDepthUpdateTimers: Map<number, number>;
  liveDepthUpdateVersions: Map<number, number>;
  fileDepthData: Map<
    number,
    {
      originalData: ArrayBuffer;
      fileName: string;
      cameraParams: CameraParams;
      depthDimensions: { width: number; height: number };
      colorImageData?: any;
      colorImageName?: string;
    }
  >;
  spatialFiles: SpatialData[];
  meshes: (THREE.Mesh | THREE.Points | THREE.LineSegments)[];
  individualColorModes: string[];
  pointSizes: number[];
  scene: THREE.Scene;
  getDepthSettingsFromFileUI(fileIndex: number): CameraParams;
  processDepthToPointCloud(
    depthData: ArrayBuffer,
    fileName: string,
    cameraParams: CameraParams,
    colorImageData?: any
  ): Promise<DepthConversionResult>;
  createMaterialForFile(data: SpatialData, fileIndex: number): THREE.Material;
  createGeometryFromSpatialData(data: SpatialData): THREE.BufferGeometry;
  performRender(): void;
  updateFileStats(): void;
  showStatus(message: string): void;
  showError(message: string): void;
}

export function setLiveDepthUpdateEnabled(
  host: LiveDepthUpdateHost,
  fileIndex: number,
  enabled: boolean
): void {
  if (enabled) {
    host.liveDepthUpdateFiles.add(fileIndex);
  } else {
    host.liveDepthUpdateFiles.delete(fileIndex);
    host.liveDepthUpdateQueued.delete(fileIndex);
    host.liveDepthUpdateVersions.delete(fileIndex);
    const timer = host.liveDepthUpdateTimers.get(fileIndex);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      host.liveDepthUpdateTimers.delete(fileIndex);
    }
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
  if (!host.liveDepthUpdateFiles.has(fileIndex)) {
    return;
  }

  const nextVersion = (host.liveDepthUpdateVersions.get(fileIndex) || 0) + 1;
  host.liveDepthUpdateVersions.set(fileIndex, nextVersion);

  const existing = host.liveDepthUpdateTimers.get(fileIndex);
  if (existing !== undefined) {
    window.clearTimeout(existing);
  }

  const timer = window.setTimeout(() => {
    host.liveDepthUpdateTimers.delete(fileIndex);
    void requestLiveDepthUpdate(host, fileIndex);
  }, delayMs);
  host.liveDepthUpdateTimers.set(fileIndex, timer);
}

export async function requestLiveDepthUpdate(
  host: LiveDepthUpdateHost,
  fileIndex: number
): Promise<void> {
  if (!host.liveDepthUpdateFiles.has(fileIndex)) {
    return;
  }

  if (host.liveDepthUpdateInFlight.has(fileIndex)) {
    host.liveDepthUpdateQueued.add(fileIndex);
    return;
  }

  host.liveDepthUpdateInFlight.add(fileIndex);
  const version = host.liveDepthUpdateVersions.get(fileIndex) || 0;
  try {
    await applyDepthSettings(host, fileIndex, version);
  } finally {
    host.liveDepthUpdateInFlight.delete(fileIndex);
    if (host.liveDepthUpdateQueued.delete(fileIndex) && host.liveDepthUpdateFiles.has(fileIndex)) {
      scheduleLiveDepthUpdate(host, fileIndex, 0);
    }
  }
}

export function isLiveDepthResultCurrent(
  host: LiveDepthUpdateHost,
  fileIndex: number,
  version?: number
): boolean {
  return version === undefined || host.liveDepthUpdateVersions.get(fileIndex) === version;
}

export function waitForNextFrame(): Promise<void> {
  return new Promise(resolve => {
    window.requestAnimationFrame(() => resolve());
  });
}

export async function applyDepthSettings(
  host: LiveDepthUpdateHost,
  fileIndex: number,
  liveVersion?: number
): Promise<void> {
  try {
    // Get the current values from the form using the helper method
    const newCameraParams = host.getDepthSettingsFromFileUI(fileIndex);

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
    const depthData = host.fileDepthData.get(fileIndex);
    if (!depthData) {
      throw new Error('No cached depth data found for this file. Please reload the depth file.');
    }

    const isPfm = /\.pfm$/i.test(depthData.fileName);
    const isNpy = /\.(npy|npz)$/i.test(depthData.fileName);
    const isPng = /\.png$/i.test(depthData.fileName);
    const fileType = isPfm ? 'PFM' : isNpy ? 'NPY' : isPng ? 'PNG' : 'TIF';
    host.showStatus(`Reprocessing ${fileType} with new settings...`);

    // Process the depth data with new parameters using the new system
    const result = await host.processDepthToPointCloud(
      depthData.originalData,
      depthData.fileName,
      newCameraParams,
      depthData.colorImageData
    );
    if (!isLiveDepthResultCurrent(host, fileIndex, liveVersion)) {
      return;
    }

    await waitForNextFrame();
    if (!isLiveDepthResultCurrent(host, fileIndex, liveVersion)) {
      return;
    }

    // Update the stored camera parameters with the processed values (cx/cy might have been updated)
    depthData.cameraParams = newCameraParams;

    if (depthData.colorImageData) {
      console.log(
        `🎨 Reapplying stored color image: ${depthData.colorImageName}\n🎯 Using updated camera params: cx=${newCameraParams.cx}, cy=${newCameraParams.cy}`
      );
    }

    // Update the PLY data
    const spatialData = host.spatialFiles[fileIndex];
    applyDepthResultTypedArrays(spatialData, result);
    // Mark as depth-derived so gamma correction knows these are already linear colors
    (spatialData as any).isDepthDerived = true;
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

    // Update cached parameters
    depthData.cameraParams = newCameraParams;

    // Update the mesh with new data
    const oldMaterial = host.meshes[fileIndex].material;
    const colorMode = host.individualColorModes[fileIndex] || 'assigned';
    console.log(
      `🎨 Depth settings apply - fileIndex: ${fileIndex}, hasColors: ${spatialData.hasColors}, colorMode: ${colorMode}, vertexCount: ${spatialData.vertexCount}`
    );
    const newMaterial = host.createMaterialForFile(spatialData, fileIndex);
    host.meshes[fileIndex].material = newMaterial;

    // Ensure point size is correctly applied to the new material
    if (
      host.meshes[fileIndex] instanceof THREE.Points &&
      newMaterial instanceof THREE.PointsMaterial
    ) {
      const currentPointSize = host.pointSizes[fileIndex] || 0.001;
      newMaterial.size = currentPointSize;
      console.log(
        `🔧 Applied point size ${currentPointSize} to updated ${fileType} material for file ${fileIndex}`
      );
    }

    // Replace the mesh so Three.js uploads the returned typed arrays cleanly.
    const oldMesh = host.meshes[fileIndex];
    host.scene.remove(oldMesh);

    if (oldMesh.geometry) {
      oldMesh.geometry.dispose();
    }

    const geometry = host.createGeometryFromSpatialData(spatialData);
    const newMesh = new THREE.Points(geometry, newMaterial);

    newMesh.matrix.copy(oldMesh.matrix);
    newMesh.matrixAutoUpdate = oldMesh.matrixAutoUpdate;

    host.meshes[fileIndex] = newMesh;
    host.scene.add(newMesh);

    host.performRender();

    // Dispose old material
    if (oldMaterial) {
      if (Array.isArray(oldMaterial)) {
        oldMaterial.forEach(mat => mat.dispose());
      } else {
        oldMaterial.dispose();
      }
    }

    // Update UI
    host.updateFileStats();
    host.showStatus(`${fileType} settings applied successfully!`);
  } catch (error) {
    console.error(`Error applying depth settings:`, error);
    host.showError(
      `Failed to apply depth settings: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
