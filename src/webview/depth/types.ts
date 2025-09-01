export type CameraModel = 'pinhole' | 'fisheye';

export type DepthKind = 'depth' | 'disparity' | 'inverse_depth' | 'z';

export interface DepthImage {
  width: number;
  height: number;
  // Depth values in meters for kind === 'depth' | 'z'. If reader cannot
  // convert to meters (e.g., ambiguity), it may still return raw values
  // and set metadata.unit/scale/kind so the projector can convert.
  data: Float32Array;
}

export interface DepthMetadata {
  kind: DepthKind; // 'depth' (range), 'z' (optical axis), 'disparity', 'inverse_depth'
  unit?: 'meter' | 'millimeter';
  scale?: number; // multiplier to convert values to meters when kind === 'depth'|'z'
  fx?: number; fy?: number; cx?: number; cy?: number;
  baseline?: number; // meters, for disparity
  disparityOffset?: number; // offset added to disparity values (default 0)
  depthScale?: number; // scale factor for depth values (for depth from mono networks)
  depthBias?: number; // bias offset for depth values (for depth from mono networks)
  cameraModel?: CameraModel;
  convention?: 'opencv' | 'opengl';
  depthClamp?: { min?: number; max?: number };
  // NPZ-specific metadata
  availableArrays?: { [key: string]: { shape: number[], dtype: string } };
  requiresConfiguration?: boolean;
  selectedArray?: string;
  selectedChannel?: number;
  // PNG-specific metadata
  invalidValue?: number; // Value representing invalid pixels (default: 0)
  bitDepth?: number; // 8-bit or 16-bit PNG
}

export interface DepthReaderResult {
  image: DepthImage;
  meta: DepthMetadata;
}

export interface DepthReader {
  canRead(filename: string, mimeType?: string): boolean;
  read(arrayBuffer: ArrayBuffer): Promise<DepthReaderResult>;
}