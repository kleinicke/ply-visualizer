import { CameraParams, DepthConversionResult } from '../interfaces';
import { DepthConverter } from './DepthConverter';
import { applyColorToDepthResult } from './applyColorToDepthResult';
import { initTiffWasm } from './readers/tiffWasm';

interface PendingRequest {
  resolve: (result: DepthConversionResult) => void;
  reject: (error: Error) => void;
}

interface WorkerResponse {
  id: number;
  ok: boolean;
  result?: DepthConversionResult;
  error?: string;
}

function decodeConfigKey(cameraParams: CameraParams): string {
  return JSON.stringify({
    pngScaleFactor: cameraParams.pngScaleFactor ?? null,
    rgb24ConversionMode: cameraParams.rgb24ConversionMode ?? 'shift',
    rgb24ScaleFactor: cameraParams.rgb24ScaleFactor ?? 1000,
    rgb24InvalidValue: cameraParams.rgb24InvalidValue ?? null,
  });
}

export class DepthWorkerClient {
  private worker: Worker | null | undefined;
  private nextRequestId = 1;
  private pending = new Map<number, PendingRequest>();
  private primedCacheKeys = new Set<string>();
  private sourceIds = new WeakMap<ArrayBuffer, number>();
  private nextSourceId = 1;
  private tail: Promise<unknown> = Promise.resolve();
  private lifetime = new AbortController();

  dispose(): void {
    if (this.lifetime.signal.aborted) {
      return;
    }
    this.lifetime.abort();
    this.resetWorker();
  }

  private resetWorker(): void {
    this.worker?.terminate();
    this.worker = undefined;
    this.primedCacheKeys.clear();
  }

  constructor(private readonly fallbackConverter: DepthConverter) {}

  async processDepthToPointCloud(
    depthData: ArrayBuffer,
    fileName: string,
    cameraParams: CameraParams,
    colorImageData?: ImageData,
    signal?: AbortSignal
  ): Promise<DepthConversionResult> {
    const combined = AbortSignal.any([this.lifetime.signal, ...(signal ? [signal] : [])]);
    combined.throwIfAborted();
    // A single active request lets cancellation stop synchronous WASM too,
    // without terminating another file's conversion. Queued jobs copy no bytes.
    const job = this.tail.then(async () => {
      combined.throwIfAborted();
      return this.process(depthData, fileName, cameraParams, colorImageData, combined);
    });
    this.tail = job.catch(() => {});
    return job;
  }

  private async process(
    depthData: ArrayBuffer,
    fileName: string,
    cameraParams: CameraParams,
    colorImageData: ImageData | undefined,
    signal: AbortSignal
  ): Promise<DepthConversionResult> {
    const worker = this.getWorker();
    if (!worker) {
      return this.processOnMainThread(depthData, fileName, cameraParams, colorImageData, signal);
    }

    const id = this.nextRequestId++;
    const configKey = decodeConfigKey(cameraParams);
    let sourceId = this.sourceIds.get(depthData);
    if (sourceId === undefined) {
      sourceId = this.nextSourceId++;
      this.sourceIds.set(depthData, sourceId);
    }
    const cacheKey = `${sourceId}:${configKey}`;
    const shouldSendDepthData = !this.primedCacheKeys.has(cacheKey);
    const copiedDepthData = shouldSendDepthData ? depthData.slice(0) : undefined;

    let onAbort: () => void;
    return new Promise<DepthConversionResult>((resolve, reject) => {
      onAbort = () => {
        this.pending.delete(id);
        this.resetWorker();
        reject(signal.reason);
      };
      signal.addEventListener('abort', onAbort, { once: true });
      this.pending.set(id, {
        resolve: result => {
          this.primedCacheKeys.add(cacheKey);
          // Match the worker's four-entry insertion-order decoded cache.
          if (this.primedCacheKeys.size > 4) {
            this.primedCacheKeys.delete(this.primedCacheKeys.values().next().value!);
          }
          resolve(result);
        },
        reject,
      });
      try {
        worker.postMessage(
          {
            id,
            cacheKey,
            depthData: copiedDepthData,
            fileName,
            cameraParams: { ...cameraParams },
            colorImageData,
            tiffWasmGlueUrl: (globalThis as any).__TIFF_WASM_GLUE_URL__,
            tiffWasmUrl: (globalThis as any).__TIFF_WASM_URL__,
          },
          copiedDepthData ? [copiedDepthData] : []
        );
      } catch (error) {
        this.pending.delete(id);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    })
      .finally(() => signal.removeEventListener('abort', onAbort))
      .catch(async error => {
        signal.throwIfAborted();
        this.resetWorker();
        console.warn('[DepthWorker] failed, using main-thread fallback:', error);
        return this.processOnMainThread(depthData, fileName, cameraParams, colorImageData, signal);
      });
  }

  private getWorker(): Worker | null {
    if (this.worker !== undefined) {
      return this.worker;
    }

    try {
      this.worker = new Worker(new URL('./depthWorker.ts', import.meta.url), {
        name: 'depth-conversion-worker',
      });
      this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const response = event.data;
        const pending = this.pending.get(response.id);
        if (!pending) {
          return;
        }
        this.pending.delete(response.id);
        if (response.ok && response.result) {
          pending.resolve(response.result);
        } else {
          pending.reject(new Error(response.error || 'Depth worker failed'));
        }
      };
      this.worker.onerror = event => {
        const error = new Error(event.message || 'Depth worker error');
        for (const pending of this.pending.values()) {
          pending.reject(error);
        }
        this.pending.clear();
      };
    } catch (error) {
      console.warn('[DepthWorker] unavailable, using main-thread processing:', error);
      this.worker = null;
    }

    return this.worker;
  }

  private async processOnMainThread(
    depthData: ArrayBuffer,
    fileName: string,
    cameraParams: CameraParams,
    colorImageData: ImageData | undefined,
    signal: AbortSignal
  ): Promise<DepthConversionResult> {
    // Every camera model needs the kernel now, not only the distorted ones:
    // the JavaScript projection that used to cover pinhole and equidistant
    // fisheye is gone.
    if (!(await initTiffWasm())) {
      throw new Error(`${cameraParams.cameraModel} requires the Rust/WASM camera-model kernel`);
    }
    signal.throwIfAborted();
    const result = await this.fallbackConverter.processDepthToPointCloud(
      depthData,
      fileName,
      cameraParams,
      signal
    );
    signal.throwIfAborted();
    if (colorImageData) {
      applyColorToDepthResult(result, colorImageData, cameraParams);
    }
    return result;
  }
}
