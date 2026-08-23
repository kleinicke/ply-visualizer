/**
 * Edge precision on a real archive, against the operator's verified poses.
 *
 * Synthetic scenes have said edge quality is hopeless. They have also been
 * harder than the real archives every time the two were compared — the real
 * data is dominated by pairs shot from the same or a neighbouring station,
 * which the synthetic scenes barely contain. Whether a pose graph is worth
 * building depends on this number and not on the synthetic one.
 *
 * The reference poses are the current algorithm's output, visually verified by
 * the operator, so this measures gross correctness rather than accuracy — which
 * is exactly what edge precision needs.
 */
import { archive } from './scenes.mjs';
import { truthFor } from './groundtruth/index.mjs';
import { createSolver, decimate, quality } from './solver.mjs';
import { mul, inv, gap } from './metrics.mjs';

const path = process.argv[2];
const budget = Number(process.argv[3] ?? 150000);
const scene = archive(path, budget);
const truth = truthFor(path);
const ids = scene.ids.filter(id => truth?.[id]);
console.log(`${path.split('/').pop()}: ${ids.length} scans with verified poses, ${ids.length * (ids.length - 1) / 2} pairs\n`);

const solver = createSolver();
const rows = [];
for (let i = 0; i < ids.length; i++) {
  for (let j = i + 1; j < ids.length; j++) {
    const a = ids[i], b = ids[j];
    const r = solver.call('register', decimate(scene.clouds[a], budget), decimate(scene.clouds[b], budget), {
      coarse: { upAxis: 'z' }, icp: {},
    });
    if (!r?.icp) continue;
    const expect = mul(inv(truth[b]), truth[a]);
    const err = gap(r.matrix, expect).t;
    rows.push({ a, b, fitness: r.icp.fitness, q: quality(r), err, correct: err < 0.10 });
  }
}
const ok = rows.filter(r => r.correct).length;
console.log(`overall edge precision: ${ok}/${rows.length} = ${((ok / rows.length) * 100).toFixed(0)}%\n`);
console.log('fitness >=   kept   correct   precision');
for (const th of [0, 0.2, 0.3, 0.4, 0.5, 0.6]) {
  const kept = rows.filter(r => r.fitness >= th);
  const c = kept.filter(r => r.correct).length;
  console.log(`${th.toFixed(2).padStart(9)}   ${String(kept.length).padStart(4)}   ${String(c).padStart(7)}   ` +
    `${kept.length ? `${((c / kept.length) * 100).toFixed(0)}%`.padStart(9) : '        -'}` +
    `${kept.length >= ids.length - 1 && c / kept.length >= 0.7 ? '   VIABLE' : ''}`);
}
console.log('\nworst edges:');
for (const r of rows.filter(x => !x.correct).sort((x, y) => y.fitness - x.fitness).slice(0, 6)) {
  console.log(`  ${r.a.slice(-12)} ~ ${r.b.slice(-12)}  fitness ${(r.fitness * 100).toFixed(0)}%  err ${r.err < 1 ? (r.err * 1000).toFixed(0) + 'mm' : r.err.toFixed(1) + 'm'}`);
}
