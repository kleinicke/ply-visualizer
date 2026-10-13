import { CameraParams, DepthBytes, DepthConversionResult } from '../interfaces';
import { DecodedDepthImage, DepthConverter } from './DepthConverter';
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
 * How long the worker may sit idle before it is parked. Its wasm memory only
 * grows - to the file plus its decoded image, ~390 MB beyond the decoded
 * image itself for a 26-megapixel float TIFF - and nothing gives it back
 * short of ending the worker. Parking hands the decoded images to the page
 * first, so a later parameter change still skips the decode.
 */
const IDLE_PARK_MS = 15_000;
/** The worker's own decoded-cache bounds, applied to what it parks. */
const MAX_PARKED_ENTRIES = 4;
const MAX_PARKED_BYTES = 192 * 1024 * 1024;

interface ParkedResponse {
  parked: { cacheKey: string; decoded: DecodedDepthImage }[];
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
  /** Decoded images a parked worker handed back, oldest first. */
  private parked = new Map<string, DecodedDepthImage>();
  /** Requests accepted and not yet settled, queued ones included. */
  private active = 0;
  private idleTimer: ReturnType<typeof setTimeout> | undefined;
  private parking: Promise<void> | null = null;

  dispose(): void {
    if (this.lifetime.signal.aborted) {
      return;
    }
    this.lifetime.abort();
    clearTimeout(this.idleTimer);
    this.parked.clear();
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
    this.active++;
    clearTimeout(this.idleTimer);
    // A single active request lets cancellation stop synchronous WASM too,
    // without terminating another file's conversion. Queued jobs copy no bytes.
    const job = this.tail.then(async () => {
      combined.throwIfAborted();
      return this.process(depthData, fileName, cameraParams, colorImageData, combined);
    });
    this.tail = job.catch(() => {});
    void job
      .catch(() => {})
      .finally(() => {
        this.active--;
        this.scheduleParking();
      });
    return job;
  }

  private scheduleParking(): void {
    clearTimeout(this.idleTimer);
    if (this.active > 0 || !this.worker || this.lifetime.signal.aborted) {
      return;
    }
    this.idleTimer = setTimeout(() => {
      this.parking = this.park().finally(() => (this.parking = null));
    }, IDLE_PARK_MS);
  }

  /** Take the worker's decoded images, then end it to free its wasm memory. */
  private async park(): Promise<void> {
    const worker = await this.worker;
    if (this.active > 0 || !worker || this.brokenWorkers.has(worker)) {
      return;
    }
    const reply = await new Promise<ParkedResponse | null>(resolve => {
      const timer = setTimeout(() => finish(null), 5_000);
      const finish = (value: ParkedResponse | null) => {
        clearTimeout(timer);
        worker.removeEventListener('message', listener);
        resolve(value);
      };
      const listener = (event: MessageEvent) => {
        if (event.data && 'parked' in event.data) {
          finish(event.data as ParkedResponse);
        }
      };
      worker.addEventListener('message', listener);
      worker.postMessage({ park: true });
    });
    // A viewer disposed meanwhile keeps nothing.
    if (reply && !this.lifetime.signal.aborted) {
      for (const { cacheKey, decoded } of reply.parked) {
        this.parked.delete(cacheKey);
        this.parked.set(cacheKey, decoded);
      }
      this.trimParked();
    }
    this.resetWorker();
  }

  private trimParked(): void {
    let bytes = 0;
    for (const decoded of this.parked.values()) {
      bytes += decoded.image.data.byteLength;
    }
    for (const [key, decoded] of this.parked) {
      if (this.parked.size <= 1) {
        break;
      }
      if (this.parked.size <= MAX_PARKED_ENTRIES && bytes <= MAX_PARKED_BYTES) {
        break;
      }
      this.parked.delete(key);
      bytes -= decoded.image.data.byteLength;
    }
  }

  private async process(
    depthData: ArrayBuffer | DepthBytes,
    fileName: string,
    cameraParams: CameraParams,
    colorImageData: ImageData | undefined,
    signal: AbortSignal
  ): Promise<DepthConversionResult> {
    await this.parking;
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
    // An image the worker parked goes back instead of the source: no decode.
    const parkedImage = this.primedCacheKeys.has(cacheKey) ? undefined : this.parked.get(cacheKey);
    this.parked.delete(cacheKey);
    // Moved back unless another parked image still shares its buffer; that
    // one would be left detached, so this one is copied instead.
    const transferParked =
      parkedImage &&
      ![...this.parked.values()].some(
        other => other.image.data.buffer === parkedImage.image.data.buffer
      );
    const shouldSendDepthData = !this.primedCacheKeys.has(cacheKey) && !parkedImage;
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
            decoded: parkedImage,
            fileName,
            cameraParams: { ...cameraParams },
            colorImageData,
            tiffWasmGlueUrl: (globalThis as any).__TIFF_WASM_GLUE_URL__,
            tiffWasmUrl: (globalThis as any).__TIFF_WASM_URL__,
            tiffWasmModule: tiffWasm ?? undefined,
            pointcloudWasmModule: pointcloudWasm ?? undefined,
          },
          [
            ...(copiedDepthData ? [copiedDepthData] : []),
            ...(transferParked ? [parkedImage.image.data.buffer] : []),
          ]
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
