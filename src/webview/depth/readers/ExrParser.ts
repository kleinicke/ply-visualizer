/**
 * Basic EXR file parser for depth channel extraction
 * Based on OpenEXR specification: https://openexr.com/en/latest/OpenEXRFileLayout.html
 */

export interface ExrChannel {
  name: string;
  pixelType: number; // 0=UINT32, 1=HALF, 2=FLOAT
  pLinear: boolean;
  xSampling: number;
  ySampling: number;
}

export interface ExrHeader {
  width: number;
  height: number;
  channels: Map<string, ExrChannel>;
  compression: number;
  dataWindow: {xMin: number, yMin: number, xMax: number, yMax: number};
  displayWindow: {xMin: number, yMin: number, xMax: number, yMax: number};
}

export interface ExrData {
  header: ExrHeader;
  channelData: Map<string, Float32Array>;
}

export class ExrParser {
  private view: DataView;
  private offset: number = 0;

  constructor(buffer: ArrayBuffer) {
    this.view = new DataView(buffer);
    this.offset = 0;
  }

  parse(): ExrData {
    // Check magic number
    const magic = this.readUint32();
    if (magic !== 0x01312f76) {
      throw new Error('Invalid EXR file: magic number not found');
    }

    // Read version and flags
    const version = this.readUint32();
    const versionNumber = version & 0xff;
    const singleTile = !!(version & 0x200);
    const longName = !!(version & 0x400);
    const deepData = !!(version & 0x800);
    const multiPart = !!(version & 0x1000);

    if (versionNumber !== 2) {
      throw new Error(`Unsupported EXR version: ${versionNumber}`);
    }

    if (singleTile || deepData || multiPart) {
      throw new Error('Tiled, deep, and multi-part EXR files are not supported');
    }

    // Parse header
    const header = this.parseHeader();
    
    // Parse channel data
    const channelData = this.parseChannelData(header);

    return { header, channelData };
  }

  private parseHeader(): ExrHeader {
    const channels = new Map<string, ExrChannel>();
    let width = 0, height = 0;
    let compression = 0;
    let dataWindow = {xMin: 0, yMin: 0, xMax: 0, yMax: 0};
    let displayWindow = {xMin: 0, yMin: 0, xMax: 0, yMax: 0};

    // Read header attributes
    while (true) {
      const name = this.readString();
      if (name === '') break; // End of header

      const type = this.readString();
      const size = this.readUint32();
      const dataStart = this.offset;

      if (name === 'channels') {
        this.parseChannels(channels, size);
      } else if (name === 'compression') {
        compression = this.readUint8();
      } else if (name === 'dataWindow') {
        dataWindow = this.readBox2i();
        width = dataWindow.xMax - dataWindow.xMin + 1;
        height = dataWindow.yMax - dataWindow.yMin + 1;
      } else if (name === 'displayWindow') {
        displayWindow = this.readBox2i();
      } else {
        // Skip unknown attributes
        this.offset = dataStart + size;
      }
    }

    return {
      width,
      height,
      channels,
      compression,
      dataWindow,
      displayWindow
    };
  }

  private parseChannels(channels: Map<string, ExrChannel>, size: number): void {
    const endOffset = this.offset + size;
    
    while (this.offset < endOffset) {
      const name = this.readString();
      if (name === '') break;

      const pixelType = this.readUint32();
      const pLinear = this.readUint8();
      this.readUint8(); // reserved[2]
      this.readUint8();
      this.readUint8();
      const xSampling = this.readUint32();
      const ySampling = this.readUint32();

      channels.set(name, {
        name,
        pixelType,
        pLinear: !!pLinear,
        xSampling,
        ySampling
      });
    }
  }

  private parseChannelData(header: ExrHeader): Map<string, Float32Array> {
    const channelData = new Map<string, Float32Array>();
    
    if (header.compression !== 0) {
      throw new Error('Compressed EXR files are not yet supported. Please use uncompressed EXR files.');
    }

    // Read scanline offset table
    const scanlineCount = header.height;
    const scanlineOffsets: number[] = [];
    
    for (let i = 0; i < scanlineCount; i++) {
      scanlineOffsets.push(this.readUint64());
    }

    // Create arrays for each channel
    for (const [channelName, channel] of header.channels) {
      channelData.set(channelName, new Float32Array(header.width * header.height));
    }

    // Read each scanline
    for (let y = 0; y < header.height; y++) {
      // Each scanline starts with y-coordinate and pixel data size
      const scanlineY = this.readUint32();
      const pixelDataSize = this.readUint32();
      
      // Read pixel data for this scanline
      for (const [channelName, channel] of header.channels) {
        const channelArray = channelData.get(channelName)!;
        
        for (let x = 0; x < header.width; x++) {
          const pixelIndex = y * header.width + x;
          let value: number;
          
          if (channel.pixelType === 2) { // FLOAT
            value = this.readFloat32();
          } else if (channel.pixelType === 1) { // HALF
            value = this.readHalf();
          } else { // UINT32
            value = this.readUint32();
          }
          
          channelArray[pixelIndex] = value;
        }
      }
    }

    return channelData;
  }

  // Utility methods for reading binary data
  private readUint8(): number {
    const value = this.view.getUint8(this.offset);
    this.offset += 1;
    return value;
  }

  private readUint32(): number {
    const value = this.view.getUint32(this.offset, true); // little endian
    this.offset += 4;
    return value;
  }

  private readUint64(): number {
    // JavaScript doesn't have native 64-bit integers, read as two 32-bit
    const low = this.readUint32();
    const high = this.readUint32();
    return low + (high * 0x100000000);
  }

  private readFloat32(): number {
    const value = this.view.getFloat32(this.offset, true); // little endian
    this.offset += 4;
    return value;
  }

  private readHalf(): number {
    // Read 16-bit half float and convert to 32-bit float
    const halfBits = this.view.getUint16(this.offset, true);
    this.offset += 2;
    return this.halfToFloat(halfBits);
  }

  private readString(): string {
    let result = '';
    while (true) {
      const byte = this.readUint8();
      if (byte === 0) break;
      result += String.fromCharCode(byte);
    }
    return result;
  }

  private readBox2i(): {xMin: number, yMin: number, xMax: number, yMax: number} {
    return {
      xMin: this.readUint32(),
      yMin: this.readUint32(),
      xMax: this.readUint32(),
      yMax: this.readUint32()
    };
  }

  private halfToFloat(halfBits: number): number {
    // Convert IEEE 754 half precision to single precision
    const sign = (halfBits >> 15) & 0x1;
    const exp = (halfBits >> 10) & 0x1f;
    const frac = halfBits & 0x3ff;

    if (exp === 0) {
      if (frac === 0) {
        return sign ? -0.0 : 0.0;
      } else {
        // Denormalized number
        return (sign ? -1 : 1) * Math.pow(2, -14) * (frac / 1024);
      }
    } else if (exp === 31) {
      if (frac === 0) {
        return sign ? -Infinity : Infinity;
      } else {
        return NaN;
      }
    } else {
      // Normalized number
      return (sign ? -1 : 1) * Math.pow(2, exp - 15) * (1 + frac / 1024);
    }
  }
}

// Helper function to detect depth channels
export function findDepthChannel(channels: Map<string, ExrChannel>): string | null {
  // Priority order for depth channel detection
  const depthChannelNames = [
    'Depth.V',    // Blender depth
    'Depth',      // Generic depth
    'Z',          // Z-buffer
    'Depth.Z',    // Explicit Z depth
    'Disparity',  // Stereo disparity
    'Disp'        // Short disparity
  ];

  for (const channelName of depthChannelNames) {
    if (channels.has(channelName)) {
      return channelName;
    }
  }

  return null;
}