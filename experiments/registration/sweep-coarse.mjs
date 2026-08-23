/**
 * Grid search over the coarse stage's own parameters.
 *
 * Before replacing the candidate generator with something more elaborate, it is
 * worth knowing whether the existing one is simply configured too tightly.
 */
import { SYNTHETIC } from './scenes.mjs';
import { createSolver, decimate } from './solver.mjs';
import { mul, inv, gap } from './metrics.mjs';

const scenes = (process.argv[2] ?? 'hub,rooms').split(',');
const tolerance = 0.05;
const grid = [];
for (const windowFactor of [5.0, 8.0, 12.0]) {
  for (const resolution of [64, 128]) {
    for (const feature of ['verticality', 'density']) {
      grid.push({ windowFactor, resolution, feature });
    }
  }
}

for (const name of scenes) {
  const scene = SYNTHETIC[name]();
  console.log(`\n### ${name} — ${scene.ids.length} clouds`);
  console.log('window  res  feature       recall  median |t| proposed  time');
  for (const config of grid) {
    const solver = createSolver();
    const t0 = Date.now();
    let found = 0, pairs = 0;
    const proposed = [];
    for (let i = 0; i < scene.ids.length; i++) {
      for (let j = i + 1; j < scene.ids.length; j++) {
        const a = scene.ids[i], b = scene.ids[j];
        const A = decimate(scene.clouds[a], 50000), B = decimate(scene.clouds[b], 50000);
        const coarse = solver.call('coarse', A, B, {
          upAxis: 'z', candidateCount: 6,
          windowFactor: config.windowFactor,
          resolution: config.resolution,
          feature: config.feature,
        });
        if (!coarse?.coarse) continue;
        pairs++;
        const truth = mul(inv(scene.gt[b]), scene.gt[a]);
        proposed.push(Math.max(...coarse.coarse.candidates.map(c =>
          Math.hypot(c.matrix[12], c.matrix[13], c.matrix[14]))));
        for (const c of coarse.coarse.candidates) {
          const r = solver.call('icp', A, B, { initial: c.matrix, scales: [16, 8, 4, 2, 1] });
          if (r?.icp && gap(r.matrix, truth).t < tolerance) { found++; break; }
        }
      }
    }
    const med = xs => { const s = [...xs].sort((p, q) => p - q); return s.length ? s[s.length >> 1] : 0; };
    console.log(`${String(config.windowFactor).padStart(6)} ${String(config.resolution).padStart(4)}  ${config.feature.padEnd(12)} ` +
      `${((found / pairs) * 100).toFixed(0).padStart(5)}%  ${med(proposed).toFixed(2).padStart(15)}m  ${((Date.now() - t0) / 1000).toFixed(0).padStart(4)}s`);
  }
}
