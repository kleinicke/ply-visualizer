/**
 * Do two candidate generators fail on the same pairs, or different ones?
 *
 * They cost very differently. The FFT sweep is per-pair and dominates an
 * all-pairs stage; plane extraction is per-cloud and its matching is free.
 * If they fail independently, using both is close to a free improvement in
 * recall — and recall is the thing standing between here and a pose graph.
 */
import { SYNTHETIC } from './scenes.mjs';
import { createSolver, decimate } from './solver.mjs';
import { extractPlanes, matchPlanes } from './planes.mjs';
import { mul, inv, gap } from './metrics.mjs';

const tolerance = 0.05;
const scenes = (process.argv[2] ?? 'hub,rooms,chain').split(',');
const LADDER = [16, 8, 4, 2, 1];

for (const name of scenes) {
  const scene = SYNTHETIC[name]();
  const solver = createSolver();
  const planes = {};
  const tPlanes = Date.now();
  for (const id of scene.ids) planes[id] = extractPlanes(scene.clouds[id]);
  const planeExtractMs = Date.now() - tPlanes;

  let n = 0, fftOnly = 0, planeOnly = 0, either = 0, both = 0;
  let fftMs = 0, planeMs = 0;
  for (let i = 0; i < scene.ids.length; i++) {
    for (let j = i + 1; j < scene.ids.length; j++) {
      const a = scene.ids[i], b = scene.ids[j];
      const A = decimate(scene.clouds[a], 50000), B = decimate(scene.clouds[b], 50000);
      const truth = mul(inv(scene.gt[b]), scene.gt[a]);
      const reaches = candidates => {
        for (const c of candidates) {
          const r = solver.call('icp', A, B, { initial: c.matrix, scales: LADDER });
          if (r?.icp && gap(r.matrix, truth).t < tolerance) return true;
        }
        return false;
      };
      let t0 = Date.now();
      const coarse = solver.call('coarse', A, B, {
        upAxis: 'z', candidateCount: 6, windowFactor: 5, resolution: 64,
      });
      const fftHit = coarse?.coarse ? reaches(coarse.coarse.candidates) : false;
      fftMs += Date.now() - t0;

      t0 = Date.now();
      const planeCands = matchPlanes(planes[a], planes[b]);
      const planeHit = reaches(planeCands);
      planeMs += Date.now() - t0;

      n++;
      if (fftHit && planeHit) both++;
      if (fftHit && !planeHit) fftOnly++;
      if (!fftHit && planeHit) planeOnly++;
      if (fftHit || planeHit) either++;
    }
  }
  const pct = v => `${((v / n) * 100).toFixed(0).padStart(3)}%`;
  console.log(`${name.padEnd(7)} ${String(n).padStart(3)} pairs   ` +
    `fft ${pct(both + fftOnly)}  planes ${pct(both + planeOnly)}  ` +
    `either ${pct(either)}   (fft-only ${fftOnly}, plane-only ${planeOnly}, both ${both})   ` +
    `fft ${(fftMs / 1000).toFixed(0)}s  planes ${((planeMs + planeExtractMs) / 1000).toFixed(0)}s`);
}
