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
  focalLength: number;
  depthType: "euclidean" | "orthogonal" | "disparity";
  baseline?: number; // Required for disparity mode
  convention?: "opengl" | "opencv"; // Coordinate convention
  scaleFactor?: number; // For PNG files: divisor to convert raw values to meters (1000 for mm)
}

export interface TifConversionResult {
  vertices: Float32Array;
  colors?: Float32Array;
  pointCount: number;
}
