import { l as K } from './chunk-W2ORCHQ2.js';
var z = ['black', 'fuchsia', 'transparent'];
function Ae(R) {
  let e = z.indexOf(String(R));
  return z[(e + 1) % z.length];
}
function ge(R) {
  let e = R?.nanColor;
  if (typeof e == 'object' && e !== null) {
    let n = e;
    return {
      r: Number(n.r) || 0,
      g: Number(n.g) || 0,
      b: Number(n.b) || 0,
      a: n.a === void 0 ? 255 : Number(n.a),
    };
  }
  let t = String(e ?? 'black');
  if (t === 'fuchsia') return { r: 255, g: 0, b: 255, a: 255 };
  if (t === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
  let i = /^#?([0-9a-f]{6})$/i.exec(t);
  if (i) {
    let n = parseInt(i[1], 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 255 };
  }
  return { r: 0, g: 0, b: 0, a: 255 };
}
function J(R) {
  return ge(R).a === 0;
}
var W = class W {
  static setLogger(e) {
    e && (W._log = e);
  }
  static begin(e, t = {}) {
    let i = String(t.conciseLabel || ''),
      n = performance.now();
    W._active = {
      label: e,
      start: n,
      last: n,
      phases: [],
      detailed: !1,
      conciseLabel: i,
      totals: new Map(),
    };
  }
  static mark(e) {
    let t = W._active;
    if (!t) return;
    let i = performance.now(),
      n = i - t.last;
    (t.totals.set(e, (t.totals.get(e) || 0) + n),
      t.detailed && t.phases.push(`${e} ${n.toFixed(0)}ms`),
      (t.last = i));
  }
  static markWithTail(e, t, i) {
    let n = W._active;
    if (!n) return;
    let a = performance.now(),
      u = Math.max(0, a - n.last),
      c = Math.min(u, Math.max(0, Number(i) || 0)),
      o = u - c;
    (n.totals.set(e, (n.totals.get(e) || 0) + o),
      n.totals.set(t, (n.totals.get(t) || 0) + c),
      n.detailed &&
        (n.phases.push(`${e} ${o.toFixed(0)}ms`), n.phases.push(`${t} ${c.toFixed(0)}ms`)),
      (n.last = a));
  }
  static detail(e, t) {
    let i = W._active;
    !i ||
      !Number.isFinite(t) ||
      (i.totals.set(e, (i.totals.get(e) || 0) + Math.max(0, t)),
      i.detailed && i.phases.push(`${e} ${Math.max(0, t).toFixed(0)}ms`));
  }
  static note(e, t) {
    let i = W._active;
    i?.detailed && i.phases.push(`${e} ${t}`);
  }
  static end() {
    let e = W._active;
    if (!e) return;
    ((W._active = null), (W._lastTotals = e.totals));
    let t = (performance.now() - e.start).toFixed(0);
    e.detailed
      ? W._log(`[PerfTrace] ${e.label}: ${e.phases.join(' | ')} | total ${t}ms`)
      : e.conciseLabel && W._log(`[Perf] ${e.conciseLabel} in ${t}ms`);
  }
  static totalMatching(e) {
    let t = W._active?.totals || W._lastTotals,
      i = 0;
    for (let [n, a] of t) e.test(n) && (i += a);
    return i;
  }
  static firstMatching(e) {
    let t = W._active?.totals || W._lastTotals;
    for (let i of t.keys()) if (e.test(i)) return i;
    return '';
  }
  static cancel() {
    W._active = null;
  }
};
((W._active = null), (W._lastTotals = new Map()), (W._log = e => console.log(e)));
var A = W;
var Le = {
    enabled: !0,
    pattern: 'rggb',
    algorithm: 'malvar',
    offsetX: 0,
    offsetY: 0,
    view: 'rgb',
    autoWb: !1,
    gainR: 1,
    gainG: 1,
    gainB: 1,
    blackLevel: 0,
    whiteLevel: 0,
  },
  Z = [
    {
      id: 'rggb',
      label: 'RGGB',
      period: 2,
      channels: 3,
      fourthLabel: null,
      description: 'Bayer, red first',
    },
    {
      id: 'bggr',
      label: 'BGGR',
      period: 2,
      channels: 3,
      fourthLabel: null,
      description: 'Bayer, blue first',
    },
    {
      id: 'grbg',
      label: 'GRBG',
      period: 2,
      channels: 3,
      fourthLabel: null,
      description: 'Bayer, green/red row first',
    },
    {
      id: 'gbrg',
      label: 'GBRG',
      period: 2,
      channels: 3,
      fourthLabel: null,
      description: 'Bayer, green/blue row first',
    },
    {
      id: 'rgbi_4x4',
      label: 'RGB-IR (4\xD74)',
      period: 4,
      channels: 4,
      fourthLabel: 'IR',
      description: 'OmniVision-style RGB-IR, BGRG/GIGI/RGBG/GIGI',
    },
    {
      id: 'xtrans',
      label: 'X-Trans (6\xD76)',
      period: 6,
      channels: 3,
      fourthLabel: null,
      description: 'Fuji X-Trans',
    },
    {
      id: 'rccb',
      label: 'RCCB',
      period: 2,
      channels: 4,
      fourthLabel: 'Clear',
      description: 'Automotive, two clear sites',
    },
    {
      id: 'rccc',
      label: 'RCCC',
      period: 2,
      channels: 4,
      fourthLabel: 'Clear',
      description: 'Automotive, one red + three clear',
    },
    {
      id: 'rgbw',
      label: 'RGBW',
      period: 2,
      channels: 4,
      fourthLabel: 'W',
      description: 'Kodak-style panchromatic',
    },
    {
      id: 'quad_rggb',
      label: 'Quad Bayer (4\xD74)',
      period: 4,
      channels: 3,
      fourthLabel: null,
      description: 'Tetracell, 2\xD72 blocks per colour',
    },
  ];
function he(R) {
  return Z.find(e => e.id === R) || Z[0];
}
var pe = 'tiffvis:cfa-detected';
function We(R) {
  let e = typeof window < 'u' ? window : void 0;
  if (!(!e || typeof e.dispatchEvent != 'function' || typeof CustomEvent > 'u'))
    try {
      e.dispatchEvent(new CustomEvent(pe, { detail: { detected: R } }));
    } catch {}
}
var X = { R: 0, G: 1, B: 2, I: 3 },
  Q = {
    rggb: [0, 1, 1, 2],
    bggr: [2, 1, 1, 0],
    grbg: [1, 0, 2, 1],
    gbrg: [1, 2, 0, 1],
    rgbi_4x4: [2, 1, 0, 1, 1, 3, 1, 3, 0, 1, 2, 1, 1, 3, 1, 3],
    xtrans: [
      1, 2, 0, 1, 0, 2, 0, 1, 1, 2, 1, 1, 2, 1, 1, 0, 1, 1, 1, 0, 2, 1, 2, 0, 2, 1, 1, 0, 1, 1, 0,
      1, 1, 2, 1, 1,
    ],
    rccb: [0, 3, 3, 2],
    rccc: [0, 3, 3, 3],
    rgbw: [0, 1, 2, 3],
    quad_rggb: [0, 0, 1, 1, 0, 0, 1, 1, 1, 1, 2, 2, 1, 1, 2, 2],
  };
function xe(R) {
  return R === 2 ? 1 : R === 4 ? 2 : 3;
}
function ee(R, e, t, i) {
  let n = he(i.pattern),
    a = n.period,
    u = Q[n.id] || Q.rggb,
    c = n.channels,
    o = ((i.offsetX % a) + a) % a,
    r = ((i.offsetY % a) + a) % a,
    s = (w, F) => u[((F + r) % a) * a + ((w + o) % a)],
    M = new Float32Array(e * t);
  if (i.whiteLevel > i.blackLevel) {
    let w = 1 / (i.whiteLevel - i.blackLevel);
    for (let F = 0; F < M.length; F++) M[F] = (R[F] - i.blackLevel) * w;
  } else M.set(R.subarray(0, e * t));
  let p = i.gainR,
    b = i.gainG,
    l = i.gainB;
  if (i.autoWb) {
    let w = [0, 0, 0, 0],
      F = [0, 0, 0, 0];
    for (let m = 0; m < t; m++)
      for (let x = 0; x < e; x++) {
        let v = s(x, m);
        ((w[v] += M[m * e + x]), F[v]++);
      }
    let _ = m => (F[m] > 0 ? w[m] / F[m] : 0),
      T = _(X.G),
      h = T > 1e-9 ? T : _(X.I),
      f = m => (m > 1e-9 && h > 1e-9 ? h / m : 1);
    ((p = f(_(X.R))), (b = f(T)), (l = f(_(X.B))));
  }
  if (Math.abs(p - 1) > 1e-6 || Math.abs(b - 1) > 1e-6 || Math.abs(l - 1) > 1e-6) {
    let w = [p, b, l, 1];
    for (let F = 0; F < t; F++) for (let _ = 0; _ < e; _++) M[F * e + _] *= w[s(_, F)];
  }
  let g = xe(a),
    E = w => g + 1 - Math.abs(w),
    d = new Float32Array(e * t * c),
    y = i.algorithm === 'nearest';
  for (let w = 0; w < t; w++)
    for (let F = 0; F < e; F++) {
      let _ = s(F, w),
        T = M[w * e + F],
        h = (w * e + F) * c;
      for (let f = 0; f < c; f++) {
        if (f === _) {
          d[h + f] = T;
          continue;
        }
        let m = 0,
          x = 0,
          v = T,
          N = 1 / 0;
        for (let U = -g; U <= g; U++) {
          let D = w + U;
          if (!(D < 0 || D >= t))
            for (let C = -g; C <= g; C++) {
              let P = F + C;
              if (P < 0 || P >= e || s(P, D) !== f) continue;
              let I = M[D * e + P];
              if (y) {
                let L = Math.abs(C) + Math.abs(U);
                L < N && ((N = L), (v = I));
              } else {
                let L = E(C) * E(U);
                ((m += L * I), (x += L));
              }
            }
        }
        d[h + f] = y ? v : x > 0 ? m / x : T;
      }
    }
  if (i.whiteLevel > i.blackLevel)
    for (let w = 0; w < d.length; w++) d[w] = d[w] < 0 ? 0 : d[w] > 1 ? 1 : d[w];
  return { data: d, channels: c, gains: { r: p, g: b, b: l }, usedWasm: !1 };
}
function _e(R, e, t) {
  return [
    R.pattern,
    R.algorithm,
    R.offsetX,
    R.offsetY,
    R.autoWb ? 'auto' : `${R.gainR},${R.gainG},${R.gainB}`,
    R.blackLevel,
    R.whiteLevel,
    e,
    t,
  ].join('|');
}
var H = null,
  j = '',
  V = null;
function Pe() {
  return V ? V.gains : null;
}
function Se(R, e, t) {
  if (!V) return null;
  let { data: i, channels: n } = V,
    a = (e * t + R) * n;
  if (a < 0 || a + n > i.length) return null;
  let u = [];
  for (let c = 0; c < n; c++) u.push(i[a + c]);
  return u;
}
function ke() {
  ((H = null), (j = ''), (V = null));
}
function te(R, e, t, i) {
  let n = _e(i, e, t);
  if (H === R && j === n && V) return V;
  let a = R instanceof Float32Array ? R : Float32Array.from(R),
    u,
    c = K();
  if (c && typeof c.demosaic == 'function')
    try {
      let o = c.demosaic(
        a,
        e,
        t,
        i.pattern,
        i.algorithm,
        i.offsetX,
        i.offsetY,
        i.blackLevel,
        i.whiteLevel,
        i.autoWb,
        i.gainR,
        i.gainG,
        i.gainB
      );
      ((u = {
        data: o.take_data(),
        channels: o.channels,
        gains: { r: o.gain_r, g: o.gain_g, b: o.gain_b },
        usedWasm: !0,
      }),
        o.free?.());
    } catch (o) {
      (console.warn('[Debayer] WASM demosaic failed, falling back to JS:', o),
        (u = ee(a, e, t, i)));
    }
  else u = ee(a, e, t, i);
  return ((H = R), (j = n), (V = u), u);
}
function re(R, e) {
  if (e === 'rgb') {
    if (R.channels === 4) {
      let a = R.data.length / 4,
        u = new Float32Array(a * 3);
      for (let c = 0; c < a; c++)
        ((u[c * 3] = R.data[c * 4]),
          (u[c * 3 + 1] = R.data[c * 4 + 1]),
          (u[c * 3 + 2] = R.data[c * 4 + 2]));
      return { data: u, channels: 3 };
    }
    return { data: R.data, channels: 3 };
  }
  let t = e === 'r' ? 0 : e === 'g' ? 1 : e === 'b' ? 2 : 3;
  if (t >= R.channels) return { data: R.data, channels: R.channels };
  let i = R.data.length / R.channels,
    n = new Float32Array(i);
  for (let a = 0; a < i; a++) n[a] = R.data[a * R.channels + t];
  return { data: n, channels: 1 };
}
function ne(R, e) {
  return !!R && R.enabled && e === 1 && R.view !== 'mosaic';
}
function Be(R) {
  return R === 32803;
}
var Ge = ['viridis', 'plasma', 'inferno', 'magma', 'jet', 'hot', 'cool', 'turbo', 'gray'],
  ae = {
    viridis: [
      [0.267004, 0.004874, 0.329415],
      [0.282623, 0.140926, 0.457517],
      [0.253935, 0.265254, 0.529983],
      [0.206756, 0.371758, 0.553117],
      [0.163625, 0.471133, 0.558148],
      [0.127568, 0.566949, 0.550556],
      [0.134692, 0.658636, 0.517649],
      [0.266941, 0.748751, 0.440573],
      [0.477504, 0.821444, 0.318195],
      [0.741388, 0.873449, 0.149561],
      [0.993248, 0.906157, 0.143936],
    ],
    plasma: [
      [0.050383, 0.029803, 0.527975],
      [0.287076, 0.010384, 0.62701],
      [0.47623, 0.011158, 0.657865],
      [0.647257, 0.125289, 0.593542],
      [0.785914, 0.27429, 0.472908],
      [0.87785, 0.439704, 0.345067],
      [0.936213, 0.605205, 0.231465],
      [0.972355, 0.771125, 0.155626],
      [0.994617, 0.938336, 0.165141],
      [0.987053, 0.991438, 0.749504],
    ],
    inferno: [
      [0.001462, 466e-6, 0.013866],
      [0.094329, 0.042852, 0.225802],
      [0.239903, 0.067979, 0.343397],
      [0.41247, 0.102815, 0.380271],
      [0.591217, 0.15541, 0.347824],
      [0.758643, 0.237267, 0.275196],
      [0.88965, 0.360829, 0.210001],
      [0.969788, 0.514135, 0.186861],
      [0.994738, 0.683489, 0.240902],
      [0.988362, 0.998364, 0.644924],
    ],
    magma: [
      [0.001462, 466e-6, 0.013866],
      [0.091904, 0.051667, 0.200303],
      [0.234547, 0.090739, 0.348341],
      [0.408198, 0.131574, 0.416555],
      [0.595732, 0.180653, 0.421399],
      [0.776405, 0.26663, 0.373397],
      [0.92401, 0.40637, 0.33072],
      [0.987622, 0.583041, 0.382914],
      [0.996212, 0.771453, 0.543135],
      [0.987053, 0.991438, 0.749504],
    ],
    turbo: [
      [0.18995, 0.07176, 0.23217],
      [0.25107, 0.25237, 0.63374],
      [0.19659, 0.47276, 0.823],
      [0.12756, 0.66813, 0.82565],
      [0.13094, 0.8203, 0.65899],
      [0.37408, 0.92478, 0.41642],
      [0.66987, 0.95987, 0.19659],
      [0.90842, 0.8764, 0.10899],
      [0.98999, 0.6445, 0.03932],
      [0.93702, 0.25023, 0.01583],
    ],
  };
function Me(R) {
  let e = [];
  for (let t = 0; t < 256; t++) {
    let i = (t / 255) * (R.length - 1),
      n = Math.floor(i),
      a = i - n,
      u = R[Math.min(n, R.length - 1)],
      c = R[Math.min(n + 1, R.length - 1)];
    e.push([
      Math.round((u[0] * (1 - a) + c[0] * a) * 255),
      Math.round((u[1] * (1 - a) + c[1] * a) * 255),
      Math.round((u[2] * (1 - a) + c[2] * a) * 255),
    ]);
  }
  return e;
}
function ye() {
  let R = [];
  for (let e = 0; e < 256; e++) R.push([e, e, e]);
  return R;
}
function Te() {
  let R = [];
  for (let e = 0; e < 256; e++) {
    let t = e / 255,
      i,
      n,
      a;
    (t < 0.125
      ? ((i = 0), (n = 0), (a = 0.5 + t * 4))
      : t < 0.375
        ? ((i = 0), (n = (t - 0.125) * 4), (a = 1))
        : t < 0.625
          ? ((i = (t - 0.375) * 4), (n = 1), (a = 1 - (t - 0.375) * 4))
          : t < 0.875
            ? ((i = 1), (n = 1 - (t - 0.625) * 4), (a = 0))
            : ((i = 1 - (t - 0.875) * 4), (n = 0), (a = 0)),
      R.push([Math.round(i * 255), Math.round(n * 255), Math.round(a * 255)]));
  }
  return R;
}
function Re() {
  let R = [];
  for (let e = 0; e < 256; e++) {
    let t = e / 255,
      i,
      n,
      a;
    (t < 0.33
      ? ((i = t / 0.33), (n = 0), (a = 0))
      : t < 0.66
        ? ((i = 1), (n = (t - 0.33) / 0.33), (a = 0))
        : ((i = 1), (n = 1), (a = (t - 0.66) / 0.34)),
      R.push([Math.round(i * 255), Math.round(n * 255), Math.round(a * 255)]));
  }
  return R;
}
function Ee() {
  let R = [];
  for (let e = 0; e < 256; e++) {
    let t = e / 255;
    R.push([Math.round(t * 255), Math.round((1 - t) * 255), 255]);
  }
  return R;
}
function we(R) {
  if (ae[R]) return Me(ae[R]);
  switch (R) {
    case 'gray':
      return ye();
    case 'jet':
      return Te();
    case 'hot':
      return Re();
    case 'cool':
      return Ee();
    default:
      return null;
  }
}
var oe = new Map();
function $(R) {
  if (!R || R === 'none') return null;
  let e = oe.get(R);
  if (e) return e;
  let t = we(R);
  if (!t) return null;
  let i = new Uint8Array(256 * 3);
  for (let n = 0; n < 256; n++)
    ((i[n * 3] = t[n][0]), (i[n * 3 + 1] = t[n][1]), (i[n * 3 + 2] = t[n][2]));
  return (oe.set(R, i), i);
}
var ie = new Map(),
  se = 5,
  B = 1 << se,
  Y = 8 - se;
function Fe(R) {
  let e = $(R);
  if (!e) return null;
  let t = ie.get(R);
  if (t) return t;
  let i = new Uint8Array(B * B * B),
    n = 255 / (B - 1),
    a = 0;
  for (let u = 0; u < B; u++) {
    let c = u * n;
    for (let o = 0; o < B; o++) {
      let r = o * n;
      for (let s = 0; s < B; s++) {
        let M = s * n,
          p = 0,
          b = 1 / 0;
        for (let l = 0; l < 256; l++) {
          let g = c - e[l * 3],
            E = r - e[l * 3 + 1],
            d = M - e[l * 3 + 2],
            y = g * g + E * E + d * d;
          y < b && ((b = y), (p = l));
        }
        i[a++] = p;
      }
    }
  }
  return (ie.set(R, i), i);
}
function $e(R, e, t, i) {
  let n = Fe(R);
  if (!n) return -1;
  let a = e >> Y,
    u = t >> Y,
    c = i >> Y;
  return n[(a * B + u) * B + c];
}
var S = class {
    static getNormalizationRange(e, t, i, n = !1, a = 0) {
      let u, c;
      if (e.normalization && e.normalization.autoNormalize)
        ((u = t && Number.isFinite(t.min) ? t.min : a),
          (c = t && Number.isFinite(t.max) ? t.max : i));
      else if (e.normalization && e.normalization.gammaMode) ((u = a), (c = i));
      else if (
        e.normalization &&
        e.normalization.min !== void 0 &&
        e.normalization.max !== void 0
      ) {
        if (((u = e.normalization.min), (c = e.normalization.max), e.normalizedFloatMode && !n)) {
          let o = i - a;
          ((u = a + u * o), (c = a + c * o));
        }
      } else ((u = a), (c = i));
      return { min: u, max: c };
    }
    static needsStats(e) {
      return !e.normalization?.gammaMode && e.normalization?.autoNormalize !== !1;
    }
    static applyGammaAndBrightness(e, t) {
      let i = t.gamma?.in ?? 1,
        n = t.gamma?.out ?? 1,
        a = t.brightness?.offset ?? 0,
        u = Math.pow(e, i);
      return ((u *= Math.pow(2, a)), Math.pow(u, 1 / n));
    }
    static generateLut(e, t, i, n, a) {
      let u = performance.now(),
        c = i + 1,
        o = new Uint8Array(c),
        r = a - n,
        s = r > 0 ? 1 / r : 0;
      for (let M = 0; M < c; M++) {
        let b = (M - n) * s;
        b = this.applyGammaAndBrightness(b, e);
        let l = Math.round(Math.max(0, Math.min(1, b)) * 255);
        o[M] = l;
      }
      return (
        console.log(`[LUT] ${t}-bit LUT generation took ${(performance.now() - u).toFixed(2)}ms`),
        o
      );
    }
    static isIdentityTransformation(e) {
      let t = e.gamma?.in ?? 1,
        i = e.gamma?.out ?? 1,
        n = e.brightness?.offset ?? 0;
      return Math.abs(t - i) < 0.001 && Math.abs(n) < 0.001;
    }
    static getEffectiveVisualizationRange(e, t, i) {
      let n = e.gamma?.in ?? 1,
        a = e.gamma?.out ?? 1,
        u = e.brightness?.offset ?? 0,
        c = i - t;
      if (this.isIdentityTransformation(e)) return { min: t, max: i };
      let o = t,
        s = 1 / Math.pow(2, u),
        p = Math.pow(s, 1 / n) * c + t;
      return { min: o, max: p };
    }
  },
  q = class {
    static calculateFloatStats(e, t, i, n) {
      let a = performance.now(),
        u = 1 / 0,
        c = -1 / 0,
        o = t * i;
      if (n === 1)
        for (let r = 0; r < o; r++) {
          let s = e[r];
          s === s && s !== 1 / 0 && s !== -1 / 0 && (s < u && (u = s), s > c && (c = s));
        }
      else {
        let r = n === 2 ? 1 : Math.min(n, 3);
        for (let s = 0; s < o; s++) {
          let M = s * n;
          for (let p = 0; p < r; p++) {
            let b = e[M + p];
            b === b && b !== 1 / 0 && b !== -1 / 0 && (b < u && (u = b), b > c && (c = b));
          }
        }
      }
      return (
        console.log(`[Stats] Float stats calculation took ${(performance.now() - a).toFixed(2)}ms`),
        A.mark('stats'),
        { min: u, max: c }
      );
    }
    static calculateIntegerStats(e, t, i, n, a = !1) {
      let u = 1 / 0,
        c = -1 / 0,
        o = t * i;
      if (a && n >= 3)
        for (let r = 0; r < o; r++) {
          let s = r * n,
            M = (e[s] << 16) | (e[s + 1] << 8) | e[s + 2];
          (M < u && (u = M), M > c && (c = M));
        }
      else if (n === 1)
        for (let r = 0; r < o; r++) {
          let s = e[r];
          (s < u && (u = s), s > c && (c = s));
        }
      else {
        let r = n === 2 ? 1 : Math.min(n, 3);
        for (let s = 0; s < o; s++) {
          let M = s * n;
          for (let p = 0; p < r; p++) {
            let b = e[M + p];
            (b < u && (u = b), b > c && (c = b));
          }
        }
      }
      return (A.mark('stats'), { min: u, max: c });
    }
    static calculateExtendedStats(e, t, i, n) {
      let a = 1 / 0,
        u = -1 / 0,
        c = 0,
        o = 0,
        r = 0,
        s = 0,
        M = t * i,
        p = n === 1 || n === 2 ? 1 : Math.min(n, 3);
      for (let g = 0; g < M; g++) {
        let E = g * n;
        for (let d = 0; d < p; d++) {
          let y = e[E + d];
          Number.isFinite(y)
            ? (y < a && (a = y), y > u && (u = y), (c += y), (o += y * y), r++)
            : s++;
        }
      }
      let b = r > 0 ? c / r : NaN,
        l = r > 0 ? Math.max(0, o / r - b * b) : NaN;
      return {
        min: r > 0 ? a : NaN,
        max: r > 0 ? u : NaN,
        mean: b,
        std: Math.sqrt(l),
        validCount: r,
        nonFiniteCount: s,
        totalCount: M * p,
      };
    }
  },
  le = class {
    static _finishSingleChannelRenderHistogram(e, t, i, n) {
      let a = new Uint32Array(e),
        u = new Uint32Array(e),
        c = new Uint32Array(e),
        r = (b => {
          let l = 0,
            g = 255,
            E = 0,
            d = 0;
          for (let y = 0; y < 256; y++)
            b[y] > 0 && (d === 0 && (l = y), (g = y), (E += y * b[y]), (d += b[y]));
          return { minBin: l, maxBin: g, meanBin: d > 0 ? E / d : 0, total: d };
        })(e),
        s = n.count > 0 ? n.sum / n.count : 0,
        M = n.count > 0 ? n.min : 0,
        p = n.count > 0 ? n.max : 0;
      return {
        histogramData: {
          r: e,
          g: a,
          b: u,
          luminance: c,
          nanCount: t,
          stats: { r, g: r, b: r, luminance: r },
        },
        originalStats: {
          r: { min: M, max: p, mean: s, total: n.count },
          g: { min: M, max: p, mean: s, total: n.count },
          b: { min: M, max: p, mean: s, total: n.count },
        },
        valueRange: i,
      };
    }
    static render(e, t, i, n, a, u, c, o = {}) {
      let r = performance.now();
      if (ne(c?.debayer, n)) {
        let M = c.debayer,
          p = te(e, t, i, M),
          b = re(p, M.view);
        ((e = b.data),
          (n = b.channels),
          (a = !0),
          M.whiteLevel > M.blackLevel && (o = { ...o, typeMax: 1, typeMin: 0 }),
          (u = q.calculateFloatStats(b.data, t, i, b.channels)));
      }
      let s = this._renderInternal(e, t, i, n, a, u, c, o);
      if (
        (n === 1 &&
          c &&
          c.displayColormap &&
          c.displayColormap !== 'none' &&
          this._applyDisplayColormap(s, e, a, c.displayColormap),
        o.flipY)
      ) {
        let M = this._flipY(s);
        return (
          console.log(
            `[Render] Total render time: ${(performance.now() - r).toFixed(2)}ms (with flip)`
          ),
          A.mark('render'),
          M
        );
      }
      return (
        console.log(`[Render] Total render time: ${(performance.now() - r).toFixed(2)}ms`),
        A.mark('render'),
        s
      );
    }
    static _renderInternal(e, t, i, n, a, u, c, o = {}) {
      let r,
        s = o.typeMin ?? 0;
      o.typeMax !== void 0
        ? (r = o.typeMax)
        : a
          ? (r = 1)
          : e instanceof Uint16Array
            ? (r = 65535)
            : (r = 255);
      let M = c.normalization?.gammaMode || !1,
        p = S.isIdentityTransformation(c),
        b,
        l;
      if (M && p) ((b = s), (l = r));
      else {
        let g = S.getNormalizationRange(c, u, r, a, s);
        ((b = g.min), (l = g.max));
      }
      return M
        ? p
          ? a
            ? this._renderFloatDirect(e, t, i, n, b, l, o)
            : e instanceof Uint16Array
              ? this._renderUint16Direct(e, t, i, n, b, l, o)
              : this._renderUint8Direct(e, t, i, n, b, l, o)
          : a
            ? this._renderFloatWithLUT(e, t, i, n, b, l, c, o)
            : e instanceof Uint16Array
              ? this._renderUint16WithLUT(e, t, i, n, b, l, c, o)
              : this._renderUint8WithLUT(e, t, i, n, b, l, c, o)
        : a
          ? this._renderFloatDirect(e, t, i, n, b, l, o)
          : e instanceof Uint16Array
            ? this._renderUint16Direct(e, t, i, n, b, l, o)
            : this._renderUint8Direct(e, t, i, n, b, l, o);
    }
    static _flipY(e) {
      let t = e.width,
        i = e.height,
        n = e.data,
        a = t * 4,
        u = new Uint8ClampedArray(a);
      for (let c = 0; c < i / 2; c++) {
        let o = c * a,
          r = (i - 1 - c) * a;
        (u.set(n.subarray(o, o + a)), n.copyWithin(o, r, r + a), n.set(u, r));
      }
      return e;
    }
    static _applyDisplayColormap(e, t, i, n) {
      let a = $(n);
      if (!a) return;
      let u = e.data,
        c = e.width * e.height;
      for (let o = 0; o < c; o++) {
        if (i && !Number.isFinite(t[o])) continue;
        let r = o * 4,
          s = u[r] * 3;
        ((u[r] = a[s]), (u[r + 1] = a[s + 1]), (u[r + 2] = a[s + 2]));
      }
    }
    static _renderFloatDirect(e, t, i, n, a, u, c) {
      let o = new Uint8ClampedArray(t * i * 4),
        r = c.nanColor || { r: 255, g: 0, b: 255 },
        s = r.a === void 0 ? 255 : r.a,
        M = c.extraSamplesAreAlpha !== !1,
        p = c.nodataValue ?? NaN,
        b = u - a,
        l = b > 0 ? 1 / b : 0,
        E = c.collectHistogram === !0 && n === 1 ? new Uint32Array(256) : null,
        d = 0,
        y = { min: 1 / 0, max: -1 / 0, sum: 0, count: 0 };
      if (n === 1) {
        for (let w = 0; w < t * i; w++) {
          let F = w * 4,
            _ = e[w];
          if (!Number.isFinite(_) || _ === p) {
            ((o[F] = r.r), (o[F + 1] = r.g), (o[F + 2] = r.b), (o[F + 3] = s), E && d++);
            continue;
          }
          let T = (_ - a) * l,
            h = Math.round(Math.max(0, Math.min(1, T)) * 255);
          ((o[F] = h),
            (o[F + 1] = h),
            (o[F + 2] = h),
            (o[F + 3] = 255),
            E &&
              (E[h]++,
              _ < y.min && (y.min = _),
              _ > y.max && (y.max = _),
              (y.sum += _),
              y.count++));
        }
        return (
          E &&
            (c.renderHistogramResult = this._finishSingleChannelRenderHistogram(
              E,
              d,
              { min: a, max: u, isFloat: !0 },
              y
            )),
          new ImageData(o, t, i)
        );
      }
      for (let w = 0; w < t * i; w++) {
        let F = 0,
          _ = 0,
          T = 0,
          h = 255;
        if (n === 1) {
          let m = e[w];
          if (!Number.isFinite(m) || m === p) ((F = r.r), (_ = r.g), (T = r.b), (h = s), d++);
          else {
            let x = (m - a) * l,
              v = Math.round(Math.max(0, Math.min(1, x)) * 255);
            ((F = _ = T = v),
              E &&
                (E[v]++,
                m < y.min && (y.min = m),
                m > y.max && (y.max = m),
                (y.sum += m),
                y.count++));
          }
        } else if (n === 3) {
          let m = w * 3,
            x = e[m],
            v = e[m + 1],
            N = e[m + 2];
          !Number.isFinite(x) ||
          !Number.isFinite(v) ||
          !Number.isFinite(N) ||
          x === p ||
          v === p ||
          N === p
            ? ((F = r.r), (_ = r.g), (T = r.b), (h = s))
            : ((F = Math.round(Math.max(0, Math.min(1, (x - a) * l)) * 255)),
              (_ = Math.round(Math.max(0, Math.min(1, (v - a) * l)) * 255)),
              (T = Math.round(Math.max(0, Math.min(1, (N - a) * l)) * 255)));
        } else if (n === 4) {
          let m = w * 4,
            x = e[m],
            v = e[m + 1],
            N = e[m + 2],
            U = e[m + 3];
          !Number.isFinite(x) ||
          !Number.isFinite(v) ||
          !Number.isFinite(N) ||
          x === p ||
          v === p ||
          N === p
            ? ((F = r.r), (_ = r.g), (T = r.b), (h = s))
            : ((F = Math.round(Math.max(0, Math.min(1, (x - a) * l)) * 255)),
              (_ = Math.round(Math.max(0, Math.min(1, (v - a) * l)) * 255)),
              (T = Math.round(Math.max(0, Math.min(1, (N - a) * l)) * 255)));
          let D = w * 4;
          ((o[D] = F),
            (o[D + 1] = _),
            (o[D + 2] = T),
            (o[D + 3] =
              M && Number.isFinite(U) ? Math.round(Math.max(0, Math.min(1, U)) * 255) : 255));
          continue;
        } else if (n === 2) {
          let m = w * 2,
            x = e[m],
            v = e[m + 1],
            N = w * 4;
          if (!Number.isFinite(x) || x === p) {
            ((o[N] = r.r), (o[N + 1] = r.g), (o[N + 2] = r.b), (o[N + 3] = s));
            continue;
          }
          let U = Math.round(Math.max(0, Math.min(1, (x - a) * l)) * 255);
          ((o[N] = U),
            (o[N + 1] = U),
            (o[N + 2] = U),
            (o[N + 3] =
              M && Number.isFinite(v) ? Math.round(Math.max(0, Math.min(1, v)) * 255) : 255));
          continue;
        } else if (n > 4) {
          let m = w * n,
            x = e[m],
            v = e[m + 1],
            N = e[m + 2],
            U = w * 4;
          !Number.isFinite(x) ||
          !Number.isFinite(v) ||
          !Number.isFinite(N) ||
          x === p ||
          v === p ||
          N === p
            ? ((o[U] = r.r), (o[U + 1] = r.g), (o[U + 2] = r.b), (o[U + 3] = s))
            : ((o[U] = Math.round(Math.max(0, Math.min(1, (x - a) * l)) * 255)),
              (o[U + 1] = Math.round(Math.max(0, Math.min(1, (v - a) * l)) * 255)),
              (o[U + 2] = Math.round(Math.max(0, Math.min(1, (N - a) * l)) * 255)),
              (o[U + 3] = 255));
          continue;
        }
        let f = w * 4;
        ((o[f] = F), (o[f + 1] = _), (o[f + 2] = T), (o[f + 3] = h));
      }
      return (
        E &&
          (c.renderHistogramResult = this._finishSingleChannelRenderHistogram(
            E,
            d,
            { min: a, max: u, isFloat: !0 },
            y
          )),
        new ImageData(o, t, i)
      );
    }
    static _renderFloatWithLUT(e, t, i, n, a, u, c, o) {
      let r = new Uint8ClampedArray(t * i * 4),
        s = o.nanColor || { r: 255, g: 0, b: 255 },
        M = s.a === void 0 ? 255 : s.a,
        p = o.extraSamplesAreAlpha !== !1,
        b = o.nodataValue ?? NaN,
        { min: l, max: g } = S.getEffectiveVisualizationRange(c, a, u),
        E = { ...c, brightness: { ...c.brightness, offset: 0 } },
        d = S.generateLut(E, 16, 65535, 0, 65535),
        y = g - l,
        w = y > 0 ? 65535 / y : 0,
        _ = o.collectHistogram === !0 && n === 1 ? new Uint32Array(256) : null,
        T = 0,
        h = { min: 1 / 0, max: -1 / 0, sum: 0, count: 0 };
      if (n === 1) {
        for (let f = 0; f < t * i; f++) {
          let m = f * 4,
            x = e[f];
          if (!Number.isFinite(x) || x === b) {
            ((r[m] = s.r), (r[m + 1] = s.g), (r[m + 2] = s.b), (r[m + 3] = M), _ && T++);
            continue;
          }
          let v = Math.round(Math.max(0, Math.min(65535, (x - l) * w))),
            N = d[v];
          ((r[m] = N),
            (r[m + 1] = N),
            (r[m + 2] = N),
            (r[m + 3] = 255),
            _ &&
              (_[N]++,
              x < h.min && (h.min = x),
              x > h.max && (h.max = x),
              (h.sum += x),
              h.count++));
        }
        return (
          _ &&
            (o.renderHistogramResult = this._finishSingleChannelRenderHistogram(
              _,
              T,
              { min: a, max: u, isFloat: !0 },
              h
            )),
          new ImageData(r, t, i)
        );
      }
      for (let f = 0; f < t * i; f++) {
        let m = 0,
          x = 0,
          v = 0,
          N = 255;
        if (n === 1) {
          let D = e[f];
          if (!Number.isFinite(D) || D === b) ((m = s.r), (x = s.g), (v = s.b), (N = M), T++);
          else {
            let C = Math.round(Math.max(0, Math.min(65535, (D - l) * w)));
            ((m = x = v = d[C]),
              _ &&
                (_[m]++,
                D < h.min && (h.min = D),
                D > h.max && (h.max = D),
                (h.sum += D),
                h.count++));
          }
        } else if (n === 3) {
          let D = f * 3,
            C = e[D],
            P = e[D + 1],
            I = e[D + 2];
          if (
            !Number.isFinite(C) ||
            !Number.isFinite(P) ||
            !Number.isFinite(I) ||
            C === b ||
            P === b ||
            I === b
          )
            ((m = s.r), (x = s.g), (v = s.b), (N = M));
          else {
            let L = Math.round(Math.max(0, Math.min(65535, (C - l) * w))),
              k = Math.round(Math.max(0, Math.min(65535, (P - l) * w))),
              G = Math.round(Math.max(0, Math.min(65535, (I - l) * w)));
            ((m = d[L]), (x = d[k]), (v = d[G]));
          }
        } else if (n === 4) {
          let D = f * 4,
            C = e[D],
            P = e[D + 1],
            I = e[D + 2],
            L = e[D + 3];
          if (
            !Number.isFinite(C) ||
            !Number.isFinite(P) ||
            !Number.isFinite(I) ||
            C === b ||
            P === b ||
            I === b
          )
            ((m = s.r), (x = s.g), (v = s.b), (N = M));
          else {
            let G = Math.round(Math.max(0, Math.min(65535, (C - l) * w))),
              O = Math.round(Math.max(0, Math.min(65535, (P - l) * w))),
              de = Math.round(Math.max(0, Math.min(65535, (I - l) * w)));
            ((m = d[G]), (x = d[O]), (v = d[de]));
          }
          let k = f * 4;
          ((r[k] = m),
            (r[k + 1] = x),
            (r[k + 2] = v),
            (r[k + 3] =
              p && Number.isFinite(L) ? Math.round(Math.max(0, Math.min(1, L)) * 255) : 255));
          continue;
        } else if (n === 2) {
          let D = f * 2,
            C = e[D],
            P = e[D + 1],
            I = f * 4;
          if (!Number.isFinite(C) || C === b) {
            ((r[I] = s.r), (r[I + 1] = s.g), (r[I + 2] = s.b), (r[I + 3] = M));
            continue;
          }
          let L = Math.round(Math.max(0, Math.min(65535, (C - l) * w))),
            k = d[L];
          ((r[I] = k),
            (r[I + 1] = k),
            (r[I + 2] = k),
            (r[I + 3] =
              p && Number.isFinite(P) ? Math.round(Math.max(0, Math.min(1, P)) * 255) : 255));
          continue;
        } else if (n > 4) {
          let D = f * n,
            C = e[D],
            P = e[D + 1],
            I = e[D + 2],
            L = f * 4;
          if (
            !Number.isFinite(C) ||
            !Number.isFinite(P) ||
            !Number.isFinite(I) ||
            C === b ||
            P === b ||
            I === b
          )
            ((r[L] = s.r), (r[L + 1] = s.g), (r[L + 2] = s.b), (r[L + 3] = M));
          else {
            let k = Math.round(Math.max(0, Math.min(65535, (C - l) * w))),
              G = Math.round(Math.max(0, Math.min(65535, (P - l) * w))),
              O = Math.round(Math.max(0, Math.min(65535, (I - l) * w)));
            ((r[L] = d[k]), (r[L + 1] = d[G]), (r[L + 2] = d[O]), (r[L + 3] = 255));
          }
          continue;
        }
        let U = f * 4;
        ((r[U] = m), (r[U + 1] = x), (r[U + 2] = v), (r[U + 3] = N));
      }
      return (
        _ &&
          (o.renderHistogramResult = this._finishSingleChannelRenderHistogram(
            _,
            T,
            { min: a, max: u, isFloat: !0 },
            h
          )),
        new ImageData(r, t, i)
      );
    }
    static _renderUint16Direct(e, t, i, n, a, u, c = {}) {
      let o = new Uint8ClampedArray(t * i * 4),
        r = c.nanColor || { r: 255, g: 0, b: 255 },
        s = r.a === void 0 ? 255 : r.a,
        M = c.extraSamplesAreAlpha !== !1,
        p = c.nodataValue ?? NaN;
      if (c.rgbAs24BitGrayscale && n >= 3) {
        let g = u - a,
          E = g > 0 ? 1 / g : 0;
        for (let d = 0; d < t * i; d++) {
          let y = d * n,
            w = e[y],
            F = e[y + 1],
            _ = e[y + 2],
            T = d * 4;
          if (
            !Number.isFinite(w) ||
            !Number.isFinite(F) ||
            !Number.isFinite(_) ||
            w === p ||
            F === p ||
            _ === p
          ) {
            ((o[T] = r.r), (o[T + 1] = r.g), (o[T + 2] = r.b), (o[T + 3] = s));
            continue;
          }
          let h = Math.round(w / 257),
            f = Math.round(F / 257),
            m = Math.round(_ / 257),
            v = (((h << 16) | (f << 8) | m) - a) * E,
            N = Math.round(Math.max(0, Math.min(1, v)) * 255);
          ((o[T] = N), (o[T + 1] = N), (o[T + 2] = N), (o[T + 3] = 255));
        }
        return new ImageData(o, t, i);
      }
      let b = u - a,
        l = b > 0 ? 255 / b : 0;
      for (let g = 0; g < t * i; g++) {
        let E = 0,
          d = 0,
          y = 0,
          w = 255;
        if (n === 1) {
          let _ = e[g];
          if (!Number.isFinite(_) || _ === p) {
            let T = g * 4;
            ((o[T] = r.r), (o[T + 1] = r.g), (o[T + 2] = r.b), (o[T + 3] = s));
            continue;
          }
          E = d = y = Math.round((Math.max(a, Math.min(u, _)) - a) * l);
        } else if (n === 3) {
          let _ = g * 3,
            T = e[_],
            h = e[_ + 1],
            f = e[_ + 2];
          if (
            !Number.isFinite(T) ||
            !Number.isFinite(h) ||
            !Number.isFinite(f) ||
            T === p ||
            h === p ||
            f === p
          ) {
            let m = g * 4;
            ((o[m] = r.r), (o[m + 1] = r.g), (o[m + 2] = r.b), (o[m + 3] = s));
            continue;
          }
          ((E = Math.round((Math.max(a, Math.min(u, T)) - a) * l)),
            (d = Math.round((Math.max(a, Math.min(u, h)) - a) * l)),
            (y = Math.round((Math.max(a, Math.min(u, f)) - a) * l)));
        } else if (n === 4) {
          let _ = g * 4,
            T = e[_],
            h = e[_ + 1],
            f = e[_ + 2];
          if (
            !Number.isFinite(T) ||
            !Number.isFinite(h) ||
            !Number.isFinite(f) ||
            T === p ||
            h === p ||
            f === p
          ) {
            let x = g * 4;
            ((o[x] = r.r), (o[x + 1] = r.g), (o[x + 2] = r.b), (o[x + 3] = s));
            continue;
          }
          ((E = Math.round((Math.max(a, Math.min(u, T)) - a) * l)),
            (d = Math.round((Math.max(a, Math.min(u, h)) - a) * l)),
            (y = Math.round((Math.max(a, Math.min(u, f)) - a) * l)));
          let m = g * 4;
          ((o[m] = E),
            (o[m + 1] = d),
            (o[m + 2] = y),
            (o[m + 3] = M ? Math.round(e[_ + 3] / 257) : 255));
          continue;
        } else if (n === 2) {
          let _ = g * 2,
            T = e[_],
            h = e[_ + 1],
            f = g * 4;
          if (!Number.isFinite(T) || T === p) {
            ((o[f] = r.r), (o[f + 1] = r.g), (o[f + 2] = r.b), (o[f + 3] = s));
            continue;
          }
          let m = Math.round((Math.max(a, Math.min(u, T)) - a) * l);
          ((o[f] = m),
            (o[f + 1] = m),
            (o[f + 2] = m),
            (o[f + 3] = M && Number.isFinite(h) ? Math.round(h / 257) : 255));
          continue;
        } else if (n > 4) {
          let _ = g * n,
            T = e[_],
            h = e[_ + 1],
            f = e[_ + 2],
            m = g * 4;
          if (
            !Number.isFinite(T) ||
            !Number.isFinite(h) ||
            !Number.isFinite(f) ||
            T === p ||
            h === p ||
            f === p
          ) {
            ((o[m] = r.r), (o[m + 1] = r.g), (o[m + 2] = r.b), (o[m + 3] = s));
            continue;
          }
          ((o[m] = Math.round((Math.max(a, Math.min(u, T)) - a) * l)),
            (o[m + 1] = Math.round((Math.max(a, Math.min(u, h)) - a) * l)),
            (o[m + 2] = Math.round((Math.max(a, Math.min(u, f)) - a) * l)),
            (o[m + 3] = 255));
          continue;
        }
        let F = g * 4;
        ((o[F] = E), (o[F + 1] = d), (o[F + 2] = y), (o[F + 3] = w));
      }
      return new ImageData(o, t, i);
    }
    static _renderUint16WithLUT(e, t, i, n, a, u, c, o = {}) {
      let r = new Uint8ClampedArray(t * i * 4),
        s = o.nanColor || { r: 255, g: 0, b: 255 },
        M = s.a === void 0 ? 255 : s.a,
        p = o.extraSamplesAreAlpha !== !1,
        b = o.nodataValue ?? NaN;
      if (o.rgbAs24BitGrayscale && n >= 3) {
        let d = u - a,
          y = d > 0 ? 1 / d : 0;
        for (let w = 0; w < t * i; w++) {
          let F = w * n,
            _ = e[F],
            T = e[F + 1],
            h = e[F + 2],
            f = w * 4;
          if (
            !Number.isFinite(_) ||
            !Number.isFinite(T) ||
            !Number.isFinite(h) ||
            _ === b ||
            T === b ||
            h === b
          ) {
            ((r[f] = s.r), (r[f + 1] = s.g), (r[f + 2] = s.b), (r[f + 3] = M));
            continue;
          }
          let m = Math.round(_ / 257),
            x = Math.round(T / 257),
            v = Math.round(h / 257),
            U = (((m << 16) | (x << 8) | v) - a) * y;
          U = S.applyGammaAndBrightness(U, c);
          let D = Math.round(Math.max(0, Math.min(1, U)) * 255);
          ((r[f] = D), (r[f + 1] = D), (r[f + 2] = D), (r[f + 3] = 255));
        }
        return new ImageData(r, t, i);
      }
      let l = Math.round(Math.max(0, Math.min(65535, a))),
        g = Math.round(Math.max(0, Math.min(65535, u))),
        E = S.generateLut(c, 16, 65535, l, g);
      for (let d = 0; d < t * i; d++) {
        let y = 0,
          w = 0,
          F = 0,
          _ = 255;
        if (n === 1) {
          let h = e[d];
          if (!Number.isFinite(h) || h === b) {
            let f = d * 4;
            ((r[f] = s.r), (r[f + 1] = s.g), (r[f + 2] = s.b), (r[f + 3] = M));
            continue;
          }
          y = w = F = E[Math.min(65535, h)];
        } else if (n === 3) {
          let h = d * 3,
            f = e[h],
            m = e[h + 1],
            x = e[h + 2];
          if (
            !Number.isFinite(f) ||
            !Number.isFinite(m) ||
            !Number.isFinite(x) ||
            f === b ||
            m === b ||
            x === b
          ) {
            let v = d * 4;
            ((r[v] = s.r), (r[v + 1] = s.g), (r[v + 2] = s.b), (r[v + 3] = M));
            continue;
          }
          ((y = E[Math.min(65535, f)]), (w = E[Math.min(65535, m)]), (F = E[Math.min(65535, x)]));
        } else if (n === 4) {
          let h = d * 4,
            f = e[h],
            m = e[h + 1],
            x = e[h + 2];
          if (
            !Number.isFinite(f) ||
            !Number.isFinite(m) ||
            !Number.isFinite(x) ||
            f === b ||
            m === b ||
            x === b
          ) {
            let N = d * 4;
            ((r[N] = s.r), (r[N + 1] = s.g), (r[N + 2] = s.b), (r[N + 3] = M));
            continue;
          }
          ((y = E[Math.min(65535, f)]), (w = E[Math.min(65535, m)]), (F = E[Math.min(65535, x)]));
          let v = d * 4;
          ((r[v] = y),
            (r[v + 1] = w),
            (r[v + 2] = F),
            (r[v + 3] = p ? Math.round(e[h + 3] / 257) : 255));
          continue;
        } else if (n === 2) {
          let h = d * 2,
            f = e[h],
            m = e[h + 1],
            x = d * 4;
          if (!Number.isFinite(f) || f === b) {
            ((r[x] = s.r), (r[x + 1] = s.g), (r[x + 2] = s.b), (r[x + 3] = M));
            continue;
          }
          let v = E[Math.min(65535, f)];
          ((r[x] = v),
            (r[x + 1] = v),
            (r[x + 2] = v),
            (r[x + 3] = p && Number.isFinite(m) ? Math.round(m / 257) : 255));
          continue;
        } else if (n > 4) {
          let h = d * n,
            f = e[h],
            m = e[h + 1],
            x = e[h + 2],
            v = d * 4;
          if (
            !Number.isFinite(f) ||
            !Number.isFinite(m) ||
            !Number.isFinite(x) ||
            f === b ||
            m === b ||
            x === b
          ) {
            ((r[v] = s.r), (r[v + 1] = s.g), (r[v + 2] = s.b), (r[v + 3] = M));
            continue;
          }
          ((r[v] = E[Math.min(65535, f)]),
            (r[v + 1] = E[Math.min(65535, m)]),
            (r[v + 2] = E[Math.min(65535, x)]),
            (r[v + 3] = 255));
          continue;
        }
        let T = d * 4;
        ((r[T] = y), (r[T + 1] = w), (r[T + 2] = F), (r[T + 3] = _));
      }
      return new ImageData(r, t, i);
    }
    static _renderUint8Direct(e, t, i, n, a, u, c = {}) {
      let o = new Uint8ClampedArray(t * i * 4),
        r = c.nanColor || { r: 255, g: 0, b: 255 },
        s = r.a === void 0 ? 255 : r.a,
        M = c.extraSamplesAreAlpha !== !1,
        p = c.nodataValue ?? NaN;
      if (c.rgbAs24BitGrayscale && n >= 3) {
        let b = u - a,
          l = b > 0 ? 1 / b : 0;
        for (let g = 0; g < t * i; g++) {
          let E = g * n,
            d = e[E],
            y = e[E + 1],
            w = e[E + 2],
            F = g * 4;
          if (
            !Number.isFinite(d) ||
            !Number.isFinite(y) ||
            !Number.isFinite(w) ||
            d === p ||
            y === p ||
            w === p
          ) {
            ((o[F] = r.r), (o[F + 1] = r.g), (o[F + 2] = r.b), (o[F + 3] = s));
            continue;
          }
          let T = (((d << 16) | (y << 8) | w) - a) * l,
            h = Math.round(Math.max(0, Math.min(1, T)) * 255);
          ((o[F] = h), (o[F + 1] = h), (o[F + 2] = h), (o[F + 3] = 255));
        }
        return new ImageData(o, t, i);
      }
      if (a === 0 && u === 255)
        for (let b = 0; b < t * i; b++) {
          let l = b * 4;
          if (n === 1) {
            let g = e[b];
            if (!Number.isFinite(g) || g === p) {
              ((o[l] = r.r), (o[l + 1] = r.g), (o[l + 2] = r.b), (o[l + 3] = s));
              continue;
            }
            o[l] = o[l + 1] = o[l + 2] = g;
          } else if (n === 3) {
            let g = b * 3,
              E = e[g],
              d = e[g + 1],
              y = e[g + 2];
            if (
              !Number.isFinite(E) ||
              !Number.isFinite(d) ||
              !Number.isFinite(y) ||
              E === p ||
              d === p ||
              y === p
            ) {
              ((o[l] = r.r), (o[l + 1] = r.g), (o[l + 2] = r.b), (o[l + 3] = s));
              continue;
            }
            ((o[l] = E), (o[l + 1] = d), (o[l + 2] = y));
          } else if (n === 4) {
            let g = b * 4,
              E = e[g],
              d = e[g + 1],
              y = e[g + 2];
            if (
              !Number.isFinite(E) ||
              !Number.isFinite(d) ||
              !Number.isFinite(y) ||
              E === p ||
              d === p ||
              y === p
            ) {
              ((o[l] = r.r), (o[l + 1] = r.g), (o[l + 2] = r.b), (o[l + 3] = s));
              continue;
            }
            ((o[l] = E), (o[l + 1] = d), (o[l + 2] = y), (o[l + 3] = M ? e[g + 3] : 255));
            continue;
          } else if (n === 2) {
            let g = b * 2,
              E = e[g],
              d = e[g + 1];
            if (!Number.isFinite(E) || E === p) {
              ((o[l] = r.r), (o[l + 1] = r.g), (o[l + 2] = r.b), (o[l + 3] = s));
              continue;
            }
            ((o[l] = o[l + 1] = o[l + 2] = E), (o[l + 3] = M ? d : 255));
            continue;
          } else if (n > 4) {
            let g = b * n,
              E = e[g],
              d = e[g + 1],
              y = e[g + 2];
            if (
              !Number.isFinite(E) ||
              !Number.isFinite(d) ||
              !Number.isFinite(y) ||
              E === p ||
              d === p ||
              y === p
            ) {
              ((o[l] = r.r), (o[l + 1] = r.g), (o[l + 2] = r.b), (o[l + 3] = s));
              continue;
            }
            ((o[l] = E), (o[l + 1] = d), (o[l + 2] = y));
          }
          o[l + 3] = 255;
        }
      else {
        let b = u - a,
          l = b > 0 ? 255 / b : 0;
        for (let g = 0; g < t * i; g++) {
          let E = 0,
            d = 0,
            y = 0,
            w = 255;
          if (n === 1) {
            let _ = e[g];
            if (!Number.isFinite(_) || _ === p) {
              let T = g * 4;
              ((o[T] = r.r), (o[T + 1] = r.g), (o[T + 2] = r.b), (o[T + 3] = s));
              continue;
            }
            E = d = y = Math.round((Math.max(a, Math.min(u, _)) - a) * l);
          } else if (n === 3) {
            let _ = g * 3,
              T = e[_],
              h = e[_ + 1],
              f = e[_ + 2];
            if (
              !Number.isFinite(T) ||
              !Number.isFinite(h) ||
              !Number.isFinite(f) ||
              T === p ||
              h === p ||
              f === p
            ) {
              let m = g * 4;
              ((o[m] = r.r), (o[m + 1] = r.g), (o[m + 2] = r.b), (o[m + 3] = s));
              continue;
            }
            ((E = Math.round((Math.max(a, Math.min(u, T)) - a) * l)),
              (d = Math.round((Math.max(a, Math.min(u, h)) - a) * l)),
              (y = Math.round((Math.max(a, Math.min(u, f)) - a) * l)));
          } else if (n === 4) {
            let _ = g * 4,
              T = e[_],
              h = e[_ + 1],
              f = e[_ + 2];
            if (
              !Number.isFinite(T) ||
              !Number.isFinite(h) ||
              !Number.isFinite(f) ||
              T === p ||
              h === p ||
              f === p
            ) {
              let x = g * 4;
              ((o[x] = r.r), (o[x + 1] = r.g), (o[x + 2] = r.b), (o[x + 3] = s));
              continue;
            }
            ((E = Math.round((Math.max(a, Math.min(u, T)) - a) * l)),
              (d = Math.round((Math.max(a, Math.min(u, h)) - a) * l)),
              (y = Math.round((Math.max(a, Math.min(u, f)) - a) * l)));
            let m = g * 4;
            ((o[m] = E), (o[m + 1] = d), (o[m + 2] = y), (o[m + 3] = M ? e[_ + 3] : 255));
            continue;
          } else if (n === 2) {
            let _ = g * 2,
              T = e[_],
              h = e[_ + 1];
            if (!Number.isFinite(T) || T === p) {
              let m = g * 4;
              ((o[m] = r.r), (o[m + 1] = r.g), (o[m + 2] = r.b), (o[m + 3] = s));
              continue;
            }
            E = d = y = Math.round((Math.max(a, Math.min(u, T)) - a) * l);
            let f = g * 4;
            ((o[f] = E), (o[f + 1] = d), (o[f + 2] = y), (o[f + 3] = M ? h : 255));
            continue;
          } else if (n > 4) {
            let _ = g * n,
              T = e[_],
              h = e[_ + 1],
              f = e[_ + 2];
            if (
              !Number.isFinite(T) ||
              !Number.isFinite(h) ||
              !Number.isFinite(f) ||
              T === p ||
              h === p ||
              f === p
            ) {
              let m = g * 4;
              ((o[m] = r.r), (o[m + 1] = r.g), (o[m + 2] = r.b), (o[m + 3] = s));
              continue;
            }
            ((E = Math.round((Math.max(a, Math.min(u, T)) - a) * l)),
              (d = Math.round((Math.max(a, Math.min(u, h)) - a) * l)),
              (y = Math.round((Math.max(a, Math.min(u, f)) - a) * l)));
          }
          let F = g * 4;
          ((o[F] = E), (o[F + 1] = d), (o[F + 2] = y), (o[F + 3] = w));
        }
      }
      return new ImageData(o, t, i);
    }
    static _renderUint8WithLUT(e, t, i, n, a, u, c, o = {}) {
      let r = new Uint8ClampedArray(t * i * 4),
        s = o.nanColor || { r: 255, g: 0, b: 255 },
        M = s.a === void 0 ? 255 : s.a,
        p = o.extraSamplesAreAlpha !== !1,
        b = o.nodataValue ?? NaN;
      if (o.rgbAs24BitGrayscale && n >= 3) {
        let d = u - a,
          y = d > 0 ? 1 / d : 0;
        for (let w = 0; w < t * i; w++) {
          let F = w * n,
            _ = e[F],
            T = e[F + 1],
            h = e[F + 2],
            f = w * 4;
          if (
            !Number.isFinite(_) ||
            !Number.isFinite(T) ||
            !Number.isFinite(h) ||
            _ === b ||
            T === b ||
            h === b
          ) {
            ((r[f] = s.r), (r[f + 1] = s.g), (r[f + 2] = s.b), (r[f + 3] = M));
            continue;
          }
          let x = (((_ << 16) | (T << 8) | h) - a) * y;
          x = S.applyGammaAndBrightness(x, c);
          let v = Math.round(Math.max(0, Math.min(1, x)) * 255);
          ((r[f] = v), (r[f + 1] = v), (r[f + 2] = v), (r[f + 3] = 255));
        }
        return new ImageData(r, t, i);
      }
      let l = Math.round(Math.max(0, Math.min(255, a))),
        g = Math.round(Math.max(0, Math.min(255, u))),
        E = S.generateLut(c, 8, 255, l, g);
      for (let d = 0; d < t * i; d++) {
        let y = 0,
          w = 0,
          F = 0,
          _ = 255;
        if (n === 1) {
          let h = e[d];
          if (!Number.isFinite(h) || h === b) {
            let f = d * 4;
            ((r[f] = s.r), (r[f + 1] = s.g), (r[f + 2] = s.b), (r[f + 3] = M));
            continue;
          }
          y = w = F = E[h];
        } else if (n === 3) {
          let h = d * 3,
            f = e[h],
            m = e[h + 1],
            x = e[h + 2];
          if (
            !Number.isFinite(f) ||
            !Number.isFinite(m) ||
            !Number.isFinite(x) ||
            f === b ||
            m === b ||
            x === b
          ) {
            let v = d * 4;
            ((r[v] = s.r), (r[v + 1] = s.g), (r[v + 2] = s.b), (r[v + 3] = M));
            continue;
          }
          ((y = E[f]), (w = E[m]), (F = E[x]));
        } else if (n === 4) {
          let h = d * 4,
            f = e[h],
            m = e[h + 1],
            x = e[h + 2];
          if (
            !Number.isFinite(f) ||
            !Number.isFinite(m) ||
            !Number.isFinite(x) ||
            f === b ||
            m === b ||
            x === b
          ) {
            let N = d * 4;
            ((r[N] = s.r), (r[N + 1] = s.g), (r[N + 2] = s.b), (r[N + 3] = M));
            continue;
          }
          ((y = E[f]), (w = E[m]), (F = E[x]));
          let v = d * 4;
          ((r[v] = y), (r[v + 1] = w), (r[v + 2] = F), (r[v + 3] = p ? e[h + 3] : 255));
          continue;
        } else if (n === 2) {
          let h = d * 2,
            f = e[h],
            m = e[h + 1];
          if (!Number.isFinite(f) || f === b) {
            let v = d * 4;
            ((r[v] = s.r), (r[v + 1] = s.g), (r[v + 2] = s.b), (r[v + 3] = M));
            continue;
          }
          y = w = F = E[f];
          let x = d * 4;
          ((r[x] = y), (r[x + 1] = w), (r[x + 2] = F), (r[x + 3] = p ? m : 255));
          continue;
        } else if (n > 4) {
          let h = d * n,
            f = e[h],
            m = e[h + 1],
            x = e[h + 2];
          if (
            !Number.isFinite(f) ||
            !Number.isFinite(m) ||
            !Number.isFinite(x) ||
            f === b ||
            m === b ||
            x === b
          ) {
            let v = d * 4;
            ((r[v] = s.r), (r[v + 1] = s.g), (r[v + 2] = s.b), (r[v + 3] = M));
            continue;
          }
          ((y = E[f]), (w = E[m]), (F = E[x]));
        }
        let T = d * 4;
        ((r[T] = y), (r[T + 1] = w), (r[T + 2] = F), (r[T + 3] = _));
      }
      return new ImageData(r, t, i);
    }
  };
var ve = 3e4,
  Ne = 3e3;
async function ue(R) {
  for (let e of R) {
    let t = new AbortController(),
      i = setTimeout(() => t.abort(), Ne);
    try {
      let n = await fetch(e, { signal: t.signal });
      if (n.ok) return await n.arrayBuffer();
    } catch {
    } finally {
      clearTimeout(i);
    }
  }
  return null;
}
var ce = class {
  constructor(e = 'decodeWorker.bundle.js', t = !0) {
    ((this._workerBundleName = e),
      (this._needsWasm = t),
      (this._worker = null),
      (this._ready = !1),
      (this._caps = {}),
      (this._pending = new Map()),
      (this._nextId = 1),
      (this._startPromise = null),
      (this._readyResolve = void 0),
      (this._blobUrl = null),
      (this._tiffWasmBytes = null),
      (this._tiffWasmFetchPromise = null),
      (this._tiffWasmModule = null),
      (this._tiffWasmCompilePromise = null),
      (this._extraWasmUrls = { jxl: [] }),
      (this._extraModulePromises = { jxl: null }),
      (this._extraModuleWorkers = { jxl: null }));
  }
  start() {
    return (
      this._startPromise ||
        (this._startPromise = this._boot().catch(e => {
          (console.warn('[DecodeWorker] Unavailable, decoding stays on the main thread:', e),
            this._teardown());
        })),
      this._startPromise
    );
  }
  async _boot() {
    let e = globalThis.__tiffVisualizerDecoderWarmup,
      t = e?.bundleName === this._workerBundleName ? e : void 0;
    if (t?.workerPromise)
      try {
        let l = await t.workerPromise;
        ((this._worker = l.worker),
          (this._blobUrl = l.blobUrl),
          (this._caps = l.caps || {}),
          (this._tiffWasmModule = l.wasmModule || null),
          (l.worker.onmessage = g => this._onMessage(g.data)),
          (l.worker.onerror = g => {
            this._worker === l.worker &&
              (console.warn('[DecodeWorker] Adopted worker error:', g.message || g),
              this._teardown());
          }),
          (this._ready = !0),
          console.log(
            `[DecodeWorker] Adopted warm worker (tiff=${!!this._caps.tiff}, tiffWasm=${!!this._caps.tiffWasm})`
          ));
        return;
      } catch {}
    let i = globalThis.__tiffVisualizerVendorAssets,
      n = [
        i?.workers?.[this._workerBundleName],
        new URL(`./${this._workerBundleName}`, import.meta.url).href,
        new URL(`../${this._workerBundleName}`, import.meta.url).href,
      ].filter(Boolean),
      a = [
        i?.wasm,
        new URL('./wasm/tiff-wasm.wasm', import.meta.url).href,
        new URL('../wasm/tiff-wasm.wasm', import.meta.url).href,
      ].filter(Boolean),
      u = (l, g) =>
        [
          l,
          new URL(`./wasm/${g}`, import.meta.url).href,
          new URL(`../wasm/${g}`, import.meta.url).href,
        ].filter(Boolean);
    if (
      ((this._extraWasmUrls = { jxl: u(i?.jxlWasm, 'jxl-wasm.wasm') }),
      this._needsWasm && !this._tiffWasmBytes && !this._tiffWasmFetchPromise)
    ) {
      let l = t?.wasmBytesPromise || t?.getWasmBytes?.();
      l
        ? (this._tiffWasmFetchPromise = l
            .then(g => ((this._tiffWasmBytes = g), g))
            .catch(() => ue(a))
            .finally(() => {
              this._tiffWasmFetchPromise = null;
            }))
        : (this._tiffWasmFetchPromise = ue(a)
            .then(g => ((this._tiffWasmBytes = g), g))
            .finally(() => {
              this._tiffWasmFetchPromise = null;
            }));
    }
    let c = null;
    if (t?.sourcePromise)
      try {
        c = await t.sourcePromise;
      } catch {}
    for (let l of n) {
      if (c) break;
      try {
        let g = await fetch(l);
        if (g.ok) {
          c = await g.text();
          break;
        }
      } catch {}
    }
    if (!c) throw new Error(`${this._workerBundleName} not found`);
    let o = URL.createObjectURL(new Blob([c], { type: 'text/javascript' }));
    this._blobUrl = o;
    let r = new Worker(o, { type: 'module' });
    ((this._worker = r),
      (r.onmessage = l => this._onMessage(l.data)),
      (r.onerror = l => {
        this._worker === r &&
          (console.warn('[DecodeWorker] Worker error:', l.message || l), this._teardown());
      }));
    let s = this._needsWasm ? this._tiffWasmBytes || (await this._tiffWasmFetchPromise) : null;
    !this._tiffWasmModule && !this._tiffWasmCompilePromise && t?.wasmModulePromise
      ? (this._tiffWasmCompilePromise = t.wasmModulePromise
          .then(l => ((this._tiffWasmModule = l), l))
          .catch(() => null)
          .finally(() => {
            this._tiffWasmCompilePromise = null;
          }))
      : !this._tiffWasmModule &&
        !this._tiffWasmCompilePromise &&
        s &&
        (this._tiffWasmCompilePromise = WebAssembly.compile(s)
          .then(l => ((this._tiffWasmModule = l), l))
          .catch(
            l => (console.warn('[DecodeWorker] WASM precompile failed; sending bytes:', l), null)
          )
          .finally(() => {
            this._tiffWasmCompilePromise = null;
          }));
    let M = this._tiffWasmModule || (await this._tiffWasmCompilePromise),
      p = M ? null : s?.slice(0) || null,
      b = await new Promise((l, g) => {
        ((this._readyResolve = l), setTimeout(() => g(new Error('worker init timeout')), 2e4));
        let E = { type: 'init', tiffWasmModule: M, tiffWasmBuffer: p, tiffWasmUrls: a };
        r.postMessage(E, p ? [p] : []);
      });
    this._worker === r &&
      ((this._caps = b || {}),
      (this._ready = !0),
      console.log(
        `[DecodeWorker] Ready (tiff=${!!this._caps.tiff}, tiffWasm=${!!this._caps.tiffWasm})`
      ));
  }
  canDecode(e) {
    return !this._ready || !this._worker
      ? !1
      : e === 'tiff' || e === 'tiff-region'
        ? !!this._caps.tiff
        : !0;
  }
  async _ensureExtraModule(e, t) {
    if (this._extraModuleWorkers[e] === t) return !0;
    this._extraModulePromises[e] ||
      (this._extraModulePromises[e] = (async () => {
        for (let n of this._extraWasmUrls[e])
          try {
            let a = await fetch(n);
            if (a.ok) return await WebAssembly.compile(await a.arrayBuffer());
          } catch {}
        return (
          console.warn(
            `[DecodeWorker] ${e} WASM not found for the worker; decoding on the main thread`
          ),
          null
        );
      })());
    let i = await this._extraModulePromises[e];
    return !i || this._worker !== t
      ? !1
      : (t.postMessage({ type: 'jxl-module', jxlModule: i }),
        (this._extraModuleWorkers[e] = t),
        !0);
  }
  decode(e, t, i = {}) {
    if (!this.canDecode(e)) return null;
    let n = this._worker,
      a = this._nextId++;
    return new Promise(u => {
      let c = setTimeout(() => {
        (console.warn('[DecodeWorker] Decode timed out, terminating worker'), this._teardown());
      }, ve);
      this._pending.set(a, r => {
        (clearTimeout(c), u(r));
      });
      let o = () => {
        n.postMessage({ id: a, format: e, buffer: t, options: i }, [t]);
      };
      try {
        e === 'jxl' ? this._ensureExtraModule('jxl', n).then(o, o) : o();
      } catch (r) {
        (clearTimeout(c), this._pending.delete(a), u({ ok: !1, error: String(r), buffer: t }));
      }
    });
  }
  _onMessage(e) {
    if (e && e.type === 'ready') {
      this._readyResolve?.(e.caps);
      return;
    }
    if (e && e.type === 'caps') {
      ((this._caps = { ...this._caps, ...e.caps }),
        console.log(
          `[DecodeWorker] Capabilities updated (tiff=${!!this._caps.tiff}, tiffWasm=${!!this._caps.tiffWasm})`
        ));
      return;
    }
    let t = this._pending.get(e?.id);
    t &&
      (this._pending.delete(e.id),
      e?.retireWorker === !0 &&
        this._pending.size === 0 &&
        (this._teardown(),
        setTimeout(() => {
          this.start();
        }, 0)),
      t(e));
  }
  cancelActiveDecodes() {
    this._pending.size !== 0 &&
      (console.log(`[DecodeWorker] Cancelling ${this._pending.size} superseded decode(s)`),
      this._teardown());
  }
  retireAfterDecode() {
    this._pending.size === 0 &&
      (this._teardown(),
      setTimeout(() => {
        this.start();
      }, 0));
  }
  _teardown() {
    this._ready = !1;
    let e = this._worker;
    this._worker = null;
    try {
      e?.terminate();
    } catch {}
    for (let t of this._pending.values()) t({ ok: !1, error: 'decode worker unavailable' });
    (this._pending.clear(),
      this._blobUrl && (URL.revokeObjectURL(this._blobUrl), (this._blobUrl = null)),
      (this._caps = {}),
      (this._readyResolve = void 0),
      (this._startPromise = null));
  }
  static async takeSpeculativeDecode(e, t, i) {
    let n = globalThis.__tiffVisualizerDecoderWarmup;
    if (
      n?.imageSourceUri !== e ||
      n.speculativeFormat !== i ||
      !n.speculativeDecodePromise ||
      n.speculativeDecodeClaimed
    )
      return null;
    ((n.speculativeDecodeClaimed = !0), (n.imageBufferClaimed = !0));
    let a;
    try {
      a = await n.speculativeDecodePromise;
    } catch {
      return null;
    }
    if (t?.aborted) throw new DOMException('The operation was aborted.', 'AbortError');
    let u = Number(n.speculativeDecodeMetrics?.durationMs || 0);
    return (
      a && typeof a == 'object' && (a.bootstrapDecodeDurationMs = u),
      A.markWithTail(`fetch(${i})`, `decode-worker(${i})`, u),
      A.note(
        `fetch-${i}-bytes`,
        `${(Number(n.speculativeDecodeMetrics?.fileBytes || 0) / (1024 * 1024)).toFixed(1)}MB`
      ),
      A.note(`decode-${i}-bootstrap`, a?.ok ? 'adopted' : 'fallback'),
      a
    );
  }
  static async fetchArrayBuffer(e, t, i) {
    let n = globalThis.__tiffVisualizerDecoderWarmup;
    if (n?.imageSourceUri === e && n.imageBufferPromise && !n.imageBufferClaimed) {
      n.imageBufferClaimed = !0;
      try {
        let M = performance.now(),
          p = await n.imageBufferPromise;
        if (t?.aborted) throw new DOMException('The operation was aborted.', 'AbortError');
        let b = performance.now() - M,
          l = Number(n.sourceReadMetrics?.responseMs || 0),
          g = Number(n.sourceReadMetrics?.arrayBufferMs || 0);
        (A.detail(`fetch-${i}-bootstrap-wait`, b),
          A.detail(`fetch-${i}-response`, l),
          A.detail(`fetch-${i}-arrayBuffer`, g));
        let E = p.byteLength / (1024 * 1024);
        return (
          A.note(`fetch-${i}-bytes`, `${E.toFixed(1)}MB`),
          g > 0 && A.note(`fetch-${i}-arrayBuffer-rate`, `${(E / (g / 1e3)).toFixed(0)}MB/s`),
          A.mark(`fetch(${i})`),
          p
        );
      } catch (M) {
        if (t?.aborted || (M instanceof DOMException && M.name === 'AbortError')) throw M;
      }
    }
    let a = performance.now(),
      u = await fetch(e, { signal: t });
    A.detail(`fetch-${i}-response`, performance.now() - a);
    let c = performance.now(),
      o = await u.arrayBuffer(),
      r = performance.now() - c;
    A.detail(`fetch-${i}-arrayBuffer`, r);
    let s = o.byteLength / (1024 * 1024);
    return (
      A.note(`fetch-${i}-bytes`, `${s.toFixed(1)}MB`),
      r > 0 && A.note(`fetch-${i}-arrayBuffer-rate`, `${(s / (r / 1e3)).toFixed(0)}MB/s`),
      A.mark(`fetch(${i})`),
      o
    );
  }
  static async decodeWithFallback(e, t, i, n, a, u, c = {}) {
    let o = performance.now(),
      r = e ? await e.decode(t, i, c) : null,
      s = performance.now() - o;
    if (a?.aborted) throw new DOMException('Load superseded', 'AbortError');
    if (r?.ok) {
      if ((A.mark(`decode-worker(${t})`), Array.isArray(r.result?.decodeTimings))) {
        let b = 0,
          l = 0;
        for (let g of r.result.decodeTimings) {
          let E = Number(g?.durationMs);
          if (!Number.isFinite(E)) continue;
          let d = String(g.name || `${t}-decode-detail`);
          ((b += E),
            (d === `decode-${t}-rust` ||
              d === `decode-${t}-parse-exr` ||
              d === `decode-${t}-upng` ||
              d === `decode-${t}-parse`) &&
              (l += E),
            A.detail(d, E));
        }
        A.detail(`decode-${t}-worker-transfer+overhead`, s - (l || b));
      }
      return r.result;
    }
    r && console.warn(`[DecodeWorker] ${t} worker decode failed, decoding locally:`, r.error);
    let M = r ? r.buffer : i;
    (!M || M.byteLength === 0) && (M = await (await fetch(n, { signal: a })).arrayBuffer());
    let p = await u(M, c);
    return (A.mark(`decode-local(${t})`), p);
  }
};
var me = new Map(),
  fe = new Set(),
  be = class {
    constructor() {
      ((this.canvas = null),
        (this.gl = null),
        (this.program = null),
        (this.texture = null),
        (this.dummyFloatTexture = null),
        (this.dummyUintTexture = null),
        (this.colormapTexture = null),
        (this.vao = null),
        (this.textureData = null),
        (this.textureFormat = ''),
        (this.colormapName = ''),
        (this.textureWidth = 0),
        (this.textureHeight = 0),
        (this.failed = !1),
        (this.rgb32fFailed = !1),
        (this.uintTextureFailed = !1));
    }
    canRender(e) {
      if (
        e.settings?.gpuAcceleration === !1 ||
        this.failed ||
        !ArrayBuffer.isView(e.data) ||
        J(e.settings)
      )
        return !1;
      let t = e.settings?.rgbAs24BitGrayscale && e.channels === 3,
        i = e.channels === 1,
        n = e.settings?.debayer;
      if (n?.enabled && e.channels === 1 && n.view !== 'mosaic') return !1;
      let a = !t && (e.channels === 3 || e.channels === 4);
      if (e.isFloat) {
        if (e.data.BYTES_PER_ELEMENT !== 4 || (t && this.rgb32fFailed) || (!i && !t && !a))
          return !1;
      } else {
        let u =
          e.data instanceof Uint16Array ||
          e.data instanceof Uint8Array ||
          e.data instanceof Uint8ClampedArray;
        if (
          this.uintTextureFailed ||
          !u ||
          (!i && !t && !a) ||
          (e.settings?.displayColormap && e.settings.displayColormap !== 'none' && !i)
        )
          return !1;
      }
      return typeof WebGL2RenderingContext < 'u';
    }
    render(e, t) {
      try {
        let i = performance.now();
        if (!this._ensureContext(e)) return !1;
        (A.mark('webgl-context-setup'),
          A.detail('webgl-context-setup-detail', performance.now() - i));
        let n = this.gl,
          a = n.getParameter(n.MAX_TEXTURE_SIZE);
        if (t.width > a || t.height > a)
          return (
            console.warn(
              `[WebGL2FloatRenderer] Image ${t.width}x${t.height} exceeds max texture size ${a}; using CPU renderer`
            ),
            !1
          );
        (e.width !== t.width || e.height !== t.height) &&
          ((e.width = t.width), (e.height = t.height));
        let u = this._getTextureFormat(t);
        return (
          this._uploadTextureIfNeeded(t.data, t.width, t.height, u),
          this._uploadColormapIfNeeded(t.settings?.displayColormap || 'none'),
          this._draw(t),
          A.mark('render-webgl'),
          !0
        );
      } catch (i) {
        return this._getTextureFormat(t).endsWith('ui')
          ? ((this.uintTextureFailed = !0),
            console.warn('[WebGL2FloatRenderer] Disabled uint16 GPU path after render failure:', i),
            !1)
          : t.settings?.rgbAs24BitGrayscale && t.channels === 3
            ? ((this.rgb32fFailed = !0),
              console.warn(
                '[WebGL2FloatRenderer] Disabled RGB24 GPU path after render failure:',
                i
              ),
              !1)
            : ((this.failed = !0),
              console.warn('[WebGL2FloatRenderer] Disabled after render failure:', i),
              !1);
      }
    }
    dispose() {
      let e = this.gl;
      (e &&
        (this.texture && e.deleteTexture(this.texture),
        this.dummyFloatTexture && e.deleteTexture(this.dummyFloatTexture),
        this.dummyUintTexture && e.deleteTexture(this.dummyUintTexture),
        this.colormapTexture && e.deleteTexture(this.colormapTexture),
        this.program && e.deleteProgram(this.program),
        this.vao && e.deleteVertexArray(this.vao)),
        (this.canvas = null),
        (this.gl = null),
        (this.program = null),
        (this.texture = null),
        (this.dummyFloatTexture = null),
        (this.dummyUintTexture = null),
        (this.colormapTexture = null),
        (this.vao = null),
        (this.textureData = null),
        (this.textureFormat = ''),
        (this.colormapName = ''),
        (this.textureWidth = 0),
        (this.textureHeight = 0));
    }
    _ensureContext(e) {
      if (this.gl && this.canvas === e && this.program && this.texture && this.vao) return !0;
      this.dispose();
      let t = e.getContext('webgl2', {
        alpha: !1,
        antialias: !1,
        depth: !1,
        stencil: !1,
        preserveDrawingBuffer: !0,
        premultipliedAlpha: !1,
      });
      if (!t) return ((this.failed = !0), !1);
      let i = this._createProgram(t),
        n = t.createVertexArray(),
        a = t.createTexture(),
        u = t.createTexture(),
        c = t.createTexture(),
        o = t.createTexture();
      if (!i || !n || !a || !u || !c || !o) return ((this.failed = !0), !1);
      t.bindVertexArray(n);
      let r = t.createBuffer();
      (t.bindBuffer(t.ARRAY_BUFFER, r),
        t.bufferData(
          t.ARRAY_BUFFER,
          new Float32Array([-1, -1, 0, 1, 1, -1, 1, 1, -1, 1, 0, 0, 1, 1, 1, 0]),
          t.STATIC_DRAW
        ));
      let s = 16,
        M = t.getAttribLocation(i, 'a_position'),
        p = t.getAttribLocation(i, 'a_texCoord');
      return (
        t.enableVertexAttribArray(M),
        t.vertexAttribPointer(M, 2, t.FLOAT, !1, s, 0),
        t.enableVertexAttribArray(p),
        t.vertexAttribPointer(p, 2, t.FLOAT, !1, s, 8),
        t.bindTexture(t.TEXTURE_2D, a),
        t.texParameteri(t.TEXTURE_2D, t.TEXTURE_MIN_FILTER, t.NEAREST),
        t.texParameteri(t.TEXTURE_2D, t.TEXTURE_MAG_FILTER, t.NEAREST),
        t.texParameteri(t.TEXTURE_2D, t.TEXTURE_WRAP_S, t.CLAMP_TO_EDGE),
        t.texParameteri(t.TEXTURE_2D, t.TEXTURE_WRAP_T, t.CLAMP_TO_EDGE),
        t.bindTexture(t.TEXTURE_2D, u),
        t.texParameteri(t.TEXTURE_2D, t.TEXTURE_MIN_FILTER, t.NEAREST),
        t.texParameteri(t.TEXTURE_2D, t.TEXTURE_MAG_FILTER, t.NEAREST),
        t.texParameteri(t.TEXTURE_2D, t.TEXTURE_WRAP_S, t.CLAMP_TO_EDGE),
        t.texParameteri(t.TEXTURE_2D, t.TEXTURE_WRAP_T, t.CLAMP_TO_EDGE),
        t.texImage2D(t.TEXTURE_2D, 0, t.R32F, 1, 1, 0, t.RED, t.FLOAT, new Float32Array([0])),
        t.bindTexture(t.TEXTURE_2D, c),
        t.texParameteri(t.TEXTURE_2D, t.TEXTURE_MIN_FILTER, t.NEAREST),
        t.texParameteri(t.TEXTURE_2D, t.TEXTURE_MAG_FILTER, t.NEAREST),
        t.texParameteri(t.TEXTURE_2D, t.TEXTURE_WRAP_S, t.CLAMP_TO_EDGE),
        t.texParameteri(t.TEXTURE_2D, t.TEXTURE_WRAP_T, t.CLAMP_TO_EDGE),
        t.texImage2D(
          t.TEXTURE_2D,
          0,
          t.R16UI,
          1,
          1,
          0,
          t.RED_INTEGER,
          t.UNSIGNED_SHORT,
          new Uint16Array([0])
        ),
        t.bindTexture(t.TEXTURE_2D, o),
        t.texParameteri(t.TEXTURE_2D, t.TEXTURE_MIN_FILTER, t.NEAREST),
        t.texParameteri(t.TEXTURE_2D, t.TEXTURE_MAG_FILTER, t.NEAREST),
        t.texParameteri(t.TEXTURE_2D, t.TEXTURE_WRAP_S, t.CLAMP_TO_EDGE),
        t.texParameteri(t.TEXTURE_2D, t.TEXTURE_WRAP_T, t.CLAMP_TO_EDGE),
        (this.canvas = e),
        (this.gl = t),
        (this.program = i),
        (this.texture = a),
        (this.dummyFloatTexture = u),
        (this.dummyUintTexture = c),
        (this.colormapTexture = o),
        (this.vao = n),
        !0
      );
    }
    _uploadTextureIfNeeded(e, t, i, n) {
      let a = this.gl;
      if (
        this.textureData === e &&
        this.textureWidth === t &&
        this.textureHeight === i &&
        this.textureFormat === n
      ) {
        A.detail('webgl-texture-upload-skipped', 0);
        return;
      }
      let u = performance.now(),
        c = performance.now();
      (a.bindTexture(a.TEXTURE_2D, this.texture),
        a.pixelStorei(a.UNPACK_ALIGNMENT, 1),
        A.detail('webgl-texture-upload-setup', performance.now() - c));
      let o = performance.now();
      switch (n) {
        case 'rgb32f':
          a.texImage2D(a.TEXTURE_2D, 0, a.RGB32F, t, i, 0, a.RGB, a.FLOAT, e);
          break;
        case 'rgba32f':
          a.texImage2D(a.TEXTURE_2D, 0, a.RGBA32F, t, i, 0, a.RGBA, a.FLOAT, e);
          break;
        case 'r16ui':
          a.texImage2D(a.TEXTURE_2D, 0, a.R16UI, t, i, 0, a.RED_INTEGER, a.UNSIGNED_SHORT, e);
          break;
        case 'rgb16ui':
          a.texImage2D(a.TEXTURE_2D, 0, a.RGB16UI, t, i, 0, a.RGB_INTEGER, a.UNSIGNED_SHORT, e);
          break;
        case 'rgba16ui':
          a.texImage2D(a.TEXTURE_2D, 0, a.RGBA16UI, t, i, 0, a.RGBA_INTEGER, a.UNSIGNED_SHORT, e);
          break;
        case 'r8ui':
          a.texImage2D(a.TEXTURE_2D, 0, a.R8UI, t, i, 0, a.RED_INTEGER, a.UNSIGNED_BYTE, e);
          break;
        case 'rgb8ui':
          a.texImage2D(a.TEXTURE_2D, 0, a.RGB8UI, t, i, 0, a.RGB_INTEGER, a.UNSIGNED_BYTE, e);
          break;
        case 'rgba8ui':
          a.texImage2D(a.TEXTURE_2D, 0, a.RGBA8UI, t, i, 0, a.RGBA_INTEGER, a.UNSIGNED_BYTE, e);
          break;
        default:
          a.texImage2D(a.TEXTURE_2D, 0, a.R32F, t, i, 0, a.RED, a.FLOAT, e);
      }
      A.detail(`webgl-texImage2D-${n}`, performance.now() - o);
      let r = t * i,
        s = me.get(n) || 0;
      if (r > s) {
        let M = performance.now(),
          p = a.getError();
        if ((A.detail('webgl-texture-upload-error-check', performance.now() - M), p !== a.NO_ERROR))
          throw new Error(`Float texture upload failed: WebGL error ${p}`);
        me.set(n, r);
      } else A.detail('webgl-texture-upload-error-check-skipped', 0);
      ((this.textureData = e),
        (this.textureWidth = t),
        (this.textureHeight = i),
        (this.textureFormat = n),
        A.mark('webgl-texture-upload'),
        console.log(`[WebGL2] Float texture upload took ${(performance.now() - u).toFixed(2)}ms`));
    }
    _getTextureFormat(e) {
      let t = e.channels || 1,
        i = e.settings?.rgbAs24BitGrayscale && t === 3;
      if (e.isFloat !== !1) return i || t === 3 ? 'rgb32f' : t === 4 ? 'rgba32f' : 'r32f';
      let n = e.data?.BYTES_PER_ELEMENT === 1;
      return i || t === 3
        ? n
          ? 'rgb8ui'
          : 'rgb16ui'
        : t === 4
          ? n
            ? 'rgba8ui'
            : 'rgba16ui'
          : n
            ? 'r8ui'
            : 'r16ui';
    }
    _uploadColormapIfNeeded(e) {
      if (!e || e === 'none') {
        this.colormapName = 'none';
        return;
      }
      if (this.colormapName === e) return;
      let t = performance.now(),
        i = $(e);
      if (!i) {
        this.colormapName = 'none';
        return;
      }
      let n = this.gl;
      if (
        (n.activeTexture(n.TEXTURE1),
        n.bindTexture(n.TEXTURE_2D, this.colormapTexture),
        n.pixelStorei(n.UNPACK_ALIGNMENT, 1),
        n.texImage2D(n.TEXTURE_2D, 0, n.RGB8, 256, 1, 0, n.RGB, n.UNSIGNED_BYTE, i),
        !fe.has(e))
      ) {
        let a = n.getError();
        if (a !== n.NO_ERROR) throw new Error(`Colormap texture upload failed: WebGL error ${a}`);
        fe.add(e);
      }
      ((this.colormapName = e), A.detail('webgl-colormap-upload', performance.now() - t));
    }
    _draw(e) {
      let t = this.gl,
        i = this.program,
        n = e.settings || {},
        u = this.textureFormat.endsWith('ui'),
        c = n.normalization?.gammaMode || !1,
        o = S.isIdentityTransformation(n),
        r = Number.isFinite(e.min) && Number.isFinite(e.max) ? { min: e.min, max: e.max } : null,
        s,
        M,
        p = 1;
      if (c && o) ((s = e.typeMin ?? 0), (M = e.typeMax));
      else {
        let F = S.getNormalizationRange(n, r, e.typeMax, !0, e.typeMin ?? 0);
        ((s = F.min), (M = F.max));
      }
      if (c && !o) {
        let F = S.getEffectiveVisualizationRange(n, e.typeMin ?? 0, e.typeMax);
        ((s = F.min), (M = F.max));
        let _ = n.gamma?.in ?? 1,
          T = n.gamma?.out ?? 1;
        p = _ / T;
      }
      let b = M - s,
        l = performance.now();
      (t.viewport(0, 0, t.canvas.width, t.canvas.height),
        t.useProgram(i),
        t.bindVertexArray(this.vao),
        t.activeTexture(t.TEXTURE0),
        t.bindTexture(t.TEXTURE_2D, u ? this.dummyFloatTexture : this.texture),
        t.uniform1i(t.getUniformLocation(i, 'u_dataFloat'), 0),
        t.activeTexture(t.TEXTURE1),
        t.bindTexture(t.TEXTURE_2D, this.colormapTexture),
        t.uniform1i(t.getUniformLocation(i, 'u_colormap'), 1),
        t.activeTexture(t.TEXTURE2),
        t.bindTexture(t.TEXTURE_2D, u ? this.texture : this.dummyUintTexture),
        t.uniform1i(t.getUniformLocation(i, 'u_dataUint'), 2),
        t.uniform1f(t.getUniformLocation(i, 'u_min'), s),
        t.uniform1f(t.getUniformLocation(i, 'u_invRange'), b > 0 ? 1 / b : 0),
        t.uniform1f(t.getUniformLocation(i, 'u_gammaExponent'), p),
        t.uniform1i(t.getUniformLocation(i, 'u_flipY'), e.flipY ? 1 : 0));
      let g = e.channels || 1,
        E = n.rgbAs24BitGrayscale && g === 3 ? (u ? 4 : 2) : g >= 3 ? (u ? 5 : 3) : u ? 1 : 0;
      (t.uniform1i(t.getUniformLocation(i, 'u_renderMode'), E),
        t.uniform1i(
          t.getUniformLocation(i, 'u_useColormap'),
          n.displayColormap && n.displayColormap !== 'none' ? 1 : 0
        ),
        t.uniform1f(t.getUniformLocation(i, 'u_rgb24ChannelDivisor'), e.typeMax > 255 ? 257 : 1));
      let d = Number(e.nodataValue);
      (t.uniform1i(t.getUniformLocation(i, 'u_hasNodata'), Number.isFinite(d) ? 1 : 0),
        t.uniform1f(t.getUniformLocation(i, 'u_nodata'), Number.isFinite(d) ? d : 0),
        t.uniform3f(
          t.getUniformLocation(i, 'u_nanColor'),
          e.nanColor.r / 255,
          e.nanColor.g / 255,
          e.nanColor.b / 255
        ),
        A.detail('webgl-draw-state', performance.now() - l));
      let y = performance.now();
      (t.drawArrays(t.TRIANGLE_STRIP, 0, 4), A.detail('webgl-draw-submit', performance.now() - y));
      let w = performance.now();
      (t.flush(), A.detail('webgl-flush', performance.now() - w));
    }
    _createProgram(e) {
      let t = this._compileShader(
          e,
          e.VERTEX_SHADER,
          `#version 300 es
in vec2 a_position;
in vec2 a_texCoord;
out vec2 v_texCoord;
void main() {
	v_texCoord = a_texCoord;
	gl_Position = vec4(a_position, 0.0, 1.0);
}`
        ),
        i = this._compileShader(
          e,
          e.FRAGMENT_SHADER,
          `#version 300 es
precision highp float;
precision highp sampler2D;
precision highp usampler2D;
uniform sampler2D u_dataFloat;
uniform usampler2D u_dataUint;
uniform sampler2D u_colormap;
uniform float u_min;
uniform float u_invRange;
uniform float u_gammaExponent;
uniform float u_rgb24ChannelDivisor;
uniform bool u_flipY;
uniform int u_renderMode;
uniform bool u_useColormap;
uniform vec3 u_nanColor;
// The file's "no measurement here" sentinel (GDAL_NODATA), or NaN when the
// file declares none \u2014 a NaN uniform never equals a sample, so the test below
// costs one comparison and changes nothing for files without one.
uniform float u_nodata;
uniform bool u_hasNodata;
in vec2 v_texCoord;
out vec4 outColor;
float applyGamma(float value) {
	float normalized = clamp((value - u_min) * u_invRange, 0.0, 1.0);
	if (abs(u_gammaExponent - 1.0) > 0.0001) {
		normalized = pow(normalized, u_gammaExponent);
	}
	return normalized;
}
void main() {
	vec2 texCoord = u_flipY ? vec2(v_texCoord.x, 1.0 - v_texCoord.y) : v_texCoord;
	if (u_renderMode == 2 || u_renderMode == 4) {
		vec3 sampleRgb = u_renderMode == 2
			? texture(u_dataFloat, texCoord).rgb
			: vec3(texture(u_dataUint, texCoord).rgb);
		if (isnan(sampleRgb.r) || isinf(sampleRgb.r) || isnan(sampleRgb.g) || isinf(sampleRgb.g) || isnan(sampleRgb.b) || isinf(sampleRgb.b)
			|| (u_hasNodata && (sampleRgb.r == u_nodata || sampleRgb.g == u_nodata || sampleRgb.b == u_nodata))) {
			outColor = vec4(u_nanColor, 1.0);
			return;
		}
		float r8 = floor(clamp(sampleRgb.r / u_rgb24ChannelDivisor, 0.0, 255.0) + 0.5);
		float g8 = floor(clamp(sampleRgb.g / u_rgb24ChannelDivisor, 0.0, 255.0) + 0.5);
		float b8 = floor(clamp(sampleRgb.b / u_rgb24ChannelDivisor, 0.0, 255.0) + 0.5);
		float value24 = r8 * 65536.0 + g8 * 256.0 + b8;
		float gray = applyGamma(value24);
		outColor = vec4(vec3(gray), 1.0);
		return;
	}
	if (u_renderMode == 3 || u_renderMode == 5) {
		vec3 sampleRgb = u_renderMode == 3
			? texture(u_dataFloat, texCoord).rgb
			: vec3(texture(u_dataUint, texCoord).rgb);
		if (isnan(sampleRgb.r) || isinf(sampleRgb.r) || isnan(sampleRgb.g) || isinf(sampleRgb.g) || isnan(sampleRgb.b) || isinf(sampleRgb.b)
			|| (u_hasNodata && (sampleRgb.r == u_nodata || sampleRgb.g == u_nodata || sampleRgb.b == u_nodata))) {
			outColor = vec4(u_nanColor, 1.0);
			return;
		}
		outColor = vec4(
			applyGamma(sampleRgb.r),
			applyGamma(sampleRgb.g),
			applyGamma(sampleRgb.b),
			1.0
		);
		return;
	}
	float value = u_renderMode == 1
		? float(texture(u_dataUint, texCoord).r)
		: texture(u_dataFloat, texCoord).r;
	if (u_renderMode == 0) {
		vec4 sampleValue = texture(u_dataFloat, texCoord);
		if (isnan(sampleValue.r) || isinf(sampleValue.r) || isnan(sampleValue.g) || isinf(sampleValue.g) || isnan(sampleValue.b) || isinf(sampleValue.b)) {
			outColor = vec4(u_nanColor, 1.0);
			return;
		}
	}
	if (u_hasNodata && value == u_nodata) {
		outColor = vec4(u_nanColor, 1.0);
		return;
	}
	float normalized = applyGamma(value);
	if (u_useColormap) {
		outColor = vec4(texture(u_colormap, vec2(normalized, 0.5)).rgb, 1.0);
		return;
	}
	outColor = vec4(vec3(normalized), 1.0);
}`
        );
      if (!t || !i) return null;
      let n = e.createProgram();
      return n
        ? (e.attachShader(n, t),
          e.attachShader(n, i),
          e.linkProgram(n),
          e.deleteShader(t),
          e.deleteShader(i),
          e.getProgramParameter(n, e.LINK_STATUS)
            ? n
            : (console.warn('[WebGL2FloatRenderer] Program link failed:', e.getProgramInfoLog(n)),
              e.deleteProgram(n),
              null))
        : null;
    }
    _compileShader(e, t, i) {
      let n = e.createShader(t);
      return n
        ? (e.shaderSource(n, i),
          e.compileShader(n),
          e.getShaderParameter(n, e.COMPILE_STATUS)
            ? n
            : (console.warn('[WebGL2FloatRenderer] Shader compile failed:', e.getShaderInfoLog(n)),
              e.deleteShader(n),
              null))
        : null;
    }
  };
export {
  Ae as a,
  ge as b,
  J as c,
  A as d,
  Ge as e,
  $ as f,
  $e as g,
  Le as h,
  Z as i,
  he as j,
  pe as k,
  We as l,
  Pe as m,
  Se as n,
  ke as o,
  Be as p,
  S as q,
  q as r,
  le as s,
  ce as t,
  be as u,
};
