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

  constructor(private readonly fallbackConverter: DepthConverter) {}

  async processDepthToPointCloud(
    depthData: ArrayBuffer,
    fileName: string,
    cameraParams: CameraParams,
    colorImageData?: ImageData
  ): Promise<DepthConversionResult> {
    const worker = this.getWorker();
    if (!worker) {
      return this.processOnMainThread(depthData, fileName, cameraParams, colorImageData);
    }

    const id = this.nextRequestId++;
    const configKey = decodeConfigKey(cameraParams);
    const cacheKey = `${fileName}:${depthData.byteLength}:${configKey}`;
    const shouldSendDepthData = !this.primedCacheKeys.has(cacheKey);
    const copiedDepthData = shouldSendDepthData ? depthData.slice(0) : undefined;

    return new Promise<DepthConversionResult>((resolve, reject) => {
      this.pending.set(id, {
        resolve: result => {
          this.primedCacheKeys.add(cacheKey);
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
            geotiffUrl: (globalThis as any).__GEOTIFF_URL__,
            tiffWasmGlueUrl: (globalThis as any).__TIFF_WASM_GLUE_URL__,
            tiffWasmUrl: (globalThis as any).__TIFF_WASM_URL__,
          },
          copiedDepthData ? [copiedDepthData] : []
        );
      } catch (error) {
        this.pending.delete(id);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    }).catch(async error => {
      console.warn('[DepthWorker] failed, using main-thread fallback:', error);
      return this.processOnMainThread(depthData, fileName, cameraParams, colorImageData);
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
    colorImageData?: ImageData
  ): Promise<DepthConversionResult> {
    if (
      cameraParams.cameraModel !== 'pinhole-ideal' &&
      cameraParams.cameraModel !== 'fisheye-equidistant'
    ) {
      const ready = await initTiffWasm();
      if (!ready) {
        throw new Error(`${cameraParams.cameraModel} requires the Rust/WASM camera-model kernel`);
      }
    }
    const result = await this.fallbackConverter.processDepthToPointCloud(
      depthData,
      fileName,
      cameraParams
    );
    if (colorImageData) {
      applyColorToDepthResult(result, colorImageData, cameraParams);
    }
    return result;
  }
}
