/**
 * Success rate as a function of how much a pair actually shares.
 *
 * "60-80% of edges are wrong" has been the headline objection to going global,
 * and it counts every pair in the scene — including the ones at opposite ends
 * of a corridor that share nothing and should never have been edges. That is
 * the wrong denominator. A pose graph does not need every pair to be right; it
 * needs the pairs it *keeps* to be right.
 *
 * So: bucket pairs by their true shared surface, and measure success within
 * each bucket. If overlapping pairs succeed and the failures are all pairs that
 * never overlapped, then the problem was never edge quality — it is edge
 * selection, which is a much cheaper problem.
 */
import { SYNTHETIC } from './scenes.mjs';
import { createSolver, decimate, transform, quality } from './solver.mjs';
import { mul, inv, gap } from './metrics.mjs';

const scenes = (process.argv[2] ?? 'hub,rooms,chain,loop,duplicates').split(',');
const LADDER = process.argv[3] ? process.argv[3].split(',').map(Number) : null;

function overlapAtTruth(scene, a, b, cell = 0.1) {
  const occ = p => {
    const s = new Set();
    for (let i = 0; i < p.length; i += 3) s.add(`${Math.floor(p[i] / cell)},${Math.floor(p[i + 1] / cell)},${Math.floor(p[i + 2] / cell)}`);
    return s;
  };
  const A = occ(transform(scene.clouds[a], scene.gt[a]));
  const B = occ(transform(scene.clouds[b], scene.gt[b]));
  let hits = 0;
  for (const v of A) if (B.has(v)) hits++;
  return hits / Math.min(A.size, B.size);
}

const buckets = [[0, 0.1], [0.1, 0.2], [0.2, 0.3], [0.3, 0.5], [0.5, 1.01]];
const totals = buckets.map(() => ({ n: 0, ok: 0 }));

for (const name of scenes) {
  const scene = SYNTHETIC[name]();
  const solver = createSolver();
  const rows = buckets.map(() => ({ n: 0, ok: 0 }));
  for (let i = 0; i < scene.ids.length; i++) {
    for (let j = i + 1; j < scene.ids.length; j++) {
      const a = scene.ids[i], b = scene.ids[j];
      const ov = overlapAtTruth(scene, a, b);
      const bi = buckets.findIndex(([lo, hi]) => ov >= lo && ov < hi);
      if (bi < 0) continue;
      const A = decimate(scene.clouds[a], 120000), B = decimate(scene.clouds[b], 120000);
      const truth = mul(inv(scene.gt[b]), scene.gt[a]);
      const r = solver.call('register', A, B, {
        coarse: { upAxis: 'z' }, icp: LADDER ? { scales: LADDER } : {},
      });
      const ok = r?.icp && gap(r.matrix, truth).t < 0.05;
      rows[bi].n++; totals[bi].n++;
      if (ok) { rows[bi].ok++; totals[bi].ok++; }
    }
  }
  console.log(`${name.padEnd(11)} ` + rows.map((r, k) =>
    `${(buckets[k][0] * 100).toFixed(0)}-${(buckets[k][1] * 100).toFixed(0)}%: ${r.n ? `${r.ok}/${r.n}` : ' - '}`).join('   '));
}
console.log('\noverlap bucket   pairs   registered correctly');
for (let k = 0; k < buckets.length; k++) {
  const t = totals[k];
  console.log(`${(buckets[k][0] * 100).toFixed(0).padStart(6)}-${(buckets[k][1] * 100).toFixed(0)}%  ${String(t.n).padStart(7)}   ${t.n ? `${((t.ok / t.n) * 100).toFixed(0)}%` : '-'}`);
}
