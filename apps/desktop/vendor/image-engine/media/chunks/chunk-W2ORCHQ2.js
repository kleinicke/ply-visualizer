var at = new Map();
function Te() {
  return window.__tiffVisualizerVendorAssets || {};
}
function K(n) {
  let t = at.get(n);
  if (t) return t;
  let e = Te(),
    _ = e[n];
  if (!_) return Promise.reject(new Error(`No ${n} fallback asset was configured`));
  let s = new Promise((o, i) => {
    let a = document.createElement('script');
    ((a.src = _),
      (a.async = !0),
      e.nonce && (a.nonce = e.nonce),
      a.addEventListener('load', () => o(), { once: !0 }),
      a.addEventListener('error', () => i(new Error(`Failed to load ${n} fallback`)), { once: !0 }),
      document.head.append(a));
  }).catch(o => {
    throw (at.delete(n), o);
  });
  return (at.set(n, s), s);
}
async function Ce() {
  return (window.GeoTIFF || (await q(), await K('geotiff')), window.GeoTIFF);
}
async function q() {
  return (window.pako || (await K('pako')), window.pako);
}
async function Ne() {
  return (window.UPNG || (await q(), await K('upng')), window.UPNG);
}
async function Ve() {
  return (window.parseExr || (await K('parseExr')), window.parseExr);
}
async function gt(n) {
  let t = globalThis.DecompressionStream;
  if (typeof t == 'function')
    try {
      let _ = new Blob([n]).stream().pipeThrough(new t('deflate'));
      return new Uint8Array(await new Response(_).arrayBuffer());
    } catch {}
  return (await q()).inflate(n);
}
function ut(n) {
  if (!n) return [];
  try {
    let t = JSON.parse(n);
    return Array.isArray(t) ? t : [];
  } catch {
    return [];
  }
}
function Je(n) {
  if (Array.isArray(n))
    for (let t of n) {
      let e = String(t?.name || ''),
        _ = /unknown\((\d+)\)/i.exec(e),
        s = t?.tag === 42113 || (!!_ && Number(_[1]) === 42113);
      if (!/nodata/i.test(e) && !s) continue;
      let o = parseFloat(String(t.value));
      if (Number.isFinite(o)) return o;
    }
}
function Ge(n) {
  if (Array.isArray(n))
    for (let t of n) {
      let e = String(t?.name || ''),
        _ = /unknown\((\d+)\)/i.exec(e),
        s = t?.tag === 338 || (!!_ && Number(_[1]) === 338);
      if (!/^extrasamples$/i.test(e) && !s) continue;
      let o = String(t.value)
        .split(/[,\s]+/)
        .map(i => Number(i))
        .filter(i => Number.isFinite(i));
      return o.length === 0
        ? void 0
        : o.some(i => i === 1 || i === 2)
          ? !0
          : o.every(i => i === 0)
            ? !1
            : void 0;
    }
}
function pt(n) {
  if (n == null) return '';
  if (Array.isArray(n) || ArrayBuffer.isView(n)) return Array.from(n).join(', ');
  if (typeof n == 'object')
    try {
      return JSON.stringify(n);
    } catch {
      return String(n);
    }
  return String(n);
}
function $e(n) {
  let t = [],
    e = n?.fileDirectory || {};
  for (let [s, o] of Object.entries(e)) t.push({ tag: null, name: s, group: 'TIFF', value: pt(o) });
  let _ = null;
  try {
    _ = typeof n?.getGeoKeys == 'function' ? n.getGeoKeys() : n?.geoKeys;
  } catch {}
  if (_ && typeof _ == 'object')
    for (let [s, o] of Object.entries(_))
      t.push({ tag: null, name: s, group: 'GeoKeys', value: pt(o) });
  return t;
}
function Xe(n) {
  if (!(n instanceof Uint8Array) || n.length < 4 || n[0] !== 255 || n[1] !== 216) return null;
  let t = 2;
  for (; t + 4 <= n.length && n[t] === 255;) {
    let e = n[t + 1];
    if (((t += 2), e === 1 || (e >= 208 && e <= 215))) continue;
    if (e === 217 || e === 218 || t + 2 > n.length) break;
    let _ = (n[t] << 8) | n[t + 1],
      s = t + 2,
      o = t + _;
    if (_ < 2 || o > n.length) break;
    if (e === 225 && o - s >= 6) {
      let i = [69, 120, 105, 102, 0, 0],
        a = !0;
      for (let l = 0; l < 6; l++)
        if (n[s + l] !== i[l]) {
          a = !1;
          break;
        }
      if (a) return n.subarray(s + 6, o);
    }
    t = o;
  }
  return null;
}
function Y(n) {
  let t = '';
  for (let e = 0; e < n.length; e++) t += String.fromCharCode(n[e]);
  return t;
}
async function Ke(n) {
  let t = { exifBlob: null, textEntries: [] },
    e = [137, 80, 78, 71, 13, 10, 26, 10];
  if (!(n instanceof Uint8Array) || n.length < 8) return t;
  for (let o = 0; o < 8; o++) if (n[o] !== e[o]) return t;
  let _ = new DataView(n.buffer, n.byteOffset, n.byteLength),
    s = 8;
  for (; s + 12 <= n.length;) {
    let o = _.getUint32(s, !1),
      i = String.fromCharCode(n[s + 4], n[s + 5], n[s + 6], n[s + 7]),
      a = s + 8,
      l = a + o;
    if (l + 4 > n.length) break;
    let f = n.subarray(a, l);
    try {
      if (i === 'eXIf') t.exifBlob = f;
      else if (i === 'tEXt') {
        let g = f.indexOf(0);
        g >= 0 && t.textEntries.push({ name: Y(f.subarray(0, g)), value: Y(f.subarray(g + 1)) });
      } else if (i === 'zTXt') {
        let g = f.indexOf(0);
        if (g >= 0) {
          let p = Y(f.subarray(0, g)),
            w = f.subarray(g + 2),
            x = new TextDecoder('utf-8').decode(await gt(w));
          t.textEntries.push({ name: p, value: x });
        }
      } else if (i === 'iTXt') {
        let g = f.indexOf(0),
          p = Y(f.subarray(0, g)),
          w = f[g + 1];
        ((g += 3), (g = f.indexOf(0, g) + 1), (g = f.indexOf(0, g) + 1));
        let X = f.subarray(g),
          ot =
            w === 1
              ? new TextDecoder('utf-8').decode(await gt(X))
              : new TextDecoder('utf-8').decode(X);
        t.textEntries.push({ name: p, value: ot });
      } else if (i === 'IEND') break;
    } catch {}
    s = l + 4;
  }
  return t;
}
var r,
  R = null;
function E() {
  return ((R === null || R.byteLength === 0) && (R = new Uint8Array(r.memory.buffer)), R);
}
var Z = new TextDecoder('utf-8', { ignoreBOM: !0, fatal: !0 });
Z.decode();
var Re = 2146435072,
  ct = 0;
function Me(n, t) {
  return (
    (ct += t),
    ct >= Re &&
      ((Z = new TextDecoder('utf-8', { ignoreBOM: !0, fatal: !0 })), Z.decode(), (ct = t)),
    Z.decode(E().subarray(n, n + t))
  );
}
function b(n, t) {
  return ((n = n >>> 0), Me(n, t));
}
var M = null;
function Ot() {
  return ((M === null || M.byteLength === 0) && (M = new Uint16Array(r.memory.buffer)), M);
}
function dt(n, t) {
  return ((n = n >>> 0), Ot().subarray(n / 2, n / 2 + t));
}
function k(n, t) {
  return ((n = n >>> 0), E().subarray(n / 1, n / 1 + t));
}
var P = null;
function Wt() {
  return ((P === null || P.byteLength === 0) && (P = new Float32Array(r.memory.buffer)), P);
}
function m(n, t) {
  return ((n = n >>> 0), Wt().subarray(n / 4, n / 4 + t));
}
var c = 0,
  U = new TextEncoder();
'encodeInto' in U ||
  (U.encodeInto = function (n, t) {
    let e = U.encode(n);
    return (t.set(e), { read: n.length, written: e.length });
  });
function v(n, t, e) {
  if (e === void 0) {
    let a = U.encode(n),
      l = t(a.length, 1) >>> 0;
    return (
      E()
        .subarray(l, l + a.length)
        .set(a),
      (c = a.length),
      l
    );
  }
  let _ = n.length,
    s = t(_, 1) >>> 0,
    o = E(),
    i = 0;
  for (; i < _; i++) {
    let a = n.charCodeAt(i);
    if (a > 127) break;
    o[s + i] = a;
  }
  if (i !== _) {
    (i !== 0 && (n = n.slice(i)), (s = e(s, _, (_ = i + n.length * 3), 1) >>> 0));
    let a = E().subarray(s + i, s + _),
      l = U.encodeInto(n, a);
    ((i += l.written), (s = e(s, _, i, 1) >>> 0));
  }
  return ((c = i), s);
}
var j = null;
function wt() {
  return (
    (j === null ||
      j.buffer.detached === !0 ||
      (j.buffer.detached === void 0 && j.buffer !== r.memory.buffer)) &&
      (j = new DataView(r.memory.buffer)),
    j
  );
}
function u(n, t) {
  let e = t(n.length * 1, 1) >>> 0;
  return (E().set(n, e / 1), (c = n.length), e);
}
function d(n) {
  let t = r.__wbindgen_externrefs.get(n);
  return (r.__externref_table_dealloc(n), t);
}
function h(n, t) {
  let e = t(n.length * 4, 4) >>> 0;
  return (Wt().set(n, e / 4), (c = n.length), e);
}
var O = null;
function Dt() {
  return ((O === null || O.byteLength === 0) && (O = new Float64Array(r.memory.buffer)), O);
}
function Pe(n, t) {
  let e = t(n.length * 8, 8) >>> 0;
  return (Dt().set(n, e / 8), (c = n.length), e);
}
function A(n, t) {
  let e = t(n.length * 2, 2) >>> 0;
  return (Ot().set(n, e / 2), (c = n.length), e);
}
var W = null;
function Ut() {
  return ((W === null || W.byteLength === 0) && (W = new Uint32Array(r.memory.buffer)), W);
}
function lt(n, t) {
  let e = t(n.length * 4, 4) >>> 0;
  return (Ut().set(n, e / 4), (c = n.length), e);
}
var D = null;
function Oe() {
  return ((D === null || D.byteLength === 0) && (D = new Int32Array(r.memory.buffer)), D);
}
function _t(n, t) {
  return ((n = n >>> 0), Oe().subarray(n / 4, n / 4 + t));
}
function Bt(n, t) {
  return ((n = n >>> 0), Ut().subarray(n / 4, n / 4 + t));
}
function Ct(n, t, e, _, s, o) {
  let i = u(n, r.__wbindgen_malloc),
    a = c,
    l = r.decode_tiff_region(i, a, t, e, _, s, o);
  if (l[2]) throw d(l[1]);
  return T.__wrap(l[0]);
}
function Nt(n, t) {
  let e = u(n, r.__wbindgen_malloc),
    _ = c,
    s = v(t, r.__wbindgen_malloc, r.__wbindgen_realloc),
    o = c,
    i = r.decode_netcdf_fast(e, _, s, o);
  if (i[2]) throw d(i[1]);
  return y.__wrap(i[0]);
}
function Vt(n) {
  let t = u(n, r.__wbindgen_malloc),
    e = c,
    _ = r.exr_zip_f32_plan(t, e);
  if (_[2]) throw d(_[1]);
  return _[0] === 0 ? void 0 : C.__wrap(_[0]);
}
function It(n, t) {
  let e = u(n, r.__wbindgen_malloc),
    _ = c,
    s = r.decode_dicom_fast(e, _, t);
  if (s[2]) throw d(s[1]);
  return y.__wrap(s[0]);
}
function Lt(n) {
  let t = u(n, r.__wbindgen_malloc),
    e = c,
    _ = r.decode_tiff_preview(t, e);
  if (_[2]) throw d(_[1]);
  return S.__wrap(_[0]);
}
function Jt(n, t, e, _, s, o, i, a, l, f, g, p, w) {
  let x = h(n, r.__wbindgen_malloc),
    $ = c,
    X = v(_, r.__wbindgen_malloc, r.__wbindgen_realloc),
    ot = c,
    Se = v(s, r.__wbindgen_malloc, r.__wbindgen_realloc),
    Ee = c,
    it = r.demosaic(x, $, t, e, X, ot, Se, Ee, o, i, a, l, f, g, p, w);
  if (it[2]) throw d(it[1]);
  return B.__wrap(it[0]);
}
function Gt(n, t) {
  let e = u(n, r.__wbindgen_malloc),
    _ = c;
  return r.tiff_region_decode_available(e, _, t) !== 0;
}
function $t(n, t) {
  let e = u(n, r.__wbindgen_malloc),
    _ = c,
    s = r.decode_pfm_display_fast(e, _, t);
  if (s[2]) throw d(s[1]);
  return y.__wrap(s[0]);
}
function Xt(n) {
  let t, e;
  try {
    let _ = u(n, r.__wbindgen_malloc),
      s = c,
      o = r.tiff_page_directory(_, s);
    return ((t = o[0]), (e = o[1]), b(o[0], o[1]));
  } finally {
    r.__wbindgen_free(t, e, 1);
  }
}
function Kt(n, t, e) {
  let _, s;
  try {
    let a = u(n, r.__wbindgen_malloc),
      l = c,
      f = u(t, r.__wbindgen_malloc),
      g = c,
      p = r.remote_tiff_ifd(a, l, f, g, e);
    var o = p[0],
      i = p[1];
    if (p[3]) throw ((o = 0), (i = 0), d(p[2]));
    return ((_ = o), (s = i), b(o, i));
  } finally {
    r.__wbindgen_free(_, s, 1);
  }
}
function qt(n) {
  let t = u(n, r.__wbindgen_malloc),
    e = c,
    _ = r.decode_npy_display_fast(t, e);
  if (_[2]) throw d(_[1]);
  return y.__wrap(_[0]);
}
function Yt(n) {
  let t = u(n, r.__wbindgen_malloc),
    e = c,
    _ = r.tiff_strip_metadata(t, e);
  if (_[2]) throw d(_[1]);
  return J.__wrap(_[0]);
}
function F(n, t) {
  return ((n = n >>> 0), Dt().subarray(n / 8, n / 8 + t));
}
function Zt(n, t, e) {
  let _ = u(n, r.__wbindgen_malloc),
    s = c,
    o = r.remote_tiff_index_values(_, s, t, e);
  if (o[3]) throw d(o[2]);
  var i = F(o[0], o[1]).slice();
  return (r.__wbindgen_free(o[0], o[1] * 8, 8), i);
}
function Ht(n) {
  let t, e;
  try {
    let o = u(n, r.__wbindgen_malloc),
      i = c,
      a = r.remote_tiff_header(o, i);
    var _ = a[0],
      s = a[1];
    if (a[3]) throw ((_ = 0), (s = 0), d(a[2]));
    return ((t = _), (e = s), b(_, s));
  } finally {
    r.__wbindgen_free(t, e, 1);
  }
}
function Qt(n) {
  let t = u(n, r.__wbindgen_malloc),
    e = c,
    _ = r.decode_ppm_display_fast(t, e);
  if (_[2]) throw d(_[1]);
  return y.__wrap(_[0]);
}
function te(n, t) {
  let e = u(n, r.__wbindgen_malloc),
    _ = c,
    s = v(t, r.__wbindgen_malloc, r.__wbindgen_realloc),
    o = c,
    i = r.decode_sdt_fast(e, _, s, o);
  if (i[2]) throw d(i[1]);
  return y.__wrap(i[0]);
}
function ee(n) {
  let t, e;
  try {
    let _ = u(n, r.__wbindgen_malloc),
      s = c,
      o = r.extract_exif_tags(_, s);
    return ((t = o[0]), (e = o[1]), b(o[0], o[1]));
  } finally {
    r.__wbindgen_free(t, e, 1);
  }
}
function re(n, t) {
  let e = u(n, r.__wbindgen_malloc),
    _ = c,
    s = r.decode_tiff_page(e, _, t);
  if (s[2]) throw d(s[1]);
  return S.__wrap(s[0]);
}
function ne(n, t) {
  let e = u(n, r.__wbindgen_malloc),
    _ = c,
    s = v(t, r.__wbindgen_malloc, r.__wbindgen_realloc),
    o = c,
    i = r.decode_czi_fast(e, _, s, o);
  if (i[2]) throw d(i[1]);
  return y.__wrap(i[0]);
}
function _e(n, t) {
  let e = u(n, r.__wbindgen_malloc),
    _ = c,
    s = v(t, r.__wbindgen_malloc, r.__wbindgen_realloc),
    o = c,
    i = r.decode_lif_fast(e, _, s, o);
  if (i[2]) throw d(i[1]);
  return y.__wrap(i[0]);
}
function se(n) {
  let t = u(n, r.__wbindgen_malloc),
    e = c,
    _ = r.tiff_float_strip_plan(t, e);
  return _ === 0 ? void 0 : L.__wrap(_);
}
function oe(n) {
  let t = u(n, r.__wbindgen_malloc),
    e = c,
    _ = r.tiff_page_count(t, e);
  if (_[2]) throw d(_[1]);
  return _[0] >>> 0;
}
function ie(n) {
  let t = u(n, r.__wbindgen_malloc),
    e = c;
  return r.tiff_preview_reduction(t, e) >>> 0;
}
function ae(n) {
  let t = u(n, r.__wbindgen_malloc),
    e = c,
    _ = r.decode_fits_fast(t, e);
  if (_[2]) throw d(_[1]);
  return y.__wrap(_[0]);
}
function ce(n, t) {
  let e = u(n, r.__wbindgen_malloc),
    _ = c,
    s = v(t, r.__wbindgen_malloc, r.__wbindgen_realloc),
    o = c,
    i = r.decode_nd2_fast(e, _, s, o);
  if (i[2]) throw d(i[1]);
  return y.__wrap(i[0]);
}
function le(n) {
  let t = u(n, r.__wbindgen_malloc),
    e = c,
    _ = r.decode_tiff(t, e);
  if (_[2]) throw d(_[1]);
  return S.__wrap(_[0]);
}
function de(n, t, e, _, s) {
  let o = u(n, r.__wbindgen_malloc),
    i = c,
    a = r.compute_image_stats_u8(o, i, t, e, _, s);
  return z.__wrap(a);
}
function fe(n, t, e, _) {
  let s = u(n, r.__wbindgen_malloc),
    o = c,
    i = r.label_components_fast(s, o, t, e, _);
  if (i[2]) throw d(i[1]);
  return V.__wrap(i[0]);
}
function ge(n, t, e, _, s) {
  let o = h(n, r.__wbindgen_malloc),
    i = c,
    a = r.compute_image_stats_f32(o, i, t, e, _, s);
  return z.__wrap(a);
}
function pe(n, t, e, _, s, o, i) {
  let a = h(n, r.__wbindgen_malloc),
    l = c,
    f = v(_, r.__wbindgen_malloc, r.__wbindgen_realloc),
    g = c,
    p = r.local_auto_threshold_mask_fast(a, l, t, e, f, g, s, o, i);
  if (p[3]) throw d(p[2]);
  var w = k(p[0], p[1]).slice();
  return (r.__wbindgen_free(p[0], p[1] * 1, 1), w);
}
function ue(n, t, e) {
  let _ = h(n, r.__wbindgen_malloc),
    s = c,
    o = r.global_threshold_mask_fast(_, s, t, e);
  var i = k(o[0], o[1]).slice();
  return (r.__wbindgen_free(o[0], o[1] * 1, 1), i);
}
function we(n, t, e) {
  let _ = u(n, r.__wbindgen_malloc),
    s = c,
    o = r.fill_mask_holes_fast(_, s, t, e);
  if (o[3]) throw d(o[2]);
  var i = k(o[0], o[1]).slice();
  return (r.__wbindgen_free(o[0], o[1] * 1, 1), i);
}
function be(n, t, e, _, s, o, i, a) {
  let l = h(n, r.__wbindgen_malloc),
    f = c,
    g = r.compute_stability_curve_fast(l, f, t, e, _, s, o, i, a);
  if (g[2]) throw d(g[1]);
  return I.__wrap(g[0]);
}
function he(n, t) {
  let e = h(n, r.__wbindgen_malloc),
    _ = c,
    s = r.build_histogram_fast(e, _, t);
  return N.__wrap(s);
}
function ye(n, t) {
  let e = lt(n, r.__wbindgen_malloc),
    _ = c,
    s = v(t, r.__wbindgen_malloc, r.__wbindgen_realloc),
    o = c,
    i = r.auto_threshold_bin_fast(e, _, s, o);
  if (i[2]) throw d(i[1]);
  return i[0];
}
function me(n, t, e, _, s) {
  let o = h(n, r.__wbindgen_malloc),
    i = c,
    a = r.subtract_background_fast(o, i, t, e, _, s);
  if (a[3]) throw d(a[2]);
  var l = m(a[0], a[1]).slice();
  return (r.__wbindgen_free(a[0], a[1] * 4, 4), l);
}
function xe(n, t, e, _, s) {
  let o = A(n, r.__wbindgen_malloc),
    i = c,
    a = r.compute_image_stats_u16(o, i, t, e, _, s);
  return z.__wrap(a);
}
function ve(n, t, e, _) {
  let s = h(n, r.__wbindgen_malloc),
    o = c,
    i = r.gaussian_blur_fast(s, o, t, e, _);
  if (i[3]) throw d(i[2]);
  var a = m(i[0], i[1]).slice();
  return (r.__wbindgen_free(i[0], i[1] * 4, 4), a);
}
function ke(n, t, e, _, s, o, i, a, l) {
  let f = h(n, r.__wbindgen_malloc),
    g = c,
    p = v(_, r.__wbindgen_malloc, r.__wbindgen_realloc),
    w = c,
    x = r.local_threshold_mask_fast(f, g, t, e, p, w, s, o, i, a, l);
  if (x[3]) throw d(x[2]);
  var $ = k(x[0], x[1]).slice();
  return (r.__wbindgen_free(x[0], x[1] * 1, 1), $);
}
function je(n, t, e) {
  let _ = u(n, r.__wbindgen_malloc),
    s = c,
    o = r.distance_transform_fast(_, s, t, e);
  if (o[3]) throw d(o[2]);
  var i = F(o[0], o[1]).slice();
  return (r.__wbindgen_free(o[0], o[1] * 8, 8), i);
}
var bt =
    typeof FinalizationRegistry > 'u'
      ? { register: () => {}, unregister: () => {} }
      : new FinalizationRegistry(n => r.__wbg_decodedarray_free(n >>> 0, 1)),
  y = class n {
    static __wrap(t) {
      t = t >>> 0;
      let e = Object.create(n.prototype);
      return ((e.__wbg_ptr = t), bt.register(e, e.__wbg_ptr, e), e);
    }
    __destroy_into_raw() {
      let t = this.__wbg_ptr;
      return ((this.__wbg_ptr = 0), bt.unregister(this), t);
    }
    free() {
      let t = this.__destroy_into_raw();
      r.__wbg_decodedarray_free(t, 0);
    }
    get sample_kind() {
      return r.decodedarray_sample_kind(this.__wbg_ptr) >>> 0;
    }
    get valid_count() {
      return r.decodedarray_valid_count(this.__wbg_ptr);
    }
    discard_data() {
      r.decodedarray_discard_data(this.__wbg_ptr);
    }
    get format_label() {
      let t, e;
      try {
        let _ = r.decodedarray_format_label(this.__wbg_ptr);
        return ((t = _[0]), (e = _[1]), b(_[0], _[1]));
      } finally {
        r.__wbindgen_free(t, e, 1);
      }
    }
    get metadata_json() {
      let t, e;
      try {
        let _ = r.decodedarray_metadata_json(this.__wbg_ptr);
        return ((t = _[0]), (e = _[1]), b(_[0], _[1]));
      } finally {
        r.__wbindgen_free(t, e, 1);
      }
    }
    get sample_format() {
      return r.decodedarray_sample_format(this.__wbg_ptr) >>> 0;
    }
    get bits_per_sample() {
      return r.decodedarray_bits_per_sample(this.__wbg_ptr) >>> 0;
    }
    take_data_as_u8() {
      let t = r.decodedarray_take_data_as_u8(this.__wbg_ptr);
      if (t[3]) throw d(t[2]);
      var e = k(t[0], t[1]).slice();
      return (r.__wbindgen_free(t[0], t[1] * 1, 1), e);
    }
    get can_reuse_source() {
      return r.decodedarray_can_reuse_source(this.__wbg_ptr) !== 0;
    }
    get non_finite_count() {
      return r.decodedarray_non_finite_count(this.__wbg_ptr);
    }
    take_data_as_f32() {
      let t = r.decodedarray_take_data_as_f32(this.__wbg_ptr);
      if (t[3]) throw d(t[2]);
      var e = m(t[0], t[1]).slice();
      return (r.__wbindgen_free(t[0], t[1] * 4, 4), e);
    }
    take_data_as_u16() {
      let t = r.decodedarray_take_data_as_u16(this.__wbg_ptr);
      if (t[3]) throw d(t[2]);
      var e = dt(t[0], t[1]).slice();
      return (r.__wbindgen_free(t[0], t[1] * 2, 2), e);
    }
    get source_data_offset() {
      return r.decodedarray_source_data_offset(this.__wbg_ptr) >>> 0;
    }
    get source_numeric_type() {
      let t, e;
      try {
        let _ = r.decodedarray_source_numeric_type(this.__wbg_ptr);
        return ((t = _[0]), (e = _[1]), b(_[0], _[1]));
      } finally {
        r.__wbindgen_free(t, e, 1);
      }
    }
    copy_data_as_u8_into(t) {
      let e = r.decodedarray_copy_data_as_u8_into(this.__wbg_ptr, t);
      if (e[1]) throw d(e[0]);
    }
    copy_data_as_f32_into(t) {
      let e = r.decodedarray_copy_data_as_f32_into(this.__wbg_ptr, t);
      if (e[1]) throw d(e[0]);
    }
    copy_data_as_u16_into(t) {
      let e = r.decodedarray_copy_data_as_u16_into(this.__wbg_ptr, t);
      if (e[1]) throw d(e[0]);
    }
    get width() {
      return r.decodedarray_width(this.__wbg_ptr) >>> 0;
    }
    get height() {
      return r.decodedarray_height(this.__wbg_ptr) >>> 0;
    }
    get channels() {
      return r.decodedarray_channels(this.__wbg_ptr) >>> 0;
    }
    get data_len() {
      return r.decodedarray_data_len(this.__wbg_ptr) >>> 0;
    }
    get data_max() {
      return r.decodedarray_data_max(this.__wbg_ptr);
    }
    get data_min() {
      return r.decodedarray_data_min(this.__wbg_ptr);
    }
    get type_max() {
      return r.decodedarray_type_max(this.__wbg_ptr);
    }
    get type_min() {
      return r.decodedarray_type_min(this.__wbg_ptr);
    }
  };
Symbol.dispose && (y.prototype[Symbol.dispose] = y.prototype.free);
var ht =
    typeof FinalizationRegistry > 'u'
      ? { register: () => {}, unregister: () => {} }
      : new FinalizationRegistry(n => r.__wbg_demosaicresult_free(n >>> 0, 1)),
  B = class n {
    static __wrap(t) {
      t = t >>> 0;
      let e = Object.create(n.prototype);
      return ((e.__wbg_ptr = t), ht.register(e, e.__wbg_ptr, e), e);
    }
    __destroy_into_raw() {
      let t = this.__wbg_ptr;
      return ((this.__wbg_ptr = 0), ht.unregister(this), t);
    }
    free() {
      let t = this.__destroy_into_raw();
      r.__wbg_demosaicresult_free(t, 0);
    }
    get width() {
      return r.demosaicresult_width(this.__wbg_ptr) >>> 0;
    }
    get gain_b() {
      return r.demosaicresult_gain_b(this.__wbg_ptr);
    }
    get gain_g() {
      return r.demosaicresult_gain_g(this.__wbg_ptr);
    }
    get gain_r() {
      return r.demosaicresult_gain_r(this.__wbg_ptr);
    }
    get height() {
      return r.demosaicresult_height(this.__wbg_ptr) >>> 0;
    }
    get channels() {
      return r.demosaicresult_channels(this.__wbg_ptr) >>> 0;
    }
    take_data() {
      let t = r.demosaicresult_take_data(this.__wbg_ptr);
      var e = m(t[0], t[1]).slice();
      return (r.__wbindgen_free(t[0], t[1] * 4, 4), e);
    }
  };
Symbol.dispose && (B.prototype[Symbol.dispose] = B.prototype.free);
var yt =
    typeof FinalizationRegistry > 'u'
      ? { register: () => {}, unregister: () => {} }
      : new FinalizationRegistry(n => r.__wbg_exrresult_free(n >>> 0, 1)),
  H = class n {
    static __wrap(t) {
      t = t >>> 0;
      let e = Object.create(n.prototype);
      return ((e.__wbg_ptr = t), yt.register(e, e.__wbg_ptr, e), e);
    }
    __destroy_into_raw() {
      let t = this.__wbg_ptr;
      return ((this.__wbg_ptr = 0), yt.unregister(this), t);
    }
    free() {
      let t = this.__destroy_into_raw();
      r.__wbg_exrresult_free(t, 0);
    }
    get all_tags_json() {
      let t, e;
      try {
        let _ = r.exrresult_all_tags_json(this.__wbg_ptr);
        return ((t = _[0]), (e = _[1]), b(_[0], _[1]));
      } finally {
        r.__wbindgen_free(t, e, 1);
      }
    }
    get timing_pack_ms() {
      return r.decodedarray_type_max(this.__wbg_ptr);
    }
    get timing_read_ms() {
      return r.decodedarray_type_min(this.__wbg_ptr);
    }
    get timing_total_ms() {
      return r.decodedarray_data_min(this.__wbg_ptr);
    }
    take_data_as_f32() {
      let t = r.exrresult_take_data_as_f32(this.__wbg_ptr);
      var e = m(t[0], t[1]).slice();
      return (r.__wbindgen_free(t[0], t[1] * 4, 4), e);
    }
    get channel_names_csv() {
      let t, e;
      try {
        let _ = r.exrresult_channel_names_csv(this.__wbg_ptr);
        return ((t = _[0]), (e = _[1]), b(_[0], _[1]));
      } finally {
        r.__wbindgen_free(t, e, 1);
      }
    }
    get displayed_channels_csv() {
      let t, e;
      try {
        let _ = r.exrresult_displayed_channels_csv(this.__wbg_ptr);
        return ((t = _[0]), (e = _[1]), b(_[0], _[1]));
      } finally {
        r.__wbindgen_free(t, e, 1);
      }
    }
    get width() {
      return r.exrresult_width(this.__wbg_ptr) >>> 0;
    }
    get format() {
      return r.decodedarray_height(this.__wbg_ptr) >>> 0;
    }
    get height() {
      return r.exrresult_height(this.__wbg_ptr) >>> 0;
    }
    get channels() {
      return r.decodedarray_width(this.__wbg_ptr) >>> 0;
    }
    get data_max() {
      return r.decodedarray_non_finite_count(this.__wbg_ptr);
    }
    get data_min() {
      return r.decodedarray_data_max(this.__wbg_ptr);
    }
    get data_type() {
      return r.decodedarray_channels(this.__wbg_ptr) >>> 0;
    }
  };
Symbol.dispose && (H.prototype[Symbol.dispose] = H.prototype.free);
var mt =
    typeof FinalizationRegistry > 'u'
      ? { register: () => {}, unregister: () => {} }
      : new FinalizationRegistry(n => r.__wbg_exrzipplanjs_free(n >>> 0, 1)),
  C = class n {
    static __wrap(t) {
      t = t >>> 0;
      let e = Object.create(n.prototype);
      return ((e.__wbg_ptr = t), mt.register(e, e.__wbg_ptr, e), e);
    }
    __destroy_into_raw() {
      let t = this.__wbg_ptr;
      return ((this.__wbg_ptr = 0), mt.unregister(this), t);
    }
    free() {
      let t = this.__destroy_into_raw();
      r.__wbg_exrzipplanjs_free(t, 0);
    }
    get channel_name() {
      let t, e;
      try {
        let _ = r.exrzipplanjs_channel_name(this.__wbg_ptr);
        return ((t = _[0]), (e = _[1]), b(_[0], _[1]));
      } finally {
        r.__wbindgen_free(t, e, 1);
      }
    }
    get all_tags_json() {
      let t, e;
      try {
        let _ = r.exrzipplanjs_all_tags_json(this.__wbg_ptr);
        return ((t = _[0]), (e = _[1]), b(_[0], _[1]));
      } finally {
        r.__wbindgen_free(t, e, 1);
      }
    }
    get y_coordinates() {
      let t = r.exrzipplanjs_y_coordinates(this.__wbg_ptr);
      var e = _t(t[0], t[1]).slice();
      return (r.__wbindgen_free(t[0], t[1] * 4, 4), e);
    }
    take_compressed() {
      let t = r.exrzipplanjs_take_compressed(this.__wbg_ptr);
      var e = k(t[0], t[1]).slice();
      return (r.__wbindgen_free(t[0], t[1] * 1, 1), e);
    }
    get width() {
      return r.exrzipplanjs_width(this.__wbg_ptr) >>> 0;
    }
    get counts() {
      let t = r.exrzipplanjs_counts(this.__wbg_ptr);
      var e = Bt(t[0], t[1]).slice();
      return (r.__wbindgen_free(t[0], t[1] * 4, 4), e);
    }
    get data_y() {
      return r.exrzipplanjs_data_y(this.__wbg_ptr);
    }
    get height() {
      return r.decodedarray_bits_per_sample(this.__wbg_ptr) >>> 0;
    }
  };
Symbol.dispose && (C.prototype[Symbol.dispose] = C.prototype.free);
var xt =
    typeof FinalizationRegistry > 'u'
      ? { register: () => {}, unregister: () => {} }
      : new FinalizationRegistry(n => r.__wbg_hdrresult_free(n >>> 0, 1)),
  Q = class n {
    static __wrap(t) {
      t = t >>> 0;
      let e = Object.create(n.prototype);
      return ((e.__wbg_ptr = t), xt.register(e, e.__wbg_ptr, e), e);
    }
    __destroy_into_raw() {
      let t = this.__wbg_ptr;
      return ((this.__wbg_ptr = 0), xt.unregister(this), t);
    }
    free() {
      let t = this.__destroy_into_raw();
      r.__wbg_hdrresult_free(t, 0);
    }
    get all_tags_json() {
      let t, e;
      try {
        let _ = r.hdrresult_all_tags_json(this.__wbg_ptr);
        return ((t = _[0]), (e = _[1]), b(_[0], _[1]));
      } finally {
        r.__wbindgen_free(t, e, 1);
      }
    }
    take_data_as_f32() {
      let t = r.hdrresult_take_data_as_f32(this.__wbg_ptr);
      var e = m(t[0], t[1]).slice();
      return (r.__wbindgen_free(t[0], t[1] * 4, 4), e);
    }
    take_metadata_as_f64() {
      let t = r.hdrresult_take_metadata_as_f64(this.__wbg_ptr);
      var e = F(t[0], t[1]).slice();
      return (r.__wbindgen_free(t[0], t[1] * 8, 8), e);
    }
    get channels() {
      return r.hdrresult_channels(this.__wbg_ptr) >>> 0;
    }
  };
Symbol.dispose && (Q.prototype[Symbol.dispose] = Q.prototype.free);
var vt =
    typeof FinalizationRegistry > 'u'
      ? { register: () => {}, unregister: () => {} }
      : new FinalizationRegistry(n => r.__wbg_histogramresult_free(n >>> 0, 1)),
  N = class n {
    static __wrap(t) {
      t = t >>> 0;
      let e = Object.create(n.prototype);
      return ((e.__wbg_ptr = t), vt.register(e, e.__wbg_ptr, e), e);
    }
    __destroy_into_raw() {
      let t = this.__wbg_ptr;
      return ((this.__wbg_ptr = 0), vt.unregister(this), t);
    }
    free() {
      let t = this.__destroy_into_raw();
      r.__wbg_histogramresult_free(t, 0);
    }
    get non_finite_count() {
      return r.histogramresult_non_finite_count(this.__wbg_ptr) >>> 0;
    }
    get max() {
      return r.decodedarray_type_max(this.__wbg_ptr);
    }
    get min() {
      return r.decodedarray_type_min(this.__wbg_ptr);
    }
    get total() {
      return r.histogramresult_total(this.__wbg_ptr) >>> 0;
    }
    get counts() {
      let t = r.histogramresult_counts(this.__wbg_ptr);
      var e = _t(t[0], t[1]).slice();
      return (r.__wbindgen_free(t[0], t[1] * 4, 4), e);
    }
  };
Symbol.dispose && (N.prototype[Symbol.dispose] = N.prototype.free);
var kt =
    typeof FinalizationRegistry > 'u'
      ? { register: () => {}, unregister: () => {} }
      : new FinalizationRegistry(n => r.__wbg_imagestats_free(n >>> 0, 1)),
  z = class n {
    static __wrap(t) {
      t = t >>> 0;
      let e = Object.create(n.prototype);
      return ((e.__wbg_ptr = t), kt.register(e, e.__wbg_ptr, e), e);
    }
    __destroy_into_raw() {
      let t = this.__wbg_ptr;
      return ((this.__wbg_ptr = 0), kt.unregister(this), t);
    }
    free() {
      let t = this.__destroy_into_raw();
      r.__wbg_imagestats_free(t, 0);
    }
    get total_count() {
      return r.imagestats_total_count(this.__wbg_ptr);
    }
    get valid_count() {
      return r.decodedarray_non_finite_count(this.__wbg_ptr);
    }
    get non_finite_count() {
      return r.decodedarray_valid_count(this.__wbg_ptr);
    }
    get max() {
      return r.decodedarray_type_max(this.__wbg_ptr);
    }
    get min() {
      return r.decodedarray_type_min(this.__wbg_ptr);
    }
    get std() {
      return r.decodedarray_data_max(this.__wbg_ptr);
    }
    get mean() {
      return r.decodedarray_data_min(this.__wbg_ptr);
    }
  };
Symbol.dispose && (z.prototype[Symbol.dispose] = z.prototype.free);
var jt =
    typeof FinalizationRegistry > 'u'
      ? { register: () => {}, unregister: () => {} }
      : new FinalizationRegistry(n => r.__wbg_jpegresult_free(n >>> 0, 1)),
  tt = class n {
    static __wrap(t) {
      t = t >>> 0;
      let e = Object.create(n.prototype);
      return ((e.__wbg_ptr = t), jt.register(e, e.__wbg_ptr, e), e);
    }
    __destroy_into_raw() {
      let t = this.__wbg_ptr;
      return ((this.__wbg_ptr = 0), jt.unregister(this), t);
    }
    free() {
      let t = this.__destroy_into_raw();
      r.__wbg_jpegresult_free(t, 0);
    }
    take_data_as_u8() {
      let t = r.jpegresult_take_data_as_u8(this.__wbg_ptr);
      var e = k(t[0], t[1]).slice();
      return (r.__wbindgen_free(t[0], t[1] * 1, 1), e);
    }
    get width() {
      return r.demosaicresult_width(this.__wbg_ptr) >>> 0;
    }
    get height() {
      return r.demosaicresult_height(this.__wbg_ptr) >>> 0;
    }
    get channels() {
      return r.demosaicresult_channels(this.__wbg_ptr) >>> 0;
    }
  };
Symbol.dispose && (tt.prototype[Symbol.dispose] = tt.prototype.free);
var At =
    typeof FinalizationRegistry > 'u'
      ? { register: () => {}, unregister: () => {} }
      : new FinalizationRegistry(n => r.__wbg_labelresult_free(n >>> 0, 1)),
  V = class n {
    static __wrap(t) {
      t = t >>> 0;
      let e = Object.create(n.prototype);
      return ((e.__wbg_ptr = t), At.register(e, e.__wbg_ptr, e), e);
    }
    __destroy_into_raw() {
      let t = this.__wbg_ptr;
      return ((this.__wbg_ptr = 0), At.unregister(this), t);
    }
    free() {
      let t = this.__destroy_into_raw();
      r.__wbg_labelresult_free(t, 0);
    }
    take_labels_as_i32() {
      let t = r.labelresult_take_labels_as_i32(this.__wbg_ptr);
      if (t[3]) throw d(t[2]);
      var e = _t(t[0], t[1]).slice();
      return (r.__wbindgen_free(t[0], t[1] * 4, 4), e);
    }
    get count() {
      return r.demosaicresult_width(this.__wbg_ptr) >>> 0;
    }
    get width() {
      return r.demosaicresult_height(this.__wbg_ptr) >>> 0;
    }
    get height() {
      return r.demosaicresult_channels(this.__wbg_ptr) >>> 0;
    }
  };
Symbol.dispose && (V.prototype[Symbol.dispose] = V.prototype.free);
var Ft =
    typeof FinalizationRegistry > 'u'
      ? { register: () => {}, unregister: () => {} }
      : new FinalizationRegistry(n => r.__wbg_pngresult_free(n >>> 0, 1)),
  et = class n {
    static __wrap(t) {
      t = t >>> 0;
      let e = Object.create(n.prototype);
      return ((e.__wbg_ptr = t), Ft.register(e, e.__wbg_ptr, e), e);
    }
    __destroy_into_raw() {
      let t = this.__wbg_ptr;
      return ((this.__wbg_ptr = 0), Ft.unregister(this), t);
    }
    free() {
      let t = this.__destroy_into_raw();
      r.__wbg_pngresult_free(t, 0);
    }
    get color_type() {
      return r.decodedarray_width(this.__wbg_ptr) >>> 0;
    }
    get timing_total_ms() {
      return r.decodedarray_data_max(this.__wbg_ptr);
    }
    take_data_as_u16() {
      let t = r.pngresult_take_data_as_u16(this.__wbg_ptr);
      var e = dt(t[0], t[1]).slice();
      return (r.__wbindgen_free(t[0], t[1] * 2, 2), e);
    }
    get timing_decode_ms() {
      return r.decodedarray_type_max(this.__wbg_ptr);
    }
    get timing_convert_ms() {
      return r.decodedarray_data_min(this.__wbg_ptr);
    }
    get timing_read_info_ms() {
      return r.decodedarray_type_min(this.__wbg_ptr);
    }
    get width() {
      return r.pngresult_width(this.__wbg_ptr) >>> 0;
    }
    get height() {
      return r.pngresult_height(this.__wbg_ptr) >>> 0;
    }
    get channels() {
      return r.exrresult_width(this.__wbg_ptr) >>> 0;
    }
    get bit_depth() {
      return r.exrresult_height(this.__wbg_ptr) >>> 0;
    }
  };
Symbol.dispose && (et.prototype[Symbol.dispose] = et.prototype.free);
var zt =
    typeof FinalizationRegistry > 'u'
      ? { register: () => {}, unregister: () => {} }
      : new FinalizationRegistry(n => r.__wbg_rgbalayercompositor_free(n >>> 0, 1)),
  rt = class {
    __destroy_into_raw() {
      let t = this.__wbg_ptr;
      return ((this.__wbg_ptr = 0), zt.unregister(this), t);
    }
    free() {
      let t = this.__destroy_into_raw();
      r.__wbg_rgbalayercompositor_free(t, 0);
    }
    get covered_count() {
      return r.exrzipplanjs_width(this.__wbg_ptr) >>> 0;
    }
    add_channels_i8(t, e, _, s, o, i, a, l, f) {
      let g = u(t, r.__wbindgen_malloc),
        p = c,
        w = r.rgbalayercompositor_add_channels_i8(this.__wbg_ptr, g, p, e, _, s, o, i, a, l, f);
      if (w[1]) throw d(w[0]);
    }
    add_channels_u8(t, e, _, s, o, i, a, l, f) {
      let g = u(t, r.__wbindgen_malloc),
        p = c,
        w = r.rgbalayercompositor_add_channels_u8(this.__wbg_ptr, g, p, e, _, s, o, i, a, l, f);
      if (w[1]) throw d(w[0]);
    }
    finish_isolated(t, e) {
      let _ = r.rgbalayercompositor_finish_isolated(this.__wbg_ptr, t, e);
      if (_[1]) throw d(_[0]);
    }
    add_channels_f32(t, e, _, s, o, i, a, l, f) {
      let g = h(t, r.__wbindgen_malloc),
        p = c,
        w = r.rgbalayercompositor_add_channels_f32(this.__wbg_ptr, g, p, e, _, s, o, i, a, l, f);
      if (w[1]) throw d(w[0]);
    }
    add_channels_f64(t, e, _, s, o, i, a, l, f) {
      let g = Pe(t, r.__wbindgen_malloc),
        p = c,
        w = r.rgbalayercompositor_add_channels_f64(this.__wbg_ptr, g, p, e, _, s, o, i, a, l, f);
      if (w[1]) throw d(w[0]);
    }
    add_channels_i16(t, e, _, s, o, i, a, l, f) {
      let g = A(t, r.__wbindgen_malloc),
        p = c,
        w = r.rgbalayercompositor_add_channels_i16(this.__wbg_ptr, g, p, e, _, s, o, i, a, l, f);
      if (w[1]) throw d(w[0]);
    }
    add_channels_i32(t, e, _, s, o, i, a, l, f) {
      let g = lt(t, r.__wbindgen_malloc),
        p = c,
        w = r.rgbalayercompositor_add_channels_i32(this.__wbg_ptr, g, p, e, _, s, o, i, a, l, f);
      if (w[1]) throw d(w[0]);
    }
    add_channels_u16(t, e, _, s, o, i, a, l, f) {
      let g = A(t, r.__wbindgen_malloc),
        p = c,
        w = r.rgbalayercompositor_add_channels_u16(this.__wbg_ptr, g, p, e, _, s, o, i, a, l, f);
      if (w[1]) throw d(w[0]);
    }
    add_channels_u32(t, e, _, s, o, i, a, l, f) {
      let g = lt(t, r.__wbindgen_malloc),
        p = c,
        w = r.rgbalayercompositor_add_channels_u32(this.__wbg_ptr, g, p, e, _, s, o, i, a, l, f);
      if (w[1]) throw d(w[0]);
    }
    begin_isolated_u8(t, e, _, s, o) {
      let i = u(t, r.__wbindgen_malloc),
        a = c,
        l = r.rgbalayercompositor_begin_isolated_u8(this.__wbg_ptr, i, a, e, _, s, o);
      if (l[1]) throw d(l[0]);
    }
    begin_isolated_f32(t, e, _, s, o, i) {
      let a = h(t, r.__wbindgen_malloc),
        l = c,
        f = r.rgbalayercompositor_begin_isolated_f32(this.__wbg_ptr, a, l, e, _, s, o, i);
      if (f[1]) throw d(f[0]);
    }
    begin_isolated_u16(t, e, _, s, o, i) {
      let a = A(t, r.__wbindgen_malloc),
        l = c,
        f = r.rgbalayercompositor_begin_isolated_u16(this.__wbg_ptr, a, l, e, _, s, o, i);
      if (f[1]) throw d(f[0]);
    }
    isolated_apply_hue(t, e, _, s, o) {
      let i = r.rgbalayercompositor_isolated_apply_hue(this.__wbg_ptr, t, e, _, s, o);
      if (i[1]) throw d(i[0]);
    }
    isolated_apply_lut(t, e) {
      let _ = h(t, r.__wbindgen_malloc),
        s = c,
        o = r.rgbalayercompositor_isolated_apply_lut(this.__wbg_ptr, _, s, e);
      if (o[1]) throw d(o[0]);
    }
    isolated_apply_direct(t, e, _) {
      let s = h(e, r.__wbindgen_malloc),
        o = c,
        i = r.rgbalayercompositor_isolated_apply_direct(this.__wbg_ptr, t, s, o, _);
      if (i[1]) throw d(i[0]);
    }
    take_data_as_channels(t) {
      let e = r.rgbalayercompositor_take_data_as_channels(this.__wbg_ptr, t);
      if (e[3]) throw d(e[2]);
      var _ = m(e[0], e[1]).slice();
      return (r.__wbindgen_free(e[0], e[1] * 4, 4), _);
    }
    take_isolated_surface() {
      let t = r.rgbalayercompositor_take_isolated_surface(this.__wbg_ptr);
      if (t[3]) throw d(t[2]);
      var e = m(t[0], t[1]).slice();
      return (r.__wbindgen_free(t[0], t[1] * 4, 4), e);
    }
    isolated_add_f32_surface(t, e, _, s) {
      let o = h(t, r.__wbindgen_malloc),
        i = c,
        a = r.rgbalayercompositor_isolated_add_f32_surface(this.__wbg_ptr, o, i, e, _, s);
      if (a[1]) throw d(a[0]);
    }
    add_arithmetic_f32_surface(t, e, _, s) {
      let o = h(t, r.__wbindgen_malloc),
        i = c,
        a = r.rgbalayercompositor_add_arithmetic_f32_surface(this.__wbg_ptr, o, i, e, _, s);
      if (a[1]) throw d(a[0]);
    }
    isolated_apply_alpha_mask_u8(t, e, _, s, o, i, a, l) {
      let f = u(t, r.__wbindgen_malloc),
        g = c,
        p = r.rgbalayercompositor_isolated_apply_alpha_mask_u8(
          this.__wbg_ptr,
          f,
          g,
          e,
          _,
          s,
          o,
          i,
          a,
          l
        );
      if (p[1]) throw d(p[0]);
    }
    isolated_apply_selective_hue(t, e) {
      let _ = h(t, r.__wbindgen_malloc),
        s = c,
        o = r.rgbalayercompositor_isolated_apply_selective_hue(this.__wbg_ptr, _, s, e);
      if (o[1]) throw d(o[0]);
    }
    isolated_apply_alpha_mask_f32(t, e, _, s, o, i, a, l) {
      let f = h(t, r.__wbindgen_malloc),
        g = c,
        p = r.rgbalayercompositor_isolated_apply_alpha_mask_f32(
          this.__wbg_ptr,
          f,
          g,
          e,
          _,
          s,
          o,
          i,
          a,
          l
        );
      if (p[1]) throw d(p[0]);
    }
    isolated_apply_alpha_mask_u16(t, e, _, s, o, i, a, l) {
      let f = A(t, r.__wbindgen_malloc),
        g = c,
        p = r.rgbalayercompositor_isolated_apply_alpha_mask_u16(
          this.__wbg_ptr,
          f,
          g,
          e,
          _,
          s,
          o,
          i,
          a,
          l
        );
      if (p[1]) throw d(p[0]);
    }
    isolated_begin_masked_adjustment() {
      let t = r.rgbalayercompositor_isolated_begin_masked_adjustment(this.__wbg_ptr);
      if (t[1]) throw d(t[0]);
    }
    apply_brightness_mask_f32_surface(t, e, _, s) {
      let o = h(t, r.__wbindgen_malloc),
        i = c,
        a = r.rgbalayercompositor_apply_brightness_mask_f32_surface(this.__wbg_ptr, o, i, e, _, s);
      if (a[1]) throw d(a[0]);
    }
    isolated_add_arithmetic_f32_surface(t, e, _, s) {
      let o = h(t, r.__wbindgen_malloc),
        i = c,
        a = r.rgbalayercompositor_isolated_add_arithmetic_f32_surface(
          this.__wbg_ptr,
          o,
          i,
          e,
          _,
          s
        );
      if (a[1]) throw d(a[0]);
    }
    isolated_finish_masked_adjustment_u8(t, e, _, s, o, i, a, l) {
      let f = u(t, r.__wbindgen_malloc),
        g = c,
        p = r.rgbalayercompositor_isolated_finish_masked_adjustment_u8(
          this.__wbg_ptr,
          f,
          g,
          e,
          _,
          s,
          o,
          i,
          a,
          l
        );
      if (p[1]) throw d(p[0]);
    }
    isolated_finish_masked_adjustment_f32(t, e, _, s, o, i, a, l) {
      let f = h(t, r.__wbindgen_malloc),
        g = c,
        p = r.rgbalayercompositor_isolated_finish_masked_adjustment_f32(
          this.__wbg_ptr,
          f,
          g,
          e,
          _,
          s,
          o,
          i,
          a,
          l
        );
      if (p[1]) throw d(p[0]);
    }
    isolated_finish_masked_adjustment_u16(t, e, _, s, o, i, a, l) {
      let f = A(t, r.__wbindgen_malloc),
        g = c,
        p = r.rgbalayercompositor_isolated_finish_masked_adjustment_u16(
          this.__wbg_ptr,
          f,
          g,
          e,
          _,
          s,
          o,
          i,
          a,
          l
        );
      if (p[1]) throw d(p[0]);
    }
    constructor(t, e, _) {
      let s = r.rgbalayercompositor_new(t, e, _);
      if (s[2]) throw d(s[1]);
      return ((this.__wbg_ptr = s[0] >>> 0), zt.register(this, this.__wbg_ptr, this), this);
    }
    add_u8(t, e, _, s, o, i, a) {
      let l = u(t, r.__wbindgen_malloc),
        f = c,
        g = r.rgbalayercompositor_add_u8(this.__wbg_ptr, l, f, e, _, s, o, i, a);
      if (g[1]) throw d(g[0]);
    }
    add_f32(t, e, _, s, o, i, a, l) {
      let f = h(t, r.__wbindgen_malloc),
        g = c,
        p = r.rgbalayercompositor_add_f32(this.__wbg_ptr, f, g, e, _, s, o, i, a, l);
      if (p[1]) throw d(p[0]);
    }
    add_u16(t, e, _, s, o, i, a, l) {
      let f = A(t, r.__wbindgen_malloc),
        g = c,
        p = r.rgbalayercompositor_add_u16(this.__wbg_ptr, f, g, e, _, s, o, i, a, l);
      if (p[1]) throw d(p[0]);
    }
    get max_value() {
      return r.rgbalayercompositor_max_value(this.__wbg_ptr);
    }
    get min_value() {
      return r.rgbalayercompositor_min_value(this.__wbg_ptr);
    }
    take_data() {
      let t = r.rgbalayercompositor_take_data(this.__wbg_ptr);
      var e = m(t[0], t[1]).slice();
      return (r.__wbindgen_free(t[0], t[1] * 4, 4), e);
    }
  };
Symbol.dispose && (rt.prototype[Symbol.dispose] = rt.prototype.free);
var St =
    typeof FinalizationRegistry > 'u'
      ? { register: () => {}, unregister: () => {} }
      : new FinalizationRegistry(n => r.__wbg_stabilitycurveresult_free(n >>> 0, 1)),
  I = class n {
    static __wrap(t) {
      t = t >>> 0;
      let e = Object.create(n.prototype);
      return ((e.__wbg_ptr = t), St.register(e, e.__wbg_ptr, e), e);
    }
    __destroy_into_raw() {
      let t = this.__wbg_ptr;
      return ((this.__wbg_ptr = 0), St.unregister(this), t);
    }
    free() {
      let t = this.__destroy_into_raw();
      r.__wbg_stabilitycurveresult_free(t, 0);
    }
    get object_counts() {
      let t = r.stabilitycurveresult_object_counts(this.__wbg_ptr);
      var e = Bt(t[0], t[1]).slice();
      return (r.__wbindgen_free(t[0], t[1] * 4, 4), e);
    }
    get plateau_width() {
      return r.stabilitycurveresult_plateau_width(this.__wbg_ptr);
    }
    get suggested_bin() {
      return r.exrresult_height(this.__wbg_ptr);
    }
    get area_fractions() {
      let t = r.stabilitycurveresult_area_fractions(this.__wbg_ptr);
      var e = F(t[0], t[1]).slice();
      return (r.__wbindgen_free(t[0], t[1] * 8, 8), e);
    }
    get bins() {
      let t = r.stabilitycurveresult_bins(this.__wbg_ptr);
      var e = _t(t[0], t[1]).slice();
      return (r.__wbindgen_free(t[0], t[1] * 4, 4), e);
    }
    get values() {
      let t = r.stabilitycurveresult_values(this.__wbg_ptr);
      var e = F(t[0], t[1]).slice();
      return (r.__wbindgen_free(t[0], t[1] * 8, 8), e);
    }
  };
Symbol.dispose && (I.prototype[Symbol.dispose] = I.prototype.free);
var Et =
    typeof FinalizationRegistry > 'u'
      ? { register: () => {}, unregister: () => {} }
      : new FinalizationRegistry(n => r.__wbg_tifffloatstripplanjs_free(n >>> 0, 1)),
  L = class n {
    static __wrap(t) {
      t = t >>> 0;
      let e = Object.create(n.prototype);
      return ((e.__wbg_ptr = t), Et.register(e, e.__wbg_ptr, e), e);
    }
    __destroy_into_raw() {
      let t = this.__wbg_ptr;
      return ((this.__wbg_ptr = 0), Et.unregister(this), t);
    }
    free() {
      let t = this.__destroy_into_raw();
      r.__wbg_tifffloatstripplanjs_free(t, 0);
    }
    get tile_width() {
      return r.exrzipplanjs_data_y(this.__wbg_ptr) >>> 0;
    }
    get block_count() {
      return r.tifffloatstripplanjs_block_count(this.__wbg_ptr) >>> 0;
    }
    get compression() {
      return r.pngresult_height(this.__wbg_ptr) >>> 0;
    }
    get orientation() {
      return r.decodedarray_height(this.__wbg_ptr) >>> 0;
    }
    get strip_count() {
      return r.tifffloatstripplanjs_strip_count(this.__wbg_ptr) >>> 0;
    }
    get tile_length() {
      return r.decodedarray_sample_kind(this.__wbg_ptr) >>> 0;
    }
    get blocks_across() {
      return r.tifffloatstripplanjs_blocks_across(this.__wbg_ptr) >>> 0;
    }
    get little_endian() {
      return r.tifffloatstripplanjs_little_endian(this.__wbg_ptr) !== 0;
    }
    get sample_format() {
      return r.exrresult_height(this.__wbg_ptr) >>> 0;
    }
    get rows_per_strip() {
      return r.decodedarray_bits_per_sample(this.__wbg_ptr) >>> 0;
    }
    get bits_per_sample() {
      return r.hdrresult_channels(this.__wbg_ptr) >>> 0;
    }
    get blocks_per_unit() {
      return r.tifffloatstripplanjs_blocks_per_unit(this.__wbg_ptr) >>> 0;
    }
    get planar_configuration() {
      return r.stabilitycurveresult_plateau_width(this.__wbg_ptr) >>> 0;
    }
    get photometric_interpretation() {
      return r.exrzipplanjs_width(this.__wbg_ptr) >>> 0;
    }
    get lerc_additional_compression() {
      return r.tifffloatstripplanjs_lerc_additional_compression(this.__wbg_ptr) >>> 0;
    }
    get width() {
      return r.histogramresult_non_finite_count(this.__wbg_ptr) >>> 0;
    }
    get counts() {
      let t = r.tifffloatstripplanjs_counts(this.__wbg_ptr);
      var e = F(t[0], t[1]).slice();
      return (r.__wbindgen_free(t[0], t[1] * 8, 8), e);
    }
    get height() {
      return r.tifffloatstripplanjs_height(this.__wbg_ptr) >>> 0;
    }
    get offsets() {
      let t = r.tifffloatstripplanjs_offsets(this.__wbg_ptr);
      var e = F(t[0], t[1]).slice();
      return (r.__wbindgen_free(t[0], t[1] * 8, 8), e);
    }
    get channels() {
      return r.tifffloatstripplanjs_channels(this.__wbg_ptr) >>> 0;
    }
    get predictor() {
      return r.tifffloatstripplanjs_predictor(this.__wbg_ptr) >>> 0;
    }
  };
Symbol.dispose && (L.prototype[Symbol.dispose] = L.prototype.free);
var Tt =
    typeof FinalizationRegistry > 'u'
      ? { register: () => {}, unregister: () => {} }
      : new FinalizationRegistry(n => r.__wbg_tiffregiondecoder_free(n >>> 0, 1)),
  nt = class {
    __destroy_into_raw() {
      let t = this.__wbg_ptr;
      return ((this.__wbg_ptr = 0), Tt.unregister(this), t);
    }
    free() {
      let t = this.__destroy_into_raw();
      r.__wbg_tiffregiondecoder_free(t, 0);
    }
    constructor(t) {
      let e = u(t, r.__wbindgen_malloc),
        _ = c,
        s = r.tiffregiondecoder_new(e, _);
      return ((this.__wbg_ptr = s >>> 0), Tt.register(this, this.__wbg_ptr, this), this);
    }
    decode(t, e, _, s, o) {
      let i = r.tiffregiondecoder_decode(this.__wbg_ptr, t, e, _, s, o);
      if (i[2]) throw d(i[1]);
      return T.__wrap(i[0]);
    }
  };
Symbol.dispose && (nt.prototype[Symbol.dispose] = nt.prototype.free);
var Rt =
    typeof FinalizationRegistry > 'u'
      ? { register: () => {}, unregister: () => {} }
      : new FinalizationRegistry(n => r.__wbg_tiffregionjs_free(n >>> 0, 1)),
  T = class n {
    static __wrap(t) {
      t = t >>> 0;
      let e = Object.create(n.prototype);
      return ((e.__wbg_ptr = t), Rt.register(e, e.__wbg_ptr, e), e);
    }
    __destroy_into_raw() {
      let t = this.__wbg_ptr;
      return ((this.__wbg_ptr = 0), Rt.unregister(this), t);
    }
    free() {
      let t = this.__destroy_into_raw();
      r.__wbg_tiffregionjs_free(t, 0);
    }
    get sample_format() {
      return r.hdrresult_channels(this.__wbg_ptr) >>> 0;
    }
    get blocks_decoded() {
      return r.pngresult_height(this.__wbg_ptr) >>> 0;
    }
    get bits_per_sample() {
      return r.tifffloatstripplanjs_channels(this.__wbg_ptr) >>> 0;
    }
    take_data_as_f32() {
      let t = r.tiffregionjs_take_data_as_f32(this.__wbg_ptr);
      var e = m(t[0], t[1]).slice();
      return (r.__wbindgen_free(t[0], t[1] * 4, 4), e);
    }
    get x() {
      return r.demosaicresult_width(this.__wbg_ptr) >>> 0;
    }
    get y() {
      return r.demosaicresult_height(this.__wbg_ptr) >>> 0;
    }
    get width() {
      return r.demosaicresult_channels(this.__wbg_ptr) >>> 0;
    }
    get height() {
      return r.histogramresult_non_finite_count(this.__wbg_ptr) >>> 0;
    }
    get channels() {
      return r.tifffloatstripplanjs_height(this.__wbg_ptr) >>> 0;
    }
  };
Symbol.dispose && (T.prototype[Symbol.dispose] = T.prototype.free);
var Mt =
    typeof FinalizationRegistry > 'u'
      ? { register: () => {}, unregister: () => {} }
      : new FinalizationRegistry(n => r.__wbg_tiffresult_free(n >>> 0, 1)),
  S = class n {
    static __wrap(t) {
      t = t >>> 0;
      let e = Object.create(n.prototype);
      return ((e.__wbg_ptr = t), Mt.register(e, e.__wbg_ptr, e), e);
    }
    __destroy_into_raw() {
      let t = this.__wbg_ptr;
      return ((this.__wbg_ptr = 0), Mt.unregister(this), t);
    }
    free() {
      let t = this.__destroy_into_raw();
      r.__wbg_tiffresult_free(t, 0);
    }
    get tile_count() {
      return r.tiffresult_tile_count(this.__wbg_ptr) >>> 0;
    }
    get tile_width() {
      return r.tiffresult_tile_width(this.__wbg_ptr) >>> 0;
    }
    get compression() {
      return r.tiffresult_compression(this.__wbg_ptr) >>> 0;
    }
    get sample_kind() {
      return r.tiffresult_sample_kind(this.__wbg_ptr) >>> 0;
    }
    get strip_count() {
      return r.tiffresult_strip_count(this.__wbg_ptr) >>> 0;
    }
    get tile_length() {
      return r.tiffresult_tile_length(this.__wbg_ptr) >>> 0;
    }
    get all_tags_json() {
      let t, e;
      try {
        let _ = r.tiffresult_all_tags_json(this.__wbg_ptr);
        return ((t = _[0]), (e = _[1]), b(_[0], _[1]));
      } finally {
        r.__wbindgen_free(t, e, 1);
      }
    }
    get direct_decode() {
      return r.tiffresult_direct_decode(this.__wbg_ptr) !== 0;
    }
    get sample_format() {
      return r.tiffresult_sample_format(this.__wbg_ptr) >>> 0;
    }
    get_data_bytes() {
      let t = r.tiffresult_get_data_bytes(this.__wbg_ptr);
      var e = k(t[0], t[1]).slice();
      return (r.__wbindgen_free(t[0], t[1] * 1, 1), e);
    }
    get rows_per_strip() {
      return r.tiffresult_rows_per_strip(this.__wbg_ptr) >>> 0;
    }
    get timing_pack_ms() {
      return r.tiffresult_timing_pack_ms(this.__wbg_ptr);
    }
    get bits_per_sample() {
      return r.tiffresult_bits_per_sample(this.__wbg_ptr) >>> 0;
    }
    get_data_as_f32() {
      let t = r.tiffresult_get_data_as_f32(this.__wbg_ptr);
      var e = m(t[0], t[1]).slice();
      return (r.__wbindgen_free(t[0], t[1] * 4, 4), e);
    }
    take_data_as_u8() {
      let t = r.tiffresult_take_data_as_u8(this.__wbg_ptr);
      var e = k(t[0], t[1]).slice();
      return (r.__wbindgen_free(t[0], t[1] * 1, 1), e);
    }
    get timing_stats_ms() {
      return r.tiffresult_timing_stats_ms(this.__wbg_ptr);
    }
    take_data_as_f32() {
      let t = r.tiffresult_take_data_as_f32(this.__wbg_ptr);
      var e = m(t[0], t[1]).slice();
      return (r.__wbindgen_free(t[0], t[1] * 4, 4), e);
    }
    get timing_decode_ms() {
      return r.decodedarray_valid_count(this.__wbg_ptr);
    }
    get timing_convert_ms() {
      return r.imagestats_total_count(this.__wbg_ptr);
    }
    get timing_metadata_ms() {
      return r.decodedarray_non_finite_count(this.__wbg_ptr);
    }
    get page_directory_json() {
      let t, e;
      try {
        let _ = r.tiffresult_page_directory_json(this.__wbg_ptr);
        return ((t = _[0]), (e = _[1]), b(_[0], _[1]));
      } finally {
        r.__wbindgen_free(t, e, 1);
      }
    }
    get planar_configuration() {
      return r.tiffresult_planar_configuration(this.__wbg_ptr) >>> 0;
    }
    get strip_byte_count_max() {
      return r.tiffresult_strip_byte_count_max(this.__wbg_ptr);
    }
    get strip_byte_count_total() {
      return r.tiffresult_strip_byte_count_total(this.__wbg_ptr);
    }
    get photometric_interpretation() {
      return r.tiffresult_photometric_interpretation(this.__wbg_ptr) >>> 0;
    }
    get width() {
      return r.decodedarray_source_data_offset(this.__wbg_ptr) >>> 0;
    }
    get height() {
      return r.tifffloatstripplanjs_lerc_additional_compression(this.__wbg_ptr) >>> 0;
    }
    get ome_xml() {
      let t, e;
      try {
        let _ = r.tiffresult_ome_xml(this.__wbg_ptr);
        return ((t = _[0]), (e = _[1]), b(_[0], _[1]));
      } finally {
        r.__wbindgen_free(t, e, 1);
      }
    }
    get channels() {
      return r.tiffresult_channels(this.__wbg_ptr) >>> 0;
    }
    get data_len() {
      return r.tiffresult_data_len(this.__wbg_ptr) >>> 0;
    }
    get geo_json() {
      let t, e;
      try {
        let _ = r.tiffresult_geo_json(this.__wbg_ptr);
        return ((t = _[0]), (e = _[1]), b(_[0], _[1]));
      } finally {
        r.__wbindgen_free(t, e, 1);
      }
    }
    get max_value() {
      return r.decodedarray_data_max(this.__wbg_ptr);
    }
    get min_value() {
      return r.decodedarray_data_min(this.__wbg_ptr);
    }
    get predictor() {
      return r.tiffresult_predictor(this.__wbg_ptr) >>> 0;
    }
  };
Symbol.dispose && (S.prototype[Symbol.dispose] = S.prototype.free);
var Pt =
    typeof FinalizationRegistry > 'u'
      ? { register: () => {}, unregister: () => {} }
      : new FinalizationRegistry(n => r.__wbg_tiffstripmetadatajs_free(n >>> 0, 1)),
  J = class n {
    static __wrap(t) {
      t = t >>> 0;
      let e = Object.create(n.prototype);
      return ((e.__wbg_ptr = t), Pt.register(e, e.__wbg_ptr, e), e);
    }
    __destroy_into_raw() {
      let t = this.__wbg_ptr;
      return ((this.__wbg_ptr = 0), Pt.unregister(this), t);
    }
    free() {
      let t = this.__destroy_into_raw();
      r.__wbg_tiffstripmetadatajs_free(t, 0);
    }
    get page_count() {
      return r.exrresult_height(this.__wbg_ptr) >>> 0;
    }
    get all_tags_json() {
      let t, e;
      try {
        let _ = r.tiffstripmetadatajs_all_tags_json(this.__wbg_ptr);
        return ((t = _[0]), (e = _[1]), b(_[0], _[1]));
      } finally {
        r.__wbindgen_free(t, e, 1);
      }
    }
    get page_directory_json() {
      let t, e;
      try {
        let _ = r.tiffstripmetadatajs_page_directory_json(this.__wbg_ptr);
        return ((t = _[0]), (e = _[1]), b(_[0], _[1]));
      } finally {
        r.__wbindgen_free(t, e, 1);
      }
    }
    get photometric_interpretation() {
      return r.stabilitycurveresult_plateau_width(this.__wbg_ptr) >>> 0;
    }
    get ome_xml() {
      let t, e;
      try {
        let _ = r.tiffstripmetadatajs_ome_xml(this.__wbg_ptr);
        return ((t = _[0]), (e = _[1]), b(_[0], _[1]));
      } finally {
        r.__wbindgen_free(t, e, 1);
      }
    }
    get geo_json() {
      let t, e;
      try {
        let _ = r.tiffstripmetadatajs_geo_json(this.__wbg_ptr);
        return ((t = _[0]), (e = _[1]), b(_[0], _[1]));
      } finally {
        r.__wbindgen_free(t, e, 1);
      }
    }
  };
Symbol.dispose && (J.prototype[Symbol.dispose] = J.prototype.free);
var We = new Set(['basic', 'cors', 'default']);
async function De(n, t) {
  if (typeof Response == 'function' && n instanceof Response) {
    if (typeof WebAssembly.instantiateStreaming == 'function')
      try {
        return await WebAssembly.instantiateStreaming(n, t);
      } catch (_) {
        if (n.ok && We.has(n.type) && n.headers.get('Content-Type') !== 'application/wasm')
          console.warn(
            '`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n',
            _
          );
        else throw _;
      }
    let e = await n.arrayBuffer();
    return await WebAssembly.instantiate(e, t);
  } else {
    let e = await WebAssembly.instantiate(n, t);
    return e instanceof WebAssembly.Instance ? { instance: e, module: n } : e;
  }
}
function Ue() {
  let n = {};
  return (
    (n.wbg = {}),
    (n.wbg.__wbg___wbindgen_throw_b855445ff6a94295 = function (t, e) {
      throw new Error(b(t, e));
    }),
    (n.wbg.__wbg_error_7534b8e9a36f1ab4 = function (t, e) {
      let _, s;
      try {
        ((_ = t), (s = e), console.error(b(t, e)));
      } finally {
        r.__wbindgen_free(_, s, 1);
      }
    }),
    (n.wbg.__wbg_length_4126f257d88ef51e = function (t) {
      return t.length;
    }),
    (n.wbg.__wbg_length_58bec3c3f0487eb5 = function (t) {
      return t.length;
    }),
    (n.wbg.__wbg_length_69bca3cb64fc8748 = function (t) {
      return t.length;
    }),
    (n.wbg.__wbg_new_8a6f238a6ece86ea = function () {
      return new Error();
    }),
    (n.wbg.__wbg_now_793306c526e2e3b6 = function () {
      return Date.now();
    }),
    (n.wbg.__wbg_set_7a75d83ea249c6e0 = function (t, e, _) {
      t.set(dt(e, _));
    }),
    (n.wbg.__wbg_set_9e6516df7b7d0f19 = function (t, e, _) {
      t.set(k(e, _));
    }),
    (n.wbg.__wbg_set_eaa55bcb7597ecca = function (t, e, _) {
      t.set(m(e, _));
    }),
    (n.wbg.__wbg_stack_0ed75d68575b0f3c = function (t, e) {
      let _ = e.stack,
        s = v(_, r.__wbindgen_malloc, r.__wbindgen_realloc),
        o = c;
      (wt().setInt32(t + 4, o, !0), wt().setInt32(t + 0, s, !0));
    }),
    (n.wbg.__wbg_subarray_480600f3d6a9f26c = function (t, e, _) {
      return t.subarray(e >>> 0, _ >>> 0);
    }),
    (n.wbg.__wbg_subarray_b24c6237257bcd4d = function (t, e, _) {
      return t.subarray(e >>> 0, _ >>> 0);
    }),
    (n.wbg.__wbg_subarray_e9ae4d887d066081 = function (t, e, _) {
      return t.subarray(e >>> 0, _ >>> 0);
    }),
    (n.wbg.__wbindgen_cast_2241b6af4c4b2941 = function (t, e) {
      return b(t, e);
    }),
    (n.wbg.__wbindgen_init_externref_table = function () {
      let t = r.__wbindgen_externrefs,
        e = t.grow(4);
      (t.set(0, void 0),
        t.set(e + 0, void 0),
        t.set(e + 1, null),
        t.set(e + 2, !0),
        t.set(e + 3, !1));
    }),
    n
  );
}
function Be(n, t) {
  return (
    (r = n.exports),
    (Ae.__wbindgen_wasm_module = t),
    (j = null),
    (P = null),
    (O = null),
    (D = null),
    (M = null),
    (W = null),
    (R = null),
    r.__wbindgen_start(),
    r
  );
}
async function Ae(n) {
  if (r !== void 0) return r;
  (typeof n < 'u' &&
    (Object.getPrototypeOf(n) === Object.prototype
      ? ({ module_or_path: n } = n)
      : console.warn(
          'using deprecated parameters for the initialization function; pass a single object instead'
        )),
    typeof n > 'u' && (n = new URL('wasm/tiff-wasm.wasm', import.meta.url)));
  let t = Ue();
  (typeof n == 'string' ||
    (typeof Request == 'function' && n instanceof Request) ||
    (typeof URL == 'function' && n instanceof URL)) &&
    (n = fetch(n));
  let { instance: e, module: _ } = await De(await n, t);
  return Be(e, _);
}
var Fe = Ae;
var G = null,
  st = null;
async function ft() {
  return (
    G ||
    st ||
    ((st = (async () => {
      try {
        let n = globalThis.__tiffVisualizerDecoderWarmup,
          t;
        if (n?.wasmModulePromise)
          try {
            t = await n.wasmModulePromise;
          } catch {}
        if (!t) {
          let e = globalThis.__tiffVisualizerVendorAssets?.wasm;
          if (e) {
            let _ = await fetch(e);
            if (!_.ok) throw new Error(`TIFF WASM fetch failed (${_.status})`);
            t = await _.arrayBuffer();
          }
        }
        return (
          await Fe(t),
          (G = {
            decode_tiff: le,
            decode_tiff_page: re,
            tiff_page_count: oe,
            tiff_page_directory: Xt,
            extract_exif_tags: ee,
            demosaic: Jt,
            decode_tiff_region: Ct,
            tiff_region_decode_available: Gt,
            decode_tiff_preview: Lt,
            tiff_preview_reduction: ie,
            remote_tiff_header: Ht,
            remote_tiff_ifd: Kt,
            remote_tiff_index_values: Zt,
            decode_pfm_display_fast: $t,
            decode_ppm_display_fast: Qt,
            decode_npy_display_fast: qt,
            decode_fits_fast: ae,
            decode_netcdf_fast: Nt,
            decode_dicom_fast: It,
            decode_czi_fast: ne,
            decode_nd2_fast: ce,
            decode_lif_fast: _e,
            decode_sdt_fast: te,
            compute_image_stats_f32: ge,
            compute_image_stats_u8: de,
            compute_image_stats_u16: xe,
            label_components_fast: fe,
            fill_mask_holes_fast: we,
            distance_transform_fast: je,
            gaussian_blur_fast: ve,
            subtract_background_fast: me,
            build_histogram_fast: he,
            auto_threshold_bin_fast: ye,
            global_threshold_mask_fast: ue,
            local_threshold_mask_fast: ke,
            local_auto_threshold_mask_fast: pe,
            compute_stability_curve_fast: be,
            tiff_float_strip_plan: se,
            tiff_strip_metadata: Yt,
            exr_zip_f32_plan: Vt,
          }),
          G
        );
      } catch (n) {
        let t = typeof process < 'u' && !!process.versions?.node;
        return (
          console.warn(
            t
              ? `[tiff-wasm-wrapper] WASM self-initialization is unavailable under Node (expected); pass explicit bytes to init(). ${n}`
              : `Failed to load WASM module, will use geotiff.js fallback: ${n}`
          ),
          null
        );
      }
    })()),
    st)
  );
}
async function tr() {
  return ft();
}
function er() {
  return G;
}
var ze = class {
  constructor() {
    this.wasm = null;
  }
  async init() {
    return ((this.wasm = await ft()), this.wasm !== null);
  }
  isAvailable() {
    return this.wasm !== null;
  }
  async decode(t, e = 0) {
    if (!this.wasm) throw new Error('WASM not initialized. Call init() first.');
    try {
      return this._decodeWith(this.wasm, t, e);
    } catch (_) {
      let { externalCodecName: s, initCodecDecoder: o } =
          await import('./codec-wasm-wrapper-NJAWPBBK.js'),
        i = s(_);
      if (!i) throw _;
      if (i === 'JPEG XL') {
        let { initJxlDecoder: a } = await import('./jxl-wasm-wrapper-VTRTRVT7.js');
        return this._decodeWith(await a(), t, e);
      }
      return this._decodeWith(await o(), t, e);
    }
  }
  _decodeWith(t, e, _) {
    let s = new Uint8Array(e),
      o = (_ === 0 || _ === 1) && t.tiff_preview_reduction?.(s) > 0,
      i = o ? 2 : typeof t.tiff_page_count == 'function' ? t.tiff_page_count(s) : 1;
    if (_ < 0 || _ >= i) throw new Error(`TIFF page index ${_} is out of range (page count: ${i})`);
    o && (_ = 1);
    let a = o
        ? t.decode_tiff_preview(s)
        : _ > 0 && typeof t.decode_tiff_page == 'function'
          ? t.decode_tiff_page(s, _)
          : t.decode_tiff(s),
      l = Number(a.sample_kind ?? 0),
      f;
    if ((l === 1 || l === 3) && typeof a.take_data_as_u8 == 'function') {
      let p = a.take_data_as_u8();
      f = l === 3 ? new Uint16Array(p.buffer, p.byteOffset, p.byteLength / 2) : p;
    } else
      f =
        typeof a.take_data_as_f32 == 'function'
          ? a.take_data_as_f32()
          : new Float32Array(a.get_data_as_f32());
    return {
      pageIndex: _,
      pageCount: i,
      width: a.width,
      height: a.height,
      channels: a.channels,
      bitsPerSample: a.bits_per_sample,
      sampleFormat: a.sample_format,
      sampleKind: l,
      compression: a.compression,
      predictor: a.predictor,
      photometricInterpretation: a.photometric_interpretation,
      planarConfiguration: a.planar_configuration,
      rowsPerStrip: a.rows_per_strip,
      stripCount: a.strip_count,
      stripByteCountTotal: Number(a.strip_byte_count_total || 0),
      stripByteCountMax: Number(a.strip_byte_count_max || 0),
      tileWidth: a.tile_width,
      tileLength: a.tile_length,
      tileCount: a.tile_count,
      directDecode: a.direct_decode,
      data: f,
      min: a.min_value,
      max: a.max_value,
      allTagsJson: a.all_tags_json,
      omeXml: a.ome_xml || void 0,
      geoJson: a.geo_json || void 0,
      pageDirectoryJson: a.page_directory_json || void 0,
    };
  }
};
async function rr(n) {
  let t = await ft();
  if (!t || typeof t.extract_exif_tags != 'function') return [];
  try {
    return ut(t.extract_exif_tags(n));
  } catch (e) {
    return (console.warn('[extractExifTagsFromBlob] Failed to parse embedded Exif blob:', e), []);
  }
}
export {
  Ce as a,
  Ne as b,
  Ve as c,
  ut as d,
  Je as e,
  Ge as f,
  $e as g,
  Xe as h,
  Ke as i,
  ft as j,
  tr as k,
  er as l,
  ze as m,
  rr as n,
};
