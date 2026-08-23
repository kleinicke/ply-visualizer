/**
 * The strategy the extension ships: grow outward from one anchor.
 *
 * Each pass scores every unplaced cloud against the union of everything placed
 * so far, commits the best one, and repeats; a settle pass at the end re-solves
 * each cloud once every station is on screen. Reproduced here so new ideas are
 * compared against what actually ships rather than against a description of it.
 */
import { createSolver, decimate, transform, quality } from '../solver.mjs';
import { IDENT, mul, inv } from '../metrics.mjs';

const MAX_POINTS = 400000;
const MIN_ACCEPT = 0.10;
const CONFIDENT = 0.5;
const WELL_CONDITIONED = 0.08;

export function anchorWalk(scene, anchor, options = {}) {
  const { ladder = null, windowFactor = null, settle = true } = options;
  const solver = createSolver();
  const ids = scene.ids;
  const clouds = Object.fromEntries(ids.map(id => [id, decimate(scene.clouds[id], MAX_POINTS)]));
  const cond = Object.fromEntries(ids.map(id => [id, solver.conditioning(clouds[id])]));

  const poses = Object.fromEntries(ids.map(id => [id, IDENT.slice()]));
  const placed = [anchor];
  const remaining = new Set(ids.filter(id => id !== anchor));
  const t0 = Date.now();

  const world = id => transform(clouds[id], poses[id]);
  const union = keys => {
    const parts = keys.map(world);
    const total = parts.reduce((s, p) => s + p.length, 0);
    const stride = Math.max(1, Math.ceil(total / (MAX_POINTS * 3)));
    const out = new Float32Array(Math.ceil(total / stride) + 3);
    let w = 0;
    for (const part of parts)
      for (let i = 0; i + 2 < part.length && w + 2 < out.length; i += stride * 3) {
        const b = i - (i % 3);
        out[w++] = part[b]; out[w++] = part[b + 1]; out[w++] = part[b + 2];
      }
    return out.subarray(0, w - (w % 3));
  };
  const inherited = (from, id) => {
    const invSelf = inv(poses[id]);
    const out = [];
    for (const p of from) {
      const d = mul(poses[p], invSelf);
      if (!out.some(e => e.every((v, i) => Math.abs(v - d[i]) < 1e-6))) out.push(d);
    }
    return out;
  };
  const coarseSettings = () => {
    const c = { upAxis: 'z' };
    if (windowFactor) c.windowFactor = windowFactor;
    return c;
  };
  const icpSettings = () => (ladder ? { scales: ladder } : {});

  while (remaining.size > 0) {
    const target = union(placed);
    const scored = [];
    for (const id of [...remaining]) {
      const r = solver.call('register', world(id), target, {
        coarse: coarseSettings(), icp: icpSettings(),
        extraStarts: inherited(placed, id),
      });
      if (!r?.icp || r.icp.fitness < MIN_ACCEPT || r.icp.inlierCount < 30) continue;
      const trust = r.startedFrom === 'given' || cond[id] >= WELL_CONDITIONED;
      scored.push({ id, r, trust, q: quality(r) });
      if (trust && r.icp.fitness >= CONFIDENT) break;
    }
    if (scored.length === 0) break;
    scored.sort((a, b) => Number(b.trust) - Number(a.trust) || b.q - a.q);
    const win = scored[0];
    poses[win.id] = mul(win.r.matrix, poses[win.id]);
    placed.push(win.id);
    remaining.delete(win.id);
  }

  if (settle && placed.length > 2) {
    for (const id of placed.slice(1)) {
      const others = placed.filter(o => o !== id);
      const r = solver.call('register', world(id), union(others), {
        icp: icpSettings(), extraStarts: inherited(others, id),
      });
      if (!r?.icp || r.startedFrom !== 'given') continue;
      poses[id] = mul(r.matrix, poses[id]);
    }
  }

  return { poses, placed, unplaced: [...remaining], ms: Date.now() - t0, stats: solver.stats };
}
