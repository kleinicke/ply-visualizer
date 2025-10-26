// Shared interfaces for the visualizer
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
  fileName?: string;
  fileIndex?: number;
}

export interface CameraParams {
  cameraModel:
    | 'pinhole-ideal'
    | 'pinhole-opencv'
    | 'fisheye-equidistant'
    | 'fisheye-opencv'
    | 'fisheye-kannala-brandt';
  fx: number; // Focal length in x direction (pixels)
  fy?: number; // Focal length in y direction (pixels) - optional, defaults to fx if not provided
  cx?: number; // Principal point x-coordinate (pixels) - optional, auto-calculated from image dimensions if not provided
  cy?: number; // Principal point y-coordinate (pixels) - optional, auto-calculated from image dimensions if not provided
  depthType: 'euclidean' | 'orthogonal' | 'disparity' | 'inverse_depth';
  baseline?: number; // Required for disparity mode
  disparityOffset?: number; // Offset added to disparity values (default 0, not saved to defaults)
  depthScale?: number; // Scale factor for depth values (for depth from mono networks)
  depthBias?: number; // Bias offset for depth values (for depth from mono networks)
  convention?: 'opengl' | 'opencv'; // Coordinate convention
  pngScaleFactor?: number; // For PNG files: divisor to convert raw values to meters (1000 for mm)
  // RGB24 depth image parameters
  rgb24ScaleFactor?: number; // For RGB24 depth images: divisor to convert packed RGB values to meters (e.g., 1000 for mm)
  /**
   * How to extract/combine depth from RGB channels:
   * - 'shift': Pack as (R<<16 | G<<8 | B) - standard 24-bit packing
   * - 'multiply': Use formula R*255*255 + G*255 + B (from famous paper misimplementation)
   * - 'red', 'green', 'blue': Use only that channel
   */
  rgb24ConversionMode?: 'shift' | 'multiply' | 'red' | 'green' | 'blue';
  rgb24InvalidValue?: number; // RGB value representing invalid/missing pixels (e.g., 0 for black)
  // Pinhole OpenCV distortion parameters (k1, k2, p1, p2, k3)
  k1?: number; // Radial distortion coefficient
  k2?: number; // Radial distortion coefficient
  p1?: number; // Tangential distortion coefficient
  p2?: number; // Tangential distortion coefficient
  k3?: number; // Radial distortion coefficient
  // Fisheye OpenCV distortion parameters (k1, k2, k3, k4)
  k4?: number; // Fisheye radial distortion coefficient
  // Kannala-Brandt polynomial coefficients (k1, k2, k3, k4, k5)
  k5?: number; // Kannala-Brandt polynomial coefficient
}

export interface DepthConversionResult {
  vertices: Float32Array;
  colors?: Float32Array;
  pixelCoords?: Float32Array; // Original 2D pixel coordinates (u,v) for each point - length = pointCount * 2
  pointCount: number;
}
