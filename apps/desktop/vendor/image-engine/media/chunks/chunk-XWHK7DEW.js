var U = new Uint8Array(new Uint16Array([1]).buffer)[0] === 1;
function A(n) {
  return n === 9 || n === 10 || n === 13 || n === 32;
}
function v(n) {
  let r = [],
    e = 0;
  for (; r.length < 4;) {
    for (; e < n.length;)
      if (n[e] === 35) for (; e < n.length && n[e] !== 10 && n[e] !== 13;) e++;
      else if (A(n[e])) e++;
      else break;
    let t = e;
    for (; e < n.length && !A(n[e]) && n[e] !== 35;) e++;
    if (t === e) throw new Error('Invalid NetPBM header');
    r.push(String.fromCharCode(...n.subarray(t, e)));
  }
  if (n[e] === 13 && n[e + 1] === 10) e += 2;
  else if (A(n[e])) e++;
  else return null;
  return { tokens: r, rasterOffset: e };
}
function M(n) {
  if (!U) return null;
  let r = performance.now(),
    e = new Uint8Array(n);
  if (e.length < 2 || e[0] !== 80 || (e[1] !== 53 && e[1] !== 54)) return null;
  let t = v(e);
  if (!t) return null;
  let { tokens: o, rasterOffset: a } = t,
    [i, l, s, g] = o;
  if (i !== 'P5' && i !== 'P6') return null;
  let h = Number(l),
    d = Number(s),
    f = Number(g),
    y = i === 'P6' ? 3 : 1;
  if (
    !Number.isSafeInteger(h) ||
    h <= 0 ||
    !Number.isSafeInteger(d) ||
    d <= 0 ||
    !Number.isInteger(f) ||
    f < 1 ||
    f > 65535
  )
    throw new Error('Invalid NetPBM dimensions or maxval');
  let m = h * d * y,
    N = f > 255 ? 2 : 1,
    p = m * N;
  if (!Number.isSafeInteger(p) || a + p > n.byteLength)
    throw new Error('Insufficient data for binary PPM/PGM');
  let c;
  if (N === 1) c = e.subarray(a, a + p);
  else {
    e.copyWithin(0, a, a + p);
    let u = new Uint32Array(n, 0, Math.floor(p / 4));
    for (let w = 0; w < u.length; w++) {
      let P = u[w];
      u[w] = ((P & 16711935) << 8) | ((P & 4278255360) >>> 8);
    }
    if (((c = new Uint16Array(n, 0, m)), (m & 1) !== 0)) {
      let w = m - 1,
        P = c[w];
      c[w] = ((P & 255) << 8) | (P >>> 8);
    }
  }
  return {
    width: h,
    height: d,
    channels: y,
    data: c,
    numericDomain: {
      bitsPerSample: f > 255 ? 16 : 8,
      sampleFormat: 1,
      typeMin: 0,
      typeMax: f,
      sourceNumericType: f > 255 ? 'uint16' : 'uint8',
    },
    stats: void 0,
    formatLabel: i === 'P6' ? 'PPM (Binary)' : 'PGM (Binary)',
    decodedWith: 'javascript-zero-copy (worker)',
    decodeTimings: [{ name: 'decode-ppm-js-zero-copy', durationMs: performance.now() - r }],
  };
}
function I(n) {
  let r = new DataView(n);
  if (n.byteLength < 10 || r.getUint32(0, !1) !== 2471384397 || r.getUint16(4, !1) !== 20569)
    throw new Error('Invalid NPY file');
  let e = r.getUint8(6);
  if (e !== 1 && e !== 2) return null;
  let t = e === 1 ? 10 : 12,
    o = e === 1 ? r.getUint16(8, !0) : r.getUint32(8, !0);
  if (t + o > n.byteLength) throw new Error('Invalid NPY file');
  let a = new TextDecoder('latin1').decode(new Uint8Array(n, t, o)),
    i = /'descr':\s*'([^']+)'/.exec(a)?.[1],
    l = /'shape':\s*\(([^)]+)\)/
      .exec(a)?.[1]
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
      .map(Number);
  if (!i || !l || !l.every(s => Number.isSafeInteger(s) && s >= 0))
    throw new Error('Invalid NPY header');
  return { dtype: i, shape: l, dataOffset: t + o };
}
function b(n, r = !0) {
  if (!U) return null;
  let e = performance.now();
  if (n.byteLength < 6 || new Uint8Array(n, 0, 6)[0] !== 147) return null;
  let t = I(n);
  if (
    !t ||
    (t.dtype !== '<f4' && t.dtype !== '=f4') ||
    (t.shape.length !== 2 && t.shape.length !== 3)
  )
    return null;
  let [o, a, i = 1] = t.shape;
  if (i !== 1 && i !== 3 && i !== 4) return null;
  let l = a * o * i;
  if (t.dataOffset % 4 !== 0 || t.dataOffset + l * 4 > n.byteLength) return null;
  let s = new Float32Array(n, t.dataOffset, l),
    g,
    h,
    d;
  if (r) {
    let f = 1 / 0,
      y = -1 / 0;
    ((h = 0), (d = 0));
    let m = i >= 3 ? 3 : 1;
    for (let N = 0; N < a * o; N++) {
      let p = N * i;
      for (let c = 0; c < m; c++) {
        let u = s[p + c];
        Number.isFinite(u) ? (u < f && (f = u), u > y && (y = u), h++) : d++;
      }
    }
    g = { min: f, max: y };
  }
  return {
    width: a,
    height: o,
    channels: i,
    data: s,
    metadata: { dtype: t.dtype },
    numericDomain: {
      bitsPerSample: 32,
      sampleFormat: 3,
      typeMin: 0,
      typeMax: 1,
      sourceNumericType: 'float32',
    },
    stats: g,
    validCount: h,
    nonFiniteCount: d,
    decodedWith: 'javascript-zero-copy (worker)',
    decodeTimings: [{ name: 'decode-npy-js-zero-copy', durationMs: performance.now() - e }],
  };
}
function x(n, r) {
  for (; r.offset < n.length && (n[r.offset] === 10 || n[r.offset] === 13);) r.offset++;
  let e = r.offset;
  for (; r.offset < n.length && n[r.offset] !== 10 && n[r.offset] !== 13;) r.offset++;
  let t = r.offset;
  for (; t > e && (n[t - 1] === 9 || n[t - 1] === 32);) t--;
  let o = new TextDecoder('latin1').decode(n.subarray(e, t)).trim();
  for (; r.offset < n.length && (n[r.offset] === 10 || n[r.offset] === 13);) r.offset++;
  return o;
}
function F(n) {
  if (!U) return null;
  let r = performance.now(),
    e = new Uint8Array(n),
    t = { offset: 0 },
    o = x(e, t);
  for (; !o && t.offset < e.length;) o = x(e, t);
  if (o !== 'PF' && o !== 'Pf') return null;
  let a = x(e, t);
  for (; (!a || a.startsWith('#')) && t.offset < e.length;) a = x(e, t);
  let i = /^(\d+)\s+(\d+)$/.exec(a);
  if (!i) return null;
  let l = Number(i[1]),
    s = Number(i[2]),
    g = x(e, t);
  for (; (!g || g.startsWith('#')) && t.offset < e.length;) g = x(e, t);
  let h = Number(g);
  if (!Number.isFinite(h) || h >= 0) return null;
  let d = o === 'PF' ? 3 : 1,
    f = l * s * d,
    y = f * 4;
  if (!Number.isSafeInteger(f) || l < 1 || s < 1 || t.offset + y > e.length) return null;
  e.copyWithin(0, t.offset, t.offset + y);
  let m = l * d * 4;
  if (s > 1) {
    let N = new Uint8Array(m);
    for (let p = 0, c = s - 1; p < c; p++, c--) {
      let u = p * m,
        w = c * m;
      (N.set(e.subarray(u, u + m)), e.copyWithin(u, w, w + m), e.set(N, w));
    }
  }
  return {
    width: l,
    height: s,
    channels: d,
    data: new Float32Array(n, 0, f),
    numericDomain: {
      bitsPerSample: 32,
      sampleFormat: 3,
      typeMin: 0,
      typeMax: 1,
      sourceNumericType: 'float32',
    },
    stats: void 0,
    formatLabel: '',
    decodedWith: 'javascript-zero-copy (worker)',
    decodeTimings: [{ name: 'decode-pfm-js-zero-copy', durationMs: performance.now() - r }],
  };
}
export { M as a, b, F as c };
