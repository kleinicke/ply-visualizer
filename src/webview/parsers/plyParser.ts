export interface PlyVertex {
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
}

export interface PlyFace {
  indices: number[];
}

export interface PlyData {
  vertices: PlyVertex[];
  faces: PlyFace[];
  format: 'ascii' | 'binary_little_endian' | 'binary_big_endian';
  version: string;
  comments: string[];
  vertexCount: number;
  faceCount: number;
  hasColors: boolean;
  hasNormals: boolean;
  fileName?: string;
  fileIndex?: number;
}

export class PlyParser {
  private dataView: DataView | null = null;
  private offset = 0;
  private littleEndian = true;

  async parse(data: Uint8Array, timingCallback?: (message: string) => void): Promise<PlyData> {
    const parseStartTime = performance.now();
    const log = timingCallback || console.log;
    log(`📋 Parser: Starting PLY/XYZ parsing (${data.length} bytes)...`);

    const result: PlyData = {
      vertices: [],
      faces: [],
      format: 'ascii',
      version: '1.0',
      comments: [],
      vertexCount: 0,
      faceCount: 0,
      hasColors: false,
      hasNormals: false,
    };

    // Only decode enough bytes to find the header (major optimization!)
    const headerStartTime = performance.now();
    const decoder = new TextDecoder('utf-8');

    // First, decode just the first 4KB to find header end
    const headerSearchSize = Math.min(4096, data.length);
    let headerText = decoder.decode(data.slice(0, headerSearchSize));

    // Check if this is an XYZ file (no header, just coordinates)
    if (!headerText.startsWith('ply')) {
      // Try to detect XYZ format by checking if first line has 3-6 space-separated numbers
      const firstLine = headerText.split('\n')[0].trim();
      const values = firstLine.split(/\s+/);

      if (
        values.length >= 3 &&
        values.length <= 6 &&
        !isNaN(parseFloat(values[0])) &&
        !isNaN(parseFloat(values[1])) &&
        !isNaN(parseFloat(values[2]))
      ) {
        log(`📋 Parser: Detected XYZ format, treating as headerless PLY`);
        return this.parseXyzData(data, result, log);
      }

      throw new Error('Invalid PLY/XYZ file: missing PLY header or invalid XYZ format');
    }

    let headerEndIndex = headerText.indexOf('end_header');

    // If not found in first 4KB, expand search (rare case)
    if (headerEndIndex === -1) {
      const expandedSize = Math.min(16384, data.length); // Try 16KB
      headerText = decoder.decode(data.slice(0, expandedSize));
      headerEndIndex = headerText.indexOf('end_header');

      if (headerEndIndex === -1) {
        throw new Error('Invalid PLY file: missing end_header');
      }
    }

    const headerDecodeTime = performance.now();
    log(
      `🔤 Parser: Header decode took ${(headerDecodeTime - headerStartTime).toFixed(1)}ms (${headerSearchSize} bytes instead of ${data.length})`
    );
    const headerLines = headerText.split('\n');

    // Parse header
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

    // Check for colors and normals
    result.hasColors = vertexProperties.some(p => ['red', 'green', 'blue'].includes(p.name));
    result.hasNormals = vertexProperties.some(p => ['nx', 'ny', 'nz'].includes(p.name));

    // Find data start position
    const headerEndPos = headerEndIndex + 'end_header'.length;
    let dataStartPos = headerEndPos;
    while (dataStartPos < data.length && (data[dataStartPos] === 10 || data[dataStartPos] === 13)) {
      dataStartPos++;
    }

    const dataParseStartTime = performance.now();
    if (result.format === 'ascii') {
      log(`📝 Parser: Starting ASCII data parsing (${result.vertexCount} vertices)...`);
      this.parseAsciiDataStreaming(
        data,
        dataStartPos,
        result,
        vertexProperties,
        faceProperties,
        log
      );
    } else {
      log(`🔢 Parser: Starting binary data parsing (${result.vertexCount} vertices)...`);
      const binaryParseStartTime = performance.now();
      this.parseBinaryDataOptimized(
        data,
        dataStartPos,
        result,
        vertexProperties,
        faceProperties,
        log
      );
      const binaryParseEndTime = performance.now();
      log(
        `🚀 Parser: Binary parsing took ${(binaryParseEndTime - binaryParseStartTime).toFixed(1)}ms`
      );
    }
    const dataParseTime = performance.now();
    log(`⚡ Parser: Data parsing took ${(dataParseTime - dataParseStartTime).toFixed(1)}ms`);

    const totalParseTime = performance.now();
    log(`🎯 Parser: Total parse time ${(totalParseTime - parseStartTime).toFixed(1)}ms`);

    return result;
  }

  private parseAsciiDataOptimized(
    data: Uint8Array,
    startPos: number,
    result: PlyData,
    vertexProperties: Array<{ name: string; type: string }>,
    faceProperties: Array<{ name: string; type: string }>,
    log: (message: string) => void = console.log
  ): void {
    const decoder = new TextDecoder('utf-8');
    const text = decoder.decode(data.slice(startPos));
    const lines = text.split('\n').filter(line => line.trim());

    // Pre-allocate vertices array for better performance
    result.vertices = new Array(result.vertexCount);

    let lineIndex = 0;

    // Create property index map for faster lookup
    const propMap = new Map<string, number>();
    vertexProperties.forEach((prop, index) => propMap.set(prop.name, index));

    // Parse vertices with optimized approach
    for (let i = 0; i < result.vertexCount && lineIndex < lines.length; i++, lineIndex++) {
      const values = lines[lineIndex].trim().split(/\s+/);
      const vertex: PlyVertex = { x: 0, y: 0, z: 0 };

      // Use direct indexing instead of searching
      const xIdx = propMap.get('x');
      const yIdx = propMap.get('y');
      const zIdx = propMap.get('z');

      if (xIdx !== undefined) {vertex.x = parseFloat(values[xIdx]);}
      if (yIdx !== undefined) {vertex.y = parseFloat(values[yIdx]);}
      if (zIdx !== undefined) {vertex.z = parseFloat(values[zIdx]);}

      // Only parse colors if they exist
      if (result.hasColors) {
        const redIdx = propMap.get('red');
        const greenIdx = propMap.get('green');
        const blueIdx = propMap.get('blue');

        if (redIdx !== undefined) {vertex.red = parseFloat(values[redIdx]);}
        if (greenIdx !== undefined) {vertex.green = parseFloat(values[greenIdx]);}
        if (blueIdx !== undefined) {vertex.blue = parseFloat(values[blueIdx]);}
      }

      // Only parse normals if they exist
      if (result.hasNormals) {
        const nxIdx = propMap.get('nx');
        const nyIdx = propMap.get('ny');
        const nzIdx = propMap.get('nz');

        if (nxIdx !== undefined) {vertex.nx = parseFloat(values[nxIdx]);}
        if (nyIdx !== undefined) {vertex.ny = parseFloat(values[nyIdx]);}
        if (nzIdx !== undefined) {vertex.nz = parseFloat(values[nzIdx]);}
      }

      result.vertices[i] = vertex;
    }

    // Pre-allocate faces array
    if (result.faceCount > 0) {
      result.faces = new Array(result.faceCount);

      // Parse faces (ASCII: first value is count, followed by indices)
      for (let i = 0; i < result.faceCount && lineIndex < lines.length; i++, lineIndex++) {
        const tokens = lines[lineIndex].trim().split(/\s+/);
        if (tokens.length > 0) {
          const vertexCount = parseInt(tokens[0], 10);
          const indices = new Array(vertexCount);
          for (let j = 0; j < vertexCount; j++) {
            indices[j] = parseInt(tokens[1 + j], 10);
          }
          result.faces[i] = { indices };
        }
      }
    }
  }

  private parseAsciiDataStreaming(
    data: Uint8Array,
    startPos: number,
    result: PlyData,
    vertexProperties: Array<{ name: string; type: string }>,
    faceProperties: Array<{ name: string; type: string }>,
    log: (message: string) => void = console.log
  ): void {
    // Pre-allocate typed arrays to avoid massive object graphs
    const useColors = result.hasColors;
    const useNormals = result.hasNormals;
    const vertexCount = result.vertexCount;
    const faceCount = result.faceCount;

    const positions = new Float32Array(vertexCount * 3);
    const colors = useColors ? new Uint8Array(vertexCount * 3) : null;
    const normals = useNormals ? new Float32Array(vertexCount * 3) : null;

    // Build fast property index map
    const propIndex = new Map<string, number>();
    vertexProperties.forEach((p, i) => propIndex.set(p.name, i));
    const xIdx = propIndex.get('x');
    const yIdx = propIndex.get('y');
    const zIdx = propIndex.get('z');
    const rIdx = useColors ? propIndex.get('red') : undefined;
    const gIdx = useColors ? propIndex.get('green') : undefined;
    const bIdx = useColors ? propIndex.get('blue') : undefined;
    const nxIdx = useNormals ? propIndex.get('nx') : undefined;
    const nyIdx = useNormals ? propIndex.get('ny') : undefined;
    const nzIdx = useNormals ? propIndex.get('nz') : undefined;

    // Stream-decode ASCII payload to avoid gigantic intermediate strings
    const decoder = new TextDecoder('utf-8');
    const chunkSize = 8 * 1024 * 1024; // 8 MB chunks
    let pos = startPos;
    let carry = '';
    let verticesParsed = 0;
    let facesParsed = 0;

    // Pre-allocate faces if needed
    if (faceCount > 0) {
      result.faces = new Array(faceCount);
    }

    while (pos < data.length && (verticesParsed < vertexCount || facesParsed < faceCount)) {
      const end = Math.min(pos + chunkSize, data.length);
      // stream=true when not at the end to keep decoder state across boundaries
      const chunkText = decoder.decode(data.subarray(pos, end), { stream: end < data.length });
      pos = end;

      let combined = carry + chunkText;
      let lines = combined.split(/\r?\n/);
      // keep the last partial line in carry if not at the end
      if (end < data.length) {
        carry = lines.pop() || '';
      } else {
        carry = '';
      }

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) {
          continue;
        }

        if (verticesParsed < vertexCount) {
          // Parse vertex line
          const values = line.split(/\s+/);
          const base = verticesParsed * 3;

          if (xIdx !== undefined) {positions[base] = parseFloat(values[xIdx]);}
          if (yIdx !== undefined) {positions[base + 1] = parseFloat(values[yIdx]);}
          if (zIdx !== undefined) {positions[base + 2] = parseFloat(values[zIdx]);}

          if (colors && rIdx !== undefined && gIdx !== undefined && bIdx !== undefined) {
            colors[base] = (values[rIdx] !== undefined ? parseFloat(values[rIdx]) : 0) as number;
            colors[base + 1] = (
              values[gIdx] !== undefined ? parseFloat(values[gIdx]) : 0
            ) as number;
            colors[base + 2] = (
              values[bIdx] !== undefined ? parseFloat(values[bIdx]) : 0
            ) as number;
          }

          if (normals && nxIdx !== undefined && nyIdx !== undefined && nzIdx !== undefined) {
            normals[base] = values[nxIdx] !== undefined ? parseFloat(values[nxIdx]) : 0;
            normals[base + 1] = values[nyIdx] !== undefined ? parseFloat(values[nyIdx]) : 0;
            normals[base + 2] = values[nzIdx] !== undefined ? parseFloat(values[nzIdx]) : 0;
          }

          verticesParsed++;

          if (verticesParsed % 1000000 === 0) {
            log(`📊 Parser: Parsed ${verticesParsed} / ${vertexCount} ASCII vertices`);
          }
          continue;
        }

        if (faceCount > 0 && facesParsed < faceCount) {
          const tokens = line.split(/\s+/);
          const vCount = parseInt(tokens[0], 10);
          const indices = new Array(vCount);
          for (let j = 0; j < vCount; j++) {
            indices[j] = parseInt(tokens[1 + j], 10);
          }
          result.faces[facesParsed] = { indices };
          facesParsed++;
          continue;
        }

        // Extra lines after declared counts are ignored
      }
    }

    // If any remaining carry exists at EOF, process it
    if (carry && (verticesParsed < vertexCount || facesParsed < faceCount)) {
      const line = carry.trim();
      if (line) {
        if (verticesParsed < vertexCount) {
          const values = line.split(/\s+/);
          const base = verticesParsed * 3;
          if (xIdx !== undefined) {positions[base] = parseFloat(values[xIdx]);}
          if (yIdx !== undefined) {positions[base + 1] = parseFloat(values[yIdx]);}
          if (zIdx !== undefined) {positions[base + 2] = parseFloat(values[zIdx]);}
          if (colors && rIdx !== undefined && gIdx !== undefined && bIdx !== undefined) {
            colors[base] = (values[rIdx] !== undefined ? parseFloat(values[rIdx]) : 0) as number;
            colors[base + 1] = (
              values[gIdx] !== undefined ? parseFloat(values[gIdx]) : 0
            ) as number;
            colors[base + 2] = (
              values[bIdx] !== undefined ? parseFloat(values[bIdx]) : 0
            ) as number;
          }
          if (normals && nxIdx !== undefined && nyIdx !== undefined && nzIdx !== undefined) {
            normals[base] = values[nxIdx] !== undefined ? parseFloat(values[nxIdx]) : 0;
            normals[base + 1] = values[nyIdx] !== undefined ? parseFloat(values[nyIdx]) : 0;
            normals[base + 2] = values[nzIdx] !== undefined ? parseFloat(values[nzIdx]) : 0;
          }
          verticesParsed++;
        } else if (faceCount > 0 && facesParsed < faceCount) {
          const tokens = line.split(/\s+/);
          const vCount = parseInt(tokens[0], 10);
          const indices = new Array(vCount);
          for (let j = 0; j < vCount; j++) {
            indices[j] = parseInt(tokens[1 + j], 10);
          }
          result.faces[facesParsed] = { indices };
          facesParsed++;
        }
      }
    }

    if (verticesParsed !== vertexCount) {
      log(`⚠️ Parser: Expected ${vertexCount} vertices, parsed ${verticesParsed}`);
    }
    if (faceCount > 0 && facesParsed !== faceCount) {
      log(`⚠️ Parser: Expected ${faceCount} faces, parsed ${facesParsed}`);
    }

    // Store typed arrays on result for zero-copy downstream
    (result as any).positionsArray = positions;
    (result as any).colorsArray = colors;
    (result as any).normalsArray = normals;
    (result as any).useTypedArrays = true;
    result.vertices = [];
  }

  private parseBinaryDataOptimized(
    data: Uint8Array,
    startPos: number,
    result: PlyData,
    vertexProperties: Array<{ name: string; type: string }>,
    faceProperties: Array<{ name: string; type: string }>,
    log: (message: string) => void = console.log
  ): void {
    this.dataView = new DataView(data.buffer, data.byteOffset + startPos);
    this.offset = 0;

    // Create property index maps for fast lookup
    const propIndexMap = new Map<string, number>();
    const propTypeMap = new Map<string, string>();
    vertexProperties.forEach((prop, index) => {
      propIndexMap.set(prop.name, index);
      propTypeMap.set(prop.name, prop.type);
    });

    // Calculate stride (bytes per vertex)
    let vertexStride = 0;
    for (const prop of vertexProperties) {
      switch (prop.type) {
        case 'char':
        case 'int8':
        case 'uchar':
        case 'uint8':
          vertexStride += 1;
          break;
        case 'short':
        case 'int16':
        case 'ushort':
        case 'uint16':
          vertexStride += 2;
          break;
        case 'int':
        case 'int32':
        case 'uint':
        case 'uint32':
        case 'float':
        case 'float32':
          vertexStride += 4;
          break;
        case 'double':
        case 'float64':
          vertexStride += 8;
          break;
      }
    }

    // Pre-allocate vertices array for better performance
    result.vertices = new Array(result.vertexCount);

    // ULTRA-FAST: Direct TypedArray parsing with zero object allocation
    log(`🚀 Parser: Using zero-allocation direct parsing for ${result.vertexCount} vertices...`);
    const vertexStartTime = performance.now();

    // Create property maps for lightning-fast lookup
    const propIndices = new Map<string, number>();
    vertexProperties.forEach((prop, idx) => propIndices.set(prop.name, idx));

    // Pre-allocate result arrays - NO individual vertex objects!
    const positions = new Float32Array(result.vertexCount * 3);
    const colors = result.hasColors ? new Uint8Array(result.vertexCount * 3) : null;
    const normals = result.hasNormals ? new Float32Array(result.vertexCount * 3) : null;

    // Find property indices once
    const xIdx = propIndices.get('x') ?? -1;
    const yIdx = propIndices.get('y') ?? -1;
    const zIdx = propIndices.get('z') ?? -1;
    const redIdx = propIndices.get('red') ?? -1;
    const greenIdx = propIndices.get('green') ?? -1;
    const blueIdx = propIndices.get('blue') ?? -1;
    const nxIdx = propIndices.get('nx') ?? -1;
    const nyIdx = propIndices.get('ny') ?? -1;
    const nzIdx = propIndices.get('nz') ?? -1;

    // Lightning-fast direct binary parsing
    for (let i = 0; i < result.vertexCount; i++) {
      const i3 = i * 3;

      // Read all properties for this vertex
      for (let propIdx = 0; propIdx < vertexProperties.length; propIdx++) {
        const value = this.readBinaryValueFast(vertexProperties[propIdx].type);

        // Direct array assignment based on property index
        if (propIdx === xIdx) {positions[i3] = value;}
        else if (propIdx === yIdx) {positions[i3 + 1] = value;}
        else if (propIdx === zIdx) {positions[i3 + 2] = value;}
        else if (colors && propIdx === redIdx) {colors[i3] = value;}
        else if (colors && propIdx === greenIdx) {colors[i3 + 1] = value;}
        else if (colors && propIdx === blueIdx) {colors[i3 + 2] = value;}
        else if (normals && propIdx === nxIdx) {normals[i3] = value;}
        else if (normals && propIdx === nyIdx) {normals[i3 + 1] = value;}
        else if (normals && propIdx === nzIdx) {normals[i3 + 2] = value;}
      }
    }

    // REVOLUTIONARY: Skip object creation entirely - store TypedArrays directly!
    log(`🚀 Parser: Skipping object creation - storing raw TypedArrays for maximum performance!`);

    // Store TypedArrays directly in the result (new approach)
    (result as any).positionsArray = positions;
    (result as any).colorsArray = colors;
    (result as any).normalsArray = normals;
    (result as any).useTypedArrays = true;

    // Create minimal vertex array for compatibility (only if really needed)
    result.vertices = [];

    const vertexEndTime = performance.now();
    log(`🎯 Parser: Vertex processing took ${(vertexEndTime - vertexStartTime).toFixed(1)}ms`);

    // Pre-allocate faces array honoring header-declared list types
    if (result.faceCount > 0) {
      result.faces = new Array(result.faceCount);

      // Find the vertex_indices property to get count/index types
      const faceIndexProp = faceProperties.find(
        p => p.name === 'vertex_indices' && p.type === 'list'
      );
      const countType = (faceIndexProp as any)?.countType || 'uchar';
      const indexType = (faceIndexProp as any)?.indexType || 'int';

      for (let i = 0; i < result.faceCount; i++) {
        const vertexCount = this.readBinaryValueFast(countType);
        const indices = new Array(vertexCount);
        for (let j = 0; j < vertexCount; j++) {
          indices[j] = this.readBinaryValueFast(indexType);
        }
        result.faces[i] = { indices };
      }
    }
  }

  private readBinaryValue(type: string): number {
    if (!this.dataView) {
      throw new Error('DataView not initialized');
    }

    let value: number;

    switch (type) {
      case 'char':
      case 'int8':
        value = this.dataView.getInt8(this.offset);
        this.offset += 1;
        break;
      case 'uchar':
      case 'uint8':
        value = this.dataView.getUint8(this.offset);
        this.offset += 1;
        break;
      case 'short':
      case 'int16':
        value = this.dataView.getInt16(this.offset, this.littleEndian);
        this.offset += 2;
        break;
      case 'ushort':
      case 'uint16':
        value = this.dataView.getUint16(this.offset, this.littleEndian);
        this.offset += 2;
        break;
      case 'int':
      case 'int32':
        value = this.dataView.getInt32(this.offset, this.littleEndian);
        this.offset += 4;
        break;
      case 'uint':
      case 'uint32':
        value = this.dataView.getUint32(this.offset, this.littleEndian);
        this.offset += 4;
        break;
      case 'float':
      case 'float32':
        value = this.dataView.getFloat32(this.offset, this.littleEndian);
        this.offset += 4;
        break;
      case 'double':
      case 'float64':
        value = this.dataView.getFloat64(this.offset, this.littleEndian);
        this.offset += 8;
        break;
      default:
        throw new Error(`Unsupported data type: ${type}`);
    }

    return value;
  }

  private readBinaryValueFast(type: string): number {
    if (!this.dataView) {
      throw new Error('DataView not initialized');
    }

    // Optimized inline version with reduced function call overhead
    if (type === 'float' || type === 'float32') {
      const value = this.dataView.getFloat32(this.offset, this.littleEndian);
      this.offset += 4;
      return value;
    } else if (type === 'uchar' || type === 'uint8') {
      const value = this.dataView.getUint8(this.offset);
      this.offset += 1;
      return value;
    } else if (type === 'int' || type === 'int32') {
      const value = this.dataView.getInt32(this.offset, this.littleEndian);
      this.offset += 4;
      return value;
    } else if (type === 'char' || type === 'int8') {
      const value = this.dataView.getInt8(this.offset);
      this.offset += 1;
      return value;
    } else if (type === 'short' || type === 'int16') {
      const value = this.dataView.getInt16(this.offset, this.littleEndian);
      this.offset += 2;
      return value;
    } else if (type === 'ushort' || type === 'uint16') {
      const value = this.dataView.getUint16(this.offset, this.littleEndian);
      this.offset += 2;
      return value;
    } else if (type === 'uint' || type === 'uint32') {
      const value = this.dataView.getUint32(this.offset, this.littleEndian);
      this.offset += 4;
      return value;
    } else if (type === 'double' || type === 'float64') {
      const value = this.dataView.getFloat64(this.offset, this.littleEndian);
      this.offset += 8;
      return value;
    } else {
      throw new Error(`Unsupported data type: ${type}`);
    }
  }

  // ULTIMATE OPTIMIZATION: Extract header + raw binary data without parsing
  async parseHeaderOnly(
    data: Uint8Array,
    timingCallback?: (message: string) => void
  ): Promise<{
    headerInfo: PlyData;
    binaryDataStart: number;
    vertexStride: number;
    propertyOffsets: Map<string, { offset: number; type: string }>;
    faceCountType?: string;
    faceIndexType?: string;
  }> {
    const parseStartTime = performance.now();
    const log = timingCallback || console.log;
    log(`🚀 ULTIMATE: Header-only parsing for direct binary streaming...`);

    // Same header parsing as before
    const result: PlyData = {
      vertices: [],
      faces: [],
      format: 'ascii',
      version: '1.0',
      comments: [],
      vertexCount: 0,
      faceCount: 0,
      hasColors: false,
      hasNormals: false,
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

    // Calculate binary data start position
    const headerEndPos = headerEndIndex + 'end_header'.length;
    let dataStartPos = headerEndPos;
    while (dataStartPos < data.length && (data[dataStartPos] === 10 || data[dataStartPos] === 13)) {
      dataStartPos++;
    }

    // Calculate vertex stride and property offsets for direct binary reading
    let vertexStride = 0;
    const propertyOffsets = new Map<string, { offset: number; type: string }>();

    for (const prop of vertexProperties) {
      propertyOffsets.set(prop.name, { offset: vertexStride, type: prop.type });

      switch (prop.type) {
        case 'char':
        case 'int8':
        case 'uchar':
        case 'uint8':
          vertexStride += 1;
          break;
        case 'short':
        case 'int16':
        case 'ushort':
        case 'uint16':
          vertexStride += 2;
          break;
        case 'int':
        case 'int32':
        case 'uint':
        case 'uint32':
        case 'float':
        case 'float32':
          vertexStride += 4;
          break;
        case 'double':
        case 'float64':
          vertexStride += 8;
          break;
      }
    }

    // Extract face list types if present
    let faceCountType: string | undefined;
    let faceIndexType: string | undefined;
    let faceIndexProp = faceProperties.find(p => p.name === 'vertex_indices' && p.type === 'list');
    if (!faceIndexProp) {
      // Fallback: take the first list-type face property if name differs
      faceIndexProp = faceProperties.find(p => p.type === 'list');
    }
    if (faceIndexProp) {
      faceCountType = faceIndexProp.countType;
      faceIndexType = faceIndexProp.indexType;
    }

    const totalTime = performance.now();
    log(`🎯 ULTIMATE: Header-only parsing took ${(totalTime - parseStartTime).toFixed(1)}ms`);

    return {
      headerInfo: result,
      binaryDataStart: dataStartPos,
      vertexStride,
      propertyOffsets,
      faceCountType,
      faceIndexType,
    };
  }

  private parseXyzData(data: Uint8Array, result: PlyData, log: (message: string) => void): PlyData {
    const decoder = new TextDecoder('utf-8');
    const text = decoder.decode(data);
    const lines = text.split('\n').filter(line => line.trim());

    log(`📝 Parser: XYZ format detected, parsing ${lines.length} lines...`);

    // Collect valid vertices instead of pre-allocating
    const validVertices: PlyVertex[] = [];
    let skippedLines = 0;

    // Parse each line as X Y Z [R] [G] [B]
    for (let i = 0; i < lines.length; i++) {
      const values = lines[i].trim().split(/\s+/);

      if (values.length < 3) {
        skippedLines++;
        if (skippedLines <= 10) {
          // Only log first 10 skipped lines to avoid spam
          log(`⚠️ Parser: Skipping invalid line ${i + 1}: ${lines[i]}`);
        }
        continue;
      }

      // Validate that the first 3 values are valid numbers
      const x = parseFloat(values[0]);
      const y = parseFloat(values[1]);
      const z = parseFloat(values[2]);

      if (isNaN(x) || isNaN(y) || isNaN(z)) {
        skippedLines++;
        if (skippedLines <= 10) {
          log(`⚠️ Parser: Skipping line with invalid numbers ${i + 1}: ${lines[i]}`);
        }
        continue;
      }

      const vertex: PlyVertex = { x, y, z };

      // Check for RGB values (optional)
      if (values.length >= 6) {
        const red = parseFloat(values[3]);
        const green = parseFloat(values[4]);
        const blue = parseFloat(values[5]);

        if (!isNaN(red) && !isNaN(green) && !isNaN(blue)) {
          vertex.red = red;
          vertex.green = green;
          vertex.blue = blue;
          result.hasColors = true;
        }
      }

      validVertices.push(vertex);

      // Progress update every 1 million vertices
      if (validVertices.length % 1000000 === 0) {
        log(`📊 Parser: Processed ${validVertices.length} valid vertices...`);
      }
    }

    result.vertices = validVertices;
    result.vertexCount = validVertices.length;

    if (skippedLines > 0) {
      log(`⚠️ Parser: Skipped ${skippedLines} invalid lines`);
    }

    log(
      `✅ Parser: XYZ parsing complete - ${result.vertexCount} valid vertices${result.hasColors ? ' with colors' : ''}`
    );
    return result;
  }
}
