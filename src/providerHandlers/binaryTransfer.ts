import { sendToWebview } from './webviewTransport';
import { scalarArrayTypes } from '../../engine/src/utils/scalarFields';
import { compactPointNormals } from '../../engine/src/utils/normals';
import type { ScalarArray } from '../../engine/src/interfaces';
import * as vscode from 'vscode';
import * as fs from 'fs';

export function toUint8Array(data: ArrayBuffer | Uint8Array): Uint8Array {
  if (data instanceof Uint8Array) {
    return data;
  }
  return new Uint8Array(data);
}

export function toArrayBuffer(data: Uint8Array): ArrayBuffer {
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
}

/**
 * Read a file's bytes. For local files this uses Node's fs directly, which is
 * markedly faster than vscode.workspace.fs on large files (the latter routes
 * through the FS-provider abstraction). Falls back to workspace.fs for
 * non-local/virtual schemes.
 */
export async function readFileFast(uri: vscode.Uri): Promise<Uint8Array> {
  if (uri.scheme === 'file') {
    try {
      const handle = await fs.promises.open(uri.fsPath, 'r');
      try {
        const size = (await handle.stat()).size;
        if (size < SHARED_READ_SPLIT_BYTES) {
          return await handle.readFile();
        }
        // Concurrent reads, as readFileShared; a non-pooled Buffer, as readFile.
        const bytes = Buffer.allocUnsafeSlow(size);
        await readConcurrently(handle, bytes, size, uri.fsPath);
        return bytes;
      } finally {
        await handle.close();
      }
    } catch {
      /* fall back to the workspace filesystem */
    }
  }
  return vscode.workspace.fs.readFile(uri);
}

/**
 * A typed array's own bytes as an ArrayBuffer. The webview rebuilds each array
 * from a whole buffer, so a view into a larger one would arrive as the wrong
 * data; it is copied, and an array that owns its buffer is sent as is.
 */
function ownBuffer(view: ArrayBufferView): ArrayBuffer {
  const shared =
    typeof SharedArrayBuffer !== 'undefined' && view.buffer instanceof SharedArrayBuffer;
  return view.byteOffset === 0 && view.byteLength === view.buffer.byteLength && !shared
    ? (view.buffer as ArrayBuffer)
    : (new Uint8Array(view.buffer, view.byteOffset, view.byteLength).slice().buffer as ArrayBuffer);
}

const SHARED_READ_PARTS = 4;
const SHARED_READ_SPLIT_BYTES = 32 * 1024 * 1024;

/**
 * Fill `bytes` with the file in several positional reads at once, which keeps
 * libuv's threads busy: a warm 723 MB archive read in ~40 ms this way against
 * ~110 ms as one read (or fs.readFile).
 */
async function readConcurrently(
  handle: fs.promises.FileHandle,
  bytes: Uint8Array,
  size: number,
  name: string
): Promise<void> {
  const parts = size >= SHARED_READ_SPLIT_BYTES ? SHARED_READ_PARTS : 1;
  const step = Math.ceil(size / parts);
  await Promise.all(
    Array.from({ length: parts }, async (_, part) => {
      let filled = part * step;
      const end = Math.min(size, filled + step);
      while (filled < end) {
        const { bytesRead } = await handle.read(bytes, filled, end - filled, filled);
        if (bytesRead === 0) {
          throw new Error(`${name} ended early`);
        }
        filled += bytesRead;
      }
    })
  );
}

/**
 * Read a file into memory that the decoder workers can share.
 *
 * The decoders run in worker threads (parsePool.ts), and a range or scan job
 * needs only part of the file. A SharedArrayBuffer lets every worker read the
 * same bytes without each being sent a copy; a worker hands only its own part
 * to wasm.
 */
export async function readFileShared(uri: vscode.Uri): Promise<Uint8Array> {
  if (uri.scheme === 'file') {
    try {
      const handle = await fs.promises.open(uri.fsPath, 'r');
      try {
        const size = (await handle.stat()).size;
        const bytes = new Uint8Array(new SharedArrayBuffer(size));
        await readConcurrently(handle, bytes, size, uri.fsPath);
        return bytes;
      } finally {
        await handle.close();
      }
    } catch {
      /* fall back to the workspace filesystem */
    }
  }
  const read = await vscode.workspace.fs.readFile(uri);
  const shared = new Uint8Array(new SharedArrayBuffer(read.byteLength));
  shared.set(read);
  return shared;
}

/**
 * Read just the first `maxBytes` of a local file (for header detection before
 * deciding whether to stream the body). Returns a copy sized to bytes actually
 * read; throws on non-file schemes / IO errors (callers fall back).
 */
export async function readFileHead(uri: vscode.Uri, maxBytes: number): Promise<Uint8Array> {
  const fh = await fs.promises.open(uri.fsPath, 'r');
  try {
    const buf = Buffer.allocUnsafe(maxBytes);
    const { bytesRead } = await fh.read(buf, 0, maxBytes, 0);
    return new Uint8Array(buf.subarray(0, bytesRead));
  } finally {
    await fh.close();
  }
}

/**
 * True if a PCD's VIEWPOINT is identity (or absent) — i.e. no rigid transform
 * needs applying. The WASM PCD parser doesn't carry the viewpoint, so clouds
 * with a non-identity viewpoint stay on the JS path that applies it.
 */
export function pcdViewpointIsIdentity(bytes: Uint8Array): boolean {
  const head = Buffer.from(bytes.subarray(0, Math.min(1024, bytes.length))).toString('utf8');
  const m = head.match(/^VIEWPOINT\s+(.+)$/m);
  if (!m) {
    return true;
  }
  const v = m[1].trim().split(/\s+/).map(Number);
  return (
    v.length >= 7 &&
    v[0] === 0 &&
    v[1] === 0 &&
    v[2] === 0 &&
    v[3] === 1 &&
    v[4] === 0 &&
    v[5] === 0 &&
    v[6] === 0
  );
}

export async function sendUltimateRawBinary(
  webviewPanel: vscode.WebviewPanel,
  parsedData: any,
  rawFileData: Uint8Array,
  messageType: string,
  logPerf: (line: string) => void
): Promise<void> {
  console.log(`🚀 ULTIMATE: Sending raw binary data for ${parsedData.fileName}`);

  // The whole file goes across, header included: the webview parses it with
  // the same Rust parser the extension host would have used, so it needs no
  // property/offset table - and a Gaussian file no longer needs its header
  // sent separately for Spark to reconstruct the source.
  //
  // NOTE: vscode.workspace.fs.readFile returns a Node Buffer, whose .buffer is
  // the whole pooled allocation, so the copy is taken by byteOffset/byteLength
  // rather than by handing over .buffer.
  const copyStart = performance.now();
  const fileBuffer = rawFileData.buffer.slice(
    rawFileData.byteOffset,
    rawFileData.byteOffset + rawFileData.byteLength
  );
  const copyMs = performance.now() - copyStart;
  logPerf(
    `⏱️ PERF[ply/ext] copy ${copyMs.toFixed(1)}ms (${(rawFileData.byteLength / 1048576).toFixed(1)}MB) for ${parsedData.fileName}`
  );

  // Send raw binary data + parsing metadata
  sendToWebview(webviewPanel, {
    type: 'ultimateRawBinaryData',
    messageType: messageType,
    // Wall-clock epoch stamped right before postMessage so the webview can
    // measure the cross-process serialization+IPC "transfer" cost.
    postedAt: Date.now(),
    fileName: parsedData.fileName,
    shortPath: parsedData.shortPath,
    fileSizeInBytes: rawFileData.byteLength,
    vertexCount: parsedData.vertexCount,
    faceCount: parsedData.faceCount,
    hasColors: parsedData.hasColors,
    hasNormals: parsedData.hasNormals,
    hasIntensity: parsedData.hasIntensity,
    format: parsedData.format,
    comments: parsedData.comments,

    // The file itself; everything above is display metadata for the file list.
    rawBinaryData: fileBuffer,
  });
}

/** Splat-native container formats decoded by Spark in the webview. */
export const SPLAT_CONTAINER_EXTENSIONS = ['.spz', '.splat', '.ksplat', '.sog'];

/**
 * Splat containers are not parsed in the extension: the webview fetches the
 * bytes from this URI, Spark decodes them, and the gaussian centers join the
 * scene as a point cloud with splat rendering enabled (splatMode.ts).
 */
export function sendSplatContainerUri(
  webviewPanel: vscode.WebviewPanel,
  fileUri: vscode.Uri,
  fileName: string,
  shortPath: string | undefined,
  messageType: 'multiSpatialData' | 'addFiles',
  fileSizeInBytes?: number
): void {
  void sendToWebview(webviewPanel, {
    type: 'splatContainerUri',
    messageType,
    fileUri: webviewPanel.webview.asWebviewUri(fileUri).toString(),
    // For the webview's fetch-failure fallback (files outside
    // localResourceRoots): it sends this back via 'splatContainerFetchFailed'
    // and the extension re-reads and resends raw bytes.
    docUri: fileUri.toString(),
    fileName,
    shortPath,
    fileSizeInBytes,
  });
}

/**
 * Fallback for 'splatContainerFetchFailed': re-read the file in the extension
 * host and resend the raw bytes over postMessage (structured clone).
 */
export async function resendSplatContainerBytes(
  webviewPanel: vscode.WebviewPanel,
  message: { docUri: string; fileName: string; shortPath?: string; messageType?: string }
): Promise<void> {
  try {
    const uri = vscode.Uri.parse(message.docUri);
    const bytes = await vscode.workspace.fs.readFile(uri);
    void sendToWebview(webviewPanel, {
      type: 'splatContainerUri',
      messageType: message.messageType || 'addFiles',
      data: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      fileName: message.fileName,
      shortPath: message.shortPath,
      fileSizeInBytes: bytes.byteLength,
    });
  } catch (error) {
    console.error('Splat container fallback failed:', error);
    void sendToWebview(webviewPanel, {
      type: 'loadingError',
      fileName: message.fileName,
      fileType: 'gaussian splat',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * @param logPerf optional Output-channel sink. Handing geometry over was the
 *   largest and by far the most volatile phase of an X3A load — 5.1 s, 22.1 s
 *   and 50.2 s on three consecutive opens of the same file — while the only
 *   numbers about it went to the devtools console, where a benchmark cannot
 *   see them. One line per scan, saying which route it took and how big it
 *   was, is what makes that phase arguable instead of mysterious.
 */
export async function sendSpatialDataToWebview(
  webviewPanel: vscode.WebviewPanel,
  spatialDataArray: any[],
  messageType: string,
  logPerf?: (line: string) => void
): Promise<void> {
  for (const spatialData of spatialDataArray) {
    console.log(
      `🚀 Binary transfer for ${spatialData.fileName} (${spatialData.vertexCount} vertices)`
    );
    const startTime = performance.now();
    let usedChunking = false;
    // Packed here, off the viewer's UI thread, rather than when the webview
    // builds the cloud; it also halves the normals on the wire. The message
    // says which type they are (normalType) - a buffer carries no type.
    compactPointNormals(spatialData);

    try {
      const scalarBytes = Object.values(spatialData.scalarFields || {}).reduce(
        (sum: number, values: any) => sum + (values?.byteLength || 0),
        0
      );
      const packedBytes =
        (spatialData.positionsArray?.byteLength || 0) +
        (spatialData.colorsArray?.byteLength || 0) +
        (spatialData.normalsArray?.byteLength || 0) +
        scalarBytes;
      // Avoid one enormous structured clone. Smaller packed chunks also let
      // postMessage provide useful backpressure and a precise failure point.
      if (spatialData.useTypedArrays && packedBytes > 64 * 1024 * 1024) {
        usedChunking = true;
        await sendLargeFileInChunksOptimized(webviewPanel, spatialData, messageType);
      } else {
        await sendBinaryData(webviewPanel, spatialData, messageType);
      }
      const transferTime = performance.now() - startTime;
      console.log(`⚡ Binary transfer complete: ${transferTime.toFixed(1)}ms`);
      logPerf?.(
        `⏱️ PERF[transfer/${usedChunking ? 'chunked' : 'packed'} ${spatialData.fileName}] ` +
          `send ${transferTime.toFixed(1)}ms  (${(packedBytes / 1048576).toFixed(1)} MB · ` +
          `${spatialData.vertexCount.toLocaleString()} pts · ` +
          `${((packedBytes / 1048576 / transferTime) * 1000).toFixed(0)} MB/s)`
      );
    } catch (error) {
      if (usedChunking) {
        throw error;
      }
      console.log(
        `⚠️ Binary transfer failed for ${spatialData.fileName}, falling back to chunking...`
      );
      await sendLargeFileInChunksOptimized(webviewPanel, spatialData, messageType);
    }
  }
}

/**
 * A file's faces as one triangle index buffer: the parser's own when it made
 * one, otherwise the face objects fan-triangulated. (Taking each face's first
 * three indices, as this used to, dropped half of every quad.)
 */
function triangleIndices(spatialData: any): Uint32Array | null {
  if (spatialData.indicesArray instanceof Uint32Array) {
    return spatialData.indicesArray;
  }
  const faces: { indices: number[] }[] = spatialData.faces ?? [];
  if (faces.length === 0) {
    return null;
  }
  const flat: number[] = [];
  for (const face of faces) {
    for (let k = 1; k < face.indices.length - 1; k++) {
      flat.push(face.indices[0], face.indices[k], face.indices[k + 1]);
    }
  }
  return flat.length > 0 ? Uint32Array.from(flat) : null;
}

export async function sendBinaryData(
  webviewPanel: vscode.WebviewPanel,
  spatialData: any,
  messageType: string
): Promise<void> {
  // Check if we have direct TypedArrays (ultra-fast path)
  const vertexCount = spatialData.vertexCount;
  const hasColors = spatialData.hasColors;
  const hasNormals = spatialData.hasNormals;

  let positionBuffer: Float32Array;
  let colorBuffer: Uint8Array | null = null;
  let normalBuffer: Float32Array | Int16Array | null = null;

  if (spatialData.useTypedArrays) {
    // Ultra-fast: Use TypedArrays directly (zero-copy)
    console.log(`🚀 Using direct TypedArrays for binary transfer - ZERO COPY!`);
    positionBuffer = spatialData.positionsArray;
    colorBuffer = spatialData.colorsArray;
    normalBuffer = spatialData.normalsArray;
  } else {
    // Fallback: Convert vertex objects to TypedArrays
    console.log(`🔄 Converting vertex objects to TypedArrays for binary transfer...`);
    const vertices = spatialData.vertices;

    // Create typed arrays for vertices (always 3 floats: x, y, z)
    positionBuffer = new Float32Array(vertexCount * 3);

    // Optional color buffer (RGB as bytes: 0-255)
    if (hasColors) {
      colorBuffer = new Uint8Array(vertexCount * 3);
    }

    // Optional normal buffer (3 floats: nx, ny, nz)
    if (hasNormals) {
      normalBuffer = new Float32Array(vertexCount * 3);
    }

    // Fill the buffers
    for (let i = 0; i < vertexCount; i++) {
      const vertex = vertices[i];

      // Position (always present)
      positionBuffer[i * 3] = vertex.x;
      positionBuffer[i * 3 + 1] = vertex.y;
      positionBuffer[i * 3 + 2] = vertex.z;

      // Colors (if present)
      if (hasColors && colorBuffer) {
        colorBuffer[i * 3] = vertex.red || 0;
        colorBuffer[i * 3 + 1] = vertex.green || 0;
        colorBuffer[i * 3 + 2] = vertex.blue || 0;
      }

      // Normals (if present)
      if (hasNormals && normalBuffer) {
        normalBuffer[i * 3] = vertex.nx || 0;
        normalBuffer[i * 3 + 1] = vertex.ny || 0;
        normalBuffer[i * 3 + 2] = vertex.nz || 0;
      }
    }
  }

  const indexBuffer = triangleIndices(spatialData);

  // Calculate total binary size
  const scalarSize = Object.values(spatialData.scalarFields || {}).reduce(
    (sum: number, values: any) => sum + (values?.byteLength || 0),
    0
  );
  const totalSize =
    positionBuffer.byteLength +
    (colorBuffer ? colorBuffer.byteLength : 0) +
    (normalBuffer ? normalBuffer.byteLength : 0) +
    (indexBuffer ? indexBuffer.byteLength : 0) +
    scalarSize;

  console.log(
    `📦 Binary data: ${(totalSize / 1024 / 1024).toFixed(1)}MB (${vertexCount} vertices)`
  );

  // Send metadata + binary buffers
  const delivered = await sendToWebview(webviewPanel, {
    type: 'binarySpatialData',
    messageType: messageType,
    fileName: spatialData.fileName,
    shortPath: spatialData.shortPath,
    vertexCount: vertexCount,
    faceCount: indexBuffer ? indexBuffer.length / 3 : 0,
    hasColors: hasColors,
    hasNormals: hasNormals,
    hasIntensity: !!spatialData.hasIntensity,
    format: spatialData.format,
    comments: spatialData.comments,
    // Binary buffers (will be transferred efficiently)
    positionBuffer: ownBuffer(positionBuffer),
    colorBuffer: colorBuffer ? ownBuffer(colorBuffer) : null,
    normalBuffer: normalBuffer ? ownBuffer(normalBuffer) : null,
    normalType: normalBuffer instanceof Int16Array ? 'Int16Array' : 'Float32Array',
    indexBuffer: indexBuffer ? ownBuffer(indexBuffer) : null,
    scalarFieldBuffers: Object.fromEntries(
      Object.entries(spatialData.scalarFields || {}).map(([name, values]) => [
        name,
        ownBuffer(values as ScalarArray),
      ])
    ),
    scalarFieldTypes: scalarArrayTypes(
      spatialData.scalarFields as Record<string, ScalarArray> | undefined
    ),
    sourcePointCount: spatialData.sourcePointCount,
    sourceOrigin: spatialData.sourceOrigin,
    metadata: spatialData.metadata,
    fileSizeInBytes: spatialData.fileSizeInBytes,
    isGaussianSplat: !!spatialData.isGaussianSplat,
    splatSource: spatialData.splatSource,
    // Container identity (E57/X3A scans) so the webview can total the whole file.
    container: spatialData.container,
  });
  if (!delivered) {
    throw new Error(`The webview rejected the binary payload for ${spatialData.fileName}`);
  }
}

export async function sendLargeFileInChunksOptimized(
  webviewPanel: vscode.WebviewPanel,
  spatialData: any,
  messageType: string
): Promise<void> {
  const totalVertices = spatialData.vertexCount;
  const typed = !!spatialData.useTypedArrays && spatialData.positionsArray instanceof Float32Array;
  // Packed typed arrays are cheap to clone at this size: xyz + one scalar is
  // about 16 MB per million points. The old 250k size made a 42M-point X3A
  // issue ~169 sequential postMessages and repeat the same amount of event-loop
  // bookkeeping in the webview. Object vertices remain smaller because their
  // structured-clone overhead is much higher and less predictable.
  const CHUNK_SIZE = typed ? 1_000_000 : 250_000;
  const vertices = spatialData.vertices;
  const colors = spatialData.colors;
  const normals = spatialData.normals;
  const indices = triangleIndices(spatialData);

  const totalChunks = Math.ceil(totalVertices / CHUNK_SIZE);
  console.log(
    `🚀 Ultra-fast chunking: ${spatialData.fileName} (${totalVertices} vertices, ${totalChunks} chunks)`
  );

  const startTime = performance.now();
  let firstChunkTime = 0;

  const transferId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const scalarFields: Record<string, ScalarArray> = spatialData.scalarFields || {};

  // Send start message. A unique key matters for E57 files whose scans may
  // legally have duplicate or missing names.
  const started = await sendToWebview(webviewPanel, {
    type: 'startLargeFile',
    transferId,
    fileName: spatialData.fileName,
    shortPath: spatialData.shortPath,
    totalVertices: totalVertices,
    totalChunks: totalChunks,
    hasColors: spatialData.hasColors,
    hasNormals: spatialData.hasNormals,
    normalType: spatialData.normalsArray instanceof Int16Array ? 'Int16Array' : 'Float32Array',
    indexBuffer: indices ? indices.buffer : null,
    format: spatialData.format,
    comments: spatialData.comments,
    messageType: messageType,
    useTypedArrays: typed,
    hasIntensity: !!spatialData.hasIntensity,
    scalarFieldNames: Object.keys(scalarFields),
    scalarFieldTypes: scalarArrayTypes(scalarFields),
    sourcePointCount: spatialData.sourcePointCount,
    sourceOrigin: spatialData.sourceOrigin,
    metadata: spatialData.metadata,
    fileSizeInBytes: spatialData.fileSizeInBytes,
    isGaussianSplat: !!spatialData.isGaussianSplat,
    splatSource: spatialData.splatSource,
    // Container identity (E57/X3A scans) so the webview can total the whole file.
    container: spatialData.container,
  });
  if (!started) {
    throw new Error(`The webview rejected the chunked-transfer header for ${spatialData.fileName}`);
  }

  // Chunks posted but not yet confirmed. Allowing a second one overlaps
  // slicing the next chunk with the IPC copy of the previous, at the cost of
  // one more chunk alive at a time; postMessage keeps their order.
  const MAX_IN_FLIGHT = 2;
  const inFlight: Array<Promise<void>> = [];
  try {
    // Send chunks with minimal overhead
    for (let i = 0; i < totalChunks; i++) {
      if (inFlight.length >= MAX_IN_FLIGHT) {
        await inFlight.shift();
      }
      const startIdx = i * CHUNK_SIZE;
      const endIdx = Math.min(startIdx + CHUNK_SIZE, totalVertices);
      const chunkSize = endIdx - startIdx;

      // Typed LiDAR clouds never materialize millions of JS vertex objects.
      // Slice their packed arrays directly and retain every scalar field.
      const chunkVertices = typed ? undefined : vertices.slice(startIdx, endIdx);
      const positionBuffer = typed
        ? spatialData.positionsArray.slice(startIdx * 3, endIdx * 3).buffer
        : undefined;
      const colorBuffer =
        typed && spatialData.colorsArray
          ? spatialData.colorsArray.slice(startIdx * 3, endIdx * 3).buffer
          : undefined;
      const normalBuffer =
        typed && spatialData.normalsArray
          ? spatialData.normalsArray.slice(startIdx * 3, endIdx * 3).buffer
          : undefined;
      const scalarFieldBuffers = typed
        ? Object.fromEntries(
            Object.entries(scalarFields).map(([name, values]) => [
              name,
              values.slice(startIdx, endIdx).buffer,
            ])
          )
        : undefined;
      const chunkColors = !typed && colors ? colors.slice(startIdx, endIdx) : undefined;
      const chunkNormals = !typed && normals ? normals.slice(startIdx, endIdx) : undefined;

      const chunkIndex = i;
      const sent = sendToWebview(webviewPanel, {
        type: 'largeFileChunk',
        transferId,
        fileName: spatialData.fileName,
        chunkIndex: i,
        startIndex: startIdx,
        vertexCount: chunkSize,
        totalChunks: totalChunks,
        vertices: chunkVertices,
        colors: chunkColors,
        normals: chunkNormals,
        positionBuffer,
        colorBuffer,
        normalBuffer,
        scalarFieldBuffers,
      }).then(delivered => {
        if (!delivered) {
          throw new Error(
            `The webview rejected chunk ${chunkIndex + 1}/${totalChunks} for ${spatialData.fileName}`
          );
        }
        if (chunkIndex === 0) {
          firstChunkTime = performance.now();
        }
      });
      // Settled by the await below or in the catch; never left unhandled.
      sent.catch(() => {});
      inFlight.push(sent);

      // Log only every 5th chunk to reduce console spam
      if (i % 5 === 0 || i === totalChunks - 1) {
        console.log(`Chunk ${i + 1}/${totalChunks} (${chunkSize} vertices)`);
      }
    }

    while (inFlight.length > 0) {
      await inFlight.shift();
    }

    // Send completion message
    const completed = await sendToWebview(webviewPanel, {
      type: 'largeFileComplete',
      transferId,
      fileName: spatialData.fileName,
      messageType: messageType,
    });
    if (!completed) {
      throw new Error(`The webview rejected the completion message for ${spatialData.fileName}`);
    }
  } catch (error) {
    // Best-effort cleanup; the original transfer error remains authoritative.
    await sendToWebview(webviewPanel, {
      type: 'cancelLargeFile',
      transferId,
      fileName: spatialData.fileName,
    });
    throw error;
  }

  const totalTime = performance.now() - startTime;
  console.log(
    `⚡ Ultra-fast transfer complete: ${totalTime.toFixed(1)}ms total, ${firstChunkTime ? (firstChunkTime - startTime).toFixed(1) : 0}ms to first chunk`
  );
}
