/**
 * Synthetic sites, scanned the way the real instrument scans them.
 *
 * A real archive gives you one scene, one set of failures, and no control. The
 * questions that matter here are structural — what happens when scans only
 * overlap their neighbours, when a station sees nothing but a flat wall, when
 * the site closes a loop — and each of those wants a scene built to contain
 * exactly that property and nothing else.
 *
 * Surfaces are axis-aligned rectangles and scans are cast as rays over an
 * azimuth/elevation window, so the output carries the two things that actually
 * drive registration behaviour: self-occlusion, and a wedge of directions
 * rather than a tidy ball of points.
 */

/** @typedef {{axis:0|1|2, value:number, lo:[number,number], hi:[number,number]}} Wall */

/** Axis-aligned box, inward-facing; `open` names sides to leave out. */
export function box(min, max, open = []) {
  const walls = [];
  const sides = [
    ['x-', 0, min[0]], ['x+', 0, max[0]],
    ['y-', 1, min[1]], ['y+', 1, max[1]],
    ['z-', 2, min[2]], ['z+', 2, max[2]],
  ];
  for (const [name, axis, value] of sides) {
    if (open.includes(name)) continue;
    const other = [0, 1, 2].filter(a => a !== axis);
    walls.push({
      axis,
      value,
      lo: [min[other[0]], min[other[1]]],
      hi: [max[other[0]], max[other[1]]],
    });
  }
  return walls;
}

/** Nearest hit along a ray, or 0 when it escapes. */
function cast(walls, origin, dir, maxRange) {
  let best = 0;
  for (const w of walls) {
    const d = dir[w.axis];
    if (Math.abs(d) < 1e-9) continue;
    const t = (w.value - origin[w.axis]) / d;
    if (t <= 0.05 || t > maxRange || (best && t >= best)) continue;
    const other = [0, 1, 2].filter(a => a !== w.axis);
    const a = origin[other[0]] + t * dir[other[0]];
    const b = origin[other[1]] + t * dir[other[1]];
    if (a < w.lo[0] || a > w.hi[0] || b < w.lo[1] || b > w.hi[1]) continue;
    best = t;
  }
  return best;
}

function mulberry(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * One scan from one station, in that station's own frame.
 *
 * `yaw` is where the instrument was pointed; the returned points are relative
 * to the station, so recovering `yaw` and `position` is exactly the job the
 * strategies under test are given.
 */
export function scan(walls, station, options = {}) {
  const {
    azimuthSpan = 120,
    azimuthStep = 0.35,
    elevationMin = -25,
    elevationMax = 55,
    elevationStep = 0.35,
    maxRange = 40,
    noise = 0.002,
    seed = 1,
  } = options;
  const random = mulberry(seed);
  const points = [];
  const yaw = (station.yaw ?? 0) * Math.PI / 180;
  for (let a = -azimuthSpan / 2; a <= azimuthSpan / 2; a += azimuthStep) {
    const world = yaw + a * Math.PI / 180;
    const ca = Math.cos(world), sa = Math.sin(world);
    for (let e = elevationMin; e <= elevationMax; e += elevationStep) {
      const er = e * Math.PI / 180;
      const ce = Math.cos(er), se = Math.sin(er);
      const dir = [ce * ca, ce * sa, se];
      const t = cast(walls, station.position, dir, maxRange);
      if (!t) continue;
      const r = t + (random() - 0.5) * 2 * noise;
      // Station frame: the instrument's own zero, not the world's.
      const la = a * Math.PI / 180;
      points.push(r * ce * Math.cos(la), r * ce * Math.sin(la), r * se);
    }
  }
  return new Float32Array(points);
}

/** Column-major rigid transform taking station-local points into the world. */
export function stationPose(station) {
  const y = (station.yaw ?? 0) * Math.PI / 180;
  const c = Math.cos(y), s = Math.sin(y);
  return [c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0,
    station.position[0], station.position[1], station.position[2], 1];
}
