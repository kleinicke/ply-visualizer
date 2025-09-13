/**
 * Basic EXR parser for depth files with custom channel names
 * Handles uncompressed and ZIP-compressed EXR files with channels like Depth.V, Z, Disparity, etc.
 * Falls back when Three.js EXRLoader fails with "unsupported data channels"
 */

import * as pako from 'pako';

export interface ExrChannel {
  name: string;
  pixelType: number; // 0=UINT32, 1=HALF, 2=FLOAT
  bytesPerPixel: number;
  offset: number; // Byte offset in pixel data
}

export interface BasicExrResult {
  width: number;
  height: number;
  channels: ExrChannel[];
  depthData: Float32Array | null;
  depthChannelName: string | null;
}

export class BasicExrParser {
  private view: DataView;
  private offset: number = 0;

  constructor(buffer: ArrayBuffer) {
    this.view = new DataView(buffer);
    this.offset = 0;
  }

  parse(): BasicExrResult {
    console.log('📋 Basic EXR Parser: Parsing EXR file for depth channels...');

    // Check file size
    if (this.view.byteLength > 50 * 1024 * 1024) {
      throw new Error('EXR file too large (>50MB)');
    }

    // Validate magic number
    const magic = this.readUint32();
    if (magic !== 0x01312f76) {
      throw new Error('Invalid EXR file: magic number not found');
    }

    // Read version info
    const version = this.readUint32();
    const versionNumber = version & 0xff;

    if (versionNumber !== 2) {
      throw new Error(`Unsupported EXR version: ${versionNumber}`);
    }

    // Check for unsupported features
    if (version & 0x200) {throw new Error('Tiled EXR files are not supported');}
    if (version & 0x800) {throw new Error('Deep EXR files are not supported');}
    if (version & 0x1000) {throw new Error('Multi-part EXR files are not supported');}

    // Parse header
    const headerInfo = this.parseHeader();

    // Handle uncompressed and ZIP compression
    if (
      headerInfo.compression !== 0 &&
      headerInfo.compression !== 2 &&
      headerInfo.compression !== 3
    ) {
      throw new Error(
        `EXR compression type ${headerInfo.compression} not supported by basic parser. Supported: uncompressed (0), ZIPS (2), ZIP (3). Please use uncompressed EXR files, standard RGB channels, or supported compression types.`
      );
    }

    // Extract depth data
    const depthResult = this.extractDepthData(headerInfo);

    return {
      width: headerInfo.width,
      height: headerInfo.height,
      channels: headerInfo.channels,
      depthData: depthResult.data,
      depthChannelName: depthResult.channelName,
    };
  }

  private parseHeader() {
    const channels: ExrChannel[] = [];
    let width = 0,
      height = 0;
    let compression = 0;

    // Read header attributes
    while (true) {
      const attrName = this.readString();
      if (attrName === '') {break;} // End of header

      const attrType = this.readString();
      const attrSize = this.readUint32();
      const attrDataStart = this.offset;

      try {
        if (attrName === 'channels' && attrType === 'chlist') {
          this.parseChannelList(channels, attrSize);
        } else if (attrName === 'compression' && attrType === 'compression') {
          compression = this.readUint8();
        } else if (attrName === 'dataWindow' && attrType === 'box2i') {
          const xMin = this.readInt32();
          const yMin = this.readInt32();
          const xMax = this.readInt32();
          const yMax = this.readInt32();
          width = xMax - xMin + 1;
          height = yMax - yMin + 1;
        } else {
          // Skip unknown attributes
          this.offset = attrDataStart + attrSize;
        }
      } catch (error) {
        // If parsing fails, skip this attribute
        this.offset = attrDataStart + attrSize;
      }
    }

    console.log(`📋 Basic EXR Parser: Dimensions: ${width}x${height}, compression: ${compression}`);
    console.log(
      `📋 Basic EXR Parser: Found ${channels.length} channels:`,
      channels.map(ch => `${ch.name}(${ch.pixelType})`)
    );

    return { channels, width, height, compression };
  }

  private parseChannelList(channels: ExrChannel[], size: number) {
    const endOffset = this.offset + size;
    let currentOffset = 0;

    while (this.offset < endOffset) {
      const name = this.readString();
      if (name === '' || this.offset >= endOffset) {break;}

      try {
        const pixelType = this.readUint32();
        this.readUint8(); // pLinear
        this.readUint8(); // reserved
        this.readUint8(); // reserved
        this.readUint8(); // reserved
        this.readUint32(); // xSampling
        this.readUint32(); // ySampling

        const bytesPerPixel = pixelType === 0 ? 4 : pixelType === 1 ? 2 : 4;

        channels.push({
          name,
          pixelType,
          bytesPerPixel,
          offset: currentOffset,
        });

        currentOffset += bytesPerPixel;
      } catch (error) {
        break;
      }
    }

    // Sort channels alphabetically (EXR standard)
    channels.sort((a, b) => a.name.localeCompare(b.name));

    // Recalculate offsets after sorting
    let offset = 0;
    for (const channel of channels) {
      channel.offset = offset;
      offset += channel.bytesPerPixel;
    }
  }

  private extractDepthData(headerInfo: any): {
    data: Float32Array | null;
    channelName: string | null;
  } {
    // Find depth channel with flexible matching
    const depthChannelNames = ['Depth.V', 'Depth', 'Z', 'Depth.Z', 'Disparity', 'Disp', 'R'];

    console.log(
      `📋 Basic EXR Parser: Looking for depth channels among:`,
      headerInfo.channels.map((ch: ExrChannel) => ch.name)
    );

    const depthChannel = headerInfo.channels.find((ch: ExrChannel) => {
      return depthChannelNames.includes(ch.name);
    });

    if (!depthChannel) {
      console.log(
        `📋 Basic EXR Parser: No depth channel found. Available channels:`,
        headerInfo.channels.map((ch: ExrChannel) => ch.name)
      );
      return { data: null, channelName: null };
    }

    console.log(`📋 Basic EXR Parser: Using depth channel: ${depthChannel.name}`);

    try {
      // Read scanline offset table
      const scanlineOffsets: number[] = [];
      for (let i = 0; i < headerInfo.height; i++) {
        scanlineOffsets.push(this.readUint64());
      }

      const pixelSize = headerInfo.channels.reduce(
        (sum: number, ch: ExrChannel) => sum + ch.bytesPerPixel,
        0
      );
      const depthData = new Float32Array(headerInfo.width * headerInfo.height);

      console.log(
        `📋 Basic EXR Parser: Reading ${headerInfo.height} scanlines, pixel size: ${pixelSize} bytes, compression: ${headerInfo.compression}`
      );

      // Read depth data from each scanline
      for (let y = 0; y < headerInfo.height; y++) {
        // Read scanline header
        const scanlineY = this.readUint32();
        const pixelDataSize = this.readUint32();

        let scanlineData: Uint8Array;

        if (headerInfo.compression === 0) {
          // Uncompressed - read directly
          const expectedSize = pixelSize * headerInfo.width;
          if (pixelDataSize !== expectedSize) {
            throw new Error(
              `Unexpected scanline size: got ${pixelDataSize}, expected ${expectedSize}`
            );
          }

          scanlineData = new Uint8Array(this.view.buffer, this.offset, pixelDataSize);
          this.offset += pixelDataSize;
        } else {
          // Compressed - decompress the scanline
          const compressedData = new Uint8Array(this.view.buffer, this.offset, pixelDataSize);
          this.offset += pixelDataSize;

          const expectedSize = pixelSize * headerInfo.width;
          scanlineData = this.decompressScanline(
            compressedData,
            expectedSize,
            headerInfo.compression
          );

          if (y < 2) {
            // Debug first two scanlines
            console.log(
              `📋 Basic EXR Parser: Scanline ${y}: compressed ${pixelDataSize} -> uncompressed ${scanlineData.length} bytes`
            );
          }
        }

        const scanlineView = new DataView(scanlineData.buffer, scanlineData.byteOffset);

        // Extract depth values from scanline
        for (let x = 0; x < headerInfo.width; x++) {
          const pixelOffset = x * pixelSize + depthChannel.offset;

          let depthValue: number;
          if (depthChannel.pixelType === 2) {
            // FLOAT
            depthValue = scanlineView.getFloat32(pixelOffset, true);
          } else if (depthChannel.pixelType === 1) {
            // HALF
            const halfBits = scanlineView.getUint16(pixelOffset, true);
            depthValue = this.halfToFloat(halfBits);
          } else {
            // UINT32
            depthValue = scanlineView.getUint32(pixelOffset, true);
          }

          depthData[y * headerInfo.width + x] = depthValue;
        }
      }

      return { data: depthData, channelName: depthChannel.name };
    } catch (error) {
      console.warn('📋 Basic EXR Parser: Failed to extract depth data:', error);
      return { data: null, channelName: null };
    }
  }

  // Utility reading methods
  private readUint8(): number {
    const value = this.view.getUint8(this.offset);
    this.offset += 1;
    return value;
  }

  private readInt32(): number {
    const value = this.view.getInt32(this.offset, true);
    this.offset += 4;
    return value;
  }

  private readUint32(): number {
    const value = this.view.getUint32(this.offset, true);
    this.offset += 4;
    return value;
  }

  private readUint64(): number {
    const low = this.readUint32();
    const high = this.readUint32();
    return low + high * 0x100000000;
  }

  private readString(): string {
    let result = '';
    while (this.offset < this.view.byteLength) {
      const byte = this.readUint8();
      if (byte === 0) {break;}
      result += String.fromCharCode(byte);
    }
    return result;
  }

  private halfToFloat(halfBits: number): number {
    const sign = (halfBits >> 15) & 0x1;
    const exp = (halfBits >> 10) & 0x1f;
    const frac = halfBits & 0x3ff;

    if (exp === 0) {
      return sign ? -0.0 : 0.0;
    } else if (exp === 31) {
      return frac === 0 ? (sign ? -Infinity : Infinity) : NaN;
    } else {
      return (sign ? -1 : 1) * Math.pow(2, exp - 15) * (1 + frac / 1024);
    }
  }

  private decompressScanline(
    compressedData: Uint8Array,
    expectedSize: number,
    compression: number
  ): Uint8Array {
    if (compression === 2 || compression === 3) {
      // ZIPS or ZIP
      return this.decompressZIP(compressedData, expectedSize);
    } else {
      throw new Error(`Unsupported compression type: ${compression}`);
    }
  }

  private decompressZIP(compressedData: Uint8Array, expectedSize: number): Uint8Array {
    try {
      console.log(
        `📋 Basic EXR Parser: Decompressing ZIP data: ${compressedData.length} -> ${expectedSize} bytes`
      );

      // Use pako library for ZIP/deflate decompression
      const result = pako.inflate(compressedData);

      if (result.length !== expectedSize) {
        console.warn(
          `📋 Basic EXR Parser: Size mismatch after decompression: got ${result.length}, expected ${expectedSize}`
        );
      }

      return new Uint8Array(result);
    } catch (error) {
      throw new Error(
        `ZIP decompression failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
