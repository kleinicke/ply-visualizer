import { DepthReader, DepthReaderResult, DepthImage, DepthMetadata, DepthKind } from '../types';

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
      if (isNaN(num)) {throw new Error(`Invalid shape dimension: ${s}`);}
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
 * Parse NPZ file (ZIP format containing multiple NPY files)
 */
function parseNpzFile(arrayBuffer: ArrayBuffer): {
  [key: string]: { data: Float32Array; shape: number[]; dtype: string };
} {
  const view = new DataView(arrayBuffer);
  const results: { [key: string]: { data: Float32Array; shape: number[]; dtype: string } } = {};

  // Simple ZIP parser - look for local file headers
  let offset = 0;

  while (offset < arrayBuffer.byteLength - 4) {
    // Check for local file header signature (0x04034b50)
    const signature = view.getUint32(offset, true);
    if (signature !== 0x04034b50) {
      offset++;
      continue;
    }

    // Parse ZIP local file header
    const version = view.getUint16(offset + 4, true);
    const flags = view.getUint16(offset + 6, true);
    const compressionMethod = view.getUint16(offset + 8, true);
    const filenameLength = view.getUint16(offset + 26, true);
    const extraFieldLength = view.getUint16(offset + 28, true);
    const compressedSize = view.getUint32(offset + 18, true);
    const uncompressedSize = view.getUint32(offset + 22, true);

    // Skip to filename
    const filenameOffset = offset + 30;
    const filenameBytes = new Uint8Array(arrayBuffer, filenameOffset, filenameLength);
    const filename = new TextDecoder().decode(filenameBytes);

    // Skip to file data
    const fileDataOffset = filenameOffset + filenameLength + extraFieldLength;

    // Only process .npy files
    if (filename.endsWith('.npy')) {
      try {
        let fileData: ArrayBuffer;

        if (compressionMethod === 0) {
          // No compression - direct copy
          fileData = arrayBuffer.slice(fileDataOffset, fileDataOffset + compressedSize);
        } else {
          // For now, skip compressed files
          console.warn(`Skipping compressed file ${filename} - compression not supported`);
          offset = fileDataOffset + compressedSize;
          continue;
        }

        // Parse the NPY file
        const npyView = new DataView(fileData);
        const { shape, dtype, dataOffset } = parseNpyHeader(npyView);

        // Extract data based on dtype
        const expectedElements = shape.reduce((a, b) => a * b, 1);
        let data: Float32Array;

        if (dtype === '<f4' || dtype === '=f4' || dtype === '>f4') {
          // 32-bit float
          if (dtype === '>f4') {
            // Big endian - need to swap bytes
            data = new Float32Array(expectedElements);
            const bytes = new Uint8Array(fileData, dataOffset, expectedElements * 4);
            for (let i = 0; i < expectedElements; i++) {
              const idx = i * 4;
              const b0 = bytes[idx + 3];
              const b1 = bytes[idx + 2];
              const b2 = bytes[idx + 1];
              const b3 = bytes[idx + 0];
              const swappedBytes = new Uint8Array([b0, b1, b2, b3]);
              data[i] = new Float32Array(swappedBytes.buffer)[0];
            }
          } else {
            data = new Float32Array(fileData, dataOffset, expectedElements);
          }
        } else if (dtype === '<f8' || dtype === '=f8' || dtype === '>f8') {
          // 64-bit float - convert to 32-bit
          const rawData = new Float64Array(fileData, dataOffset, expectedElements);
          data = new Float32Array(expectedElements);
          for (let i = 0; i < expectedElements; i++) {
            data[i] = rawData[i];
          }
        } else {
          // For other types, convert to float
          data = new Float32Array(expectedElements);
          // This would need more comprehensive type handling
          console.warn(`Data type ${dtype} in ${filename} may not be fully supported`);
        }

        // Remove .npy extension from key
        const key = filename.replace('.npy', '');
        results[key] = { data, shape, dtype };
      } catch (error) {
        console.warn(`Failed to parse ${filename}:`, error);
      }
    }

    // Move to next file
    offset = fileDataOffset + compressedSize;
  }

  return results;
}

export class NpyReader implements DepthReader {
  canRead(filename: string): boolean {
    return filename.toLowerCase().endsWith('.npy') || filename.toLowerCase().endsWith('.npz');
  }

  async read(arrayBuffer: ArrayBuffer): Promise<DepthReaderResult> {
    const view = new DataView(arrayBuffer);

    // Check if this is an NPZ file (ZIP format)
    if (arrayBuffer.byteLength >= 4) {
      const zipMagic = view.getUint32(0, true);
      if (zipMagic === 0x04034b50) {
        // ZIP file signature
        return this.handleNpzFile(arrayBuffer);
      }
    }

    // Parse NPY file
    const { shape, dtype, dataOffset } = parseNpyHeader(view);

    // Validate shape (should be 2D or 3D for depth images)
    if (shape.length < 2 || shape.length > 3) {
      throw new Error(
        `Expected 2D or 3D array, got ${shape.length}D array with shape [${shape.join(', ')}].\n\nExpected formats:\n- 2D: (height, width) for single-channel depth\n- 3D: (height, width, channels) for multi-channel data`
      );
    }

    // Handle multi-channel data
    let channels = 1;
    let selectedChannel = 0;
    if (shape.length === 3) {
      channels = shape[2];
      if (channels > 4) {
        throw new Error(
          `Too many channels: ${channels}. Expected format: 3D array with shape (height, width, channels) where channels ≤ 4.`
        );
      }
    }

    const [height, width] = shape;

    // Parse data based on dtype
    const expectedElements = height * width * channels;
    let rawData: Float32Array;

    if (dtype === '<f4' || dtype === '=f4' || dtype === '>f4') {
      // 32-bit float
      const elementSize = 4;
      const expectedBytes = expectedElements * elementSize;
      const availableBytes = arrayBuffer.byteLength - dataOffset;

      if (availableBytes < expectedBytes) {
        throw new Error(
          `Insufficient data: expected ${expectedBytes} bytes, got ${availableBytes}`
        );
      }

      const rawDataArray = new Float32Array(arrayBuffer, dataOffset, expectedElements);

      // Handle endianness if needed
      if (dtype === '>f4') {
        // Big endian - need to swap bytes
        rawData = new Float32Array(expectedElements);
        const bytes = new Uint8Array(arrayBuffer, dataOffset, expectedBytes);
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
        rawData = new Float32Array(rawDataArray);
      }
    } else if (dtype === '<f8' || dtype === '=f8' || dtype === '>f8') {
      // 64-bit float - convert to 32-bit
      const elementSize = 8;
      const expectedBytes = expectedElements * elementSize;
      const availableBytes = arrayBuffer.byteLength - dataOffset;

      if (availableBytes < expectedBytes) {
        throw new Error(
          `Insufficient data: expected ${expectedBytes} bytes, got ${availableBytes}`
        );
      }

      const rawDataArray = new Float64Array(arrayBuffer, dataOffset, expectedElements);
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
      const availableBytes = arrayBuffer.byteLength - dataOffset;

      if (availableBytes < expectedBytes) {
        throw new Error(
          `Insufficient data: expected ${expectedBytes} bytes, got ${availableBytes}`
        );
      }

      rawData = new Float32Array(expectedElements);
      const dataView = new DataView(arrayBuffer, dataOffset);
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

    // Extract single channel from multi-channel data
    let data: Float32Array;
    if (channels === 1) {
      data = rawData;
    } else {
      // Extract specific channel (for now, use channel 0)
      data = new Float32Array(height * width);
      for (let i = 0; i < height * width; i++) {
        data[i] = rawData[i * channels + selectedChannel];
      }
    }

    // Create depth image
    const image: DepthImage = { width, height, data };

    // Default metadata - assume depth values in meters
    // The user can adjust this in the UI if needed
    const meta: DepthMetadata = {
      kind: 'depth',
      unit: 'meter',
      scale: 1.0,
      requiresConfiguration: channels > 1, // Show config UI if multi-channel
      selectedChannel: selectedChannel,
    };

    return { image, meta };
  }

  private async handleNpzFile(arrayBuffer: ArrayBuffer): Promise<DepthReaderResult> {
    const npzData = parseNpzFile(arrayBuffer);
    const arrayNames = Object.keys(npzData);

    if (arrayNames.length === 0) {
      throw new Error(
        'NPZ file contains no readable arrays. Expected format: NPZ archive containing at least one 2D NumPy array with depth data (float32/float64 preferred).'
      );
    }

    // Create metadata with available arrays for user selection
    const availableArrays: { [key: string]: { shape: number[]; dtype: string } } = {};
    for (const [name, info] of Object.entries(npzData)) {
      availableArrays[name] = { shape: info.shape, dtype: info.dtype };
    }

    // For now, try to automatically select a suitable array
    let selectedArray: string | null = null;
    let selectedData: { data: Float32Array; shape: number[]; dtype: string } | null = null;

    // Priority order for automatic selection
    const preferredNames = ['depth', 'disparity', 'distance', 'z', 'range'];
    for (const preferred of preferredNames) {
      if (npzData[preferred]) {
        selectedArray = preferred;
        selectedData = npzData[preferred];
        break;
      }
    }

    // If no preferred name found, use first 2D array
    if (!selectedData) {
      for (const [name, data] of Object.entries(npzData)) {
        if (data.shape.length === 2) {
          selectedArray = name;
          selectedData = data;
          break;
        }
      }
    }

    if (!selectedData || !selectedArray) {
      const arrayInfo = Object.entries(availableArrays)
        .map(([name, info]) => `  - "${name}": ${info.shape.join('x')} (${info.dtype})`)
        .join('\n');

      throw new Error(
        `NPZ file contains no suitable 2D arrays for depth data.\n\nAvailable arrays:\n${arrayInfo}\n\nExpected format: 2D NumPy array with shape (height, width) containing depth/disparity values.`
      );
    }

    // Validate that it's 2D
    if (selectedData.shape.length !== 2) {
      throw new Error(
        `Selected array "${selectedArray}" has ${selectedData.shape.length}D shape [${selectedData.shape.join(', ')}]. Expected format: 2D array with shape (height, width) for depth data.`
      );
    }

    const [height, width] = selectedData.shape;

    // Create depth image
    const image: DepthImage = {
      width,
      height,
      data: selectedData.data,
    };

    // Determine data interpretation based on array name and values
    let kind: DepthKind = 'depth';
    if (selectedArray.toLowerCase().includes('disparity')) {
      kind = 'disparity';
    } else if (selectedArray.toLowerCase().includes('inv')) {
      kind = 'inverse_depth';
    }

    const meta: DepthMetadata = {
      kind,
      unit: 'meter',
      scale: 1.0,
      availableArrays,
      requiresConfiguration: arrayNames.length > 1, // Show config if multiple arrays
      selectedArray,
      selectedChannel: 0,
    };

    return { image, meta };
  }
}
