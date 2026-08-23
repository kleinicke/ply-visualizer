/**
 * Does the raster feature decide whether translation is recoverable?
 *
 * The coarse stage rasterises from above and phase-correlates. Its default cell
 * value is vertical extent, which lights up walls — and makes the image mostly
 * the outline of the room. When two scans both see most of a room, overlaying
 * their outlines centre-on-centre is a strong optimum and the wrong answer.
 *
 * `density` is already implemented and never tried. It counts points, which are
 * denser near the instrument, so unlike verticality it carries a trace of where
 * the scanner actually stood.
 */
import { SYNTHETIC } from './scenes.mjs';
import { createSolver, decimate } from './solver.mjs';
import { mul, inv, gap } from './metrics.mjs';

const scenes = process.argv[2] ? process.argv[2].split(',') : ['hub', 'rooms', 'chain', 'duplicates'];
const tolerance = 0.05;

console.log('recall = share of pairs where SOME coarse candidate, refined, reaches the truth\n');
console.log('scene        feature        pairs  recall  median |t| proposed  vs truth');
for (const name of scenes) {
  const scene = SYNTHETIC[name]();
  for (const feature of ['verticality', 'density']) {
    const solver = createSolver();
    let found = 0, pairs = 0;
    const proposed = [], required = [];
    for (let i = 0; i < scene.ids.length; i++) {
      for (let j = i + 1; j < scene.ids.length; j++) {
        const a = scene.ids[i], b = scene.ids[j];
        const A = decimate(scene.clouds[a], 50000), B = decimate(scene.clouds[b], 50000);
        const coarse = solver.call('coarse', A, B, { upAxis: 'z', feature, candidateCount: 5 });
        if (!coarse?.coarse) continue;
        const truth = mul(inv(scene.gt[b]), scene.gt[a]);
        pairs++;
        required.push(Math.hypot(truth[12], truth[13], truth[14]));
        proposed.push(Math.max(...coarse.coarse.candidates.map(c =>
          Math.hypot(c.matrix[12], c.matrix[13], c.matrix[14]))));
        let hit = false;
        for (const c of coarse.coarse.candidates) {
          const r = solver.call('icp', A, B, { initial: c.matrix, scales: [16, 8, 4, 2, 1] });
          if (r?.icp && gap(r.matrix, truth).t < tolerance) { hit = true; break; }
        }
        if (hit) found++;
      }
    }
    const med = xs => { const s = [...xs].sort((p, q) => p - q); return s.length ? s[s.length >> 1] : 0; };
    console.log(`${name.padEnd(12)} ${feature.padEnd(13)} ${String(pairs).padStart(5)}  ` +
      `${((found / pairs) * 100).toFixed(0).padStart(4)}%  ${med(proposed).toFixed(2).padStart(15)}m  ${med(required).toFixed(2).padStart(7)}m`);
  }
}
