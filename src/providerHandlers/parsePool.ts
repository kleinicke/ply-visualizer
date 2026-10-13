import { Worker } from 'node:worker_threads';
import { availableParallelism, cpus } from 'node:os';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { webWasmPath } from './pointcloudWebGlue';

/**
 * The extension host's pool of decoder threads (parseWorker.ts).
 *
 * Decoding a large file on one thread left the other cores idle while the
 * user waited; the parallel decoders split a file into independent ranges and
 * run one per worker. Workers are created on first use, kept briefly so adding
 * several files reuses them, then released: wasm memory never shrinks, so an
 * idle worker would otherwise keep its largest output's buffers for the life
 * of the extension host - on a machine already short of memory that is swap,
 * not cache.
 */

const IDLE_MS = 3_000;

/**
 * A worker whose wasm memory a job grew past this is ended once it is free
 * rather than kept for the next job. Large jobs come in phases - an X3A's
 * scan decodes, then its colour groups, then its station pass - and each
 * phase's workers otherwise held their memory through the next: on a
 * 42M-point archive the pool kept ~3 GB nobody used. A replacement starts
 * from the shared compiled module, so it costs a thread start.
 */
const RETIRE_WASM_BYTES = 256 * 1024 * 1024;

interface PoolWorker {
  worker: Worker;
  /** Jobs posted and not yet answered. */
  busy: number;
  /** Out of the pool; ended when its last job is answered. */
  retired: boolean;
}

let pool: PoolWorker[] = [];
let idleTimer: ReturnType<typeof setTimeout> | undefined;
/** Runs in flight; workers are only released once none are. */
let activeRuns = 0;
/** Matches each reply to its job: two loads can share one worker. */
let nextJobId = 0;

/** How many ranges to decode at once on this machine. */
export function defaultParallelism(): number {
  const cores = typeof availableParallelism === 'function' ? availableParallelism() : cpus().length;
  // Leave a core for the extension host and the webview it is feeding.
  return Math.max(1, Math.min(8, cores - 1));
}

/** Stop every idle worker now (tests; extension shutdown). */
export function releaseParseWorkers(): void {
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = undefined;
  }
  for (const entry of pool) {
    void entry.worker.terminate();
  }
  pool = [];
}

let compiledModule: WebAssembly.Module | null | undefined;

/**
 * The point-cloud crate, compiled once for the session and shared with every
 * worker. V8 tiers wasm up per compiled module: a worker that compiled its own
 * copy ran its one big decode entirely on baseline code - 765 ms against
 * 335 ms for an OBJ - and the optimized code died with the worker. With one
 * shared module, what any worker optimizes stays available to the next.
 * Null when the web build is missing; workers then load the crate themselves.
 */
export function sharedModule(): WebAssembly.Module | null {
  if (compiledModule === undefined) {
    try {
      const file = webWasmPath();
      compiledModule = file ? new WebAssembly.Module(readFileSync(file)) : null;
    } catch {
      compiledModule = null;
    }
  }
  return compiledModule;
}

function workers(count: number): PoolWorker[] {
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = undefined;
  }
  while (pool.length < count) {
    spawn();
  }
  return pool.slice(0, count);
}

function spawn(): PoolWorker {
  const worker = new Worker(join(__dirname, 'parseWorker.js'), {
    workerData: { wasmModule: sharedModule() },
  });
  // Never keep the extension host alive just for an idle decoder.
  worker.unref();
  const entry: PoolWorker = { worker, busy: 0, retired: false };
  const forget = () => {
    pool = pool.filter(candidate => candidate !== entry);
  };
  worker.on('error', forget);
  worker.on('exit', forget);
  pool.push(entry);
  return entry;
}

/** The entry itself while it serves, else a fresh worker in its place. */
function serving(entry: PoolWorker): PoolWorker {
  return entry.retired ? spawn() : entry;
}

function scheduleRelease(): void {
  if (idleTimer) {
    clearTimeout(idleTimer);
  }
  if (activeRuns > 0) {
    return;
  }
  idleTimer = setTimeout(releaseParseWorkers, IDLE_MS);
  idleTimer.unref?.();
}

function runJob<T>(
  entry: PoolWorker,
  message: unknown,
  transfer: ArrayBuffer[],
  onProgress?: (value: unknown) => void
): Promise<T> {
  const id = nextJobId++;
  entry.busy++;
  return new Promise<T>((resolve, reject) => {
    const onMessage = (value: {
      id: number;
      result?: T;
      error?: string;
      progress?: unknown;
      wasmBytes?: number;
    }) => {
      if (value.id !== id) {
        return;
      }
      if ('progress' in value) {
        onProgress?.(value.progress);
        return;
      }
      cleanup();
      if ((value.wasmBytes ?? 0) > RETIRE_WASM_BYTES && !entry.retired) {
        entry.retired = true;
        pool = pool.filter(candidate => candidate !== entry);
      }
      if (entry.retired && entry.busy === 0) {
        void entry.worker.terminate();
      }
      if (value.result !== undefined) {
        resolve(value.result);
      } else {
        reject(new Error(value.error ?? 'decoder worker failed'));
      }
    };
    const onExit = (code: number) => {
      cleanup();
      reject(new Error(`decoder worker exited (${code})`));
    };
    const cleanup = () => {
      entry.busy--;
      entry.worker.off('message', onMessage);
      entry.worker.off('exit', onExit);
    };
    entry.worker.on('message', onMessage);
    entry.worker.on('exit', onExit);
    entry.worker.postMessage({ id, job: message }, transfer);
  });
}

/**
 * Run jobs on up to `parallelism` workers - each taking the next job as it
 * finishes one - and return the results in job order (`onResult` sees each
 * as it finishes). Every job is settled
 * before this returns, success or not, so a failed job never leaves a worker
 * busy for the next load.
 */
export async function runParseJobs<T>(
  jobs: Array<{ message: unknown; transfer?: ArrayBuffer[] }>,
  parallelism = jobs.length,
  /** Called as each job finishes, in completion order. */
  onResult?: (index: number, result: T) => void
): Promise<T[]> {
  activeRuns++;
  try {
    const entries = workers(Math.max(1, Math.min(parallelism, jobs.length)));
    const results: T[] = new Array(jobs.length);
    let failure: unknown = null;
    let next = 0;
    await Promise.all(
      entries.map(async first => {
        let entry = first;
        // After a failure the run is lost; do not start what is left of it.
        while (next < jobs.length && !failure) {
          const index = next++;
          entry = serving(entry);
          try {
            results[index] = await runJob<T>(
              entry,
              jobs[index].message,
              jobs[index].transfer ?? []
            );
            if (!failure) {
              onResult?.(index, results[index]);
            }
          } catch (error) {
            failure ??= error;
          }
        }
      })
    );
    if (failure) {
      throw failure;
    }
    return results;
  } finally {
    activeRuns--;
    scheduleRelease();
  }
}

/**
 * Run one long job on a pool worker, hearing its progress reports as they
 * come. The worker's wasm memory is released with the pool, where this
 * thread's would stay at its peak.
 */
export async function runParseJob<T>(
  message: unknown,
  transfer: ArrayBuffer[],
  onProgress: (value: unknown) => void
): Promise<T> {
  activeRuns++;
  try {
    return await runJob<T>(workers(1)[0], message, transfer, onProgress);
  } finally {
    activeRuns--;
    scheduleRelease();
  }
}
