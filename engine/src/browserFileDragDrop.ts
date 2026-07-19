import { CameraParams, SpatialData } from './interfaces';
import {
  BrowserMessageHandler,
  createBrowserFileHandler,
  detectFileTypeWithContent,
  FileError,
  processFiles,
  convertDepthToUnified,
} from './fileHandler';
import { parseLidarFile } from './parsers/lidarParser';
import { SPLAT_CONTAINER_REGEX } from './visualization/splatMode';

declare const acquireVsCodeApi: () => any;
const isVSCode = typeof acquireVsCodeApi !== 'undefined';

export interface BrowserFileDragDropHost {
  browserFileHandler: BrowserMessageHandler | null;
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
  showImmediateLoading(message: any): void;
  showError(message: string): void;
  removeFileByIndex(fileIndex: number): void;
  handleCameraParams(message: any): Promise<void>;
  promptForCameraParameters(fileName: string): Promise<CameraParams | null>;
  handleCameraProfile(data: any, fileName: string): void;
  handlePoseData(message: any): Promise<void>;
  displayFiles(dataArray: SpatialData[]): Promise<void>;
  updatePrinciplePointFields(fileIndex: number, dims: { width: number; height: number }): void;
  splatMode: {
    loadContainer(fileName: string, bytes: Uint8Array): Promise<SpatialData>;
  };
}

export function initializeBrowserFileHandler(host: BrowserFileDragDropHost): void {
  host.browserFileHandler = createBrowserFileHandler(
    (fileIndex: number) => host.removeFileByIndex(fileIndex),
    (message: any) => {
      // Route messages to the appropriate handlers
      switch (message.type) {
        case 'cameraParamsResult':
          host.handleCameraParams(message);
          break;
        case 'cameraParamsWithScaleResult':
          host.handleCameraParams(message);
          break;
        default:
          console.log(`🌐 Unhandled browser message: ${message.type}`);
          break;
      }
    }
  );
}

export function handleBrowserMessage(host: BrowserFileDragDropHost, message: any): void {
  if (!host.browserFileHandler) {
    console.error('🌐 Browser file handler not initialized');
    return;
  }

  switch (message.type) {
    case 'removeFile':
      host.browserFileHandler.removeFile(message.fileIndex);
      break;

    case 'requestCameraParams':
      host.browserFileHandler.handleCameraParams(message);
      break;

    case 'requestCameraParamsWithScale':
      host.browserFileHandler.handleCameraParamsWithScale(message);
      break;

    case 'savePlyFile':
      host.browserFileHandler.savePlyFile(message);
      break;

    default:
      console.log(`🌐 Browser mode: Unhandled message type ${message.type}`);
      break;
  }
}

export function setupPanelResizeAndDrag(): void {
  const mainPanel = document.getElementById('main-ui-panel');
  const tabContent = document.querySelector('.tab-content') as HTMLElement;

  if (!mainPanel || !tabContent) {
    console.warn('⚠️ Main panel or tab content not found');
    return;
  }

  console.log('✅ Panel resize setup initialized');

  // Panel resize functionality - drag from bottom edge
  let isDragging = false;
  let startY = 0;
  let startHeight = 0;
  const resizeZone = 10; // 10px from bottom edge for easier grabbing

  // Helper to check if mouse is in resize zone
  const isInResizeZone = (e: MouseEvent): boolean => {
    const rect = mainPanel.getBoundingClientRect();
    const mouseY = e.clientY;
    const bottomEdge = rect.bottom;
    return mouseY >= bottomEdge - resizeZone && mouseY <= bottomEdge + 2;
  };

  // Update cursor when hovering over resize zone
  mainPanel.addEventListener('mousemove', (e: MouseEvent) => {
    if (!isDragging) {
      if (isInResizeZone(e)) {
        mainPanel.style.cursor = 'ns-resize';
      } else {
        mainPanel.style.cursor = '';
      }
    }
  });

  mainPanel.addEventListener('mouseleave', () => {
    if (!isDragging) {
      mainPanel.style.cursor = '';
    }
  });

  // Start dragging
  mainPanel.addEventListener('mousedown', (e: MouseEvent) => {
    if (isInResizeZone(e)) {
      isDragging = true;
      startY = e.clientY;

      // Get current ACTUAL height (not max-height from CSS)
      const currentMaxHeight = tabContent.style.maxHeight;
      if (currentMaxHeight && currentMaxHeight !== '') {
        // Already has an inline style - use it
        if (currentMaxHeight.includes('vh')) {
          const vh = parseFloat(currentMaxHeight);
          startHeight = (vh / 100) * window.innerHeight;
        } else {
          startHeight = parseInt(currentMaxHeight);
        }
      } else {
        // No inline style yet - get the actual computed height
        const computedHeight = tabContent.getBoundingClientRect().height;
        startHeight = computedHeight;
        console.log('📏 Using computed height:', computedHeight);
      }

      mainPanel.style.cursor = 'ns-resize';
      document.body.style.cursor = 'ns-resize';
      e.preventDefault();
      e.stopPropagation();
      console.log('🖱️ Drag started, initial height:', startHeight);
    }
  });

  // Handle dragging
  document.addEventListener('mousemove', (e: MouseEvent) => {
    if (isDragging) {
      const deltaY = e.clientY - startY;
      const newHeight = startHeight + deltaY;

      // Clamp height between reasonable values (in pixels)
      const minHeight = 150; // Minimum 150px
      const maxHeight = window.innerHeight * 0.9; // Maximum 90vh
      const clampedHeight = Math.max(minHeight, Math.min(maxHeight, newHeight));

      tabContent.style.maxHeight = `${clampedHeight}px`;
      e.preventDefault();
    }
  });

  // Stop dragging
  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      mainPanel.style.cursor = '';
      document.body.style.cursor = '';
      console.log('🖱️ Drag ended');
    }
  });
}

export function setupBrowserFileHandlers(host: BrowserFileDragDropHost): void {
  const fileInput = document.getElementById('hiddenFileInput') as HTMLInputElement;
  const addFileButton = document.getElementById('add-file');
  const mainPanel = document.getElementById('main-ui-panel');

  if (fileInput) {
    fileInput.addEventListener('change', event => {
      const files = (event.target as HTMLInputElement).files;
      if (files) {
        handleDroppedFiles(host, Array.from(files));
      }
    });
  }

  // Add drag & drop support to the Add Point Cloud button
  if (addFileButton) {
    addFileButton.addEventListener('dragover', event => {
      handleDragOver(event);
      addFileButton.style.backgroundColor = '#1177bb';
      addFileButton.style.transform = 'scale(1.02)';
    });

    addFileButton.addEventListener('dragleave', () => {
      addFileButton.style.backgroundColor = '';
      addFileButton.style.transform = '';
    });

    addFileButton.addEventListener('drop', event => {
      addFileButton.style.backgroundColor = '';
      addFileButton.style.transform = '';
      void handleDropEvent(host, event);
    });
  }

  // Also add drag & drop to the entire main UI panel as fallback
  if (mainPanel) {
    mainPanel.addEventListener('dragover', event => {
      handleDragOver(event);
    });

    mainPanel.addEventListener('drop', event => {
      void handleDropEvent(host, event);
    });
  }

  // Add drag & drop support to the entire window
  document.addEventListener('dragover', event => {
    handleDragOver(event);
    // Add visual feedback to the entire window
    document.body.style.backgroundColor = 'rgba(0, 95, 184, 0.1)';
  });

  document.addEventListener('dragleave', event => {
    // Only remove highlight when leaving the entire document
    if (!event.relatedTarget || event.relatedTarget === document.documentElement) {
      document.body.style.backgroundColor = '';
    }
  });

  document.addEventListener('drop', event => {
    document.body.style.backgroundColor = '';
    void handleDropEvent(host, event);
  });
}

export function handleDragOver(event: DragEvent): void {
  event.preventDefault();
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'copy';
  }
}

export async function handleDropEvent(
  host: BrowserFileDragDropHost,
  event: DragEvent
): Promise<void> {
  event.preventDefault();
  event.stopPropagation();
  document.body.style.backgroundColor = '';

  const files = Array.from(event.dataTransfer?.files || []);
  if (files.length > 0) {
    await handleDroppedFiles(host, files);
    return;
  }

  if (isVSCode) {
    const filePaths = extractDroppedFilePaths(event.dataTransfer);
    if (filePaths.length > 0) {
      host.showImmediateLoading({ fileName: `${filePaths.length} dropped file(s)` });
      filePaths.forEach(filePath => {
        host.vscode.postMessage({
          type: 'addFileFromPath',
          path: filePath,
        });
      });
      return;
    }
  }
}

export function extractDroppedFilePaths(dataTransfer: DataTransfer | null): string[] {
  if (!dataTransfer) {
    return [];
  }

  const rawValues = [
    dataTransfer.getData('text/uri-list'),
    dataTransfer.getData('text/plain'),
  ].filter(Boolean);

  const paths: string[] = [];
  for (const rawValue of rawValues) {
    for (const rawLine of rawValue.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) {
        continue;
      }

      if (line.startsWith('file://')) {
        try {
          const url = new URL(line);
          let pathName = decodeURIComponent(url.pathname);
          if (/^\/[A-Za-z]:\//.test(pathName)) {
            pathName = pathName.slice(1);
          }
          paths.push(pathName);
        } catch {
          // Ignore malformed drag payloads and keep checking other entries.
        }
      } else if (/^(\/|[A-Za-z]:\\)/.test(line)) {
        paths.push(line);
      }
    }
  }

  return Array.from(new Set(paths));
}

export async function handleDroppedFiles(
  host: BrowserFileDragDropHost,
  files: File[]
): Promise<void> {
  if (files.length === 0) {
    return;
  }

  if (isVSCode) {
    host.showImmediateLoading({ fileName: `${files.length} dropped file(s)` });
    try {
      const droppedFiles = await Promise.all(
        files.map(async file => ({
          name: file.name,
          data: await file.arrayBuffer(),
        }))
      );
      host.vscode.postMessage({
        type: 'addDroppedFiles',
        files: droppedFiles,
      });
    } catch (error) {
      host.showError(
        `Failed to read dropped file: ${error instanceof Error ? error.message : String(error)}`
      );
    }
    return;
  }

  await handleBrowserFiles(host, files);
}

export async function handleBrowserFiles(
  host: BrowserFileDragDropHost,
  files: File[]
): Promise<void> {
  console.log(`🌐 Loading ${files.length} files in browser...`);
  host.showImmediateLoading({ fileName: `${files.length} files`, pointCount: 0 });

  try {
    // Convert File objects to data format expected by shared function
    const fileData = await Promise.all(
      files.map(async file => ({
        name: file.name,
        data: new Uint8Array(await file.arrayBuffer()),
      }))
    );

    // Separate depth files and JSON files for special handling
    const depthFiles: typeof fileData = [];
    const regularFiles: typeof fileData = [];

    fileData.forEach(file => {
      const fileType = detectFileTypeWithContent(file.name, file.data);
      if (fileType?.isDepthFile) {
        depthFiles.push(file);
      } else if (fileType?.category === 'poseData') {
        // JSON files are handled separately below, don't add to regularFiles
        // to avoid double processing
      } else {
        regularFiles.push(file);
      }
    });

    const spatialDataArray: SpatialData[] = [];
    // Remember starting index to map newly added files
    const baseIndexStart = host.spatialFiles.length;
    // Track depth metadata to populate fileDepthData after display
    const depthMetaRecords: Array<{
      localIndex: number;
      fileName: string;
      buffer: ArrayBuffer;
      params: CameraParams;
      dims?: { width: number; height: number };
    }> = [];

    const lidarFiles = regularFiles.filter(file => /\.(las|laz|e57)$/i.test(file.name));
    const splatContainerFiles = regularFiles.filter(file => SPLAT_CONTAINER_REGEX.test(file.name));
    const conventionalFiles = regularFiles.filter(
      file => !/\.(las|laz|e57)$/i.test(file.name) && !SPLAT_CONTAINER_REGEX.test(file.name)
    );
    for (const file of lidarFiles) {
      try {
        const extension = file.name.split('.').pop()!.toLowerCase() as 'las' | 'laz' | 'e57';
        spatialDataArray.push(...(await parseLidarFile(file.data, extension, file.name)));
      } catch (error) {
        host.showError(
          `Failed to load ${file.name}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
    // Splat-native containers (.spz/.splat/.ksplat/.sog): decoded by Spark,
    // centers join the scene as a point cloud, splat mode turns on after add.
    for (const file of splatContainerFiles) {
      try {
        spatialDataArray.push(await host.splatMode.loadContainer(file.name, file.data));
      } catch (error) {
        host.showError(
          `Failed to load ${file.name}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    // Process conventional files using shared functionality
    if (conventionalFiles.length > 0) {
      const parseResults = await processFiles(conventionalFiles, {
        timingCallback: (message: string) => {
          console.log(`⏱️ ${message}`);
        },
        progressCallback: (current: number, total: number, fileName: string) => {
          console.log(`📁 Processing ${fileName} (${current}/${total})`);
        },
        errorCallback: (error: FileError) => {
          console.error(`❌ Error processing ${error.fileName}:`, error.error);
          host.showError(error.error);
        },
      });

      // Convert parse results to SpatialData format
      parseResults.forEach(result => {
        spatialDataArray.push(result.data as SpatialData);
      });
    }

    // Handle depth files using the unified flow
    for (const depthFile of depthFiles) {
      console.log(`🖼️ Depth image detected: ${depthFile.name}`);
      try {
        // Ask for params (prompt); then convert via shared helper
        const params = await host.promptForCameraParameters(depthFile.name);
        if (!params) {
          console.log(`⏭️ Skipping ${depthFile.name} - camera parameters cancelled`);
          continue;
        }
        const parse = await convertDepthToUnified(depthFile.name, depthFile.data.buffer, {
          fx: params.fx,
          fy: params.fy ?? params.fx,
          cx: params.cx ?? undefined,
          cy: params.cy ?? undefined,
          cameraModel: params.cameraModel,
          depthType: params.depthType,
          convention: params.convention ?? 'opengl',
          baseline: params.baseline,
          pngScaleFactor: params.pngScaleFactor,
          depthScale: params.depthScale,
          depthBias: params.depthBias,
        });
        const data = parse.data as SpatialData;
        (data as any).isDepthDerived = true;
        // Record dimensions if provided
        const dims = (parse.data as any).depthDimensions;
        if (dims) {
          (data as any).depthDimensions = dims;
        }
        const localIndex = spatialDataArray.length;
        spatialDataArray.push(data);
        depthMetaRecords.push({
          localIndex,
          fileName: depthFile.name,
          buffer: depthFile.data.buffer,
          params,
          dims,
        });
      } catch (error) {
        console.error(`❌ Error processing depth image ${depthFile.name}:`, error);
        host.showError(`Failed to process depth image ${depthFile.name}: ${error}`);
      }
    }

    // Handle JSON files - check if they're camera profiles or pose data
    const jsonFiles = fileData.filter(file => {
      const fileType = detectFileTypeWithContent(file.name, file.data);
      return fileType?.category === 'poseData';
    });

    for (const file of jsonFiles) {
      console.log(`📍 JSON file detected: ${file.name}`);
      try {
        // Parse JSON to determine if it's a camera profile or pose data
        const jsonText = new TextDecoder().decode(file.data);
        const jsonData = JSON.parse(jsonText);

        // Check if this is a camera profile JSON
        if (jsonData && jsonData.cameras && typeof jsonData.cameras === 'object') {
          console.log(`📷 Camera profile detected: ${file.name}`);
          host.handleCameraProfile(jsonData, file.name);
        } else {
          console.log(`📍 Pose data detected: ${file.name}`);
          // Handle pose data using the existing method
          await host.handlePoseData({ data: jsonData, fileName: file.name });
        }
      } catch (error) {
        console.error(`❌ Error parsing JSON file ${file.name}:`, error);
        host.showError(`Failed to parse JSON file ${file.name}: ${error}`);
      }
    }

    if (spatialDataArray.length > 0) {
      await host.displayFiles(spatialDataArray);

      // Populate fileDepthData for newly added depth-derived files
      for (const rec of depthMetaRecords) {
        const fileIndex = baseIndexStart + rec.localIndex;
        host.fileDepthData.set(fileIndex, {
          originalData: rec.buffer,
          fileName: rec.fileName,
          cameraParams: rec.params,
          depthDimensions: rec.dims || { width: 0, height: 0 },
        });
        if (rec.dims) {
          // Ensure cx/cy fields are populated correctly in UI
          host.updatePrinciplePointFields(fileIndex, rec.dims);
        }
      }
    }
  } catch (error) {
    console.error('Error loading files:', error);
    host.showError(
      `Failed to load files: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
