import { SpatialData, SpatialVertex } from './interfaces';
import { PerfTimer } from './utils/perfLog';
import { isExtraScalarProperty } from './utils/scalarFields';

export interface BinaryDataHandlersHost {
  vscode: { postMessage(message: any): void };
  lastAbsoluteMs: number;
  addNewFiles(newFiles: SpatialData[]): void;
  displayFiles(dataArray: SpatialData[]): Promise<void>;
  handleUltimateRawBinaryData(message: any): Promise<void>;
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
    const full = await response.arrayBuffer();
    const fetchMs = performance.now() - fetchStart;
    // Extract the vertex region, matching what the extension would have sliced.
    message.rawBinaryData = full.slice(message.binaryDataStart);
    message.fetchMs = fetchMs;
    await host.handleUltimateRawBinaryData(message);
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
  message: any
): Promise<void> {
  const startTime = performance.now();
  const perf = new PerfTimer('ply', message.loadStartedAt, message.postedAt, message.uriReceivedAt);
  perf.file(message.fileName);
  if (message.fetchMs != null) {
    perf.add('fetch', message.fetchMs);
  }

  // Parse raw binary data directly in webview
  const rawData = new Uint8Array(message.rawBinaryData);
  const dataView = new DataView(rawData.buffer, rawData.byteOffset, rawData.byteLength);
  const propertyOffsets = new Map(message.propertyOffsets);
  const vertexStride = message.vertexStride;
  const vertexCount = message.vertexCount;
  const littleEndian = message.littleEndian;
  const faceCountType = message.faceCountType as string | undefined;
  const faceIndexType = message.faceIndexType as string | undefined;

  // concise timing printed after

  // Pre-allocate TypedArrays for maximum performance
  const positions = new Float32Array(vertexCount * 3);
  const colors = message.hasColors ? new Uint8Array(vertexCount * 3) : null;
  const normals = message.hasNormals ? new Float32Array(vertexCount * 3) : null;
  const intensity = message.hasIntensity ? new Float32Array(vertexCount) : null;

  // Get property offsets
  const xOffset = propertyOffsets.get('x');
  const yOffset = propertyOffsets.get('y');
  const zOffset = propertyOffsets.get('z');
  const redOffset = propertyOffsets.get('red');
  const greenOffset = propertyOffsets.get('green');
  const blueOffset = propertyOffsets.get('blue');
  const nxOffset = propertyOffsets.get('nx');
  const nyOffset = propertyOffsets.get('ny');
  const nzOffset = propertyOffsets.get('nz');
  const getPropertyOffset = (names: string[]) => {
    for (const name of names) {
      const direct = propertyOffsets.get(name);
      if (direct) {
        return direct;
      }
    }
    for (const [field, offset] of propertyOffsets.entries()) {
      if (names.includes(String(field).toLowerCase())) {
        return offset;
      }
    }
    return undefined;
  };
  const intensityOffset = getPropertyOffset([
    'intensity',
    'reflectivity',
    'reflectance',
    'remission',
  ]);

  // Helper function to read binary value based on type
  const readBinaryValue = (offset: number, type: string): number => {
    switch (type) {
      case 'char':
      case 'int8':
        return dataView.getInt8(offset);
      case 'uchar':
      case 'uint8':
        return dataView.getUint8(offset);
      case 'short':
      case 'int16':
        return dataView.getInt16(offset, littleEndian);
      case 'ushort':
      case 'uint16':
        return dataView.getUint16(offset, littleEndian);
      case 'int':
      case 'int32':
        return dataView.getInt32(offset, littleEndian);
      case 'uint':
      case 'uint32':
        return dataView.getUint32(offset, littleEndian);
      case 'float':
      case 'float32':
        return dataView.getFloat32(offset, littleEndian);
      case 'double':
      case 'float64':
        return dataView.getFloat64(offset, littleEndian);
      default:
        throw new Error(`Unsupported data type: ${type}`);
    }
  };

  // Fast path: the overwhelmingly common PLY layouts are float32 (or float64)
  // x/y/z, uint8 r/g/b, float32 normals, float32 intensity. When every present
  // property matches that, we read directly from the DataView in a tight loop
  // with no per-property function call and no string-`switch` (the previous
  // version did ~6 calls × N vertices, which dominated parse time). Open3D
  // commonly writes double (float64) positions, so both widths are supported.
  const isF32 = (t?: string) => t === 'float' || t === 'float32';
  const isF64 = (t?: string) => t === 'double' || t === 'float64';
  const isU8 = (t?: string) => t === 'uchar' || t === 'uint8';
  const hasC = !!(colors && redOffset && greenOffset && blueOffset);
  const hasN = !!(normals && nxOffset && nyOffset && nzOffset);
  const hasI = !!(intensity && intensityOffset);
  const posF32 =
    isF32((xOffset as any)?.type) && isF32((yOffset as any)?.type) && isF32((zOffset as any)?.type);
  const posF64 =
    isF64((xOffset as any)?.type) && isF64((yOffset as any)?.type) && isF64((zOffset as any)?.type);
  const fastEligible =
    !!xOffset &&
    !!yOffset &&
    !!zOffset &&
    (posF32 || posF64) &&
    (!hasC ||
      (isU8((redOffset as any).type) &&
        isU8((greenOffset as any).type) &&
        isU8((blueOffset as any).type))) &&
    (!hasN ||
      (isF32((nxOffset as any).type) &&
        isF32((nyOffset as any).type) &&
        isF32((nzOffset as any).type))) &&
    (!hasI || isF32((intensityOffset as any).type));

  if (fastEligible) {
    const le = littleEndian;
    const xo = (xOffset as any).offset;
    const yo = (yOffset as any).offset;
    const zo = (zOffset as any).offset;
    const ro = hasC ? (redOffset as any).offset : 0;
    const go = hasC ? (greenOffset as any).offset : 0;
    const bo = hasC ? (blueOffset as any).offset : 0;
    const nxo = hasN ? (nxOffset as any).offset : 0;
    const nyo = hasN ? (nyOffset as any).offset : 0;
    const nzo = hasN ? (nzOffset as any).offset : 0;
    const io = hasI ? (intensityOffset as any).offset : 0;

    for (let i = 0; i < vertexCount; i++) {
      const vo = i * vertexStride;
      const i3 = i * 3;
      if (posF64) {
        positions[i3] = dataView.getFloat64(vo + xo, le);
        positions[i3 + 1] = dataView.getFloat64(vo + yo, le);
        positions[i3 + 2] = dataView.getFloat64(vo + zo, le);
      } else {
        positions[i3] = dataView.getFloat32(vo + xo, le);
        positions[i3 + 1] = dataView.getFloat32(vo + yo, le);
        positions[i3 + 2] = dataView.getFloat32(vo + zo, le);
      }
      if (hasC) {
        colors![i3] = dataView.getUint8(vo + ro);
        colors![i3 + 1] = dataView.getUint8(vo + go);
        colors![i3 + 2] = dataView.getUint8(vo + bo);
      }
      if (hasN) {
        normals![i3] = dataView.getFloat32(vo + nxo, le);
        normals![i3 + 1] = dataView.getFloat32(vo + nyo, le);
        normals![i3 + 2] = dataView.getFloat32(vo + nzo, le);
      }
      if (hasI) {
        intensity![i] = dataView.getFloat32(vo + io, le);
      }
    }
  } else {
    // Generic fallback for mixed/exotic property types.
    for (let i = 0; i < vertexCount; i++) {
      const vertexOffset = i * vertexStride;
      const i3 = i * 3;

      if (xOffset) {
        positions[i3] = readBinaryValue(
          vertexOffset + (xOffset as any).offset,
          (xOffset as any).type
        );
      }
      if (yOffset) {
        positions[i3 + 1] = readBinaryValue(
          vertexOffset + (yOffset as any).offset,
          (yOffset as any).type
        );
      }
      if (zOffset) {
        positions[i3 + 2] = readBinaryValue(
          vertexOffset + (zOffset as any).offset,
          (zOffset as any).type
        );
      }

      if (colors && redOffset) {
        colors[i3] = readBinaryValue(
          vertexOffset + (redOffset as any).offset,
          (redOffset as any).type
        );
      }
      if (colors && greenOffset) {
        colors[i3 + 1] = readBinaryValue(
          vertexOffset + (greenOffset as any).offset,
          (greenOffset as any).type
        );
      }
      if (colors && blueOffset) {
        colors[i3 + 2] = readBinaryValue(
          vertexOffset + (blueOffset as any).offset,
          (blueOffset as any).type
        );
      }

      if (normals && nxOffset) {
        normals[i3] = readBinaryValue(
          vertexOffset + (nxOffset as any).offset,
          (nxOffset as any).type
        );
      }
      if (normals && nyOffset) {
        normals[i3 + 1] = readBinaryValue(
          vertexOffset + (nyOffset as any).offset,
          (nyOffset as any).type
        );
      }
      if (normals && nzOffset) {
        normals[i3 + 2] = readBinaryValue(
          vertexOffset + (nzOffset as any).offset,
          (nzOffset as any).type
        );
      }

      if (intensity && intensityOffset) {
        intensity[i] = readBinaryValue(
          vertexOffset + (intensityOffset as any).offset,
          (intensityOffset as any).type
        );
      }
    }
  }

  // Extra scalar fields (confidence, error, label, …) in a per-field second
  // pass, so the hand-tuned main loop above stays untouched. Files without
  // extra properties skip this entirely.
  const extraScalarFields: Record<string, Float32Array> = {};
  for (const [rawName, rawInfo] of propertyOffsets.entries()) {
    const name = String(rawName);
    const info = rawInfo as { offset: number; type: string };
    if (!isExtraScalarProperty(name, info.type)) {
      continue;
    }
    const arr = new Float32Array(vertexCount);
    if (info.type === 'float' || info.type === 'float32') {
      for (let i = 0; i < vertexCount; i++) {
        arr[i] = dataView.getFloat32(i * vertexStride + info.offset, littleEndian);
      }
    } else {
      for (let i = 0; i < vertexCount; i++) {
        arr[i] = readBinaryValue(i * vertexStride + info.offset, info.type);
      }
    }
    extraScalarFields[name] = arr;
  }

  const parseTime = performance.now();
  perf.mark('parse');
  perf.note('fast', fastEligible ? 1 : 0);
  console.log(`Load: parse ${message.fileName} ${(parseTime - startTime).toFixed(1)}ms`);

  // Create PLY data object with TypedArrays
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
    fileSizeInBytes: message.fileSizeInBytes,
  };

  // Attach TypedArrays
  (spatialData as any).useTypedArrays = true;
  (spatialData as any).positionsArray = positions;
  (spatialData as any).colorsArray = colors;
  (spatialData as any).normalsArray = normals;
  (spatialData as any).intensityArray = intensity;
  (spatialData as any).scalarFields = intensity
    ? { intensity, ...extraScalarFields }
    : extraScalarFields;

  // Faces: if face info was provided in header, read faces after vertex block
  // Note: rawBinaryData starts at vertex buffer; if faces follow, they are after vertexStride * vertexCount bytes
  if (message.faceCount && faceCountType && faceIndexType) {
    const faceStart = vertexStride * vertexCount;
    // debug faces summary
    if (faceStart < rawData.byteLength) {
      let offs = 0; // Offset within the face DataView (already anchored at faceStart)
      const dv = new DataView(
        rawData.buffer,
        rawData.byteOffset + faceStart,
        rawData.byteLength - faceStart
      );
      const readVal = (off: number, type: string): { val: number; next: number } => {
        switch (type) {
          case 'char':
          case 'int8':
            return { val: dv.getInt8(off), next: off + 1 };
          case 'uchar':
          case 'uint8':
            return { val: dv.getUint8(off), next: off + 1 };
          case 'short':
          case 'int16':
            return { val: dv.getInt16(off, littleEndian), next: off + 2 };
          case 'ushort':
          case 'uint16':
            return { val: dv.getUint16(off, littleEndian), next: off + 2 };
          case 'int':
          case 'int32':
            return { val: dv.getInt32(off, littleEndian), next: off + 4 };
          case 'uint':
          case 'uint32':
            return { val: dv.getUint32(off, littleEndian), next: off + 4 };
          case 'float':
          case 'float32':
            return { val: dv.getFloat32(off, littleEndian), next: off + 4 };
          case 'double':
          case 'float64':
            return { val: dv.getFloat64(off, littleEndian), next: off + 8 };
          default:
            throw new Error(`Unsupported face type: ${type}`);
        }
      };
      // Sample first few faces for sanity logging
      const sampleCount = Math.min(5, message.faceCount);
      const sampleSummary: Array<{ count: number; firstIdxs: number[] }> = [];
      let sampleOffs = 0;
      for (let sf = 0; sf < sampleCount && sampleOffs < dv.byteLength; sf++) {
        let r = readVal(sampleOffs, faceCountType);
        const cnt = r.val >>> 0;
        sampleOffs = r.next;
        const firstIdxs: number[] = [];
        for (let j = 0; j < Math.min(cnt, 4) && sampleOffs < dv.byteLength; j++) {
          r = readVal(sampleOffs, faceIndexType);
          firstIdxs.push(r.val >>> 0);
          sampleOffs = r.next;
        }
        // Skip rest of indices for sampling
        for (let j = Math.min(cnt, 4); j < cnt && sampleOffs < dv.byteLength; j++) {
          r = readVal(sampleOffs, faceIndexType);
          sampleOffs = r.next;
        }
        sampleSummary.push({ count: cnt, firstIdxs });
      }
      // debug sample
      for (let f = 0; f < message.faceCount; f++) {
        let res = readVal(offs, faceCountType);
        const cnt = res.val >>> 0; // count is non-negative
        offs = res.next;
        const indices: number[] = new Array(cnt);
        for (let j = 0; j < cnt; j++) {
          res = readVal(offs, faceIndexType);
          indices[j] = res.val >>> 0;
          offs = res.next;
        }
        spatialData.faces.push({ indices });
      }
    }
  }

  console.log(`Load: total ${(performance.now() - startTime).toFixed(1)}ms`);

  if (message.faceCount) {
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
  const totalVertices = message.vertexCount;
  const verticesPerSecond = Math.round(totalVertices / (absoluteCompleteTime / 1000));
  const modeLabel = message.messageType === 'addFiles' ? 'ADD FILE' : 'ULTIMATE';
  // concise metrics printed above

  // total/read+parse/transfer come from the extension's wall-clock epochs on
  // the message — consistent for first and added files, no clock juggling.
  perf.note('verts', totalVertices.toLocaleString());
  perf.note('MB', (message.fileSizeInBytes / 1048576).toFixed(1));
  perf.note('mode', message.fast ? 'binary' : 'binary-js');
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
    fileName: message.fileName,
    shortPath: message.shortPath,
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
    fileName: message.fileName,
    shortPath: message.shortPath,
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

  // Reconstruct vertices from binary data
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
    if (normalArray && message.hasNormals) {
      vertex.nx = normalArray[i * 3];
      vertex.ny = normalArray[i * 3 + 1];
      vertex.nz = normalArray[i * 3 + 2];
    }

    spatialData.vertices.push(vertex);
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
