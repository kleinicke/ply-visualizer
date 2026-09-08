function st(n) {
  let o = Number(n?.width || 0),
    r = Number(n?.height || 0),
    a = Math.max(1, Number(n?.channels || 1)),
    t = Math.max(1, Math.ceil(Number(n?.bits_per_sample || 8) / 8));
  return o * r * a * t;
}
function V(n, o = 8) {
  let r = Math.max(0, Number(n?.strip_count || 0)),
    a = Math.max(0, Math.min(8, Math.floor(o)));
  if (r < 2 || a < 2) return 0;
  if (Number(n?.compression) === 34925) {
    let t = Math.max(2, Math.ceil(st(n) / 2097152));
    return Math.min(r, a, t);
  }
  return Math.min(r, a);
}
function Q(n) {
  let o = Number(n?.strip_count || 0),
    r = Number(n?.width || 0),
    a = Number(n?.height || 0);
  if (
    Number(n?.compression) === 1 &&
    Number(n?.sample_format || 1) === 1 &&
    Number(n?.bits_per_sample || 8) <= 16
  )
    return !1;
  let t = Number(n?.compression) === 34925 || Number(n?.tile_length || 0) > 0 ? 2 : 16;
  return o >= t && r > 0 && a > 0 && r * a >= 2e6 && V(n) >= 2;
}
var tt = 8;
function ut(n, o) {
  return o === 1 && n === 8
    ? 'u8'
    : o === 1 && n === 16
      ? 'u16'
      : o === 3 && n === 32
        ? 'f32'
        : null;
}
var D = class {
    constructor() {
      this._workers = [];
      this._blobUrl = null;
      this._module = null;
      this._bootPromise = null;
      this._nextId = 1;
    }
    get size() {
      return this._workers.length;
    }
    async ensure(o, r = tt) {
      o && (this._module = o);
      let a = globalThis.navigator?.hardwareConcurrency || 4,
        t = Math.max(2, Math.min(tt, r, a - 1));
      return this._workers.length >= t ||
        (this._bootPromise && (await this._bootPromise, this._workers.length >= t))
        ? !0
        : (this._bootPromise
            ? (this._bootPromise = this._spawn(this._module, t).catch(
                e => (
                  console.warn('[StripPool] Could not grow worker pool:', e),
                  this._workers.length >= 2
                )
              ))
            : (this._bootPromise = this._boot(t).catch(
                e => (
                  console.warn('[StripPool] Unavailable, falling back to single-worker decode:', e),
                  this._teardown(),
                  !1
                )
              )),
          this._bootPromise);
    }
    async _boot(o) {
      let r = [
        new URL('../stripDecodeWorker.bundle.js', import.meta.url).href,
        new URL('./stripDecodeWorker.bundle.js', import.meta.url).href,
      ];
      if (!this._blobUrl) {
        let l = null;
        for (let h of r)
          try {
            let m = await fetch(h);
            if (m.ok) {
              l = await m.text();
              break;
            }
          } catch {}
        if (!l) throw new Error('stripDecodeWorker.bundle.js not found');
        this._blobUrl = URL.createObjectURL(new Blob([l], { type: 'text/javascript' }));
      }
      if (this._module) return this._spawn(this._module, o);
      let a = globalThis.__tiffVisualizerDecoderWarmup;
      if (a?.wasmModulePromise)
        try {
          return ((this._module = await a.wasmModulePromise), this._spawn(this._module, o));
        } catch {}
      let t = [
          globalThis.__tiffVisualizerVendorAssets?.wasm,
          new URL('./wasm/tiff-wasm.wasm', import.meta.url).href,
          new URL('../wasm/tiff-wasm.wasm', import.meta.url).href,
        ].filter(l => typeof l == 'string' && l.length > 0),
        e = null;
      for (let l of t)
        try {
          let h = await fetch(l);
          if (h.ok) {
            e = await WebAssembly.compile(await h.arrayBuffer());
            break;
          }
        } catch {}
      if (!e) throw new Error('tiff-wasm.wasm not found for the strip pool');
      return ((this._module = e), this._spawn(e, o));
    }
    async _spawn(o, r) {
      let a = Math.max(0, r - this._workers.length),
        t = await Promise.all(
          Array.from(
            { length: a },
            () =>
              new Promise(e => {
                let l = new Worker(this._blobUrl, { type: 'module' }),
                  h = setTimeout(() => e(null), 2e4);
                ((l.onmessage = m => {
                  m.data?.type === 'ready' &&
                    (clearTimeout(h), e(m.data.error ? null : { worker: l, busy: !1 }));
                }),
                  (l.onerror = () => {
                    (clearTimeout(h), e(null));
                  }),
                  l.postMessage({ type: 'init', tiffWasmModule: o }));
              })
          )
        );
      if ((this._workers.push(...t.filter(e => e !== null)), !this._workers.length))
        throw new Error('no strip workers booted');
      return (console.log(`[StripPool] Ready with ${this._workers.length} workers`), !0);
    }
    run(o, r, a) {
      let t = this._workers[a % this._workers.length],
        e = this._nextId++;
      return new Promise((l, h) => {
        let m = u => {
          u.data?.id === e &&
            (t.worker.removeEventListener('message', m),
            (t.busy = !1),
            u.data.error ? h(new Error(u.data.error)) : l(u.data));
        };
        (t.worker.addEventListener('message', m),
          (t.busy = !0),
          t.worker.postMessage({ id: e, ...o }, r));
      });
    }
    retire() {
      for (let o of this._workers) o.worker.terminate();
      ((this._workers = []), (this._bootPromise = null));
    }
    _teardown() {
      (this.retire(),
        this._blobUrl && (URL.revokeObjectURL(this._blobUrl), (this._blobUrl = null)));
    }
  },
  S = new D(),
  ct = new D(),
  et = new D(),
  H = new WeakMap(),
  mt = 0;
async function pt(n, o, r, a) {
  if (a?.aborted) return null;
  if (!H.has(n)) {
    let s,
      b = null;
    try {
      ((s = o.tiff_float_strip_plan(new Uint8Array(n))),
        s &&
          !s.tile_width &&
          s.planar_configuration === 1 &&
          s.orientation === 1 &&
          s.channels === 1 &&
          s.bits_per_sample === 32 &&
          s.sample_format === 3 &&
          s.width * Math.min(s.rows_per_strip, s.height) <= 8e6 &&
          !rt.has(s.compression) &&
          (b = {
            offsets: s.offsets,
            counts: s.counts,
            job: {
              width: s.width,
              height: s.height,
              channels: s.channels,
              bitsPerSample: s.bits_per_sample,
              sampleFormat: s.sample_format,
              compression: s.compression,
              predictor: s.predictor,
              rowsPerStrip: s.rows_per_strip,
              littleEndian: s.little_endian,
              photometricInterpretation: s.photometric_interpretation,
            },
          }));
    } catch {
    } finally {
      s?.free();
    }
    H.set(n, b);
  }
  let t = H.get(n);
  if (!t) return null;
  let { job: e, offsets: l, counts: h } = t,
    m = r.y / e.rowsPerStrip;
  if (
    r.x !== 0 ||
    r.width !== e.width ||
    !Number.isInteger(m) ||
    m < 0 ||
    m >= h.length ||
    r.height !== Math.min(e.rowsPerStrip, e.height - r.y)
  )
    return null;
  let u = l[m],
    p = h[m];
  if (
    !Number.isSafeInteger(u) ||
    !Number.isSafeInteger(p) ||
    u < 0 ||
    p <= 0 ||
    p > 4294967295 ||
    u + p > n.byteLength
  )
    return null;
  try {
    if (!(await et.ensure(void 0, 4)) || a?.aborted) return null;
    let s = n.slice(u, u + p),
      b = new Uint32Array([p]),
      y = await et.run({ ...e, firstStrip: m, blob: s, counts: b.buffer }, [s, b.buffer], mt++);
    return a?.aborted || y.samples?.length !== r.width * r.height * e.channels
      ? null
      : {
          width: r.width,
          height: r.height,
          channels: e.channels,
          bitsPerSample: e.bitsPerSample,
          sampleFormat: e.sampleFormat,
          blocksDecoded: 1,
          data: y.samples,
        };
  } catch (s) {
    return (console.warn('[DetailPool] Strip failed, using region decoder:', s), null);
  }
}
var rt = new Set([34887, 34925, 34712, 33003, 33004, 33005, 34934, 22610]);
function bt() {
  S.ensure();
}
async function dt(n) {
  let { width: o, height: r, dataY: a, counts: t, yCoordinates: e, compressed: l } = n;
  if (t.length < 16 || t.length !== e.length || o * r < 2e6 || !(await S.ensure()) || S.size < 2)
    return null;
  let h = new Uint32Array(t.length),
    m = new Uint32Array(t.length),
    u = 0;
  for (let i = 0; i < t.length; i++) {
    let P = e[i] - a;
    if (P !== i * 16 || P >= r) return null;
    ((h[i] = Math.min(16, r - P)), (m[i] = u), (u += t[i]));
  }
  if (u !== l.byteLength) return null;
  let p = Math.min(S.size, t.length),
    s = u / p,
    b = [],
    y = 0;
  for (let i = 0; i < p && y < t.length; i++) {
    let P = p - i,
      d = t.length - (P - 1),
      _ = y,
      x = 0;
    for (; _ < d && (x < s || _ === y);) x += t[_++];
    (i === p - 1 && (_ = t.length), b.push({ first: y, last: _ }), (y = _));
  }
  let R = performance.now(),
    N = b.map((i, P) => {
      let d = m[i.first],
        _ = i.last - 1,
        x = m[_] + t[_],
        F = l.slice(d, x),
        k = t.slice(i.first, i.last),
        T = h.slice(i.first, i.last);
      return S.run(
        { kind: 'exr-zip', blob: F.buffer, counts: k.buffer, rows: T.buffer, width: o },
        [F.buffer, k.buffer, T.buffer],
        P
      );
    }),
    I = new Float32Array(o * r),
    U = 1 / 0,
    C = -1 / 0;
  try {
    await Promise.all(
      N.map(async (i, P) => {
        let d = await i,
          _ = e[b[P].first] - a;
        (I.set(d.samples, _ * o), d.min < U && (U = d.min), d.max > C && (C = d.max));
      })
    );
  } catch (i) {
    return (console.warn('[StripPool] EXR ZIP range failed, falling back:', i), null);
  }
  let v = performance.now() - R;
  return (
    I.byteLength >= 64 * 1024 * 1024 &&
      (S.retire(),
      setTimeout(() => {
        S.ensure();
      }, 0)),
    { data: I, min: U, max: C, workers: b.length, durationMs: v }
  );
}
async function _t(n, o) {
  if (!o || typeof o.tiff_float_strip_plan != 'function') return null;
  let r = new Uint8Array(n),
    a = performance.now(),
    t;
  try {
    t = o.tiff_float_strip_plan(r);
  } catch {
    return null;
  }
  if (!t) return null;
  let e = t.strip_count,
    l = t.width,
    h = t.height;
  if (!Q(t)) return null;
  let m = V(t),
    u = S;
  if (rt.has(Number(t.compression)))
    try {
      let { codecWasmModule: c } = await import('./codec-wasm-wrapper-NJAWPBBK.js'),
        g = await c();
      if (((u = ct), !(await u.ensure(g, m)))) return null;
    } catch (c) {
      return (
        console.warn('[StripPool] Extended codec module unavailable, falling back:', c),
        null
      );
    }
  else if (!(await u.ensure(void 0, m))) return null;
  if (u.size < 2) return null;
  let p = Number(t.photometric_interpretation) === 5 ? 3 : t.channels,
    s = t.offsets,
    b = t.counts,
    y = t.rows_per_strip,
    R = t.blocks_per_unit || 1,
    N = t.tile_width || 0,
    I = t.tile_length || 0,
    U = t.blocks_across || 1,
    C = t.lerc_additional_compression || 0,
    v = c => {
      let g = 0;
      for (let f = 0; f < R; f++) g += b[c * R + f];
      return g;
    },
    i = [{ name: 'strip-plan', durationMs: performance.now() - a }],
    P = (async () => {
      let c = performance.now();
      try {
        let g = o.tiff_strip_metadata(r);
        return (i.push({ name: 'strip-metadata', durationMs: performance.now() - c }), g);
      } catch {
        return null;
      }
    })(),
    d = Math.min(u.size, e, m),
    _ = 0;
  for (let c = 0; c < e; c++) _ += v(c);
  let x = _ / d,
    F = [],
    k = 0;
  for (let c = 0; c < d && k < e; c++) {
    let g = d - c,
      f = e - k,
      M = 0,
      w = k,
      E = e - (g - 1);
    for (; w < E && (M < x || w === k);) ((M += v(w)), w++);
    (c === d - 1 && (w = e), F.push({ first: k, last: w }), (k = w), f <= g);
  }
  let T = ut(t.bits_per_sample, t.sample_format),
    nt = performance.now(),
    ot = F.map((c, g) => {
      let f = c.first * R,
        M = c.last * R,
        w = 0;
      for (let A = f; A < M; A++) w += b[A];
      let E = new Uint8Array(w),
        L = new Uint32Array(M - f),
        O = 0;
      for (let A = f; A < M; A++) {
        let G = s[A],
          Y = b[A];
        (E.set(r.subarray(G, G + Y), O), (O += Y), (L[A - f] = Y));
      }
      return u.run(
        {
          raw: !!T,
          blob: E.buffer,
          counts: L.buffer,
          firstStrip: c.first,
          width: l,
          height: h,
          channels: t.channels,
          outputChannels: p,
          bitsPerSample: t.bits_per_sample,
          compression: t.compression,
          rowsPerStrip: y,
          predictor: t.predictor,
          sampleFormat: t.sample_format,
          littleEndian: t.little_endian,
          planarConfiguration: t.planar_configuration || 1,
          orientation: t.orientation || 1,
          tileWidth: N,
          tileLength: I,
          blocksAcross: U,
          lercAdditionalCompression: C,
          photometricInterpretation: t.photometric_interpretation || 1,
        },
        [E.buffer, L.buffer],
        g
      );
    }),
    j = Number(t.orientation || 1),
    $ = j >= 5 && j <= 8,
    X = $ ? h : l,
    Z = $ ? l : h,
    z = X * Z * p,
    B = T === 'u8' ? new Uint8Array(z) : T === 'u16' ? new Uint16Array(z) : new Float32Array(z),
    K = 1 / 0,
    J = -1 / 0,
    q = 0;
  try {
    await Promise.all(
      ot.map(async (c, g) => {
        let f = await c,
          M = performance.now();
        if (f.transposed) {
          let w = Number(f.bandWidth),
            E = Number(f.destinationStart);
          for (let L = 0; L < Z; L++) {
            let O = L * w * p,
              A = (L * X + E) * p;
            B.set(f.samples.subarray(O, O + w * p), A);
          }
        } else B.set(f.samples, Number(f.destinationStart) * l * p);
        ((q += performance.now() - M), f.min < K && (K = f.min), f.max > J && (J = f.max));
      })
    );
  } catch (c) {
    return (console.warn('[StripPool] Range decode failed, falling back:', c), null);
  }
  (i.push({ name: 'strip-workers', durationMs: performance.now() - nt }),
    i.push({ name: 'strip-assemble', durationMs: q }),
    j !== 1 && i.push({ name: 'orientation-fused', durationMs: 0 }));
  let W = await P;
  return (
    B.byteLength >= 64 * 1024 * 1024 &&
      (u.retire(),
      setTimeout(() => {
        u.ensure();
      }, 0),
      i.push({ name: 'strip-pool-retired', durationMs: 0 })),
    {
      tileWidth: N,
      tileLength: I,
      tileCount: N > 0 ? b.length : 0,
      width: X,
      height: Z,
      channels: p,
      bitsPerSample: t.bits_per_sample,
      sampleFormat: t.sample_format,
      compression: t.compression,
      predictor: t.predictor,
      planarConfiguration: t.planar_configuration || 1,
      rowsPerStrip: y,
      stripCount: e,
      photometricInterpretation: W?.photometric_interpretation ?? 1,
      pageCount: W?.page_count ?? 1,
      allTagsJson: W?.all_tags_json ?? '[]',
      omeXml: W?.ome_xml || void 0,
      geoJson: W?.geo_json || void 0,
      pageDirectoryJson: W?.page_directory_json || void 0,
      data: B,
      min: K,
      max: J,
      workers: F.length,
      timings: i,
    }
  );
}
export { pt as a, bt as b, dt as c, _t as d };
