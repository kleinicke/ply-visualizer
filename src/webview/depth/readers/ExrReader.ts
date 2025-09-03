import { DepthReader, DepthReaderResult } from '../types';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';
import { FloatType, DataTexture } from 'three';
import { BasicExrParser } from './BasicExrParser';

/**
 * EXR depth reader using Three.js EXRLoader
 * Supports all EXR compression formats: uncompressed, RLE, ZIP, PIZ, DWA/B
 * Handles depth maps commonly used in stereo vision and Blender workflows
 */
export class ExrReader implements DepthReader {
  private loader: EXRLoader;

  constructor() {
    this.loader = new EXRLoader();
    this.loader.setDataType(FloatType); // Use float precision for depth data
  }

  canRead(filename: string, mimeType?: string): boolean {
    return filename.toLowerCase().endsWith('.exr') || mimeType === 'image/x-exr';
  }

  async read(buf: ArrayBuffer): Promise<DepthReaderResult> {
    console.log('📋 EXR Reader: Using Three.js EXRLoader.parse() for direct buffer parsing...');
    console.log(`📋 EXR Reader: Input buffer size: ${buf.byteLength} bytes`);
    
    // Try to parse with Three.js EXRLoader
    let texData: any = null;
    
    try {
      texData = this.loader.parse(buf);
      console.log(`📋 EXR Reader: Successfully parsed with Three.js EXRLoader`);
    } catch (error) {
      console.warn('📋 EXR Reader: Three.js EXRLoader failed:', error);
      
      // Check if this is the "unsupported data channels" error
      if (error instanceof Error && error.message.includes('unsupported data channels')) {
        console.log('📋 EXR Reader: Falling back to basic EXR parser for custom depth channels...');
        
        try {
          // Use our basic EXR parser for depth files with custom channel names
          const basicParser = new BasicExrParser(buf);
          const basicResult = basicParser.parse();
          
          if (!basicResult.depthData || !basicResult.depthChannelName) {
            const availableChannels = basicResult.channels.map(ch => ch.name).join(', ');
            throw new Error(`No depth channel found in EXR file. Available channels: ${availableChannels}. Expected: Depth.V, Depth, Z, Depth.Z, Disparity, Disp, or R.`);
          }
          
          console.log(`📋 EXR Reader: Basic parser successfully extracted depth from channel: ${basicResult.depthChannelName}`);
          
          // Convert basic parser result to standard format
          return this.processDepthData({
            width: basicResult.width,
            height: basicResult.height,
            data: basicResult.depthData,
            channelName: basicResult.depthChannelName
          });
          
        } catch (basicError) {
          console.error('📋 EXR Reader: Basic EXR parser also failed:', basicError);
          throw new Error(`Failed to parse EXR file with both Three.js EXRLoader and basic parser. Three.js error: ${error.message}. Basic parser error: ${basicError instanceof Error ? basicError.message : String(basicError)}`);
        }
      }
      
      throw new Error(`Failed to parse EXR file: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    // Process Three.js EXRLoader result
    console.log(`📋 EXR Reader: Parsed EXR file ${texData.width}x${texData.height}`);
    console.log(`📋 EXR Reader: Data type: ${texData.type}, Format: ${texData.format}, Data length: ${texData.data?.length || 0}`);
    
    const width = texData.width;
    const height = texData.height;
    const textureData = texData.data;
    
    if (!textureData || !textureData.length) {
      throw new Error('EXR file contains no image data');
    }
    
    // Determine depth channel based on available data
    const channelCount = this.getChannelCount(texData.format);
    let depthData: Float32Array;
    let channelName: string;
    
    console.log(`📋 EXR Reader: Detected ${channelCount} channels`);
    
    if (channelCount === 1) {
      // Single channel - assume it's depth
      depthData = this.convertToFloat32Array(textureData);
      channelName = 'Depth'; // Generic single channel
      console.log(`📋 EXR Reader: Single channel EXR - treating as depth data`);
    } else if (channelCount === 2) {
      // Two channels - could be RG, use Red channel for depth
      depthData = this.extractChannel(textureData, 0, channelCount);
      channelName = 'R'; // Red channel
      console.log(`📋 EXR Reader: Multi-channel EXR - using Red channel for depth`);
    } else if (channelCount >= 3) {
      // RGB or RGBA - check if there's an alpha channel that might be depth
      if (channelCount === 4) {
        // Try alpha channel first (common for depth in RGBA)
        depthData = this.extractChannel(textureData, 3, channelCount);
        channelName = 'A'; // Alpha channel
        console.log(`📋 EXR Reader: RGBA EXR - using Alpha channel for depth`);
      } else {
        // Use Red channel as fallback
        depthData = this.extractChannel(textureData, 0, channelCount);
        channelName = 'R'; // Red channel  
        console.log(`📋 EXR Reader: RGB EXR - using Red channel for depth`);
      }
    } else {
      throw new Error(`Unsupported EXR format with ${channelCount} channels`);
    }
    
    return this.processDepthData({
      width,
      height,
      data: depthData,
      channelName
    });
  }

  private getChannelCount(format: number): number {
    // Three.js texture format constants
    // RedFormat = 1003, RGFormat = 1030, RGBFormat = 1022, RGBAFormat = 1023
    switch (format) {
      case 1003: return 1; // RedFormat
      case 1030: return 2; // RGFormat  
      case 1022: return 3; // RGBFormat
      case 1023: return 4; // RGBAFormat
      default: return 1; // Default to single channel
    }
  }

  private convertToFloat32Array(data: any): Float32Array {
    if (data instanceof Float32Array) {
      return data;
    } else if (data instanceof Uint8ClampedArray || data instanceof Uint8Array) {
      // Convert from 8-bit to float (0-255 -> 0.0-1.0)
      const floatData = new Float32Array(data.length);
      for (let i = 0; i < data.length; i++) {
        floatData[i] = data[i] / 255.0;
      }
      return floatData;
    } else if (data instanceof Array) {
      return new Float32Array(data);
    } else {
      throw new Error(`Unsupported texture data type: ${typeof data}`);
    }
  }

  private extractChannel(data: any, channelIndex: number, totalChannels: number): Float32Array {
    const floatData = this.convertToFloat32Array(data);
    const channelData = new Float32Array(floatData.length / totalChannels);
    for (let i = 0; i < channelData.length; i++) {
      channelData[i] = floatData[i * totalChannels + channelIndex];
    }
    return channelData;
  }

  private processDepthData(data: { width: number, height: number, data: Float32Array, channelName: string }): DepthReaderResult {
    const { width, height, data: depthData, channelName } = data;
    
    // Debug: Log first few depth values
    console.log(`📋 EXR Reader: First 10 depth values:`, Array.from(depthData.slice(0, 10)));
    console.log(`📋 EXR Reader: Depth data length: ${depthData.length}, expected: ${width * height}`);
    
    // Validate depth data
    const validDepthCount = depthData.filter(val => !isNaN(val) && isFinite(val) && val > 0).length;
    const zeroCount = depthData.filter(val => val === 0).length;
    const nanCount = depthData.filter(val => isNaN(val)).length;
    const infCount = depthData.filter(val => !isFinite(val) && !isNaN(val)).length;
    const totalPixels = width * height;
    
    console.log(`📋 EXR Reader: Depth analysis - Valid: ${validDepthCount}, Zero: ${zeroCount}, NaN: ${nanCount}, Inf: ${infCount}, Total: ${totalPixels}`);
    
    if (validDepthCount === 0) {
      throw new Error(`No valid depth values found in EXR file`);
    }
    
    // Calculate depth statistics
    const validDepths = depthData.filter(val => !isNaN(val) && isFinite(val) && val > 0);
    const minDepth = Math.min(...validDepths);
    const maxDepth = Math.max(...validDepths);
    
    console.log(`📋 EXR Reader: Depth range: ${minDepth.toFixed(3)} to ${maxDepth.toFixed(3)}`);
    
    return {
      image: {
        width,
        height,
        data: depthData
      },
      meta: {
        kind: 'depth', // Default to depth
        unit: 'meter',
        scale: 1.0,
        cameraModel: 'pinhole-ideal',
        convention: 'opengl',
        availableArrays: {
          [channelName]: { 
            shape: [height, width], 
            dtype: 'float32'
          }
        },
        selectedArray: channelName
      }
    };
  }
}