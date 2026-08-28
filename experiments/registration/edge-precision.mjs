/**
 * Can the solver tell its own good edges from its bad ones?
 *
 * A pose graph tolerates about 30% wrong edges. The measured success rate over
 * all pairs is far below that — but the graph does not have to keep every pair.
 * If the solver's reported fitness separates correct edges from wrong ones,
 * then filtering on it yields a clean set and the global stage becomes viable
 * without any improvement to registration itself.
 *
 * This is the same question as "does score predict correctness", asked once
 * before at the level of a single pair and answered no. Asked here as a
 * threshold over many pairs, the useful quantity is different: not whether the
 * best-scoring pose is right, but whether a high enough score is *reliably*
 * right.
 */
import { SYNTHETIC } from './scenes.mjs';
import { createSolver, decimate, quality } from './solver.mjs';
import { mul, inv, gap } from './metrics.mjs';

const scenes = (process.argv[2] ?? 'hub,rooms,chain,duplicates,loop').split(',');
const rows = [];
for (const name of scenes) {
  const scene = SYNTHETIC[name]();
  const solver = createSolver();
  for (let i = 0; i < scene.ids.length; i++) {
    for (let j = i + 1; j < scene.ids.length; j++) {
      const a = scene.ids[i], b = scene.ids[j];
      const A = decimate(scene.clouds[a], 120000), B = decimate(scene.clouds[b], 120000);
      const truth = mul(inv(scene.gt[b]), scene.gt[a]);
      const r = solver.call('register', A, B, { coarse: { upAxis: 'z' }, icp: {} });
      if (!r?.icp) continue;
      rows.push({
        scene: name,
        fitness: r.icp.fitness,
        rmse: r.icp.inlierRmse,
        q: quality(r),
        correct: gap(r.matrix, truth).t < 0.05,
      });
    }
  }
}

console.log(`${rows.length} measured edges across ${scenes.length} scenes\n`);
console.log('fitness >=   edges kept   correct   precision   (pose graph needs >=70%)');
for (const th of [0, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7]) {
  const kept = rows.filter(r => r.fitness >= th);
  const ok = kept.filter(r => r.correct).length;
  console.log(`${th.toFixed(2).padStart(9)}   ${String(kept.length).padStart(10)}   ${String(ok).padStart(7)}   ` +
    `${kept.length ? `${((ok / kept.length) * 100).toFixed(0)}%`.padStart(9) : '        -'}` +
    `${kept.length && ok / kept.length >= 0.7 ? '   VIABLE' : ''}`);
}
console.log('\nsame, on the combined quality score:');
console.log('quality >=   edges kept   correct   precision');
const qs = rows.map(r => r.q).sort((a, b) => a - b);
for (const p of [0, 0.25, 0.5, 0.7, 0.85]) {
  const th = qs[Math.floor(p * (qs.length - 1))];
  const kept = rows.filter(r => r.q >= th);
  const ok = kept.filter(r => r.correct).length;
  console.log(`${th.toFixed(3).padStart(9)}   ${String(kept.length).padStart(10)}   ${String(ok).padStart(7)}   ` +
    `${kept.length ? `${((ok / kept.length) * 100).toFixed(0)}%`.padStart(9) : '        -'}`);
}
