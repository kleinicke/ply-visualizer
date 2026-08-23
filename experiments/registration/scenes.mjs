/**
 * The scene catalogue.
 *
 * Synthetic scenes each isolate one structural property, so a strategy that
 * fails can be told *why* it failed rather than only that it did. Real archives
 * are the acceptance test: an idea that works on a corridor built to be a
 * corridor still has to survive a building.
 */

import fs from 'fs';
import { box, scan, stationPose } from './world.mjs';

const DEFAULT = { azimuthSpan: 120, azimuthStep: 0.4, elevationStep: 0.4, noise: 0.002 };

/**
 * Asymmetric furniture.
 *
 * An empty rectangular room is a trap rather than a simplification: rotating it
 * 180 degrees maps it exactly onto itself, so the correct pose and its flip fit
 * equally well and any solver is being asked an unanswerable question. Real
 * interiors are never symmetric, and neither should the test scenes be. These
 * also give a top-down raster something to correlate other than the outline of
 * the room.
 */
function clutter(spec) {
  return spec.flatMap(([min, max]) => box(min, max));
}

function build(walls, stations, options = {}) {
  const clouds = {}, gt = {};
  stations.forEach((s, i) => {
    const id = s.id ?? `s${String(i).padStart(2, '0')}`;
    clouds[id] = scan(walls, s, { ...DEFAULT, ...options, ...(s.scan ?? {}), seed: i + 1 });
    gt[id] = stationPose(s);
  });
  return { clouds, gt, ids: Object.keys(clouds) };
}

export const SYNTHETIC = {
  /** Everything sees everything: the case a star arrangement is built for. */
  hub: () => build(
    [
      ...box([-6, -5, -1.6], [6, 5, 1.6]),
      ...clutter([
        [[-5.2, 1.2, -1.6], [-3.4, 3.0, 0.9]],
        [[1.1, -4.4, -1.6], [2.3, -3.1, 1.6]],
        [[3.8, 0.4, -1.6], [5.4, 1.1, 0.5]],
      ]),
    ],
    [
      { position: [-3, -2, 0], yaw: 20 },
      { position: [3, -2, 0], yaw: 150 },
      { position: [3, 2, 0], yaw: 220 },
      { position: [-3, 2, 0], yaw: 330 },
    ],
    { azimuthSpan: 200 }
  ),

  /** Neighbours only. No cloud can see the far end; drift has room to grow. */
  chain: () => build(
    [
      ...box([-3.5, -20, -1.5], [3.5, 20, 1.5]),
      // A straight corridor is invariant under sliding along itself, so without
      // strong, *distinct* landmarks this is a degeneracy test rather than a
      // connectivity test. Alcoves of varying depth on alternating sides give
      // each stretch an identity.
      ...clutter(Array.from({ length: 9 }, (_, i) => {
        const y = -18 + i * 4.5;
        const deep = 0.6 + 0.35 * (i % 4);
        return i % 2
          ? [[-3.5, y, -1.5], [-3.5 + deep, y + 1.4 + 0.3 * (i % 3), 1.5]]
          : [[3.5 - deep, y, -1.5], [3.5, y + 1.2 + 0.4 * (i % 3), 0.9 + 0.2 * (i % 3)]];
      })),
    ],
    // Closer together and looking across the corridor rather than along it:
    // neighbours now genuinely share surface instead of sharing a vanishing
    // point.
    Array.from({ length: 7 }, (_, i) => ({
      position: [0, -13.5 + i * 4.5, 0],
      yaw: i % 2 ? 75 : 105,
      scan: { azimuthSpan: 200, maxRange: 16 },
    }))
  ),

  /** A corridor that returns to its own start: drift becomes measurable. */
  loop: () => {
    const walls = [
      ...box([-14, -14, -1.5], [14, 14, 1.5]),
      ...box([-9, -9, -1.5], [9, 9, 1.5]),
      ...clutter([
        [[-13.6, -2.0, -1.5], [-12.9, 0.4, 1.0]],
        [[3.0, 12.6, -1.5], [5.2, 13.4, 0.7]],
        [[12.4, -6.0, -1.5], [13.6, -4.6, 1.2]],
        [[-6.0, -13.5, -1.5], [-4.4, -12.7, 0.6]],
      ]),
    ];
    // Stations follow the *square* mid-line of the annulus. A circle of the
    // same radius leaves the corridor at the corners and drops the station
    // inside the inner room, where it shares nothing with its neighbours - the
    // scene then reads as a solver failure when it is a geometry mistake.
    const mid = 11.5, span = 11.5;
    const ring = [];
    for (let i = 0; i < 12; i++) {
      const t = (i / 12) * 4;
      const leg = Math.floor(t), u = (t - leg) * 2 - 1;
      const p = [
        [u * span, -mid], [mid, u * span], [-u * span, mid], [-mid, -u * span],
      ][leg];
      ring.push({
        position: [p[0], p[1], 0],
        // Looking across the corridor, not along it: neighbours then share
        // wall rather than sharing a vanishing point.
        yaw: [0, 90, 180, 270][leg] + 55,
        scan: { azimuthSpan: 210, maxRange: 18 },
      });
    }
    return build(walls, ring);
  },

  /** One flat wall and nothing else: every pose is free to slide along it. */
  wall: () => build(
    [{ axis: 0, value: 6, lo: [-40, -6], hi: [40, 6] }],
    [
      { position: [0, -1.5, 0], yaw: 0, scan: { azimuthSpan: 45 } },
      { position: [0, 0, 0], yaw: 0, scan: { azimuthSpan: 45 } },
      { position: [0, 1.5, 0], yaw: 0, scan: { azimuthSpan: 45 } },
    ]
  ),

  /** Two rooms joined by a doorway: clusters with one weak link between them. */
  rooms: () => {
    const walls = [
      ...box([-12, -5, -1.6], [-1, 5, 1.6], ['x+']),
      ...box([1, -5, -1.6], [12, 5, 1.6], ['x-']),
      { axis: 0, value: -1, lo: [-5, -1.6], hi: [-0.8, 1.6] },
      { axis: 0, value: -1, lo: [0.8, -1.6], hi: [5, 1.6] },
      { axis: 0, value: 1, lo: [-5, -1.6], hi: [-0.8, 1.6] },
      { axis: 0, value: 1, lo: [0.8, -1.6], hi: [5, 1.6] },
      ...clutter([
        [[-11.4, 2.6, -1.6], [-9.8, 4.2, 1.0]],
        [[-4.0, -4.6, -1.6], [-2.8, -3.4, 1.3]],
        [[9.6, -4.4, -1.6], [11.2, -2.6, 0.8]],
        [[4.2, 3.2, -1.6], [5.4, 4.4, 1.1]],
      ]),
    ];
    return build(walls, [
      { position: [-8, -2, 0], yaw: 10, scan: { azimuthSpan: 190 } },
      { position: [-8, 2, 0], yaw: 340, scan: { azimuthSpan: 190 } },
      { position: [-3, 0, 0], yaw: 0, scan: { azimuthSpan: 190 } },
      { position: [3, 0, 0], yaw: 180, scan: { azimuthSpan: 190 } },
      { position: [8, -2, 0], yaw: 170, scan: { azimuthSpan: 190 } },
      { position: [8, 2, 0], yaw: 200, scan: { azimuthSpan: 190 } },
    ]);
  },

  /** Hub, but every station also shot a second scan: duplicates to exploit. */
  duplicates: () => {
    const walls = [
      ...box([-6, -5, -1.6], [6, 5, 1.6]),
      ...clutter([
        [[-5.2, 1.2, -1.6], [-3.4, 3.0, 0.9]],
        [[1.1, -4.4, -1.6], [2.3, -3.1, 1.6]],
        [[3.8, 0.4, -1.6], [5.4, 1.1, 0.5]],
      ]),
    ];
    const stations = [];
    [[-3, -2, 20], [3, -2, 150], [3, 2, 220], [-3, 2, 330]].forEach(([x, y, yaw], i) => {
      stations.push({ id: `s${i}a`, position: [x, y, 0], yaw, scan: { azimuthSpan: 200 } });
      stations.push({ id: `s${i}b`, position: [x, y, 0], yaw, scan: { azimuthSpan: 90, azimuthStep: 0.2 } });
    });
    return build(walls, stations);
  },
};

/** X3A archives, decoded to a point budget. No ground truth exists for these. */
export function archive(path, budget = 250000) {
  const fd = fs.openSync(path, 'r');
  const head = Buffer.alloc(88);
  fs.readSync(fd, head, 0, 88, 0);
  const count = head.readUInt32LE(80);
  const dir = Buffer.alloc(count * 512);
  fs.readSync(fd, dir, 0, count * 512, 88);
  const members = [];
  for (let i = 0; i < count; i++) {
    const o = i * 512;
    let n = 0;
    while (n < 496 && dir[o + 16 + n] !== 0) n++;
    members.push({
      name: dir.toString('ascii', o + 16, o + 16 + n),
      offset: Number(dir.readBigUInt64LE(o)),
      size: Number(dir.readBigUInt64LE(o + 8)),
    });
  }
  const scans = members.filter(m => /\.x3r$/i.test(m.name)).sort((a, b) => a.name.localeCompare(b.name));
  const clouds = {}, tilt = {};
  for (const m of scans) {
    const buf = Buffer.alloc(m.size);
    fs.readSync(fd, buf, 0, m.size, m.offset);
    const cols = buf.readUInt32LE(32), rows = buf.readUInt32LE(44);
    const stride = 48 + rows * 8;
    let colOff = 16408;
    if (buf.toString('ascii', colOff, colOff + 4) !== 'XCOL') {
      colOff = -1;
      for (let o = 16; o + 4 <= Math.min(m.size, 1 << 20); o += 4) {
        if (buf.toString('ascii', o, o + 4) === 'XCOL') { colOff = o; break; }
      }
      if (colOff < 0) continue;
    }
    const vs = new Float64Array(rows), vc = new Float64Array(rows);
    for (let r = 0; r < rows; r++) {
      const e = (65 - r * (90 / rows)) * Math.PI / 180;
      vs[r] = Math.sin(e); vc[r] = Math.cos(e);
    }
    let valid = 0;
    for (let c = 0; c < cols; c++) {
      const b = colOff + c * stride;
      for (let r = 0, so = b + 48; r < rows; r++, so += 8) {
        const rr = buf.readInt32LE(so);
        if (rr > 0 && rr < 0x7fffffff) valid++;
      }
    }
    const step = Math.max(1, Math.ceil(valid / budget));
    const out = new Float32Array(Math.ceil(valid / step) * 3);
    let k = 0, seen = 0;
    for (let c = 0; c < cols; c++) {
      const b = colOff + c * stride;
      const a = buf.readInt32LE(b + 20) * 1e-6 * Math.PI / 180;
      const sa = Math.sin(a), ca = Math.cos(a);
      for (let r = 0, so = b + 48; r < rows; r++, so += 8) {
        const rr = buf.readInt32LE(so);
        if (rr <= 0 || rr >= 0x7fffffff) continue;
        if (seen++ % step) continue;
        if (k * 3 + 2 >= out.length) break;
        const range = rr * 1e-4, hr = range * vc[r];
        out[k * 3] = hr * ca; out[k * 3 + 1] = hr * sa; out[k * 3 + 2] = range * vs[r];
        k++;
      }
    }
    // The full stem, not the trailing number. Two archives here contain
    // `..._links_0000` and `..._linke_ecke_0000`, which collide the moment the
    // prefix is dropped — and a collision silently merges two scans into one.
    const id = m.name.replace(/\.x3r$/i, '');
    clouds[id] = out.subarray(0, k * 3);
    const tb = Buffer.alloc(48);
    fs.readSync(fd, tb, 0, 48, m.offset + 16408);
    tilt[id] = [tb.readInt32LE(28) * 1e-6, tb.readInt32LE(32) * 1e-6];
  }
  fs.closeSync(fd);
  return { clouds, gt: null, tilt, ids: Object.keys(clouds) };
}
