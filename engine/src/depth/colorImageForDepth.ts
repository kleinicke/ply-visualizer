import {
  replaceSpatialGeometry,
  type GeometryReplacementHost,
} from '../visualization/replaceSpatialGeometry';
import type { EntryRequest } from '../hosts/viewerProtocol';
import type { FileEntryRegistry } from '../state/fileEntries';
import { CameraParams, DepthBytes, DepthConversionResult, SpatialData } from '../interfaces';
import { applyDepthResultTypedArrays } from './depthResultArrays';
import { ColorImageLoader } from '../colorImageLoader';

export interface ColorImageForDepthHost extends GeometryReplacementHost {
  vscode: { postMessage(message: any): void };
  pendingDepthFiles: Map<string, { sceneMetadata?: any }>;
  colorImageLoader: ColorImageLoader;
  needsRender: boolean;
  processDepthToPointCloud(
    depthData: ArrayBuffer | DepthBytes,
    fileName: string,
    cameraParams: CameraParams,
    colorImageData?: ImageData,
    signal?: AbortSignal
  ): Promise<DepthConversionResult>;
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
    const depthData = host.fileEntries.at(fileIndex)?.spatial?.data.depthSource;
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
    const cameraParams = { ...depthData.cameraParams };
    const result = await host.processDepthToPointCloud(
      depthData.originalData,
      depthData.fileName,
      cameraParams,
      imageData,
      signal
    );

    fileIndex = host.fileEntries.indexOf(entry.id);
    if (fileIndex < 0 || entry.depthUpdate.version !== version) {
      return;
    }
    const spatialData: SpatialData = {
      ...entry.spatial!.data,
      depthSource: {
        ...depthData,
        cameraParams,
        colorImageData: imageData,
        colorImageName: message.fileName,
      },
    };
    applyDepthResultTypedArrays(spatialData, result);
    replaceSpatialGeometry(host, entry, spatialData, fileIndex);

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
  const depthData = host.fileEntries.at(fileIndex)?.spatial?.data.depthSource;
  return depthData?.colorImageName || null;
}

export function getImageSizeDisplay(host: ColorImageForDepthHost, fileIndex: number): string {
  const depthData = host.fileEntries.at(fileIndex)?.spatial?.data.depthSource;
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
    const depthData = host.fileEntries.at(fileIndex)?.spatial?.data.depthSource;
    if (!depthData) {
      throw new Error('No cached Depth data found for this file');
    }

    host.showStatus('Removing color image and reverting to default colors...');

    // Reprocess depth image without color data (will use default grayscale colors)
    const cameraParams = { ...depthData.cameraParams };
    const result = await host.processDepthToPointCloud(
      depthData.originalData,
      depthData.fileName,
      cameraParams,
      undefined,
      signal
    );

    fileIndex = host.fileEntries.indexOf(entry.id);
    if (fileIndex < 0 || entry.depthUpdate.version !== version) {
      return;
    }
    const source = { ...depthData, cameraParams };
    delete source.colorImageData;
    delete source.colorImageName;
    const spatialData: SpatialData = { ...entry.spatial!.data, depthSource: source };
    applyDepthResultTypedArrays(spatialData, result);
    replaceSpatialGeometry(host, entry, spatialData, fileIndex);
    host.needsRender = true;

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
