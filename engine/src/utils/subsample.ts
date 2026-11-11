import type { SpatialData } from '../interfaces';

/**
 * Load-time subsampling: keep a random subset of a point cloud's points, in
 * their original order, so many large clouds fit in memory together.
 *
 * `fraction` keeps that share of the points; `maxPoints` caps the count. Both
 * may be given (the smaller result wins). Selection is uniform without
 * replacement (Knuth's algorithm S), so the result has exactly the target
 * count and no striding artefacts on scan-ordered data.
 */
export interface SubsampleOptions {
  fraction?: number;
  maxPoints?: number;
  /** Seed, so reloading the same file gives the same subset. */
  seed?: number;
}

export interface SubsampleResult {
  subsampled: boolean;
  kept: number;
  of: number;
  /** Why nothing was done, when `subsampled` is false. */
  reason?: string;
}

export function subsampleTarget(count: number, options: SubsampleOptions): number {
  let target = count;
  if (options.fraction !== undefined && options.fraction > 0 && options.fraction < 1) {
    target = Math.max(1, Math.round(count * options.fraction));
  }
  if (options.maxPoints !== undefined && options.maxPoints > 0) {
    target = Math.min(target, Math.floor(options.maxPoints));
  }
  return target;
}

/** Small fast PRNG (mulberry32). */
function random(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Cooperative slicing: work runs in slices of about `budgetMs`, yielding to
 * the event loop in between so the page keeps painting and responding.
 */
export interface Slicer {
  /** Call often inside a loop; yields when the slice is used up. */
  tick(units: number): Promise<void> | null;
}

const yieldTask = () =>
  new Promise<void>(resolve => {
    // A macrotask (not a microtask), so rendering can happen in between.
    const channel = new MessageChannel();
    channel.port1.onmessage = () => resolve();
    channel.port2.postMessage(0);
  });

export function createSlicer(
  totalUnits: number,
  onProgress?: (fraction: number) => void,
  budgetMs = 12
): Slicer {
  let done = 0;
  let sliceStart = performance.now();
  return {
    tick(units) {
      done += units;
      if (performance.now() - sliceStart < budgetMs) {
        return null;
      }
      onProgress?.(totalUnits > 0 ? Math.min(1, done / totalUnits) : 1);
      return yieldTask().then(() => {
        sliceStart = performance.now();
      });
    },
  };
}

/** Points handled between checks of the slice clock. */
const CHUNK = 1 << 16;

/** Sorted indices of `k` points chosen uniformly from `n`. */
export async function chooseIndices(
  n: number,
  k: number,
  seed = 1,
  slicer?: Slicer
): Promise<Uint32Array> {
  const out = new Uint32Array(k);
  const rand = random(seed);
  let selected = 0;
  for (let start = 0; start < n && selected < k; start += CHUNK) {
    const end = Math.min(n, start + CHUNK);
    for (let i = start; i < end && selected < k; i++) {
      if ((n - i) * rand() < k - selected) {
        out[selected++] = i;
      }
    }
    await slicer?.tick(end - start);
  }
  return out;
}

type Typed = Float32Array | Uint8Array | Uint16Array | Int16Array | Uint32Array;

async function gather<T extends Typed>(
  array: T,
  indices: Uint32Array,
  stride: number,
  slicer?: Slicer
): Promise<T> {
  const out = new (array.constructor as new (length: number) => T)(indices.length * stride);
  for (let start = 0; start < indices.length; start += CHUNK) {
    const end = Math.min(indices.length, start + CHUNK);
    if (stride === 1) {
      for (let j = start; j < end; j++) {
        out[j] = array[indices[j]];
      }
    } else {
      for (let j = start; j < end; j++) {
        const src = indices[j] * stride;
        const dst = j * stride;
        for (let c = 0; c < stride; c++) {
          out[dst + c] = array[src + c];
        }
      }
    }
    await slicer?.tick(end - start);
  }
  return out;
}

function hashName(name: string): number {
  let h = 2166136261;
  for (let i = 0; i < name.length; i++) {
    h = Math.imul(h ^ name.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}

/** Why a cloud cannot be subsampled, or null when it can. */
export function cannotSubsample(data: SpatialData): string | null {
  if (data.faceCount > 0 || data.indicesArray?.length || data.faces?.length) {
    return 'mesh (faces would break)';
  }
  if (data.sceneModel) {
    return 'scene model';
  }
  if (data.isGaussianSplat) {
    return 'Gaussian splat';
  }
  return null;
}

/**
 * Subsamples `data` in place. Meshes and Gaussian splats are left whole.
 * Runs in slices that yield to the page; `onProgress` gets 0..1.
 */
export async function subsampleSpatialData(
  data: SpatialData,
  options: SubsampleOptions,
  onProgress?: (fraction: number) => void
): Promise<SubsampleResult> {
  const of = data.vertexCount;
  const none = (reason?: string): SubsampleResult => ({ subsampled: false, kept: of, of, reason });
  const reason = cannotSubsample(data);
  if (reason) {
    return none(reason);
  }
  const kept = subsampleTarget(of, options);
  if (kept >= of) {
    return none();
  }
  const seed = options.seed ?? hashName(data.fileName ?? '');

  // Arrays to thin; one that appears twice (intensityArray is also
  // scalarFields.intensity) is gathered once and stays shared.
  const sources = new Set<Typed>();
  const add = (a: unknown) => {
    if (a && ArrayBuffer.isView(a) && (a as Typed).length % of === 0) {
      sources.add(a as Typed);
    }
  };
  add(data.positionsArray);
  add(data.colorsArray);
  add(data.normalsArray);
  add(data.intensityArray);
  for (const array of Object.values(data.scalarFields ?? {})) {
    add(array);
  }
  const previousRows = data.sourcePointIndices?.length === of ? data.sourcePointIndices : null;
  if (previousRows) {
    sources.add(previousRows);
  }
  const slicer = createSlicer(of + kept * sources.size, onProgress);
  const indices = await chooseIndices(of, kept, seed, slicer);
  const thinned = new Map<Typed, Typed>();
  for (const array of sources) {
    thinned.set(array, await gather(array, indices, array.length / of, slicer));
  }
  const pick = <T>(a: T): T => {
    const thin = a ? thinned.get(a as unknown as Typed) : undefined;
    return thin ? (thin as unknown as T) : a;
  };

  data.positionsArray = pick(data.positionsArray);
  data.colorsArray = pick(data.colorsArray);
  data.normalsArray = pick(data.normalsArray);
  data.intensityArray = pick(data.intensityArray);
  if (data.scalarFields) {
    for (const [name, array] of Object.entries(data.scalarFields)) {
      if (thinned.has(array as Typed)) {
        data.scalarFields[name] = thinned.get(array as Typed) as typeof array;
      } else {
        delete data.scalarFields[name];
      }
    }
  }
  if (data.vertices?.length === of) {
    data.vertices = Array.from(indices, i => data.vertices[i]);
  }
  // Keep the link back to the source rows (inspection, export).
  data.sourcePointIndices = previousRows ? (thinned.get(previousRows) as Uint32Array) : indices;
  data.sourceRowsIdentity = false;
  if (data.sourcePointCount === undefined) {
    data.sourcePointCount = of;
  }
  delete data.positionBounds;
  data.vertexCount = kept;
  data.metadata = { ...data.metadata, subsampled: { kept, of } };
  onProgress?.(1);
  return { subsampled: true, kept, of };
}
