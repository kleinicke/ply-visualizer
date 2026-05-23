// Common types shared across parsers
export interface BaseVertex {
  x: number;
  y: number;
  z: number;
  red?: number;
  green?: number;
  blue?: number;
  nx?: number;
  ny?: number;
  nz?: number;
  intensity?: number;
}

export interface BaseFace {
  indices: number[];
}

export interface BaseParserData {
  vertices: BaseVertex[];
  vertexCount: number;
  hasColors: boolean;
  hasNormals: boolean;
  hasIntensity?: boolean;
  fileName: string;
  fileIndex?: number;
  comments: string[];
  positionsArray?: Float32Array;
  colorsArray?: Uint8Array | null;
  normalsArray?: Float32Array | null;
  intensityArray?: Float32Array | null;
  scalarFields?: Record<string, Float32Array>;
  useTypedArrays?: boolean;
}
