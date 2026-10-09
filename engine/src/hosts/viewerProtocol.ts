import { validateSpatialData } from '../visualization/validateSpatialData';
export type BenchmarkStep = 'alignAll' | 'refineAll' | 'recolorAll' | 'registerAndRecolorAll';
import type { LoadTimeColorUpdate, StationPipelineUpdate } from './stationPipelineTypes';
import type { SpatialData, PointDataPayload } from '../interfaces';
import { readFileDataMessage } from '../formats/fileMessage';

type Guard<T> = (value: unknown) => value is T;
const string: Guard<string> = (v): v is string => typeof v === 'string';
const number: Guard<number> = (v): v is number => typeof v === 'number' && Number.isFinite(v);
const index: Guard<number> = (v): v is number => number(v) && Number.isInteger(v) && v >= 0;
const object: Guard<Record<string, unknown>> = (v): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const files: Guard<{ name?: string; data?: ArrayBuffer | Uint8Array }[]> = (
  v
): v is { name?: string; data?: ArrayBuffer | Uint8Array }[] =>
  Array.isArray(v) &&
  v.every(
    x =>
      object(x) &&
      (x.name === undefined || string(x.name)) &&
      (x.data === undefined || binary(x.data))
  );
const array: Guard<unknown[]> = Array.isArray;
const strings: Guard<string[]> = (v): v is string[] => Array.isArray(v) && v.every(string);
const float32: Guard<Float32Array> = (v): v is Float32Array => v instanceof Float32Array;
const binary: Guard<ArrayBuffer | Uint8Array> = (v): v is ArrayBuffer | Uint8Array =>
  v instanceof ArrayBuffer || v instanceof Uint8Array;
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
const optional =
  <T>(guard: Guard<T>): Guard<T | undefined> =>
  (value): value is T | undefined =>
    value === undefined || guard(value);
const boolean: Guard<boolean> = (v): v is boolean => typeof v === 'boolean';
const step: Guard<BenchmarkStep> = (v): v is BenchmarkStep =>
  string(v) && ['alignAll', 'refineAll', 'recolorAll', 'registerAndRecolorAll'].includes(v);
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
  nativeAgentRequest: { id: string, operation: string, arguments: object },
  registrationResult: { id: string, error: optional(string) },
  benchmarkScenario: { step },
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
  depthData: { data: binary, fileName: string },
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
type Fields<S> = { [K in keyof S]: S[K] extends Guard<infer T> ? T : never };
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
const hostSchemas = {
  nativeAgentReply: { id: string, error: optional(string), result: optional(object) },
  webviewReady: {},
  error: { message: string },
  info: { message: string },
  perfLog: { line: string },
  registrationRequest: { id: string },
  registrationCancel: { id: string },
  'volume:reextract': { sessionId: string, requestId: number },
  plyFetchFailed: { docUri: string },
  modelResourceRequest: { sourceId: string, relative: string, requestId: string },
  cadDecodeRequest: { requestId: string, bytes: binary, format: string },
  splatContainerFetchFailed: { docUri: string, fileName: string },
  stationPipeline: { options: optional(object) },
  addFile: {},
  removeFile: { fileIndex: index, entryId: optional(index) },
  requestCameraParams: { requestId: optional(string) },
  requestCameraParamsWithScale: { requestId: optional(string) },
  savePlyFile: { content: string, defaultFileName: string },
  saveScreenshot: { dataBase64: string, defaultFileName: string },
  saveVideo: { dataBase64: string, defaultFileName: string, extension: string },
  saveCameraPath: { content: string, defaultFileName: string },
  saveMeasurementPaths: { content: string, defaultFileName: string },
  selectColorImage: { fileIndex: index, entryId: optional(index) },
  loadMtl: { fileIndex: index, entryId: optional(index) },
  saveDefaultDepthSettings: { settings: object },
  saveCameraConvention: { convention: string },
  requestDefaultDepthSettings: {},
  selectCalibrationFile: { fileIndex: index, entryId: optional(index) },
  'sequence:requestFile': { path: string, index, requestId: string },
  'sequence:cancelFile': { requestId: string },
  addFileFromPath: { path: string },
  addDroppedFiles: { files },
  requestDatasetTexture: { sceneName: optional(string) },
  loadDatasetCalibration: { calibrationPath: string, fileIndex: index },
  loadDatasetImage: { imagePath: string, fileIndex: index },
} as const;
type HostSchemas = typeof hostSchemas;
export type HostMessage = {
  [K in keyof HostSchemas]: { type: K } & Fields<HostSchemas[K]> & { requestId?: string | number };
}[keyof HostSchemas];
export function readHostMessage(value: unknown): HostMessage | null {
  if (!object(value) || !string(value.type)) {
    throw new Error('Expected a host message object with a type');
  }
  if (!Object.prototype.hasOwnProperty.call(hostSchemas, value.type)) {
    return null;
  }
  for (const [key, guard] of Object.entries(hostSchemas[value.type as keyof HostSchemas])) {
    if (!(guard as Guard<unknown>)(value[key])) {
      throw new Error(`Invalid ${value.type}.${key}`);
    }
  }
  return value as HostMessage;
}
