import { parsePlyWasm } from './pointcloudWasm';
import { isGaussianSplatLayout } from '../utils/scalarFields';

export interface SpatialVertex {
  x: number;
  y: number;
  z: number;
  red?: number;
  green?: number;
  blue?: number;
  alpha?: number;
  nx?: number;
  ny?: number;
  nz?: number;
  intensity?: number;
}

export interface SpatialFace {
  indices: number[];
}

export interface SpatialData {
  vertices: SpatialVertex[];
  faces: SpatialFace[];
  format: 'ascii' | 'binary_little_endian' | 'binary_big_endian';
  version: string;
  comments: string[];
  vertexCount: number;
  faceCount: number;
  hasColors: boolean;
  hasNormals: boolean;
  hasIntensity?: boolean;
  /** 3D Gaussian Splatting PLY layout: colors synthesized from f_dc_0..2. */
  isGaussianSplat?: boolean;
  /** Where splat mode can re-read the full original PLY (see interfaces.ts). */
  splatSource?: { url?: string; bytes?: Uint8Array };
  fileName?: string;
  shortPath?: string; // parent/grandparent/filename for tooltip display
  fileIndex?: number;
  positionsArray?: Float32Array;
  colorsArray?: Uint8Array | null;
  normalsArray?: Float32Array | null;
  intensityArray?: Float32Array | null;
  scalarFields?: Record<string, Float32Array>;
  useTypedArrays?: boolean;
}

/**
 * PLY entry points that are not the parser.
 *
 * Parsing itself lives in Rust (`wasm/pointcloud-parser/src/ply.rs`, reached
 * through `parsers/pointcloudWasm.ts`): one implementation for both encodings,
 * for meshes and for 3D Gaussian splats. What is left here is the header
 * reader the extension host uses to ship a binary PLY to the webview without
 * parsing it - it produces offsets, never points.
 */
export class PlyParser {
  private littleEndian = true;

  private static isIntensityField(name: string): boolean {
    return ['intensity', 'reflectivity', 'reflectance', 'remission'].includes(name.toLowerCase());
  }

  /**
   * Parse a PLY into the viewer's shape. Delegates to the Rust parser; kept as
   * a method because call sites and tests address it this way.
   */
  async parse(data: Uint8Array, timingCallback?: (message: string) => void): Promise<SpatialData> {
    const log = timingCallback || console.log;
    const parseStartTime = performance.now();
    // The wording of these two lines is asserted by the browser specs and read
    // by the timing panel; keep them in step with any change there.
    log(`📋 Parser: Starting PLY/XYZ parsing (${data.length} bytes)...`);
    const parsed = await parsePlyWasm(data);
    log(
      `🎯 Parser: ${parsed.vertexCount.toLocaleString()} vertices, ` +
        `${parsed.faceCount.toLocaleString()} faces (${parsed.format})`
    );
    log(`🎯 Parser: Total parse time ${(performance.now() - parseStartTime).toFixed(1)}ms`);
    return {
      vertices: [],
      faces: parsed.faces,
      format: parsed.format,
      version: parsed.version,
      comments: parsed.comments,
      vertexCount: parsed.vertexCount,
      faceCount: parsed.faceCount,
      hasColors: parsed.hasColors,
      hasNormals: parsed.hasNormals,
      hasIntensity: parsed.hasIntensity,
      isGaussianSplat: parsed.isGaussianSplat,
      positionsArray: parsed.positionsArray,
      colorsArray: parsed.colorsArray,
      normalsArray: parsed.normalsArray,
      intensityArray: parsed.intensityArray,
      scalarFields: parsed.scalarFields,
      useTypedArrays: true,
    };
  }

  // ULTIMATE OPTIMIZATION: Extract header + raw binary data without parsing
  async parseHeaderOnly(
    data: Uint8Array,
    timingCallback?: (message: string) => void
  ): Promise<{
    headerInfo: SpatialData;
    binaryDataStart: number;
  }> {
    const parseStartTime = performance.now();
    const log = timingCallback || console.log;
    log(`🚀 ULTIMATE: Header-only parsing for direct binary streaming...`);

    // Same header parsing as before
    const result: SpatialData = {
      vertices: [],
      faces: [],
      format: 'ascii',
      version: '1.0',
      comments: [],
      vertexCount: 0,
      faceCount: 0,
      hasColors: false,
      hasNormals: false,
      hasIntensity: false,
    };

    const headerStartTime = performance.now();
    const decoder = new TextDecoder('utf-8');

    const headerSearchSize = Math.min(4096, data.length);
    let headerText = decoder.decode(data.slice(0, headerSearchSize));

    if (!headerText.startsWith('ply')) {
      throw new Error('Invalid PLY file: missing PLY header');
    }

    let headerEndIndex = headerText.indexOf('end_header');

    if (headerEndIndex === -1) {
      const expandedSize = Math.min(16384, data.length);
      headerText = decoder.decode(data.slice(0, expandedSize));
      headerEndIndex = headerText.indexOf('end_header');

      if (headerEndIndex === -1) {
        throw new Error('Invalid PLY file: missing end_header');
      }
    }

    const headerDecodeTime = performance.now();
    log(`⚡ ULTIMATE: Header decode took ${(headerDecodeTime - headerStartTime).toFixed(1)}ms`);

    const headerLines = headerText.split('\n');
    const vertexProperties: Array<{ name: string; type: string }> = [];
    const faceProperties: Array<{
      name: string;
      type: string;
      countType?: string;
      indexType?: string;
    }> = [];
    let currentElement = '';

    for (const line of headerLines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === 'ply') {
        continue;
      }

      const parts = trimmed.split(/\s+/);

      if (parts[0] === 'format') {
        result.format = parts[1] as any;
        result.version = parts[2] || '1.0';
        this.littleEndian = parts[1] === 'binary_little_endian';
      } else if (parts[0] === 'comment') {
        result.comments.push(parts.slice(1).join(' '));
      } else if (parts[0] === 'element') {
        currentElement = parts[1];
        const count = parseInt(parts[2]);
        if (parts[1] === 'vertex') {
          result.vertexCount = count;
        } else if (parts[1] === 'face') {
          result.faceCount = count;
        }
      } else if (parts[0] === 'property') {
        if (currentElement === 'vertex') {
          vertexProperties.push({
            name: parts[parts.length - 1],
            type: parts[1],
          });
        } else if (currentElement === 'face') {
          if (parts[1] === 'list') {
            // property list <countType> <indexType> <name>
            faceProperties.push({
              name: parts[parts.length - 1],
              type: 'list',
              countType: parts[2],
              indexType: parts[3],
            });
          } else {
            faceProperties.push({
              name: parts[parts.length - 1],
              type: parts[1],
            });
          }
        }
      }
    }

    result.hasColors = vertexProperties.some(p => ['red', 'green', 'blue'].includes(p.name));
    result.hasNormals = vertexProperties.some(p => ['nx', 'ny', 'nz'].includes(p.name));
    result.hasIntensity = vertexProperties.some(p => PlyParser.isIntensityField(p.name));
    result.isGaussianSplat = isGaussianSplatLayout(vertexProperties.map(p => p.name));
    if (result.isGaussianSplat) {
      // Colors are synthesized from f_dc_0..2 by the webview-side binary
      // reader (binaryDataHandlers.ts), which keys off this flag. nx/ny/nz
      // are all zeros in 3DGS exports — dropped (see parse() above).
      result.hasColors = true;
      result.hasNormals = false;
    }

    // Calculate binary data start position
    const headerEndPos = headerEndIndex + 'end_header'.length;
    let dataStartPos = headerEndPos;
    if (data[dataStartPos] === 13) {
      dataStartPos++;
      if (data[dataStartPos] === 10) {dataStartPos++;}
    } else if (data[dataStartPos] === 10) {
      dataStartPos++;
    } else {
      throw new Error('Invalid PLY file: end_header is not terminated by a newline');
    }

    const totalTime = performance.now();
    log(`🎯 ULTIMATE: Header-only parsing took ${(totalTime - parseStartTime).toFixed(1)}ms`);

    return {
      headerInfo: result,
      binaryDataStart: dataStartPos,
    };
  }
}
