import {
  type Guard,
  type Fields,
  string,
  number,
  index,
  object,
  files,
  binary,
  optional,
} from './protocolGuards';

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
  stationPipelineCancel: {},
  depthFetchFailed: { fileName: optional(string) },
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
