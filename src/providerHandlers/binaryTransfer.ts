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
      return await fs.promises.readFile(uri.fsPath);
    } catch {
      /* fall back to the workspace filesystem */
    }
  }
  return vscode.workspace.fs.readFile(uri);
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
  headerResult: any,
  rawFileData: Uint8Array,
  messageType: string,
  logPerf: (line: string) => void
): Promise<void> {
  console.log(`🚀 ULTIMATE: Sending raw binary data for ${parsedData.fileName}`);

  // Extract exactly the binary vertex bytes into a standalone ArrayBuffer.
  // NOTE: vscode.workspace.fs.readFile returns a Node Buffer, whose .slice()
  // is a *view* over the whole file's ArrayBuffer — so we must slice .buffer
  // by byteOffset/byteLength to copy out just the vertex region. Sending the
  // raw .buffer instead would ship the whole file from offset 0 (header bytes
  // read as float32 → garbage geometry).
  const copyStart = performance.now();
  const binaryVertexData = rawFileData.subarray(headerResult.binaryDataStart);
  const slicedBuffer = binaryVertexData.buffer.slice(
    binaryVertexData.byteOffset,
    binaryVertexData.byteOffset + binaryVertexData.byteLength
  );
  const copyMs = performance.now() - copyStart;
  logPerf(
    `⏱️ PERF[ply/ext] copy ${copyMs.toFixed(1)}ms (${(binaryVertexData.byteLength / 1048576).toFixed(1)}MB) for ${parsedData.fileName}`
  );

  // Send raw binary data + parsing metadata
  webviewPanel.webview.postMessage({
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

    // Raw binary data + parsing info
    rawBinaryData: slicedBuffer,
    vertexStride: headerResult.vertexStride,
    propertyOffsets: Array.from(headerResult.propertyOffsets.entries()),
    littleEndian: headerResult.headerInfo.format === 'binary_little_endian',
    faceCountType: headerResult.faceCountType,
    faceIndexType: headerResult.faceIndexType,
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
  void webviewPanel.webview.postMessage({
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
    void webviewPanel.webview.postMessage({
      type: 'splatContainerUri',
      messageType: message.messageType || 'addFiles',
      data: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      fileName: message.fileName,
      shortPath: message.shortPath,
      fileSizeInBytes: bytes.byteLength,
    });
  } catch (error) {
    console.error('Splat container fallback failed:', error);
    void webviewPanel.webview.postMessage({
      type: 'loadingError',
      fileName: message.fileName,
      fileType: 'gaussian splat',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function sendSpatialDataToWebview(
  webviewPanel: vscode.WebviewPanel,
  spatialDataArray: any[],
  messageType: string
): Promise<void> {
  for (const spatialData of spatialDataArray) {
    console.log(
      `🚀 Binary transfer for ${spatialData.fileName} (${spatialData.vertexCount} vertices)`
    );
    const startTime = performance.now();
    let usedChunking = false;

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
  let normalBuffer: Float32Array | null = null;

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

  // Handle faces if present
  let indexBuffer: Uint32Array | null = null;
  if (spatialData.faces && spatialData.faces.length > 0) {
    const faces = spatialData.faces;
    indexBuffer = new Uint32Array(faces.length * 3); // Assuming triangles

    for (let i = 0; i < faces.length; i++) {
      const face = faces[i];
      indexBuffer[i * 3] = face.indices[0];
      indexBuffer[i * 3 + 1] = face.indices[1];
      indexBuffer[i * 3 + 2] = face.indices[2];
    }
  }

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
  const delivered = await webviewPanel.webview.postMessage({
    type: 'binarySpatialData',
    messageType: messageType,
    fileName: spatialData.fileName,
    shortPath: spatialData.shortPath,
    vertexCount: vertexCount,
    faceCount: spatialData.faceCount,
    hasColors: hasColors,
    hasNormals: hasNormals,
    hasIntensity: !!spatialData.hasIntensity,
    format: spatialData.format,
    comments: spatialData.comments,
    // Binary buffers (will be transferred efficiently)
    positionBuffer: positionBuffer.buffer,
    colorBuffer: colorBuffer ? colorBuffer.buffer : null,
    normalBuffer: normalBuffer ? normalBuffer.buffer : null,
    indexBuffer: indexBuffer ? indexBuffer.buffer : null,
    scalarFieldBuffers: Object.fromEntries(
      Object.entries(spatialData.scalarFields || {}).map(([name, values]) => [
        name,
        (values as Float32Array).buffer,
      ])
    ),
    sourcePointCount: spatialData.sourcePointCount,
    sourceOrigin: spatialData.sourceOrigin,
    metadata: spatialData.metadata,
    fileSizeInBytes: spatialData.fileSizeInBytes,
    isGaussianSplat: !!spatialData.isGaussianSplat,
    splatSource: spatialData.splatSource,
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
  // ULTRA-AGGRESSIVE chunking for maximum transfer speed
  const CHUNK_SIZE = 250000;
  const totalVertices = spatialData.vertexCount;
  const typed = !!spatialData.useTypedArrays && spatialData.positionsArray instanceof Float32Array;
  const vertices = spatialData.vertices;
  const colors = spatialData.colors;
  const normals = spatialData.normals;
  const faces = spatialData.faces;

  const totalChunks = Math.ceil(totalVertices / CHUNK_SIZE);
  console.log(
    `🚀 Ultra-fast chunking: ${spatialData.fileName} (${totalVertices} vertices, ${totalChunks} chunks)`
  );

  const startTime = performance.now();
  let firstChunkTime = 0;

  const transferId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const scalarFields = (spatialData.scalarFields || {}) as Record<string, Float32Array>;

  // Send start message. A unique key matters for E57 files whose scans may
  // legally have duplicate or missing names.
  const started = await webviewPanel.webview.postMessage({
    type: 'startLargeFile',
    transferId,
    fileName: spatialData.fileName,
    shortPath: spatialData.shortPath,
    totalVertices: totalVertices,
    totalChunks: totalChunks,
    hasColors: spatialData.hasColors,
    hasNormals: spatialData.hasNormals,
    faces: faces,
    format: spatialData.format,
    comments: spatialData.comments,
    messageType: messageType,
    useTypedArrays: typed,
    hasIntensity: !!spatialData.hasIntensity,
    scalarFieldNames: Object.keys(scalarFields),
    sourcePointCount: spatialData.sourcePointCount,
    sourceOrigin: spatialData.sourceOrigin,
    metadata: spatialData.metadata,
    fileSizeInBytes: spatialData.fileSizeInBytes,
  });
  if (!started) {
    throw new Error(`The webview rejected the chunked-transfer header for ${spatialData.fileName}`);
  }

  try {
    // Send chunks with minimal overhead
    for (let i = 0; i < totalChunks; i++) {
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

      const delivered = await webviewPanel.webview.postMessage({
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
      });
      if (!delivered) {
        throw new Error(
          `The webview rejected chunk ${i + 1}/${totalChunks} for ${spatialData.fileName}`
        );
      }

      if (i === 0) {
        firstChunkTime = performance.now();
      }

      // Log only every 5th chunk to reduce console spam
      if (i % 5 === 0 || i === totalChunks - 1) {
        console.log(`Chunk ${i + 1}/${totalChunks} (${chunkSize} vertices)`);
      }
    }

    // Send completion message
    const completed = await webviewPanel.webview.postMessage({
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
    await webviewPanel.webview.postMessage({
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
