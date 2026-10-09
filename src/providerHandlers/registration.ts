import { sendToWebview } from './webviewTransport';
import type * as vscode from 'vscode';
import { Worker } from 'node:worker_threads';
import { join } from 'node:path';
import { defaultParallelism, sharedModule } from './parsePool';
import type { RegistrationKind } from '../../engine/src/registration/registrationWorker';

interface RegistrationMessage {
  id?: unknown;
  kind?: unknown;
  source?: unknown;
  target?: unknown;
  settingsJson?: unknown;
}

const KINDS = new Set<RegistrationKind>(['register', 'coarse', 'icp', 'fit']);
const MAX_COORDINATES = 6_000_000;

function coordinates(value: unknown, name: string): Float32Array {
  if (!(value instanceof Float32Array)) {
    throw new Error(`${name} point data did not arrive as Float32Array.`);
  }
  if (value.length < 9 || value.length % 3 !== 0) {
    throw new Error(`${name} needs at least three complete xyz points.`);
  }
  if (value.length > MAX_COORDINATES) {
    throw new Error(`${name} exceeds the registration safety limit.`);
  }
  return value;
}

interface Job {
  id: string;
  request: { kind: string; source: Float32Array; target: Float32Array; settingsJson: string };
  resolve(value: any): void;
  reject(error: Error): void;
}

interface HostWorker {
  worker: Worker;
  active?: Job;
}

/**
 * Each panel owns a few reusable, cancellable solver workers and a queue.
 *
 * Align-all registers every cloud against the reference independently, so the
 * pairs can run side by side; with one worker five pairs of an archive took
 * five times one pair. Cancelling terminates only the worker running that
 * request (synchronous WASM cannot be interrupted any other way).
 */
interface PanelPool {
  workers: HostWorker[];
  queue: Job[];
  idleTimer?: ReturnType<typeof setTimeout>;
}

/**
 * Idle solver workers are released after this long. Wasm memory never shrinks,
 * so a worker keeps its largest solve's buffers for as long as it lives; six of
 * them idling beside an open panel is memory the rest of the machine needs.
 */
const IDLE_RELEASE_MS = 10_000;
const pools = new WeakMap<vscode.WebviewPanel, PanelPool>();

/** Solver workers per panel: pairs are a few hundred ms to seconds each. */
export function registrationParallelism(): number {
  return Math.min(6, defaultParallelism());
}

function poolFor(panel: vscode.WebviewPanel): PanelPool {
  let pool = pools.get(panel);
  if (!pool) {
    pool = { workers: [], queue: [] };
    pools.set(panel, pool);
  }
  return pool;
}

function abortError(): Error {
  const error = new Error('Alignment cancelled.');
  error.name = 'AbortError';
  return error;
}

/**
 * Termination interrupts synchronous WASM without blocking the extension host.
 * Without an `id` everything stops and every worker goes (the panel closed).
 */
export function cancelRegistrationRequest(panel: vscode.WebviewPanel, id?: string): void {
  const pool = pools.get(panel);
  if (!pool) {
    return;
  }
  if (id === undefined) {
    pools.delete(panel);
    clearTimeout(pool.idleTimer);
    for (const job of pool.queue.splice(0)) {
      job.reject(abortError());
    }
    for (const state of pool.workers.splice(0)) {
      state.active?.reject(abortError());
      state.active = undefined;
      void state.worker.terminate();
    }
    return;
  }
  for (const job of pool.queue.filter(job => job.id === id)) {
    pool.queue.splice(pool.queue.indexOf(job), 1);
    job.reject(abortError());
  }
  for (const state of pool.workers.filter(state => state.active?.id === id)) {
    pool.workers.splice(pool.workers.indexOf(state), 1);
    state.active!.reject(abortError());
    state.active = undefined;
    void state.worker.terminate();
  }
  // The terminated worker may have been the only one; queued jobs still need
  // somewhere to run.
  pump(pool);
}

function startWorker(pool: PanelPool): HostWorker {
  const worker = new Worker(join(__dirname, 'registrationWorker.js'), {
    workerData: { wasmModule: sharedModule() },
  });
  const state: HostWorker = { worker };
  pool.workers.push(state);
  const forget = () => {
    const index = pool.workers.indexOf(state);
    if (index >= 0) {
      pool.workers.splice(index, 1);
    }
  };
  worker.on('message', value => {
    const active = state.active;
    state.active = undefined;
    worker.unref();
    if (value?.error) {
      active?.reject(new Error(value.error));
    } else {
      active?.resolve(value);
    }
    pump(pool);
  });
  const failed = (error: Error) => {
    forget();
    state.active?.reject(error);
    state.active = undefined;
    void worker.terminate();
    pump(pool);
  };
  worker.on('error', failed);
  worker.on('exit', code => {
    forget();
    if (state.active) {
      failed(new Error(`Registration worker exited (${code}).`));
    }
  });
  worker.unref();
  return state;
}

/** Start queued jobs on idle workers, adding workers up to the limit. */
function pump(pool: PanelPool): void {
  clearTimeout(pool.idleTimer);
  pool.idleTimer = undefined;
  while (pool.queue.length > 0) {
    let state = pool.workers.find(candidate => !candidate.active);
    if (!state) {
      if (pool.workers.length >= registrationParallelism()) {
        return;
      }
      state = startWorker(pool);
    }
    const job = pool.queue.shift()!;
    state.active = job;
    state.worker.ref();
    // Do not detach webview transport buffers that another consumer may retain.
    state.worker.postMessage(job.request);
  }
  if (pool.queue.length === 0 && pool.workers.every(state => !state.active)) {
    pool.idleTimer = setTimeout(() => {
      for (const state of pool.workers.splice(0)) {
        void state.worker.terminate();
      }
    }, IDLE_RELEASE_MS);
    pool.idleTimer.unref?.();
  }
}

export async function handleRegistrationRequest(
  webviewPanel: vscode.WebviewPanel,
  message: RegistrationMessage
): Promise<void> {
  const id = typeof message.id === 'string' ? message.id : '';
  try {
    if (!id) {
      throw new Error('Registration request has no ID.');
    }
    if (typeof message.kind !== 'string' || !KINDS.has(message.kind as RegistrationKind)) {
      throw new Error('Registration request has an unknown operation.');
    }
    const source = coordinates(message.source, 'Source');
    const target = coordinates(message.target, 'Target');
    const settingsJson = typeof message.settingsJson === 'string' ? message.settingsJson : '{}';
    const pool = poolFor(webviewPanel);
    if (
      pool.queue.some(job => job.id === id) ||
      pool.workers.some(state => state.active?.id === id)
    ) {
      throw new Error('This alignment request is already running.');
    }
    const result = await new Promise<{ matrix: Float64Array; stats: string } | null>(
      (resolve, reject) => {
        pool.queue.push({
          id,
          request: { kind: message.kind as string, source, target, settingsJson },
          resolve,
          reject,
        });
        pump(pool);
      }
    );
    await sendToWebview(webviewPanel, {
      type: 'registrationResult',
      id,
      matrix: result?.matrix ?? null,
      stats: result?.stats ?? null,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return;
    }
    await sendToWebview(webviewPanel, {
      type: 'registrationResult',
      id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
