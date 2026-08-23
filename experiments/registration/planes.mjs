/**
 * Plane-triplet registration, for scenes that are made of planes.
 *
 * FPFH describes how varied a neighbourhood is, which is exactly what a flat
 * wall does not have: measured on a synthetic room, only 0.2-3.7% of its
 * descriptor matches were geometrically correct, because most points sit on
 * large planar surfaces and look identical to one another.
 *
 * A room's planes are the opposite: few, stable, and individually meaningful.
 * A plane carries a normal *and* a distance from the instrument, so a matched
 * pair constrains rotation and one component of translation, and three
 * non-parallel planes determine a pose outright. With only a handful of planes
 * per scan the correspondence search is small enough to enumerate exhaustively,
 * which removes the sampling luck that RANSAC depends on.
 */

function fitPlane(points, indices) {
  let cx = 0, cy = 0, cz = 0;
  for (const i of indices) { cx += points[i * 3]; cy += points[i * 3 + 1]; cz += points[i * 3 + 2]; }
  const n = indices.length;
  cx /= n; cy /= n; cz /= n;
  const c = new Float64Array(9);
  for (const i of indices) {
    const d = [points[i * 3] - cx, points[i * 3 + 1] - cy, points[i * 3 + 2] - cz];
    for (let r = 0; r < 3; r++) for (let s = 0; s < 3; s++) c[r * 3 + s] += d[r] * d[s];
  }
  // Smallest-eigenvector by inverse power iteration on a 3x3 is overkill;
  // deflation via the two dominant directions is stable enough here.
  let best = null, bestVal = Infinity;
  for (const seed of [[1, 0, 0], [0, 1, 0], [0, 0, 1]]) {
    let v = seed.slice();
    for (let it = 0; it < 40; it++) {
      const w = [
        c[0] * v[0] + c[1] * v[1] + c[2] * v[2],
        c[3] * v[0] + c[4] * v[1] + c[5] * v[2],
        c[6] * v[0] + c[7] * v[1] + c[8] * v[2],
      ];
      const len = Math.hypot(...w);
      if (len < 1e-12) break;
      // Subtracting from the trace turns the largest eigenvalue into the
      // smallest, so power iteration converges to the plane normal.
      const trace = c[0] + c[4] + c[8];
      v = [trace * v[0] - w[0], trace * v[1] - w[1], trace * v[2] - w[2]];
      const vl = Math.hypot(...v);
      if (vl < 1e-12) break;
      v = v.map(x => x / vl);
    }
    const q = [
      c[0] * v[0] + c[1] * v[1] + c[2] * v[2],
      c[3] * v[0] + c[4] * v[1] + c[5] * v[2],
      c[6] * v[0] + c[7] * v[1] + c[8] * v[2],
    ];
    const val = Math.abs(q[0] * v[0] + q[1] * v[1] + q[2] * v[2]);
    if (val < bestVal) { bestVal = val; best = v; }
  }
  const d = best[0] * cx + best[1] * cy + best[2] * cz;
  // Orient consistently: the instrument sits at the origin, so a plane it can
  // see has a positive distance once the normal points back at it.
  return d < 0 ? { n: best.map(x => -x), d: -d, centre: [cx, cy, cz] } : { n: best, d, centre: [cx, cy, cz] };
}

export function extractPlanes(points, options = {}) {
  const { maxPlanes = 8, tolerance = 0.05, minPoints = 400, iterations = 300, stride = 5 } = options;
  const sample = [];
  for (let i = 0; i < points.length / 3; i += stride) sample.push(i);
  const remaining = new Set(sample);
  const planes = [];
  let seed = 7;
  const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

  for (let p = 0; p < maxPlanes && remaining.size > minPoints; p++) {
    const pool = [...remaining];
    let bestCount = 0, bestPlane = null;
    for (let it = 0; it < iterations; it++) {
      const pick = [0, 1, 2].map(() => pool[(rand() * pool.length) | 0]);
      const plane = fitPlane(points, pick);
      if (!plane || !isFinite(plane.d)) continue;
      let count = 0;
      for (let k = 0; k < pool.length; k += 3) {
        const i = pool[k];
        const dist = Math.abs(plane.n[0] * points[i * 3] + plane.n[1] * points[i * 3 + 1] + plane.n[2] * points[i * 3 + 2] - plane.d);
        if (dist < tolerance) count++;
      }
      if (count > bestCount) { bestCount = count; bestPlane = plane; }
    }
    if (!bestPlane || bestCount * 3 < minPoints) break;
    const inliers = [];
    for (const i of pool) {
      const dist = Math.abs(bestPlane.n[0] * points[i * 3] + bestPlane.n[1] * points[i * 3 + 1] + bestPlane.n[2] * points[i * 3 + 2] - bestPlane.d);
      if (dist < tolerance) inliers.push(i);
    }
    if (inliers.length < minPoints) break;
    const refined = fitPlane(points, inliers);
    refined.size = inliers.length;
    // Extent matters when matching: a 6 m wall and a 0.4 m box face are not
    // interchangeable even when their normals agree.
    let minP = Infinity, maxP = -Infinity, minQ = Infinity, maxQ = -Infinity;
    const u = Math.abs(refined.n[2]) < 0.9 ? [-refined.n[1], refined.n[0], 0] : [1, 0, 0];
    const ul = Math.hypot(...u); const uu = u.map(x => x / ul);
    const vv = [
      refined.n[1] * uu[2] - refined.n[2] * uu[1],
      refined.n[2] * uu[0] - refined.n[0] * uu[2],
      refined.n[0] * uu[1] - refined.n[1] * uu[0],
    ];
    for (const i of inliers) {
      const q = [points[i * 3], points[i * 3 + 1], points[i * 3 + 2]];
      const a = q[0] * uu[0] + q[1] * uu[1] + q[2] * uu[2];
      const b = q[0] * vv[0] + q[1] * vv[1] + q[2] * vv[2];
      minP = Math.min(minP, a); maxP = Math.max(maxP, a);
      minQ = Math.min(minQ, b); maxQ = Math.max(maxQ, b);
    }
    refined.extent = [maxP - minP, maxQ - minQ];
    planes.push(refined);
    for (const i of inliers) remaining.delete(i);
  }
  return planes;
}

const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Rotation carrying three source normals onto three target normals. */
function rotationFromNormals(from, to) {
  // Orthonormal frames built from each triple, then R = F_to * F_from^T.
  const frame = v => {
    const e0 = v[0];
    let e1 = [v[1][0] - dot3(v[1], e0) * e0[0], v[1][1] - dot3(v[1], e0) * e0[1], v[1][2] - dot3(v[1], e0) * e0[2]];
    const l1 = Math.hypot(...e1);
    if (l1 < 1e-6) return null;
    e1 = e1.map(x => x / l1);
    const e2 = cross(e0, e1);
    return [e0, e1, e2];
  };
  const A = frame(from), B = frame(to);
  if (!A || !B) return null;
  const R = new Array(9).fill(0);
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++)
      for (let k = 0; k < 3; k++) R[r * 3 + c] += B[k][r] * A[k][c];
  return R;
}

function solve3(M, rhs) {
  const a = [[M[0], M[1], M[2], rhs[0]], [M[3], M[4], M[5], rhs[1]], [M[6], M[7], M[8], rhs[2]]];
  for (let i = 0; i < 3; i++) {
    let p = i;
    for (let k = i + 1; k < 3; k++) if (Math.abs(a[k][i]) > Math.abs(a[p][i])) p = k;
    [a[i], a[p]] = [a[p], a[i]];
    if (Math.abs(a[i][i]) < 1e-9) return null;
    for (let k = 0; k < 3; k++) {
      if (k === i) continue;
      const f = a[k][i] / a[i][i];
      for (let j = i; j < 4; j++) a[k][j] -= f * a[i][j];
    }
  }
  return [a[0][3] / a[0][0], a[1][3] / a[1][1], a[2][3] / a[2][2]];
}

/**
 * Every plausible correspondence between two plane sets, scored by how many
 * planes the resulting pose explains.
 *
 * Exhaustive rather than sampled: with a handful of planes per scan the whole
 * space is a few thousand combinations, so there is no reason to gamble on
 * random triplets the way point-based RANSAC must.
 */
export function matchPlanes(planesA, planesB, options = {}) {
  const { angleTolerance = 6, distanceTolerance = 0.35, keep = 6, minSpread = 0.35 } = options;
  const cosTol = Math.cos(angleTolerance * Math.PI / 180);
  const triples = planes => {
    const out = [];
    for (let i = 0; i < planes.length; i++)
      for (let j = i + 1; j < planes.length; j++)
        for (let k = j + 1; k < planes.length; k++) {
          // Three planes only fix a pose if their normals span 3-D; a floor,
          // a ceiling and one wall do not.
          const det = Math.abs(dot3(cross(planes[i].n, planes[j].n), planes[k].n));
          if (det > minSpread) out.push([i, j, k]);
        }
    return out;
  };
  const ta = triples(planesA), tb = triples(planesB);
  const results = [];
  const perms = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];

  for (const A of ta) {
    const na = A.map(i => planesA[i].n);
    const angA = [dot3(na[0], na[1]), dot3(na[1], na[2]), dot3(na[0], na[2])];
    for (const B of tb) {
      for (const p of perms) {
        const nb = p.map(i => planesB[B[i]].n);
        const angB = [dot3(nb[0], nb[1]), dot3(nb[1], nb[2]), dot3(nb[0], nb[2])];
        // The angles between normals are invariant under rotation, so a
        // mismatch here rules the correspondence out before any fitting.
        if (Math.abs(angA[0] - angB[0]) > 1 - cosTol) continue;
        if (Math.abs(angA[1] - angB[1]) > 1 - cosTol) continue;
        if (Math.abs(angA[2] - angB[2]) > 1 - cosTol) continue;

        const R = rotationFromNormals(na, nb);
        if (!R) continue;
        const M = [];
        const rhs = [];
        for (let i = 0; i < 3; i++) {
          M.push(nb[i][0], nb[i][1], nb[i][2]);
          rhs.push(planesB[B[p[i]]].d - planesA[A[i]].d);
        }
        const t = solve3(M, rhs);
        if (!t) continue;

        const matrix = [R[0], R[3], R[6], 0, R[1], R[4], R[7], 0, R[2], R[5], R[8], 0, t[0], t[1], t[2], 1];
        // Score on *all* planes, not just the three used: a pose that explains
        // only its own evidence has explained nothing.
        let score = 0;
        for (const pa of planesA) {
          const rn = [
            R[0] * pa.n[0] + R[1] * pa.n[1] + R[2] * pa.n[2],
            R[3] * pa.n[0] + R[4] * pa.n[1] + R[5] * pa.n[2],
            R[6] * pa.n[0] + R[7] * pa.n[1] + R[8] * pa.n[2],
          ];
          const rd = pa.d + dot3(rn, t);
          for (const pb of planesB) {
            if (dot3(rn, pb.n) > cosTol && Math.abs(rd - pb.d) < distanceTolerance) {
              score += Math.min(pa.size, pb.size);
              break;
            }
          }
        }
        results.push({ matrix, score });
      }
    }
  }
  results.sort((x, y) => y.score - x.score);
  const distinct = [];
  for (const r of results) {
    if (distinct.some(d => Math.hypot(d.matrix[12] - r.matrix[12], d.matrix[13] - r.matrix[13], d.matrix[14] - r.matrix[14]) < 0.4)) continue;
    distinct.push(r);
    if (distinct.length >= keep) break;
  }
  return distinct;
}
