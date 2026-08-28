/**
 * The question that actually matters: is the solvable graph connected?
 *
 * Recall has been the headline number, and it is the wrong one. A pose graph
 * does not need every pair — it needs enough correct edges to reach every
 * cloud, plus a few spare to close loops with. 40% recall spread evenly over a
 * scene is a solved scene; 80% concentrated in one clique is not.
 *
 * This also asks whether the pairs that fail are the pairs that *should* fail:
 * if the unsolvable edges are the ones with almost no shared surface, then the
 * generator is close to the ceiling the data allows and the work belongs
 * downstream instead.
 */
import { SYNTHETIC } from './scenes.mjs';
import { createSolver, decimate, transform } from './solver.mjs';
import { mul, inv, gap } from './metrics.mjs';

const LADDER = [16, 8, 4, 2, 1];
const scenes = (process.argv[2] ?? 'hub,rooms,chain,loop,duplicates').split(',');

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

for (const name of scenes) {
  const scene = SYNTHETIC[name]();
  const solver = createSolver();
  const solved = [], failed = [];
  for (let i = 0; i < scene.ids.length; i++) {
    for (let j = i + 1; j < scene.ids.length; j++) {
      const a = scene.ids[i], b = scene.ids[j];
      const A = decimate(scene.clouds[a], 50000), B = decimate(scene.clouds[b], 50000);
      const truth = mul(inv(scene.gt[b]), scene.gt[a]);
      const coarse = solver.call('coarse', A, B, { upAxis: 'z', candidateCount: 6, windowFactor: 5, resolution: 64 });
      let hit = false;
      for (const c of (coarse?.coarse?.candidates ?? [])) {
        const r = solver.call('icp', A, B, { initial: c.matrix, scales: LADDER });
        if (r?.icp && gap(r.matrix, truth).t < 0.05) { hit = true; break; }
      }
      const ov = overlapAtTruth(scene, a, b);
      (hit ? solved : failed).push({ a, b, ov });
    }
  }
  // Connected components over the solved edges.
  const parent = Object.fromEntries(scene.ids.map(id => [id, id]));
  const find = x => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  for (const e of solved) parent[find(e.a)] = find(e.b);
  const comps = new Map();
  for (const id of scene.ids) {
    const r = find(id);
    comps.set(r, (comps.get(r) ?? []).concat(id));
  }
  const sizes = [...comps.values()].map(c => c.length).sort((a, b) => b - a);
  const med = xs => { const s = xs.map(e => e.ov).sort((p, q) => p - q); return s.length ? s[s.length >> 1] : 0; };
  const spare = solved.length - (scene.ids.length - comps.size);
  console.log(`${name.padEnd(11)} ${String(scene.ids.length).padStart(2)} clouds  ` +
    `solved ${String(solved.length).padStart(3)}/${String(solved.length + failed.length).padEnd(3)}  ` +
    `components ${comps.size} ${JSON.stringify(sizes)}  ` +
    `spare edges ${String(spare).padStart(3)}  ` +
    `median overlap solved ${(med(solved) * 100).toFixed(0)}% vs failed ${(med(failed) * 100).toFixed(0)}%  ` +
    `${comps.size === 1 ? 'CONNECTED' : 'SPLIT'}`);
}
