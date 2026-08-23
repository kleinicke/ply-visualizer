/**
 * Rotation and quaternion helpers for pose-graph averaging.
 *
 * Kept separate because rotation averaging is the part that has to be right:
 * translations follow from a linear solve once the rotations are fixed, so an
 * error here cannot be recovered downstream.
 */

export function matToQuat(M) {
  // Column-major 4x4; rotation block is M[0..2], M[4..6], M[8..10].
  const m00 = M[0], m10 = M[1], m20 = M[2];
  const m01 = M[4], m11 = M[5], m21 = M[6];
  const m02 = M[8], m12 = M[9], m22 = M[10];
  const trace = m00 + m11 + m22;
  let w, x, y, z;
  if (trace > 0) {
    const s = Math.sqrt(trace + 1) * 2;
    w = 0.25 * s; x = (m21 - m12) / s; y = (m02 - m20) / s; z = (m10 - m01) / s;
  } else if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2;
    w = (m21 - m12) / s; x = 0.25 * s; y = (m01 + m10) / s; z = (m02 + m20) / s;
  } else if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2;
    w = (m02 - m20) / s; x = (m01 + m10) / s; y = 0.25 * s; z = (m12 + m21) / s;
  } else {
    const s = Math.sqrt(1 + m22 - m00 - m11) * 2;
    w = (m10 - m01) / s; x = (m02 + m20) / s; y = (m12 + m21) / s; z = 0.25 * s;
  }
  const n = Math.hypot(w, x, y, z);
  return [w / n, x / n, y / n, z / n];
}

export function quatToMat(q, t = [0, 0, 0]) {
  const [w, x, y, z] = q;
  return [
    1 - 2 * (y * y + z * z), 2 * (x * y + w * z), 2 * (x * z - w * y), 0,
    2 * (x * y - w * z), 1 - 2 * (x * x + z * z), 2 * (y * z + w * x), 0,
    2 * (x * z + w * y), 2 * (y * z - w * x), 1 - 2 * (x * x + y * y), 0,
    t[0], t[1], t[2], 1,
  ];
}

export const quatMul = (a, b) => [
  a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3],
  a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2],
  a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1],
  a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0],
];

export const quatConj = q => [q[0], -q[1], -q[2], -q[3]];

/** Angle between two rotations, in degrees. */
export function quatAngle(a, b) {
  const d = quatMul(quatConj(a), b);
  return 2 * Math.acos(Math.min(1, Math.abs(d[0]))) * 180 / Math.PI;
}

/**
 * Weighted mean of unit quaternions.
 *
 * Sign-aligned before summing: q and -q are the same rotation, and adding them
 * naively cancels to nothing.
 */
export function quatMean(quats, weights) {
  if (!quats.length) return [1, 0, 0, 0];
  const ref = quats[0];
  let acc = [0, 0, 0, 0];
  for (let i = 0; i < quats.length; i++) {
    const q = quats[i];
    const sign = (q[0] * ref[0] + q[1] * ref[1] + q[2] * ref[2] + q[3] * ref[3]) < 0 ? -1 : 1;
    const w = weights[i];
    for (let k = 0; k < 4; k++) acc[k] += sign * w * q[k];
  }
  const n = Math.hypot(...acc);
  return n < 1e-12 ? ref : acc.map(v => v / n);
}

export const rotateVec = (q, v) => {
  const [w, x, y, z] = q;
  const t = [2 * (y * v[2] - z * v[1]), 2 * (z * v[0] - x * v[2]), 2 * (x * v[1] - y * v[0])];
  return [
    v[0] + w * t[0] + (y * t[2] - z * t[1]),
    v[1] + w * t[1] + (z * t[0] - x * t[2]),
    v[2] + w * t[2] + (x * t[1] - y * t[0]),
  ];
};
