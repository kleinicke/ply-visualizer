/**
 * Global pose-graph registration.
 *
 * The walk strategy commits to one path to every cloud and discards every other
 * edge it measured. That is why a scan at the far end of a chain inherits the
 * error of every hop before it, and why four anchors in the 30 m archive fail
 * identically no matter how the candidate stage is tuned: nothing in the
 * pipeline can notice that a path disagrees with itself.
 *
 * This measures every pair, keeps them all, and solves for the poses that best
 * explain the whole set at once. Edges that cannot be reconciled are down-
 * weighted rather than trusted, which is the line-process idea from Choi, Zhou
 * & Koltun (2015) in its simplest useful form.
 *
 * Rotations first, then translations. Rotation averaging is a small non-linear
 * problem with a good iterative solution; once rotations are fixed the
 * translations are an ordinary weighted least-squares system, so splitting them
 * avoids a full SE(3) Gauss-Newton for no loss of quality at this scale.
 */
import { createSolver, decimate, transform, quality } from '../solver.mjs';
import { IDENT, mul, inv } from '../metrics.mjs';
import { matToQuat, quatToMat, quatMul, quatConj, quatMean, quatAngle, rotateVec } from '../rotation.mjs';

const MAX_POINTS = 400000;
const PAIR_POINTS = 120000;

/** Measure every pair once. This is the honest O(n^2) cost of going global. */
function measureEdges(solver, clouds, ids, options, onEdge) {
  const edges = [];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = ids[i], b = ids[j];
      const r = solver.call('register', clouds[a], clouds[b], {
        coarse: { upAxis: 'z' },
        icp: options.ladder ? { scales: options.ladder } : {},
      });
      if (!r?.icp || r.icp.fitness < options.minFitness) continue;
      const edge = { a, b, Z: r.matrix, q: quality(r), fitness: r.icp.fitness, rmse: r.icp.inlierRmse, w: 1 };
      edges.push(edge);
      onEdge?.(edge);
    }
  }
  return edges;
}

/**
 * Down-weight edges that cannot sit in a consistent triangle.
 *
 * A rigid transform composed around a closed loop must return to identity. An
 * edge that never manages that with any pair of its neighbours is inconsistent
 * with the rest of the graph regardless of how well it scored on its own, and
 * a good score is exactly what a wrong-but-plausible match has.
 */
function cycleConsistency(edges, ids, tolerance) {
  const byPair = new Map(edges.map(e => [`${e.a}|${e.b}`, e]));
  const get = (a, b) => {
    const f = byPair.get(`${a}|${b}`);
    if (f) return f.Z;
    const r = byPair.get(`${b}|${a}`);
    return r ? inv(r.Z) : null;
  };
  const support = new Map(edges.map(e => [e, 0]));
  const trials = new Map(edges.map(e => [e, 0]));
  for (let i = 0; i < ids.length; i++)
    for (let j = i + 1; j < ids.length; j++)
      for (let k = j + 1; k < ids.length; k++) {
        const [x, y, z] = [ids[i], ids[j], ids[k]];
        const Zxy = get(x, y), Zyz = get(y, z), Zzx = get(z, x);
        if (!Zxy || !Zyz || !Zzx) continue;
        // T_x = T_y Zxy, T_y = T_z Zyz, T_z = T_x Zzx  =>  Zzx Zyz Zxy = I
        const loop = mul(mul(Zzx, Zyz), Zxy);
        const drift = Math.hypot(loop[12], loop[13], loop[14]);
        const spin = quatAngle(matToQuat(loop), [1, 0, 0, 0]);
        const ok = drift < tolerance && spin < 3;
        for (const [a, b] of [[x, y], [y, z], [z, x]]) {
          const e = byPair.get(`${a}|${b}`) ?? byPair.get(`${b}|${a}`);
          if (!e) continue;
          trials.set(e, trials.get(e) + 1);
          if (ok) support.set(e, support.get(e) + 1);
        }
      }
  for (const e of edges) {
    const t = trials.get(e), s = support.get(e);
    // An edge nobody could test keeps its own score; an edge that was tested
    // and never closed a triangle is the one to distrust.
    e.support = s;
    e.trials = t;
    e.w = t === 0 ? 0.5 : Math.max(0.02, s / t);
  }
  return edges;
}

/** Maximum spanning tree over edge weight, to seed the optimisation. */
function spanningTreeInit(edges, ids) {
  const poses = Object.fromEntries(ids.map(id => [id, null]));
  const sorted = [...edges].sort((x, y) => (y.w * y.q) - (x.w * x.q));
  const placed = new Set();
  if (!sorted.length) return { poses, placed };
  const root = sorted[0].a;
  poses[root] = IDENT.slice();
  placed.add(root);
  let progress = true;
  while (progress) {
    progress = false;
    for (const e of sorted) {
      if (placed.has(e.a) && !placed.has(e.b)) {
        // T_a = T_b Z  =>  T_b = T_a Z^-1
        poses[e.b] = mul(poses[e.a], inv(e.Z));
        placed.add(e.b); progress = true;
      } else if (placed.has(e.b) && !placed.has(e.a)) {
        poses[e.a] = mul(poses[e.b], e.Z);
        placed.add(e.a); progress = true;
      }
    }
  }
  return { poses, placed };
}

export function poseGraph(scene, options = {}) {
  const {
    minFitness = 0.10,
    cycleTolerance = 0.30,
    rotationIterations = 60,
    translationIterations = 12,
    huber = 0.20,
    polish = true,
    ladder = null,
    onProgress = null,
  } = options;

  const solver = createSolver();
  const ids = scene.ids;
  const full = Object.fromEntries(ids.map(id => [id, decimate(scene.clouds[id], MAX_POINTS)]));
  const small = Object.fromEntries(ids.map(id => [id, decimate(scene.clouds[id], PAIR_POINTS)]));
  const t0 = Date.now();

  const edges = measureEdges(solver, small, ids, { minFitness, ladder }, onProgress);
  const measureMs = Date.now() - t0;
  if (!edges.length) return { poses: {}, placed: [], unplaced: ids, ms: Date.now() - t0, stats: solver.stats, edges: 0 };

  cycleConsistency(edges, ids, cycleTolerance);
  const { poses, placed } = spanningTreeInit(edges, ids);
  const live = edges.filter(e => poses[e.a] && poses[e.b]);

  // --- rotation averaging -------------------------------------------------
  const quats = {};
  for (const id of ids) if (poses[id]) quats[id] = matToQuat(poses[id]);
  const neighbours = new Map(ids.map(id => [id, []]));
  for (const e of live) {
    const qz = matToQuat(e.Z);
    // R_a = R_b Rz  and  R_b = R_a Rz^-1
    neighbours.get(e.a).push({ other: e.b, rel: qz, edge: e });
    neighbours.get(e.b).push({ other: e.a, rel: quatConj(qz), edge: e });
  }
  for (let iter = 0; iter < rotationIterations; iter++) {
    let moved = 0;
    for (const id of ids) {
      const list = neighbours.get(id);
      if (!list?.length || !quats[id]) continue;
      const cands = [], weights = [];
      for (const n of list) {
        if (!quats[n.other]) continue;
        cands.push(quatMul(quats[n.other], n.rel));
        weights.push(n.edge.w * n.edge.q);
      }
      if (!cands.length) continue;
      // Robust: an edge disagreeing with the current estimate by a lot is a
      // wrong edge more often than it is a wrong estimate.
      const current = quats[id];
      const robust = cands.map((c, k) => {
        const dev = quatAngle(current, c);
        return weights[k] / (1 + (dev / 5) ** 2);
      });
      const next = quatMean(cands, robust);
      moved = Math.max(moved, quatAngle(current, next));
      quats[id] = next;
    }
    if (moved < 1e-4) break;
  }

  // --- translation least squares -----------------------------------------
  // R_a = R_b R_z and t_a = R_b t_z + t_b  =>  t_a - t_b = R_b t_z
  const index = ids.filter(id => poses[id]);
  const slot = new Map(index.map((id, i) => [id, i]));
  const n = index.length;
  const t = new Float64Array(n * 3);
  for (const id of index) {
    const s = slot.get(id) * 3;
    t[s] = poses[id][12]; t[s + 1] = poses[id][13]; t[s + 2] = poses[id][14];
  }
  for (let iter = 0; iter < translationIterations; iter++) {
    const A = new Float64Array(n * n).fill(0);
    const rhs = new Float64Array(n * 3).fill(0);
    for (const e of live) {
      const ia = slot.get(e.a), ib = slot.get(e.b);
      if (ia === undefined || ib === undefined) continue;
      const rb = rotateVec(quats[e.b], [e.Z[12], e.Z[13], e.Z[14]]);
      const res = [
        t[ia * 3] - t[ib * 3] - rb[0],
        t[ia * 3 + 1] - t[ib * 3 + 1] - rb[1],
        t[ia * 3 + 2] - t[ib * 3 + 2] - rb[2],
      ];
      const norm = Math.hypot(...res);
      const w = e.w * e.q * (norm <= huber ? 1 : huber / norm);
      A[ia * n + ia] += w; A[ib * n + ib] += w;
      A[ia * n + ib] -= w; A[ib * n + ia] -= w;
      for (let k = 0; k < 3; k++) { rhs[ia * 3 + k] += w * rb[k]; rhs[ib * 3 + k] -= w * rb[k]; }
    }
    // Gauge: pin the first node, otherwise the system is singular by
    // construction — the whole scene can slide freely.
    A[0] += 1e6;
    for (let k = 0; k < 3; k++) rhs[k] += 1e6 * 0;
    // Dense Cholesky-ish solve; n is small.
    const M = Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => A[r * n + c]));
    for (let i = 0; i < n; i++) {
      let p = i;
      for (let k = i + 1; k < n; k++) if (Math.abs(M[k][i]) > Math.abs(M[p][i])) p = k;
      if (p !== i) { [M[i], M[p]] = [M[p], M[i]]; for (let k = 0; k < 3; k++) { const tmp = rhs[i * 3 + k]; rhs[i * 3 + k] = rhs[p * 3 + k]; rhs[p * 3 + k] = tmp; } }
      if (Math.abs(M[i][i]) < 1e-12) continue;
      for (let k = 0; k < n; k++) {
        if (k === i) continue;
        const f = M[k][i] / M[i][i];
        if (!f) continue;
        for (let c = i; c < n; c++) M[k][c] -= f * M[i][c];
        for (let c = 0; c < 3; c++) rhs[k * 3 + c] -= f * rhs[i * 3 + c];
      }
    }
    for (let i = 0; i < n; i++) {
      if (Math.abs(M[i][i]) < 1e-12) continue;
      for (let k = 0; k < 3; k++) t[i * 3 + k] = rhs[i * 3 + k] / M[i][i];
    }
  }

  const out = {};
  for (const id of index) {
    const s = slot.get(id) * 3;
    out[id] = quatToMat(quats[id], [t[s], t[s + 1], t[s + 2]]);
  }

  // --- optional ICP polish against the assembled scene ---------------------
  if (polish && index.length > 2) {
    const union = keys => {
      const parts = keys.map(k => transform(full[k], out[k]));
      const total = parts.reduce((s, p) => s + p.length, 0);
      const stride = Math.max(1, Math.ceil(total / (MAX_POINTS * 3)));
      const buf = new Float32Array(Math.ceil(total / stride) + 3);
      let w = 0;
      for (const part of parts)
        for (let i = 0; i + 2 < part.length && w + 2 < buf.length; i += stride * 3) {
          const b = i - (i % 3);
          buf[w++] = part[b]; buf[w++] = part[b + 1]; buf[w++] = part[b + 2];
        }
      return buf.subarray(0, w - (w % 3));
    };
    for (const id of index) {
      const others = index.filter(o => o !== id);
      if (others.length < 1) continue;
      const r = solver.call('icp', transform(full[id], out[id]), union(others), {});
      if (r?.icp && r.icp.fitness > 0.1) out[id] = mul(r.matrix, out[id]);
    }
  }

  return {
    poses: out,
    placed: index,
    unplaced: ids.filter(id => !out[id]),
    ms: Date.now() - t0,
    measureMs,
    stats: solver.stats,
    edges: edges.length,
    liveEdges: live.length,
    weakEdges: edges.filter(e => e.w < 0.3).length,
  };
}
