/**
 * The optimiser, tested apart from the measurement stage.
 *
 * A pose graph has two independent ways to fail: the edges can be wrong, or the
 * solver can be. Feeding it edges built from known poses — some deliberately
 * corrupted — separates them, so a bad result on a real scene can be attributed
 * rather than guessed at.
 */
import { SYNTHETIC } from './scenes.mjs';
import { mul, inv, comparePoses, IDENT } from './metrics.mjs';
import { matToQuat, quatToMat, quatMul, quatConj, quatMean, quatAngle, rotateVec } from './rotation.mjs';

// Re-implement just the solving half, fed with given edges.
import { readFileSync } from 'fs';
const src = readFileSync(new URL('./strategies/poseGraph.mjs', import.meta.url), 'utf8');

// Extract the pure functions by re-importing the module and calling the parts
// through a shim: simplest is to duplicate the solve here in miniature.
/**
 * Solve, then throw away the edges the solution cannot explain, then solve
 * again on a tighter tolerance.
 *
 * Reweighting alone tolerates about a tenth of the edges being wrong, which is
 * far below what real scenes deliver. Rejecting outright is what raises that,
 * and the tolerance has to start loose: a wrong edge and a merely
 * badly-initialised one look identical on the first round, so an aggressive
 * first cut removes good edges and locks in a bad answer.
 */
function solveRobust(edges, ids, opts = {}) {
  const { rounds = 6, startTolerance = 4.0, endTolerance = 0.10 } = opts;
  let live = edges.map(e => ({ ...e, w: e.w ?? 1 }));
  let poses = null;
  for (let round = 0; round < rounds; round++) {
    poses = solve(live.filter(e => e.w > 0.01), ids, opts);
    const ratio = rounds === 1 ? 1 : round / (rounds - 1);
    const tol = startTolerance * Math.pow(endTolerance / startTolerance, ratio);
    const scored = [];
    for (const e of live) {
      if (!poses[e.a] || !poses[e.b]) { e.w = 0; e.residual = Infinity; continue; }
      // Residual of the edge against the current solution: T_a should equal
      // T_b Z.
      const predicted = mul(poses[e.b], e.Z);
      const d = Math.hypot(
        predicted[12] - poses[e.a][12],
        predicted[13] - poses[e.a][13],
        predicted[14] - poses[e.a][14]
      );
      const spin = quatAngle(matToQuat(predicted), matToQuat(poses[e.a]));
      e.residual = d + spin * 0.02;
      scored.push(e);
    }
    scored.sort((x, y) => x.residual - y.residual);
    // Rejection is capped, not just thresholded. A round that tightens past
    // what the graph can spare leaves fewer edges than nodes, and the next
    // solve is then fitting a scene it cannot constrain — which looks exactly
    // like a good fit and is not one.
    const floor = Math.min(scored.length, Math.ceil((ids.length - 1) * 1.6));
    scored.forEach((e, rank) => {
      const withinTolerance = e.residual <= tol;
      e.w = (withinTolerance || rank < floor) ? 1 : 0;
    });
  }
  return { poses, live };
}

function solve(edges, ids, opts = {}) {
  const { rotationIterations = 80, translationIterations = 15, huber = 0.2 } = opts;
  const byPair = new Map(edges.map(e => [`${e.a}|${e.b}`, e]));
  // spanning tree
  const poses = Object.fromEntries(ids.map(id => [id, null]));
  const sorted = [...edges].sort((x, y) => (y.w ?? 1) - (x.w ?? 1));
  poses[sorted[0].a] = IDENT.slice();
  const placed = new Set([sorted[0].a]);
  let progress = true;
  while (progress) {
    progress = false;
    for (const e of sorted) {
      if (placed.has(e.a) && !placed.has(e.b)) { poses[e.b] = mul(poses[e.a], inv(e.Z)); placed.add(e.b); progress = true; }
      else if (placed.has(e.b) && !placed.has(e.a)) { poses[e.a] = mul(poses[e.b], e.Z); placed.add(e.a); progress = true; }
    }
  }
  const index = ids.filter(id => poses[id]);
  const quats = {}; for (const id of index) quats[id] = matToQuat(poses[id]);
  const nb = new Map(index.map(id => [id, []]));
  const live = edges.filter(e => poses[e.a] && poses[e.b]);
  for (const e of live) {
    const qz = matToQuat(e.Z);
    nb.get(e.a).push({ other: e.b, rel: qz, w: e.w ?? 1 });
    nb.get(e.b).push({ other: e.a, rel: quatConj(qz), w: e.w ?? 1 });
  }
  for (let it = 0; it < rotationIterations; it++) {
    let moved = 0;
    for (const id of index) {
      const list = nb.get(id); if (!list.length) continue;
      const c = [], w = [];
      for (const x of list) { c.push(quatMul(quats[x.other], x.rel)); w.push(x.w); }
      const cur = quats[id];
      const robust = c.map((q, k) => w[k] / (1 + (quatAngle(cur, q) / 5) ** 2));
      const next = quatMean(c, robust);
      moved = Math.max(moved, quatAngle(cur, next));
      quats[id] = next;
    }
    if (moved < 1e-5) break;
  }
  const slot = new Map(index.map((id, i) => [id, i]));
  const n = index.length;
  const t = new Float64Array(n * 3);
  for (const id of index) { const s = slot.get(id) * 3; t[s] = poses[id][12]; t[s + 1] = poses[id][13]; t[s + 2] = poses[id][14]; }
  for (let it = 0; it < translationIterations; it++) {
    const A = new Float64Array(n * n); const rhs = new Float64Array(n * 3);
    for (const e of live) {
      const ia = slot.get(e.a), ib = slot.get(e.b);
      const rb = rotateVec(quats[e.b], [e.Z[12], e.Z[13], e.Z[14]]);
      const res = [t[ia * 3] - t[ib * 3] - rb[0], t[ia * 3 + 1] - t[ib * 3 + 1] - rb[1], t[ia * 3 + 2] - t[ib * 3 + 2] - rb[2]];
      const norm = Math.hypot(...res);
      const w = (e.w ?? 1) * (norm <= huber ? 1 : huber / norm);
      A[ia * n + ia] += w; A[ib * n + ib] += w; A[ia * n + ib] -= w; A[ib * n + ia] -= w;
      for (let k = 0; k < 3; k++) { rhs[ia * 3 + k] += w * rb[k]; rhs[ib * 3 + k] -= w * rb[k]; }
    }
    A[0] += 1e6;
    const M = Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => A[r * n + c]));
    for (let i = 0; i < n; i++) {
      let p = i; for (let k = i + 1; k < n; k++) if (Math.abs(M[k][i]) > Math.abs(M[p][i])) p = k;
      if (p !== i) { [M[i], M[p]] = [M[p], M[i]]; for (let k = 0; k < 3; k++) { const tmp = rhs[i * 3 + k]; rhs[i * 3 + k] = rhs[p * 3 + k]; rhs[p * 3 + k] = tmp; } }
      if (Math.abs(M[i][i]) < 1e-12) continue;
      for (let k = 0; k < n; k++) {
        if (k === i) continue;
        const f = M[k][i] / M[i][i]; if (!f) continue;
        for (let c = i; c < n; c++) M[k][c] -= f * M[i][c];
        for (let c = 0; c < 3; c++) rhs[k * 3 + c] -= f * rhs[i * 3 + c];
      }
    }
    for (let i = 0; i < n; i++) { if (Math.abs(M[i][i]) < 1e-12) continue; for (let k = 0; k < 3; k++) t[i * 3 + k] = rhs[i * 3 + k] / M[i][i]; }
  }
  const out = {};
  for (const id of index) { const s = slot.get(id) * 3; out[id] = quatToMat(quats[id], [t[s], t[s + 1], t[s + 2]]); }
  return out;
}

const scene = SYNTHETIC.loop();
const ids = scene.ids;
let seed = 99;
const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

console.log('Optimiser fed edges built from known poses. Corrupting a share of them\nto see how many wrong edges it survives.\n');
console.log('corrupt   noise    edges   correct     worst   surviving edges');
for (const corrupt of [0, 0.1, 0.2, 0.3, 0.5, 0.7]) {
  for (const noise of [0, 0.01]) {
    const edges = [];
    for (let i = 0; i < ids.length; i++)
      for (let j = i + 1; j < ids.length; j++) {
        const a = ids[i], b = ids[j];
        let Z = mul(inv(scene.gt[b]), scene.gt[a]);
        if (noise) Z = Z.map((v, k) => (k >= 12 && k < 15 ? v + (rand() - 0.5) * noise : v));
        if (rand() < corrupt) {
          const ang = rand() * Math.PI * 2, c = Math.cos(ang), s = Math.sin(ang);
          Z = [c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, (rand() - 0.5) * 20, (rand() - 0.5) * 20, 0, 1];
        }
        edges.push({ a, b, Z, w: 1, q: 1 });
      }
    const { poses, live } = solveRobust(edges, ids);
    const cmp = comparePoses(poses, scene.gt, ids, 0.05);
    const survived = live.filter(e => e.w > 0.01).length;
    console.log(`${(corrupt * 100).toFixed(0).padStart(6)}%  ${noise ? '1cm' : ' none'}   ${String(edges.length).padStart(5)}   ${(cmp.correct * 100).toFixed(0).padStart(6)}%   ${(cmp.worst < 1 ? (cmp.worst * 1000).toFixed(0) + 'mm' : cmp.worst.toFixed(2) + 'm').padStart(8)}   kept ${survived}/${edges.length}`);
  }
}
