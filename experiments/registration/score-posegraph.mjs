/**
 * Pose graph on a real archive, scored against the operator's verified poses.
 *
 * Unlike the walk, this has no anchor: it solves every pose at once from the
 * edges it trusts. So there is one run, not one per anchor, and "which anchor
 * you happened to pick" stops being a property of the result.
 */
import { archive } from './scenes.mjs';
import { truthFor } from './groundtruth/index.mjs';
import { poseGraph } from './strategies/poseGraph.mjs';
import { comparePoses } from './metrics.mjs';

const path = process.argv[2];
const budget = Number(process.argv[3] ?? 150000);
const minFitness = Number(process.argv[4] ?? 0.4);

const scene = archive(path, budget);
const truth = truthFor(path);
const known = scene.ids.filter(id => truth?.[id]);
console.log(`${path.split('/').pop()}  ${scene.ids.length} scans, ${known.length} verified, minFitness ${minFitness}\n`);

const t0 = Date.now();
const res = poseGraph(scene, { minFitness, polish: true });
const cmp = comparePoses(res.poses, truth, known, 0.10);
console.log(`edges measured ${res.edges}, weak ${res.weakEdges}, placed ${res.placed.length}/${scene.ids.length}`);
if (res.unplaced.length) console.log(`unplaced: ${res.unplaced.join(', ')}`);
console.log(`pairs correct <100mm: ${(cmp.correct * 100).toFixed(0)}%   mean ${(cmp.mean * 1000).toFixed(0)}mm   worst ${cmp.worst < 1 ? (cmp.worst * 1000).toFixed(0) + 'mm' : cmp.worst.toFixed(2) + 'm'} (${cmp.worstPair})`);
console.log(`total ${((Date.now() - t0) / 1000).toFixed(0)}s, of which pairwise ${(res.measureMs / 1000).toFixed(0)}s, ${res.stats.calls} solver calls`);
