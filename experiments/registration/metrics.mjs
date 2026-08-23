/**
 * Scoring, deliberately frame-free.
 *
 * A set of poses is only ever determined up to a global rigid transform, so
 * comparing matrices directly needs an alignment step that can itself go wrong
 * and hide errors. The relative pose of two clouds does not depend on the
 * frame, so comparing those needs no alignment and cannot flatter the result.
 *
 * The same function scores against ground truth (synthetic scenes) and against
 * a second run (real archives, where no ground truth exists) — which is what
 * makes the two kinds of scene comparable at all.
 */

export const IDENT = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

export function mul(A, B) {
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += A[k * 4 + r] * B[c * 4 + k];
      o[c * 4 + r] = s;
    }
  return o;
}

export function inv(M) {
  const r = [M[0], M[1], M[2], M[4], M[5], M[6], M[8], M[9], M[10]];
  const t = [M[12], M[13], M[14]];
  const o = [r[0], r[3], r[6], 0, r[1], r[4], r[7], 0, r[2], r[5], r[8], 0, 0, 0, 0, 1];
  o[12] = -(r[0] * t[0] + r[1] * t[1] + r[2] * t[2]);
  o[13] = -(r[3] * t[0] + r[4] * t[1] + r[5] * t[2]);
  o[14] = -(r[6] * t[0] + r[7] * t[1] + r[8] * t[2]);
  return o;
}

export const relative = (T, a, b) => mul(inv(T[a]), T[b]);

/** Translation and rotation gap between two rigid transforms. */
export function gap(A, B) {
  const D = mul(inv(A), B);
  const trace = D[0] + D[5] + D[10];
  const angle = Math.acos(Math.max(-1, Math.min(1, (trace - 1) / 2))) * 180 / Math.PI;
  return { t: Math.hypot(D[12], D[13], D[14]), r: angle };
}

/**
 * Compares two pose sets over every pair they share.
 *
 * `tolerance` is in scene units; `correct` is the share of pairs inside it,
 * which is the number that says whether a scene came out usable rather than
 * how bad its worst corner is.
 */
export function comparePoses(a, b, ids, tolerance = 0.05) {
  const shared = ids.filter(id => a[id] && b[id]);
  let worst = 0, sum = 0, ok = 0, n = 0, worstPair = null;
  const rot = [];
  for (let i = 0; i < shared.length; i++)
    for (let j = i + 1; j < shared.length; j++) {
      const g = gap(relative(a, shared[i], shared[j]), relative(b, shared[i], shared[j]));
      n++; sum += g.t; rot.push(g.r);
      if (g.t <= tolerance) ok++;
      if (g.t > worst) { worst = g.t; worstPair = `${shared[i]}~${shared[j]}`; }
    }
  rot.sort((x, y) => x - y);
  return {
    pairs: n,
    shared: shared.length,
    mean: n ? sum / n : 0,
    worst,
    worstPair,
    correct: n ? ok / n : 0,
    medianRotation: rot.length ? rot[rot.length >> 1] : 0,
  };
}

/** One line per run, so a table of experiments stays readable. */
export function summarise(name, scene, result, reference, tolerance = 0.05) {
  const placed = result.placed.length;
  const total = scene.ids.length;
  const cmp = reference ? comparePoses(result.poses, reference, scene.ids, tolerance) : null;
  return {
    strategy: name,
    placed,
    total,
    completeness: placed / total,
    correct: cmp ? cmp.correct : null,
    mean: cmp ? cmp.mean : null,
    worst: cmp ? cmp.worst : null,
    worstPair: cmp ? cmp.worstPair : null,
    ms: result.ms,
    calls: result.stats?.calls ?? 0,
  };
}

export function formatRow(s) {
  const pct = v => (v === null ? '   -  ' : `${(v * 100).toFixed(0).padStart(4)}%`);
  const mm = v => (v === null ? '    -   ' : v < 1 ? `${(v * 1000).toFixed(0).padStart(6)}mm` : `${v.toFixed(2).padStart(6)}m `);
  return `${s.strategy.padEnd(16)} ${String(s.placed).padStart(2)}/${String(s.total).padEnd(3)} ` +
    `correct ${pct(s.correct)}  mean ${mm(s.mean)}  worst ${mm(s.worst)}  ` +
    `${(s.ms / 1000).toFixed(1).padStart(6)}s ${String(s.calls).padStart(4)} calls`;
}
