'use strict';
(() => {
  var v = new Uint8Array(new Uint16Array([1]).buffer)[0] === 1;
  function M(t) {
    return t === 9 || t === 10 || t === 13 || t === 32;
  }
  function b(t) {
    let r = [],
      e = 0;
    for (; r.length < 4;) {
      for (; e < t.length;)
        if (t[e] === 35) for (; e < t.length && t[e] !== 10 && t[e] !== 13;) e++;
        else if (M(t[e])) e++;
        else break;
      let n = e;
      for (; e < t.length && !M(t[e]) && t[e] !== 35;) e++;
      if (n === e) throw new Error('Invalid NetPBM header');
      r.push(String.fromCharCode(...t.subarray(n, e)));
    }
    if (t[e] === 13 && t[e + 1] === 10) e += 2;
    else if (M(t[e])) e++;
    else return null;
    return { tokens: r, rasterOffset: e };
  }
  function A(t) {
    if (!v) return null;
    let r = performance.now(),
      e = new Uint8Array(t);
    if (e.length < 2 || e[0] !== 80 || (e[1] !== 53 && e[1] !== 54)) return null;
    let n = b(e);
    if (!n) return null;
    let { tokens: o, rasterOffset: a } = n,
      [s, l, i, w] = o;
    if (s !== 'P5' && s !== 'P6') return null;
    let p = Number(l),
      d = Number(i),
      f = Number(w),
      y = s === 'P6' ? 3 : 1;
    if (
      !Number.isSafeInteger(p) ||
      p <= 0 ||
      !Number.isSafeInteger(d) ||
      d <= 0 ||
      !Number.isInteger(f) ||
      f < 1 ||
      f > 65535
    )
      throw new Error('Invalid NetPBM dimensions or maxval');
    let m = p * d * y,
      N = f > 255 ? 2 : 1,
      h = m * N;
    if (!Number.isSafeInteger(h) || a + h > t.byteLength)
      throw new Error('Insufficient data for binary PPM/PGM');
    let c;
    if (N === 1) c = e.subarray(a, a + h);
    else {
      e.copyWithin(0, a, a + h);
      let u = new Uint32Array(t, 0, Math.floor(h / 4));
      for (let g = 0; g < u.length; g++) {
        let P = u[g];
        u[g] = ((P & 16711935) << 8) | ((P & 4278255360) >>> 8);
      }
      if (((c = new Uint16Array(t, 0, m)), (m & 1) !== 0)) {
        let g = m - 1,
          P = c[g];
        c[g] = ((P & 255) << 8) | (P >>> 8);
      }
    }
    return {
      width: p,
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
      formatLabel: s === 'P6' ? 'PPM (Binary)' : 'PGM (Binary)',
      decodedWith: 'javascript-zero-copy (worker)',
      decodeTimings: [{ name: 'decode-ppm-js-zero-copy', durationMs: performance.now() - r }],
    };
  }
  function I(t) {
    let r = new DataView(t);
    if (t.byteLength < 10 || r.getUint32(0, !1) !== 2471384397 || r.getUint16(4, !1) !== 20569)
      throw new Error('Invalid NPY file');
    let e = r.getUint8(6);
    if (e !== 1 && e !== 2) return null;
    let n = e === 1 ? 10 : 12,
      o = e === 1 ? r.getUint16(8, !0) : r.getUint32(8, !0);
    if (n + o > t.byteLength) throw new Error('Invalid NPY file');
    let a = new TextDecoder('latin1').decode(new Uint8Array(t, n, o)),
      s = /'descr':\s*'([^']+)'/.exec(a)?.[1],
      l = /'shape':\s*\(([^)]+)\)/
        .exec(a)?.[1]
        .split(',')
        .map(i => i.trim())
        .filter(Boolean)
        .map(Number);
    if (!s || !l || !l.every(i => Number.isSafeInteger(i) && i >= 0))
      throw new Error('Invalid NPY header');
    return { dtype: s, shape: l, dataOffset: n + o };
  }
  function F(t, r = !0) {
    if (!v) return null;
    let e = performance.now();
    if (t.byteLength < 6 || new Uint8Array(t, 0, 6)[0] !== 147) return null;
    let n = I(t);
    if (
      !n ||
      (n.dtype !== '<f4' && n.dtype !== '=f4') ||
      (n.shape.length !== 2 && n.shape.length !== 3)
    )
      return null;
    let [o, a, s = 1] = n.shape;
    if (s !== 1 && s !== 3 && s !== 4) return null;
    let l = a * o * s;
    if (n.dataOffset % 4 !== 0 || n.dataOffset + l * 4 > t.byteLength) return null;
    let i = new Float32Array(t, n.dataOffset, l),
      w,
      p,
      d;
    if (r) {
      let f = 1 / 0,
        y = -1 / 0;
      ((p = 0), (d = 0));
      let m = s >= 3 ? 3 : 1;
      for (let N = 0; N < a * o; N++) {
        let h = N * s;
        for (let c = 0; c < m; c++) {
          let u = i[h + c];
          Number.isFinite(u) ? (u < f && (f = u), u > y && (y = u), p++) : d++;
        }
      }
      w = { min: f, max: y };
    }
    return {
      width: a,
      height: o,
      channels: s,
      data: i,
      metadata: { dtype: n.dtype },
      numericDomain: {
        bitsPerSample: 32,
        sampleFormat: 3,
        typeMin: 0,
        typeMax: 1,
        sourceNumericType: 'float32',
      },
      stats: w,
      validCount: p,
      nonFiniteCount: d,
      decodedWith: 'javascript-zero-copy (worker)',
      decodeTimings: [{ name: 'decode-npy-js-zero-copy', durationMs: performance.now() - e }],
    };
  }
  function x(t, r) {
    for (; r.offset < t.length && (t[r.offset] === 10 || t[r.offset] === 13);) r.offset++;
    let e = r.offset;
    for (; r.offset < t.length && t[r.offset] !== 10 && t[r.offset] !== 13;) r.offset++;
    let n = r.offset;
    for (; n > e && (t[n - 1] === 9 || t[n - 1] === 32);) n--;
    let o = new TextDecoder('latin1').decode(t.subarray(e, n)).trim();
    for (; r.offset < t.length && (t[r.offset] === 10 || t[r.offset] === 13);) r.offset++;
    return o;
  }
  function U(t) {
    if (!v) return null;
    let r = performance.now(),
      e = new Uint8Array(t),
      n = { offset: 0 },
      o = x(e, n);
    for (; !o && n.offset < e.length;) o = x(e, n);
    if (o !== 'PF' && o !== 'Pf') return null;
    let a = x(e, n);
    for (; (!a || a.startsWith('#')) && n.offset < e.length;) a = x(e, n);
    let s = /^(\d+)\s+(\d+)$/.exec(a);
    if (!s) return null;
    let l = Number(s[1]),
      i = Number(s[2]),
      w = x(e, n);
    for (; (!w || w.startsWith('#')) && n.offset < e.length;) w = x(e, n);
    let p = Number(w);
    if (!Number.isFinite(p) || p >= 0) return null;
    let d = o === 'PF' ? 3 : 1,
      f = l * i * d,
      y = f * 4;
    if (!Number.isSafeInteger(f) || l < 1 || i < 1 || n.offset + y > e.length) return null;
    e.copyWithin(0, n.offset, n.offset + y);
    let m = l * d * 4;
    if (i > 1) {
      let N = new Uint8Array(m);
      for (let h = 0, c = i - 1; h < c; h++, c--) {
        let u = h * m,
          g = c * m;
        (N.set(e.subarray(u, u + m)), e.copyWithin(u, g, g + m), e.set(N, g));
      }
    }
    return {
      width: l,
      height: i,
      channels: d,
      data: new Float32Array(t, 0, f),
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
  self.onmessage = t => {
    let r = t.data;
    if (r.type === 'init') {
      self.postMessage({ type: 'ready' });
      return;
    }
    let { id: e, format: n, buffer: o, options: a } = r;
    try {
      let s =
        n === 'ppm' ? A(o) : n === 'npy' ? F(o, a?.computeStats !== !1) : n === 'pfm' ? U(o) : null;
      if (!s) {
        self.postMessage({ id: e, ok: !1, error: 'fast path unsupported', buffer: o }, [o]);
        return;
      }
      self.postMessage({ id: e, ok: !0, result: s }, [o]);
    } catch (s) {
      self.postMessage(
        { id: e, ok: !1, error: s instanceof Error ? s.message : String(s), buffer: o },
        [o]
      );
    }
  };
})();
