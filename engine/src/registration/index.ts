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
 * render thread; the extension host has no `Worker`, but it is already a
 * separate process from the webview, so it calls the same wasm inline.
 */

import * as THREE from 'three';
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
}

let worker: Worker | null = null;
let workerUnavailable = false;
let nextRequestId = 1;
const pending = new Map<
  number,
  { resolve: (value: RegistrationResult | null) => void; reject: (error: Error) => void }
>();

let workerReady: Promise<Worker | null> | null = null;

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
async function ensureWorker(): Promise<Worker | null> {
  // `document` rather than `Worker` alone: this module is also loaded by the
  // extension host and by Node, and the dynamic import below must not be
  // evaluated there (see workerHost.ts).
  if (workerUnavailable || typeof Worker === 'undefined' || typeof document === 'undefined') {
    return null;
  }
  if (workerReady) {
    return workerReady;
  }
  workerReady = startWorker();
  return workerReady;
}

async function startWorker(): Promise<Worker | null> {
  try {
    const { createRegistrationWorker } = await import('./workerHost');
    worker = createRegistrationWorker();
  } catch (error) {
    console.warn('[registration] worker unavailable, running in page:', error);
    workerUnavailable = true;
    return null;
  }

  const handshake = await new Promise<boolean>(resolve => {
    const settle = (value: boolean) => {
      clearTimeout(timer);
      resolve(value);
    };
    const timer = setTimeout(() => settle(false), 10_000);
    worker!.addEventListener('message', function onReady(event: MessageEvent) {
      if (typeof event.data?.ready !== 'boolean') {
        return;
      }
      worker!.removeEventListener('message', onReady as EventListener);
      settle(event.data.ready === true);
    });
    worker!.addEventListener('error', () => settle(false), { once: true });
  });

  if (!handshake) {
    console.warn('[registration] worker did not start, running in page instead');
    worker?.terminate();
    worker = null;
    workerUnavailable = true;
    return null;
  }

  worker.onmessage = event => {
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
  worker.onerror = event => {
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
  };
}

async function dispatch(
  kind: RegistrationKind,
  source: Float32Array,
  target: Float32Array,
  settings: unknown
): Promise<RegistrationResult | null> {
  const settingsJson = JSON.stringify(settings ?? {});
  const host = await ensureWorker();
  if (!host) {
    const wasm = await loadRegistrationWasm();
    if (!wasm) {
      throw new Error('Registration is unavailable: the WebAssembly module failed to load.');
    }
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
  return new Promise<RegistrationResult | null>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    // The point buffers are copies made for this call, so transferring them
    // costs nothing and saves duplicating tens of megabytes per request.
    host.postMessage(request, [source.buffer, target.buffer]);
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
export function registrationBackend(): 'worker' | 'in page' | 'not started' {
  if (worker) {
    return 'worker';
  }
  return workerUnavailable ? 'in page' : 'not started';
}

export function registerPair(
  source: Float32Array,
  target: Float32Array,
  options: RegisterPairOptions = {}
): Promise<RegistrationResult | null> {
  return dispatch('register', source, target, {
    coarse: options.coarse === false ? undefined : (options.coarse ?? {}),
    icp: options.icp === false ? undefined : icpSettings(options.icp ?? {}),
    maxCandidates: options.maxCandidates,
  });
}

/** The yaw sweep alone, for callers that want the shortlist without refining. */
export function coarseAlign(
  source: Float32Array,
  target: Float32Array,
  options: CoarseAlignOptions = {}
): Promise<RegistrationResult | null> {
  return dispatch('coarse', source, target, options);
}

/** ICP refinement alone, from `options.initial` (identity when absent). */
export function icpRefine(
  source: Float32Array,
  target: Float32Array,
  options: IcpOptions = {}
): Promise<RegistrationResult | null> {
  return dispatch('icp', source, target, icpSettings(options));
}

/**
 * Closed-form fit from matched correspondences. `source` and `target` are flat
 * xyz triples of equal length in matching order; at least three pairs.
 */
export function fitCorrespondences(
  source: Float32Array,
  target: Float32Array
): Promise<RegistrationResult | null> {
  return dispatch('fit', source, target, {});
}
