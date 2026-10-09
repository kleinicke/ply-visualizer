/**
 * Shared file handling functionality for both extension and website
 * Provides unified file type detection, parsing, and error handling
 */

import type { DepthConversionResult } from './interfaces';
import { PerfTimer } from './utils/perfLog';
import { exportWithStatus } from './hosts/exportFile';
import { formats } from './formats/formatRegistry';
import { registerBuiltinFormats, createStonexParser } from './formats/builtinFormats';

// Shared constants for consistent behavior across extension and website
export const DEFAULT_COLORS = {
  // Default color for points without color information (RGB 0-255)
  UNCOLORED_VERTEX: { red: 255, green: 255, blue: 255 }, // White

  // Predefined colors for different files (RGB 0-1 for Three.js)
  FILE_COLORS: [
    [1.0, 1.0, 1.0], // White
    [1.0, 0.0, 0.0], // Red
    [0.0, 1.0, 0.0], // Green
    [0.0, 0.0, 1.0], // Blue
    [1.0, 1.0, 0.0], // Yellow
    [1.0, 0.0, 1.0], // Magenta
    [0.0, 1.0, 1.0], // Cyan
    [0.5, 0.5, 0.5], // Gray
  ] as [number, number, number][],
};

export const DEPTH_UI_BEHAVIOR = {
  // Whether to show depth conversion UI or use defaults immediately
  SHOW_UI_IN_VSCODE: true,
  SHOW_UI_IN_BROWSER: true,

  // Whether to request camera params from extension or show local UI
  USE_EXTENSION_UI_IN_VSCODE: true,
};

// Supported file extensions, derived from the format registry so the lists and
// the parse dispatch cannot drift apart. See formats/formatRegistry.ts.
registerBuiltinFormats(formats, (data, fileName) => convertToUnifiedFormat(data as any, fileName));

export const SUPPORTED_EXTENSIONS = {
  pointClouds: formats.extensionsFor('pointCloud'),
  meshes: formats.extensionsFor('mesh'),
  depthImages: formats.extensionsFor('depthImage'),
  poseData: formats.extensionsFor('poseData'),
};

export const ALL_SUPPORTED_EXTENSIONS = formats.allExtensions();

// File type detection interface
export interface FileTypeInfo {
  extension: string;
  category: 'pointCloud' | 'mesh' | 'depthImage' | 'poseData';
  isDepthFile: boolean;
  isBinaryFormat?: boolean;
}

// Unified file data interface
export type UnifiedFileData = import('./interfaces').SpatialData;

// Parser result interface
export type ParseResult =
  | { type: 'jsonData'; data: { format: 'json'; fileName: string; comments: string[] } }
  | {
      type:
        | 'spatialData'
        | 'stlData'
        | 'objData'
        | 'pcdData'
        | 'ptsData'
        | 'kittiBinData'
        | 'offData'
        | 'gltfData'
        | 'npyData'
        | 'xyzData';
      data: UnifiedFileData;
    };

// Error handling interface
export interface FileError {
  fileName: string;
  error: string;
  type: 'parsing' | 'unsupported' | 'depth' | 'generic';
}

/**
 * Detects file type information from filename
 */
export function requiresImportOptions(fileName: string): boolean {
  return formats.find(fileName.split('.').pop() ?? '')?.requiresImportOptions === true;
}

export function decodesInViewer(fileName: string): boolean {
  return formats.find(fileName.split('.').pop() ?? '')?.decodeInViewer === true;
}

export function detectFileType(fileName: string): FileTypeInfo | null {
  const extension = fileName.toLowerCase().split('.').pop();
  if (!extension) {
    return null;
  }
  const definition = formats.find(extension);
  if (!definition) {
    return null;
  }
  return {
    extension,
    category: definition.category,
    isDepthFile: definition.category === 'depthImage',
  };
}

/**
 * Detects file type with content-based analysis for NPY files
 * NPY files can contain either depth images or XYZ point cloud data
 */
export async function detectFileTypeWithContent(
  fileName: string,
  fileData?: Uint8Array
): Promise<FileTypeInfo | null> {
  const basicType = detectFileType(fileName);
  if (!basicType || !fileData) {
    return basicType;
  }
  const refined = await formats.find(basicType.extension)?.refineCategory?.(fileData);
  if (!refined) {
    return basicType;
  }
  return {
    extension: basicType.extension,
    category: refined,
    isDepthFile: refined === 'depthImage',
  };
}

/**
 * Detects if PLY file is binary format
 */
export function isPlyBinary(data: Uint8Array): boolean {
  const decoder = new TextDecoder('utf-8');
  const headerPreview = decoder.decode(data.slice(0, 1024));
  return (
    headerPreview.includes('binary_little_endian') || headerPreview.includes('binary_big_endian')
  );
}

/**
 * Parse file data based on detected type
 */
export async function parseFileData(
  data: Uint8Array,
  fileInfo: FileTypeInfo,
  fileName: string,
  timingCallback?: (message: string) => void
): Promise<ParseResult> {
  const definition = formats.find(fileInfo.extension);
  if (!definition?.parse) {
    // Either unknown, or a format decoded elsewhere (lidar worker, Spark,
    // DepthRegistry) and therefore never routed here.
    throw new Error(`Unsupported file format: ${fileInfo.extension}`);
  }
  return definition.parse({
    data,
    fileName,
    category: fileInfo.category,
    timingCallback,
  });
}

/**
 * Convert parser-specific data format to unified format
 */
export function convertToUnifiedFormat(data: any, fileName: string): UnifiedFileData {
  const vertices = data.vertices || [];
  const faces = data.faces || [];

  const unified: UnifiedFileData = {
    ...data,
    vertices: vertices,
    faces: faces,
    format:
      data.format === 'binary' || data.format === 'binary_compressed' || data.format === 'kitti-bin'
        ? 'binary_little_endian'
        : data.format === 'pts'
          ? 'ascii'
          : data.format || 'ascii',
    version: data.version || '1.0',
    comments: data.comments || [],
    vertexCount: data.vertexCount ?? vertices.length,
    faceCount: data.indicesArray ? data.indicesArray.length / 3 : faces.length,
    hasColors: data.hasColors || false,
    // OBJ normals use face-corner indices, not the unified vertex indices.
    // No per-vertex normal array is produced here; mesh construction computes it.
    hasNormals: /\.obj$/i.test(fileName) ? false : (data.hasNormals ?? false),
    hasIntensity: data.hasIntensity || false,
    fileName: fileName,
  };

  if (data.useTypedArrays) {
    unified.useTypedArrays = true;
    unified.positionsArray = data.positionsArray;
    unified.colorsArray = data.colorsArray ?? null;
    unified.normalsArray = data.normalsArray ?? null;
    unified.intensityArray = data.intensityArray ?? null;
    unified.scalarFields = data.scalarFields ?? {};
    unified.sourcePointCount = data.sourcePointCount;
    unified.sourcePointIndices = data.sourcePointIndices;
    unified.sourceRowsIdentity = data.sourceRowsIdentity;
  }

  return unified;
}

/**
 * Generate appropriate error message based on file type and error
 */
export function generateErrorMessage(fileName: string, extension: string, error: any): string {
  const errorMessage = error instanceof Error ? error.message : String(error);

  if (!ALL_SUPPORTED_EXTENSIONS.includes(extension as any)) {
    return `Unsupported file format: .${extension}\n\nSupported formats:\n• Point clouds: ${SUPPORTED_EXTENSIONS.pointClouds.map(e => e.toUpperCase()).join(', ')}\n• Meshes: ${SUPPORTED_EXTENSIONS.meshes.map(e => e.toUpperCase()).join(', ')}\n• Depth images: ${SUPPORTED_EXTENSIONS.depthImages.map(e => e.toUpperCase()).join(', ')}\n• Pose data: ${SUPPORTED_EXTENSIONS.poseData.map(e => e.toUpperCase()).join(', ')}`;
  }

  return `Failed to parse ${extension.toUpperCase()} file ${fileName}: ${errorMessage}`;
}

/**
 * Process multiple files with unified error handling
 */
export async function processFiles(
  files: { name: string; data: Uint8Array }[],
  options?: {
    timingCallback?: (message: string) => void;
    progressCallback?: (current: number, total: number, fileName: string) => void;
    errorCallback?: (error: FileError) => void;
  }
): Promise<ParseResult[]> {
  const results: ParseResult[] = [];
  const { timingCallback, progressCallback, errorCallback } = options || {};

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const fileType = detectFileType(file.name);

    try {
      progressCallback?.(i + 1, files.length, file.name);

      if (!fileType) {
        const extension = file.name.toLowerCase().split('.').pop() || '';
        const error: FileError = {
          fileName: file.name,
          error: generateErrorMessage(file.name, extension, new Error('Unsupported file type')),
          type: 'unsupported',
        };
        errorCallback?.(error);
        continue;
      }

      // Skip depth files - they need special handling
      if (fileType.isDepthFile) {
        const error: FileError = {
          fileName: file.name,
          error: `Depth image files (${fileType.extension.toUpperCase()}) require camera parameters for conversion`,
          type: 'depth',
        };
        errorCallback?.(error);
        continue;
      }

      if (fileType.extension === 'x3a') {
        const scans = await (
          await createStonexParser()
        ).parseAll(file.data, file.name, timingCallback);
        for (const scan of scans) {
          scan.fileIndex = results.length;
          results.push({ data: scan, type: 'spatialData' });
        }
      } else {
        const result = await parseFileData(file.data, fileType, file.name, timingCallback);
        if (result.type !== 'jsonData') {
          result.data.fileIndex = results.length;
        }
        results.push(result);
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        continue;
      }
      const fileError: FileError = {
        fileName: file.name,
        error: generateErrorMessage(file.name, fileType?.extension || '', error),
        type: 'parsing',
      };
      errorCallback?.(fileError);
    }
  }

  return results;
}

/**
 * Determines how depth conversion should be handled based on environment
 */
export function shouldRequestDepthParams(isVSCode: boolean): 'extension' | 'local' | 'defaults' {
  if (isVSCode) {
    return DEPTH_UI_BEHAVIOR.USE_EXTENSION_UI_IN_VSCODE
      ? 'extension'
      : DEPTH_UI_BEHAVIOR.SHOW_UI_IN_VSCODE
        ? 'local'
        : 'defaults';
  } else {
    return DEPTH_UI_BEHAVIOR.SHOW_UI_IN_BROWSER ? 'local' : 'defaults';
  }
}

/**
 * Generate unique request ID for depth conversion requests
 */
export function generateDepthRequestId(): string {
  return `depth_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Default depth settings for different scenarios
 */
export const DEFAULT_DEPTH_SETTINGS = {
  fx: 1000,
  fy: 1000,
  // The panel offers the general models; an ideal pinhole is this one with
  // zero distortion, and naming a model the picker does not carry would leave
  // it showing nothing.
  cameraModel: 'pinhole-opencv',
  depthType: 'euclidean',
  convention: 'opengl',
  baseline: 50,
  pngScaleFactor: 1000,
};

/**
 * Camera parameter interface for depth conversion
 */
export interface CameraParams {
  fx: number;
  fy?: number;
  cx?: number;
  cy?: number;
  cameraModel: string;
  depthType: string;
  convention?: string;
  baseline?: number;
  pngScaleFactor?: number;
  depthScale?: number;
  depthBias?: number;
  coefficients?: number[];
  imageRectified?: boolean;
}

/**
 * Create default camera parameters for given image dimensions
 */
export function createDefaultCameraParams(imageWidth: number, imageHeight: number): CameraParams {
  return {
    fx: DEFAULT_DEPTH_SETTINGS.fx,
    fy: DEFAULT_DEPTH_SETTINGS.fy,
    cx: imageWidth / 2,
    cy: imageHeight / 2,
    cameraModel: DEFAULT_DEPTH_SETTINGS.cameraModel,
    depthType: DEFAULT_DEPTH_SETTINGS.depthType,
    convention: DEFAULT_DEPTH_SETTINGS.convention,
    baseline: DEFAULT_DEPTH_SETTINGS.baseline,
    pngScaleFactor: DEFAULT_DEPTH_SETTINGS.pngScaleFactor,
  };
}

/**
 * Enhanced browser message handler interface
 */
export interface BrowserMessageHandler {
  removeFile(fileIndex: number): void;
  handleCameraParams(message: any): void;
  handleCameraParamsWithScale(message: any): void;
  savePlyFile(message: any): void;
}

/**
 * VS Code-specific camera parameters handler interface
 */
export interface VSCodeCameraParamsHandler {
  showQuickPick(items: any[], options: any): Promise<any>;
  showInputBox(options: any): Promise<string | undefined>;
  showInformationMessage(message: string): void;
  showErrorMessage(message: string): void;
  getGlobalState(key: string): any;
}

/**
 * Handle camera parameters request with VS Code UI
 */
export async function handleVSCodeCameraParams(
  message: any,
  vscodeHandler: VSCodeCameraParamsHandler,
  postMessage: (message: any) => void
): Promise<void> {
  try {
    // Load saved default settings
    const savedSettings = vscodeHandler.getGlobalState('defaultDepthSettings') as any;
    const defaults = savedSettings
      ? {
          fx: savedSettings.fx || 1000,
          fy: savedSettings.fy,
          cameraModel: savedSettings.cameraModel || 'pinhole-opencv',
          depthType: savedSettings.depthType || 'euclidean',
          convention: savedSettings.convention || 'opengl',
          baseline: savedSettings.baseline || 50,
          pngScaleFactor: savedSettings.pngScaleFactor || 1000,
        }
      : DEFAULT_DEPTH_SETTINGS;

    console.log('🎯 Using default settings for camera parameters dialog:', defaults);

    // Show option to use defaults directly or customize
    const useDefaults = await vscodeHandler.showQuickPick(
      [
        {
          label: '⚡ Use Default Settings',
          description: `${defaults.cameraModel}, fx=${defaults.fx}px${defaults.fy ? `, fy=${defaults.fy}px` : ''}, ${defaults.depthType}, ${defaults.convention}${defaults.baseline ? `, baseline=${defaults.baseline}mm` : ''}`,
          value: 'defaults',
        },
        {
          label: '⚙️ Customize Settings',
          description: 'Choose settings manually',
          value: 'customize',
        },
      ],
      {
        placeHolder: 'Convert depth image to point cloud',
        ignoreFocusOut: true,
      }
    );

    if (!useDefaults) {
      postMessage({
        type: 'cameraParamsError',
        error: 'Camera parameters request cancelled',
        requestId: message.requestId,
      });
      return;
    }

    let finalParams = { ...defaults };

    if (useDefaults.value === 'customize') {
      // Show customization dialogs
      // This is a simplified version - the full implementation would have all the VS Code UI logic
      const fx = await vscodeHandler.showInputBox({
        prompt: 'Focal length X (fx) in pixels',
        value: defaults.fx.toString(),
        validateInput: (value: string) => {
          const num = parseFloat(value);
          return isNaN(num) || num <= 0 ? 'Please enter a positive number' : null;
        },
      });

      if (fx) {
        finalParams.fx = parseFloat(fx);
      }
    }

    // Calculate cx/cy from image dimensions
    const cx = message.imageWidth / 2;
    const cy = message.imageHeight / 2;

    postMessage({
      type: 'cameraParamsResult',
      fx: finalParams.fx,
      fy: finalParams.fy || finalParams.fx,
      cx: cx,
      cy: cy,
      cameraModel: finalParams.cameraModel,
      depthType: finalParams.depthType,
      convention: finalParams.convention,
      baseline: finalParams.baseline,
      requestId: message.requestId,
    });
  } catch (error) {
    postMessage({
      type: 'cameraParamsError',
      error: error instanceof Error ? error.message : String(error),
      requestId: message.requestId,
    });
  }
}

/**
 * Create browser file operations handler
 */
export function createBrowserFileHandler(
  removeFileCallback: (fileIndex: number) => void,
  messageHandler: (message: any) => void
): BrowserMessageHandler {
  return {
    removeFile: removeFileCallback,

    handleCameraParams: (message: any) => {
      const params = createDefaultCameraParams(message.imageWidth, message.imageHeight);
      setTimeout(() => {
        messageHandler({
          type: 'cameraParamsResult',
          ...params,
          requestId: message.requestId,
        });
      }, 100);
    },

    handleCameraParamsWithScale: (message: any) => {
      const params = createDefaultCameraParams(message.imageWidth, message.imageHeight);
      setTimeout(() => {
        messageHandler({
          type: 'cameraParamsWithScaleResult',
          ...params,
          requestId: message.requestId,
        });
      }, 100);
    },

    savePlyFile: (message: any) => {
      const blob = new Blob([message.plyContent], { type: 'application/octet-stream' });
      exportWithStatus(message.fileName || 'pointcloud.ply', blob, status => console.log(status));
    },
  };
}

/**
 * Prompt-based camera parameter collection for browser. Provides a simple UI
 * closely mirroring the VSCode flow (defaults vs customize).
 */
export async function collectCameraParamsForBrowserPrompt(
  imageWidth: number,
  imageHeight: number,
  defaults?: Partial<CameraParams> & { depthScale?: number; depthBias?: number }
): Promise<(CameraParams & { depthScale?: number; depthBias?: number }) | null> {
  try {
    const base: any = { ...DEFAULT_DEPTH_SETTINGS, ...defaults };

    const useDefaults = window.confirm(
      `Convert depth image to point cloud?\n\n` +
        `Defaults:\n` +
        `• Camera: ${base.cameraModel}\n` +
        `• fx=${base.fx}${base.fy ? ', fy=' + base.fy : ''} px\n` +
        `• Depth type: ${base.depthType}\n` +
        `• Convention: ${base.convention || 'opengl'}\n` +
        `${base.baseline ? '• Baseline: ' + base.baseline + ' mm\n' : ''}` +
        `${base.pngScaleFactor ? '• PNG scale: ' + base.pngScaleFactor + '\n' : ''}\n` +
        `Click OK to use defaults, or Cancel to customize.`
    );

    if (useDefaults) {
      return {
        fx: base.fx,
        fy: base.fy ?? base.fx,
        cx: (imageWidth - 1) / 2,
        cy: (imageHeight - 1) / 2,
        cameraModel: base.cameraModel,
        depthType: base.depthType,
        convention: base.convention || 'opengl',
        baseline: base.baseline,
        pngScaleFactor: base.pngScaleFactor,
        depthScale: (defaults as any)?.depthScale,
        depthBias: (defaults as any)?.depthBias,
      };
    }

    const fxStr = window.prompt('Focal length fx (px):', String(base.fx));
    if (fxStr === null) {
      return null;
    }
    const fx = parseFloat(fxStr);
    if (!isFinite(fx) || fx <= 0) {
      throw new Error('fx must be a positive number');
    }

    const fyStr = window.prompt(
      'Focal length fy (px, leave empty to use fx):',
      base.fy ? String(base.fy) : ''
    );
    const fy = fyStr ? parseFloat(fyStr) : fx;
    if (!isFinite(fy) || fy <= 0) {
      throw new Error('fy must be a positive number');
    }

    const cameraModel = (
      window.prompt('Camera model (pinhole-ideal | fisheye-equidistant):', base.cameraModel) ||
      base.cameraModel
    ).trim();

    const depthType = (
      window.prompt(
        'Depth type (euclidean | disparity | orthogonal | inverse_depth):',
        base.depthType
      ) || base.depthType
    ).trim();

    const convention = (
      window.prompt('Convention (opengl | opencv):', base.convention || 'opengl') ||
      base.convention ||
      'opengl'
    ).trim();

    let baseline: number | undefined = base.baseline;
    if (depthType === 'disparity') {
      const blStr = window.prompt('Stereo baseline (mm):', String(base.baseline ?? 50));
      if (blStr === null) {
        return null;
      }
      baseline = parseFloat(blStr);
      if (!isFinite(baseline) || baseline <= 0) {
        throw new Error('Baseline must be a positive number');
      }
    }

    let pngScaleFactor: number | undefined = base.pngScaleFactor;
    const wantsPngScale = window.confirm(
      'For 16-bit PNG depth, apply scale factor? OK=yes / Cancel=no'
    );
    if (wantsPngScale) {
      const scaleStr = window.prompt(
        'PNG scale factor (e.g., 1000 for mm -> m):',
        String(base.pngScaleFactor ?? 1000)
      );
      if (scaleStr === null) {
        return null;
      }
      pngScaleFactor = parseFloat(scaleStr);
      if (!isFinite(pngScaleFactor) || pngScaleFactor <= 0) {
        throw new Error('PNG scale factor must be a positive number');
      }
    }

    return {
      fx,
      fy,
      cx: (imageWidth - 1) / 2,
      cy: (imageHeight - 1) / 2,
      cameraModel,
      depthType,
      convention,
      baseline,
      pngScaleFactor,
      depthScale: (defaults as any)?.depthScale,
      depthBias: (defaults as any)?.depthBias,
    };
  } catch (err) {
    console.error('Camera parameter collection error:', err);
    return null;
  }
}

/**
 * Unified depth processing returning a unified structure similar to PLY data.
 * This mirrors the logic used in the webview path so both extension and web
 * can share the same conversion routine.
 */
export async function convertDepthToUnified(
  fileName: string,
  data: ArrayBuffer,
  cameraParams: CameraParams & { depthScale?: number; depthBias?: number },
  /**
   * The viewer's depth worker (`processDepthToPointCloud`): decode and
   * projection then run off the main thread, in parallel bands, like a depth
   * image opened in VS Code. Without it everything runs here.
   */
  convert?: (
    data: ArrayBuffer,
    fileName: string,
    cameraParams: CameraParams
  ) => Promise<DepthConversionResult>
): Promise<ParseResult> {
  // One PERF line for this path too (the extension path builds its own in
  // depth/depthConversionPipeline.ts). No extension epochs exist here - the
  // file came from a drop or picker - so the span is webview-only.
  const perf = new PerfTimer(/\.tif(f)?$/i.test(fileName) ? 'tiff' : 'depth');
  perf.file(fileName);
  perf.note('MB', (data.byteLength / 1048576).toFixed(2));

  let result: DepthConversionResult;
  if (convert) {
    const started = performance.now();
    result = await convert(data, fileName, cameraParams);
    const timings = result.timings;
    if (timings) {
      perf.add(timings.decodeCached ? 'decode(cached)' : 'decode', timings.decodeMs);
      perf.add('project', timings.projectMs);
      const workerIo = performance.now() - started - timings.decodeMs - timings.projectMs;
      if (workerIo > 0.5) {
        perf.add('worker-io', workerIo);
      }
      if (timings.info) {
        perf.note('layout', timings.info);
      }
      if (timings.thread) {
        perf.note('on', `${timings.thread}${timings.bands ? `/${timings.bands} bands` : ''}`);
      }
    } else {
      perf.mark('convert');
    }
  } else {
    result = await projectDepthHere(fileName, data, cameraParams, perf);
  }

  const isPfm = /\.pfm$/i.test(fileName);
  const isNpy = /\.(npy|npz)$/i.test(fileName);
  const isPng = /\.png$/i.test(fileName);
  const fileType = isPfm ? 'PFM' : isNpy ? 'NPY' : isPng ? 'PNG' : 'TIF';

  // Typed arrays, like the extension's depth path: one JavaScript object per
  // point cost ~76 bytes of heap each (285 MB for a 3.7M-point TIFF).
  const { colorsToUint8 } = await import('./depth/depthResultArrays');
  const unified: UnifiedFileData = {
    vertices: [],
    faces: [],
    useTypedArrays: true,
    positionsArray: result.vertices.subarray(0, result.pointCount * 3),
    colorsArray: colorsToUint8(result.colors?.subarray(0, result.pointCount * 3)),
    normalsArray: null,
    intensityArray: null,
    scalarFields: {},
    format: 'binary_little_endian',
    version: '1.0',
    comments: [
      `Converted from ${fileType} depth image: ${fileName}`,
      `Camera: ${cameraParams.cameraModel}`,
      `Depth type: ${cameraParams.depthType}`,
      `fx: ${cameraParams.fx}px${cameraParams.fy ? ', fy: ' + cameraParams.fy + 'px' : ''}`,
      ...(cameraParams.baseline ? [`Baseline: ${cameraParams.baseline}mm`] : []),
      ...(cameraParams.pngScaleFactor
        ? [`Scale factor: scale=${cameraParams.pngScaleFactor}`]
        : []),
    ],
    vertexCount: result.pointCount,
    faceCount: 0,
    hasColors: !!result.colors,
    hasNormals: false,
    fileName,
  };

  // Provide extra metadata helpful for UI/rehydration
  (unified as any).isDepthDerived = true;
  // Both converters report the image size, outside the declared result type.
  const { width, height } = result as DepthConversionResult & { width?: number; height?: number };
  if (width && height) {
    (unified as any).depthDimensions = { width, height };
  }

  perf.note('verts', result.pointCount);
  perf.summary();

  return { data: unified, type: 'spatialData' };
}

/** Decode and project on the calling thread (no depth worker available). */
async function projectDepthHere(
  fileName: string,
  data: ArrayBuffer,
  cameraParams: CameraParams & { depthScale?: number; depthBias?: number },
  perf: PerfTimer
): Promise<DepthConversionResult> {
  const { registerDefaultReaders, registerReader, readDepth } =
    await import('./depth/DepthRegistry');
  const { normalizeDepth, projectToPointCloud } = await import('./depth/DepthProjector');
  const { PngReader } = await import('./depth/readers/PngReader');
  const { initTiffWasm } = await import('./depth/readers/tiffWasm');

  // Normalization and projection are Rust-only; there is no JavaScript path
  // left to fall back to, so the module is loaded before either is called.
  if (!(await initTiffWasm())) {
    throw new Error('Depth conversion requires the Rust/WASM kernel, which failed to load');
  }

  registerDefaultReaders();

  if (/\.png$/i.test(fileName) && cameraParams.pngScaleFactor) {
    const pngReader = new PngReader();
    pngReader.setConfig({ pngScaleFactor: cameraParams.pngScaleFactor, invalidValue: 0 });
    registerReader(pngReader);
  }

  const { image, meta: baseMeta } = await readDepth(fileName, data);
  perf.mark('decode');
  if ((baseMeta as any).decodeInfo) {
    perf.note('layout', (baseMeta as any).decodeInfo);
  }

  const cx = cameraParams.cx ?? (image.width - 1) / 2;
  const cy = cameraParams.cy ?? (image.height - 1) / 2;
  const fx = cameraParams.fx;
  const fy = cameraParams.fy ?? cameraParams.fx;

  const meta: any = { ...baseMeta };
  if (cameraParams.depthType === 'disparity') {
    if (cameraParams.fx > 0 && (cameraParams.baseline ?? 0) > 0) {
      meta.kind = 'disparity';
      meta.baseline = (cameraParams.baseline as number) / 1000; // mm -> m
      meta.disparityOffset = (cameraParams as any).disparityOffset || 0;
    }
  } else if (cameraParams.depthType === 'orthogonal') {
    meta.kind = 'z';
  } else if (cameraParams.depthType === 'euclidean') {
    meta.kind = 'depth';
  } else if (cameraParams.depthType === 'inverse_depth') {
    meta.kind = 'inverse_depth';
  }

  const norm = normalizeDepth(image, {
    ...meta,
    fx,
    fy,
    cx,
    cy,
    baseline: meta.baseline,
    depthScale: (cameraParams as any).depthScale,
    depthBias: (cameraParams as any).depthBias,
  });

  const projectionParams = {
    kind: meta.kind,
    fx,
    fy,
    cx,
    cy,
    cameraModel: cameraParams.cameraModel,
    coefficients: cameraParams.coefficients,
    imageRectified: cameraParams.imageRectified,
    convention: cameraParams.convention || 'opengl',
    k1: (cameraParams as any).k1 ? parseFloat(String((cameraParams as any).k1)) : undefined,
    k2: (cameraParams as any).k2 ? parseFloat(String((cameraParams as any).k2)) : undefined,
    k3: (cameraParams as any).k3 ? parseFloat(String((cameraParams as any).k3)) : undefined,
    k4: (cameraParams as any).k4 ? parseFloat(String((cameraParams as any).k4)) : undefined,
    k5: (cameraParams as any).k5 ? parseFloat(String((cameraParams as any).k5)) : undefined,
    p1: (cameraParams as any).p1 ? parseFloat(String((cameraParams as any).p1)) : undefined,
    p2: (cameraParams as any).p2 ? parseFloat(String((cameraParams as any).p2)) : undefined,
  } as any;

  const result = projectToPointCloud(norm, projectionParams) as unknown as DepthConversionResult;

  perf.mark('project');
  return result;
}
