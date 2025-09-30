/**
 * Binary Data Parser for Point Cloud Messages
 *
 * Parses structured binary data from PLY files sent by the VS Code extension.
 */

export interface ParsedPointCloudData {
  positions: Float32Array;
  colors?: Float32Array;
  normals?: Float32Array;
  vertexCount: number;
}

export interface PointCloudMessage {
  type: string;
  fileName: string;
  vertexCount: number;
  faceCount: number;
  hasColors: boolean;
  hasNormals: boolean;
  format: string;
  rawBinaryData?: ArrayBuffer;
  binaryData?: ArrayBuffer;
  vertexStride: number;
  propertyOffsets: number[];
  littleEndian: boolean;
}

function getTypeSize(type: string): number {
  switch (type) {
    case 'char':
    case 'uchar':
      return 1;
    case 'short':
    case 'ushort':
      return 2;
    case 'int':
    case 'uint':
    case 'float':
      return 4;
    case 'double':
      return 8;
    default:
      return 4; // Default to float size
  }
}

export function parsePointCloudBinaryData(message: PointCloudMessage): ParsedPointCloudData {
  // Check for binary data in different possible properties
  const binaryData = message.rawBinaryData || message.binaryData;
  if (!binaryData) {
    throw new Error('No binary data found in message');
  }

  console.log('🔍 Parser debug:', {
    fileName: message.fileName,
    hasColors: message.hasColors,
    hasNormals: message.hasNormals,
    vertexStride: message.vertexStride,
    dataSize: binaryData.byteLength,
  });

  // Parse binary data using structured format information
  const positions = new Float32Array(message.vertexCount * 3);
  const colors = message.hasColors ? new Float32Array(message.vertexCount * 3) : undefined;
  const normals = message.hasNormals ? new Float32Array(message.vertexCount * 3) : undefined;

  const view = new DataView(binaryData);
  const stride = message.vertexStride || 51;
  const littleEndian = message.littleEndian !== false;

  // Extract property offsets from the complex structure
  const propertyOffsets = message.propertyOffsets || [];
  console.log('🔍 Property offsets (raw):', propertyOffsets);

  // Parse the property structure from existing PLY parser
  // The propertyOffsets comes from Array.from(Map.entries()) so it's [name, {offset, type}, name, {offset, type}, ...]
  const propertyMap = new Map();

  // Check if it's legacy format (simple array of numbers) or proper format from PLY parser
  const isLegacyFormat = propertyOffsets.length > 0 && typeof propertyOffsets[0] === 'number';

  if (isLegacyFormat) {
    // Legacy format: [0, 4, 8] - assume x, y, z positions
    console.log('🔍 Using legacy propertyOffsets format');
    const defaultProps = ['x', 'y', 'z'];
    for (let i = 0; i < Math.min(propertyOffsets.length, defaultProps.length); i++) {
      propertyMap.set(defaultProps[i], {
        offset: propertyOffsets[i] as number,
        type: 'float',
        size: 4,
      });
      console.log(`🔍 Legacy mapped "${defaultProps[i]}" at offset ${propertyOffsets[i]}`);
    }
  } else {
    // Proper format from PLY parser: ['x', {offset: 0, type: 'float'}, 'y', {offset: 4, type: 'float'}, ...]
    console.log('🔍 Using PLY parser propertyOffsets format');
    for (let i = 0; i < propertyOffsets.length; i += 2) {
      const propName = propertyOffsets[i];
      const propMeta = propertyOffsets[i + 1];

      if (typeof propName === 'string' && propMeta && typeof propMeta === 'object') {
        // Use the offset already calculated by the PLY parser, don't recalculate!
        const existingOffset = (propMeta as any).offset;
        const type = (propMeta as any).type;

        propertyMap.set(propName, {
          offset: existingOffset,
          type: type,
          size: getTypeSize(type),
        });
        console.log(`🔍 Mapped property "${propName}" at offset ${existingOffset}, type ${type}`);
      }
    }
  }

  console.log('🔍 Property map:', Object.fromEntries(propertyMap));

  // Extract position offsets
  let posOffset = [0, 4, 8]; // default fallback
  if (propertyMap.has('x') && propertyMap.has('y') && propertyMap.has('z')) {
    posOffset = [
      propertyMap.get('x').offset,
      propertyMap.get('y').offset,
      propertyMap.get('z').offset,
    ];
  }

  // Extract normal offsets
  let normalOffset: number[] | null = null;
  if (propertyMap.has('nx') && propertyMap.has('ny') && propertyMap.has('nz')) {
    normalOffset = [
      propertyMap.get('nx').offset,
      propertyMap.get('ny').offset,
      propertyMap.get('nz').offset,
    ];
  }

  // Extract color offsets
  let colorOffset: number[] | null = null;
  if (propertyMap.has('red') && propertyMap.has('green') && propertyMap.has('blue')) {
    colorOffset = [
      propertyMap.get('red').offset,
      propertyMap.get('green').offset,
      propertyMap.get('blue').offset,
    ];
  }

  console.log('🔍 Deduced layout:', {
    position: posOffset,
    normal: normalOffset,
    color: colorOffset,
    stride,
  });

  // Debug: Dump first few bytes to understand the actual data structure
  console.log('🔍 First 32 bytes of binary data:');
  const debugBytes = new Uint8Array(binaryData, 0, Math.min(32, binaryData.byteLength));
  const debugHex = Array.from(debugBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join(' ');
  console.log(debugHex);

  // Also try reading as floats to see if we can spot the pattern
  console.log('🔍 First 8 float32 values (little endian):');
  for (let i = 0; i < Math.min(8, binaryData.byteLength / 4); i++) {
    const value = view.getFloat32(i * 4, true);
    console.log(`  [${i * 4}]: ${value}`);
  }

  let nanCount = 0;
  for (let i = 0; i < message.vertexCount; i++) {
    const vertexOffset = i * stride;

    // Read position using deduced offsets
    const x = view.getFloat32(vertexOffset + posOffset[0], littleEndian);
    const y = view.getFloat32(vertexOffset + posOffset[1], littleEndian);
    const z = view.getFloat32(vertexOffset + posOffset[2], littleEndian);

    // Filter out NaN values - replace with 0
    positions[i * 3] = isNaN(x) ? 0 : x;
    positions[i * 3 + 1] = isNaN(y) ? 0 : y;
    positions[i * 3 + 2] = isNaN(z) ? 0 : z;

    // Debug first few vertices
    if (i < 3) {
      console.log(`Vertex ${i}:`, {
        x,
        y,
        z,
        offset: vertexOffset,
        valid: !isNaN(x) && !isNaN(y) && !isNaN(z),
      });
    }

    // Count NaN values
    if (isNaN(x) || isNaN(y) || isNaN(z)) {
      nanCount++;
      if (nanCount <= 5) {
        // Only log first 5 to avoid spam
        console.warn(`NaN detected in vertex ${i} at offset ${vertexOffset}:`, { x, y, z });
      }
    }

    // Read normals if available
    if (normals && normalOffset) {
      const nx = view.getFloat32(vertexOffset + normalOffset[0], littleEndian);
      const ny = view.getFloat32(vertexOffset + normalOffset[1], littleEndian);
      const nz = view.getFloat32(vertexOffset + normalOffset[2], littleEndian);

      normals[i * 3] = isNaN(nx) ? 0 : nx;
      normals[i * 3 + 1] = isNaN(ny) ? 0 : ny;
      normals[i * 3 + 2] = isNaN(nz) ? 1 : nz; // Default to up vector
    }

    // Read colors if available
    if (colors && colorOffset) {
      const r = view.getUint8(vertexOffset + colorOffset[0]) / 255.0;
      const g = view.getUint8(vertexOffset + colorOffset[1]) / 255.0;
      const b = view.getUint8(vertexOffset + colorOffset[2]) / 255.0;

      colors[i * 3] = r;
      colors[i * 3 + 1] = g;
      colors[i * 3 + 2] = b;
    }
  }

  if (nanCount > 0) {
    console.warn(`⚠️  Filtered ${nanCount} NaN values out of ${message.vertexCount} vertices`);
  }

  return {
    positions,
    colors,
    normals,
    vertexCount: message.vertexCount,
  };
}
