/**
 * Marching cubes over a scalar volume.
 *
 * This is the cheapest useful thing the volume bridge can do: the heavy pass
 * turns an intensity stack into an ordinary indexed triangle mesh, which is
 * already this viewer's core competence — so the result flows through the
 * existing geometry, transform, measurement and comparison paths without a
 * volume renderer existing yet.
 *
 * Output is in the volume's world space (millimetres, for anything derived
 * from DICOM), not in voxel indices, because a mesh whose coordinates are
 * array subscripts cannot be measured against anything else in the scene.
 */

import type { VolumeData } from '../parsers/nrrdParser';
import { cornerOffsets, edgeCorners, edgeTable, triTable } from './marchingCubesTables';

export interface IsosurfaceOptions {
  /** Iso value, in whatever units the volume's samples carry. */
  threshold: number;
  /**
   * Sample every `step`-th voxel along each axis. The dominant memory and time
   * control: step 2 is 8x fewer cells.
   */
  step?: number;
  /**
   * Refuse to build a mesh larger than this many triangles, rather than
   * exhausting memory. The caller is expected to have chosen `step` so this
   * is not hit; it is a backstop for pathological thresholds (an iso value
   * inside the noise floor makes almost every cell active).
   */
  maxTriangles?: number;
  onProgress?: (fraction: number) => void;
}

export interface IsosurfaceMesh {
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
  vertexCount: number;
  triangleCount: number;
  /** Grid step actually used, so callers can report what they rendered. */
  step: number;
}

const DEFAULT_MAX_TRIANGLES = 12_000_000;

/**
 * Picks a decimation step so the extraction stays within a cell budget.
 *
 * A 512x512x600 CT is 157M cells; marching that at full resolution produces
 * tens of millions of triangles that no one wants to look at and the GPU would
 * struggle to hold. Halving each axis is visually near-identical for an
 * isosurface and 8x cheaper, so decimating by default and letting the user opt
 * back up is the honest trade.
 */
export function chooseStep(sizes: readonly number[], cellBudget = 40_000_000): number {
  let step = 1;
  while (
    Math.floor((sizes[0] - 1) / step) *
      Math.floor((sizes[1] - 1) / step) *
      Math.floor((sizes[2] - 1) / step) >
      cellBudget &&
    step < 16
  ) {
    step++;
  }
  return step;
}

/** A Float32Array that grows by doubling, to avoid per-vertex array-of-number boxing. */
class FloatBuffer {
  private data: Float32Array;
  length = 0;

  constructor(initial = 1 << 16) {
    this.data = new Float32Array(initial);
  }

  push3(a: number, b: number, c: number): void {
    if (this.length + 3 > this.data.length) {
      const grown = new Float32Array(this.data.length * 2);
      grown.set(this.data);
      this.data = grown;
    }
    this.data[this.length++] = a;
    this.data[this.length++] = b;
    this.data[this.length++] = c;
  }

  trimmed(): Float32Array {
    return this.data.subarray(0, this.length).slice();
  }
}

class IndexBuffer {
  private data: Uint32Array;
  length = 0;

  constructor(initial = 1 << 16) {
    this.data = new Uint32Array(initial);
  }

  push(value: number): void {
    if (this.length + 1 > this.data.length) {
      const grown = new Uint32Array(this.data.length * 2);
      grown.set(this.data);
      this.data = grown;
    }
    this.data[this.length++] = value;
  }

  trimmed(): Uint32Array {
    return this.data.subarray(0, this.length).slice();
  }
}

export function extractIsosurface(volume: VolumeData, options: IsosurfaceOptions): IsosurfaceMesh {
  const { threshold } = options;
  const maxTriangles = options.maxTriangles ?? DEFAULT_MAX_TRIANGLES;
  const step = Math.max(1, Math.floor(options.step ?? 1));

  const [nx, ny, nz] = volume.sizes;
  const samples = volume.samples;

  // Grid of sampled points after decimation.
  const gx = Math.floor((nx - 1) / step) + 1;
  const gy = Math.floor((ny - 1) / step) + 1;
  const gz = Math.floor((nz - 1) / step) + 1;
  if (gx < 2 || gy < 2 || gz < 2) {
    throw new Error(
      `Volume is too small to isosurface at step ${step} (${gx}x${gy}x${gz} sample grid)`
    );
  }

  const strideY = nx;
  const strideZ = nx * ny;
  const at = (a: number, b: number, c: number): number =>
    samples[a * step + b * step * strideY + c * step * strideZ];

  const positions = new FloatBuffer();
  const normals = new FloatBuffer();
  const indices = new IndexBuffer();

  // Edge-vertex cache. Each sampled grid point owns up to three edges — the
  // ones leaving it along +i, +j and +k — so an edge shared by up to four
  // cells produces exactly one vertex. Only two k-layers are ever live, which
  // is what keeps peak memory proportional to a slice rather than the volume.
  const layerSize = gx * gy * 3;
  let current = new Int32Array(layerSize).fill(-1);
  let next = new Int32Array(layerSize).fill(-1);

  const m = volume.ijkToWorld;
  // Inverse-transpose of the affine's 3x3, for transforming gradients. Under a
  // non-uniform or oblique voxel grid — which oblique DICOM always is — a
  // normal transformed by M itself is wrong and the shading visibly skews.
  const normalMatrix = inverseTranspose3(m);

  const cornerValues = new Float64Array(8);
  const edgeVertices = new Int32Array(12);

  for (let c = 0; c < gz - 1; c++) {
    for (let b = 0; b < gy - 1; b++) {
      for (let a = 0; a < gx - 1; a++) {
        let cubeIndex = 0;
        for (let corner = 0; corner < 8; corner++) {
          const [di, dj, dk] = cornerOffsets[corner];
          const value = at(a + di, b + dj, c + dk);
          cornerValues[corner] = value;
          // `>=` rather than `>`: a sample exactly at the threshold counts as
          // inside, so a volume of constant value never yields a surface
          // riddled with degenerate triangles.
          if (value >= threshold) {
            cubeIndex |= 1 << corner;
          }
        }

        const edges = edgeTable[cubeIndex];
        if (edges === 0) {
          continue;
        }

        for (let edge = 0; edge < 12; edge++) {
          if ((edges & (1 << edge)) === 0) {
            continue;
          }
          const [c0, c1] = edgeCorners[edge];
          const [i0, j0, k0] = cornerOffsets[c0];
          const [i1, j1, k1] = cornerOffsets[c1];

          // The edge is owned by its lower-numbered endpoint, along whichever
          // axis it runs.
          const axis = i0 !== i1 ? 0 : j0 !== j1 ? 1 : 2;
          const oa = a + Math.min(i0, i1);
          const ob = b + Math.min(j0, j1);
          const ok = c + Math.min(k0, k1);
          const cache = ok === c ? current : next;
          const slot = (oa + ob * gx) * 3 + axis;

          let vertexIndex = cache[slot];
          if (vertexIndex === -1) {
            const v0 = cornerValues[c0];
            const v1 = cornerValues[c1];
            // Linear interpolation to the crossing. The guard matters: equal
            // endpoint values mean the crossing is undefined, and dividing
            // through would emit NaN positions that poison the bounding box.
            const denominator = v1 - v0;
            const t = Math.abs(denominator) > 1e-12 ? (threshold - v0) / denominator : 0.5;

            const ga = a + i0 + (i1 - i0) * t;
            const gb = b + j0 + (j1 - j0) * t;
            const gc = c + k0 + (k1 - k0) * t;

            // Grid coordinates are decimated; the affine is in original voxel
            // indices, so scale back before transforming.
            const vi = ga * step;
            const vj = gb * step;
            const vk = gc * step;
            positions.push3(
              m[0] * vi + m[1] * vj + m[2] * vk + m[3],
              m[4] * vi + m[5] * vj + m[6] * vk + m[7],
              m[8] * vi + m[9] * vj + m[10] * vk + m[11]
            );

            const g0 = gradientAt(samples, nx, ny, nz, a + i0, b + j0, c + k0, step);
            const g1 = gradientAt(samples, nx, ny, nz, a + i1, b + j1, c + k1, step);
            // Negated: the field increases inwards (denser tissue is brighter),
            // so the outward normal follows the decreasing gradient.
            const nxg = -(g0[0] + (g1[0] - g0[0]) * t);
            const nyg = -(g0[1] + (g1[1] - g0[1]) * t);
            const nzg = -(g0[2] + (g1[2] - g0[2]) * t);

            let wx = normalMatrix[0] * nxg + normalMatrix[1] * nyg + normalMatrix[2] * nzg;
            let wy = normalMatrix[3] * nxg + normalMatrix[4] * nyg + normalMatrix[5] * nzg;
            let wz = normalMatrix[6] * nxg + normalMatrix[7] * nyg + normalMatrix[8] * nzg;
            const length = Math.hypot(wx, wy, wz);
            if (length > 1e-12) {
              wx /= length;
              wy /= length;
              wz /= length;
            } else {
              wx = 0;
              wy = 0;
              wz = 1;
            }
            normals.push3(wx, wy, wz);

            vertexIndex = positions.length / 3 - 1;
            cache[slot] = vertexIndex;
          }
          edgeVertices[edge] = vertexIndex;
        }

        const triangles = triTable[cubeIndex];
        for (let t = 0; t < triangles.length && triangles[t] !== -1; t += 3) {
          if (indices.length / 3 >= maxTriangles) {
            throw new Error(
              `Isosurface exceeded ${maxTriangles.toLocaleString()} triangles. ` +
                'Raise the threshold or increase the decimation step.'
            );
          }
          indices.push(edgeVertices[triangles[t]]);
          indices.push(edgeVertices[triangles[t + 1]]);
          indices.push(edgeVertices[triangles[t + 2]]);
        }
      }
    }

    // Advance a layer: the layer we just finished is dead, and the one we were
    // filling ahead becomes current.
    const recycled = current;
    current = next;
    next = recycled;
    next.fill(-1);

    options.onProgress?.((c + 1) / (gz - 1));
  }

  return {
    positions: positions.trimmed(),
    normals: normals.trimmed(),
    indices: indices.trimmed(),
    vertexCount: positions.length / 3,
    triangleCount: indices.length / 3,
    step,
  };
}

/**
 * Central-difference gradient in voxel-index space, one-sided at the border.
 *
 * Coordinates arrive in decimated grid units; differencing over the same step
 * the surface was built at keeps the gradient consistent with the geometry
 * instead of picking up noise the decimation already discarded.
 */
function gradientAt(
  samples: VolumeData['samples'],
  nx: number,
  ny: number,
  nz: number,
  a: number,
  b: number,
  c: number,
  step: number
): [number, number, number] {
  const i = a * step;
  const j = b * step;
  const k = c * step;
  const strideY = nx;
  const strideZ = nx * ny;
  const sample = (x: number, y: number, z: number): number =>
    samples[x + y * strideY + z * strideZ];

  const xLow = Math.max(0, i - step);
  const xHigh = Math.min(nx - 1, i + step);
  const yLow = Math.max(0, j - step);
  const yHigh = Math.min(ny - 1, j + step);
  const zLow = Math.max(0, k - step);
  const zHigh = Math.min(nz - 1, k + step);

  return [
    (sample(xHigh, j, k) - sample(xLow, j, k)) / Math.max(1, xHigh - xLow),
    (sample(i, yHigh, k) - sample(i, yLow, k)) / Math.max(1, yHigh - yLow),
    (sample(i, j, zHigh) - sample(i, j, zLow)) / Math.max(1, zHigh - zLow),
  ];
}

/** Inverse transpose of the upper-left 3x3 of a row-major 4x4. */
function inverseTranspose3(m: readonly number[]): number[] {
  const a = m[0];
  const b = m[1];
  const c = m[2];
  const d = m[4];
  const e = m[5];
  const f = m[6];
  const g = m[8];
  const h = m[9];
  const i = m[10];

  const determinant = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
  if (Math.abs(determinant) < 1e-20) {
    // Degenerate affine (a zero-thickness axis). Shading will be wrong but the
    // positions are still meaningful, so fall through with identity rather
    // than failing the whole load.
    return [1, 0, 0, 0, 1, 0, 0, 0, 1];
  }
  const inverseDeterminant = 1 / determinant;

  // inverse(M) then transpose, written out directly.
  return [
    (e * i - f * h) * inverseDeterminant,
    (f * g - d * i) * inverseDeterminant,
    (d * h - e * g) * inverseDeterminant,
    (c * h - b * i) * inverseDeterminant,
    (a * i - c * g) * inverseDeterminant,
    (b * g - a * h) * inverseDeterminant,
    (b * f - c * e) * inverseDeterminant,
    (c * d - a * f) * inverseDeterminant,
    (a * e - b * d) * inverseDeterminant,
  ];
}
