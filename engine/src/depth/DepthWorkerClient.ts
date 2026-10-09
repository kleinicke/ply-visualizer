import { CameraParams, DepthBytes, DepthConversionResult } from '../interfaces';
import { DepthConverter } from './DepthConverter';
import { applyColorToDepthResult } from './applyColorToDepthResult';
import { initTiffWasm, tiffWasmModule } from './readers/tiffWasm';
import { spawnWorker, WorkerScript } from '../utils/webviewWorker';
import { bandWorkerScript } from './depthProjectionPool';

interface PendingRequest {
  resolve: (result: DepthConversionResult) => void;
  reject: (error: Error) => void;
}

interface WorkerResponse {
  id: number;
  ok: boolean;
  /** Decoded images the worker dropped; their sources must be sent again. */
  evicted?: string[];
  result?: DepthConversionResult;
  error?: string;
}

/**
 * The settings that change the decoded image, and nothing else: anything more
 * and a parameter change that only touches the projection decodes the file
 * again. Only PNG reads its scale factor (the depth panel sends one for every
 * file, the first load does not), and only PNG and TIFF read the RGB24 ones.
 */
function decodeConfigKey(fileName: string, cameraParams: CameraParams): string {
  const isPng = /\.png$/i.test(fileName);
  if (!isPng && !/\.tiff?$/i.test(fileName)) {
    return '';
  }
  // Defaulted exactly as DepthConverter.decodeDepthImage defaults them.
  return JSON.stringify({
    pngScaleFactor: isPng ? cameraParams.pngScaleFactor || 1000 : null,
    rgb24ConversionMode: cameraParams.rgb24ConversionMode || 'shift',
    rgb24ScaleFactor: cameraParams.rgb24ScaleFactor || 1000,
    rgb24InvalidValue: cameraParams.rgb24InvalidValue ?? null,
  });
}

export class DepthWorkerClient {
  private worker: Promise<Worker | null> | undefined;
  private nextRequestId = 1;
  private pending = new Map<number, PendingRequest>();
  /** Workers that reported an error; nothing is posted to them again. */
  private brokenWorkers = new WeakSet<Worker>();
  private primedCacheKeys = new Set<string>();
  private sourceIds = new WeakMap<ArrayBuffer | DepthBytes, number>();
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
    void this.worker?.then(worker => worker?.terminate());
    this.worker = undefined;
    this.primedCacheKeys.clear();
  }

  constructor(private readonly fallbackConverter: DepthConverter) {}

  async processDepthToPointCloud(
    depthData: ArrayBuffer | DepthBytes,
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
    depthData: ArrayBuffer | DepthBytes,
    fileName: string,
    cameraParams: CameraParams,
    colorImageData: ImageData | undefined,
    signal: AbortSignal
  ): Promise<DepthConversionResult> {
    // NumPy files are read with the point-cloud crate, which a blob worker
    // cannot fetch for itself either (see registration/wasmLoader.browser.ts).
    const needsPointcloudWasm = /\.np[yz]$/i.test(fileName);
    const pointcloudModule = needsPointcloudWasm
      ? (
          globalThis as { __plyPointcloudWasmModule?: () => Promise<WebAssembly.Module | null> }
        ).__plyPointcloudWasmModule?.()
      : undefined;
    const [worker, tiffWasm, pointcloudWasm] = await Promise.all([
      this.getWorker(),
      tiffWasmModule(),
      pointcloudModule ?? null,
    ]);
    signal.throwIfAborted();
    // A worker that failed while it was starting (its script did not load or
    // did not parse) is dead: a request posted to it would never be answered.
    if (!worker || this.brokenWorkers.has(worker)) {
      return this.processOnMainThread(depthData, fileName, cameraParams, colorImageData, signal);
    }

    const id = this.nextRequestId++;
    const configKey = decodeConfigKey(fileName, cameraParams);
    let sourceId = this.sourceIds.get(depthData);
    if (sourceId === undefined) {
      sourceId = this.nextSourceId++;
      this.sourceIds.set(depthData, sourceId);
    }
    const cacheKey = `${sourceId}:${configKey}`;
    const shouldSendDepthData = !this.primedCacheKeys.has(cacheKey);
    // A held buffer is copied, since its owner keeps it; a loaded one is ours
    // to transfer. Either way, nothing is read when the worker has the image.
    const copiedDepthData = !shouldSendDepthData
      ? undefined
      : depthData instanceof ArrayBuffer
        ? depthData.slice(0)
        : await depthData.load();
    signal.throwIfAborted();

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
            tiffWasmModule: tiffWasm ?? undefined,
            pointcloudWasmModule: pointcloudWasm ?? undefined,
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

  private getWorker(): Promise<Worker | null> {
    this.worker ??= this.startWorker();
    return this.worker;
  }

  private async startWorker(): Promise<Worker | null> {
    try {
      const glueUrl = (globalThis as any).__TIFF_WASM_GLUE_URL__ as string | undefined;
      // @ts-ignore -- the extension-host tsconfig type-checks shared depth files
      // as CommonJS, while this expression is emitted only by the web bundle.
      const worker = await spawnWorker(
        new WorkerScript(new URL('./depthWorker.ts', import.meta.url)),
        {
          name: 'depth-conversion-worker',
          scripts: glueUrl ? [new URL(glueUrl, location.href).href] : [],
          nested: [bandWorkerScript()],
        }
      );
      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const response = event.data;
        const pending = this.pending.get(response.id);
        if (!pending) {
          return;
        }
        this.pending.delete(response.id);
        for (const key of response.evicted ?? []) {
          this.primedCacheKeys.delete(key);
        }
        if (response.ok && response.result) {
          pending.resolve(response.result);
        } else {
          pending.reject(new Error(response.error || 'Depth worker failed'));
        }
      };
      worker.onerror = event => {
        this.brokenWorkers.add(worker);
        const error = new Error(event.message || 'Depth worker error');
        for (const pending of this.pending.values()) {
          pending.reject(error);
        }
        this.pending.clear();
      };
      return worker;
    } catch (error) {
      console.warn('[DepthWorker] unavailable, using main-thread processing:', error);
      return null;
    }
  }

  private async processOnMainThread(
    depthData: ArrayBuffer | DepthBytes,
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
    const bytes = depthData instanceof ArrayBuffer ? depthData : await depthData.load();
    signal.throwIfAborted();
    const result = await this.fallbackConverter.processDepthToPointCloud(
      bytes,
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
