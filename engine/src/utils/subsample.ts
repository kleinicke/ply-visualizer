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

/** Sorted indices of `k` points chosen uniformly from `n`. */
export function chooseIndices(n: number, k: number, seed = 1): Uint32Array {
  const out = new Uint32Array(k);
  const rand = random(seed);
  let selected = 0;
  for (let i = 0; i < n && selected < k; i++) {
    if ((n - i) * rand() < k - selected) {
      out[selected++] = i;
    }
  }
  return out;
}

type Typed = Float32Array | Uint8Array | Uint16Array | Int16Array | Uint32Array;

function gather<T extends Typed>(array: T, indices: Uint32Array, stride: number): T {
  const out = new (array.constructor as new (length: number) => T)(indices.length * stride);
  if (stride === 1) {
    for (let j = 0; j < indices.length; j++) {
      out[j] = array[indices[j]];
    }
  } else {
    for (let j = 0; j < indices.length; j++) {
      const src = indices[j] * stride;
      const dst = j * stride;
      for (let c = 0; c < stride; c++) {
        out[dst + c] = array[src + c];
      }
    }
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

/** Subsamples `data` in place. Meshes and Gaussian splats are left whole. */
export function subsampleSpatialData(
  data: SpatialData,
  options: SubsampleOptions
): SubsampleResult {
  const of = data.vertexCount;
  const none = (reason?: string): SubsampleResult => ({ subsampled: false, kept: of, of, reason });
  if (data.faceCount > 0 || data.indicesArray?.length || data.faces?.length) {
    return none('mesh (faces would break)');
  }
  if (data.sceneModel) {
    return none('scene model');
  }
  if (data.isGaussianSplat) {
    return none('Gaussian splat');
  }
  const kept = subsampleTarget(of, options);
  if (kept >= of) {
    return none();
  }
  const seed = options.seed ?? hashName(data.fileName ?? '');
  const indices = chooseIndices(of, kept, seed);

  if (data.useTypedArrays || data.positionsArray) {
    if (data.positionsArray) {
      data.positionsArray = gather(data.positionsArray, indices, 3);
    }
    if (data.colorsArray) {
      data.colorsArray = gather(data.colorsArray, indices, data.colorsArray.length / of);
    }
    if (data.normalsArray) {
      data.normalsArray = gather(data.normalsArray, indices, data.normalsArray.length / of);
    }
    if (data.intensityArray) {
      data.intensityArray = gather(data.intensityArray, indices, 1);
    }
    if (data.scalarFields) {
      for (const [name, array] of Object.entries(data.scalarFields)) {
        if (array.length === of) {
          data.scalarFields[name] = gather(array as Typed, indices, 1) as typeof array;
        } else {
          delete data.scalarFields[name];
        }
      }
    }
  }
  if (data.vertices?.length === of) {
    data.vertices = Array.from(indices, i => data.vertices[i]);
  }

  // Keep the link back to the source rows (inspection, export).
  const previous = data.sourcePointIndices;
  if (previous?.length === of) {
    data.sourcePointIndices = gather(previous, indices, 1);
  } else {
    data.sourcePointIndices = indices;
  }
  data.sourceRowsIdentity = false;
  if (data.sourcePointCount === undefined) {
    data.sourcePointCount = of;
  }
  delete data.positionBounds;
  data.vertexCount = kept;
  data.metadata = { ...data.metadata, subsampled: { kept, of } };
  return { subsampled: true, kept, of };
}
