/**
 * Scores a real archive against the operator's surveyed registration.
 *
 * Frame-free over whatever subset of scans has truth, so a partial survey still
 * scores a full run.
 */
import { archive } from './scenes.mjs';
import { truthFor } from './groundtruth/index.mjs';
import { anchorWalk } from './strategies/anchorWalk.mjs';
import { comparePoses } from './metrics.mjs';

const path = process.argv[2];
const budget = Number(process.argv[3] ?? 250000);
const windowFactor = process.argv[4] ? Number(process.argv[4]) : null;
const ladder = process.argv[5] ? process.argv[5].split(',').map(Number) : null;

const scene = archive(path, budget);
const truth = truthFor(path);
const known = scene.ids.filter(id => truth?.[id]);
console.log(`${path.split('/').pop()}  ${scene.ids.length} scans, ${known.length} with truth` +
  `${windowFactor ? `, windowFactor ${windowFactor}` : ''}${ladder ? `, ladder [${ladder}]` : ''}\n`);
console.log('anchor                              placed  correct<50mm   mean      worst    time');

let bestWorst = Infinity, worstWorst = 0, sumCorrect = 0, runs = 0;
for (const anchor of scene.ids) {
  const res = anchorWalk(scene, anchor, { windowFactor, ladder });
  const cmp = comparePoses(res.poses, truth, known, 0.05);
  sumCorrect += cmp.correct; runs++;
  bestWorst = Math.min(bestWorst, cmp.worst); worstWorst = Math.max(worstWorst, cmp.worst);
  console.log(`${anchor.padEnd(34)} ${String(res.placed.length).padStart(2)}/${String(scene.ids.length).padEnd(3)} ` +
    `${(cmp.correct * 100).toFixed(0).padStart(9)}%  ${(cmp.mean * 1000).toFixed(0).padStart(7)}mm ` +
    `${(cmp.worst * 1000).toFixed(0).padStart(8)}mm ${(res.ms / 1000).toFixed(0).padStart(5)}s`);
}
console.log(`\nmean correct ${(sumCorrect / runs * 100).toFixed(0)}%, worst error ${bestWorst < 1 ? (bestWorst * 1000).toFixed(0) + 'mm' : bestWorst.toFixed(2) + 'm'} (best anchor) to ${worstWorst < 1 ? (worstWorst * 1000).toFixed(0) + 'mm' : worstWorst.toFixed(2) + 'm'} (worst)`);
