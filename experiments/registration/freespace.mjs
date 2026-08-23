/**
 * Translation from free space rather than from walls.
 *
 * The existing coarse stage rasterises surfaces, so its image is essentially
 * the outline of the room — and a room outline looks much the same from
 * anywhere inside it. That is why the stage recovers yaw well and translation
 * not at all: measured across four scenes it proposes 4-6 cm where the truth
 * needs 6-11 m.
 *
 * A scan knows something the wall map throws away: every cell between the
 * instrument and a return was *seen through*, and the instrument sits at the
 * centre of its own free region. Two scans taken from different places have
 * differently-shaped free space even when they see identical walls, so
 * correlating occupancy — free negative, surface positive — localises the
 * relative position in a way correlating walls cannot. This is the occupancy
 * grid idea from SLAM scan-matching, applied to the coarse stage.
 *
 * Prototyped here in JS to find out whether it is worth porting to Rust.
 */

const CELL = 0.4;
const HALF = 40;           // grid is (2*HALF+1)^2 cells, so +/- 16 m at 0.4 m
const SIZE = HALF * 2 + 1;

/** Signed top-down occupancy in the cloud's own frame; instrument at centre. */
export function occupancyGrid(points, { cell = CELL, half = HALF, stride = 7 } = {}) {
  const size = half * 2 + 1;
  const grid = new Float32Array(size * size);
  const at = (x, y) => (y + half) * size + (x + half);
  for (let i = 0; i < points.length; i += 3 * stride) {
    const px = points[i], py = points[i + 1];
    const cx = Math.round(px / cell), cy = Math.round(py / cell);
    if (Math.abs(cx) > half || Math.abs(cy) > half) continue;
    // March from the instrument to the return, marking what was seen through.
    const steps = Math.max(Math.abs(cx), Math.abs(cy));
    for (let s = 1; s < steps; s++) {
      const fx = Math.round((cx * s) / steps), fy = Math.round((cy * s) / steps);
      grid[at(fx, fy)] -= 1;
    }
    grid[at(cx, cy)] += 4;
  }
  // Mean-removed, so the correlation is not dominated by how much was scanned.
  let sum = 0;
  for (const v of grid) sum += v;
  const mean = sum / grid.length;
  for (let i = 0; i < grid.length; i++) grid[i] -= mean;
  return { grid, size, half, cell };
}

function rotate(source, degrees) {
  const { grid, size, half, cell } = source;
  const out = new Float32Array(size * size);
  const a = degrees * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  for (let y = -half; y <= half; y++) {
    for (let x = -half; x <= half; x++) {
      // Sample the source at the inverse-rotated position.
      const sx = Math.round(c * x + s * y), sy = Math.round(-s * x + c * y);
      if (Math.abs(sx) > half || Math.abs(sy) > half) continue;
      out[(y + half) * size + (x + half)] = grid[(sy + half) * size + (sx + half)];
    }
  }
  return { grid: out, size, half, cell };
}

/** Best (yaw, shift) by direct correlation. Coarse and slow, but honest. */
export function matchOccupancy(sourcePoints, targetPoints, options = {}) {
  const { yawStep = 5, maxShiftCells = 30, keep = 6 } = options;
  const target = occupancyGrid(targetPoints, options);
  const source = occupancyGrid(sourcePoints, options);
  const { size, half, cell } = target;
  const results = [];
  for (let yaw = 0; yaw < 360; yaw += yawStep) {
    const rotated = rotate(source, yaw);
    let best = -Infinity, bx = 0, by = 0;
    for (let dy = -maxShiftCells; dy <= maxShiftCells; dy++) {
      for (let dx = -maxShiftCells; dx <= maxShiftCells; dx++) {
        let acc = 0;
        // Stride the accumulation: the grid is smooth at this cell size and a
        // full pass over every cell for every shift is not affordable.
        for (let y = -half; y <= half; y += 2) {
          const ty = y + dy;
          if (ty < -half || ty > half) continue;
          const rowS = (y + half) * size, rowT = (ty + half) * size;
          for (let x = -half; x <= half; x += 2) {
            const tx = x + dx;
            if (tx < -half || tx > half) continue;
            acc += rotated.grid[rowS + x + half] * target.grid[rowT + tx + half];
          }
        }
        if (acc > best) { best = acc; bx = dx; by = dy; }
      }
    }
    results.push({ yaw, score: best, tx: bx * cell, ty: by * cell });
  }
  results.sort((a, b) => b.score - a.score);
  // Separated yaws only, so the shortlist holds different guesses.
  const distinct = [];
  for (const r of results) {
    if (distinct.some(d => Math.min(Math.abs(d.yaw - r.yaw), 360 - Math.abs(d.yaw - r.yaw)) <= yawStep)) continue;
    distinct.push(r);
    if (distinct.length >= keep) break;
  }
  return distinct.map(r => {
    const a = r.yaw * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    return { yaw: r.yaw, score: r.score, matrix: [c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, r.tx, r.ty, 0, 1] };
  });
}
