/**
 * The Rust solvers, plus the bookkeeping every strategy needs.
 *
 * Strategies are compared on how they *use* the solver, so they must all reach
 * it the same way and be charged for it the same way: one counter, one clock,
 * no strategy quietly buying accuracy with calls the table does not show.
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
export const wasm = require('../../wasm/pointcloud-parser/pkg/pointcloud_parser.js');

export function createSolver() {
  const stats = { calls: 0, ms: 0, byKind: {} };
  function call(kind, source, target, settings = {}) {
    const fn = kind === 'register' ? wasm.register_pair
      : kind === 'coarse' ? wasm.coarse_align
        : kind === 'icp' ? wasm.icp_refine
          : wasm.fit_correspondences;
    const t0 = Date.now();
    const r = fn(Float32Array.from(source), Float32Array.from(target), JSON.stringify(settings));
    const dt = Date.now() - t0;
    stats.calls++; stats.ms += dt;
    stats.byKind[kind] = (stats.byKind[kind] ?? 0) + dt;
    if (!r) return null;
    const matrix = r.matrix ? Array.from(r.matrix) : null;
    const parsed = r.stats ? JSON.parse(r.stats) : {};
    r.free?.();
    return matrix ? { matrix, ...parsed } : null;
  }
  const conditioning = points => wasm.cloud_position_conditioning(Float32Array.from(points), 0);
  return { call, conditioning, stats };
}

/** fitness penalised by residual relative to the cell it was measured at. */
export const quality = result =>
  !result?.icp ? 0
    : result.icp.fitness / (1 + result.icp.inlierRmse / Math.max(result.voxelCell ?? 1e-6, 1e-9));

export function transform(points, M) {
  const out = new Float32Array(points.length);
  for (let i = 0; i < points.length; i += 3) {
    const x = points[i], y = points[i + 1], z = points[i + 2];
    out[i] = M[0] * x + M[4] * y + M[8] * z + M[12];
    out[i + 1] = M[1] * x + M[5] * y + M[9] * z + M[13];
    out[i + 2] = M[2] * x + M[6] * y + M[10] * z + M[14];
  }
  return out;
}

export function decimate(points, maxPoints) {
  const count = points.length / 3;
  if (count <= maxPoints) return points;
  const step = Math.ceil(count / maxPoints);
  const out = new Float32Array(Math.ceil(count / step) * 3);
  let w = 0;
  for (let i = 0; i < count; i += step) {
    out[w++] = points[i * 3]; out[w++] = points[i * 3 + 1]; out[w++] = points[i * 3 + 2];
  }
  return out.subarray(0, w);
}
