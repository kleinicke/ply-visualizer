/**
 * Shared file handling functionality for both extension and website
 * Provides unified file type detection, parsing, and error handling
 */

import { PlyParser } from './parsers/plyParser';
import { ObjParser } from './parsers/objParser';
import { StlParser } from './parsers/stlParser';
import { PcdParser } from './parsers/pcdParser';
import { PtsParser } from './parsers/ptsParser';
import { OffParser } from './parsers/offParser';
import { GltfParser } from './parsers/gltfParser';
import { NpyParser, isNpyPointCloudData } from './parsers/npyParser';

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

// Supported file extensions and their categories
export const SUPPORTED_EXTENSIONS = {
  pointClouds: ['ply', 'xyz', 'xyzn', 'xyzrgb', 'pcd', 'pts'],
  meshes: ['stl', 'obj', 'off', 'gltf', 'glb'],
  depthImages: ['tif', 'tiff', 'pfm', 'npy', 'npz', 'png'],
  poseData: ['json'],
} as const;

export const ALL_SUPPORTED_EXTENSIONS = [
  ...SUPPORTED_EXTENSIONS.pointClouds,
  ...SUPPORTED_EXTENSIONS.meshes,
  ...SUPPORTED_EXTENSIONS.depthImages,
  ...SUPPORTED_EXTENSIONS.poseData,
];

// File type detection interface
export interface FileTypeInfo {
  extension: string;
  category: 'pointCloud' | 'mesh' | 'depthImage' | 'poseData';
  isDepthFile: boolean;
  isBinaryFormat?: boolean;
}

// Unified file data interface
export interface UnifiedFileData {
  vertices: any[];
  faces?: any[];
  format: string;
  version?: string;
  comments?: string[];
  vertexCount: number;
  faceCount: number;
  hasColors: boolean;
  hasNormals: boolean;
  fileName: string;
  fileIndex?: number;
  triangles?: any[]; // For STL format
}

// Parser result interface
export interface ParseResult {
  data: UnifiedFileData;
  type: string; // 'plyData', 'stlData', 'objData', etc.
}

// Error handling interface
export interface FileError {
  fileName: string;
  error: string;
  type: 'parsing' | 'unsupported' | 'depth' | 'generic';
}

/**
 * Detects file type information from filename
 */
export function detectFileType(fileName: string): FileTypeInfo | null {
  const extension = fileName.toLowerCase().split('.').pop();
  if (!extension) {
    return null;
  }

  // Check each category
  if (SUPPORTED_EXTENSIONS.pointClouds.includes(extension as any)) {
    return {
      extension,
      category: 'pointCloud',
      isDepthFile: false,
    };
  }

  if (SUPPORTED_EXTENSIONS.meshes.includes(extension as any)) {
    return {
      extension,
      category: 'mesh',
      isDepthFile: false,
    };
  }

  if (SUPPORTED_EXTENSIONS.depthImages.includes(extension as any)) {
    return {
      extension,
      category: 'depthImage',
      isDepthFile: true,
    };
  }

  if (SUPPORTED_EXTENSIONS.poseData.includes(extension as any)) {
    return {
      extension,
      category: 'poseData',
      isDepthFile: false,
    };
  }

  return null;
}

/**
 * Detects file type with content-based analysis for NPY files
 * NPY files can contain either depth images or XYZ point cloud data
 */
export function detectFileTypeWithContent(
  fileName: string,
  fileData?: Uint8Array
): FileTypeInfo | null {
  const basicType = detectFileType(fileName);
  if (!basicType) {
    return null;
  }

  // For NPY files, analyze content to determine if it's point cloud data or depth data
  if (basicType.extension === 'npy' && fileData) {
    try {
      const arrayBuffer = fileData.buffer.slice(
        fileData.byteOffset,
        fileData.byteOffset + fileData.byteLength
      );
      if (isNpyPointCloudData(arrayBuffer)) {
        // NPY contains XYZ point cloud data - route to point cloud pipeline
        return {
          extension: basicType.extension,
          category: 'pointCloud',
          isDepthFile: false,
        };
      }
    } catch (error) {
      // If we can't analyze the NPY content, fall back to depth image assumption
      console.warn('Failed to analyze NPY content, treating as depth image:', error);
    }
  }

  return basicType;
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
  const { extension } = fileInfo;

  switch (extension) {
    case 'ply':
      const plyParser = new PlyParser();
      const plyData = await plyParser.parse(data, timingCallback);
      return {
        data: {
          ...plyData,
          fileName,
        },
        type: 'plyData',
      };

    case 'stl':
      const stlParser = new StlParser();
      const stlData = await stlParser.parse(data, timingCallback);
      return {
        data: convertToUnifiedFormat(stlData, fileName),
        type: 'stlData',
      };

    case 'obj':
      const objParser = new ObjParser();
      const objData = await objParser.parse(data, timingCallback);
      return {
        data: convertToUnifiedFormat(objData, fileName),
        type: 'objData',
      };

    case 'pcd':
      const pcdParser = new PcdParser();
      const pcdData = await pcdParser.parse(data, timingCallback);
      return {
        data: convertToUnifiedFormat(pcdData, fileName),
        type: 'pcdData',
      };

    case 'pts':
      const ptsParser = new PtsParser();
      const ptsData = await ptsParser.parse(data, timingCallback);
      return {
        data: convertToUnifiedFormat(ptsData, fileName),
        type: 'ptsData',
      };

    case 'off':
      const offParser = new OffParser();
      const offData = await offParser.parse(data, timingCallback);
      return {
        data: convertToUnifiedFormat(offData, fileName),
        type: 'offData',
      };

    case 'gltf':
    case 'glb':
      const gltfParser = new GltfParser();
      const gltfData = await gltfParser.parse(data, timingCallback);
      return {
        data: convertToUnifiedFormat(gltfData, fileName),
        type: 'gltfData',
      };

    case 'xyz':
    case 'xyzn':
    case 'xyzrgb':
      // XYZ variants can be parsed with PLY parser
      const xyzParser = new PlyParser();
      const xyzData = await xyzParser.parse(data, timingCallback);
      return {
        data: {
          ...xyzData,
          fileName,
        },
        type: 'xyzData',
      };

    case 'npy':
      // NPY files containing XYZ point cloud data (detected by content analysis)
      if (fileInfo.category === 'pointCloud') {
        const npyParser = new NpyParser();
        const npyData = await npyParser.parse(data, timingCallback);
        return {
          data: {
            ...npyData,
            fileName,
          },
          type: 'npyData',
        };
      } else {
        // This should not happen if detectFileTypeWithContent works correctly
        throw new Error(
          `NPY file ${fileName} was not detected as point cloud data. Shape may not end with dimension 3.`
        );
      }

    default:
      throw new Error(`Unsupported file format: ${extension}`);
  }
}

/**
 * Convert parser-specific data format to unified format
 */
export function convertToUnifiedFormat(data: any, fileName: string): UnifiedFileData {
  let vertices = data.vertices || [];
  let faces = data.faces || [];

  // Handle STL format specifically
  if (data.triangles && Array.isArray(data.triangles)) {
    console.log(`🔄 Converting STL data: ${data.triangles.length} triangles`);

    // STL stores triangles directly with vertex coordinates
    // We need to extract unique vertices and create face indices
    const vertexMap = new Map<string, number>();
    const convertedVertices: any[] = [];
    const convertedFaces: any[] = [];

    data.triangles.forEach((triangle: any) => {
      const faceIndices: number[] = [];

      // Process each vertex in the triangle
      triangle.vertices.forEach((vertex: any) => {
        // Create a unique key for the vertex
        const vertexKey = `${vertex.x.toFixed(6)}_${vertex.y.toFixed(6)}_${vertex.z.toFixed(6)}`;

        let vertexIndex = vertexMap.get(vertexKey);
        if (vertexIndex === undefined) {
          // New unique vertex
          vertexIndex = convertedVertices.length;
          vertexMap.set(vertexKey, vertexIndex);

          convertedVertices.push({
            x: vertex.x,
            y: vertex.y,
            z: vertex.z,
            nx: triangle.normal?.x || 0,
            ny: triangle.normal?.y || 0,
            nz: triangle.normal?.z || 0,
            red: triangle.color?.red || DEFAULT_COLORS.UNCOLORED_VERTEX.red,
            green: triangle.color?.green || DEFAULT_COLORS.UNCOLORED_VERTEX.green,
            blue: triangle.color?.blue || DEFAULT_COLORS.UNCOLORED_VERTEX.blue,
          });
        }

        faceIndices.push(vertexIndex);
      });

      // Add the face with proper indices format
      convertedFaces.push({
        indices: faceIndices,
      });
    });

    vertices = convertedVertices;
    faces = convertedFaces;

    console.log(`✅ STL conversion: ${vertices.length} unique vertices, ${faces.length} faces`);
  }

  return {
    vertices: vertices,
    faces: faces,
    format: data.format || 'ascii',
    version: data.version || '1.0',
    comments: data.comments || [],
    vertexCount: vertices.length,
    faceCount: faces.length,
    hasColors: data.hasColors || false,
    hasNormals: data.hasNormals || true, // Most formats have normals
    fileName: fileName,
  };
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

      const result = await parseFileData(file.data, fileType, file.name, timingCallback);
      result.data.fileIndex = i;
      results.push(result);
    } catch (error) {
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
  cameraModel: 'pinhole-ideal',
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
          cameraModel: savedSettings.cameraModel || 'pinhole-ideal',
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
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = message.fileName || 'pointcloud.ply';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      console.log(`💾 Downloaded PLY file: ${message.fileName}`);
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
  cameraParams: CameraParams & { depthScale?: number; depthBias?: number }
): Promise<ParseResult> {
  const { registerDefaultReaders, registerReader, readDepth } = await import(
    './depth/DepthRegistry'
  );
  const { normalizeDepth, projectToPointCloud } = await import('./depth/DepthProjector');
  const { PngReader } = await import('./depth/readers/PngReader');

  registerDefaultReaders();

  if (/\.png$/i.test(fileName) && cameraParams.pngScaleFactor) {
    const pngReader = new PngReader();
    pngReader.setConfig({ pngScaleFactor: cameraParams.pngScaleFactor, invalidValue: 0 });
    registerReader(pngReader);
  }

  const { image, meta: baseMeta } = await readDepth(fileName, data);

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
    convention: cameraParams.convention || 'opengl',
    k1: (cameraParams as any).k1 ? parseFloat(String((cameraParams as any).k1)) : undefined,
    k2: (cameraParams as any).k2 ? parseFloat(String((cameraParams as any).k2)) : undefined,
    k3: (cameraParams as any).k3 ? parseFloat(String((cameraParams as any).k3)) : undefined,
    k4: (cameraParams as any).k4 ? parseFloat(String((cameraParams as any).k4)) : undefined,
    k5: (cameraParams as any).k5 ? parseFloat(String((cameraParams as any).k5)) : undefined,
    p1: (cameraParams as any).p1 ? parseFloat(String((cameraParams as any).p1)) : undefined,
    p2: (cameraParams as any).p2 ? parseFloat(String((cameraParams as any).p2)) : undefined,
  } as any;

  const result = projectToPointCloud(norm, projectionParams) as unknown as {
    vertices: Float32Array;
    colors?: Float32Array;
    pointCount: number;
    width?: number;
    height?: number;
  };

  const verts: any[] = new Array(result.pointCount);
  for (let i = 0; i < result.pointCount; i++) {
    const x = result.vertices[i * 3];
    const y = result.vertices[i * 3 + 1];
    const z = result.vertices[i * 3 + 2];
    if (result.colors) {
      const r = Math.round(result.colors[i * 3] * 255);
      const g = Math.round(result.colors[i * 3 + 1] * 255);
      const b = Math.round(result.colors[i * 3 + 2] * 255);
      verts[i] = { x, y, z, red: r, green: g, blue: b };
    } else {
      verts[i] = { x, y, z };
    }
  }

  const isPfm = /\.pfm$/i.test(fileName);
  const isNpy = /\.(npy|npz)$/i.test(fileName);
  const isPng = /\.png$/i.test(fileName);
  const fileType = isPfm ? 'PFM' : isNpy ? 'NPY' : isPng ? 'PNG' : 'TIF';

  const unified: UnifiedFileData = {
    vertices: verts,
    faces: [],
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
    vertexCount: verts.length,
    faceCount: 0,
    hasColors: !!result.colors,
    hasNormals: false,
    fileName,
  };

  // Provide extra metadata helpful for UI/rehydration
  (unified as any).isDepthDerived = true;
  if (result.width && result.height) {
    (unified as any).depthDimensions = { width: result.width, height: result.height };
  }

  return { data: unified, type: 'plyData' };
}
