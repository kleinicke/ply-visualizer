import { SpatialData, SpatialVertex } from './interfaces';
import { PerfTimer } from './utils/perfLog';
import { noteContainerScanLoaded } from './utils/containerPerf';
import { parsePlyFromResponse, parsePlyWasm, type PlyParseResult } from './parsers/pointcloudWasm';

export interface BinaryDataHandlersHost {
  vscode: { postMessage(message: any): void };
  lastAbsoluteMs: number;
  addNewFiles(newFiles: SpatialData[]): void;
  displayFiles(dataArray: SpatialData[]): Promise<void>;
  handleUltimateRawBinaryData(message: any, preparsed?: PlyParseResult): Promise<void>;
}

export async function loadWithPerf(
  kind: string,
  message: any,
  fn: () => void | Promise<void>
): Promise<void> {
  // read+parse, transfer and total come from the extension's wall-clock epochs
  // (loadStartedAt/postedAt); `build` is the webview's geometry+display span.
  const perf = new PerfTimer(kind, message.loadStartedAt, message.postedAt);
  perf.file(message.fileName);
  try {
    await fn();
  } finally {
    perf.mark('build');
    const verts = message.vertexCount ?? message.data?.vertexCount;
    if (typeof verts === 'number') {
      perf.note('verts', verts.toLocaleString());
    }
    if (typeof message.fileSizeInBytes === 'number') {
      perf.note('MB', (message.fileSizeInBytes / 1048576).toFixed(1));
    }
    if (message.parseMode) {
      perf.note('mode', String(message.parseMode));
    }
    perf.summary();
    noteContainerScanLoaded(message.container, verts);
  }
}

/**
 * Transfer-via-fetch entry: instead of receiving the vertex buffer over
 * postMessage (a multi-hundred-ms structured clone for large clouds), fetch
 * the file directly from its webview URI, slice out the vertex bytes, and
 * hand off to the normal parser. On any fetch failure, ask the extension to
 * resend over postMessage (the proven path) so loading never breaks.
 */
export async function handleUltimateRawBinaryUri(
  host: BinaryDataHandlersHost,
  message: any
): Promise<void> {
  try {
    // Stamp when the (small) URI message arrived, BEFORE the fetch, so the
    // timer's `transfer` is just the URI crossing and the fetch is its own
    // phase (no double counting).
    message.uriReceivedAt = Date.now();
    const fetchStart = performance.now();
    const response = await fetch(message.fileUri);
    if (!response.ok) {
      throw new Error(`fetch failed: ${response.status}`);
    }
    // Streamed straight into wasm memory and parsed there, so the file never
    // exists as a JavaScript buffer. `fetch` and `parse` are one phase here
    // because they overlap by construction - the timer records the pair.
    const parsed = await parsePlyFromResponse(response);
    message.fetchMs = performance.now() - fetchStart;
    await host.handleUltimateRawBinaryData(message, parsed);
  } catch (error) {
    console.warn('[PLY] fetch path failed, requesting postMessage fallback:', error);
    host.vscode.postMessage({
      type: 'plyFetchFailed',
      docUri: message.docUri,
      fileName: message.fileName,
      messageType: message.messageType,
    });
  }
}

export async function handleUltimateRawBinaryData(
  host: BinaryDataHandlersHost,
  message: any,
  /** Supplied by the fetch route, which parses out of wasm memory directly. */
  preparsed?: PlyParseResult
): Promise<void> {
  const startTime = performance.now();
  const perf = new PerfTimer('ply', message.loadStartedAt, message.postedAt, message.uriReceivedAt);
  perf.file(message.fileName);
  if (message.fetchMs != null) {
    perf.add('fetch', message.fetchMs);
  }

  // The whole PLY file arrives here — from a fetch of the document URI, or
  // over postMessage when that is not available — and the Rust parser reads
  // it. This used to be a hand-rolled DataView loop over the vertex region
  // only, driven by a property/offset table the extension host computed: a
  // second binary PLY decoder, with its own idea of splat colour and scalar
  // fields, sitting a message boundary away from the first.
  const rawData = message.rawBinaryData ? new Uint8Array(message.rawBinaryData) : null;
  const parsed = preparsed ?? (await parsePlyWasm(rawData!));
  const isSplat = parsed.isGaussianSplat;

  const parseTime = performance.now();
  perf.mark('parse');
  console.log(`Load: parse ${message.fileName} ${(parseTime - startTime).toFixed(1)}ms`);

  const spatialData: SpatialData = {
    vertices: [],
    faces: parsed.faces,
    format: parsed.format,
    version: parsed.version,
    comments: parsed.comments,
    vertexCount: parsed.vertexCount,
    faceCount: parsed.faceCount,
    hasColors: parsed.hasColors,
    hasNormals: parsed.hasNormals,
    hasIntensity: parsed.hasIntensity,
    isGaussianSplat: isSplat,
    fileName: message.fileName,
    shortPath: message.shortPath,
    fileSizeInBytes: message.fileSizeInBytes,
  };
  if (isSplat && message.fileUri) {
    // Splat mode re-fetches the full PLY from this webview URI on demand, so
    // no bytes are retained here.
    spatialData.splatSource = { url: message.fileUri };
  } else if (isSplat && rawData) {
    // The postMessage route already carries the complete file, so Spark can
    // reuse those bytes rather than have them sent a second time.
    spatialData.splatSource = { bytes: rawData };
  }

  (spatialData as any).useTypedArrays = true;
  (spatialData as any).positionsArray = parsed.positionsArray;
  (spatialData as any).colorsArray = parsed.colorsArray;
  (spatialData as any).normalsArray = parsed.normalsArray;
  (spatialData as any).intensityArray = parsed.intensityArray;
  (spatialData as any).scalarFields = parsed.scalarFields;

  console.log(`Load: total ${(performance.now() - startTime).toFixed(1)}ms`);

  if (parsed.faceCount) {
    perf.mark('faces');
  }

  // Process as normal
  const displayStartTime = performance.now();
  if (message.messageType === 'multiSpatialData') {
    await host.displayFiles([spatialData]);
  } else if (message.messageType === 'addFiles') {
    host.addNewFiles([spatialData]);
  }
  perf.mark('build');

  // Normals visualizer will be created on-demand when user clicks normals button
  // This ensures vertices are fully parsed before creating normals
  const displayTime = performance.now() - displayStartTime;

  // Comprehensive timing analysis
  // For add files, use message receive time as absolute start since there's no UI loading phase
  const absoluteStartTime =
    message.messageType === 'addFiles' ? startTime : (window as any).absoluteStartTime || startTime;
  const absoluteCompleteTime = performance.now() - absoluteStartTime;
  host.lastAbsoluteMs = absoluteCompleteTime;
  const webviewCompleteTime = performance.now() - startTime;

  console.log(`Load: visible ${webviewCompleteTime.toFixed(1)}ms @ ${new Date().toISOString()}`);

  if (message.messageType === 'addFiles') {
    console.log(
      `Load: add-file total ${absoluteCompleteTime.toFixed(1)}ms @ ${new Date().toISOString()}`
    );
  } else {
    console.log(
      `Load: absolute total ${absoluteCompleteTime.toFixed(1)}ms @ ${new Date().toISOString()}`
    );
  }

  // Calculate performance metrics
  const totalVertices = parsed.vertexCount;
  const verticesPerSecond = Math.round(totalVertices / (absoluteCompleteTime / 1000));
  const modeLabel = message.messageType === 'addFiles' ? 'ADD FILE' : 'ULTIMATE';
  // concise metrics printed above

  // total/read+parse/transfer come from the extension's wall-clock epochs on
  // the message — consistent for first and added files, no clock juggling.
  perf.note('verts', totalVertices.toLocaleString());
  perf.note('MB', (message.fileSizeInBytes / 1048576).toFixed(1));
  // One decoder now, so the mode is a constant rather than which of two
  // JavaScript loops the file happened to qualify for.
  perf.note('mode', 'binary-rust');
  perf.summary();
}

export async function handleDirectTypedArrayData(
  host: BinaryDataHandlersHost,
  message: any
): Promise<void> {
  // debug
  const startTime = performance.now();

  // Create PLY data object with direct TypedArrays
  const spatialData: SpatialData = {
    vertices: [], // Empty - not used
    faces: [],
    format: message.format,
    version: '1.0',
    comments: message.comments || [],
    vertexCount: message.vertexCount,
    faceCount: message.faceCount,
    hasColors: message.hasColors,
    hasNormals: message.hasNormals,
    hasIntensity: message.hasIntensity,
    fileName: message.fileName,
    shortPath: message.shortPath,
    sourcePointCount: message.sourcePointCount,
    sourceOrigin: message.sourceOrigin,
    metadata: message.metadata,
    useTypedArrays: true,
  };

  // Attach direct TypedArrays
  (spatialData as any).useTypedArrays = true;
  (spatialData as any).positionsArray = new Float32Array(message.positionsBuffer);
  (spatialData as any).colorsArray = message.colorsBuffer
    ? new Uint8Array(message.colorsBuffer)
    : null;
  (spatialData as any).normalsArray = message.normalsBuffer
    ? new Float32Array(message.normalsBuffer)
    : null;

  console.log(`Load: typedarray ${(performance.now() - startTime).toFixed(1)}ms`);

  // Process as normal - but now with TypedArrays!
  if (message.messageType === 'multiSpatialData') {
    await host.displayFiles([spatialData]);
  } else if (message.messageType === 'addFiles') {
    host.addNewFiles([spatialData]);
  }

  // Normals visualizer will be created on-demand when user clicks normals button
}

export async function handleBinarySpatialData(
  host: BinaryDataHandlersHost,
  message: any
): Promise<void> {
  const receiveTime = performance.now();
  // For add files, we don't have a loadingStartTime, so use receiveTime as reference
  const loadingStartTime = (window as any).loadingStartTime || receiveTime;
  const extensionProcessingTime = receiveTime - loadingStartTime;

  console.log(`Load: received ${message.fileName}, ext ${extensionProcessingTime.toFixed(1)}ms`);

  const startTime = performance.now();

  // Convert binary ArrayBuffers back to PLY data format
  const spatialData: SpatialData = {
    vertices: [],
    faces: [],
    format: message.format,
    version: '1.0',
    comments: message.comments || [],
    vertexCount: message.vertexCount,
    faceCount: message.faceCount,
    hasColors: message.hasColors,
    hasNormals: message.hasNormals,
    hasIntensity: message.hasIntensity,
    isGaussianSplat: !!message.isGaussianSplat,
    splatSource: message.splatSource,
    fileName: message.fileName,
    shortPath: message.shortPath,
    sourcePointCount: message.sourcePointCount,
    sourceOrigin: message.sourceOrigin,
    metadata: message.metadata,
    useTypedArrays: true,
  };

  // Convert position buffer
  const positionArray = new Float32Array(message.positionBuffer);

  // Convert color buffer if present
  let colorArray: Uint8Array | null = null;
  if (message.colorBuffer) {
    colorArray = new Uint8Array(message.colorBuffer);
  }

  // Convert normal buffer if present
  let normalArray: Float32Array | null = null;
  if (message.normalBuffer) {
    normalArray = new Float32Array(message.normalBuffer);
  }

  const scalarFields: Record<string, Float32Array> = {};
  for (const [name, buffer] of Object.entries(message.scalarFieldBuffers || {})) {
    scalarFields[name] = new Float32Array(buffer as ArrayBuffer);
  }
  spatialData.positionsArray = positionArray;
  spatialData.colorsArray = colorArray;
  spatialData.normalsArray = normalArray;
  spatialData.scalarFields = scalarFields;
  spatialData.intensityArray = scalarFields.intensity ?? null;

  // Mesh normals still use the legacy vertex representation during ASCII PLY
  // export. Point clouds—including LAS/LAZ/E57—stay entirely on typed arrays.
  if (message.hasNormals) {
    for (let i = 0; i < message.vertexCount; i++) {
      const vertex: SpatialVertex = {
        x: positionArray[i * 3],
        y: positionArray[i * 3 + 1],
        z: positionArray[i * 3 + 2],
      };

      // Add colors if present
      if (colorArray && message.hasColors) {
        vertex.red = colorArray[i * 3];
        vertex.green = colorArray[i * 3 + 1];
        vertex.blue = colorArray[i * 3 + 2];
      }

      // Add normals if present
      if (normalArray) {
        vertex.nx = normalArray[i * 3];
        vertex.ny = normalArray[i * 3 + 1];
        vertex.nz = normalArray[i * 3 + 2];
      }

      spatialData.vertices.push(vertex);
    }
  }

  // Convert face buffer if present
  if (message.indexBuffer) {
    const indexArray = new Uint32Array(message.indexBuffer);
    // The buffer already represents triangulated indices; push as triples
    for (let i = 0; i < indexArray.length; i += 3) {
      spatialData.faces.push({
        indices: [indexArray[i], indexArray[i + 1], indexArray[i + 2]],
      });
    }
  }

  const conversionTime = performance.now() - startTime;
  console.log(`Load: convert ${conversionTime.toFixed(1)}ms`);

  // Handle based on message type
  if (message.messageType === 'addFiles') {
    host.addNewFiles([spatialData]);
  } else {
    await host.displayFiles([spatialData]);
  }

  // Normals visualizer will be created on-demand when user clicks normals button

  // Complete timing analysis
  const totalTime = performance.now();
  const completeLoadTime = totalTime - loadingStartTime;
  // For add files, use receive time as absolute start since there's no UI loading phase
  const absoluteStartTime =
    message.messageType === 'addFiles'
      ? receiveTime
      : (window as any).absoluteStartTime || loadingStartTime;
  const absoluteCompleteTime = totalTime - absoluteStartTime;
  const geometryTime = totalTime - startTime - conversionTime;

  const ts = new Date().toISOString();

  // Calculate hidden time gaps
  const measuredTime = extensionProcessingTime + conversionTime + geometryTime;
  const hiddenTime = completeLoadTime - measuredTime;

  // Performance summary
  const totalVertices = message.vertexCount;
  const verticesPerSecond = Math.round(totalVertices / (absoluteCompleteTime / 1000));

  const performanceLog = `Load: complete ${completeLoadTime.toFixed(1)}ms, absolute ${absoluteCompleteTime.toFixed(1)}ms @ ${ts}
📊 Breakdown: Extension ${extensionProcessingTime.toFixed(1)}ms + Conversion ${conversionTime.toFixed(1)}ms + Geometry ${geometryTime.toFixed(1)}ms`;

  if (hiddenTime > 10) {
    console.log(
      performanceLog +
        `\n🔍 HIDDEN TIME: ${hiddenTime.toFixed(1)}ms (unmeasured overhead)\n🚀 PERFORMANCE: ${totalVertices.toLocaleString()} vertices in ${absoluteCompleteTime.toFixed(1)}ms (${verticesPerSecond.toLocaleString()} vertices/sec)`
    );
  } else {
    console.log(
      performanceLog +
        `\n🚀 PERFORMANCE: ${totalVertices.toLocaleString()} vertices in ${absoluteCompleteTime.toFixed(1)}ms (${verticesPerSecond.toLocaleString()} vertices/sec)`
    );
  }
}
