var $ = class {
  constructor(t) {
    this.limit = t;
    this.active = 0;
    this.queue = [];
  }
  run(t, e, r = 0) {
    return new Promise((i, a) => {
      let o = () => {
          let u = this.queue.indexOf(s);
          (u >= 0 && this.queue.splice(u, 1),
            e?.removeEventListener('abort', o),
            a(new DOMException('Request cancelled', 'AbortError')));
        },
        s = {
          priority: r,
          cancel: o,
          run: () => {
            (e?.removeEventListener('abort', o),
              this.active++,
              Promise.resolve()
                .then(t)
                .then(i, a)
                .finally(() => {
                  (this.active--, this.drain());
                }));
          },
        };
      if (e?.aborted) {
        o();
        return;
      }
      (e?.addEventListener('abort', o, { once: !0 }),
        this.queue.push(s),
        this.queue.sort((u, c) => c.priority - u.priority),
        this.drain());
    });
  }
  drain() {
    for (; this.active < this.limit && this.queue.length;) this.queue.shift().run();
  }
};
var X = { 273: 'StripOffsets', 279: 'StripByteCounts', 324: 'TileOffsets', 325: 'TileByteCounts' },
  v = 16 * 1024,
  q = 16 * 1024 * 1024;
function C(n) {
  if (n?.aborted) throw new DOMException('TIFF request cancelled', 'AbortError');
}
var L = class {
  constructor(t, e) {
    this.url = t;
    this.loadSignal = e;
    this.cache = new Map();
    this.bytes = 0;
    this.size = null;
    this.scheduler = new $(16);
  }
  get fileSize() {
    return this.size;
  }
  setLoadSignal(t) {
    (this.loadSignal?.aborted && (this.cache.clear(), (this.bytes = 0)), (this.loadSignal = t));
  }
  request(t, e, r, i = 0) {
    return this.scheduler.run(() => this.networkRequest(t, e, r), r, i);
  }
  async networkRequest(t, e, r) {
    if (
      (C(r),
      !Number.isSafeInteger(t) ||
        !Number.isSafeInteger(e) ||
        t < 0 ||
        e < 0 ||
        !Number.isSafeInteger(t + e))
    )
      throw new Error('Invalid TIFF byte range');
    if (!e) return new ArrayBuffer(0);
    let i = await fetch(this.url, {
      headers: { Range: `bytes=${t}-${t + e - 1}` },
      cache: 'no-store',
      signal: r,
    });
    if (i.status !== 206)
      throw (
        await i.body?.cancel(),
        i.ok
          ? new Error(`TIFF server must support byte ranges (HTTP ${i.status})`)
          : new Error(`TIFF request failed: HTTP ${i.status} ${i.statusText}`)
      );
    let a = i.headers.get('content-range');
    if (a) {
      let s = /^bytes (\d+)-(\d+)\/(\d+|\*)$/i.exec(a);
      if (!s || Number(s[1]) !== t || Number(s[2]) >= t + e)
        throw (await i.body?.cancel(), new Error('TIFF server returned an unexpected range'));
      s[3] !== '*' && (this.size = Number(s[3]));
    }
    let o = await i.arrayBuffer();
    if (
      (o.byteLength < e && this.size === null && (this.size = t + o.byteLength), o.byteLength > e)
    )
      throw new Error('TIFF range response exceeds requested length');
    return o;
  }
  cached(t, e, r) {
    C(r);
    let i = `${t}:${e}`,
      a = this.cache.get(i);
    if (a) return (this.cache.delete(i), this.cache.set(i, a), a.promise.then(s => (C(r), s)));
    let o = this.request(t, e, this.loadSignal, 1).catch(s => {
      throw (this.cache.get(i)?.promise === o && (this.cache.delete(i), (this.bytes -= e)), s);
    });
    for (
      this.cache.set(i, { promise: o, size: e }), this.bytes += e;
      this.bytes > q && this.cache.size > 1;
    ) {
      let s = this.cache.keys().next().value;
      ((this.bytes -= this.cache.get(s).size), this.cache.delete(s));
    }
    return o.then(s => (C(r), s));
  }
  async header(t, e, r) {
    if (!Number.isSafeInteger(t) || !Number.isSafeInteger(e) || t < 0 || e < 0 || e > q)
      throw new Error('TIFF metadata range is too large or invalid');
    this.size !== null && (e = Math.min(e, Math.max(0, this.size - t)));
    let i = Math.floor(t / v) * v,
      a = await Promise.all(
        Array.from({ length: Math.ceil((t + e - i) / v) }, (u, c) => this.cached(i + c * v, v, r))
      ),
      o = new Uint8Array(a.reduce((u, c) => u + c.byteLength, 0)),
      s = 0;
    for (let u of a) (o.set(new Uint8Array(u), s), (s += u.byteLength));
    return o.slice(t - i, t - i + e).buffer;
  }
  async fetch(t, e) {
    return Promise.all(t.map(r => this.request(r.offset, r.length, e || this.loadSignal)));
  }
  async close() {
    (this.cache.clear(), (this.bytes = 0));
  }
};
async function H(n, t, e) {
  let r = e,
    i = await t.fromCustomClient(
      {
        request: async ({ headers: a, signal: o }) => {
          let s = await fetch(n, { headers: a, signal: o || r, cache: 'no-store' });
          if (s.status !== 206)
            throw (
              await s.body?.cancel(),
              s.ok
                ? new Error(`TIFF server must support byte ranges (HTTP ${s.status})`)
                : new Error(`TIFF request failed: HTTP ${s.status} ${s.statusText}`)
            );
          return {
            ok: s.ok,
            status: s.status,
            getHeader: u => s.headers.get(u),
            getData: () => s.arrayBuffer(),
          };
        },
      },
      { blockSize: 64 * 1024, cacheSize: 256, allowFullFile: !1 },
      e
    );
  return (
    (i.setLoadSignal = a => {
      r = a;
    }),
    i
  );
}
async function pe(n, t, e, r) {
  if (!e?.remote_tiff_ifd || !t.GeoTIFF?.fromSource || !t.GeoTIFFImage?.prototype?.getTileOrStrip)
    return H(n, t, r);
  let i = new L(n, r),
    a = new Uint8Array(await i.header(0, 16, r)),
    o = JSON.parse(e.remote_tiff_header(a)),
    s = [],
    u = new Set(),
    c = o.firstOffset;
  try {
    for (; c;) {
      if ((C(r), u.has(c) || s.length >= 4096)) throw new Error('Invalid TIFF directory chain');
      u.add(c);
      let b = new Uint8Array(await i.header(c, 8, r)),
        m = JSON.parse(e.remote_tiff_ifd(a, b, c));
      if (
        (b.length < m.length &&
          ((b = new Uint8Array(await i.header(c, m.length, r))),
          (m = JSON.parse(e.remote_tiff_ifd(a, b, c)))),
        !m.tables)
      )
        throw new Error('Truncated TIFF directory');
      (s.push(m), (c = m.nextOffset));
    }
  } catch (b) {
    if ((C(r), await i.close(), !String(b).includes('Unsupported TIFF block index type'))) throw b;
    return (
      console.warn('[RemoteTIFF] Lazy index unsupported; using existing directory reader:', b),
      H(n, t, r)
    );
  }
  let l = s.flatMap(b => b.patches),
    p = {
      get fileSize() {
        return i.fileSize;
      },
      close: () => i.close(),
      fetch: async (b, m) =>
        Promise.all(
          b.map(async w => {
            let h = new Uint8Array(await i.header(w.offset, w.length, m));
            for (let T of l) {
              let d = Math.max(w.offset, T.offset),
                f = Math.min(w.offset + h.length, T.offset + T.bytes.length);
              f > d && h.set(T.bytes.slice(d - T.offset, f - T.offset), d - w.offset);
            }
            return h.buffer;
          })
        ),
    },
    y = await t.GeoTIFF.fromSource(p, { cache: !1 }, r);
  y.setLoadSignal = b => i.setLoadSignal(b);
  let N = y.getImage.bind(y),
    S = new Map();
  return (
    (y.getImage = (b = 0) => (
      S.has(b) ||
        S.set(
          b,
          (async () => {
            let m = await N(b),
              w = s[b]?.tables || [];
            m.source = i;
            for (let d of w) {
              let f = Object.create(null);
              (Object.defineProperties(f, {
                length: { value: d.count },
                lazyTiffIndex: { value: !0 },
              }),
                (m.fileDirectory[X[d.tag]] = f));
            }
            let h = new Map(),
              T = m.getTileOrStrip.bind(m);
            return (
              (m.getTileOrStrip = async (d, f, g, O, I) => {
                let M = Math.ceil(m.getWidth() / m.getTileWidth()),
                  A = Math.ceil(m.getHeight() / m.getTileHeight()),
                  x = f * M + d + (m.planarConfiguration === 2 ? g * M * A : 0);
                return (
                  await Promise.all(
                    w.map(async P => {
                      if (!Number.isSafeInteger(x) || x < 0 || x >= P.count)
                        throw new Error('TIFF block index out of bounds');
                      let F = m.fileDirectory[X[P.tag]];
                      if (F[x] !== void 0) return;
                      let re = await i.header(P.offset + x * P.itemBytes, P.itemBytes, I),
                        ie = e.remote_tiff_index_values(
                          new Uint8Array(re),
                          P.itemBytes,
                          o.littleEndian
                        )[0];
                      if (F[x] !== void 0) return;
                      Object.defineProperty(F, x, { value: ie, configurable: !0 });
                      let k = h.get(P.tag) || [];
                      (k.push(x), k.length > 4096 && delete F[k.shift()], h.set(P.tag, k));
                    })
                  ),
                  C(I),
                  T(d, f, g, O, I)
                );
              }),
              m
            );
          })()
        ),
      S.get(b)
    )),
    console.log(`[RemoteTIFF] Lazy directory: ${s.length} images`),
    y
  );
}
function ye(n, t, e) {
  let r = Math.max(1, n * t * Math.max(1, e) * 16);
  return Math.max(1, Math.min(16, Math.floor((64 * 1024 * 1024) / r)));
}
function Z(n) {
  return Array.isArray(n) ? n[0] : n;
}
function we(n, t) {
  let e = Z(n);
  return e === 3 || e === 2 || t > 16;
}
function Te(n, t) {
  let e = Z(n);
  return e === 3 ? 1 : e === 2 ? Math.pow(2, t - 1) - 1 : Math.pow(2, t) - 1;
}
function Se(n, t) {
  let e = Z(n);
  return e === 3
    ? 'tiff-float'
    : e === 2
      ? 'tiff-int-signed'
      : t === 16
        ? 'tiff-uint16'
        : (t || 0) > 16
          ? 'tiff-int-wide'
          : 'tiff-int';
}
function Pe(n) {
  if (!n) return [];
  let t;
  try {
    t = JSON.parse(n);
  } catch {
    return [];
  }
  return Array.isArray(t)
    ? t
        .filter(e => !!e && typeof e == 'object')
        .map(e => ({
          index: Number(e.index) || 0,
          ...(e.generated === !0 ? { generated: !0 } : {}),
          width: Number(e.width) || 0,
          height: Number(e.height) || 0,
          samplesPerPixel: Number(e.samplesPerPixel) || 1,
          subfileType: Number(e.subfileType) || 0,
          kind: e.kind === 'overview' || e.kind === 'mask' ? e.kind : 'image',
          parent: e.parent === null || e.parent === void 0 ? null : Number(e.parent),
          reduction: Math.max(1, Number(e.reduction) || 1),
          subIfdCount: Number(e.subIfdCount) || 0,
          blockWidth: Math.max(1, Number(e.blockWidth) || Number(e.width) || 1),
          blockHeight: Math.max(1, Number(e.blockHeight) || Number(e.height) || 1),
        }))
    : [];
}
function Ie(n) {
  return Array.isArray(n) ? n.filter(t => t.kind === 'image') : [];
}
function D(n, t) {
  if (!Array.isArray(n)) return [];
  let e = n.find(i => i.index === t && i.kind === 'image');
  if (!e) return [];
  let r = n
    .filter(i => i.kind === 'overview' && i.parent === e.index)
    .sort((i, a) => a.width - i.width);
  return [e, ...r];
}
function Me(n, t) {
  if (!Array.isArray(n)) return t;
  let e = n.find(r => r.index === t);
  return e ? (e.kind === 'image' ? e.index : (e.parent ?? e.index)) : t;
}
function Ce(n) {
  return Array.isArray(n) && n.some(t => t.kind === 'overview');
}
function Y(n, t, e, r = 1) {
  let i = D(n, t);
  if (i.length === 0) return null;
  if (!Number.isFinite(e) || e <= 0) return i[0];
  let a = e * r,
    o = i[0];
  for (let s of i) s.width >= a && (o = s);
  return o;
}
var W = 4e7,
  ae = 5e7;
function se(n, t, e, r, i = 1, a = W) {
  let o = D(n, t);
  if (o.length === 0) return null;
  let s = o[0];
  if (r(s.width, s.height) && s.width * s.height <= a) return s;
  let u = Y(n, t, e, i) ?? s,
    c = Math.max(0, o.indexOf(u));
  for (let l of o.slice(c)) if (r(l.width, l.height)) return l;
  return null;
}
function ze(n, t, e, r, i = W) {
  let a = se(n, t, e, r, 1, i),
    o = D(n, t),
    s = o[0];
  return !s || s.width * s.height <= ae ? a : [...o].reverse().find(u => r(u.width, u.height)) || a;
}
function Ee(n, t, e, r, i, a = 1 / 0) {
  let o = D(n, t),
    s = o.find(c => c.index === e),
    u = Y(n, t, r);
  if (!s || !u) return null;
  if (u.width > s.width) {
    let c = o.find(l => l.width <= u.width && l.width * l.height <= a && i(l.width, l.height));
    return c && c.width > s.width ? c : null;
  }
  return u.width * 2 <= s.width ? u : null;
}
function Ae(n) {
  return `${n.reduction <= 1 ? 'Full' : `1/${n.reduction}`} \xB7 ${n.width}x${n.height}`;
}
function ve(n) {
  let t = n.find(i => i.generated),
    e = t && n.find(i => i.index === t.parent);
  if (!t || !e || e.blockWidth !== e.width) return n;
  let r = [];
  for (let i = 2; i < t.reduction; i *= 2)
    e.blockHeight % i === 0 &&
      r.push({
        ...e,
        index: -i,
        parent: e.index,
        kind: 'overview',
        generated: !0,
        sourceIndex: e.index,
        reduction: i,
        width: Math.ceil(e.width / i),
        height: Math.ceil(e.height / i),
        blockWidth: Math.ceil(e.width / i),
        blockHeight: e.blockHeight / i,
      });
  return [...n, ...r];
}
var J = { bands: [], dataset: {} };
function Fe(n, t, e) {
  let r = n?.bands.find(i => i.sample === t);
  return r ? e * (r.scale ?? 1) + (r.offset ?? 0) : e;
}
function ke(n) {
  return !!n?.bands.some(
    t => (t.scale !== void 0 && t.scale !== 1) || (t.offset !== void 0 && t.offset !== 0)
  );
}
function $e(n, t) {
  return n?.bands.find(e => e.sample === t)?.description || '';
}
function R(n, t) {
  let e = n.get(t);
  return (e || ((e = { sample: t }), n.set(t, e)), e);
}
function oe(n) {
  if (!n || !/<GDALMetadata/i.test(n)) return { bands: [], dataset: {} };
  let t = new Map(),
    e = {},
    r = /<Item\b([^>]*)>([\s\S]*?)<\/Item>/gi,
    i;
  for (; (i = r.exec(n)) !== null;) {
    let a = i[1],
      o = i[2].trim(),
      s = N => {
        let S = new RegExp(`\\b${N}\\s*=\\s*"([^"]*)"`, 'i').exec(a);
        return S ? S[1] : void 0;
      },
      u = (s('name') || '').toUpperCase(),
      c = s('sample');
    if (c === void 0) {
      u && (e[u] = o);
      continue;
    }
    let l = Number(c);
    if (!Number.isFinite(l) || l < 0) continue;
    let p = (s('role') || '').toLowerCase(),
      y = Number(o);
    p === 'scale' || u === 'SCALE'
      ? Number.isFinite(y) && (R(t, l).scale = y)
      : p === 'offset' || u === 'OFFSET'
        ? Number.isFinite(y) && (R(t, l).offset = y)
        : p === 'description' || u === 'DESCRIPTION'
          ? o && (R(t, l).description = o)
          : (p === 'unittype' || u === 'UNITTYPE' || u === 'UNITS') && o && (R(t, l).unit = o);
  }
  return { bands: [...t.values()].sort((a, o) => a.sample - o.sample), dataset: e };
}
function De(n) {
  if (!Array.isArray(n)) return J;
  for (let t of n) {
    let e = String(t?.name || ''),
      r = /unknown\((\d+)\)/i.exec(e);
    if (!(t?.tag === 42112 || (!!r && Number(r[1]) === 42112)) && !/^gdal_?metadata$/i.test(e))
      continue;
    let a = oe(String(t.value));
    if (a.bands.length || Object.keys(a.dataset).length) return a;
  }
  return J;
}
function Ue(n) {
  if (!n) return null;
  try {
    let t = JSON.parse(n);
    return !t || typeof t != 'object' ? null : t;
  } catch {
    return null;
  }
}
function ue(n, t, e) {
  let r = n?.transform;
  if (!r || r.length < 6) return null;
  let i = n.pixelIsPoint ? 0 : 0.5,
    a = t + i,
    o = e + i;
  return { x: r[0] * a + r[1] * o + r[2], y: r[3] * a + r[4] * o + r[5] };
}
function K(n, t, e) {
  let r = n >= 0 ? t : e;
  return `${Math.abs(n).toFixed(6)}\xB0${r}`;
}
function Be(n, t, e) {
  let r = ue(n, t, e);
  if (!r) return '';
  if (n.isGeographic) return `${K(r.y, 'N', 'S')} ${K(r.x, 'E', 'W')}`;
  let i = n.unit === 'metre' ? ' m' : n.unit ? ` ${n.unit}` : '';
  return `E ${r.x.toFixed(2)}${i}, N ${r.y.toFixed(2)}${i}`;
}
function ce(n) {
  return n.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (t, e) => {
    let r = e.toLowerCase();
    if (r === 'amp') return '&';
    if (r === 'lt') return '<';
    if (r === 'quot') return '"';
    if (r === 'apos') return "'";
    let i = r.startsWith('#x') ? 16 : 10,
      a = r.slice(i === 16 ? 2 : 1),
      o = parseInt(a, i);
    return Number.isFinite(o) ? String.fromCodePoint(o) : t;
  });
}
function Q(n) {
  let t = {},
    e = /([\w:.-]+)\s*=\s*(["'])([\s\S]*?)\2/g,
    r;
  for (; (r = e.exec(n));) {
    let i = r[1],
      a = i.includes(':') ? i.slice(i.lastIndexOf(':') + 1) : i;
    t[a] = ce(r[3]);
  }
  return t;
}
function _(n, t) {
  let e = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    r = new RegExp(`<(?:[\\w.-]+:)?${e}\\b([^>]*)>`, 'gi'),
    i = [],
    a;
  for (; (a = r.exec(n));) i.push(Q(a[1]));
  return i;
}
function G(n, t) {
  return _(n, t)[0] || null;
}
function fe(n, t) {
  let e = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return (
    new RegExp(`<(?:[\\w.-]+:)?${e}\\b[^>]*>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?${e}\\s*>`, 'i').exec(
      n
    )?.[1] || ''
  );
}
function B(n, t) {
  let e = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    r = new RegExp(
      `<(?:[\\w.-]+:)?${e}\\b([^>]*?)(?:\\/\\s*>|>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?${e}\\s*>)`,
      'gi'
    ),
    i = [],
    a;
  for (; (a = r.exec(n));) i.push({ attributes: Q(a[1]), body: a[2] || '' });
  return i;
}
function z(n, t) {
  let e = Number(n);
  return Number.isInteger(e) && e > 0 ? e : t;
}
function U(n, t) {
  let e = Number(n);
  return Number.isInteger(e) && e >= 0 ? e : t;
}
function E(n) {
  if (n === void 0 || n === '') return;
  let t = Number(n);
  return Number.isFinite(t) ? t : void 0;
}
function j(n) {
  return `${n.c},${n.z},${n.t}`;
}
function V(n, t) {
  return t === 'C' ? n.planeSizeC : t === 'Z' ? n.sizeZ : n.sizeT;
}
function ee(n) {
  let t = n
    .toUpperCase()
    .replace(/X|Y/g, '')
    .split('')
    .filter(e => e === 'C' || e === 'Z' || e === 'T');
  for (let e of ['Z', 'C', 'T']) t.includes(e) || t.push(e);
  return t;
}
function te(n, t) {
  let e = 0,
    r = 1;
  for (let i of ee(n.dimensionOrder)) {
    let a = i === 'C' ? t.c : i === 'Z' ? t.z : t.t;
    ((e += a * r), (r *= V(n, i)));
  }
  return e;
}
function ne(n, t) {
  let e = Math.max(0, t),
    r = { c: 0, z: 0, t: 0 };
  for (let i of ee(n.dimensionOrder)) {
    let a = Math.max(1, V(n, i)),
      o = e % a;
    ((e = Math.floor(e / a)), i === 'C' ? (r.c = o) : i === 'Z' ? (r.z = o) : (r.t = o));
  }
  return r;
}
function le(n, t, e) {
  let r = 0;
  for (let a = 0; a < n.length; a++) {
    if (t === r || t === a) return a;
    r += Math.max(1, n[a].samplesPerPixel);
  }
  let i = Math.max(n.length, e) - 1;
  return Math.max(0, Math.min(i, t));
}
function me(n) {
  return Number.isFinite(n) ? `#${(Number(n) >>> 0).toString(16).padStart(8, '0')}` : void 0;
}
function Ze(n) {
  for (let t of n || []) {
    if (!(t.tag === 270 || /(^|\b)ImageDescription\b/i.test(String(t.name || '')))) continue;
    let r = String(t.value || '')
      .replace(/^\uFEFF/, '')
      .trim();
    if (/(?:<\?xml[\s\S]*?\?>\s*)?<(?:(?:[\w.-]+):)?OME\b/i.test(r)) return r;
  }
}
function de(n, t, e, r) {
  let i = fe(r, 'Pixels') || r,
    a = G(r, 'Pixels');
  if (!a) return null;
  let o = /^[XYZCT]{5}$/i.test(a.DimensionOrder || '') ? a.DimensionOrder.toUpperCase() : 'XYZCT',
    s = z(a.SizeC, 1),
    u = z(a.SizeZ, 1),
    c = z(a.SizeT, 1),
    p = _(i, 'Channel').map((f, g) => {
      let O = E(f.Color);
      return {
        id: f.ID,
        name: f.Name || f.Fluor || `Channel ${g + 1}`,
        color: O,
        colorCss: me(O),
        samplesPerPixel: z(f.SamplesPerPixel, 1),
      };
    }),
    y = p.length || s,
    S = p.reduce((f, g) => f + g.samplesPerPixel, 0) === s ? y : s,
    m = G(r, 'ObjectiveSettings')?.ID,
    w = _(n, 'Objective'),
    h = w.find(f => m && f.ID === m) || w[0],
    T = h
      ? {
          id: h.ID,
          manufacturer: h.Manufacturer,
          model: h.Model,
          serialNumber: h.SerialNumber,
          nominalMagnification: E(h.NominalMagnification),
          lensNA: E(h.LensNA),
          immersion: h.Immersion,
          correction: h.Correction,
        }
      : void 0,
    d = {
      xml: n,
      creator: t.Creator,
      uuid: t.UUID,
      imageId: e.ID,
      imageName: e.Name,
      pixelsId: a.ID,
      dimensionOrder: o,
      sizeX: z(a.SizeX, 1),
      sizeY: z(a.SizeY, 1),
      sizeC: s,
      sizeZ: u,
      sizeT: c,
      planeSizeC: S,
      pixelType: a.Type,
      physicalSizeX: E(a.PhysicalSizeX),
      physicalSizeXUnit: a.PhysicalSizeXUnit,
      physicalSizeY: E(a.PhysicalSizeY),
      physicalSizeYUnit: a.PhysicalSizeYUnit,
      physicalSizeZ: E(a.PhysicalSizeZ),
      physicalSizeZUnit: a.PhysicalSizeZUnit,
      timeIncrement: E(a.TimeIncrement),
      timeIncrementUnit: a.TimeIncrementUnit,
      channels: p,
      objective: T,
      objectiveSettingsId: m,
      tiffData: [],
      expectedPlaneCount: S * u * c,
      coordinateToIfd: {},
      ifdToCoordinate: {},
      coordinateToPlane: {},
    };
  if (
    ((d.tiffData = B(i, 'TiffData').map(f => {
      let g = f.attributes,
        O = B(f.body, 'UUID')[0],
        I = O?.attributes || {};
      return {
        ifd: U(g.IFD, 0),
        firstC: le(p, U(g.FirstC, 0), d.planeSizeC),
        firstZ: U(g.FirstZ, 0),
        firstT: U(g.FirstT, 0),
        planeCount: z(g.PlaneCount, g.IFD === void 0 ? d.expectedPlaneCount : 1),
        fileName: I.FileName,
        uuid: O?.body.trim() || void 0,
      };
    })),
    d.tiffData.length > 0)
  )
    for (let f of d.tiffData) {
      let g = { c: f.firstC, z: f.firstZ, t: f.firstT },
        O = te(d, g),
        I = !f.fileName || (!!d.uuid && f.uuid === d.uuid);
      for (let M = 0; M < f.planeCount; M++) {
        let A = ne(d, O + M),
          x = f.ifd + M;
        (I && ((d.coordinateToIfd[j(A)] = x), (d.ifdToCoordinate[String(x)] = A)),
          (d.coordinateToPlane[j(A)] = { ...A, ifd: x, fileName: f.fileName, uuid: f.uuid }));
      }
    }
  return d;
}
function be(n) {
  let t = String(n || '')
    .replace(/^\uFEFF/, '')
    .trim();
  if (!/<(?:(?:[\w.-]+):)?OME\b/i.test(t)) return [];
  let e = G(t, 'OME') || {};
  return B(t, 'Image')
    .map(r => de(t, e, r.attributes, r.body))
    .filter(r => !!r);
}
function _e(n) {
  let t = be(n);
  return t.length === 0
    ? null
    : ((t[0].images = t.map(e => {
        let r = { ...e };
        return (delete r.images, r);
      })),
      t[0]);
}
function Ge(n, t, e, r) {
  if (!n.startsWith('ImageJ=')) return null;
  let i = Object.fromEntries(
      n
        .replace(/\0/g, '')
        .split(/\r?\n/)
        .map(l => {
          let p = l.indexOf('=');
          return [l.slice(0, p), l.slice(p + 1)];
        })
    ),
    a = l => (i[l] === void 0 ? 1 : Number(i[l])),
    o = a('channels'),
    s = a('slices'),
    u = a('frames'),
    c = o * s * u;
  return ![o, s, u, t, e].every(l => Number.isSafeInteger(l) && l > 0) ||
    c !== r ||
    Number(i.images) !== c
    ? null
    : {
        metadataFormat: 'ImageJ',
        xml: '',
        dimensionOrder: 'XYCZT',
        sizeX: t,
        sizeY: e,
        sizeC: o,
        planeSizeC: o,
        sizeZ: s,
        sizeT: u,
        channels: Array.from({ length: o }, () => ({ name: '', samplesPerPixel: 1 })),
        tiffData: [],
        expectedPlaneCount: c,
        coordinateToIfd: {},
        ifdToCoordinate: {},
        coordinateToPlane: {},
      };
}
function je(n) {
  let t = String(n || '')
    .replace(/^\uFEFF/, '')
    .trim();
  if (!/<(?:(?:[\w.-]+):)?OME\b/i.test(t)) return null;
  let e = B(t, 'BinaryOnly')[0]?.attributes;
  return e?.MetadataFile ? { metadataFile: e.MetadataFile, uuid: e.UUID } : null;
}
function Xe(n, t) {
  let e = {
    c: Math.max(0, Math.min(n.planeSizeC - 1, Math.trunc(t.c))),
    z: Math.max(0, Math.min(n.sizeZ - 1, Math.trunc(t.z))),
    t: Math.max(0, Math.min(n.sizeT - 1, Math.trunc(t.t))),
  };
  return n.coordinateToIfd[j(e)] ?? te(n, e);
}
function qe(n, t) {
  return n.ifdToCoordinate[String(t)] || ne(n, t);
}
export {
  pe as a,
  ye as b,
  we as c,
  Te as d,
  Se as e,
  Pe as f,
  Ie as g,
  D as h,
  Me as i,
  Ce as j,
  Y as k,
  W as l,
  ae as m,
  se as n,
  ze as o,
  Ee as p,
  Ae as q,
  ve as r,
  Fe as s,
  ke as t,
  $e as u,
  De as v,
  Ue as w,
  Be as x,
  Ze as y,
  _e as z,
  Ge as A,
  je as B,
  Xe as C,
  qe as D,
};
