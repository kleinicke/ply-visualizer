import {
  type Guard,
  type Fields,
  string,
  number,
  index,
  object,
  namedFiles,
  array,
  strings,
  float32,
  binary,
  optional,
} from './protocolGuards';
import { validateSpatialData } from '../visualization/validateSpatialData';
export type BenchmarkStep =
  | 'alignAll'
  | 'refineAll'
  | 'recolorAll'
  | 'registerAndRecolorAll'
  | 'alignAllNested'
  | 'alignAllComplex'
  | 'reapplyDepth';
import type { LoadTimeColorUpdate, StationPipelineUpdate } from './stationPipelineTypes';
import type { SpatialData, PointDataPayload } from '../interfaces';
import { readFileDataMessage } from '../formats/fileMessage';

const spatial: Guard<SpatialData> = (v): v is SpatialData => {
  validateSpatialData(v);
  return true;
};
const points: Guard<PointDataPayload> = (v): v is PointDataPayload =>
  object(v) &&
  index(v.vertexCount) &&
  typeof v.hasColors === 'boolean' &&
  typeof v.hasNormals === 'boolean' &&
  (Array.isArray(v.vertices) || v.positionsArray instanceof Float32Array);
const spatialList: Guard<SpatialData[]> = (v): v is SpatialData[] =>
  Array.isArray(v) && v.every(spatial);
const oneOrMany: Guard<SpatialData | SpatialData[]> = (v): v is SpatialData | SpatialData[] =>
  Array.isArray(v) ? spatialList(v) : spatial(v);

// Each discriminant declares the fields the router needs. Format-specific
// parsers and command validators validate the content of opaque payloads.
const boolean: Guard<boolean> = (v): v is boolean => typeof v === 'boolean';
const step: Guard<BenchmarkStep> = (v): v is BenchmarkStep =>
  string(v) &&
  [
    'alignAll',
    'refineAll',
    'recolorAll',
    'registerAndRecolorAll',
    'alignAllNested',
    'alignAllComplex',
    'reapplyDepth',
  ].includes(v);
const loadColors: Guard<LoadTimeColorUpdate[]> = (v): v is LoadTimeColorUpdate[] =>
  Array.isArray(v) &&
  v.every(x => object(x) && string(x.scanName) && x.colors instanceof Uint8Array);
const updates: Guard<StationPipelineUpdate[]> = (v): v is StationPipelineUpdate[] =>
  Array.isArray(v) &&
  v.every(
    x =>
      object(x) &&
      string(x.scanName) &&
      (x.transform === null ||
        (Array.isArray(x.transform) && x.transform.length === 16 && x.transform.every(number)))
  );
const volume: Guard<SpatialData & { metadata: { volumeSessionId: string } }> = (
  v
): v is SpatialData & { metadata: { volumeSessionId: string } } =>
  spatial(v) && object(v.metadata) && string(v.metadata.volumeSessionId);
const schemas = {
  browserFiles: { files: namedFiles },
  nativeAgentRequest: { id: string, operation: string, arguments: object },
  registrationResult: { id: string, error: optional(string) },
  benchmarkScenario: { step },
  viewVisibility: { visible: boolean },
  timing: { phase: string, kind: string, ms: optional(number) },
  startLoading: { fileName: optional(string) },
  backgroundOperationComplete: {},
  timingUpdate: { message: string },
  loadingError: { error: string },
  stonexColorReady: { updates: loadColors },
  stationPipelineProgress: { message: string },
  stationPipelineResult: {
    updates: optional(updates),
    error: optional(string),
    summary: optional(string),
    partial: optional(boolean),
    cancelled: optional(boolean),
  },
  spatialData: { data: oneOrMany },
  multiSpatialData: { data: oneOrMany },
  sceneModelData: { fileName: string, data: binary },
  modelResourceResult: { requestId: string },
  cadDecodeResult: { requestId: string },
  splatContainerUri: { fileName: string, fileUri: optional(string) },
  ultimateRawBinaryData: { vertexCount: index, faceCount: index, rawBinaryData: binary },
  ultimateRawBinaryUri: { fileUri: string },
  directTypedArrayData: { vertexCount: index, positionsBuffer: binary },
  binarySpatialData: { vertexCount: index, faceCount: index, positionBuffer: binary },
  addFiles: { data: spatialList },
  'sequence:init': { files: strings, wildcard: string },
  'sequence:file': { index, requestId: string, data: binary, fileName: string },
  'sequence:file:error': { index, requestId: string, error: string },
  fileRemoved: { fileIndex: index },
  startLargeFile: { totalVertices: index, totalChunks: index },
  largeFileChunk: { chunkIndex: index, startIndex: index },
  largeFileComplete: { fileName: string },
  cancelLargeFile: { fileName: string },
  // Either the bytes, or the URI the page has been prefetching them from.
  depthData: { data: optional(binary), fileUri: optional(string), fileName: string },
  objData: { data: object },
  stlData: { data: object },
  xyzData: { data: object },
  pcdData: { data: object },
  ptsData: { data: points, fileName: string },
  kittiBinData: { data: points, fileName: string },
  offData: { data: object },
  gltfData: { data: object },
  volumeData: { data: volume, requestId: optional(number) },
  'volume:progress': { sessionId: string, requestId: number, fraction: number },
  'volume:error': { sessionId: string, requestId: number, error: string },
  colmapModelFiles: { files: array },
  colmapImages: { files: array },
  npyData: { data: points, fileName: string },
  fileData: { data: binary, fileName: string },
  xyzVariantData: { data: points, fileName: string },
  // A text cloud sent in parts while it is still being parsed (pointStream.ts).
  pointStreamPart: { streamId: string, positions: float32 },
  pointStreamCancel: { streamId: string },
  pointStreamEnd: { streamId: string, message: object },
  cameraParams: { fx: number, cameraModel: string, depthType: string, requestId: optional(string) },
  cameraParamsCancelled: { requestId: optional(string) },
  datasetTexture: { data: binary, fileName: string },
  cameraParamsError: { error: string, requestId: optional(string) },
  savePlyFileResult: { success: boolean },
  colorImageData: { fileIndex: index, fileName: string, data: binary },
  defaultDepthSettings: { settings: object },
  mtlData: { fileIndex: index, data: object },
  calibrationFileSelected: { fileIndex: index, fileName: string, content: string },
  poseData: { data: object },
} as const;
type Schemas = typeof schemas;
type Common = {
  entryId?: number;
  fileIndex?: number;
  fileName?: string;
  fileType?: string;
  anchorIndex?: number;
  postedAt?: number;
  loadStartedAt?: number;
};
export type ViewerMessage = {
  [K in keyof Schemas]: { type: K } & Fields<Schemas[K]> & Common;
}[keyof Schemas];
export type MessageOf<T extends ViewerMessage['type']> = Extract<ViewerMessage, { type: T }>;

export function readViewerMessage(value: unknown): ViewerMessage | null {
  if (!object(value) || !string(value.type)) {
    throw new Error('Expected a viewer message object with a type');
  }
  if (!Object.prototype.hasOwnProperty.call(schemas, value.type)) {
    return null;
  }
  const schema = schemas[value.type as keyof Schemas];
  for (const [key, guard] of Object.entries(schema)) {
    if (!(guard as Guard<unknown>)(value[key])) {
      throw new Error(`Invalid ${value.type}.${key}`);
    }
  }
  for (const key of ['fileIndex', 'entryId', 'anchorIndex'] as const) {
    if (value[key] !== undefined && !index(value[key])) {
      throw new Error(`Invalid ${value.type}.${key}`);
    }
  }
  if (value.type === 'fileData') {
    readFileDataMessage(value);
  }
  return value as ViewerMessage;
}

export interface EntryRequest {
  type: 'removeFile' | 'loadMtl' | 'selectCalibrationFile' | 'selectColorImage';
  fileIndex: number;
  entryId: number;
}
export { readHostMessage, type HostMessage } from './hostProtocol';
