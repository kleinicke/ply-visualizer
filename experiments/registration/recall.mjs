/**
 * Does the shortlist contain the right answer at all?
 *
 * Every selection idea downstream — cycle consistency, pose graphs, robust
 * weighting — can only choose among what the pairwise stage proposed. If the
 * true transform is not on the shortlist, no selector can recover it, and work
 * spent on selection is wasted. So the first question any of this has to answer
 * is recall, separately from precision.
 */
import { SYNTHETIC } from './scenes.mjs';
import { createSolver } from './solver.mjs';
import { measurePair } from './pairwise.mjs';
import { mul, inv, gap } from './metrics.mjs';

const tolerance = 0.05;
const scenes = process.argv[2] ? [process.argv[2]] : Object.keys(SYNTHETIC);
const options = {};
if (process.argv[3]) options.ladder = process.argv[3].split(',').map(Number);
if (process.argv[4]) options.candidates = Number(process.argv[4]);
if (process.argv[5]) options.peaksPerYaw = Number(process.argv[5]);

console.log(`ladder=[${(options.ladder ?? [16, 8, 4, 2, 1]).join(',')}] candidates=${options.candidates ?? 5} peaksPerYaw=${options.peaksPerYaw ?? 1}\n`);
console.log('scene        edges  recall  rank1  mean hyps  overlap of true edges   time');
for (const name of scenes) {
  const scene = SYNTHETIC[name]();
  const solver = createSolver();
  const t0 = Date.now();
  let edges = 0, present = 0, rank1 = 0, hyps = 0;
  for (let i = 0; i < scene.ids.length; i++) {
    for (let j = i + 1; j < scene.ids.length; j++) {
      const a = scene.ids[i], b = scene.ids[j];
      const list = measurePair(solver, scene.clouds[a], scene.clouds[b], options);
      const truth = mul(inv(scene.gt[b]), scene.gt[a]);
      const idx = list.findIndex(h => gap(h.matrix, truth).t < tolerance);
      edges++; hyps += list.length;
      if (idx >= 0) present++;
      if (idx === 0) rank1++;
    }
  }
  const pct = v => `${(v * 100).toFixed(0).padStart(3)}%`;
  console.log(`${name.padEnd(12)} ${String(edges).padStart(5)}  ${pct(present / edges)}  ${pct(rank1 / edges)}  ` +
    `${(hyps / edges).toFixed(1).padStart(8)}   ${''.padStart(20)} ${((Date.now() - t0) / 1000).toFixed(0).padStart(5)}s`);
}
