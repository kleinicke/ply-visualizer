/**
 * Pairwise measurement as a *set* of hypotheses rather than one answer.
 *
 * Registering two scans is genuinely multimodal: a room offers several poses
 * that explain the overlap about equally well, and the tallest score is
 * regularly not the true one. Measured on a four-scan synthetic room, the
 * correct pose scored 18 % overlap while a wrong one scored 27 %. Any pipeline
 * that collapses a pair to its best-scoring transform has thrown the answer
 * away before anything global gets a chance to notice.
 *
 * So this returns what the solver actually knows: a shortlist, scored, for
 * somebody else to choose between.
 */

import { quality, decimate } from './solver.mjs';
import { gap } from './metrics.mjs';

/**
 * Coarse levels prepended to the refinement ladder.
 *
 * These are what give ICP its capture range, and it is a much bigger effect
 * than it looks. Refining the same five coarse candidates on the same pair,
 * a ladder of [4,2,1] reached the true pose from none of them, [8,4,2,1] from
 * one, and [16,8,4,2,1] from three. The FFT stage proposes a yaw and almost no
 * translation; the coarse ICP levels are what actually walk the cloud into
 * place, several metres if the ladder lets them.
 */
export const WIDE_LADDER = [16, 8, 4, 2, 1];

export function measurePair(solver, source, target, options = {}) {
  const {
    candidates = 5,
    peaksPerYaw = 1,
    ladder = WIDE_LADDER,
    points = 60000,
    minFitness = 0.05,
    separation = 0.25,
  } = options;

  const A = decimate(source, points);
  const B = decimate(target, points);
  const coarse = solver.call('coarse', A, B, {
    upAxis: 'z',
    candidateCount: candidates,
    peaksPerYaw,
  });
  if (!coarse?.coarse) return [];

  const hypotheses = [];
  for (const candidate of coarse.coarse.candidates) {
    const refined = solver.call('icp', A, B, { initial: candidate.matrix, scales: ladder });
    if (!refined?.icp || refined.icp.fitness < minFitness) continue;
    // Two candidates that converged to the same pose are one hypothesis; the
    // shortlist is only useful if its entries are genuinely different guesses.
    const duplicate = hypotheses.find(h => gap(h.matrix, refined.matrix).t < separation);
    if (duplicate) {
      if (quality(refined) > duplicate.quality) {
        duplicate.matrix = refined.matrix;
        duplicate.quality = quality(refined);
        duplicate.fitness = refined.icp.fitness;
        duplicate.rmse = refined.icp.inlierRmse;
      }
      continue;
    }
    hypotheses.push({
      matrix: refined.matrix,
      quality: quality(refined),
      fitness: refined.icp.fitness,
      rmse: refined.icp.inlierRmse,
      yaw: candidate.yawDegrees,
    });
  }
  hypotheses.sort((a, b) => b.quality - a.quality);
  return hypotheses;
}

/** Every unordered pair, measured. The honest O(n^2) baseline. */
export function measureAll(solver, clouds, ids, options = {}, onProgress) {
  const edges = new Map();
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = ids[i], b = ids[j];
      const list = measurePair(solver, clouds[a], clouds[b], options);
      if (list.length) edges.set(`${a}|${b}`, { a, b, hypotheses: list });
      onProgress?.(a, b, list);
    }
  }
  return edges;
}
