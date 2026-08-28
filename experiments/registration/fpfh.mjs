/**
 * FPFH + RANSAC — the standard answer, and the first method here that
 * estimates translation instead of assuming it.
 *
 * Everything tried so far summarises a cloud globally: a top-down raster of
 * walls, a grid of free space. Both are nearly invariant to where the
 * instrument stood inside a room, which is exactly the quantity being solved
 * for — measured across four scenes the raster proposes 4-6 cm of translation
 * where the truth needs 6-11 m.
 *
 * Fast Point Feature Histograms (Rusu 2009) describe the neighbourhood of each
 * point instead: the distribution of angles between it and its neighbours in a
 * local Darboux frame. That is invariant to pose but *not* to position in the
 * scene, so matching descriptors yields correspondences, and correspondences
 * give a transform directly. RANSAC then finds the largest consistent subset,
 * which is what makes it survive the mostly-wrong matches that descriptor
 * matching produces on repetitive interiors.
 *
 * Prototyped in JS to find out whether it earns a Rust port.
 */

const BINS = 11;

function voxelDownsample(points, cell) {
  const map = new Map();
  for (let i = 0; i < points.length; i += 3) {
    const k = `${Math.floor(points[i] / cell)},${Math.floor(points[i + 1] / cell)},${Math.floor(points[i + 2] / cell)}`;
    let e = map.get(k);
    if (!e) map.set(k, (e = [0, 0, 0, 0]));
    e[0] += points[i]; e[1] += points[i + 1]; e[2] += points[i + 2]; e[3]++;
  }
  const out = new Float32Array(map.size * 3);
  let w = 0;
  for (const e of map.values()) { out[w++] = e[0] / e[3]; out[w++] = e[1] / e[3]; out[w++] = e[2] / e[3]; }
  return out;
}

function grid(points, cell) {
  const map = new Map();
  const key = (x, y, z) => `${x},${y},${z}`;
  for (let i = 0; i < points.length / 3; i++) {
    const k = key(Math.floor(points[i * 3] / cell), Math.floor(points[i * 3 + 1] / cell), Math.floor(points[i * 3 + 2] / cell));
    let a = map.get(k);
    if (!a) map.set(k, (a = []));
    a.push(i);
  }
  return {
    map, cell,
    near(x, y, z, radius) {
      const out = [];
      const r = Math.ceil(radius / cell);
      const bx = Math.floor(x / cell), by = Math.floor(y / cell), bz = Math.floor(z / cell);
      for (let dx = -r; dx <= r; dx++)
        for (let dy = -r; dy <= r; dy++)
          for (let dz = -r; dz <= r; dz++) {
            const a = map.get(key(bx + dx, by + dy, bz + dz));
            if (a) out.push(...a);
          }
      return out;
    },
  };
}

function eigen3(m) {
  // Jacobi; returns eigenvectors as rows, ascending eigenvalue.
  let a = [m.slice(0, 3), m.slice(3, 6), m.slice(6, 9)].map(r => r.slice());
  let v = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (let sweep = 0; sweep < 24; sweep++) {
    let p = 0, q = 1, off = 0;
    for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) if (Math.abs(a[i][j]) > off) { off = Math.abs(a[i][j]); p = i; q = j; }
    if (off < 1e-14) break;
    const theta = (a[q][q] - a[p][p]) / (2 * a[p][q]);
    const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
    const c = 1 / Math.sqrt(t * t + 1), s = t * c;
    for (let k = 0; k < 3; k++) { const akp = a[k][p], akq = a[k][q]; a[k][p] = c * akp - s * akq; a[k][q] = s * akp + c * akq; }
    for (let k = 0; k < 3; k++) { const apk = a[p][k], aqk = a[q][k]; a[p][k] = c * apk - s * aqk; a[q][k] = s * apk + c * aqk; }
    for (let k = 0; k < 3; k++) { const vkp = v[k][p], vkq = v[k][q]; v[k][p] = c * vkp - s * vkq; v[k][q] = s * vkp + c * vkq; }
  }
  const order = [0, 1, 2].sort((x, y) => a[x][x] - a[y][y]);
  return order.map(i => [v[0][i], v[1][i], v[2][i]]);
}

function normals(points, index, radius) {
  const n = points.length / 3;
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const x = points[i * 3], y = points[i * 3 + 1], z = points[i * 3 + 2];
    const near = index.near(x, y, z, radius);
    if (near.length < 5) continue;
    let cx = 0, cy = 0, cz = 0;
    for (const j of near) { cx += points[j * 3]; cy += points[j * 3 + 1]; cz += points[j * 3 + 2]; }
    cx /= near.length; cy /= near.length; cz /= near.length;
    const c = new Float64Array(9);
    for (const j of near) {
      const d = [points[j * 3] - cx, points[j * 3 + 1] - cy, points[j * 3 + 2] - cz];
      for (let r = 0; r < 3; r++) for (let s = 0; s < 3; s++) c[r * 3 + s] += d[r] * d[s];
    }
    const nv = eigen3(c)[0];
    // Point normals toward the instrument, which sits at the cloud's origin;
    // consistent orientation is what makes the angle features comparable.
    const dot = nv[0] * x + nv[1] * y + nv[2] * z;
    const sign = dot > 0 ? -1 : 1;
    out[i * 3] = nv[0] * sign; out[i * 3 + 1] = nv[1] * sign; out[i * 3 + 2] = nv[2] * sign;
  }
  return out;
}

export function fpfh(points, { cell = 0.25, radius = 1.0 } = {}) {
  const down = voxelDownsample(points, cell);
  const index = grid(down, radius);
  const norm = normals(down, index, radius);
  const n = down.length / 3;
  const spfh = new Float32Array(n * BINS * 3);

  for (let i = 0; i < n; i++) {
    const near = index.near(down[i * 3], down[i * 3 + 1], down[i * 3 + 2], radius);
    let count = 0;
    for (const j of near) {
      if (j === i) continue;
      const d = [down[j * 3] - down[i * 3], down[j * 3 + 1] - down[i * 3 + 1], down[j * 3 + 2] - down[i * 3 + 2]];
      const dist = Math.hypot(d[0], d[1], d[2]);
      if (dist < 1e-6 || dist > radius) continue;
      const u = [norm[i * 3], norm[i * 3 + 1], norm[i * 3 + 2]];
      const du = [d[0] / dist, d[1] / dist, d[2] / dist];
      const v = [u[1] * du[2] - u[2] * du[1], u[2] * du[0] - u[0] * du[2], u[0] * du[1] - u[1] * du[0]];
      const vl = Math.hypot(v[0], v[1], v[2]);
      if (vl < 1e-9) continue;
      v[0] /= vl; v[1] /= vl; v[2] /= vl;
      const w = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      const nj = [norm[j * 3], norm[j * 3 + 1], norm[j * 3 + 2]];
      const alpha = v[0] * nj[0] + v[1] * nj[1] + v[2] * nj[2];
      const phi = du[0] * u[0] + du[1] * u[1] + du[2] * u[2];
      const theta = Math.atan2(
        w[0] * nj[0] + w[1] * nj[1] + w[2] * nj[2],
        u[0] * nj[0] + u[1] * nj[1] + u[2] * nj[2]
      );
      const b = (value, lo, hi) => Math.min(BINS - 1, Math.max(0, Math.floor(((value - lo) / (hi - lo)) * BINS)));
      spfh[(i * 3 + 0) * BINS + b(alpha, -1, 1)]++;
      spfh[(i * 3 + 1) * BINS + b(phi, -1, 1)]++;
      spfh[(i * 3 + 2) * BINS + b(theta, -Math.PI, Math.PI)]++;
      count++;
    }
    if (count) for (let k = 0; k < BINS * 3; k++) spfh[i * BINS * 3 + k] /= count;
  }

  // FPFH weights each neighbour's SPFH by inverse distance.
  const feat = new Float32Array(n * BINS * 3);
  for (let i = 0; i < n; i++) {
    const near = index.near(down[i * 3], down[i * 3 + 1], down[i * 3 + 2], radius);
    for (let k = 0; k < BINS * 3; k++) feat[i * BINS * 3 + k] = spfh[i * BINS * 3 + k];
    let total = 0;
    for (const j of near) {
      if (j === i) continue;
      const dist = Math.hypot(down[j * 3] - down[i * 3], down[j * 3 + 1] - down[i * 3 + 1], down[j * 3 + 2] - down[i * 3 + 2]);
      if (dist < 1e-6 || dist > radius) continue;
      const w = 1 / dist;
      total += w;
      for (let k = 0; k < BINS * 3; k++) feat[i * BINS * 3 + k] += (w * spfh[j * BINS * 3 + k]);
    }
    if (total > 0) for (let k = 0; k < BINS * 3; k++) feat[i * BINS * 3 + k] /= (1 + total);
  }
  return { points: down, normals: norm, features: feat, dim: BINS * 3 };
}
