// Shared interfaces for the visualizer
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
  format: "ascii" | "binary_little_endian" | "binary_big_endian";
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
  cameraModel: "pinhole" | "fisheye";
  fx: number; // Focal length in x direction (pixels)
  fy?: number; // Focal length in y direction (pixels) - optional, defaults to fx if not provided
  cx: number; // Principal point x-coordinate (pixels)
  cy: number; // Principal point y-coordinate (pixels)
  depthType: "euclidean" | "orthogonal" | "disparity" | "inverse_depth";
  baseline?: number; // Required for disparity mode
  disparityOffset?: number; // Offset added to disparity values (default 0, not saved to defaults)
  depthScale?: number; // Scale factor for depth values (for depth from mono networks)
  depthBias?: number; // Bias offset for depth values (for depth from mono networks)
  convention?: "opengl" | "opencv"; // Coordinate convention
  pngScaleFactor?: number; // For PNG files: divisor to convert raw values to meters (1000 for mm)
}

export interface DepthConversionResult {
  vertices: Float32Array;
  colors?: Float32Array;
  pointCount: number;
}
