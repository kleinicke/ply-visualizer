/**
 * Correspondence matching and RANSAC over FPFH descriptors.
 *
 * Descriptor matching on a repetitive interior is mostly wrong — every corner
 * looks like every other corner — so the matching stage is not expected to be
 * accurate, only to be right often enough that a consistent subset exists.
 * RANSAC's job is to find that subset, and the pre-checks below matter more
 * than the iteration count: rejecting a sample on edge lengths costs three
 * subtractions, while fitting and scoring one costs a pass over every match.
 */

const dot = (f, i, g, j, dim) => {
  let s = 0;
  for (let k = 0; k < dim; k++) { const d = f[i * dim + k] - g[j * dim + k]; s += d * d; }
  return s;
};

/** Mutual nearest neighbours in descriptor space. */
export function matchFeatures(source, target, { ratio = 0.95 } = {}) {
  const dim = source.dim;
  const ns = source.points.length / 3, nt = target.points.length / 3;
  const forward = new Int32Array(ns).fill(-1);
  const backwardBest = new Float64Array(nt).fill(Infinity);
  const backward = new Int32Array(nt).fill(-1);
  for (let i = 0; i < ns; i++) {
    let best = Infinity, second = Infinity, bestJ = -1;
    for (let j = 0; j < nt; j++) {
      const d = dot(source.features, i, target.features, j, dim);
      if (d < best) { second = best; best = d; bestJ = j; }
      else if (d < second) second = d;
      if (d < backwardBest[j]) { backwardBest[j] = d; backward[j] = i; }
    }
    // Lowe-style ratio: a match with no close runner-up is worth more.
    if (bestJ >= 0 && best < second * ratio * ratio) forward[i] = bestJ;
  }
  const pairs = [];
  for (let i = 0; i < ns; i++) {
    const j = forward[i];
    if (j >= 0 && backward[j] === i) pairs.push([i, j]);
  }
  return pairs;
}

function kabsch(src, dst) {
  const n = src.length;
  const cs = [0, 0, 0], cd = [0, 0, 0];
  for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) { cs[k] += src[i][k]; cd[k] += dst[i][k]; }
  for (let k = 0; k < 3; k++) { cs[k] /= n; cd[k] /= n; }
  const H = new Float64Array(9);
  for (let i = 0; i < n; i++)
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 3; c++) H[r * 3 + c] += (src[i][r] - cs[r]) * (dst[i][c] - cd[c]);
  // Polar decomposition by Jacobi iteration on H^T H is overkill for 3x3; use
  // the classic quaternion form instead, which needs no SVD.
  const [xx, xy, xz, yx, yy, yz, zx, zy, zz] = H;
  const K = [
    [xx + yy + zz, zy - yz, xz - zx, yx - xy],
    [zy - yz, xx - yy - zz, xy + yx, zx + xz],
    [xz - zx, xy + yx, yy - xx - zz, yz + zy],
    [yx - xy, zx + xz, yz + zy, zz - xx - yy],
  ];
  // Power iteration for the dominant eigenvector of K.
  let q = [1, 0, 0, 0];
  for (let it = 0; it < 60; it++) {
    const nq = [0, 0, 0, 0];
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) nq[r] += K[r][c] * q[c];
    const len = Math.hypot(...nq);
    if (len < 1e-12) break;
    q = nq.map(v => v / len);
  }
  const [w, x, y, z] = q;
  const R = [
    1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y),
    2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x),
    2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y),
  ];
  const t = [
    cd[0] - (R[0] * cs[0] + R[1] * cs[1] + R[2] * cs[2]),
    cd[1] - (R[3] * cs[0] + R[4] * cs[1] + R[5] * cs[2]),
    cd[2] - (R[6] * cs[0] + R[7] * cs[1] + R[8] * cs[2]),
  ];
  // Column-major, matching everything else here.
  return [R[0], R[3], R[6], 0, R[1], R[4], R[7], 0, R[2], R[5], R[8], 0, t[0], t[1], t[2], 1];
}

export function ransac(source, target, pairs, options = {}) {
  const {
    iterations = 40000,
    inlier = 0.3,
    edgeTolerance = 0.25,
    minInliers = 6,
    keep = 5,
  } = options;
  const S = source.points, T = target.points;
  const n = pairs.length;
  if (n < 4) return [];
  const inlier2 = inlier * inlier;
  const results = [];

  const at = (arr, i) => [arr[i * 3], arr[i * 3 + 1], arr[i * 3 + 2]];
  const dist = (arr, i, j) => Math.hypot(
    arr[i * 3] - arr[j * 3], arr[i * 3 + 1] - arr[j * 3 + 1], arr[i * 3 + 2] - arr[j * 3 + 2]);

  let seed = 12345;
  const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

  for (let iter = 0; iter < iterations; iter++) {
    const a = (rand() * n) | 0, b = (rand() * n) | 0, c = (rand() * n) | 0;
    if (a === b || b === c || a === c) continue;
    // A rigid transform preserves distances, so three matches whose triangle
    // has different side lengths in the two clouds cannot all be right. This
    // rejects the overwhelming majority before any fitting happens.
    let ok = true;
    for (const [p, q] of [[a, b], [b, c], [a, c]]) {
      const ds = dist(S, pairs[p][0], pairs[q][0]);
      const dt = dist(T, pairs[p][1], pairs[q][1]);
      if (Math.abs(ds - dt) > edgeTolerance || ds < 0.5) { ok = false; break; }
    }
    if (!ok) continue;

    const M = kabsch(
      [at(S, pairs[a][0]), at(S, pairs[b][0]), at(S, pairs[c][0])],
      [at(T, pairs[a][1]), at(T, pairs[b][1]), at(T, pairs[c][1])]
    );
    let count = 0;
    for (let i = 0; i < n; i++) {
      const [si, ti] = pairs[i];
      const x = S[si * 3], y = S[si * 3 + 1], z = S[si * 3 + 2];
      const px = M[0] * x + M[4] * y + M[8] * z + M[12];
      const py = M[1] * x + M[5] * y + M[9] * z + M[13];
      const pz = M[2] * x + M[6] * y + M[10] * z + M[14];
      const dx = px - T[ti * 3], dy = py - T[ti * 3 + 1], dz = pz - T[ti * 3 + 2];
      if (dx * dx + dy * dy + dz * dz < inlier2) count++;
    }
    if (count >= minInliers) results.push({ matrix: M, inliers: count });
  }
  results.sort((x, y) => y.inliers - x.inliers);
  // Distinct poses only.
  const distinct = [];
  for (const r of results) {
    if (distinct.some(d => Math.hypot(d.matrix[12] - r.matrix[12], d.matrix[13] - r.matrix[13], d.matrix[14] - r.matrix[14]) < 0.5)) continue;
    distinct.push(r);
    if (distinct.length >= keep) break;
  }
  return distinct;
}
