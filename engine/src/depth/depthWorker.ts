import { CameraParams, DepthConversionResult } from '../interfaces';
import { DecodedDepthImage, DepthConverter } from './DepthConverter';
import { applyColorToDepthResult } from './applyColorToDepthResult';
import { ensureTiffWasmGlueLoaded, initTiffWasm } from './readers/tiffWasm';
import { adoptWorkerPublicPath } from '../utils/webviewWorker';
import { positionBounds } from '../visualization/positionBounds';

// This worker starts the projection pool's workers; their chunk URLs must
// point at the bundle even when this worker runs from a blob.
adoptWorkerPublicPath();

interface DepthWorkerRequest {
  id: number;
  cacheKey: string;
  depthData?: ArrayBuffer;
  /** An image this worker decoded earlier and parked with the page (see `park`). */
  decoded?: DecodedDepthImage;
  fileName: string;
  cameraParams: CameraParams;
  colorImageData?: ImageData;
  tiffWasmGlueUrl?: string;
  tiffWasmUrl?: string;
  tiffWasmModule?: WebAssembly.Module;
  pointcloudWasmModule?: WebAssembly.Module;
}

interface DepthWorkerSuccess {
  id: number;
  ok: true;
  result: DepthConversionResult;
  /** Decoded images this worker no longer holds (see `maxDecodedCacheBytes`). */
  evicted: string[];
}

/** Asks the worker to hand back its decoded images before it is terminated. */
interface DepthWorkerParkRequest {
  park: true;
}

interface DepthWorkerParked {
  parked: { cacheKey: string; decoded: DecodedDepthImage }[];
}

interface DepthWorkerFailure {
  id: number;
  ok: false;
  evicted: string[];
  error: string;
}

const converter = new DepthConverter();
const decodedCache = new Map<string, DecodedDepthImage>();
const decodedCacheOrder: string[] = [];
const maxDecodedCacheEntries = 4;
/**
 * Decoded images kept for live parameter changes, by size as well as count:
 * a 26-megapixel float image is 100 MB decoded, and four of them sat in this
 * worker for as long as the view was open. The newest is always kept.
 */
const maxDecodedCacheBytes = 192 * 1024 * 1024;
/** Keys dropped since the last reply, so the client stops assuming them. */
let evictedSinceReply: string[] = [];

function decodedBytes(decoded: DecodedDepthImage): number {
  return decoded.image.data.byteLength;
}

function transferListFor(result: DepthConversionResult): Transferable[] {
  const transfers: Transferable[] = [result.vertices.buffer];
  if (result.colors) {
    transfers.push(result.colors.buffer);
  }
  if (result.pixelCoords) {
    transfers.push(result.pixelCoords.buffer);
  }
  return transfers;
}

async function getDecodedDepth(message: DepthWorkerRequest): Promise<DecodedDepthImage> {
  const cached = decodedCache.get(message.cacheKey);
  if (cached) {
    return cached;
  }
  if (!message.depthData && !message.decoded) {
    throw new Error('Depth worker cache miss without source image bytes');
  }

  const decoded =
    message.decoded ??
    (await converter.decodeDepthImage(message.depthData!, message.fileName, message.cameraParams));
  decodedCache.set(message.cacheKey, decoded);
  decodedCacheOrder.push(message.cacheKey);
  let total = 0;
  for (const key of decodedCacheOrder) {
    total += decodedBytes(decodedCache.get(key)!);
  }
  while (
    decodedCacheOrder.length > 1 &&
    (decodedCacheOrder.length > maxDecodedCacheEntries || total > maxDecodedCacheBytes)
  ) {
    const oldest = decodedCacheOrder.shift()!;
    total -= decodedBytes(decodedCache.get(oldest)!);
    decodedCache.delete(oldest);
    evictedSinceReply.push(oldest);
  }
  return decoded;
}

self.onmessage = async (event: MessageEvent<DepthWorkerRequest | DepthWorkerParkRequest>) => {
  if ('park' in event.data) {
    const parked = decodedCacheOrder.map(cacheKey => ({
      cacheKey,
      decoded: decodedCache.get(cacheKey)!,
    }));
    decodedCache.clear();
    decodedCacheOrder.length = 0;
    const response: DepthWorkerParked = { parked };
    // Moved, not copied; a buffer two images share is listed once.
    const transfers = [...new Set(parked.map(entry => entry.decoded.image.data.buffer))];
    try {
      (self as any).postMessage(response, transfers);
    } catch {
      (self as any).postMessage(response);
    }
    return;
  }
  const message = event.data;
  try {
    if (message.tiffWasmUrl) {
      (globalThis as any).__TIFF_WASM_URL__ = message.tiffWasmUrl;
    }
    if (message.tiffWasmGlueUrl) {
      (globalThis as any).__TIFF_WASM_GLUE_URL__ = message.tiffWasmGlueUrl;
    }
    if (message.pointcloudWasmModule) {
      (globalThis as any).__PLY_POINTCLOUD_WASM_MODULE__ = message.pointcloudWasmModule;
    }
    if (message.tiffWasmModule) {
      (globalThis as any).__TIFF_WASM_MODULE__ = message.tiffWasmModule;
    }
    ensureTiffWasmGlueLoaded(message.tiffWasmGlueUrl);
    await initTiffWasm();

    // Timed here rather than logged here: the main thread folds these into the
    // single PERF line for the load (see utils/perfLog.ts).
    const wasCached = decodedCache.has(message.cacheKey) || !!message.decoded;
    const decodeStart = performance.now();
    const decoded = await getDecodedDepth(message);
    const decodeMs = performance.now() - decodeStart;

    const projectStart = performance.now();
    const result = await converter.projectDecodedDepthImage(
      decoded,
      message.fileName,
      message.cameraParams
    );
    result.timings = {
      decodeMs,
      projectMs: performance.now() - projectStart,
      decodeCached: wasCached,
      info: decoded.meta?.decodeInfo,
      thread: 'worker',
      bands: (result as { bands?: number }).bands,
      phases: (result as { phases?: string }).phases,
    };

    if (message.colorImageData) {
      applyColorToDepthResult(result, message.colorImageData, message.cameraParams);
    }
    // Two passes over every point, here rather than on the main thread.
    result.positionBounds = positionBounds(result.vertices, result.pointCount);

    const response: DepthWorkerSuccess = {
      id: message.id,
      ok: true,
      result,
      evicted: evictedSinceReply,
    };
    evictedSinceReply = [];
    (self as any).postMessage(response, transferListFor(result));
  } catch (error) {
    const response: DepthWorkerFailure = {
      id: message.id,
      ok: false,
      evicted: evictedSinceReply,
      error: error instanceof Error ? error.message : String(error),
    };
    evictedSinceReply = [];
    (self as any).postMessage(response);
  }
};
