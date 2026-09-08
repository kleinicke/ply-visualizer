var _r = Object.create;
var Ht = Object.defineProperty;
var sr = Object.getOwnPropertyDescriptor;
var ar = Object.getOwnPropertyNames;
var cr = Object.getPrototypeOf,
  dr = Object.prototype.hasOwnProperty;
var fr = (r, t) => () => (t || r((t = { exports: {} }).exports, t), t.exports);
var lr = (r, t, e, n) => {
  if ((t && typeof t == 'object') || typeof t == 'function')
    for (let i of ar(t))
      !dr.call(r, i) &&
        i !== e &&
        Ht(r, i, { get: () => t[i], enumerable: !(n = sr(t, i)) || n.enumerable });
  return r;
};
var ur = (r, t, e) => (
  (e = r != null ? _r(cr(r)) : {}),
  lr(t || !r || !r.__esModule ? Ht(e, 'default', { value: r, enumerable: !0 }) : e, r)
);
var Vt = fr((kn, Xt) => {
  var gr = '#\\?RADIANCE',
    pr = '#.*',
    wr = 'EXPOSURE=\\s*([0-9]*[.][0-9]*)',
    br = 'FORMAT=32-bit_rle_rgbe',
    mr = '-Y ([0-9]+) \\+X ([0-9]+)';
  function hr(r, t, e, n, i, s) {
    var _ = new Array(4),
      a = null,
      c,
      g,
      f,
      u = new Array(2),
      b = r.length;
    function w(x) {
      var A = 0;
      do x[A++] = r[n];
      while (++n < b && A < x.length);
      return A;
    }
    function j(x, A, v) {
      var S = 0;
      do x[A + S++] = r[n];
      while (++n < b && S < v);
      return S;
    }
    function G(x, A, v, S) {
      var E = 4 * S,
        z = j(A, v, E);
      if (z < E) throw new Error('Error reading raw pixels: got ' + z + ' bytes, expected ' + E);
    }
    for (; s > 0;) {
      if (w(_) < _.length) throw new Error('Error reading bytes: expected ' + _.length);
      if (_[0] != 2 || _[1] != 2 || (_[2] & 128) != 0) {
        ((t[e++] = _[0]), (t[e++] = _[1]), (t[e++] = _[2]), (t[e++] = _[3]), G(r, t, e, i * s - 1));
        return;
      }
      if ((((_[2] & 255) << 8) | (_[3] & 255)) != i)
        throw new Error(
          'Wrong scanline width ' + (((_[2] & 255) << 8) | (_[3] & 255)) + ', expected ' + i
        );
      (a == null && (a = new Array(4 * i)), (c = 0));
      for (var y = 0; y < 4; y++)
        for (g = (y + 1) * i; c < g;) {
          if (w(u) < u.length) throw new Error('Error reading 2-byte buffer');
          if ((u[0] & 255) > 128) {
            if (((f = (u[0] & 255) - 128), f == 0 || f > g - c))
              throw new Error('Bad scanline data');
            for (; f-- > 0;) a[c++] = u[1];
          } else {
            if (((f = u[0] & 255), f == 0 || f > g - c)) throw new Error('Bad scanline data');
            if (((a[c++] = u[1]), --f > 0)) {
              if (j(a, c, f) < f) throw new Error('Error reading non-run data');
              c += f;
            }
          }
        }
      for (var y = 0; y < i; y++)
        ((t[e + 0] = a[y]),
          (t[e + 1] = a[y + i]),
          (t[e + 2] = a[y + 2 * i]),
          (t[e + 3] = a[y + 3 * i]),
          (e += 4));
      s--;
    }
  }
  function yr(r) {
    r instanceof ArrayBuffer && (r = new Uint8Array(r));
    var t = 0,
      e = r.length,
      n = 10;
    function i() {
      var q = '';
      do {
        var B = r[t];
        if (B == n) {
          ++t;
          break;
        }
        q += String.fromCharCode(B);
      } while (++t < e);
      return q;
    }
    for (var s = 0, _ = 0, a = 1, c = 1, g = !1, f = 0; f < 20; f++) {
      var u = i(),
        b;
      if (!(b = u.match(gr))) {
        if ((b = u.match(br))) g = !0;
        else if ((b = u.match(wr))) a = Number(b[1]);
        else if (!(b = u.match(pr))) {
          if ((b = u.match(mr))) {
            ((_ = Number(b[1])), (s = Number(b[2])));
            break;
          }
        }
      }
    }
    if (!g) throw new Error('File is not run length encoded!');
    var w = new Uint8Array(s * _ * 4),
      j = s,
      G = _;
    hr(r, w, 0, t, j, G);
    for (var y = new Float32Array(s * _ * 4), x = 0; x < w.length; x += 4) {
      var A = w[x + 0] / 255,
        v = w[x + 1] / 255,
        S = w[x + 2] / 255,
        E = w[x + 3],
        z = Math.pow(2, E - 128);
      ((A *= z), (v *= z), (S *= z));
      var I = x;
      ((y[I + 0] = A), (y[I + 1] = v), (y[I + 2] = S), (y[I + 3] = 1));
    }
    return { shape: [s, _], exposure: a, gamma: c, data: y };
  }
  Xt.exports = yr;
});
typeof globalThis.window > 'u' && (globalThis.window = globalThis);
var or = ur(Vt());
var o,
  Q = null;
function X() {
  return ((Q === null || Q.byteLength === 0) && (Q = new Uint8Array(o.memory.buffer)), Q);
}
var mt = new TextDecoder('utf-8', { ignoreBOM: !0, fatal: !0 });
mt.decode();
var xr = 2146435072,
  Mt = 0;
function Ar(r, t) {
  return (
    (Mt += t),
    Mt >= xr &&
      ((mt = new TextDecoder('utf-8', { ignoreBOM: !0, fatal: !0 })), mt.decode(), (Mt = t)),
    mt.decode(X().subarray(r, r + t))
  );
}
function h(r, t) {
  return ((r = r >>> 0), Ar(r, t));
}
var tt = null;
function ue() {
  return ((tt === null || tt.byteLength === 0) && (tt = new Uint16Array(o.memory.buffer)), tt);
}
function Pt(r, t) {
  return ((r = r >>> 0), ue().subarray(r / 2, r / 2 + t));
}
function V(r, t) {
  return ((r = r >>> 0), X().subarray(r / 1, r / 1 + t));
}
var et = null;
function ge() {
  return ((et === null || et.byteLength === 0) && (et = new Float32Array(o.memory.buffer)), et);
}
function M(r, t) {
  return ((r = r >>> 0), ge().subarray(r / 4, r / 4 + t));
}
var l = 0,
  it = new TextEncoder();
'encodeInto' in it ||
  (it.encodeInto = function (r, t) {
    let e = it.encode(r);
    return (t.set(e), { read: r.length, written: e.length });
  });
function Y(r, t, e) {
  if (e === void 0) {
    let a = it.encode(r),
      c = t(a.length, 1) >>> 0;
    return (
      X()
        .subarray(c, c + a.length)
        .set(a),
      (l = a.length),
      c
    );
  }
  let n = r.length,
    i = t(n, 1) >>> 0,
    s = X(),
    _ = 0;
  for (; _ < n; _++) {
    let a = r.charCodeAt(_);
    if (a > 127) break;
    s[i + _] = a;
  }
  if (_ !== n) {
    (_ !== 0 && (r = r.slice(_)), (i = e(i, n, (n = _ + r.length * 3), 1) >>> 0));
    let a = X().subarray(i + _, i + n),
      c = it.encodeInto(r, a);
    ((_ += c.written), (i = e(i, n, _, 1) >>> 0));
  }
  return ((l = _), i);
}
var C = null;
function Kt() {
  return (
    (C === null ||
      C.buffer.detached === !0 ||
      (C.buffer.detached === void 0 && C.buffer !== o.memory.buffer)) &&
      (C = new DataView(o.memory.buffer)),
    C
  );
}
function m(r, t) {
  let e = t(r.length * 1, 1) >>> 0;
  return (X().set(r, e / 1), (l = r.length), e);
}
function p(r) {
  let t = o.__wbindgen_externrefs.get(r);
  return (o.__externref_table_dealloc(r), t);
}
function T(r, t) {
  let e = t(r.length * 4, 4) >>> 0;
  return (ge().set(r, e / 4), (l = r.length), e);
}
var rt = null;
function pe() {
  return ((rt === null || rt.byteLength === 0) && (rt = new Float64Array(o.memory.buffer)), rt);
}
function kr(r, t) {
  let e = t(r.length * 8, 8) >>> 0;
  return (pe().set(r, e / 8), (l = r.length), e);
}
function H(r, t) {
  let e = t(r.length * 2, 2) >>> 0;
  return (ue().set(r, e / 2), (l = r.length), e);
}
var nt = null;
function we() {
  return ((nt === null || nt.byteLength === 0) && (nt = new Uint32Array(o.memory.buffer)), nt);
}
function $t(r, t) {
  let e = t(r.length * 4, 4) >>> 0;
  return (we().set(r, e / 4), (l = r.length), e);
}
var ot = null;
function Fr() {
  return ((ot === null || ot.byteLength === 0) && (ot = new Int32Array(o.memory.buffer)), ot);
}
function jt(r, t) {
  return ((r = r >>> 0), Fr().subarray(r / 4, r / 4 + t));
}
function be(r, t) {
  return ((r = r >>> 0), we().subarray(r / 4, r / 4 + t));
}
function me(r, t, e, n, i, s) {
  let _ = m(r, o.__wbindgen_malloc),
    a = l,
    c = o.decode_tiff_region(_, a, t, e, n, i, s);
  if (c[2]) throw p(c[1]);
  return $.__wrap(c[0]);
}
function he(r, t) {
  let e = m(r, o.__wbindgen_malloc),
    n = l,
    i = Y(t, o.__wbindgen_malloc, o.__wbindgen_realloc),
    s = l,
    _ = o.decode_netcdf_fast(e, n, i, s);
  if (_[2]) throw p(_[1]);
  return k.__wrap(_[0]);
}
function Nt(r) {
  let t = m(r, o.__wbindgen_malloc),
    e = l,
    n = o.decode_exr_fast(t, e);
  if (n[2]) throw p(n[1]);
  return st.__wrap(n[0]);
}
function Rt(r) {
  let t = m(r, o.__wbindgen_malloc),
    e = l,
    n = o.exr_zip_f32_plan(t, e);
  if (n[2]) throw p(n[1]);
  return n[0] === 0 ? void 0 : at.__wrap(n[0]);
}
function ye(r, t) {
  let e = m(r, o.__wbindgen_malloc),
    n = l,
    i = o.decode_dicom_fast(e, n, t);
  if (i[2]) throw p(i[1]);
  return k.__wrap(i[0]);
}
function xe(r) {
  let t = m(r, o.__wbindgen_malloc),
    e = l,
    n = o.decode_tiff_preview(t, e);
  if (n[2]) throw p(n[1]);
  return U.__wrap(n[0]);
}
function Ae(r, t) {
  let e = m(r, o.__wbindgen_malloc),
    n = l,
    i = o.decode_pfm_display_fast(e, n, t);
  if (i[2]) throw p(i[1]);
  return k.__wrap(i[0]);
}
function Dt(r) {
  let t, e;
  try {
    let n = m(r, o.__wbindgen_malloc),
      i = l,
      s = o.tiff_page_directory(n, i);
    return ((t = s[0]), (e = s[1]), h(s[0], s[1]));
  } finally {
    o.__wbindgen_free(t, e, 1);
  }
}
function ke(r) {
  let t = m(r, o.__wbindgen_malloc),
    e = l,
    n = o.decode_npy_display_fast(t, e);
  if (n[2]) throw p(n[1]);
  return k.__wrap(n[0]);
}
function _t(r, t) {
  return ((r = r >>> 0), pe().subarray(r / 8, r / 8 + t));
}
function Fe(r) {
  let t = m(r, o.__wbindgen_malloc),
    e = l,
    n = o.decode_ppm_display_fast(t, e);
  if (n[2]) throw p(n[1]);
  return k.__wrap(n[0]);
}
function ve(r, t) {
  let e = m(r, o.__wbindgen_malloc),
    n = l,
    i = o.decode_tiff_page_fast(e, n, t);
  if (i[2]) throw p(i[1]);
  return U.__wrap(i[0]);
}
function Ee(r, t) {
  let e = m(r, o.__wbindgen_malloc),
    n = l,
    i = Y(t, o.__wbindgen_malloc, o.__wbindgen_realloc),
    s = l,
    _ = o.decode_sdt_fast(e, n, i, s);
  if (_[2]) throw p(_[1]);
  return k.__wrap(_[0]);
}
function je(r, t) {
  let e = m(r, o.__wbindgen_malloc),
    n = l,
    i = o.decode_tiff_page(e, n, t);
  if (i[2]) throw p(i[1]);
  return U.__wrap(i[0]);
}
function Se(r, t) {
  let e = m(r, o.__wbindgen_malloc),
    n = l,
    i = Y(t, o.__wbindgen_malloc, o.__wbindgen_realloc),
    s = l,
    _ = o.decode_czi_fast(e, n, i, s);
  if (_[2]) throw p(_[1]);
  return k.__wrap(_[0]);
}
function Te(r, t) {
  let e = m(r, o.__wbindgen_malloc),
    n = l,
    i = Y(t, o.__wbindgen_malloc, o.__wbindgen_realloc),
    s = l,
    _ = o.decode_lif_fast(e, n, i, s);
  if (_[2]) throw p(_[1]);
  return k.__wrap(_[0]);
}
function Ut(r) {
  let t = m(r, o.__wbindgen_malloc),
    e = l,
    n = o.tiff_float_strip_plan(t, e);
  return n === 0 ? void 0 : ft.__wrap(n);
}
function Lt(r) {
  let t = m(r, o.__wbindgen_malloc),
    e = l,
    n = o.decode_hdr_fast(t, e);
  if (n[2]) throw p(n[1]);
  return ct.__wrap(n[0]);
}
function zt(r) {
  let t = m(r, o.__wbindgen_malloc),
    e = l,
    n = o.decode_png16_fast(t, e);
  if (n[2]) throw p(n[1]);
  return dt.__wrap(n[0]);
}
function We(r) {
  let t = m(r, o.__wbindgen_malloc),
    e = l,
    n = o.tiff_page_count(t, e);
  if (n[2]) throw p(n[1]);
  return n[0] >>> 0;
}
function Me(r) {
  let t = m(r, o.__wbindgen_malloc),
    e = l,
    n = o.decode_tiff_fast(t, e);
  if (n[2]) throw p(n[1]);
  return U.__wrap(n[0]);
}
function It(r) {
  let t = m(r, o.__wbindgen_malloc),
    e = l;
  return o.tiff_preview_reduction(t, e) >>> 0;
}
function Pe(r) {
  let t = m(r, o.__wbindgen_malloc),
    e = l,
    n = o.decode_fits_fast(t, e);
  if (n[2]) throw p(n[1]);
  return k.__wrap(n[0]);
}
function Ne(r, t) {
  let e = m(r, o.__wbindgen_malloc),
    n = l,
    i = Y(t, o.__wbindgen_malloc, o.__wbindgen_realloc),
    s = l,
    _ = o.decode_nd2_fast(e, n, i, s);
  if (_[2]) throw p(_[1]);
  return k.__wrap(_[0]);
}
function Re(r) {
  let t = m(r, o.__wbindgen_malloc),
    e = l,
    n = o.decode_tiff(t, e);
  if (n[2]) throw p(n[1]);
  return U.__wrap(n[0]);
}
var Yt =
    typeof FinalizationRegistry > 'u'
      ? { register: () => {}, unregister: () => {} }
      : new FinalizationRegistry(r => o.__wbg_decodedarray_free(r >>> 0, 1)),
  k = class r {
    static __wrap(t) {
      t = t >>> 0;
      let e = Object.create(r.prototype);
      return ((e.__wbg_ptr = t), Yt.register(e, e.__wbg_ptr, e), e);
    }
    __destroy_into_raw() {
      let t = this.__wbg_ptr;
      return ((this.__wbg_ptr = 0), Yt.unregister(this), t);
    }
    free() {
      let t = this.__destroy_into_raw();
      o.__wbg_decodedarray_free(t, 0);
    }
    get sample_kind() {
      return o.decodedarray_sample_kind(this.__wbg_ptr) >>> 0;
    }
    get valid_count() {
      return o.decodedarray_valid_count(this.__wbg_ptr);
    }
    discard_data() {
      o.decodedarray_discard_data(this.__wbg_ptr);
    }
    get format_label() {
      let t, e;
      try {
        let n = o.decodedarray_format_label(this.__wbg_ptr);
        return ((t = n[0]), (e = n[1]), h(n[0], n[1]));
      } finally {
        o.__wbindgen_free(t, e, 1);
      }
    }
    get metadata_json() {
      let t, e;
      try {
        let n = o.decodedarray_metadata_json(this.__wbg_ptr);
        return ((t = n[0]), (e = n[1]), h(n[0], n[1]));
      } finally {
        o.__wbindgen_free(t, e, 1);
      }
    }
    get sample_format() {
      return o.decodedarray_sample_format(this.__wbg_ptr) >>> 0;
    }
    get bits_per_sample() {
      return o.decodedarray_bits_per_sample(this.__wbg_ptr) >>> 0;
    }
    take_data_as_u8() {
      let t = o.decodedarray_take_data_as_u8(this.__wbg_ptr);
      if (t[3]) throw p(t[2]);
      var e = V(t[0], t[1]).slice();
      return (o.__wbindgen_free(t[0], t[1] * 1, 1), e);
    }
    get can_reuse_source() {
      return o.decodedarray_can_reuse_source(this.__wbg_ptr) !== 0;
    }
    get non_finite_count() {
      return o.decodedarray_non_finite_count(this.__wbg_ptr);
    }
    take_data_as_f32() {
      let t = o.decodedarray_take_data_as_f32(this.__wbg_ptr);
      if (t[3]) throw p(t[2]);
      var e = M(t[0], t[1]).slice();
      return (o.__wbindgen_free(t[0], t[1] * 4, 4), e);
    }
    take_data_as_u16() {
      let t = o.decodedarray_take_data_as_u16(this.__wbg_ptr);
      if (t[3]) throw p(t[2]);
      var e = Pt(t[0], t[1]).slice();
      return (o.__wbindgen_free(t[0], t[1] * 2, 2), e);
    }
    get source_data_offset() {
      return o.decodedarray_source_data_offset(this.__wbg_ptr) >>> 0;
    }
    get source_numeric_type() {
      let t, e;
      try {
        let n = o.decodedarray_source_numeric_type(this.__wbg_ptr);
        return ((t = n[0]), (e = n[1]), h(n[0], n[1]));
      } finally {
        o.__wbindgen_free(t, e, 1);
      }
    }
    copy_data_as_u8_into(t) {
      let e = o.decodedarray_copy_data_as_u8_into(this.__wbg_ptr, t);
      if (e[1]) throw p(e[0]);
    }
    copy_data_as_f32_into(t) {
      let e = o.decodedarray_copy_data_as_f32_into(this.__wbg_ptr, t);
      if (e[1]) throw p(e[0]);
    }
    copy_data_as_u16_into(t) {
      let e = o.decodedarray_copy_data_as_u16_into(this.__wbg_ptr, t);
      if (e[1]) throw p(e[0]);
    }
    get width() {
      return o.decodedarray_width(this.__wbg_ptr) >>> 0;
    }
    get height() {
      return o.decodedarray_height(this.__wbg_ptr) >>> 0;
    }
    get channels() {
      return o.decodedarray_channels(this.__wbg_ptr) >>> 0;
    }
    get data_len() {
      return o.decodedarray_data_len(this.__wbg_ptr) >>> 0;
    }
    get data_max() {
      return o.decodedarray_data_max(this.__wbg_ptr);
    }
    get data_min() {
      return o.decodedarray_data_min(this.__wbg_ptr);
    }
    get type_max() {
      return o.decodedarray_type_max(this.__wbg_ptr);
    }
    get type_min() {
      return o.decodedarray_type_min(this.__wbg_ptr);
    }
  };
Symbol.dispose && (k.prototype[Symbol.dispose] = k.prototype.free);
var Zt =
    typeof FinalizationRegistry > 'u'
      ? { register: () => {}, unregister: () => {} }
      : new FinalizationRegistry(r => o.__wbg_demosaicresult_free(r >>> 0, 1)),
  ht = class r {
    static __wrap(t) {
      t = t >>> 0;
      let e = Object.create(r.prototype);
      return ((e.__wbg_ptr = t), Zt.register(e, e.__wbg_ptr, e), e);
    }
    __destroy_into_raw() {
      let t = this.__wbg_ptr;
      return ((this.__wbg_ptr = 0), Zt.unregister(this), t);
    }
    free() {
      let t = this.__destroy_into_raw();
      o.__wbg_demosaicresult_free(t, 0);
    }
    get width() {
      return o.demosaicresult_width(this.__wbg_ptr) >>> 0;
    }
    get gain_b() {
      return o.demosaicresult_gain_b(this.__wbg_ptr);
    }
    get gain_g() {
      return o.demosaicresult_gain_g(this.__wbg_ptr);
    }
    get gain_r() {
      return o.demosaicresult_gain_r(this.__wbg_ptr);
    }
    get height() {
      return o.demosaicresult_height(this.__wbg_ptr) >>> 0;
    }
    get channels() {
      return o.demosaicresult_channels(this.__wbg_ptr) >>> 0;
    }
    take_data() {
      let t = o.demosaicresult_take_data(this.__wbg_ptr);
      var e = M(t[0], t[1]).slice();
      return (o.__wbindgen_free(t[0], t[1] * 4, 4), e);
    }
  };
Symbol.dispose && (ht.prototype[Symbol.dispose] = ht.prototype.free);
var qt =
    typeof FinalizationRegistry > 'u'
      ? { register: () => {}, unregister: () => {} }
      : new FinalizationRegistry(r => o.__wbg_exrresult_free(r >>> 0, 1)),
  st = class r {
    static __wrap(t) {
      t = t >>> 0;
      let e = Object.create(r.prototype);
      return ((e.__wbg_ptr = t), qt.register(e, e.__wbg_ptr, e), e);
    }
    __destroy_into_raw() {
      let t = this.__wbg_ptr;
      return ((this.__wbg_ptr = 0), qt.unregister(this), t);
    }
    free() {
      let t = this.__destroy_into_raw();
      o.__wbg_exrresult_free(t, 0);
    }
    get all_tags_json() {
      let t, e;
      try {
        let n = o.exrresult_all_tags_json(this.__wbg_ptr);
        return ((t = n[0]), (e = n[1]), h(n[0], n[1]));
      } finally {
        o.__wbindgen_free(t, e, 1);
      }
    }
    get timing_pack_ms() {
      return o.decodedarray_type_max(this.__wbg_ptr);
    }
    get timing_read_ms() {
      return o.decodedarray_type_min(this.__wbg_ptr);
    }
    get timing_total_ms() {
      return o.decodedarray_data_min(this.__wbg_ptr);
    }
    take_data_as_f32() {
      let t = o.exrresult_take_data_as_f32(this.__wbg_ptr);
      var e = M(t[0], t[1]).slice();
      return (o.__wbindgen_free(t[0], t[1] * 4, 4), e);
    }
    get channel_names_csv() {
      let t, e;
      try {
        let n = o.exrresult_channel_names_csv(this.__wbg_ptr);
        return ((t = n[0]), (e = n[1]), h(n[0], n[1]));
      } finally {
        o.__wbindgen_free(t, e, 1);
      }
    }
    get displayed_channels_csv() {
      let t, e;
      try {
        let n = o.exrresult_displayed_channels_csv(this.__wbg_ptr);
        return ((t = n[0]), (e = n[1]), h(n[0], n[1]));
      } finally {
        o.__wbindgen_free(t, e, 1);
      }
    }
    get width() {
      return o.exrresult_width(this.__wbg_ptr) >>> 0;
    }
    get format() {
      return o.decodedarray_height(this.__wbg_ptr) >>> 0;
    }
    get height() {
      return o.exrresult_height(this.__wbg_ptr) >>> 0;
    }
    get channels() {
      return o.decodedarray_width(this.__wbg_ptr) >>> 0;
    }
    get data_max() {
      return o.decodedarray_non_finite_count(this.__wbg_ptr);
    }
    get data_min() {
      return o.decodedarray_data_max(this.__wbg_ptr);
    }
    get data_type() {
      return o.decodedarray_channels(this.__wbg_ptr) >>> 0;
    }
  };
Symbol.dispose && (st.prototype[Symbol.dispose] = st.prototype.free);
var Qt =
    typeof FinalizationRegistry > 'u'
      ? { register: () => {}, unregister: () => {} }
      : new FinalizationRegistry(r => o.__wbg_exrzipplanjs_free(r >>> 0, 1)),
  at = class r {
    static __wrap(t) {
      t = t >>> 0;
      let e = Object.create(r.prototype);
      return ((e.__wbg_ptr = t), Qt.register(e, e.__wbg_ptr, e), e);
    }
    __destroy_into_raw() {
      let t = this.__wbg_ptr;
      return ((this.__wbg_ptr = 0), Qt.unregister(this), t);
    }
    free() {
      let t = this.__destroy_into_raw();
      o.__wbg_exrzipplanjs_free(t, 0);
    }
    get channel_name() {
      let t, e;
      try {
        let n = o.exrzipplanjs_channel_name(this.__wbg_ptr);
        return ((t = n[0]), (e = n[1]), h(n[0], n[1]));
      } finally {
        o.__wbindgen_free(t, e, 1);
      }
    }
    get all_tags_json() {
      let t, e;
      try {
        let n = o.exrzipplanjs_all_tags_json(this.__wbg_ptr);
        return ((t = n[0]), (e = n[1]), h(n[0], n[1]));
      } finally {
        o.__wbindgen_free(t, e, 1);
      }
    }
    get y_coordinates() {
      let t = o.exrzipplanjs_y_coordinates(this.__wbg_ptr);
      var e = jt(t[0], t[1]).slice();
      return (o.__wbindgen_free(t[0], t[1] * 4, 4), e);
    }
    take_compressed() {
      let t = o.exrzipplanjs_take_compressed(this.__wbg_ptr);
      var e = V(t[0], t[1]).slice();
      return (o.__wbindgen_free(t[0], t[1] * 1, 1), e);
    }
    get width() {
      return o.exrzipplanjs_width(this.__wbg_ptr) >>> 0;
    }
    get counts() {
      let t = o.exrzipplanjs_counts(this.__wbg_ptr);
      var e = be(t[0], t[1]).slice();
      return (o.__wbindgen_free(t[0], t[1] * 4, 4), e);
    }
    get data_y() {
      return o.exrzipplanjs_data_y(this.__wbg_ptr);
    }
    get height() {
      return o.decodedarray_bits_per_sample(this.__wbg_ptr) >>> 0;
    }
  };
Symbol.dispose && (at.prototype[Symbol.dispose] = at.prototype.free);
var te =
    typeof FinalizationRegistry > 'u'
      ? { register: () => {}, unregister: () => {} }
      : new FinalizationRegistry(r => o.__wbg_hdrresult_free(r >>> 0, 1)),
  ct = class r {
    static __wrap(t) {
      t = t >>> 0;
      let e = Object.create(r.prototype);
      return ((e.__wbg_ptr = t), te.register(e, e.__wbg_ptr, e), e);
    }
    __destroy_into_raw() {
      let t = this.__wbg_ptr;
      return ((this.__wbg_ptr = 0), te.unregister(this), t);
    }
    free() {
      let t = this.__destroy_into_raw();
      o.__wbg_hdrresult_free(t, 0);
    }
    get all_tags_json() {
      let t, e;
      try {
        let n = o.hdrresult_all_tags_json(this.__wbg_ptr);
        return ((t = n[0]), (e = n[1]), h(n[0], n[1]));
      } finally {
        o.__wbindgen_free(t, e, 1);
      }
    }
    take_data_as_f32() {
      let t = o.hdrresult_take_data_as_f32(this.__wbg_ptr);
      var e = M(t[0], t[1]).slice();
      return (o.__wbindgen_free(t[0], t[1] * 4, 4), e);
    }
    take_metadata_as_f64() {
      let t = o.hdrresult_take_metadata_as_f64(this.__wbg_ptr);
      var e = _t(t[0], t[1]).slice();
      return (o.__wbindgen_free(t[0], t[1] * 8, 8), e);
    }
    get channels() {
      return o.hdrresult_channels(this.__wbg_ptr) >>> 0;
    }
  };
Symbol.dispose && (ct.prototype[Symbol.dispose] = ct.prototype.free);
var ee =
    typeof FinalizationRegistry > 'u'
      ? { register: () => {}, unregister: () => {} }
      : new FinalizationRegistry(r => o.__wbg_histogramresult_free(r >>> 0, 1)),
  yt = class r {
    static __wrap(t) {
      t = t >>> 0;
      let e = Object.create(r.prototype);
      return ((e.__wbg_ptr = t), ee.register(e, e.__wbg_ptr, e), e);
    }
    __destroy_into_raw() {
      let t = this.__wbg_ptr;
      return ((this.__wbg_ptr = 0), ee.unregister(this), t);
    }
    free() {
      let t = this.__destroy_into_raw();
      o.__wbg_histogramresult_free(t, 0);
    }
    get non_finite_count() {
      return o.histogramresult_non_finite_count(this.__wbg_ptr) >>> 0;
    }
    get max() {
      return o.decodedarray_type_max(this.__wbg_ptr);
    }
    get min() {
      return o.decodedarray_type_min(this.__wbg_ptr);
    }
    get total() {
      return o.histogramresult_total(this.__wbg_ptr) >>> 0;
    }
    get counts() {
      let t = o.histogramresult_counts(this.__wbg_ptr);
      var e = jt(t[0], t[1]).slice();
      return (o.__wbindgen_free(t[0], t[1] * 4, 4), e);
    }
  };
Symbol.dispose && (yt.prototype[Symbol.dispose] = yt.prototype.free);
var re =
    typeof FinalizationRegistry > 'u'
      ? { register: () => {}, unregister: () => {} }
      : new FinalizationRegistry(r => o.__wbg_imagestats_free(r >>> 0, 1)),
  xt = class r {
    static __wrap(t) {
      t = t >>> 0;
      let e = Object.create(r.prototype);
      return ((e.__wbg_ptr = t), re.register(e, e.__wbg_ptr, e), e);
    }
    __destroy_into_raw() {
      let t = this.__wbg_ptr;
      return ((this.__wbg_ptr = 0), re.unregister(this), t);
    }
    free() {
      let t = this.__destroy_into_raw();
      o.__wbg_imagestats_free(t, 0);
    }
    get total_count() {
      return o.imagestats_total_count(this.__wbg_ptr);
    }
    get valid_count() {
      return o.decodedarray_non_finite_count(this.__wbg_ptr);
    }
    get non_finite_count() {
      return o.decodedarray_valid_count(this.__wbg_ptr);
    }
    get max() {
      return o.decodedarray_type_max(this.__wbg_ptr);
    }
    get min() {
      return o.decodedarray_type_min(this.__wbg_ptr);
    }
    get std() {
      return o.decodedarray_data_max(this.__wbg_ptr);
    }
    get mean() {
      return o.decodedarray_data_min(this.__wbg_ptr);
    }
  };
Symbol.dispose && (xt.prototype[Symbol.dispose] = xt.prototype.free);
var ne =
    typeof FinalizationRegistry > 'u'
      ? { register: () => {}, unregister: () => {} }
      : new FinalizationRegistry(r => o.__wbg_jpegresult_free(r >>> 0, 1)),
  At = class r {
    static __wrap(t) {
      t = t >>> 0;
      let e = Object.create(r.prototype);
      return ((e.__wbg_ptr = t), ne.register(e, e.__wbg_ptr, e), e);
    }
    __destroy_into_raw() {
      let t = this.__wbg_ptr;
      return ((this.__wbg_ptr = 0), ne.unregister(this), t);
    }
    free() {
      let t = this.__destroy_into_raw();
      o.__wbg_jpegresult_free(t, 0);
    }
    take_data_as_u8() {
      let t = o.jpegresult_take_data_as_u8(this.__wbg_ptr);
      var e = V(t[0], t[1]).slice();
      return (o.__wbindgen_free(t[0], t[1] * 1, 1), e);
    }
    get width() {
      return o.demosaicresult_width(this.__wbg_ptr) >>> 0;
    }
    get height() {
      return o.demosaicresult_height(this.__wbg_ptr) >>> 0;
    }
    get channels() {
      return o.demosaicresult_channels(this.__wbg_ptr) >>> 0;
    }
  };
Symbol.dispose && (At.prototype[Symbol.dispose] = At.prototype.free);
var oe =
    typeof FinalizationRegistry > 'u'
      ? { register: () => {}, unregister: () => {} }
      : new FinalizationRegistry(r => o.__wbg_labelresult_free(r >>> 0, 1)),
  kt = class r {
    static __wrap(t) {
      t = t >>> 0;
      let e = Object.create(r.prototype);
      return ((e.__wbg_ptr = t), oe.register(e, e.__wbg_ptr, e), e);
    }
    __destroy_into_raw() {
      let t = this.__wbg_ptr;
      return ((this.__wbg_ptr = 0), oe.unregister(this), t);
    }
    free() {
      let t = this.__destroy_into_raw();
      o.__wbg_labelresult_free(t, 0);
    }
    take_labels_as_i32() {
      let t = o.labelresult_take_labels_as_i32(this.__wbg_ptr);
      if (t[3]) throw p(t[2]);
      var e = jt(t[0], t[1]).slice();
      return (o.__wbindgen_free(t[0], t[1] * 4, 4), e);
    }
    get count() {
      return o.demosaicresult_width(this.__wbg_ptr) >>> 0;
    }
    get width() {
      return o.demosaicresult_height(this.__wbg_ptr) >>> 0;
    }
    get height() {
      return o.demosaicresult_channels(this.__wbg_ptr) >>> 0;
    }
  };
Symbol.dispose && (kt.prototype[Symbol.dispose] = kt.prototype.free);
var ie =
    typeof FinalizationRegistry > 'u'
      ? { register: () => {}, unregister: () => {} }
      : new FinalizationRegistry(r => o.__wbg_pngresult_free(r >>> 0, 1)),
  dt = class r {
    static __wrap(t) {
      t = t >>> 0;
      let e = Object.create(r.prototype);
      return ((e.__wbg_ptr = t), ie.register(e, e.__wbg_ptr, e), e);
    }
    __destroy_into_raw() {
      let t = this.__wbg_ptr;
      return ((this.__wbg_ptr = 0), ie.unregister(this), t);
    }
    free() {
      let t = this.__destroy_into_raw();
      o.__wbg_pngresult_free(t, 0);
    }
    get color_type() {
      return o.decodedarray_width(this.__wbg_ptr) >>> 0;
    }
    get timing_total_ms() {
      return o.decodedarray_data_max(this.__wbg_ptr);
    }
    take_data_as_u16() {
      let t = o.pngresult_take_data_as_u16(this.__wbg_ptr);
      var e = Pt(t[0], t[1]).slice();
      return (o.__wbindgen_free(t[0], t[1] * 2, 2), e);
    }
    get timing_decode_ms() {
      return o.decodedarray_type_max(this.__wbg_ptr);
    }
    get timing_convert_ms() {
      return o.decodedarray_data_min(this.__wbg_ptr);
    }
    get timing_read_info_ms() {
      return o.decodedarray_type_min(this.__wbg_ptr);
    }
    get width() {
      return o.pngresult_width(this.__wbg_ptr) >>> 0;
    }
    get height() {
      return o.pngresult_height(this.__wbg_ptr) >>> 0;
    }
    get channels() {
      return o.exrresult_width(this.__wbg_ptr) >>> 0;
    }
    get bit_depth() {
      return o.exrresult_height(this.__wbg_ptr) >>> 0;
    }
  };
Symbol.dispose && (dt.prototype[Symbol.dispose] = dt.prototype.free);
var _e =
    typeof FinalizationRegistry > 'u'
      ? { register: () => {}, unregister: () => {} }
      : new FinalizationRegistry(r => o.__wbg_rgbalayercompositor_free(r >>> 0, 1)),
  Ft = class {
    __destroy_into_raw() {
      let t = this.__wbg_ptr;
      return ((this.__wbg_ptr = 0), _e.unregister(this), t);
    }
    free() {
      let t = this.__destroy_into_raw();
      o.__wbg_rgbalayercompositor_free(t, 0);
    }
    get covered_count() {
      return o.exrzipplanjs_width(this.__wbg_ptr) >>> 0;
    }
    add_channels_i8(t, e, n, i, s, _, a, c, g) {
      let f = m(t, o.__wbindgen_malloc),
        u = l,
        b = o.rgbalayercompositor_add_channels_i8(this.__wbg_ptr, f, u, e, n, i, s, _, a, c, g);
      if (b[1]) throw p(b[0]);
    }
    add_channels_u8(t, e, n, i, s, _, a, c, g) {
      let f = m(t, o.__wbindgen_malloc),
        u = l,
        b = o.rgbalayercompositor_add_channels_u8(this.__wbg_ptr, f, u, e, n, i, s, _, a, c, g);
      if (b[1]) throw p(b[0]);
    }
    finish_isolated(t, e) {
      let n = o.rgbalayercompositor_finish_isolated(this.__wbg_ptr, t, e);
      if (n[1]) throw p(n[0]);
    }
    add_channels_f32(t, e, n, i, s, _, a, c, g) {
      let f = T(t, o.__wbindgen_malloc),
        u = l,
        b = o.rgbalayercompositor_add_channels_f32(this.__wbg_ptr, f, u, e, n, i, s, _, a, c, g);
      if (b[1]) throw p(b[0]);
    }
    add_channels_f64(t, e, n, i, s, _, a, c, g) {
      let f = kr(t, o.__wbindgen_malloc),
        u = l,
        b = o.rgbalayercompositor_add_channels_f64(this.__wbg_ptr, f, u, e, n, i, s, _, a, c, g);
      if (b[1]) throw p(b[0]);
    }
    add_channels_i16(t, e, n, i, s, _, a, c, g) {
      let f = H(t, o.__wbindgen_malloc),
        u = l,
        b = o.rgbalayercompositor_add_channels_i16(this.__wbg_ptr, f, u, e, n, i, s, _, a, c, g);
      if (b[1]) throw p(b[0]);
    }
    add_channels_i32(t, e, n, i, s, _, a, c, g) {
      let f = $t(t, o.__wbindgen_malloc),
        u = l,
        b = o.rgbalayercompositor_add_channels_i32(this.__wbg_ptr, f, u, e, n, i, s, _, a, c, g);
      if (b[1]) throw p(b[0]);
    }
    add_channels_u16(t, e, n, i, s, _, a, c, g) {
      let f = H(t, o.__wbindgen_malloc),
        u = l,
        b = o.rgbalayercompositor_add_channels_u16(this.__wbg_ptr, f, u, e, n, i, s, _, a, c, g);
      if (b[1]) throw p(b[0]);
    }
    add_channels_u32(t, e, n, i, s, _, a, c, g) {
      let f = $t(t, o.__wbindgen_malloc),
        u = l,
        b = o.rgbalayercompositor_add_channels_u32(this.__wbg_ptr, f, u, e, n, i, s, _, a, c, g);
      if (b[1]) throw p(b[0]);
    }
    begin_isolated_u8(t, e, n, i, s) {
      let _ = m(t, o.__wbindgen_malloc),
        a = l,
        c = o.rgbalayercompositor_begin_isolated_u8(this.__wbg_ptr, _, a, e, n, i, s);
      if (c[1]) throw p(c[0]);
    }
    begin_isolated_f32(t, e, n, i, s, _) {
      let a = T(t, o.__wbindgen_malloc),
        c = l,
        g = o.rgbalayercompositor_begin_isolated_f32(this.__wbg_ptr, a, c, e, n, i, s, _);
      if (g[1]) throw p(g[0]);
    }
    begin_isolated_u16(t, e, n, i, s, _) {
      let a = H(t, o.__wbindgen_malloc),
        c = l,
        g = o.rgbalayercompositor_begin_isolated_u16(this.__wbg_ptr, a, c, e, n, i, s, _);
      if (g[1]) throw p(g[0]);
    }
    isolated_apply_hue(t, e, n, i, s) {
      let _ = o.rgbalayercompositor_isolated_apply_hue(this.__wbg_ptr, t, e, n, i, s);
      if (_[1]) throw p(_[0]);
    }
    isolated_apply_lut(t, e) {
      let n = T(t, o.__wbindgen_malloc),
        i = l,
        s = o.rgbalayercompositor_isolated_apply_lut(this.__wbg_ptr, n, i, e);
      if (s[1]) throw p(s[0]);
    }
    isolated_apply_direct(t, e, n) {
      let i = T(e, o.__wbindgen_malloc),
        s = l,
        _ = o.rgbalayercompositor_isolated_apply_direct(this.__wbg_ptr, t, i, s, n);
      if (_[1]) throw p(_[0]);
    }
    take_data_as_channels(t) {
      let e = o.rgbalayercompositor_take_data_as_channels(this.__wbg_ptr, t);
      if (e[3]) throw p(e[2]);
      var n = M(e[0], e[1]).slice();
      return (o.__wbindgen_free(e[0], e[1] * 4, 4), n);
    }
    take_isolated_surface() {
      let t = o.rgbalayercompositor_take_isolated_surface(this.__wbg_ptr);
      if (t[3]) throw p(t[2]);
      var e = M(t[0], t[1]).slice();
      return (o.__wbindgen_free(t[0], t[1] * 4, 4), e);
    }
    isolated_add_f32_surface(t, e, n, i) {
      let s = T(t, o.__wbindgen_malloc),
        _ = l,
        a = o.rgbalayercompositor_isolated_add_f32_surface(this.__wbg_ptr, s, _, e, n, i);
      if (a[1]) throw p(a[0]);
    }
    add_arithmetic_f32_surface(t, e, n, i) {
      let s = T(t, o.__wbindgen_malloc),
        _ = l,
        a = o.rgbalayercompositor_add_arithmetic_f32_surface(this.__wbg_ptr, s, _, e, n, i);
      if (a[1]) throw p(a[0]);
    }
    isolated_apply_alpha_mask_u8(t, e, n, i, s, _, a, c) {
      let g = m(t, o.__wbindgen_malloc),
        f = l,
        u = o.rgbalayercompositor_isolated_apply_alpha_mask_u8(
          this.__wbg_ptr,
          g,
          f,
          e,
          n,
          i,
          s,
          _,
          a,
          c
        );
      if (u[1]) throw p(u[0]);
    }
    isolated_apply_selective_hue(t, e) {
      let n = T(t, o.__wbindgen_malloc),
        i = l,
        s = o.rgbalayercompositor_isolated_apply_selective_hue(this.__wbg_ptr, n, i, e);
      if (s[1]) throw p(s[0]);
    }
    isolated_apply_alpha_mask_f32(t, e, n, i, s, _, a, c) {
      let g = T(t, o.__wbindgen_malloc),
        f = l,
        u = o.rgbalayercompositor_isolated_apply_alpha_mask_f32(
          this.__wbg_ptr,
          g,
          f,
          e,
          n,
          i,
          s,
          _,
          a,
          c
        );
      if (u[1]) throw p(u[0]);
    }
    isolated_apply_alpha_mask_u16(t, e, n, i, s, _, a, c) {
      let g = H(t, o.__wbindgen_malloc),
        f = l,
        u = o.rgbalayercompositor_isolated_apply_alpha_mask_u16(
          this.__wbg_ptr,
          g,
          f,
          e,
          n,
          i,
          s,
          _,
          a,
          c
        );
      if (u[1]) throw p(u[0]);
    }
    isolated_begin_masked_adjustment() {
      let t = o.rgbalayercompositor_isolated_begin_masked_adjustment(this.__wbg_ptr);
      if (t[1]) throw p(t[0]);
    }
    apply_brightness_mask_f32_surface(t, e, n, i) {
      let s = T(t, o.__wbindgen_malloc),
        _ = l,
        a = o.rgbalayercompositor_apply_brightness_mask_f32_surface(this.__wbg_ptr, s, _, e, n, i);
      if (a[1]) throw p(a[0]);
    }
    isolated_add_arithmetic_f32_surface(t, e, n, i) {
      let s = T(t, o.__wbindgen_malloc),
        _ = l,
        a = o.rgbalayercompositor_isolated_add_arithmetic_f32_surface(
          this.__wbg_ptr,
          s,
          _,
          e,
          n,
          i
        );
      if (a[1]) throw p(a[0]);
    }
    isolated_finish_masked_adjustment_u8(t, e, n, i, s, _, a, c) {
      let g = m(t, o.__wbindgen_malloc),
        f = l,
        u = o.rgbalayercompositor_isolated_finish_masked_adjustment_u8(
          this.__wbg_ptr,
          g,
          f,
          e,
          n,
          i,
          s,
          _,
          a,
          c
        );
      if (u[1]) throw p(u[0]);
    }
    isolated_finish_masked_adjustment_f32(t, e, n, i, s, _, a, c) {
      let g = T(t, o.__wbindgen_malloc),
        f = l,
        u = o.rgbalayercompositor_isolated_finish_masked_adjustment_f32(
          this.__wbg_ptr,
          g,
          f,
          e,
          n,
          i,
          s,
          _,
          a,
          c
        );
      if (u[1]) throw p(u[0]);
    }
    isolated_finish_masked_adjustment_u16(t, e, n, i, s, _, a, c) {
      let g = H(t, o.__wbindgen_malloc),
        f = l,
        u = o.rgbalayercompositor_isolated_finish_masked_adjustment_u16(
          this.__wbg_ptr,
          g,
          f,
          e,
          n,
          i,
          s,
          _,
          a,
          c
        );
      if (u[1]) throw p(u[0]);
    }
    constructor(t, e, n) {
      let i = o.rgbalayercompositor_new(t, e, n);
      if (i[2]) throw p(i[1]);
      return ((this.__wbg_ptr = i[0] >>> 0), _e.register(this, this.__wbg_ptr, this), this);
    }
    add_u8(t, e, n, i, s, _, a) {
      let c = m(t, o.__wbindgen_malloc),
        g = l,
        f = o.rgbalayercompositor_add_u8(this.__wbg_ptr, c, g, e, n, i, s, _, a);
      if (f[1]) throw p(f[0]);
    }
    add_f32(t, e, n, i, s, _, a, c) {
      let g = T(t, o.__wbindgen_malloc),
        f = l,
        u = o.rgbalayercompositor_add_f32(this.__wbg_ptr, g, f, e, n, i, s, _, a, c);
      if (u[1]) throw p(u[0]);
    }
    add_u16(t, e, n, i, s, _, a, c) {
      let g = H(t, o.__wbindgen_malloc),
        f = l,
        u = o.rgbalayercompositor_add_u16(this.__wbg_ptr, g, f, e, n, i, s, _, a, c);
      if (u[1]) throw p(u[0]);
    }
    get max_value() {
      return o.rgbalayercompositor_max_value(this.__wbg_ptr);
    }
    get min_value() {
      return o.rgbalayercompositor_min_value(this.__wbg_ptr);
    }
    take_data() {
      let t = o.rgbalayercompositor_take_data(this.__wbg_ptr);
      var e = M(t[0], t[1]).slice();
      return (o.__wbindgen_free(t[0], t[1] * 4, 4), e);
    }
  };
Symbol.dispose && (Ft.prototype[Symbol.dispose] = Ft.prototype.free);
var se =
    typeof FinalizationRegistry > 'u'
      ? { register: () => {}, unregister: () => {} }
      : new FinalizationRegistry(r => o.__wbg_stabilitycurveresult_free(r >>> 0, 1)),
  vt = class r {
    static __wrap(t) {
      t = t >>> 0;
      let e = Object.create(r.prototype);
      return ((e.__wbg_ptr = t), se.register(e, e.__wbg_ptr, e), e);
    }
    __destroy_into_raw() {
      let t = this.__wbg_ptr;
      return ((this.__wbg_ptr = 0), se.unregister(this), t);
    }
    free() {
      let t = this.__destroy_into_raw();
      o.__wbg_stabilitycurveresult_free(t, 0);
    }
    get object_counts() {
      let t = o.stabilitycurveresult_object_counts(this.__wbg_ptr);
      var e = be(t[0], t[1]).slice();
      return (o.__wbindgen_free(t[0], t[1] * 4, 4), e);
    }
    get plateau_width() {
      return o.stabilitycurveresult_plateau_width(this.__wbg_ptr);
    }
    get suggested_bin() {
      return o.exrresult_height(this.__wbg_ptr);
    }
    get area_fractions() {
      let t = o.stabilitycurveresult_area_fractions(this.__wbg_ptr);
      var e = _t(t[0], t[1]).slice();
      return (o.__wbindgen_free(t[0], t[1] * 8, 8), e);
    }
    get bins() {
      let t = o.stabilitycurveresult_bins(this.__wbg_ptr);
      var e = jt(t[0], t[1]).slice();
      return (o.__wbindgen_free(t[0], t[1] * 4, 4), e);
    }
    get values() {
      let t = o.stabilitycurveresult_values(this.__wbg_ptr);
      var e = _t(t[0], t[1]).slice();
      return (o.__wbindgen_free(t[0], t[1] * 8, 8), e);
    }
  };
Symbol.dispose && (vt.prototype[Symbol.dispose] = vt.prototype.free);
var ae =
    typeof FinalizationRegistry > 'u'
      ? { register: () => {}, unregister: () => {} }
      : new FinalizationRegistry(r => o.__wbg_tifffloatstripplanjs_free(r >>> 0, 1)),
  ft = class r {
    static __wrap(t) {
      t = t >>> 0;
      let e = Object.create(r.prototype);
      return ((e.__wbg_ptr = t), ae.register(e, e.__wbg_ptr, e), e);
    }
    __destroy_into_raw() {
      let t = this.__wbg_ptr;
      return ((this.__wbg_ptr = 0), ae.unregister(this), t);
    }
    free() {
      let t = this.__destroy_into_raw();
      o.__wbg_tifffloatstripplanjs_free(t, 0);
    }
    get tile_width() {
      return o.exrzipplanjs_data_y(this.__wbg_ptr) >>> 0;
    }
    get block_count() {
      return o.tifffloatstripplanjs_block_count(this.__wbg_ptr) >>> 0;
    }
    get compression() {
      return o.pngresult_height(this.__wbg_ptr) >>> 0;
    }
    get orientation() {
      return o.decodedarray_height(this.__wbg_ptr) >>> 0;
    }
    get strip_count() {
      return o.tifffloatstripplanjs_strip_count(this.__wbg_ptr) >>> 0;
    }
    get tile_length() {
      return o.decodedarray_sample_kind(this.__wbg_ptr) >>> 0;
    }
    get blocks_across() {
      return o.tifffloatstripplanjs_blocks_across(this.__wbg_ptr) >>> 0;
    }
    get little_endian() {
      return o.tifffloatstripplanjs_little_endian(this.__wbg_ptr) !== 0;
    }
    get sample_format() {
      return o.exrresult_height(this.__wbg_ptr) >>> 0;
    }
    get rows_per_strip() {
      return o.decodedarray_bits_per_sample(this.__wbg_ptr) >>> 0;
    }
    get bits_per_sample() {
      return o.hdrresult_channels(this.__wbg_ptr) >>> 0;
    }
    get blocks_per_unit() {
      return o.tifffloatstripplanjs_blocks_per_unit(this.__wbg_ptr) >>> 0;
    }
    get planar_configuration() {
      return o.stabilitycurveresult_plateau_width(this.__wbg_ptr) >>> 0;
    }
    get photometric_interpretation() {
      return o.exrzipplanjs_width(this.__wbg_ptr) >>> 0;
    }
    get lerc_additional_compression() {
      return o.tifffloatstripplanjs_lerc_additional_compression(this.__wbg_ptr) >>> 0;
    }
    get width() {
      return o.histogramresult_non_finite_count(this.__wbg_ptr) >>> 0;
    }
    get counts() {
      let t = o.tifffloatstripplanjs_counts(this.__wbg_ptr);
      var e = _t(t[0], t[1]).slice();
      return (o.__wbindgen_free(t[0], t[1] * 8, 8), e);
    }
    get height() {
      return o.tifffloatstripplanjs_height(this.__wbg_ptr) >>> 0;
    }
    get offsets() {
      let t = o.tifffloatstripplanjs_offsets(this.__wbg_ptr);
      var e = _t(t[0], t[1]).slice();
      return (o.__wbindgen_free(t[0], t[1] * 8, 8), e);
    }
    get channels() {
      return o.tifffloatstripplanjs_channels(this.__wbg_ptr) >>> 0;
    }
    get predictor() {
      return o.tifffloatstripplanjs_predictor(this.__wbg_ptr) >>> 0;
    }
  };
Symbol.dispose && (ft.prototype[Symbol.dispose] = ft.prototype.free);
var ce =
    typeof FinalizationRegistry > 'u'
      ? { register: () => {}, unregister: () => {} }
      : new FinalizationRegistry(r => o.__wbg_tiffregiondecoder_free(r >>> 0, 1)),
  K = class {
    __destroy_into_raw() {
      let t = this.__wbg_ptr;
      return ((this.__wbg_ptr = 0), ce.unregister(this), t);
    }
    free() {
      let t = this.__destroy_into_raw();
      o.__wbg_tiffregiondecoder_free(t, 0);
    }
    constructor(t) {
      let e = m(t, o.__wbindgen_malloc),
        n = l,
        i = o.tiffregiondecoder_new(e, n);
      return ((this.__wbg_ptr = i >>> 0), ce.register(this, this.__wbg_ptr, this), this);
    }
    decode(t, e, n, i, s) {
      let _ = o.tiffregiondecoder_decode(this.__wbg_ptr, t, e, n, i, s);
      if (_[2]) throw p(_[1]);
      return $.__wrap(_[0]);
    }
  };
Symbol.dispose && (K.prototype[Symbol.dispose] = K.prototype.free);
var de =
    typeof FinalizationRegistry > 'u'
      ? { register: () => {}, unregister: () => {} }
      : new FinalizationRegistry(r => o.__wbg_tiffregionjs_free(r >>> 0, 1)),
  $ = class r {
    static __wrap(t) {
      t = t >>> 0;
      let e = Object.create(r.prototype);
      return ((e.__wbg_ptr = t), de.register(e, e.__wbg_ptr, e), e);
    }
    __destroy_into_raw() {
      let t = this.__wbg_ptr;
      return ((this.__wbg_ptr = 0), de.unregister(this), t);
    }
    free() {
      let t = this.__destroy_into_raw();
      o.__wbg_tiffregionjs_free(t, 0);
    }
    get sample_format() {
      return o.hdrresult_channels(this.__wbg_ptr) >>> 0;
    }
    get blocks_decoded() {
      return o.pngresult_height(this.__wbg_ptr) >>> 0;
    }
    get bits_per_sample() {
      return o.tifffloatstripplanjs_channels(this.__wbg_ptr) >>> 0;
    }
    take_data_as_f32() {
      let t = o.tiffregionjs_take_data_as_f32(this.__wbg_ptr);
      var e = M(t[0], t[1]).slice();
      return (o.__wbindgen_free(t[0], t[1] * 4, 4), e);
    }
    get x() {
      return o.demosaicresult_width(this.__wbg_ptr) >>> 0;
    }
    get y() {
      return o.demosaicresult_height(this.__wbg_ptr) >>> 0;
    }
    get width() {
      return o.demosaicresult_channels(this.__wbg_ptr) >>> 0;
    }
    get height() {
      return o.histogramresult_non_finite_count(this.__wbg_ptr) >>> 0;
    }
    get channels() {
      return o.tifffloatstripplanjs_height(this.__wbg_ptr) >>> 0;
    }
  };
Symbol.dispose && ($.prototype[Symbol.dispose] = $.prototype.free);
var fe =
    typeof FinalizationRegistry > 'u'
      ? { register: () => {}, unregister: () => {} }
      : new FinalizationRegistry(r => o.__wbg_tiffresult_free(r >>> 0, 1)),
  U = class r {
    static __wrap(t) {
      t = t >>> 0;
      let e = Object.create(r.prototype);
      return ((e.__wbg_ptr = t), fe.register(e, e.__wbg_ptr, e), e);
    }
    __destroy_into_raw() {
      let t = this.__wbg_ptr;
      return ((this.__wbg_ptr = 0), fe.unregister(this), t);
    }
    free() {
      let t = this.__destroy_into_raw();
      o.__wbg_tiffresult_free(t, 0);
    }
    get tile_count() {
      return o.tiffresult_tile_count(this.__wbg_ptr) >>> 0;
    }
    get tile_width() {
      return o.tiffresult_tile_width(this.__wbg_ptr) >>> 0;
    }
    get compression() {
      return o.tiffresult_compression(this.__wbg_ptr) >>> 0;
    }
    get sample_kind() {
      return o.tiffresult_sample_kind(this.__wbg_ptr) >>> 0;
    }
    get strip_count() {
      return o.tiffresult_strip_count(this.__wbg_ptr) >>> 0;
    }
    get tile_length() {
      return o.tiffresult_tile_length(this.__wbg_ptr) >>> 0;
    }
    get all_tags_json() {
      let t, e;
      try {
        let n = o.tiffresult_all_tags_json(this.__wbg_ptr);
        return ((t = n[0]), (e = n[1]), h(n[0], n[1]));
      } finally {
        o.__wbindgen_free(t, e, 1);
      }
    }
    get direct_decode() {
      return o.tiffresult_direct_decode(this.__wbg_ptr) !== 0;
    }
    get sample_format() {
      return o.tiffresult_sample_format(this.__wbg_ptr) >>> 0;
    }
    get_data_bytes() {
      let t = o.tiffresult_get_data_bytes(this.__wbg_ptr);
      var e = V(t[0], t[1]).slice();
      return (o.__wbindgen_free(t[0], t[1] * 1, 1), e);
    }
    get rows_per_strip() {
      return o.tiffresult_rows_per_strip(this.__wbg_ptr) >>> 0;
    }
    get timing_pack_ms() {
      return o.tiffresult_timing_pack_ms(this.__wbg_ptr);
    }
    get bits_per_sample() {
      return o.tiffresult_bits_per_sample(this.__wbg_ptr) >>> 0;
    }
    get_data_as_f32() {
      let t = o.tiffresult_get_data_as_f32(this.__wbg_ptr);
      var e = M(t[0], t[1]).slice();
      return (o.__wbindgen_free(t[0], t[1] * 4, 4), e);
    }
    take_data_as_u8() {
      let t = o.tiffresult_take_data_as_u8(this.__wbg_ptr);
      var e = V(t[0], t[1]).slice();
      return (o.__wbindgen_free(t[0], t[1] * 1, 1), e);
    }
    get timing_stats_ms() {
      return o.tiffresult_timing_stats_ms(this.__wbg_ptr);
    }
    take_data_as_f32() {
      let t = o.tiffresult_take_data_as_f32(this.__wbg_ptr);
      var e = M(t[0], t[1]).slice();
      return (o.__wbindgen_free(t[0], t[1] * 4, 4), e);
    }
    get timing_decode_ms() {
      return o.decodedarray_valid_count(this.__wbg_ptr);
    }
    get timing_convert_ms() {
      return o.imagestats_total_count(this.__wbg_ptr);
    }
    get timing_metadata_ms() {
      return o.decodedarray_non_finite_count(this.__wbg_ptr);
    }
    get page_directory_json() {
      let t, e;
      try {
        let n = o.tiffresult_page_directory_json(this.__wbg_ptr);
        return ((t = n[0]), (e = n[1]), h(n[0], n[1]));
      } finally {
        o.__wbindgen_free(t, e, 1);
      }
    }
    get planar_configuration() {
      return o.tiffresult_planar_configuration(this.__wbg_ptr) >>> 0;
    }
    get strip_byte_count_max() {
      return o.tiffresult_strip_byte_count_max(this.__wbg_ptr);
    }
    get strip_byte_count_total() {
      return o.tiffresult_strip_byte_count_total(this.__wbg_ptr);
    }
    get photometric_interpretation() {
      return o.tiffresult_photometric_interpretation(this.__wbg_ptr) >>> 0;
    }
    get width() {
      return o.decodedarray_source_data_offset(this.__wbg_ptr) >>> 0;
    }
    get height() {
      return o.tifffloatstripplanjs_lerc_additional_compression(this.__wbg_ptr) >>> 0;
    }
    get ome_xml() {
      let t, e;
      try {
        let n = o.tiffresult_ome_xml(this.__wbg_ptr);
        return ((t = n[0]), (e = n[1]), h(n[0], n[1]));
      } finally {
        o.__wbindgen_free(t, e, 1);
      }
    }
    get channels() {
      return o.tiffresult_channels(this.__wbg_ptr) >>> 0;
    }
    get data_len() {
      return o.tiffresult_data_len(this.__wbg_ptr) >>> 0;
    }
    get geo_json() {
      let t, e;
      try {
        let n = o.tiffresult_geo_json(this.__wbg_ptr);
        return ((t = n[0]), (e = n[1]), h(n[0], n[1]));
      } finally {
        o.__wbindgen_free(t, e, 1);
      }
    }
    get max_value() {
      return o.decodedarray_data_max(this.__wbg_ptr);
    }
    get min_value() {
      return o.decodedarray_data_min(this.__wbg_ptr);
    }
    get predictor() {
      return o.tiffresult_predictor(this.__wbg_ptr) >>> 0;
    }
  };
Symbol.dispose && (U.prototype[Symbol.dispose] = U.prototype.free);
var le =
    typeof FinalizationRegistry > 'u'
      ? { register: () => {}, unregister: () => {} }
      : new FinalizationRegistry(r => o.__wbg_tiffstripmetadatajs_free(r >>> 0, 1)),
  Et = class r {
    static __wrap(t) {
      t = t >>> 0;
      let e = Object.create(r.prototype);
      return ((e.__wbg_ptr = t), le.register(e, e.__wbg_ptr, e), e);
    }
    __destroy_into_raw() {
      let t = this.__wbg_ptr;
      return ((this.__wbg_ptr = 0), le.unregister(this), t);
    }
    free() {
      let t = this.__destroy_into_raw();
      o.__wbg_tiffstripmetadatajs_free(t, 0);
    }
    get page_count() {
      return o.exrresult_height(this.__wbg_ptr) >>> 0;
    }
    get all_tags_json() {
      let t, e;
      try {
        let n = o.tiffstripmetadatajs_all_tags_json(this.__wbg_ptr);
        return ((t = n[0]), (e = n[1]), h(n[0], n[1]));
      } finally {
        o.__wbindgen_free(t, e, 1);
      }
    }
    get page_directory_json() {
      let t, e;
      try {
        let n = o.tiffstripmetadatajs_page_directory_json(this.__wbg_ptr);
        return ((t = n[0]), (e = n[1]), h(n[0], n[1]));
      } finally {
        o.__wbindgen_free(t, e, 1);
      }
    }
    get photometric_interpretation() {
      return o.stabilitycurveresult_plateau_width(this.__wbg_ptr) >>> 0;
    }
    get ome_xml() {
      let t, e;
      try {
        let n = o.tiffstripmetadatajs_ome_xml(this.__wbg_ptr);
        return ((t = n[0]), (e = n[1]), h(n[0], n[1]));
      } finally {
        o.__wbindgen_free(t, e, 1);
      }
    }
    get geo_json() {
      let t, e;
      try {
        let n = o.tiffstripmetadatajs_geo_json(this.__wbg_ptr);
        return ((t = n[0]), (e = n[1]), h(n[0], n[1]));
      } finally {
        o.__wbindgen_free(t, e, 1);
      }
    }
  };
Symbol.dispose && (Et.prototype[Symbol.dispose] = Et.prototype.free);
var vr = new Set(['basic', 'cors', 'default']);
async function Er(r, t) {
  if (typeof Response == 'function' && r instanceof Response) {
    if (typeof WebAssembly.instantiateStreaming == 'function')
      try {
        return await WebAssembly.instantiateStreaming(r, t);
      } catch (n) {
        if (r.ok && vr.has(r.type) && r.headers.get('Content-Type') !== 'application/wasm')
          console.warn(
            '`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n',
            n
          );
        else throw n;
      }
    let e = await r.arrayBuffer();
    return await WebAssembly.instantiate(e, t);
  } else {
    let e = await WebAssembly.instantiate(r, t);
    return e instanceof WebAssembly.Instance ? { instance: e, module: r } : e;
  }
}
function jr() {
  let r = {};
  return (
    (r.wbg = {}),
    (r.wbg.__wbg___wbindgen_throw_b855445ff6a94295 = function (t, e) {
      throw new Error(h(t, e));
    }),
    (r.wbg.__wbg_error_7534b8e9a36f1ab4 = function (t, e) {
      let n, i;
      try {
        ((n = t), (i = e), console.error(h(t, e)));
      } finally {
        o.__wbindgen_free(n, i, 1);
      }
    }),
    (r.wbg.__wbg_length_4126f257d88ef51e = function (t) {
      return t.length;
    }),
    (r.wbg.__wbg_length_58bec3c3f0487eb5 = function (t) {
      return t.length;
    }),
    (r.wbg.__wbg_length_69bca3cb64fc8748 = function (t) {
      return t.length;
    }),
    (r.wbg.__wbg_new_8a6f238a6ece86ea = function () {
      return new Error();
    }),
    (r.wbg.__wbg_now_793306c526e2e3b6 = function () {
      return Date.now();
    }),
    (r.wbg.__wbg_set_7a75d83ea249c6e0 = function (t, e, n) {
      t.set(Pt(e, n));
    }),
    (r.wbg.__wbg_set_9e6516df7b7d0f19 = function (t, e, n) {
      t.set(V(e, n));
    }),
    (r.wbg.__wbg_set_eaa55bcb7597ecca = function (t, e, n) {
      t.set(M(e, n));
    }),
    (r.wbg.__wbg_stack_0ed75d68575b0f3c = function (t, e) {
      let n = e.stack,
        i = Y(n, o.__wbindgen_malloc, o.__wbindgen_realloc),
        s = l;
      (Kt().setInt32(t + 4, s, !0), Kt().setInt32(t + 0, i, !0));
    }),
    (r.wbg.__wbg_subarray_480600f3d6a9f26c = function (t, e, n) {
      return t.subarray(e >>> 0, n >>> 0);
    }),
    (r.wbg.__wbg_subarray_b24c6237257bcd4d = function (t, e, n) {
      return t.subarray(e >>> 0, n >>> 0);
    }),
    (r.wbg.__wbg_subarray_e9ae4d887d066081 = function (t, e, n) {
      return t.subarray(e >>> 0, n >>> 0);
    }),
    (r.wbg.__wbindgen_cast_2241b6af4c4b2941 = function (t, e) {
      return h(t, e);
    }),
    (r.wbg.__wbindgen_init_externref_table = function () {
      let t = o.__wbindgen_externrefs,
        e = t.grow(4);
      (t.set(0, void 0),
        t.set(e + 0, void 0),
        t.set(e + 1, null),
        t.set(e + 2, !0),
        t.set(e + 3, !1));
    }),
    r
  );
}
function Sr(r, t) {
  return (
    (o = r.exports),
    (De.__wbindgen_wasm_module = t),
    (C = null),
    (et = null),
    (rt = null),
    (ot = null),
    (tt = null),
    (nt = null),
    (Q = null),
    o.__wbindgen_start(),
    o
  );
}
async function De(r) {
  if (o !== void 0) return o;
  (typeof r < 'u' &&
    (Object.getPrototypeOf(r) === Object.prototype
      ? ({ module_or_path: r } = r)
      : console.warn(
          'using deprecated parameters for the initialization function; pass a single object instead'
        )),
    typeof r > 'u' && (r = new URL('wasm/tiff-wasm.wasm', import.meta.url)));
  let t = jr();
  (typeof r == 'string' ||
    (typeof Request == 'function' && r instanceof Request) ||
    (typeof URL == 'function' && r instanceof URL)) &&
    (r = fetch(r));
  let { instance: e, module: n } = await Er(await r, t);
  return Sr(e, n);
}
var Ot = De;
var d,
  lt = null;
function Z() {
  return ((lt === null || lt.byteLength === 0) && (lt = new Uint8Array(d.memory.buffer)), lt);
}
var St = new TextDecoder('utf-8', { ignoreBOM: !0, fatal: !0 });
St.decode();
var Tr = 2146435072,
  Bt = 0;
function Wr(r, t) {
  return (
    (Bt += t),
    Bt >= Tr &&
      ((St = new TextDecoder('utf-8', { ignoreBOM: !0, fatal: !0 })), St.decode(), (Bt = t)),
    St.decode(Z().subarray(r, r + t))
  );
}
function D(r, t) {
  return ((r = r >>> 0), Wr(r, t));
}
var pt = 0,
  gt = new TextEncoder();
'encodeInto' in gt ||
  (gt.encodeInto = function (r, t) {
    let e = gt.encode(r);
    return (t.set(e), { read: r.length, written: e.length });
  });
function Mr(r, t, e) {
  if (e === void 0) {
    let a = gt.encode(r),
      c = t(a.length, 1) >>> 0;
    return (
      Z()
        .subarray(c, c + a.length)
        .set(a),
      (pt = a.length),
      c
    );
  }
  let n = r.length,
    i = t(n, 1) >>> 0,
    s = Z(),
    _ = 0;
  for (; _ < n; _++) {
    let a = r.charCodeAt(_);
    if (a > 127) break;
    s[i + _] = a;
  }
  if (_ !== n) {
    (_ !== 0 && (r = r.slice(_)), (i = e(i, n, (n = _ + r.length * 3), 1) >>> 0));
    let a = Z().subarray(i + _, i + n),
      c = gt.encodeInto(r, a);
    ((_ += c.written), (i = e(i, n, _, 1) >>> 0));
  }
  return ((pt = _), i);
}
var J = null;
function Ue() {
  return (
    (J === null ||
      J.buffer.detached === !0 ||
      (J.buffer.detached === void 0 && J.buffer !== d.memory.buffer)) &&
      (J = new DataView(d.memory.buffer)),
    J
  );
}
function Ie(r) {
  let t = d.__wbindgen_externrefs.get(r);
  return (d.__externref_table_dealloc(r), t);
}
var ut = null;
function Pr() {
  return ((ut === null || ut.byteLength === 0) && (ut = new Float32Array(d.memory.buffer)), ut);
}
function Ct(r, t) {
  return ((r = r >>> 0), Pr().subarray(r / 4, r / 4 + t));
}
function Nr(r, t) {
  return ((r = r >>> 0), Z().subarray(r / 1, r / 1 + t));
}
function Rr(r, t) {
  let e = t(r.length * 1, 1) >>> 0;
  return (Z().set(r, e / 1), (pt = r.length), e);
}
function Oe(r) {
  let t = Rr(r, d.__wbindgen_malloc),
    e = pt,
    n = d.decode_jxl_fast(t, e);
  if (n[2]) throw Ie(n[1]);
  return wt.__wrap(n[0]);
}
var Le =
    typeof FinalizationRegistry > 'u'
      ? { register: () => {}, unregister: () => {} }
      : new FinalizationRegistry(r => d.__wbg_jxldecoded_free(r >>> 0, 1)),
  wt = class r {
    static __wrap(t) {
      t = t >>> 0;
      let e = Object.create(r.prototype);
      return ((e.__wbg_ptr = t), Le.register(e, e.__wbg_ptr, e), e);
    }
    __destroy_into_raw() {
      let t = this.__wbg_ptr;
      return ((this.__wbg_ptr = 0), Le.unregister(this), t);
    }
    free() {
      let t = this.__destroy_into_raw();
      d.__wbg_jxldecoded_free(t, 0);
    }
    get sample_kind() {
      return d.jxldecoded_sample_kind(this.__wbg_ptr) >>> 0;
    }
    get valid_count() {
      return d.jxldecoded_valid_count(this.__wbg_ptr);
    }
    get format_label() {
      let t, e;
      try {
        let n = d.jxldecoded_format_label(this.__wbg_ptr);
        return ((t = n[0]), (e = n[1]), D(n[0], n[1]));
      } finally {
        d.__wbindgen_free(t, e, 1);
      }
    }
    get metadata_json() {
      let t, e;
      try {
        let n = d.jxldecoded_metadata_json(this.__wbg_ptr);
        return ((t = n[0]), (e = n[1]), D(n[0], n[1]));
      } finally {
        d.__wbindgen_free(t, e, 1);
      }
    }
    get sample_format() {
      return d.jxldecoded_sample_format(this.__wbg_ptr) >>> 0;
    }
    get bits_per_sample() {
      return d.jxldecoded_bits_per_sample(this.__wbg_ptr) >>> 0;
    }
    get non_finite_count() {
      return d.jxldecoded_non_finite_count(this.__wbg_ptr);
    }
    take_data_as_f32() {
      let t = d.jxldecoded_take_data_as_f32(this.__wbg_ptr);
      if (t[3]) throw Ie(t[2]);
      var e = Ct(t[0], t[1]).slice();
      return (d.__wbindgen_free(t[0], t[1] * 4, 4), e);
    }
    get source_numeric_type() {
      let t, e;
      try {
        let n = d.jxldecoded_source_numeric_type(this.__wbg_ptr);
        return ((t = n[0]), (e = n[1]), D(n[0], n[1]));
      } finally {
        d.__wbindgen_free(t, e, 1);
      }
    }
    get width() {
      return d.jxldecoded_width(this.__wbg_ptr) >>> 0;
    }
    get height() {
      return d.jxldecoded_height(this.__wbg_ptr) >>> 0;
    }
    get channels() {
      return d.jxldecoded_channels(this.__wbg_ptr) >>> 0;
    }
    get data_len() {
      return d.jxldecoded_data_len(this.__wbg_ptr) >>> 0;
    }
    get data_max() {
      return d.jxldecoded_data_max(this.__wbg_ptr);
    }
    get data_min() {
      return d.jxldecoded_data_min(this.__wbg_ptr);
    }
    get type_max() {
      return d.jxldecoded_type_max(this.__wbg_ptr);
    }
    get type_min() {
      return d.jxldecoded_type_min(this.__wbg_ptr);
    }
  };
Symbol.dispose && (wt.prototype[Symbol.dispose] = wt.prototype.free);
var ze =
    typeof FinalizationRegistry > 'u'
      ? { register: () => {}, unregister: () => {} }
      : new FinalizationRegistry(r => d.__wbg_tiffresult_free(r >>> 0, 1)),
  Tt = class r {
    static __wrap(t) {
      t = t >>> 0;
      let e = Object.create(r.prototype);
      return ((e.__wbg_ptr = t), ze.register(e, e.__wbg_ptr, e), e);
    }
    __destroy_into_raw() {
      let t = this.__wbg_ptr;
      return ((this.__wbg_ptr = 0), ze.unregister(this), t);
    }
    free() {
      let t = this.__destroy_into_raw();
      d.__wbg_tiffresult_free(t, 0);
    }
    get tile_count() {
      return d.tiffresult_tile_count(this.__wbg_ptr) >>> 0;
    }
    get tile_width() {
      return d.tiffresult_tile_width(this.__wbg_ptr) >>> 0;
    }
    get compression() {
      return d.tiffresult_compression(this.__wbg_ptr) >>> 0;
    }
    get sample_kind() {
      return d.tiffresult_sample_kind(this.__wbg_ptr) >>> 0;
    }
    get strip_count() {
      return d.tiffresult_strip_count(this.__wbg_ptr) >>> 0;
    }
    get tile_length() {
      return d.tiffresult_tile_length(this.__wbg_ptr) >>> 0;
    }
    get all_tags_json() {
      let t, e;
      try {
        let n = d.tiffresult_all_tags_json(this.__wbg_ptr);
        return ((t = n[0]), (e = n[1]), D(n[0], n[1]));
      } finally {
        d.__wbindgen_free(t, e, 1);
      }
    }
    get direct_decode() {
      return d.tiffresult_direct_decode(this.__wbg_ptr) !== 0;
    }
    get sample_format() {
      return d.tiffresult_sample_format(this.__wbg_ptr) >>> 0;
    }
    get rows_per_strip() {
      return d.tiffresult_rows_per_strip(this.__wbg_ptr) >>> 0;
    }
    get bits_per_sample() {
      return d.tiffresult_bits_per_sample(this.__wbg_ptr) >>> 0;
    }
    get_data_as_f32() {
      let t = d.tiffresult_get_data_as_f32(this.__wbg_ptr);
      var e = Ct(t[0], t[1]).slice();
      return (d.__wbindgen_free(t[0], t[1] * 4, 4), e);
    }
    take_data_as_u8() {
      let t = d.tiffresult_take_data_as_u8(this.__wbg_ptr);
      var e = Nr(t[0], t[1]).slice();
      return (d.__wbindgen_free(t[0], t[1] * 1, 1), e);
    }
    take_data_as_f32() {
      let t = d.tiffresult_take_data_as_f32(this.__wbg_ptr);
      var e = Ct(t[0], t[1]).slice();
      return (d.__wbindgen_free(t[0], t[1] * 4, 4), e);
    }
    get page_directory_json() {
      let t, e;
      try {
        let n = d.tiffresult_page_directory_json(this.__wbg_ptr);
        return ((t = n[0]), (e = n[1]), D(n[0], n[1]));
      } finally {
        d.__wbindgen_free(t, e, 1);
      }
    }
    get planar_configuration() {
      return d.tiffresult_planar_configuration(this.__wbg_ptr) >>> 0;
    }
    get strip_byte_count_max() {
      return d.tiffresult_strip_byte_count_max(this.__wbg_ptr);
    }
    get strip_byte_count_total() {
      return d.tiffresult_strip_byte_count_total(this.__wbg_ptr);
    }
    get photometric_interpretation() {
      return d.tiffresult_photometric_interpretation(this.__wbg_ptr) >>> 0;
    }
    get width() {
      return d.tiffresult_width(this.__wbg_ptr) >>> 0;
    }
    get height() {
      return d.tiffresult_height(this.__wbg_ptr) >>> 0;
    }
    get ome_xml() {
      let t, e;
      try {
        let n = d.tiffresult_ome_xml(this.__wbg_ptr);
        return ((t = n[0]), (e = n[1]), D(n[0], n[1]));
      } finally {
        d.__wbindgen_free(t, e, 1);
      }
    }
    get channels() {
      return d.tiffresult_channels(this.__wbg_ptr) >>> 0;
    }
    get data_len() {
      return d.tiffresult_data_len(this.__wbg_ptr) >>> 0;
    }
    get geo_json() {
      let t, e;
      try {
        let n = d.tiffresult_geo_json(this.__wbg_ptr);
        return ((t = n[0]), (e = n[1]), D(n[0], n[1]));
      } finally {
        d.__wbindgen_free(t, e, 1);
      }
    }
    get max_value() {
      return d.jxldecoded_data_max(this.__wbg_ptr);
    }
    get min_value() {
      return d.jxldecoded_data_min(this.__wbg_ptr);
    }
    get predictor() {
      return d.tiffresult_predictor(this.__wbg_ptr) >>> 0;
    }
  };
Symbol.dispose && (Tt.prototype[Symbol.dispose] = Tt.prototype.free);
var Dr = new Set(['basic', 'cors', 'default']);
async function Ur(r, t) {
  if (typeof Response == 'function' && r instanceof Response) {
    if (typeof WebAssembly.instantiateStreaming == 'function')
      try {
        return await WebAssembly.instantiateStreaming(r, t);
      } catch (n) {
        if (r.ok && Dr.has(r.type) && r.headers.get('Content-Type') !== 'application/wasm')
          console.warn(
            '`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n',
            n
          );
        else throw n;
      }
    let e = await r.arrayBuffer();
    return await WebAssembly.instantiate(e, t);
  } else {
    let e = await WebAssembly.instantiate(r, t);
    return e instanceof WebAssembly.Instance ? { instance: e, module: r } : e;
  }
}
function Lr() {
  let r = {};
  return (
    (r.wbg = {}),
    (r.wbg.__wbg___wbindgen_throw_b855445ff6a94295 = function (t, e) {
      throw new Error(D(t, e));
    }),
    (r.wbg.__wbg_error_7534b8e9a36f1ab4 = function (t, e) {
      let n, i;
      try {
        ((n = t), (i = e), console.error(D(t, e)));
      } finally {
        d.__wbindgen_free(n, i, 1);
      }
    }),
    (r.wbg.__wbg_new_8a6f238a6ece86ea = function () {
      return new Error();
    }),
    (r.wbg.__wbg_now_793306c526e2e3b6 = function () {
      return Date.now();
    }),
    (r.wbg.__wbg_stack_0ed75d68575b0f3c = function (t, e) {
      let n = e.stack,
        i = Mr(n, d.__wbindgen_malloc, d.__wbindgen_realloc),
        s = pt;
      (Ue().setInt32(t + 4, s, !0), Ue().setInt32(t + 0, i, !0));
    }),
    (r.wbg.__wbindgen_cast_2241b6af4c4b2941 = function (t, e) {
      return D(t, e);
    }),
    (r.wbg.__wbindgen_init_externref_table = function () {
      let t = d.__wbindgen_externrefs,
        e = t.grow(4);
      (t.set(0, void 0),
        t.set(e + 0, void 0),
        t.set(e + 1, null),
        t.set(e + 2, !0),
        t.set(e + 3, !1));
    }),
    r
  );
}
function zr(r, t) {
  return (
    (d = r.exports),
    (Be.__wbindgen_wasm_module = t),
    (J = null),
    (ut = null),
    (lt = null),
    d.__wbindgen_start(),
    d
  );
}
async function Be(r) {
  if (d !== void 0) return d;
  (typeof r < 'u' &&
    (Object.getPrototypeOf(r) === Object.prototype
      ? ({ module_or_path: r } = r)
      : console.warn(
          'using deprecated parameters for the initialization function; pass a single object instead'
        )),
    typeof r > 'u' && (r = new URL('wasm/jxl-wasm.wasm', import.meta.url)));
  let t = Lr();
  (typeof r == 'string' ||
    (typeof Request == 'function' && r instanceof Request) ||
    (typeof URL == 'function' && r instanceof URL)) &&
    (r = fetch(r));
  let { instance: e, module: n } = await Ur(await r, t);
  return zr(e, n);
}
var Ce = Be;
function Ir(r, t) {
  return `rust-${r}-wasm (${t === 'worker' ? 'worker' : 'main thread'})`;
}
function Or(r, t) {
  return [{ name: `decode-${r}-rust`, durationMs: performance.now() - t }];
}
function Br(r, t) {
  let e = Number(r.data_len || 0);
  if (t && Number.isSafeInteger(e) && e >= 0) {
    let n = Number(r.source_data_offset || 0);
    if (
      r.can_reuse_source === !0 &&
      r.sample_kind === 0 &&
      Number.isSafeInteger(n) &&
      n >= 0 &&
      n % 4 === 0 &&
      n + e * 4 <= t.byteLength &&
      typeof r.discard_data == 'function'
    ) {
      let i = new Float32Array(t, n, e);
      return (r.discard_data(), i);
    }
    switch (r.sample_kind) {
      case 1:
        if (t.byteLength >= e && typeof r.copy_data_as_u8_into == 'function') {
          let i = new Uint8Array(t, 0, e);
          return (r.copy_data_as_u8_into(i), i);
        }
        break;
      case 2:
        if (t.byteLength >= e * 2 && typeof r.copy_data_as_u16_into == 'function') {
          let i = new Uint16Array(t, 0, e);
          return (r.copy_data_as_u16_into(i), i);
        }
        break;
      case 3:
        if (t.byteLength >= e * 2 && typeof r.copy_data_as_u8_into == 'function') {
          let i = new Uint8Array(t, 0, e * 2);
          return (r.copy_data_as_u8_into(i), new Uint16Array(t, 0, e));
        }
        break;
      default:
        if (t.byteLength >= e * 4 && typeof r.copy_data_as_f32_into == 'function') {
          let i = new Float32Array(t, 0, e);
          return (r.copy_data_as_f32_into(i), i);
        }
    }
  }
  switch (r.sample_kind) {
    case 1:
      return r.take_data_as_u8();
    case 2:
      return r.take_data_as_u16();
    case 3: {
      let n = r.take_data_as_u8();
      return new Uint16Array(n.buffer, n.byteOffset, n.byteLength / 2);
    }
    default:
      return r.take_data_as_f32();
  }
}
function P(r, t, e, n, i = !0, s) {
  let _ = Br(r, s),
    a = JSON.parse(r.metadata_json);
  return {
    width: r.width,
    height: r.height,
    channels: r.channels,
    data: _,
    metadata: a,
    numericDomain: {
      bitsPerSample: r.bits_per_sample,
      sampleFormat: r.sample_format,
      typeMin: r.type_min,
      typeMax: r.type_max,
      sourceNumericType: r.source_numeric_type,
    },
    stats: i ? { min: r.data_min, max: r.data_max } : void 0,
    nonFiniteCount: r.non_finite_count,
    validCount: r.valid_count,
    formatLabel: r.format_label,
    decodedWith: Ir(t, e),
    decodeTimings: Or(t, n),
  };
}
function Je(r, t, e, n = !0) {
  let i = performance.now(),
    s = r(new Uint8Array(t), n);
  return P(s, 'pfm', e, i, !1, t);
}
function Ge(r, t, e) {
  let n = performance.now(),
    i = r(new Uint8Array(t));
  return P(i, 'ppm', e, n, !1, t);
}
function He(r, t, e) {
  let n = performance.now(),
    i = r(new Uint8Array(t));
  return P(i, 'npy', e, n, !0, t);
}
function Xe(r, t, e) {
  let n = performance.now(),
    i = r(new Uint8Array(t));
  return P(i, 'jxl', e, n);
}
function Ve(r, t, e) {
  let n = performance.now(),
    i = r(new Uint8Array(t));
  return P(i, 'fits', e, n);
}
function Ke(r, t, e, n) {
  let i = performance.now(),
    s = r(new Uint8Array(t), JSON.stringify(e || {}));
  return P(s, 'netcdf', n, i);
}
function $e(r, t, e, n) {
  let i = performance.now(),
    s = r(new Uint8Array(t), e >>> 0);
  return P(s, 'dicom', n, i);
}
function Ye(r, t, e, n) {
  let i = performance.now(),
    s = r(new Uint8Array(t), JSON.stringify(e || {}));
  return P(s, 'czi', n, i);
}
function Ze(r, t, e, n) {
  let i = performance.now(),
    s = r(new Uint8Array(t), JSON.stringify(e || {}));
  return P(s, 'nd2', n, i);
}
function qe(r, t, e, n) {
  let i = performance.now(),
    s = r(new Uint8Array(t), JSON.stringify(e || {}));
  return P(s, 'lif', n, i);
}
function Qe(r, t, e, n) {
  let i = performance.now(),
    s = r(new Uint8Array(t), JSON.stringify(e || {}));
  return P(s, 'sdt', n, i);
}
function Cr(r) {
  let t = Number(r?.width || 0),
    e = Number(r?.height || 0),
    n = Math.max(1, Number(r?.channels || 1)),
    i = Math.max(1, Math.ceil(Number(r?.bits_per_sample || 8) / 8));
  return t * e * n * i;
}
function Jr(r, t = 8) {
  let e = Math.max(0, Number(r?.strip_count || 0)),
    n = Math.max(0, Math.min(8, Math.floor(t)));
  if (e < 2 || n < 2) return 0;
  if (Number(r?.compression) === 34925) {
    let i = Math.max(2, Math.ceil(Cr(r) / 2097152));
    return Math.min(e, n, i);
  }
  return Math.min(e, n);
}
function tr(r) {
  let t = Number(r?.strip_count || 0),
    e = Number(r?.width || 0),
    n = Number(r?.height || 0);
  if (
    Number(r?.compression) === 1 &&
    Number(r?.sample_format || 1) === 1 &&
    Number(r?.bits_per_sample || 8) <= 16
  )
    return !1;
  let i = Number(r?.compression) === 34925 || Number(r?.tile_length || 0) > 0 ? 2 : 16;
  return t >= i && e > 0 && n > 0 && e * n >= 2e6 && Jr(r) >= 2;
}
function er(r) {
  if (!r) return [];
  let t;
  try {
    t = JSON.parse(r);
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
function rr(r, t) {
  if (!Array.isArray(r)) return [];
  let e = r.find(i => i.index === t && i.kind === 'image');
  if (!e) return [];
  let n = r
    .filter(i => i.kind === 'overview' && i.parent === e.index)
    .sort((i, s) => s.width - i.width);
  return [e, ...n];
}
function Gr(r, t, e, n = 1) {
  let i = rr(r, t);
  if (i.length === 0) return null;
  if (!Number.isFinite(e) || e <= 0) return i[0];
  let s = e * n,
    _ = i[0];
  for (let a of i) a.width >= s && (_ = a);
  return _;
}
var Hr = 4e7;
function nr(r, t, e, n, i = 1, s = Hr) {
  let _ = rr(r, t);
  if (_.length === 0) return null;
  let a = _[0];
  if (n(a.width, a.height) && a.width * a.height <= s) return a;
  let c = Gr(r, t, e, i) ?? a,
    g = Math.max(0, _.indexOf(c));
  for (let f of _.slice(g)) if (n(f.width, f.height)) return f;
  return null;
}
var N = !1,
  F = null,
  O = 3e3,
  Jt = null,
  Wt = null,
  Xr = 15e3;
function L(r, t, e) {
  return Promise.race([r, new Promise((n, i) => setTimeout(() => i(new Error(e)), t))]);
}
async function Vr(r, t) {
  if (r instanceof WebAssembly.Module || r?.byteLength)
    try {
      (await L(Ot({ module_or_path: r }), O, 'TIFF WASM byte initialization timed out'), (N = !0));
      return;
    } catch (e) {
      console.warn('[DecodeWorker] TIFF WASM byte initialization failed', e);
    }
  for (let e of t || [])
    try {
      (await L(Ot({ module_or_path: e }), O, 'TIFF WASM URL initialization timed out'), (N = !0));
      return;
    } catch (n) {
      console.warn('[DecodeWorker] TIFF WASM init failed for', e, n);
    }
}
async function Kr() {
  if (!Jt)
    throw new Error(
      'Cannot decode JPEG XL: its WASM module was not delivered to the decode worker.'
    );
  (Wt ||
    (Wt = (async () => {
      try {
        await L(Ce({ module_or_path: Jt }), Xr, 'JPEG XL WASM initialization timed out');
      } catch (r) {
        throw ((Wt = null), r);
      }
    })()),
    await Wt);
}
function $r(r, t) {
  if (!t || typeof Dt != 'function') return 0;
  let e;
  try {
    e = er(Dt(r));
  } catch {
    return 0;
  }
  if (e.length < 2) return 0;
  let n = (s, _) =>
      s <= t.maxAxis && _ <= t.maxAxis && s * _ <= t.maxArea && s * _ * 4 <= t.maxBytes,
    i = nr(e, 0, t.displayWidth, n, 1, t.pixelBudget);
  return i ? i.index : 0;
}
function Yr(r, t = 0, e) {
  if (!N) throw new Error('TIFF WASM decoder not initialized');
  let n = We,
    i = ve,
    s = je,
    _ = Me,
    a = Re,
    c = [],
    g = performance.now(),
    f = new Uint8Array(r);
  t === 0 && e && (t = $r(f, e));
  let u = (t === 0 || t === 1) && It(f) > 0,
    b = u ? 2 : typeof n == 'function' ? n(f) : 1;
  if (t < 0 || t >= b) throw new Error(`TIFF page index ${t} is out of range (page count: ${b})`);
  u && (t = 1);
  let w = u
      ? xe(f)
      : t > 0 && typeof i == 'function'
        ? i(f, t)
        : t > 0 && typeof s == 'function'
          ? s(f, t)
          : typeof _ == 'function'
            ? _(f)
            : a(f),
    j = performance.now();
  (c.push({ name: 'decode-wasm-rust', durationMs: j - g }),
    Number.isFinite(w.timing_metadata_ms) &&
      c.push({ name: 'decode-rust-metadata', durationMs: w.timing_metadata_ms }),
    Number.isFinite(w.timing_decode_ms) &&
      c.push({ name: 'decode-rust-read-image', durationMs: w.timing_decode_ms }),
    Number.isFinite(w.timing_convert_ms) &&
      c.push({ name: 'decode-rust-convert-pack', durationMs: w.timing_convert_ms }),
    Number.isFinite(w.timing_stats_ms) &&
      c.push({ name: 'decode-rust-stats', durationMs: w.timing_stats_ms }),
    Number.isFinite(w.timing_pack_ms) &&
      c.push({ name: 'decode-rust-pack', durationMs: w.timing_pack_ms }),
    w.direct_decode && c.push({ name: 'decode-rust-direct', durationMs: 1 }),
    (g = j));
  let G = w.width,
    y = w.height,
    x = w.channels,
    A = Number(w.sample_kind ?? 0),
    v;
  if ((A === 1 || A === 3) && typeof w.take_data_as_u8 == 'function') {
    let E = w.take_data_as_u8();
    v = A === 3 ? new Uint16Array(E.buffer, E.byteOffset, E.byteLength / 2) : E;
  } else v = typeof w.take_data_as_f32 == 'function' ? w.take_data_as_f32() : w.get_data_as_f32();
  ((j = performance.now()),
    c.push({
      name: `decode-wasm-take-${A === 1 ? 'u8' : A === 3 ? 'u16' : 'f32'}`,
      durationMs: j - g,
    }),
    (g = j));
  let S = [];
  if (x === 1) S.push(v);
  else {
    let E = G * y,
      z = v.constructor;
    for (let I = 0; I < x; I++) {
      let q = new z(E);
      for (let B = 0; B < E; B++) q[B] = v[B * x + I];
      S.push(q);
    }
  }
  return (
    (j = performance.now()),
    c.push({ name: 'decode-wasm-deinterleave', durationMs: j - g }),
    {
      pageIndex: t,
      pageCount: b,
      width: G,
      height: y,
      channels: x,
      bitsPerSample: w.bits_per_sample,
      sampleFormat: w.sample_format,
      sampleKind: A,
      compression: w.compression,
      predictor: w.predictor,
      photometricInterpretation: w.photometric_interpretation,
      planarConfiguration: w.planar_configuration,
      rowsPerStrip: w.rows_per_strip,
      stripCount: w.strip_count,
      stripByteCountTotal: Number(w.strip_byte_count_total || 0),
      stripByteCountMax: Number(w.strip_byte_count_max || 0),
      tileWidth: w.tile_width,
      tileLength: w.tile_length,
      tileCount: w.tile_count,
      directDecode: w.direct_decode,
      data: v,
      rasters: S,
      min: w.min_value,
      max: w.max_value,
      allTagsJson: w.all_tags_json,
      omeXml: w.ome_xml || void 0,
      geoJson: w.geo_json || void 0,
      pageDirectoryJson: w.page_directory_json || void 0,
      decodedWith: u ? 'wasm (bounded preview)' : 'wasm (worker)',
      decodeTimings: c,
    }
  );
}
async function ir(r, t = 0, e) {
  F &&
    (await L(F, O, 'TIFF WASM init wait timed out').catch(n => console.warn('[DecodeWorker]', n)));
  try {
    return Yr(r, t, e);
  } catch (n) {
    let i = String((n instanceof Error ? n.message : n) || 'WASM decode failed');
    throw new Error(i);
  }
}
async function Zr(r, t) {
  await R('TIFF region');
  let e = t.rect || {},
    n = t.sourceCacheKey ? String(t.sourceCacheKey) : '',
    i = null;
  if (n) {
    if (W?.key !== n) {
      if ((W?.decoder.free(), (W = null), !r.byteLength))
        throw new Error('TIFF region source is not cached in the decode worker');
      W = { key: n, decoder: new K(new Uint8Array(r)) };
    }
    i = W.decoder;
  }
  let s = i
    ? i.decode(
        Number(t.pageIndex || 0),
        Number(e.x || 0),
        Number(e.y || 0),
        Number(e.width || 0),
        Number(e.height || 0)
      )
    : me(
        new Uint8Array(r),
        Number(t.pageIndex || 0),
        Number(e.x || 0),
        Number(e.y || 0),
        Number(e.width || 0),
        Number(e.height || 0)
      );
  return {
    width: Number(s.width),
    height: Number(s.height),
    channels: Number(s.channels),
    bitsPerSample: Number(s.bits_per_sample),
    sampleFormat: Number(s.sample_format),
    blocksDecoded: Number(s.blocks_decoded),
    data: s.take_data_as_f32(),
  };
}
async function qr(r, t = 0) {
  if (
    t === 0 &&
    (F &&
      (await L(F, O, 'TIFF WASM init wait timed out').catch(e =>
        console.warn('[DecodeWorker]', e)
      )),
    N && typeof Ut == 'function')
  ) {
    let e = performance.now();
    try {
      let n = Ut(new Uint8Array(r));
      if (tr(n) || It(new Uint8Array(r)) > 0)
        return {
          deferToParallelTiff: !0,
          width: Number(n.width || 0),
          height: Number(n.height || 0),
          stripCount: Number(n.strip_count || 0),
          decodeTimings: [{ name: 'decode-tiff-route-plan', durationMs: performance.now() - e }],
        };
    } catch {}
  }
  return ir(r, t);
}
function Qr(r) {
  if (!N || typeof Nt != 'function') throw new Error('EXR WASM decoder not initialized');
  let t = [],
    e = performance.now(),
    n = Nt(new Uint8Array(r)),
    i = performance.now();
  (t.push({ name: 'decode-exr-rust', durationMs: i - e }),
    Number.isFinite(n.timing_read_ms) &&
      t.push({ name: 'decode-exr-read-image', durationMs: n.timing_read_ms }),
    Number.isFinite(n.timing_pack_ms) &&
      t.push({ name: 'decode-exr-pack', durationMs: n.timing_pack_ms }),
    (e = i));
  let s = n.take_data_as_f32();
  ((i = performance.now()), t.push({ name: 'decode-exr-to-f32', durationMs: i - e }));
  let _ = String(n.channel_names_csv || '')
      .split(',')
      .filter(Boolean),
    a = String(n.displayed_channels_csv || '')
      .split(',')
      .filter(Boolean);
  return {
    width: n.width,
    height: n.height,
    data: s,
    format: n.format,
    type: n.data_type,
    channelNames: _,
    displayedChannels: a,
    shape: [n.width, n.height],
    flipY: !1,
    allTagsJson: n.all_tags_json,
    stats: { min: n.data_min, max: n.data_max },
    channels: n.channels,
    decodedWith: 'rust-exr-wasm (worker)',
    decodeTimings: t,
  };
}
async function tn(r) {
  F && (await L(F, O, 'WASM init wait timed out').catch(t => console.warn('[DecodeWorker]', t)));
  try {
    return Qr(r);
  } catch (t) {
    let e = String((t instanceof Error ? t.message : t) || 'WASM EXR decode failed');
    throw new Error(e);
  }
}
function en(r) {
  if (!N || typeof Rt != 'function') throw new Error('EXR ZIP planner is not initialized');
  let t = performance.now(),
    e = Rt(new Uint8Array(r));
  return e
    ? {
        supported: !0,
        source: r,
        width: e.width,
        height: e.height,
        dataY: e.data_y,
        channelName: e.channel_name,
        counts: e.counts,
        yCoordinates: e.y_coordinates,
        allTagsJson: e.all_tags_json,
        compressed: e.take_compressed(),
        planMs: performance.now() - t,
      }
    : { supported: !1, source: r };
}
function rn(r) {
  if (!N || typeof Lt != 'function') throw new Error('HDR WASM decoder not initialized');
  let t = [],
    e = performance.now(),
    n = Lt(new Uint8Array(r)),
    i = performance.now();
  (t.push({ name: 'decode-hdr-rust', durationMs: i - e }), (e = i));
  let s = n.take_data_as_f32(),
    _ = n.take_metadata_as_f64();
  ((i = performance.now()), t.push({ name: 'decode-hdr-transfer-f32', durationMs: i - e }));
  let [a = 0, c = 0, g = 1, f = 1, u = NaN, b = NaN, w = NaN] = _;
  return (
    Number.isFinite(u) && t.push({ name: 'decode-hdr-header', durationMs: u }),
    Number.isFinite(b) && t.push({ name: 'decode-hdr-rle', durationMs: b }),
    Number.isFinite(w) && t.push({ name: 'decode-hdr-to-f32', durationMs: w }),
    {
      shape: [a, c],
      channels: n.channels,
      exposure: g,
      gamma: f,
      data: s,
      allTagsJson: n.all_tags_json,
      decodedWith: 'rust-hdr-wasm (worker)',
      decodeTimings: t,
    }
  );
}
function nn(r, t = '') {
  let e = performance.now(),
    n = (0, or.default)(r);
  return (
    (n.decodedWith = 'parse-hdr (worker)'),
    t && (n.wasmFallbackReason = t),
    (n.decodeTimings = [{ name: 'decode-hdr-parse-hdr', durationMs: performance.now() - e }]),
    n
  );
}
async function on(r) {
  F && (await L(F, O, 'WASM init wait timed out').catch(t => console.warn('[DecodeWorker]', t)));
  try {
    return rn(r);
  } catch (t) {
    let e = String((t instanceof Error ? t.message : t) || 'WASM HDR decode failed');
    return (
      console.warn('[DecodeWorker] HDR WASM decode failed, using parse-hdr in worker:', e),
      nn(r, e)
    );
  }
}
function _n(r) {
  if (!N || typeof zt != 'function') throw new Error('PNG WASM decoder not initialized');
  let t = [],
    e = performance.now(),
    n = zt(new Uint8Array(r)),
    i = performance.now();
  (t.push({ name: 'decode-png16-rust', durationMs: i - e }),
    Number.isFinite(n.timing_read_info_ms) &&
      t.push({ name: 'decode-png16-rust-info', durationMs: n.timing_read_info_ms }),
    Number.isFinite(n.timing_decode_ms) &&
      t.push({ name: 'decode-png16-rust-frame', durationMs: n.timing_decode_ms }),
    Number.isFinite(n.timing_convert_ms) &&
      t.push({ name: 'decode-png16-rust-to-u16', durationMs: n.timing_convert_ms }),
    (e = i));
  let s = n.take_data_as_u16();
  return (
    (i = performance.now()),
    t.push({ name: 'decode-png16-rust-transfer-u16', durationMs: i - e }),
    {
      width: n.width,
      height: n.height,
      depth: n.bit_depth,
      ctype: n.color_type,
      decodedData: s,
      decodedWith: 'rust-png-wasm (worker)',
      decodeTimings: t,
    }
  );
}
async function sn(r) {
  F && (await L(F, O, 'WASM init wait timed out').catch(t => console.warn('[DecodeWorker]', t)));
  try {
    return _n(r);
  } catch (t) {
    let e = String((t instanceof Error ? t.message : t) || 'WASM PNG decode failed');
    throw new Error(e);
  }
}
async function R(r) {
  if (
    (F && (await L(F, O, 'WASM init wait timed out').catch(t => console.warn('[DecodeWorker]', t))),
    !N)
  )
    throw new Error(
      `Cannot decode ${r}: the Rust/WASM decoder failed to initialize. ${r} is decoded exclusively by WebAssembly in this extension.`
    );
}
async function an(r) {
  return (await R('PFM'), Je(Ae, r, 'worker'));
}
async function cn(r) {
  return (await R('NetPBM'), Ge(Fe, r, 'worker'));
}
async function dn(r) {
  return (await R('NPY'), He(ke, r, 'worker'));
}
async function fn(r) {
  return (await Kr(), Xe(Oe, r, 'worker'));
}
async function ln(r) {
  throw new Error(
    '[external-codec:JPEG XR] a .jxr file needs the JPEG XR decoder, which is not in this build'
  );
}
async function un(r) {
  throw new Error(
    '[external-codec:JPEG 2000] a .jp2 file needs the JPEG 2000 decoder, which is not in this build'
  );
}
async function gn(r) {
  return (await R('FITS'), Ve(Pe, r, 'worker'));
}
async function pn(r, t) {
  return (await R('NetCDF'), Ke(he, r, t, 'worker'));
}
async function wn(r, t) {
  return (await R('DICOM'), $e(ye, r, t, 'worker'));
}
async function bn(r, t) {
  return (await R('ND2'), Ze(Ne, r, t, 'worker'));
}
async function mn(r, t) {
  return (await R('LIF'), qe(Te, r, t, 'worker'));
}
async function hn(r, t) {
  return (await R('SDT'), Qe(Ee, r, t, 'worker'));
}
async function yn(r, t) {
  return (await R('CZI'), Ye(Se, r, t, 'worker'));
}
async function xn(r, t, e = {}) {
  switch (r) {
    case 'tiff':
      return e.preferParallelTiff
        ? qr(t, Number(e.pageIndex || 0))
        : ir(t, Number(e.pageIndex || 0), e.levelHint);
    case 'tiff-region':
      return Zr(t, e);
    case 'exr':
      return tn(t);
    case 'exr-zip-plan':
      return en(t);
    case 'npy':
      return dn(t);
    case 'pfm':
      return an(t);
    case 'ppm':
      return cn(t);
    case 'png16':
      return sn(t);
    case 'hdr':
      return on(t);
    case 'jxl':
      return fn(t);
    case 'jxr':
      return ln(t);
    case 'jp2':
      return un(t);
    case 'fits':
      return gn(t);
    case 'dicom':
      return wn(t, Number(e.frameIndex || 0));
    case 'netcdf':
      return pn(t, e);
    case 'czi':
      return yn(t, e);
    case 'nd2':
      return bn(t, e);
    case 'lif':
      return mn(t, e);
    case 'sdt':
      return hn(t, e);
    default:
      throw new Error(`Unknown decode format: ${r}`);
  }
}
function Gt(r, t = new Set(), e = 0) {
  if (r == null || e > 4) return [...t];
  if (r instanceof ArrayBuffer) t.add(r);
  else if (ArrayBuffer.isView(r)) r.buffer instanceof ArrayBuffer && t.add(r.buffer);
  else if (Array.isArray(r)) for (let n of r) Gt(n, t, e + 1);
  else if (typeof r == 'object' && r.constructor === Object)
    for (let n of Object.keys(r)) Gt(r[n], t, e + 1);
  return [...t];
}
var bt = null,
  W = null;
self.onmessage = async r => {
  let t = r.data;
  if (t.type === 'jxl-module') {
    Jt = t.jxlModule;
    return;
  }
  if (t.type === 'init') {
    ((F = Vr(t.tiffWasmModule || t.tiffWasmBuffer, t.tiffWasmUrls)),
      await F,
      self.postMessage({ type: 'ready', caps: { tiff: N, tiffWasm: N } }));
    return;
  }
  let { id: e, format: n, buffer: i, options: s } = t,
    _ = s?.sourceCacheKey ? String(s.sourceCacheKey) : '',
    a = !1;
  try {
    let c = i,
      g = n === 'tiff-region' && !!_ && W?.key === _;
    if (_ && n !== 'tiff-region') {
      if (
        (W?.key !== _ && (W?.decoder.free(), (W = null)),
        !c?.byteLength && bt?.key === _
          ? ((c = bt.buffer), (a = !0))
          : c?.byteLength && (bt = { key: _, buffer: c }),
        !c?.byteLength)
      )
        throw new Error('Source bytes are not cached in the decode worker');
    } else if (_ && ((bt = null), !c?.byteLength && !g))
      throw new Error('Source bytes are not cached in the decode worker');
    let f = await xn(n, c, s),
      u = Gt(f),
      b = !_ && u.some(w => w.byteLength >= 64 * 1024 * 1024);
    self.postMessage({ id: e, ok: !0, result: f, sourceCached: !!_, retireWorker: b }, u);
  } catch (c) {
    let g = String((c instanceof Error ? c.message : c) || 'decode failed');
    _ && ((bt = null), W?.key === _ && (W.decoder.free(), (W = null)));
    try {
      a || !i?.byteLength
        ? self.postMessage({ id: e, ok: !1, error: g })
        : self.postMessage({ id: e, ok: !1, error: g, buffer: i }, [i]);
    } catch {
      self.postMessage({ id: e, ok: !1, error: g });
    }
  }
};
