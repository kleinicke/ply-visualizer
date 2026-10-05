import type { EntryRequest } from '../hosts/viewerProtocol';
import type { FileEntryRegistry } from '../state/fileEntries';
import * as THREE from 'three';
import { CameraParams, DepthConversionResult, SpatialData } from '../interfaces';
import { applyDepthResultTypedArrays } from './depthResultArrays';
import { ColorImageLoader } from '../colorImageLoader';

export interface ColorImageForDepthHost {
  vscode: { postMessage(message: any): void };
  pendingDepthFiles: Map<string, { sceneMetadata?: any }>;
  spatialFiles: SpatialData[];
  meshes: (THREE.Mesh | THREE.Points | THREE.LineSegments)[];
  colorImageLoader: ColorImageLoader;
  needsRender: boolean;
  processDepthToPointCloud(
    depthData: ArrayBuffer,
    fileName: string,
    cameraParams: CameraParams,
    colorImageData?: ImageData,
    signal?: AbortSignal
  ): Promise<DepthConversionResult>;
  createMaterialForFile(data: SpatialData, fileIndex: number): THREE.Material;
  createGeometryFromSpatialData(data: SpatialData): THREE.BufferGeometry;
  updateFileStats(): void;
  updateFileList(): void;
  showStatus(message: string): void;
  showError(message: string): void;
  fileEntries: FileEntryRegistry;
}

export function requestColorImageForDepth(host: ColorImageForDepthHost, fileIndex: number): void {
  host.vscode.postMessage({
    type: 'selectColorImage',
    fileIndex: fileIndex,
    entryId: host.fileEntries.require(fileIndex).id,
  } satisfies EntryRequest);
}

export async function handleColorImageData(
  host: ColorImageForDepthHost,
  message: any
): Promise<void> {
  try {
    console.log('Received color image data for file index:', message.fileIndex);

    // Convert the ArrayBuffer back to a File-like object for processing
    const blob = new Blob([message.data], { type: message.mimeType || 'image/png' });
    const file = new File([blob], message.fileName, { type: message.mimeType || 'image/png' });

    // Get depth data first to access dimensions
    let fileIndex = message.fileIndex;
    const entry = host.fileEntries.require(fileIndex);
    const signal = entry.beginDepthWork();
    const version = entry.depthUpdate.version;
    const depthData = host.spatialFiles[fileIndex]?.depthSource;
    if (!depthData) {
      throw new Error('No cached depth data found for this file');
    }

    // Load and validate the color image using ColorImageLoader
    const imageData = await host.colorImageLoader.loadAndValidate(file, depthData.depthDimensions);

    fileIndex = host.fileEntries.indexOf(entry.id);
    if (fileIndex < 0 || entry.depthUpdate.version !== version) {
      return;
    }
    if (!imageData) {
      return; // Error already shown by ColorImageLoader
    }

    // Reprocess depth image with color data
    const result = await host.processDepthToPointCloud(
      depthData.originalData,
      depthData.fileName,
      depthData.cameraParams,
      imageData,
      signal
    );

    fileIndex = host.fileEntries.indexOf(entry.id);
    if (fileIndex < 0 || entry.depthUpdate.version !== version) {
      return;
    }
    depthData.colorImageData = imageData;
    depthData.colorImageName = message.fileName;

    // Update the PLY data
    const spatialData = host.spatialFiles[fileIndex];
    applyDepthResultTypedArrays(spatialData, result);
    // Mark as depth-derived so gamma correction knows these are already linear colors
    (spatialData as any).isDepthDerived = true;

    // Update the mesh with colored data
    const oldMaterial = host.meshes[fileIndex].material;
    const newMaterial = host.createMaterialForFile(spatialData, fileIndex);
    host.meshes[fileIndex].material = newMaterial;

    // Ensure point size is correctly applied to the new material
    if (
      host.meshes[fileIndex] instanceof THREE.Points &&
      newMaterial instanceof THREE.PointsMaterial
    ) {
      const currentPointSize = host.fileEntries.require(fileIndex).state.pointSize || 0.001;
      newMaterial.size = currentPointSize;
      console.log(
        `🔧 Applied point size ${currentPointSize} to color-updated depth material for file ${fileIndex}`
      );
    }

    const mesh = host.meshes[fileIndex] as THREE.Points;
    const oldGeometry = mesh.geometry;
    mesh.geometry = host.createGeometryFromSpatialData(spatialData);
    oldGeometry.dispose();

    // Dispose old material
    if (oldMaterial) {
      if (Array.isArray(oldMaterial)) {
        oldMaterial.forEach(mat => mat.dispose());
      } else {
        oldMaterial.dispose();
      }
    }

    // Trigger re-render to display the updated colors
    host.needsRender = true;

    // Refresh entry data in the file list
    host.updateFileStats();
    host.updateFileList();
    host.showStatus(`Color image "${message.fileName}" applied successfully!`);

    // Check if this is part of a dataset workflow
    const pendingFiles = Array.from(host.pendingDepthFiles.values());
    const datasetFile = pendingFiles.find(f => f.sceneMetadata && f.sceneMetadata.isDatasetScene);

    if (datasetFile && datasetFile.sceneMetadata) {
      console.log(
        `🎯 Dataset workflow complete - all files loaded for ${datasetFile.sceneMetadata.sceneName}`
      );
      host.showStatus(
        `✅ Dataset workflow complete for ${datasetFile.sceneMetadata.sceneName} - ready to apply!`
      );
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return;
    }
    console.error('Error handling color image data:', error);
    host.showError(
      `Failed to apply color image: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export function getStoredColorImageName(
  host: ColorImageForDepthHost,
  fileIndex: number
): string | null {
  const depthData = host.spatialFiles[fileIndex]?.depthSource;
  return depthData?.colorImageName || null;
}

export function getImageSizeDisplay(host: ColorImageForDepthHost, fileIndex: number): string {
  const depthData = host.spatialFiles[fileIndex]?.depthSource;
  if (depthData?.depthDimensions) {
    const { width, height } = depthData.depthDimensions;
    return `Image Size: Width: ${width}, Height: ${height}`;
  }
  return 'Image Size: Width: -, Height: -';
}

export async function removeColorImageFromDepth(
  host: ColorImageForDepthHost,
  fileIndex: number
): Promise<void> {
  const entry = host.fileEntries.require(fileIndex);
  const signal = entry.beginDepthWork();
  const version = entry.depthUpdate.version;
  try {
    const depthData = host.spatialFiles[fileIndex]?.depthSource;
    if (!depthData) {
      throw new Error('No cached Depth data found for this file');
    }

    host.showStatus('Removing color image and reverting to default colors...');

    // Reprocess depth image without color data (will use default grayscale colors)
    const result = await host.processDepthToPointCloud(
      depthData.originalData,
      depthData.fileName,
      depthData.cameraParams,
      undefined,
      signal
    );

    fileIndex = host.fileEntries.indexOf(entry.id);
    if (fileIndex < 0 || entry.depthUpdate.version !== version) {
      return;
    }
    delete depthData.colorImageData;
    delete depthData.colorImageName;

    // Update the PLY data
    const spatialData = host.spatialFiles[fileIndex];
    applyDepthResultTypedArrays(spatialData, result);
    // Mark as depth-derived so gamma correction knows these are already linear colors
    (spatialData as any).isDepthDerived = true;

    // Update the mesh with default colors
    const oldMaterial = host.meshes[fileIndex].material;
    const newMaterial = host.createMaterialForFile(spatialData, fileIndex);
    host.meshes[fileIndex].material = newMaterial;

    // Ensure point size is correctly applied to the new material
    if (
      host.meshes[fileIndex] instanceof THREE.Points &&
      newMaterial instanceof THREE.PointsMaterial
    ) {
      const currentPointSize = host.fileEntries.require(fileIndex).state.pointSize || 0.001;
      newMaterial.size = currentPointSize;
      console.log(
        `🔧 Applied point size ${currentPointSize} to default-color Depth material for file ${fileIndex}`
      );
    }

    const mesh = host.meshes[fileIndex] as THREE.Points;
    const oldGeometry = mesh.geometry;
    mesh.geometry = host.createGeometryFromSpatialData(spatialData);
    oldGeometry.dispose();

    // Dispose old material
    if (oldMaterial) {
      if (Array.isArray(oldMaterial)) {
        oldMaterial.forEach(mat => mat.dispose());
      } else {
        oldMaterial.dispose();
      }
    }

    // Refresh entry data in the file list
    host.updateFileStats();
    host.updateFileList();
    host.showStatus('Color image removed - reverted to default depth-based colors');
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return;
    }
    console.error('Error removing color image:', error);
    host.showError(
      `Failed to remove color image: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
