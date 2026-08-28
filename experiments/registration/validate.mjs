/**
 * What a scene is actually asking of a solver, before any solving happens.
 *
 * Twice while building this suite I drew conclusions from a scene that was
 * harder than I intended — an empty rectangular room that maps onto itself
 * under a 180-degree turn, and a corridor so featureless that stacking two
 * scans on top of each other scores better than placing them correctly. Both
 * looked like solver failures and were scene-design failures.
 *
 * So every scene reports its own difficulty first: how much of each pair is
 * genuinely shared at ground truth, and how well each cloud's own geometry
 * pins its position down. A scene whose pairs share nothing is not a hard test,
 * it is an impossible one, and the difference has to be visible up front.
 */
import { transform, createSolver } from './solver.mjs';

function occupancy(points, cell) {
  const set = new Set();
  for (let i = 0; i < points.length; i += 3) {
    set.add(`${Math.floor(points[i] / cell)},${Math.floor(points[i + 1] / cell)},${Math.floor(points[i + 2] / cell)}`);
  }
  return set;
}

export function describe(scene, cell = 0.1) {
  if (!scene.gt) return null;
  const solver = createSolver();
  const world = {}, occ = {}, cond = {};
  for (const id of scene.ids) {
    world[id] = transform(scene.clouds[id], scene.gt[id]);
    occ[id] = occupancy(world[id], cell);
    cond[id] = solver.conditioning(scene.clouds[id]);
  }
  const pairs = [];
  for (let i = 0; i < scene.ids.length; i++) {
    for (let j = i + 1; j < scene.ids.length; j++) {
      const a = scene.ids[i], b = scene.ids[j];
      let hits = 0;
      for (const v of occ[a]) if (occ[b].has(v)) hits++;
      // Symmetric: the share of the smaller cloud that is shared, which is what
      // decides whether a pair is registrable at all.
      const overlap = hits / Math.min(occ[a].size, occ[b].size);
      pairs.push({ a, b, overlap });
    }
  }
  const usable = pairs.filter(p => p.overlap >= 0.2);
  return { pairs, cond, usable: usable.length, total: pairs.length };
}

export function report(name, scene) {
  const d = describe(scene);
  if (!d) { console.log(`${name}: real archive, no ground truth`); return; }
  const slides = scene.ids.filter(id => d.cond[id] < 0.08);
  const best = new Map(scene.ids.map(id => [id, 0]));
  for (const p of d.pairs) {
    best.set(p.a, Math.max(best.get(p.a), p.overlap));
    best.set(p.b, Math.max(best.get(p.b), p.overlap));
  }
  const orphans = scene.ids.filter(id => best.get(id) < 0.2);
  console.log(`${name.padEnd(12)} ${String(scene.ids.length).padStart(2)} clouds  ` +
    `${String(d.usable).padStart(3)}/${String(d.total).padEnd(3)} pairs over 20% overlap  ` +
    `median ${(median(d.pairs.map(p => p.overlap)) * 100).toFixed(0)}%  ` +
    `best-partner min ${(Math.min(...best.values()) * 100).toFixed(0)}%  ` +
    `cond ${Math.min(...Object.values(d.cond)).toFixed(3)}-${Math.max(...Object.values(d.cond)).toFixed(3)}` +
    `${slides.length ? `  slides: ${slides.join(',')}` : ''}` +
    `${orphans.length ? `  ORPHANS: ${orphans.join(',')}` : ''}`);
}

const median = xs => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[s.length >> 1] : 0; };
