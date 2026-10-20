/**
 * Scan-to-scan registration: align one loaded cloud onto another.
 *
 * Written for the case X3A archives create — several stations of the same site,
 * each expressed relative to its own capture position, with no pose anywhere in
 * the container to recover the relationship from (see docs/BACKLOG.md). It is
 * not specific to X3A though; the inputs are plain world-space coordinates, so
 * any two overlapping clouds work.
 *
 * Three stages, deliberately separable because they fail differently:
 *
 * - `fitCorrespondences` — manual pairs. Always works, needs a human.
 * - `coarseAlign` — automatic, exploits that terrestrial scans are level.
 * - `icpRefine` — refinement; needs a start already close to right.
 *
 * `registerPair` runs coarse-then-ICP, which is the normal path.
 *
 * **All of this is Rust.** The solvers live in
 * `wasm/pointcloud-parser/src/registration/` and are tested there with
 * `cargo test`; this module is the marshalling layer and nothing else. In a
 * browser the work runs in `registrationWorker.ts`, so a sweep never blocks the
 * render thread; the extension host uses a Node worker thread so it can
 * receive cancellation while the same synchronous WASM kernel is running.
 */

import * as THREE from 'three';
// Browser builds replace this exact request with wasmLoader.browser.ts. Keeping
// a real relative Node target is important: webpack may legally leave an
// unresolved package-import (`#...`) as a runtime missing-module stub, which
// makes the extension fail during activation rather than during registration.
import { loadRegistrationWasm } from './wasmLoader';
import type { RegistrationKind, RegistrationRequest } from './registrationWorker';

export type UpAxis = 'x' | 'y' | 'z';
export type RasterFeature = 'verticality' | 'density';

export interface CoarseAlignOptions {
  /** Vertical axis of the scene. Terrestrial scans are leveled about it. */
  upAxis?: UpAxis;
  /** Raster resolution per side; must be a power of two. */
  resolution?: number;
  /** Yaw step of the initial full-circle sweep, in degrees. */
  yawStepDegrees?: number;
  /** Limits rasterization cost on huge clouds by striding the input. */
  maxSamples?: number;
  /** Raster cell value; see the Rust `rasterize`. */
  feature?: RasterFeature;
  /** How many separated yaw peaks to report as candidates. */
  candidateCount?: number;
}

export interface IcpOptions {
  /** Column-major starting pose; identity when omitted. */
  initial?: THREE.Matrix4;
  /** Finest downsample cell; derived from the clouds' robust extent if unset. */
  voxelSize?: number;
  /** Coarse-to-fine multipliers applied to the voxel size, largest first. */
  scales?: number[];
  gateFactor?: number;
  trimRatio?: number;
  maxIterationsPerScale?: number;
  translationEpsilon?: number;
  rotationEpsilon?: number;
  maxSourcePoints?: number;
  maxTargetPoints?: number;
}

export interface CoarseCandidate {
  yawDegrees: number;
  score: number;
  matrix: THREE.Matrix4;
}

export interface CoarseStats {
  yawDegrees: number;
  /**
   * Normalized phase-correlation peak. A confidence, and only meaningful next
   * to `runnerUpScore`: what matters is how far the winner stands above the
   * rest, not its absolute height.
   */
  score: number;
  runnerUpScore: number;
  candidates: CoarseCandidate[];
}

export interface IcpStats {
  iterations: number;
  inlierCount: number;
  /** RMS of the point-to-plane residual over the inliers, in scene units. */
  inlierRmse: number;
  /** Inliers as a fraction of the downsampled source — the overlap estimate. */
  fitness: number;
  converged: boolean;
}

export interface RegistrationResult {
  /** Maps source into target. */
  matrix: THREE.Matrix4;
  coarse: CoarseStats | null;
  icp: IcpStats | null;
  /** Which coarse candidate won, or -1 when the coarse stage was skipped. */
  candidateIndex: number;
  candidatesTried: number;
  /** Set by `fitCorrespondences` only. */
  rmse: number | null;
  maxError: number | null;
  /**
   * Which family of starting pose produced the winner: 'coarse' for the yaw
   * sweep, 'given' for one of `extraStarts`, 'none' when ICP ran alone.
   */
  startedFrom: 'coarse' | 'given' | 'none';
  /**
   * How well the source cloud's own surfaces pin its position down, in
   * `[0, 1/3]`; see the Rust `position_conditioning`.
   *
   * Point-to-plane registration only feels motion across a surface, so a scan
   * of one flat wall is free to slide within it — and sliding keeps its points
   * on the wall, so its overlap can *rise* as it goes wrong. Neither `fitness`
   * nor `inlierRmse` can see that. This can, and it is a property of the cloud
   * rather than of the fit, so it is trustworthy before the fit is.
   */
  sourceConditioning: number;
  /**
   * Finest voxel cell the ICP stage used, in scene units.
   *
   * Needed to compare two results: an RMS of 3 mm means something different at
   * a 2 mm cell than at a 20 mm one, so ranking candidates on raw RMS compares
   * numbers that were not measured the same way.
   */
  voxelCell: number;
}

export interface RegisterPairOptions {
  coarse?: CoarseAlignOptions | false;
  icp?: IcpOptions | false;
  /**
   * How many of the coarse stage's yaw candidates to refine. Each costs one
   * ICP run. 1 trusts the top peak; the default tries the shortlist, which is
   * what makes the automatic path work on real scans where the correct yaw is
   * often not the tallest correlation peak.
   */
  maxCandidates?: number;
  /**
   * Poses to screen alongside the sweep's candidates, as world-space deltas.
   *
   * The yaw sweep searches from nothing, and on a narrow window onto a flat
   * wall it correlates about as well at the wrong yaw as the right one. A
   * caller with a better guess should say so: screening one costs a pass over
   * a pyramid the solver has already built, and the same quality score decides
   * whether it beats the sweep.
   */
  extraStarts?: THREE.Matrix4[];
}

let worker: Worker | null = null;
let workerUnavailable = false;
let nextRequestId = 1;
const pending = new Map<
  number,
  { resolve: (value: RegistrationResult | null) => void; reject: (error: Error) => void }
>();

let workerReady: Promise<Worker | null> | null = null;
/** A worker has answered; `registrationBackend` keeps saying so after release. */
let workerUsed = false;
let idleTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * How long the worker outlives its last request. Its wasm memory holds copies
 * of the clouds it last aligned plus the solver's search structures, and wasm
 * memory never shrinks, so a worker kept for the life of the viewer keeps that
 * peak for good. Align-all sends its pairs back to back, well inside this.
 */
const WORKER_IDLE_MS = 30_000;

function releaseWorkerWhenIdle(): void {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    idleTimer = undefined;
    if (pending.size === 0 && worker) {
      worker.terminate();
      worker = null;
      workerReady = null;
    }
  }, WORKER_IDLE_MS);
}

type ExtensionPostMessage = (
  message:
    | {
        type: 'registrationRequest';
        id: string;
        kind: RegistrationKind;
        source: Float32Array;
        target: Float32Array;
        settingsJson: string;
      }
    | { type: 'registrationCancel'; id: string }
) => void;

let extensionPostMessage: ExtensionPostMessage | null = null;
let nextExtensionRequestId = 1;
const extensionPending = new Map<
  string,
  { resolve: (value: RegistrationResult | null) => void; reject: (error: Error) => void }
>();

/**
 * Routes registration through the VS Code extension host.
 *
 * A webview cannot construct the same-origin worker used by the standalone
 * viewer. Running several seconds of ICP inline made the button look broken
 * because rendering and status updates froze until it returned. The extension
 * host delegates to a Node worker thread, which can be terminated on cancel.
 */
export function configureRegistrationExtensionHost(postMessage: ExtensionPostMessage | null): void {
  extensionPostMessage = postMessage;
}

/** Resolves a request previously sent by `configureRegistrationExtensionHost`. */
export function handleRegistrationExtensionResult(message: {
  id?: unknown;
  matrix?: Float64Array | number[] | null;
  stats?: string | null;
  error?: string;
}): boolean {
  if (typeof message.id !== 'string') {
    return false;
  }
  const request = extensionPending.get(message.id);
  if (!request) {
    return false;
  }
  extensionPending.delete(message.id);
  if (message.error) {
    request.reject(new Error(message.error));
  } else {
    const matrix = message.matrix ? Float64Array.from(message.matrix) : null;
    request.resolve(decode(matrix, message.stats ?? null));
  }
  return true;
}

/**
 * Resolves to a worker that has already loaded its wasm, or null when this
 * environment cannot run one.
 *
 * The readiness handshake is what makes the *first* attempt work everywhere. A
 * failing worker only reports through `onerror`, asynchronously, so without
 * waiting for it we would transfer the point buffers into a worker that never
 * answers — and the buffers, being transferred, are gone by the time we learn
 * that, leaving nothing to retry with in-page.
 */
async function ensureWorker(signal?: AbortSignal): Promise<Worker | null> {
  // `document` rather than `Worker` alone: this module is also loaded by the
  // extension host and by Node, and the dynamic import below must not be
  // evaluated there (see workerHost.ts).
  if (workerUnavailable || typeof Worker === 'undefined' || typeof document === 'undefined') {
    return null;
  }
  clearTimeout(idleTimer);
  idleTimer = undefined;
  if (workerReady) {
    return workerReady;
  }
  workerReady = startWorker(signal).catch(error => {
    workerReady = null;
    throw error;
  });
  return workerReady;
}

async function startWorker(signal?: AbortSignal): Promise<Worker | null> {
  try {
    const { createRegistrationWorker } = await import('./workerHost');
    signal?.throwIfAborted();
    worker = await createRegistrationWorker();
    if (signal?.aborted) {
      worker.terminate();
      worker = null;
      signal.throwIfAborted();
    }
  } catch (error) {
    signal?.throwIfAborted();
    console.warn('[registration] worker unavailable, running in page:', error);
    workerUnavailable = true;
    return null;
  }

  if (!worker) {
    return null;
  }
  const starting = worker;
  const handshake = await new Promise<boolean>(resolve => {
    const settle = (value: boolean) => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', aborted);
      resolve(value);
    };
    const aborted = () => {
      starting.terminate();
      settle(false);
    };
    const timer = setTimeout(() => settle(false), 10_000);
    signal?.addEventListener('abort', aborted, { once: true });
    starting.addEventListener('message', function onReady(event: MessageEvent) {
      if (typeof event.data?.ready !== 'boolean') {
        return;
      }
      starting.removeEventListener('message', onReady as EventListener);
      settle(event.data.ready === true);
    });
    starting.addEventListener('error', () => settle(false), { once: true });
  });

  if (signal?.aborted) {
    starting.terminate();
    worker = null;
    workerReady = null;
    signal.throwIfAborted();
  }
  if (!handshake) {
    console.warn('[registration] worker did not start, running in page instead');
    worker?.terminate();
    worker = null;
    workerUnavailable = true;
    return null;
  }

  starting.onmessage = event => {
    const request = pending.get(event.data.id);
    if (!request) {
      return;
    }
    if (typeof event.data?.ready === 'boolean') {
      return;
    }
    pending.delete(event.data.id);
    if (event.data.error) {
      request.reject(new Error(event.data.error));
      return;
    }
    request.resolve(decode(event.data.matrix, event.data.stats));
  };
  starting.onerror = event => {
    if (worker !== starting) {
      return;
    }
    const error = new Error(event.message || 'Registration worker failed');
    for (const request of pending.values()) {
      request.reject(error);
    }
    pending.clear();
    worker?.terminate();
    worker = null;
    // Fall back to running inline rather than leaving the feature broken.
    workerUnavailable = true;
  };
  return worker;
}

function decode(matrix: Float64Array | null, stats: string | null): RegistrationResult | null {
  if (!matrix || matrix.length !== 16) {
    return null;
  }
  const parsed = stats ? (JSON.parse(stats) as Record<string, any>) : {};
  return {
    // Rust emits column-major, matching THREE.Matrix4.elements, so this is a
    // copy and not a transpose.
    matrix: new THREE.Matrix4().fromArray(Array.from(matrix)),
    coarse: parsed.coarse
      ? {
          yawDegrees: parsed.coarse.yawDegrees,
          score: parsed.coarse.score,
          runnerUpScore: parsed.coarse.runnerUpScore,
          candidates: (parsed.coarse.candidates ?? []).map((candidate: any) => ({
            yawDegrees: candidate.yawDegrees,
            score: candidate.score,
            matrix: new THREE.Matrix4().fromArray(candidate.matrix),
          })),
        }
      : null,
    icp: parsed.icp ?? null,
    candidateIndex: parsed.candidateIndex ?? -1,
    candidatesTried: parsed.candidatesTried ?? 0,
    rmse: parsed.rmse ?? null,
    maxError: parsed.maxError ?? null,
    startedFrom: parsed.startedFrom ?? 'none',
    sourceConditioning: parsed.sourceConditioning ?? 1,
    voxelCell: parsed.voxelCell ?? 0,
  };
}

type PendingResult = {
  resolve(value: RegistrationResult | null): void;
  reject(error: Error): void;
};

function pendingResult<K>(
  requests: Map<K, PendingResult>,
  id: K,
  signal: AbortSignal | undefined,
  send: () => void,
  cancel: () => void
): Promise<RegistrationResult | null> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      requests.delete(id);
      signal?.removeEventListener('abort', abort);
    };
    const abort = () => {
      cleanup();
      cancel();
      reject(signal!.reason);
    };
    requests.set(id, {
      resolve: value => {
        cleanup();
        resolve(value);
      },
      reject: error => {
        cleanup();
        reject(error);
      },
    });
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) {
      abort();
      return;
    }
    try {
      send();
    } catch (error) {
      cleanup();
      reject(error);
    }
  });
}

// A terminated browser worker belongs only to its active request. Queued callers
// keep their buffers and start on a fresh worker after cancellation.
let dispatchTail: Promise<unknown> = Promise.resolve();
function dispatch(
  kind: RegistrationKind,
  source: Float32Array,
  target: Float32Array,
  settings: unknown,
  signal?: AbortSignal
): Promise<RegistrationResult | null> {
  // The extension host queues requests itself and runs several at once on
  // its own workers, each cancellable alone; only the in-page worker needs
  // its callers lined up.
  if (extensionPostMessage) {
    return dispatchNow(kind, source, target, settings, signal);
  }
  const result = dispatchTail.then(() => dispatchNow(kind, source, target, settings, signal));
  dispatchTail = result.catch(() => {});
  if (!signal) {
    return result;
  }
  // A queued cancellation must settle immediately without interrupting the
  // unrelated request currently using the shared worker.
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener('abort', abort, { once: true });
    void result.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
    if (signal.aborted) {
      abort();
    }
  });
}

async function dispatchNow(
  kind: RegistrationKind,
  source: Float32Array,
  target: Float32Array,
  settings: unknown,
  signal?: AbortSignal
): Promise<RegistrationResult | null> {
  signal?.throwIfAborted();
  const settingsJson = JSON.stringify(settings ?? {});
  if (extensionPostMessage) {
    const postMessage = extensionPostMessage;
    const id = `registration-${nextExtensionRequestId++}`;
    return pendingResult(
      extensionPending,
      id,
      signal,
      () => {
        postMessage({
          type: 'registrationRequest',
          id,
          kind,
          source,
          target,
          settingsJson,
        });
      },
      () => postMessage({ type: 'registrationCancel', id })
    );
  }
  const host = await ensureWorker(signal);
  signal?.throwIfAborted();
  if (!host) {
    const wasm = await loadRegistrationWasm();
    signal?.throwIfAborted();
    if (!wasm) {
      throw new Error('Registration is unavailable: the WebAssembly module failed to load.');
    }
    // The in-page fallback cannot process UI cancellation mid-kernel; worker
    // paths above/below are interruptible by terminating their execution host.
    const result =
      kind === 'register'
        ? wasm.register_pair(source, target, settingsJson)
        : kind === 'coarse'
          ? wasm.coarse_align(source, target, settingsJson)
          : kind === 'icp'
            ? wasm.icp_refine(source, target, settingsJson)
            : wasm.fit_correspondences(source, target);
    if (!result) {
      return null;
    }
    try {
      return decode(result.matrix, result.stats);
    } finally {
      result.free?.();
    }
  }

  const id = nextRequestId++;
  const request: RegistrationRequest = { id, kind, source, target, settingsJson };
  workerUsed = true;
  return pendingResult(
    pending,
    id,
    signal,
    () => {
      // The point buffers are copies made for this call, so transferring them
      // costs nothing and saves duplicating tens of megabytes per request.
      host.postMessage(request, [source.buffer, target.buffer]);
    },
    () => {
      host.terminate();
      worker = null;
      workerReady = null;
    }
  ).finally(() => {
    if (pending.size === 0) {
      releaseWorkerWhenIdle();
    }
  });
}

function icpSettings(options: IcpOptions): Record<string, unknown> {
  const { initial, ...rest } = options;
  return initial ? { ...rest, initial: Array.from(initial.elements) } : rest;
}

/** Coarse sweep then ICP refinement — the normal automatic path. */
/**
 * Which execution path the last call used, for the panel to report.
 *
 * Worth surfacing: "worker" and "in page" behave differently — the second
 * blocks the viewer while it runs — and when registration breaks, knowing which
 * one was in play is the difference between a diagnosis and a guess.
 */
export function registrationBackend(): 'extension host' | 'worker' | 'in page' | 'not started' {
  if (extensionPostMessage) {
    return 'extension host';
  }
  if (worker) {
    return 'worker';
  }
  if (workerUnavailable) {
    return 'in page';
  }
  return workerUsed ? 'worker' : 'not started';
}

/**
 * How many pairs are worth solving at once: the extension host runs them on a
 * small pool of workers; the browser has one worker (or none).
 */
export function registrationConcurrency(): number {
  return extensionPostMessage ? 6 : 1;
}

export function registerPair(
  source: Float32Array,
  target: Float32Array,
  options: RegisterPairOptions = {},
  signal?: AbortSignal
): Promise<RegistrationResult | null> {
  return dispatch(
    'register',
    source,
    target,
    {
      coarse: options.coarse === false ? undefined : (options.coarse ?? {}),
      icp: options.icp === false ? undefined : icpSettings(options.icp ?? {}),
      maxCandidates: options.maxCandidates,
      extraStarts: options.extraStarts?.map(matrix => Array.from(matrix.elements)),
    },
    signal
  );
}

/** The yaw sweep alone, for callers that want the shortlist without refining. */
export function coarseAlign(
  source: Float32Array,
  target: Float32Array,
  options: CoarseAlignOptions = {},
  signal?: AbortSignal
): Promise<RegistrationResult | null> {
  return dispatch('coarse', source, target, options, signal);
}

/** ICP refinement alone, from `options.initial` (identity when absent). */
export function icpRefine(
  source: Float32Array,
  target: Float32Array,
  options: IcpOptions = {},
  signal?: AbortSignal
): Promise<RegistrationResult | null> {
  return dispatch('icp', source, target, icpSettings(options), signal);
}

/**
 * Closed-form fit from matched correspondences. `source` and `target` are flat
 * xyz triples of equal length in matching order; at least three pairs.
 */
export function fitCorrespondences(
  source: Float32Array,
  target: Float32Array,
  signal?: AbortSignal
): Promise<RegistrationResult | null> {
  return dispatch('fit', source, target, {}, signal);
}
