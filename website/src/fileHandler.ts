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
  if (!extension) {return null;}

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
