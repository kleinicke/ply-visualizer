import { PlyData, PlyVertex } from './plyParser';

/**
 * NPY Parser for point cloud data (arrays ending with dimension 3 containing XYZ coordinates)
 * Converts NPY arrays with shape [..., 3] directly to point cloud format
 *
 * Supports arrays of ANY number of dimensions as long as the last dimension is 3:
 * - (N, 3) - Simple point list
 * - (H, W, 3) - 2D grid of points
 * - (B, H, W, 3) - Batched 2D grids
 * - (T, B, H, W, 3) - Time series of batched grids
 * - (d1, d2, d3, d4, d5, 3) - 5D+ arrays are fully supported
 *
 * The array is flattened and processed as consecutive XYZ triplets.
 */

/**
 * Minimal NPY header parser - extracts shape and dtype information
 */
function parseNpyHeader(view: DataView): { shape: number[]; dtype: string; dataOffset: number } {
  // NPY magic number is '\x93NUMPY'
  const magic = new Uint8Array(view.buffer, 0, 6);
  const expectedMagic = new Uint8Array([0x93, 0x4e, 0x55, 0x4d, 0x50, 0x59]); // '\x93NUMPY'

  for (let i = 0; i < 6; i++) {
    if (magic[i] !== expectedMagic[i]) {
      throw new Error('Invalid NPY file: missing magic number');
    }
  }

  // Version (1 byte major, 1 byte minor)
  const majorVersion = view.getUint8(6);
  const minorVersion = view.getUint8(7);

  if (majorVersion !== 1 && majorVersion !== 2) {
    throw new Error(`Unsupported NPY version: ${majorVersion}.${minorVersion}`);
  }

  // Header length
  let headerLength: number;
  let headerStart: number;

  if (majorVersion === 1) {
    headerLength = view.getUint16(8, true); // little endian
    headerStart = 10;
  } else {
    headerLength = view.getUint32(8, true); // little endian
    headerStart = 12;
  }

  // Parse header dictionary
  const headerBytes = new Uint8Array(view.buffer, headerStart, headerLength);
  const headerString = new TextDecoder('latin1').decode(headerBytes);

  // Extract shape using regex
  const shapeMatch = headerString.match(/'shape':\s*\(([^)]+)\)/);
  if (!shapeMatch) {
    throw new Error('Could not parse shape from NPY header');
  }

  const shapeStr = shapeMatch[1].trim();
  const shape = shapeStr
    .split(',')
    .map(s => {
      const num = parseInt(s.trim(), 10);
      if (isNaN(num)) {
        throw new Error(`Invalid shape dimension: ${s}`);
      }
      return num;
    })
    .filter(n => n > 0); // Remove trailing zeros from shape like (480, 640,)

  // Extract dtype
  const dtypeMatch = headerString.match(/'descr':\s*'([^']+)'/);
  if (!dtypeMatch) {
    throw new Error('Could not parse dtype from NPY header');
  }

  const dtype = dtypeMatch[1];
  const dataOffset = headerStart + headerLength;

  return { shape, dtype, dataOffset };
}

/**
 * Check if NPY array contains XYZ point cloud data
 * Returns true if array ends with dimension 3 (indicating XYZ coordinates)
 * Supports arrays of any number of dimensions: (N,3), (H,W,3), (B,H,W,3), etc.
 */
export function isNpyPointCloudData(arrayBuffer: ArrayBuffer): boolean {
  try {
    const view = new DataView(arrayBuffer);
    const { shape } = parseNpyHeader(view);

    // Check if last dimension is 3 (XYZ coordinates)
    return shape.length >= 1 && shape[shape.length - 1] === 3;
  } catch (error) {
    return false;
  }
}

export class NpyParser {
  async parse(data: Uint8Array, timingCallback?: (message: string) => void): Promise<PlyData> {
    const parseStartTime = performance.now();
    const log = timingCallback || console.log;
    log(`📋 Parser: Starting NPY point cloud parsing (${data.length} bytes)...`);

    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const { shape, dtype, dataOffset } = parseNpyHeader(view);

    // Validate that this is XYZ point cloud data
    if (shape.length < 1 || shape[shape.length - 1] !== 3) {
      throw new Error(
        `Expected NPY array ending with dimension 3 for XYZ coordinates, got shape [${shape.join(', ')}]`
      );
    }

    // Calculate number of points
    // Flatten all dimensions - array can have any number of dimensions as long as it ends with 3
    const totalElements = shape.reduce((a, b) => a * b, 1);
    const numPoints = totalElements / 3; // Since last dim is 3

    log(
      `📋 Parser: NPY array shape [${shape.join(', ')}] contains ${numPoints} points (${shape.length}D array flattened)`
    );

    // Parse data based on dtype
    let rawData: Float32Array;
    const expectedElements = totalElements;

    if (dtype === '<f4' || dtype === '=f4' || dtype === '>f4') {
      // 32-bit float
      const elementSize = 4;
      const expectedBytes = expectedElements * elementSize;
      const availableBytes = data.byteLength - dataOffset;

      if (availableBytes < expectedBytes) {
        throw new Error(
          `Insufficient data: expected ${expectedBytes} bytes, got ${availableBytes}`
        );
      }

      if (dtype === '>f4') {
        // Big endian - need to swap bytes
        rawData = new Float32Array(expectedElements);
        const bytes = new Uint8Array(data.buffer, data.byteOffset + dataOffset, expectedBytes);
        for (let i = 0; i < expectedElements; i++) {
          const offset = i * 4;
          const b0 = bytes[offset + 3];
          const b1 = bytes[offset + 2];
          const b2 = bytes[offset + 1];
          const b3 = bytes[offset + 0];
          const swappedBytes = new Uint8Array([b0, b1, b2, b3]);
          rawData[i] = new Float32Array(swappedBytes.buffer)[0];
        }
      } else {
        rawData = new Float32Array(data.buffer, data.byteOffset + dataOffset, expectedElements);
      }
    } else if (dtype === '<f8' || dtype === '=f8' || dtype === '>f8') {
      // 64-bit float - convert to 32-bit
      const elementSize = 8;
      const expectedBytes = expectedElements * elementSize;
      const availableBytes = data.byteLength - dataOffset;

      if (availableBytes < expectedBytes) {
        throw new Error(
          `Insufficient data: expected ${expectedBytes} bytes, got ${availableBytes}`
        );
      }

      const rawDataArray = new Float64Array(
        data.buffer,
        data.byteOffset + dataOffset,
        expectedElements
      );
      rawData = new Float32Array(expectedElements);

      for (let i = 0; i < expectedElements; i++) {
        rawData[i] = rawDataArray[i];
      }
    } else if (
      dtype.startsWith('<i') ||
      dtype.startsWith('=i') ||
      dtype.startsWith('>i') ||
      dtype.startsWith('<u') ||
      dtype.startsWith('=u') ||
      dtype.startsWith('>u')
    ) {
      // Integer types - convert to float
      const isUnsigned = dtype.includes('u');
      const bytesPerElement = parseInt(dtype.slice(-1), 10);

      if (![1, 2, 4, 8].includes(bytesPerElement)) {
        throw new Error(`Unsupported integer size: ${bytesPerElement} bytes`);
      }

      const expectedBytes = expectedElements * bytesPerElement;
      const availableBytes = data.byteLength - dataOffset;

      if (availableBytes < expectedBytes) {
        throw new Error(
          `Insufficient data: expected ${expectedBytes} bytes, got ${availableBytes}`
        );
      }

      rawData = new Float32Array(expectedElements);
      const dataView = new DataView(data.buffer, data.byteOffset + dataOffset);
      const littleEndian = dtype.startsWith('<') || dtype.startsWith('=');

      for (let i = 0; i < expectedElements; i++) {
        const offset = i * bytesPerElement;
        let value: number;

        if (bytesPerElement === 1) {
          value = isUnsigned ? dataView.getUint8(offset) : dataView.getInt8(offset);
        } else if (bytesPerElement === 2) {
          value = isUnsigned
            ? dataView.getUint16(offset, littleEndian)
            : dataView.getInt16(offset, littleEndian);
        } else if (bytesPerElement === 4) {
          value = isUnsigned
            ? dataView.getUint32(offset, littleEndian)
            : dataView.getInt32(offset, littleEndian);
        } else {
          // 8-byte integers - use BigInt and convert
          if (isUnsigned) {
            value = Number(dataView.getBigUint64(offset, littleEndian));
          } else {
            value = Number(dataView.getBigInt64(offset, littleEndian));
          }
        }

        rawData[i] = value;
      }
    } else {
      throw new Error(
        `Unsupported dtype: ${dtype}. Supported types: float32, float64, int8, int16, int32, int64, uint8, uint16, uint32, uint64.`
      );
    }

    // Convert raw data to vertices
    const vertices: PlyVertex[] = [];
    for (let i = 0; i < numPoints; i++) {
      const idx = i * 3;
      vertices.push({
        x: rawData[idx],
        y: rawData[idx + 1],
        z: rawData[idx + 2],
      });
    }

    const parseEndTime = performance.now();
    log(
      `✅ Parser: NPY point cloud parsing completed in ${(parseEndTime - parseStartTime).toFixed(2)}ms`
    );

    const result: PlyData = {
      vertices,
      faces: [],
      format: 'ascii', // NPY is technically binary but we'll call it ascii for consistency
      version: '1.0',
      comments: [
        `Converted from NPY array with shape [${shape.join(', ')}]`,
        `Data type: ${dtype}`,
      ],
      vertexCount: vertices.length,
      faceCount: 0,
      hasColors: false,
      hasNormals: false,
    };

    return result;
  }
}
