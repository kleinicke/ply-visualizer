import { CameraParams, DepthConversionResult } from '../interfaces';
import { DecodedDepthImage, DepthConverter } from './DepthConverter';
import { applyColorToDepthResult } from './applyColorToDepthResult';
import { ensureTiffWasmGlueLoaded, initTiffWasm } from './readers/tiffWasm';

interface DepthWorkerRequest {
  id: number;
  cacheKey: string;
  depthData?: ArrayBuffer;
  fileName: string;
  cameraParams: CameraParams;
  colorImageData?: ImageData;
  tiffWasmGlueUrl?: string;
  tiffWasmUrl?: string;
}

interface DepthWorkerSuccess {
  id: number;
  ok: true;
  result: DepthConversionResult;
}

interface DepthWorkerFailure {
  id: number;
  ok: false;
  error: string;
}

const converter = new DepthConverter();
const decodedCache = new Map<string, DecodedDepthImage>();
const decodedCacheOrder: string[] = [];
const maxDecodedCacheEntries = 4;

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
  if (!message.depthData) {
    throw new Error('Depth worker cache miss without source image bytes');
  }

  const decoded = await converter.decodeDepthImage(
    message.depthData,
    message.fileName,
    message.cameraParams
  );
  decodedCache.set(message.cacheKey, decoded);
  decodedCacheOrder.push(message.cacheKey);
  while (decodedCacheOrder.length > maxDecodedCacheEntries) {
    const oldest = decodedCacheOrder.shift();
    if (oldest) {
      decodedCache.delete(oldest);
    }
  }
  return decoded;
}

self.onmessage = async (event: MessageEvent<DepthWorkerRequest>) => {
  const message = event.data;
  try {
    if (message.tiffWasmUrl) {
      (globalThis as any).__TIFF_WASM_URL__ = message.tiffWasmUrl;
    }
    ensureTiffWasmGlueLoaded(message.tiffWasmGlueUrl);
    await initTiffWasm();

    // Timed here rather than logged here: the main thread folds these into the
    // single PERF line for the load (see utils/perfLog.ts).
    const wasCached = decodedCache.has(message.cacheKey);
    const decodeStart = performance.now();
    const decoded = await getDecodedDepth(message);
    const decodeMs = performance.now() - decodeStart;

    const projectStart = performance.now();
    const result = converter.projectDecodedDepthImage(
      decoded,
      message.fileName,
      message.cameraParams
    );
    result.timings = {
      decodeMs,
      projectMs: performance.now() - projectStart,
      decodeCached: wasCached,
      info: decoded.meta?.decodeInfo,
    };

    if (message.colorImageData) {
      applyColorToDepthResult(result, message.colorImageData, message.cameraParams);
    }

    const response: DepthWorkerSuccess = {
      id: message.id,
      ok: true,
      result,
    };
    (self as any).postMessage(response, transferListFor(result));
  } catch (error) {
    const response: DepthWorkerFailure = {
      id: message.id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
    (self as any).postMessage(response);
  }
};
