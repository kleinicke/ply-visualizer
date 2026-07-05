import { SpatialData, SpatialFace, SpatialVertex } from './interfaces';

export interface LargeFileChunkingHost {
  isFileLoading: boolean;
  chunkedFileState: Map<
    string,
    {
      fileName: string;
      totalVertices: number;
      totalChunks: number;
      receivedChunks: number;
      vertices: SpatialVertex[];
      hasColors: boolean;
      hasNormals: boolean;
      faces: SpatialFace[];
      format: string;
      comments: string[];
      messageType: string;
      startTime: number;
      firstChunkTime: number;
      lastChunkTime: number;
    }
  >;
  updateWelcomeMessageVisibility(): void;
  addNewFiles(newFiles: SpatialData[]): void;
  displayFiles(dataArray: SpatialData[]): Promise<void>;
}

export function handleStartLargeFile(host: LargeFileChunkingHost, message: any): void {
  const startTime = performance.now();
  console.log(
    `Starting chunked loading for ${message.fileName} (${message.totalVertices} vertices, ${message.totalChunks} chunks)`
  );

  host.isFileLoading = true;
  host.updateWelcomeMessageVisibility();

  // Show loading progress
  const loadingEl = document.getElementById('loading');
  if (loadingEl) {
    loadingEl.classList.remove('hidden');
    loadingEl.textContent = `Loading ${message.fileName} (0/${message.totalChunks} chunks)...`;
  }

  // Initialize chunked file state
  host.chunkedFileState.set(message.fileName, {
    fileName: message.fileName,
    totalVertices: message.totalVertices,
    totalChunks: message.totalChunks,
    receivedChunks: 0,
    vertices: new Array(message.totalVertices),
    hasColors: message.hasColors,
    hasNormals: message.hasNormals,
    faces: message.faces || [],
    format: message.format,
    comments: message.comments || [],
    messageType: '',
    startTime: startTime,
    firstChunkTime: 0,
    lastChunkTime: 0,
  });
}

export function handleLargeFileChunk(host: LargeFileChunkingHost, message: any): void {
  const chunkReceiveTime = performance.now();
  const fileState = host.chunkedFileState.get(message.fileName);
  if (!fileState) {
    console.error(`No state found for chunked file: ${message.fileName}`);
    return;
  }

  // Record timing for first and last chunks
  if (fileState.receivedChunks === 0) {
    fileState.firstChunkTime = chunkReceiveTime;
    const timeSinceStart = chunkReceiveTime - fileState.startTime;
    console.log(`First chunk received after ${timeSinceStart.toFixed(2)}ms`);
  }

  // Add chunk vertices to the appropriate position
  const startIndex = message.chunkIndex * 1000000; // Must match ultra-fast CHUNK_SIZE
  const chunkVertices = message.vertices;

  const copyStartTime = performance.now();
  for (let i = 0; i < chunkVertices.length; i++) {
    fileState.vertices[startIndex + i] = chunkVertices[i];
  }
  const copyTime = performance.now() - copyStartTime;

  fileState.receivedChunks++;
  fileState.lastChunkTime = chunkReceiveTime;

  // Update loading progress
  const loadingEl = document.getElementById('loading');
  if (loadingEl) {
    const progress = Math.round((fileState.receivedChunks / fileState.totalChunks) * 100);
    loadingEl.textContent = `Loading ${message.fileName} (${fileState.receivedChunks}/${fileState.totalChunks} chunks, ${progress}%)...`;
  }

  // Only log every 10th chunk to reduce console spam
  if (message.chunkIndex % 10 === 0 || fileState.receivedChunks === fileState.totalChunks) {
    console.log(
      `Chunk ${message.chunkIndex + 1}/${message.totalChunks} (${chunkVertices.length} vertices, copy: ${copyTime.toFixed(2)}ms)`
    );
  }
}

export async function handleLargeFileComplete(
  host: LargeFileChunkingHost,
  message: any
): Promise<void> {
  const completeTime = performance.now();
  const fileState = host.chunkedFileState.get(message.fileName);
  if (!fileState) {
    console.error(`No state found for completed chunked file: ${message.fileName}`);
    return;
  }

  // Calculate comprehensive timing
  const totalTransferTime = completeTime - fileState.startTime;
  const firstChunkDelay = fileState.firstChunkTime - fileState.startTime;
  const transferTime = fileState.lastChunkTime - fileState.firstChunkTime;
  const assemblyStartTime = performance.now();

  console.log(`📊 Chunked loading timing for ${message.fileName}:
  • Total transfer time: ${totalTransferTime.toFixed(2)}ms
  • Time to first chunk: ${firstChunkDelay.toFixed(2)}ms
  • Chunk transfer time: ${transferTime.toFixed(2)}ms
  • Chunks: ${fileState.totalChunks} (${(transferTime / fileState.totalChunks).toFixed(2)}ms avg)`);

  // Create complete PLY data object
  const spatialData: SpatialData = {
    vertices: fileState.vertices,
    faces: fileState.faces,
    format: fileState.format as any,
    version: '1.0',
    comments: fileState.comments,
    vertexCount: fileState.totalVertices,
    faceCount: fileState.faces.length,
    hasColors: fileState.hasColors,
    hasNormals: fileState.hasNormals,
    fileName: fileState.fileName,
    fileIndex: 0,
  };

  const assemblyTime = performance.now() - assemblyStartTime;

  // Process the completed file based on original message type
  const processStartTime = performance.now();
  if (message.messageType === 'multiSpatialData') {
    await host.displayFiles([spatialData]);
  } else if (message.messageType === 'addFiles') {
    host.addNewFiles([spatialData]);
  }

  // Normals visualizer will be created on-demand when user clicks normals button
  const processTime = performance.now() - processStartTime;

  const totalTime = performance.now() - fileState.startTime;
  console.log(`  • PLY assembly time: ${assemblyTime.toFixed(2)}ms
  • File processing time: ${processTime.toFixed(2)}ms
  • TOTAL TIME: ${totalTime.toFixed(2)}ms`);

  // Hide loading indicator
  document.getElementById('loading')?.classList.add('hidden');

  // Clean up chunked file state
  host.chunkedFileState.delete(message.fileName);
}
