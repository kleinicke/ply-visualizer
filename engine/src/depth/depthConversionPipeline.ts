import { CameraParams, DepthConversionResult, SpatialData } from '../interfaces';
import { PerfTimer } from '../utils/perfLog';
import { colorsToUint8 } from './depthResultArrays';
import {
  collectCameraParamsForBrowserPrompt,
  generateDepthRequestId,
  shouldRequestDepthParams,
} from '../fileHandler';

declare const acquireVsCodeApi: () => any;
const isVSCode = typeof acquireVsCodeApi !== 'undefined';

export interface DepthConversionPipelineHost {
  pendingDepthFiles: Map<
    string,
    {
      data: ArrayBuffer;
      fileName: string;
      shortPath?: string;
      isAddFile: boolean;
      requestId: string;
      sceneMetadata?: any;
      /** Load epochs carried from the extension for the single PERF line. */
      loadStartedAt?: number;
      postedAt?: number;
      receivedAt?: number;
      byteLength?: number;
    }
  >;
  vscode: { postMessage(message: any): void };
  spatialFiles: SpatialData[];
  fileDepthData: Map<
    number,
    {
      originalData: ArrayBuffer;
      fileName: string;
      cameraParams: CameraParams;
      depthDimensions: { width: number; height: number };
    }
  >;
  datasetTextures: Map<
    string,
    { fileName: string; sceneName: string; data: ArrayBuffer; arrayBuffer: ArrayBuffer }
  >;
  defaultDepthSettings: CameraParams;
  originalDepthFileName: string | null;
  currentCameraParams: CameraParams | null;
  showStatus(message: string): void;
  showError(message: string): void;
  addNewFiles(newFiles: SpatialData[]): void;
  displayFiles(dataArray: SpatialData[]): Promise<void>;
  processDepthToPointCloud(
    depthData: ArrayBuffer,
    fileName: string,
    cameraParams: CameraParams,
    colorImageData?: any
  ): Promise<DepthConversionResult>;
  triggerDatasetCalibrationLoading(sceneMetadata: any): Promise<void>;
}

export async function handleDepthData(
  host: DepthConversionPipelineHost,
  message: any
): Promise<void> {
  try {
    console.log('Received depth data for processing:', message.fileName);

    // Generate unique request ID for this depth file using shared function
    const requestId = generateDepthRequestId();

    // Store depth data in the map, along with the load epochs so the PERF line
    // emitted after conversion can cover the whole load (extension read,
    // transfer, decode, projection, display) instead of just its own span.
    host.pendingDepthFiles.set(requestId, {
      data: message.data,
      fileName: message.fileName,
      shortPath: message.shortPath,
      isAddFile: message.isAddFile || false,
      requestId: requestId,
      loadStartedAt: message.loadStartedAt,
      postedAt: message.postedAt,
      receivedAt: Date.now(),
      byteLength: (message.data && message.data.byteLength) || 0,
    });

    // Check if this is a dataset scene - store metadata but let UI load normally
    if (message.sceneMetadata && message.sceneMetadata.isDatasetScene) {
      console.log(
        '🎯 Dataset scene detected - will auto-load calibration and image after UI loads...'
      );

      // Store dataset metadata for step-by-step processing
      host.pendingDepthFiles.get(requestId)!.sceneMetadata = message.sceneMetadata;

      console.log('📋 Will show depth UI normally, then auto-trigger calibration loading...');
      // Continue to normal depth handling to show UI
    }

    // Determine how to handle depth conversion based on environment
    // For dataset scenes, always use local UI to enable calibration auto-loading
    const isDatasetScene = message.sceneMetadata && message.sceneMetadata.isDatasetScene;
    const depthHandling = isDatasetScene ? 'local' : shouldRequestDepthParams(isVSCode);

    if (depthHandling === 'extension') {
      // Request camera parameters from VS Code extension
      console.log('🔄 Requesting camera parameters from VS Code extension...');
      host.vscode.postMessage({
        type: 'requestCameraParams',
        fileName: message.fileName,
        requestId: requestId,
      });
      return; // Exit early - extension will respond with camera params
    } else if (depthHandling === 'local') {
      // Show local UI to collect camera parameters
      console.log(
        isDatasetScene
          ? '📋 Showing local UI for dataset scene (enables auto-calibration)...'
          : '📋 Showing local camera parameter UI...'
      );
      showDepthConversionUI(host, message.fileName, requestId);
      return; // Exit early - UI will call processDepthWithParams when ready
    } else {
      // Use defaults immediately
      console.log('⚡ Using default camera parameters...');
      await processDepthWithDefaults(host, message.fileName, message.data, requestId);
      return; // Exit early - processing complete
    }
  } catch (error) {
    console.error('Error handling depth data:', error);
    // Clean up any pending depth files for this fileName
    for (const [id, fileData] of host.pendingDepthFiles.entries()) {
      if (fileData.fileName === message.fileName) {
        host.pendingDepthFiles.delete(id);
        break;
      }
    }
    host.showError(
      `Failed to process depth data: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Show depth conversion UI for local parameter collection
 */
export async function showDepthConversionUI(
  host: DepthConversionPipelineHost,
  fileName: string,
  requestId: string
): Promise<void> {
  console.log('📋 Showing depth conversion UI for:', fileName);

  const depthFileData = host.pendingDepthFiles.get(requestId);
  if (!depthFileData) {
    console.error('Depth file data not found for requestId:', requestId);
    host.showError('Depth file data not found for processing');
    return;
  }

  // Use shared prompt-based UI to collect camera parameters in browser mode
  (async () => {
    try {
      // Check if this is a dataset scene and trigger step-by-step loading
      if (depthFileData.sceneMetadata && depthFileData.sceneMetadata.isDatasetScene) {
        console.log('🎯 Dataset scene detected - starting step-by-step calibration loading...');

        // Trigger calibration loading after a short delay to let UI settle
        setTimeout(async () => {
          await host.triggerDatasetCalibrationLoading(depthFileData.sceneMetadata);
        }, 500);

        // Continue with normal UI flow - don't return early
      }

      // Probe image size to center cx/cy (quick path: read header via depth pipeline)
      // We don't have direct readers here; rely on defaults for cx/cy and let processing update
      const params = await collectCameraParamsForBrowserPrompt(
        1024,
        768,
        host.defaultDepthSettings
      );
      if (!params) {
        console.warn('Camera parameter collection cancelled, using defaults.');
        await processDepthWithDefaults(host, fileName, depthFileData.data, requestId);
        return;
      }
      await processDepthWithParams(host, requestId, params as any);
    } catch (e) {
      console.warn('Camera parameter prompt failed, using defaults:', e);
      await processDepthWithDefaults(host, fileName, depthFileData.data, requestId);
    }
  })();
}

/**
 * Process depth data using default camera parameters
 */
export async function processDepthWithDefaults(
  host: DepthConversionPipelineHost,
  fileName: string,
  data: ArrayBuffer,
  requestId: string
): Promise<void> {
  console.log('⚡ Processing depth with defaults for:', fileName);

  const isPng = /\.png$/i.test(fileName);

  // Create default camera parameters
  const defaultSettings: CameraParams = {
    cameraModel: host.defaultDepthSettings.cameraModel,
    fx: host.defaultDepthSettings.fx,
    fy: host.defaultDepthSettings.fy,
    cx: undefined, // Will be auto-calculated from image dimensions
    cy: undefined, // Will be auto-calculated from image dimensions
    depthType: host.defaultDepthSettings.depthType,
    baseline: host.defaultDepthSettings.baseline,
    convention: host.defaultDepthSettings.convention || 'opengl',
    pngScaleFactor: isPng ? host.defaultDepthSettings.pngScaleFactor || 1000 : undefined,
  };

  const fileTypeLabel = isPng
    ? 'PNG'
    : fileName.toLowerCase().endsWith('.pfm')
      ? 'PFM'
      : fileName.toLowerCase().match(/\.np[yz]$/)
        ? 'NPY'
        : 'TIF';
  const scaleInfo = isPng ? `, scale factor ${defaultSettings.pngScaleFactor}` : '';
  const fyInfo = defaultSettings.fy ? ` / fy=${defaultSettings.fy}` : '';
  host.showStatus(
    `Converting ${fileTypeLabel} depth image: ${defaultSettings.cameraModel} camera, fx=${defaultSettings.fx}${fyInfo}px, ${defaultSettings.depthType} depth${scaleInfo}...`
  );

  console.log('✅ Using default camera parameters:', defaultSettings);
  await processDepthWithParams(host, requestId, defaultSettings);
}

export async function processDepthWithParams(
  host: DepthConversionPipelineHost,
  requestId: string,
  cameraParams: CameraParams
): Promise<void> {
  const depthFileData = host.pendingDepthFiles.get(requestId);
  if (!depthFileData) {
    console.error('Depth file data not found for requestId:', requestId);
    return;
  }

  console.log('Processing depth with camera params:', cameraParams);
  host.showStatus('Converting depth image to point cloud...');

  // One PERF line for the whole load. Anchoring to the extension's epochs makes
  // read+parse and transfer part of the same total the user actually waited
  // for; `decode` and `project` come back from wherever the conversion ran.
  const perfKind = /\.(tif|tiff)$/i.test(depthFileData.fileName) ? 'tiff' : 'depth';
  const perf = new PerfTimer(
    perfKind,
    depthFileData.loadStartedAt,
    depthFileData.postedAt,
    depthFileData.receivedAt
  );
  perf.file(depthFileData.fileName);
  if (depthFileData.byteLength) {
    perf.note('MB', (depthFileData.byteLength / 1048576).toFixed(2));
  }

  // Time spent waiting for camera parameters (extension round-trip, or the user
  // filling in the depth dialog) is real wall-clock between receipt and here,
  // but it is not work. Shown as its own phase so the phases still sum to the
  // total instead of silently inflating `decode`.
  if (depthFileData.receivedAt) {
    perf.add('params', Date.now() - depthFileData.receivedAt);
  }

  // Store original data for re-processing
  host.originalDepthFileName = depthFileData.fileName;
  host.currentCameraParams = cameraParams;

  // Process the depth data using the new depth processing system
  const convertStart = performance.now();
  const result = await host.processDepthToPointCloud(
    depthFileData.data,
    depthFileData.fileName,
    cameraParams
  );
  const convertMs = performance.now() - convertStart;

  // Split the conversion span using the breakdown the converter reported, so
  // the decode cost is visible without a second log line. Whatever is left is
  // the worker round-trip (posting the file in, transferring arrays back).
  const timings = result.timings;
  if (timings) {
    perf.add(timings.decodeCached ? 'decode(cached)' : 'decode', timings.decodeMs);
    perf.add('project', timings.projectMs);
    const workerIo = convertMs - timings.decodeMs - timings.projectMs;
    if (workerIo > 0.5) {
      perf.add('worker-io', workerIo);
    }
    if (timings.info) {
      perf.note('layout', timings.info);
    }
  } else {
    perf.add('convert', convertMs);
  }

  const isPfm = /\.pfm$/i.test(depthFileData.fileName);
  const isNpy = /\.(npy|npz)$/i.test(depthFileData.fileName);
  const isPng = /\.png$/i.test(depthFileData.fileName);
  const fileType = isPfm ? 'PFM' : isNpy ? 'NPY' : isPng ? 'PNG' : 'TIF';

  // Store dimensions FIRST before creating spatial data
  const dimensions = {
    width: (result as any).width || 0,
    height: (result as any).height || 0,
  };

  // Typed-array fast path: the projector already produced Float32 position
  // and color arrays, so attach them directly (zero-copy) instead of
  // materializing N vertex objects and then rebuilding typed arrays inside
  // createGeometryFromSpatialData. The useTypedArrays geometry path expects
  // colors as Uint8 (0-255); convert once if the projector gave 0-1 floats.
  const colorsU8 = colorsToUint8(result.colors);
  perf.mark('build-colors');

  const spatialData: SpatialData = {
    vertices: [],
    faces: [],
    vertexCount: result.pointCount,
    hasColors: !!result.colors,
    hasNormals: false,
    faceCount: 0,
    fileName: depthFileData.fileName,
    shortPath: depthFileData.shortPath,
    fileIndex: depthFileData.isAddFile ? host.spatialFiles.length : 0,
    format: 'binary_little_endian',
    version: '1.0',
    comments: [
      `Converted from ${fileType} depth image: ${depthFileData.fileName}`,
      `Camera: ${cameraParams.cameraModel}`,
      `Depth type: ${cameraParams.depthType}`,
      `fx: ${cameraParams.fx}px${cameraParams.fy ? `, fy: ${cameraParams.fy}px` : ''}`,
      ...(cameraParams.baseline ? [`Baseline: ${cameraParams.baseline}mm`] : []),
      ...(cameraParams.pngScaleFactor
        ? [`Scale factor: scale=${cameraParams.pngScaleFactor}`]
        : []),
    ],
  };
  (spatialData as any).useTypedArrays = true;
  (spatialData as any).positionsArray = result.vertices;
  (spatialData as any).colorsArray = colorsU8;
  (spatialData as any).normalsArray = null;
  (spatialData as any).intensityArray = null;
  (spatialData as any).scalarFields = {};

  // Mark explicitly as depth-derived so the UI always shows the depth panel later
  (spatialData as any).isDepthDerived = true;
  // Attach dimensions so they're available when rendering UI
  (spatialData as any).depthDimensions = dimensions;

  console.log(`${fileType} to PLY conversion complete: ${result.pointCount} points`);

  // Check for dataset texture to apply
  if (depthFileData.sceneMetadata && depthFileData.sceneMetadata.isDatasetScene) {
    const sceneName = depthFileData.sceneMetadata.sceneName;
    const textureData = host.datasetTextures.get(sceneName);

    if (textureData) {
      console.log(`🖼️ Applying dataset texture ${textureData.fileName} to point cloud`);

      // Add texture info to spatial data
      (spatialData as any).datasetTexture = {
        fileName: textureData.fileName,
        data: textureData.arrayBuffer,
        sceneName: sceneName,
      };

      host.showStatus(
        `📷 Applied dataset texture: ${textureData.fileName} to ${depthFileData.fileName}`
      );
    }
  }

  // Cache the depth file data for later reprocessing BEFORE displaying
  // This ensures dimensions are available when the UI is rendered
  const fileIndex = spatialData.fileIndex || 0;
  host.fileDepthData.set(fileIndex, {
    originalData: depthFileData.data,
    fileName: depthFileData.fileName,
    cameraParams: cameraParams,
    depthDimensions: dimensions,
  });

  // Add to scene - dimensions are now available in spatialData and fileDepthData
  if (depthFileData.isAddFile) {
    host.addNewFiles([spatialData]);
  } else {
    await host.displayFiles([spatialData]);
  }
  perf.mark('geometry+display');
  perf.note('verts', result.pointCount);
  // The file name is already in the PERF[kind name] tag; no need to repeat it.
  perf.summary();

  // Auto-open Depth Settings panel for newly created depth-derived file in browser
  setTimeout(() => {
    try {
      const idx = spatialData.fileIndex || 0;
      const panel = document.getElementById(`depth-panel-${idx}`);
      const toggleBtn = document.querySelector(`.depth-settings-toggle[data-file-index="${idx}"]`);
      if (panel && toggleBtn) {
        panel.style.display = 'block';
        const icon = (toggleBtn as HTMLElement).querySelector('.toggle-icon');
        if (icon) {
          icon.textContent = '▼';
        }
      }
    } catch {}
  }, 0);

  // Clean up
  host.pendingDepthFiles.delete(requestId);
  host.showStatus(`${fileType} to point cloud conversion complete: ${result.pointCount} points`);
}
