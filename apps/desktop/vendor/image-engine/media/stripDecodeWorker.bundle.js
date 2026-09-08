var r,
  I = null;
function R() {
  return ((I === null || I.byteLength === 0) && (I = new Uint8Array(r.memory.buffer)), I);
}
var B = new TextDecoder('utf-8', { ignoreBOM: !0, fatal: !0 });
B.decode();
var Bt = 2146435072,
  lt = 0;
function Vt(n, t) {
  return (
    (lt += t),
    lt >= Bt &&
      ((B = new TextDecoder('utf-8', { ignoreBOM: !0, fatal: !0 })), B.decode(), (lt = t)),
    B.decode(R().subarray(n, n + t))
  );
}
function y(n, t) {
  return ((n = n >>> 0), Vt(n, t));
}
var T = null;
function Ot() {
  return ((T === null || T.byteLength === 0) && (T = new Uint16Array(r.memory.buffer)), T);
}
function dt(n, t) {
  return ((n = n >>> 0), Ot().subarray(n / 2, n / 2 + t));
}
function z(n, t) {
  return ((n = n >>> 0), R().subarray(n / 1, n / 1 + t));
}
var U = null;
function It() {
  return ((U === null || U.byteLength === 0) && (U = new Float32Array(r.memory.buffer)), U);
}
function j(n, t) {
  return ((n = n >>> 0), It().subarray(n / 4, n / 4 + t));
}
var u = 0,
  D = new TextEncoder();
'encodeInto' in D ||
  (D.encodeInto = function (n, t) {
    let e = D.encode(n);
    return (t.set(e), { read: n.length, written: e.length });
  });
function Yt(n, t, e) {
  if (e === void 0) {
    let a = D.encode(n),
      f = t(a.length, 1) >>> 0;
    return (
      R()
        .subarray(f, f + a.length)
        .set(a),
      (u = a.length),
      f
    );
  }
  let _ = n.length,
    s = t(_, 1) >>> 0,
    i = R(),
    o = 0;
  for (; o < _; o++) {
    let a = n.charCodeAt(o);
    if (a > 127) break;
    i[s + o] = a;
  }
  if (o !== _) {
    (o !== 0 && (n = n.slice(o)), (s = e(s, _, (_ = o + n.length * 3), 1) >>> 0));
    let a = R().subarray(s + o, s + _),
      f = D.encodeInto(n, a);
    ((o += f.written), (s = e(s, _, o, 1) >>> 0));
  }
  return ((u = o), s);
}
var S = null;
function gt() {
  return (
    (S === null ||
      S.buffer.detached === !0 ||
      (S.buffer.detached === void 0 && S.buffer !== r.memory.buffer)) &&
      (S = new DataView(r.memory.buffer)),
    S
  );
}
function k(n, t) {
  let e = t(n.length * 1, 1) >>> 0;
  return (R().set(n, e / 1), (u = n.length), e);
}
function g(n) {
  let t = r.__wbindgen_externrefs.get(n);
  return (r.__externref_table_dealloc(n), t);
}
function v(n, t) {
  let e = t(n.length * 4, 4) >>> 0;
  return (It().set(n, e / 4), (u = n.length), e);
}
var E = null;
function Tt() {
  return ((E === null || E.byteLength === 0) && (E = new Float64Array(r.memory.buffer)), E);
}
function Xt(n, t) {
  let e = t(n.length * 8, 8) >>> 0;
  return (Tt().set(n, e / 8), (u = n.length), e);
}
function A(n, t) {
  let e = t(n.length * 2, 2) >>> 0;
  return (Ot().set(n, e / 2), (u = n.length), e);
}
var L = null;
function Ut() {
  return ((L === null || L.byteLength === 0) && (L = new Uint32Array(r.memory.buffer)), L);
}
function W(n, t) {
  let e = t(n.length * 4, 4) >>> 0;
  return (Ut().set(n, e / 4), (u = n.length), e);
}
var N = null;
function qt() {
  return ((N === null || N.byteLength === 0) && (N = new Int32Array(r.memory.buffer)), N);
}
function st(n, t) {
  return ((n = n >>> 0), qt().subarray(n / 4, n / 4 + t));
}
function Et(n, t) {
  return ((n = n >>> 0), Ut().subarray(n / 4, n / 4 + t));
}
function Lt(n, t, e, _, s, i, o, a, f, d, c, l, p, h, w, b, m, M, O) {
  let F = k(n, r.__wbindgen_malloc),
    ot = u,
    it = W(t, r.__wbindgen_malloc),
    at = u,
    x = r.decode_tiff_float_strip_range(
      F,
      ot,
      it,
      at,
      e,
      _,
      s,
      i,
      o,
      a,
      f,
      d,
      c,
      l,
      p,
      h,
      w,
      b,
      m,
      M,
      O
    );
  if (x[3]) throw g(x[2]);
  var ct = j(x[0], x[1]).slice();
  return (r.__wbindgen_free(x[0], x[1] * 4, 4), ct);
}
function P(n, t) {
  return ((n = n >>> 0), Tt().subarray(n / 8, n / 8 + t));
}
function Nt(n, t, e, _, s, i, o, a, f, d, c, l, p, h, w, b, m, M, O) {
  let F = k(n, r.__wbindgen_malloc),
    ot = u,
    it = W(t, r.__wbindgen_malloc),
    at = u,
    x = r.decode_tiff_strip_range_raw(
      F,
      ot,
      it,
      at,
      e,
      _,
      s,
      i,
      o,
      a,
      f,
      d,
      c,
      l,
      p,
      h,
      w,
      b,
      m,
      M,
      O
    );
  if (x[3]) throw g(x[2]);
  var ct = z(x[0], x[1]).slice();
  return (r.__wbindgen_free(x[0], x[1] * 1, 1), ct);
}
function Dt(n, t, e, _) {
  let s = k(n, r.__wbindgen_malloc),
    i = u,
    o = W(t, r.__wbindgen_malloc),
    a = u,
    f = W(e, r.__wbindgen_malloc),
    d = u,
    c = r.decode_exr_zip_f32_blocks(s, i, o, a, f, d, _);
  if (c[3]) throw g(c[2]);
  var l = z(c[0], c[1]).slice();
  return (r.__wbindgen_free(c[0], c[1] * 1, 1), l);
}
var ut =
    typeof FinalizationRegistry > 'u'
      ? { register: () => {}, unregister: () => {} }
      : new FinalizationRegistry(n => r.__wbg_decodedarray_free(n >>> 0, 1)),
  V = class n {
    static __wrap(t) {
      t = t >>> 0;
      let e = Object.create(n.prototype);
      return ((e.__wbg_ptr = t), ut.register(e, e.__wbg_ptr, e), e);
    }
    __destroy_into_raw() {
      let t = this.__wbg_ptr;
      return ((this.__wbg_ptr = 0), ut.unregister(this), t);
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
        return ((t = _[0]), (e = _[1]), y(_[0], _[1]));
      } finally {
        r.__wbindgen_free(t, e, 1);
      }
    }
    get metadata_json() {
      let t, e;
      try {
        let _ = r.decodedarray_metadata_json(this.__wbg_ptr);
        return ((t = _[0]), (e = _[1]), y(_[0], _[1]));
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
      if (t[3]) throw g(t[2]);
      var e = z(t[0], t[1]).slice();
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
      if (t[3]) throw g(t[2]);
      var e = j(t[0], t[1]).slice();
      return (r.__wbindgen_free(t[0], t[1] * 4, 4), e);
    }
    take_data_as_u16() {
      let t = r.decodedarray_take_data_as_u16(this.__wbg_ptr);
      if (t[3]) throw g(t[2]);
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
        return ((t = _[0]), (e = _[1]), y(_[0], _[1]));
      } finally {
        r.__wbindgen_free(t, e, 1);
      }
    }
    copy_data_as_u8_into(t) {
      let e = r.decodedarray_copy_data_as_u8_into(this.__wbg_ptr, t);
      if (e[1]) throw g(e[0]);
    }
    copy_data_as_f32_into(t) {
      let e = r.decodedarray_copy_data_as_f32_into(this.__wbg_ptr, t);
      if (e[1]) throw g(e[0]);
    }
    copy_data_as_u16_into(t) {
      let e = r.decodedarray_copy_data_as_u16_into(this.__wbg_ptr, t);
      if (e[1]) throw g(e[0]);
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
Symbol.dispose && (V.prototype[Symbol.dispose] = V.prototype.free);
var bt =
    typeof FinalizationRegistry > 'u'
      ? { register: () => {}, unregister: () => {} }
      : new FinalizationRegistry(n => r.__wbg_demosaicresult_free(n >>> 0, 1)),
  Y = class n {
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
      var e = j(t[0], t[1]).slice();
      return (r.__wbindgen_free(t[0], t[1] * 4, 4), e);
    }
  };
Symbol.dispose && (Y.prototype[Symbol.dispose] = Y.prototype.free);
var wt =
    typeof FinalizationRegistry > 'u'
      ? { register: () => {}, unregister: () => {} }
      : new FinalizationRegistry(n => r.__wbg_exrresult_free(n >>> 0, 1)),
  X = class n {
    static __wrap(t) {
      t = t >>> 0;
      let e = Object.create(n.prototype);
      return ((e.__wbg_ptr = t), wt.register(e, e.__wbg_ptr, e), e);
    }
    __destroy_into_raw() {
      let t = this.__wbg_ptr;
      return ((this.__wbg_ptr = 0), wt.unregister(this), t);
    }
    free() {
      let t = this.__destroy_into_raw();
      r.__wbg_exrresult_free(t, 0);
    }
    get all_tags_json() {
      let t, e;
      try {
        let _ = r.exrresult_all_tags_json(this.__wbg_ptr);
        return ((t = _[0]), (e = _[1]), y(_[0], _[1]));
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
      var e = j(t[0], t[1]).slice();
      return (r.__wbindgen_free(t[0], t[1] * 4, 4), e);
    }
    get channel_names_csv() {
      let t, e;
      try {
        let _ = r.exrresult_channel_names_csv(this.__wbg_ptr);
        return ((t = _[0]), (e = _[1]), y(_[0], _[1]));
      } finally {
        r.__wbindgen_free(t, e, 1);
      }
    }
    get displayed_channels_csv() {
      let t, e;
      try {
        let _ = r.exrresult_displayed_channels_csv(this.__wbg_ptr);
        return ((t = _[0]), (e = _[1]), y(_[0], _[1]));
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
Symbol.dispose && (X.prototype[Symbol.dispose] = X.prototype.free);
var ht =
    typeof FinalizationRegistry > 'u'
      ? { register: () => {}, unregister: () => {} }
      : new FinalizationRegistry(n => r.__wbg_exrzipplanjs_free(n >>> 0, 1)),
  q = class n {
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
      r.__wbg_exrzipplanjs_free(t, 0);
    }
    get channel_name() {
      let t, e;
      try {
        let _ = r.exrzipplanjs_channel_name(this.__wbg_ptr);
        return ((t = _[0]), (e = _[1]), y(_[0], _[1]));
      } finally {
        r.__wbindgen_free(t, e, 1);
      }
    }
    get all_tags_json() {
      let t, e;
      try {
        let _ = r.exrzipplanjs_all_tags_json(this.__wbg_ptr);
        return ((t = _[0]), (e = _[1]), y(_[0], _[1]));
      } finally {
        r.__wbindgen_free(t, e, 1);
      }
    }
    get y_coordinates() {
      let t = r.exrzipplanjs_y_coordinates(this.__wbg_ptr);
      var e = st(t[0], t[1]).slice();
      return (r.__wbindgen_free(t[0], t[1] * 4, 4), e);
    }
    take_compressed() {
      let t = r.exrzipplanjs_take_compressed(this.__wbg_ptr);
      var e = z(t[0], t[1]).slice();
      return (r.__wbindgen_free(t[0], t[1] * 1, 1), e);
    }
    get width() {
      return r.exrzipplanjs_width(this.__wbg_ptr) >>> 0;
    }
    get counts() {
      let t = r.exrzipplanjs_counts(this.__wbg_ptr);
      var e = Et(t[0], t[1]).slice();
      return (r.__wbindgen_free(t[0], t[1] * 4, 4), e);
    }
    get data_y() {
      return r.exrzipplanjs_data_y(this.__wbg_ptr);
    }
    get height() {
      return r.decodedarray_bits_per_sample(this.__wbg_ptr) >>> 0;
    }
  };
Symbol.dispose && (q.prototype[Symbol.dispose] = q.prototype.free);
var yt =
    typeof FinalizationRegistry > 'u'
      ? { register: () => {}, unregister: () => {} }
      : new FinalizationRegistry(n => r.__wbg_hdrresult_free(n >>> 0, 1)),
  G = class n {
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
      r.__wbg_hdrresult_free(t, 0);
    }
    get all_tags_json() {
      let t, e;
      try {
        let _ = r.hdrresult_all_tags_json(this.__wbg_ptr);
        return ((t = _[0]), (e = _[1]), y(_[0], _[1]));
      } finally {
        r.__wbindgen_free(t, e, 1);
      }
    }
    take_data_as_f32() {
      let t = r.hdrresult_take_data_as_f32(this.__wbg_ptr);
      var e = j(t[0], t[1]).slice();
      return (r.__wbindgen_free(t[0], t[1] * 4, 4), e);
    }
    take_metadata_as_f64() {
      let t = r.hdrresult_take_metadata_as_f64(this.__wbg_ptr);
      var e = P(t[0], t[1]).slice();
      return (r.__wbindgen_free(t[0], t[1] * 8, 8), e);
    }
    get channels() {
      return r.hdrresult_channels(this.__wbg_ptr) >>> 0;
    }
  };
Symbol.dispose && (G.prototype[Symbol.dispose] = G.prototype.free);
var mt =
    typeof FinalizationRegistry > 'u'
      ? { register: () => {}, unregister: () => {} }
      : new FinalizationRegistry(n => r.__wbg_histogramresult_free(n >>> 0, 1)),
  H = class n {
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
      var e = st(t[0], t[1]).slice();
      return (r.__wbindgen_free(t[0], t[1] * 4, 4), e);
    }
  };
Symbol.dispose && (H.prototype[Symbol.dispose] = H.prototype.free);
var xt =
    typeof FinalizationRegistry > 'u'
      ? { register: () => {}, unregister: () => {} }
      : new FinalizationRegistry(n => r.__wbg_imagestats_free(n >>> 0, 1)),
  J = class n {
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
Symbol.dispose && (J.prototype[Symbol.dispose] = J.prototype.free);
var vt =
    typeof FinalizationRegistry > 'u'
      ? { register: () => {}, unregister: () => {} }
      : new FinalizationRegistry(n => r.__wbg_jpegresult_free(n >>> 0, 1)),
  K = class n {
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
      r.__wbg_jpegresult_free(t, 0);
    }
    take_data_as_u8() {
      let t = r.jpegresult_take_data_as_u8(this.__wbg_ptr);
      var e = z(t[0], t[1]).slice();
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
Symbol.dispose && (K.prototype[Symbol.dispose] = K.prototype.free);
var jt =
    typeof FinalizationRegistry > 'u'
      ? { register: () => {}, unregister: () => {} }
      : new FinalizationRegistry(n => r.__wbg_labelresult_free(n >>> 0, 1)),
  Q = class n {
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
      r.__wbg_labelresult_free(t, 0);
    }
    take_labels_as_i32() {
      let t = r.labelresult_take_labels_as_i32(this.__wbg_ptr);
      if (t[3]) throw g(t[2]);
      var e = st(t[0], t[1]).slice();
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
Symbol.dispose && (Q.prototype[Symbol.dispose] = Q.prototype.free);
var kt =
    typeof FinalizationRegistry > 'u'
      ? { register: () => {}, unregister: () => {} }
      : new FinalizationRegistry(n => r.__wbg_pngresult_free(n >>> 0, 1)),
  Z = class n {
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
Symbol.dispose && (Z.prototype[Symbol.dispose] = Z.prototype.free);
var Ft =
    typeof FinalizationRegistry > 'u'
      ? { register: () => {}, unregister: () => {} }
      : new FinalizationRegistry(n => r.__wbg_rgbalayercompositor_free(n >>> 0, 1)),
  $ = class {
    __destroy_into_raw() {
      let t = this.__wbg_ptr;
      return ((this.__wbg_ptr = 0), Ft.unregister(this), t);
    }
    free() {
      let t = this.__destroy_into_raw();
      r.__wbg_rgbalayercompositor_free(t, 0);
    }
    get covered_count() {
      return r.exrzipplanjs_width(this.__wbg_ptr) >>> 0;
    }
    add_channels_i8(t, e, _, s, i, o, a, f, d) {
      let c = k(t, r.__wbindgen_malloc),
        l = u,
        p = r.rgbalayercompositor_add_channels_i8(this.__wbg_ptr, c, l, e, _, s, i, o, a, f, d);
      if (p[1]) throw g(p[0]);
    }
    add_channels_u8(t, e, _, s, i, o, a, f, d) {
      let c = k(t, r.__wbindgen_malloc),
        l = u,
        p = r.rgbalayercompositor_add_channels_u8(this.__wbg_ptr, c, l, e, _, s, i, o, a, f, d);
      if (p[1]) throw g(p[0]);
    }
    finish_isolated(t, e) {
      let _ = r.rgbalayercompositor_finish_isolated(this.__wbg_ptr, t, e);
      if (_[1]) throw g(_[0]);
    }
    add_channels_f32(t, e, _, s, i, o, a, f, d) {
      let c = v(t, r.__wbindgen_malloc),
        l = u,
        p = r.rgbalayercompositor_add_channels_f32(this.__wbg_ptr, c, l, e, _, s, i, o, a, f, d);
      if (p[1]) throw g(p[0]);
    }
    add_channels_f64(t, e, _, s, i, o, a, f, d) {
      let c = Xt(t, r.__wbindgen_malloc),
        l = u,
        p = r.rgbalayercompositor_add_channels_f64(this.__wbg_ptr, c, l, e, _, s, i, o, a, f, d);
      if (p[1]) throw g(p[0]);
    }
    add_channels_i16(t, e, _, s, i, o, a, f, d) {
      let c = A(t, r.__wbindgen_malloc),
        l = u,
        p = r.rgbalayercompositor_add_channels_i16(this.__wbg_ptr, c, l, e, _, s, i, o, a, f, d);
      if (p[1]) throw g(p[0]);
    }
    add_channels_i32(t, e, _, s, i, o, a, f, d) {
      let c = W(t, r.__wbindgen_malloc),
        l = u,
        p = r.rgbalayercompositor_add_channels_i32(this.__wbg_ptr, c, l, e, _, s, i, o, a, f, d);
      if (p[1]) throw g(p[0]);
    }
    add_channels_u16(t, e, _, s, i, o, a, f, d) {
      let c = A(t, r.__wbindgen_malloc),
        l = u,
        p = r.rgbalayercompositor_add_channels_u16(this.__wbg_ptr, c, l, e, _, s, i, o, a, f, d);
      if (p[1]) throw g(p[0]);
    }
    add_channels_u32(t, e, _, s, i, o, a, f, d) {
      let c = W(t, r.__wbindgen_malloc),
        l = u,
        p = r.rgbalayercompositor_add_channels_u32(this.__wbg_ptr, c, l, e, _, s, i, o, a, f, d);
      if (p[1]) throw g(p[0]);
    }
    begin_isolated_u8(t, e, _, s, i) {
      let o = k(t, r.__wbindgen_malloc),
        a = u,
        f = r.rgbalayercompositor_begin_isolated_u8(this.__wbg_ptr, o, a, e, _, s, i);
      if (f[1]) throw g(f[0]);
    }
    begin_isolated_f32(t, e, _, s, i, o) {
      let a = v(t, r.__wbindgen_malloc),
        f = u,
        d = r.rgbalayercompositor_begin_isolated_f32(this.__wbg_ptr, a, f, e, _, s, i, o);
      if (d[1]) throw g(d[0]);
    }
    begin_isolated_u16(t, e, _, s, i, o) {
      let a = A(t, r.__wbindgen_malloc),
        f = u,
        d = r.rgbalayercompositor_begin_isolated_u16(this.__wbg_ptr, a, f, e, _, s, i, o);
      if (d[1]) throw g(d[0]);
    }
    isolated_apply_hue(t, e, _, s, i) {
      let o = r.rgbalayercompositor_isolated_apply_hue(this.__wbg_ptr, t, e, _, s, i);
      if (o[1]) throw g(o[0]);
    }
    isolated_apply_lut(t, e) {
      let _ = v(t, r.__wbindgen_malloc),
        s = u,
        i = r.rgbalayercompositor_isolated_apply_lut(this.__wbg_ptr, _, s, e);
      if (i[1]) throw g(i[0]);
    }
    isolated_apply_direct(t, e, _) {
      let s = v(e, r.__wbindgen_malloc),
        i = u,
        o = r.rgbalayercompositor_isolated_apply_direct(this.__wbg_ptr, t, s, i, _);
      if (o[1]) throw g(o[0]);
    }
    take_data_as_channels(t) {
      let e = r.rgbalayercompositor_take_data_as_channels(this.__wbg_ptr, t);
      if (e[3]) throw g(e[2]);
      var _ = j(e[0], e[1]).slice();
      return (r.__wbindgen_free(e[0], e[1] * 4, 4), _);
    }
    take_isolated_surface() {
      let t = r.rgbalayercompositor_take_isolated_surface(this.__wbg_ptr);
      if (t[3]) throw g(t[2]);
      var e = j(t[0], t[1]).slice();
      return (r.__wbindgen_free(t[0], t[1] * 4, 4), e);
    }
    isolated_add_f32_surface(t, e, _, s) {
      let i = v(t, r.__wbindgen_malloc),
        o = u,
        a = r.rgbalayercompositor_isolated_add_f32_surface(this.__wbg_ptr, i, o, e, _, s);
      if (a[1]) throw g(a[0]);
    }
    add_arithmetic_f32_surface(t, e, _, s) {
      let i = v(t, r.__wbindgen_malloc),
        o = u,
        a = r.rgbalayercompositor_add_arithmetic_f32_surface(this.__wbg_ptr, i, o, e, _, s);
      if (a[1]) throw g(a[0]);
    }
    isolated_apply_alpha_mask_u8(t, e, _, s, i, o, a, f) {
      let d = k(t, r.__wbindgen_malloc),
        c = u,
        l = r.rgbalayercompositor_isolated_apply_alpha_mask_u8(
          this.__wbg_ptr,
          d,
          c,
          e,
          _,
          s,
          i,
          o,
          a,
          f
        );
      if (l[1]) throw g(l[0]);
    }
    isolated_apply_selective_hue(t, e) {
      let _ = v(t, r.__wbindgen_malloc),
        s = u,
        i = r.rgbalayercompositor_isolated_apply_selective_hue(this.__wbg_ptr, _, s, e);
      if (i[1]) throw g(i[0]);
    }
    isolated_apply_alpha_mask_f32(t, e, _, s, i, o, a, f) {
      let d = v(t, r.__wbindgen_malloc),
        c = u,
        l = r.rgbalayercompositor_isolated_apply_alpha_mask_f32(
          this.__wbg_ptr,
          d,
          c,
          e,
          _,
          s,
          i,
          o,
          a,
          f
        );
      if (l[1]) throw g(l[0]);
    }
    isolated_apply_alpha_mask_u16(t, e, _, s, i, o, a, f) {
      let d = A(t, r.__wbindgen_malloc),
        c = u,
        l = r.rgbalayercompositor_isolated_apply_alpha_mask_u16(
          this.__wbg_ptr,
          d,
          c,
          e,
          _,
          s,
          i,
          o,
          a,
          f
        );
      if (l[1]) throw g(l[0]);
    }
    isolated_begin_masked_adjustment() {
      let t = r.rgbalayercompositor_isolated_begin_masked_adjustment(this.__wbg_ptr);
      if (t[1]) throw g(t[0]);
    }
    apply_brightness_mask_f32_surface(t, e, _, s) {
      let i = v(t, r.__wbindgen_malloc),
        o = u,
        a = r.rgbalayercompositor_apply_brightness_mask_f32_surface(this.__wbg_ptr, i, o, e, _, s);
      if (a[1]) throw g(a[0]);
    }
    isolated_add_arithmetic_f32_surface(t, e, _, s) {
      let i = v(t, r.__wbindgen_malloc),
        o = u,
        a = r.rgbalayercompositor_isolated_add_arithmetic_f32_surface(
          this.__wbg_ptr,
          i,
          o,
          e,
          _,
          s
        );
      if (a[1]) throw g(a[0]);
    }
    isolated_finish_masked_adjustment_u8(t, e, _, s, i, o, a, f) {
      let d = k(t, r.__wbindgen_malloc),
        c = u,
        l = r.rgbalayercompositor_isolated_finish_masked_adjustment_u8(
          this.__wbg_ptr,
          d,
          c,
          e,
          _,
          s,
          i,
          o,
          a,
          f
        );
      if (l[1]) throw g(l[0]);
    }
    isolated_finish_masked_adjustment_f32(t, e, _, s, i, o, a, f) {
      let d = v(t, r.__wbindgen_malloc),
        c = u,
        l = r.rgbalayercompositor_isolated_finish_masked_adjustment_f32(
          this.__wbg_ptr,
          d,
          c,
          e,
          _,
          s,
          i,
          o,
          a,
          f
        );
      if (l[1]) throw g(l[0]);
    }
    isolated_finish_masked_adjustment_u16(t, e, _, s, i, o, a, f) {
      let d = A(t, r.__wbindgen_malloc),
        c = u,
        l = r.rgbalayercompositor_isolated_finish_masked_adjustment_u16(
          this.__wbg_ptr,
          d,
          c,
          e,
          _,
          s,
          i,
          o,
          a,
          f
        );
      if (l[1]) throw g(l[0]);
    }
    constructor(t, e, _) {
      let s = r.rgbalayercompositor_new(t, e, _);
      if (s[2]) throw g(s[1]);
      return ((this.__wbg_ptr = s[0] >>> 0), Ft.register(this, this.__wbg_ptr, this), this);
    }
    add_u8(t, e, _, s, i, o, a) {
      let f = k(t, r.__wbindgen_malloc),
        d = u,
        c = r.rgbalayercompositor_add_u8(this.__wbg_ptr, f, d, e, _, s, i, o, a);
      if (c[1]) throw g(c[0]);
    }
    add_f32(t, e, _, s, i, o, a, f) {
      let d = v(t, r.__wbindgen_malloc),
        c = u,
        l = r.rgbalayercompositor_add_f32(this.__wbg_ptr, d, c, e, _, s, i, o, a, f);
      if (l[1]) throw g(l[0]);
    }
    add_u16(t, e, _, s, i, o, a, f) {
      let d = A(t, r.__wbindgen_malloc),
        c = u,
        l = r.rgbalayercompositor_add_u16(this.__wbg_ptr, d, c, e, _, s, i, o, a, f);
      if (l[1]) throw g(l[0]);
    }
    get max_value() {
      return r.rgbalayercompositor_max_value(this.__wbg_ptr);
    }
    get min_value() {
      return r.rgbalayercompositor_min_value(this.__wbg_ptr);
    }
    take_data() {
      let t = r.rgbalayercompositor_take_data(this.__wbg_ptr);
      var e = j(t[0], t[1]).slice();
      return (r.__wbindgen_free(t[0], t[1] * 4, 4), e);
    }
  };
Symbol.dispose && ($.prototype[Symbol.dispose] = $.prototype.free);
var zt =
    typeof FinalizationRegistry > 'u'
      ? { register: () => {}, unregister: () => {} }
      : new FinalizationRegistry(n => r.__wbg_stabilitycurveresult_free(n >>> 0, 1)),
  tt = class n {
    static __wrap(t) {
      t = t >>> 0;
      let e = Object.create(n.prototype);
      return ((e.__wbg_ptr = t), zt.register(e, e.__wbg_ptr, e), e);
    }
    __destroy_into_raw() {
      let t = this.__wbg_ptr;
      return ((this.__wbg_ptr = 0), zt.unregister(this), t);
    }
    free() {
      let t = this.__destroy_into_raw();
      r.__wbg_stabilitycurveresult_free(t, 0);
    }
    get object_counts() {
      let t = r.stabilitycurveresult_object_counts(this.__wbg_ptr);
      var e = Et(t[0], t[1]).slice();
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
      var e = P(t[0], t[1]).slice();
      return (r.__wbindgen_free(t[0], t[1] * 8, 8), e);
    }
    get bins() {
      let t = r.stabilitycurveresult_bins(this.__wbg_ptr);
      var e = st(t[0], t[1]).slice();
      return (r.__wbindgen_free(t[0], t[1] * 4, 4), e);
    }
    get values() {
      let t = r.stabilitycurveresult_values(this.__wbg_ptr);
      var e = P(t[0], t[1]).slice();
      return (r.__wbindgen_free(t[0], t[1] * 8, 8), e);
    }
  };
Symbol.dispose && (tt.prototype[Symbol.dispose] = tt.prototype.free);
var St =
    typeof FinalizationRegistry > 'u'
      ? { register: () => {}, unregister: () => {} }
      : new FinalizationRegistry(n => r.__wbg_tifffloatstripplanjs_free(n >>> 0, 1)),
  et = class n {
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
      var e = P(t[0], t[1]).slice();
      return (r.__wbindgen_free(t[0], t[1] * 8, 8), e);
    }
    get height() {
      return r.tifffloatstripplanjs_height(this.__wbg_ptr) >>> 0;
    }
    get offsets() {
      let t = r.tifffloatstripplanjs_offsets(this.__wbg_ptr);
      var e = P(t[0], t[1]).slice();
      return (r.__wbindgen_free(t[0], t[1] * 8, 8), e);
    }
    get channels() {
      return r.tifffloatstripplanjs_channels(this.__wbg_ptr) >>> 0;
    }
    get predictor() {
      return r.tifffloatstripplanjs_predictor(this.__wbg_ptr) >>> 0;
    }
  };
Symbol.dispose && (et.prototype[Symbol.dispose] = et.prototype.free);
var At =
    typeof FinalizationRegistry > 'u'
      ? { register: () => {}, unregister: () => {} }
      : new FinalizationRegistry(n => r.__wbg_tiffregiondecoder_free(n >>> 0, 1)),
  rt = class {
    __destroy_into_raw() {
      let t = this.__wbg_ptr;
      return ((this.__wbg_ptr = 0), At.unregister(this), t);
    }
    free() {
      let t = this.__destroy_into_raw();
      r.__wbg_tiffregiondecoder_free(t, 0);
    }
    constructor(t) {
      let e = k(t, r.__wbindgen_malloc),
        _ = u,
        s = r.tiffregiondecoder_new(e, _);
      return ((this.__wbg_ptr = s >>> 0), At.register(this, this.__wbg_ptr, this), this);
    }
    decode(t, e, _, s, i) {
      let o = r.tiffregiondecoder_decode(this.__wbg_ptr, t, e, _, s, i);
      if (o[2]) throw g(o[1]);
      return C.__wrap(o[0]);
    }
  };
Symbol.dispose && (rt.prototype[Symbol.dispose] = rt.prototype.free);
var Rt =
    typeof FinalizationRegistry > 'u'
      ? { register: () => {}, unregister: () => {} }
      : new FinalizationRegistry(n => r.__wbg_tiffregionjs_free(n >>> 0, 1)),
  C = class n {
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
      var e = j(t[0], t[1]).slice();
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
Symbol.dispose && (C.prototype[Symbol.dispose] = C.prototype.free);
var Wt =
    typeof FinalizationRegistry > 'u'
      ? { register: () => {}, unregister: () => {} }
      : new FinalizationRegistry(n => r.__wbg_tiffresult_free(n >>> 0, 1)),
  _t = class n {
    static __wrap(t) {
      t = t >>> 0;
      let e = Object.create(n.prototype);
      return ((e.__wbg_ptr = t), Wt.register(e, e.__wbg_ptr, e), e);
    }
    __destroy_into_raw() {
      let t = this.__wbg_ptr;
      return ((this.__wbg_ptr = 0), Wt.unregister(this), t);
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
        return ((t = _[0]), (e = _[1]), y(_[0], _[1]));
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
      var e = z(t[0], t[1]).slice();
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
      var e = j(t[0], t[1]).slice();
      return (r.__wbindgen_free(t[0], t[1] * 4, 4), e);
    }
    take_data_as_u8() {
      let t = r.tiffresult_take_data_as_u8(this.__wbg_ptr);
      var e = z(t[0], t[1]).slice();
      return (r.__wbindgen_free(t[0], t[1] * 1, 1), e);
    }
    get timing_stats_ms() {
      return r.tiffresult_timing_stats_ms(this.__wbg_ptr);
    }
    take_data_as_f32() {
      let t = r.tiffresult_take_data_as_f32(this.__wbg_ptr);
      var e = j(t[0], t[1]).slice();
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
        return ((t = _[0]), (e = _[1]), y(_[0], _[1]));
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
        return ((t = _[0]), (e = _[1]), y(_[0], _[1]));
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
        return ((t = _[0]), (e = _[1]), y(_[0], _[1]));
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
Symbol.dispose && (_t.prototype[Symbol.dispose] = _t.prototype.free);
var Mt =
    typeof FinalizationRegistry > 'u'
      ? { register: () => {}, unregister: () => {} }
      : new FinalizationRegistry(n => r.__wbg_tiffstripmetadatajs_free(n >>> 0, 1)),
  nt = class n {
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
      r.__wbg_tiffstripmetadatajs_free(t, 0);
    }
    get page_count() {
      return r.exrresult_height(this.__wbg_ptr) >>> 0;
    }
    get all_tags_json() {
      let t, e;
      try {
        let _ = r.tiffstripmetadatajs_all_tags_json(this.__wbg_ptr);
        return ((t = _[0]), (e = _[1]), y(_[0], _[1]));
      } finally {
        r.__wbindgen_free(t, e, 1);
      }
    }
    get page_directory_json() {
      let t, e;
      try {
        let _ = r.tiffstripmetadatajs_page_directory_json(this.__wbg_ptr);
        return ((t = _[0]), (e = _[1]), y(_[0], _[1]));
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
        return ((t = _[0]), (e = _[1]), y(_[0], _[1]));
      } finally {
        r.__wbindgen_free(t, e, 1);
      }
    }
    get geo_json() {
      let t, e;
      try {
        let _ = r.tiffstripmetadatajs_geo_json(this.__wbg_ptr);
        return ((t = _[0]), (e = _[1]), y(_[0], _[1]));
      } finally {
        r.__wbindgen_free(t, e, 1);
      }
    }
  };
Symbol.dispose && (nt.prototype[Symbol.dispose] = nt.prototype.free);
var Gt = new Set(['basic', 'cors', 'default']);
async function Ht(n, t) {
  if (typeof Response == 'function' && n instanceof Response) {
    if (typeof WebAssembly.instantiateStreaming == 'function')
      try {
        return await WebAssembly.instantiateStreaming(n, t);
      } catch (_) {
        if (n.ok && Gt.has(n.type) && n.headers.get('Content-Type') !== 'application/wasm')
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
function Jt() {
  let n = {};
  return (
    (n.wbg = {}),
    (n.wbg.__wbg___wbindgen_throw_b855445ff6a94295 = function (t, e) {
      throw new Error(y(t, e));
    }),
    (n.wbg.__wbg_error_7534b8e9a36f1ab4 = function (t, e) {
      let _, s;
      try {
        ((_ = t), (s = e), console.error(y(t, e)));
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
      t.set(z(e, _));
    }),
    (n.wbg.__wbg_set_eaa55bcb7597ecca = function (t, e, _) {
      t.set(j(e, _));
    }),
    (n.wbg.__wbg_stack_0ed75d68575b0f3c = function (t, e) {
      let _ = e.stack,
        s = Yt(_, r.__wbindgen_malloc, r.__wbindgen_realloc),
        i = u;
      (gt().setInt32(t + 4, i, !0), gt().setInt32(t + 0, s, !0));
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
      return y(t, e);
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
function Kt(n, t) {
  return (
    (r = n.exports),
    (Pt.__wbindgen_wasm_module = t),
    (S = null),
    (U = null),
    (E = null),
    (N = null),
    (T = null),
    (L = null),
    (I = null),
    r.__wbindgen_start(),
    r
  );
}
async function Pt(n) {
  if (r !== void 0) return r;
  (typeof n < 'u' &&
    (Object.getPrototypeOf(n) === Object.prototype
      ? ({ module_or_path: n } = n)
      : console.warn(
          'using deprecated parameters for the initialization function; pass a single object instead'
        )),
    typeof n > 'u' && (n = new URL('wasm/tiff-wasm.wasm', import.meta.url)));
  let t = Jt();
  (typeof n == 'string' ||
    (typeof Request == 'function' && n instanceof Request) ||
    (typeof URL == 'function' && n instanceof URL)) &&
    (n = fetch(n));
  let { instance: e, module: _ } = await Ht(await n, t);
  return Kt(e, _);
}
var Ct = Pt;
function ft(n, t, e, _, s, i) {
  if (i === 1) return { samples: n, transposed: !1, destinationStart: s, bandWidth: t };
  let o = n.length / (t * _),
    a = i >= 5 && i <= 8,
    f = a ? (i === 6 || i === 7 ? e - s - o : s) : i === 3 || i === 4 ? e - s - o : s,
    d = new n.constructor(n.length);
  for (let c = 0; c < o; c++) {
    let l = s + c;
    for (let p = 0; p < t; p++) {
      let h, w;
      switch (i) {
        case 2:
          ((h = t - 1 - p), (w = l));
          break;
        case 3:
          ((h = t - 1 - p), (w = e - 1 - l));
          break;
        case 4:
          ((h = p), (w = e - 1 - l));
          break;
        case 5:
          ((h = l), (w = p));
          break;
        case 6:
          ((h = e - 1 - l), (w = p));
          break;
        case 7:
          ((h = e - 1 - l), (w = t - 1 - p));
          break;
        case 8:
          ((h = l), (w = t - 1 - p));
          break;
        default:
          ((h = p), (w = l));
      }
      let b = a ? h - f : h,
        m = a ? w : w - f,
        M = (c * t + p) * _,
        O = a ? (m * o + b) * _ : (m * t + b) * _;
      for (let F = 0; F < _; F++) d[O + F] = n[M + F];
    }
  }
  return { samples: d, transposed: a, destinationStart: f, bandWidth: a ? o : t };
}
var pt = null;
self.onmessage = async n => {
  let t = n.data;
  if (t?.type === 'init') {
    try {
      ((pt = Ct({ module_or_path: t.tiffWasmModule || t.tiffWasmBuffer })),
        await pt,
        self.postMessage({ type: 'ready' }));
    } catch (_) {
      self.postMessage({ type: 'ready', error: String(_?.message || _) });
    }
    return;
  }
  let e = t;
  try {
    await pt;
    let _ = performance.now();
    if (e.kind === 'exr-zip') {
      let d = Dt(
          new Uint8Array(e.blob),
          new Uint32Array(e.counts),
          new Uint32Array(e.rows),
          e.width
        ),
        c = new Float32Array(d.buffer, d.byteOffset, d.byteLength / 4),
        l = 1 / 0,
        p = -1 / 0,
        h = !1;
      for (let w = 0; w < c.length; w++) {
        let b = c[w];
        (b < l && (l = b), b > p && (p = b), Number.isFinite(b) || (h = !0));
      }
      if (h || !Number.isFinite(l) || !Number.isFinite(p)) {
        ((l = 1 / 0), (p = -1 / 0));
        for (let w = 0; w < c.length; w++) {
          let b = c[w];
          Number.isFinite(b) && (b < l && (l = b), b > p && (p = b));
        }
      }
      self.postMessage({ id: e.id, samples: c, min: l, max: p, ms: performance.now() - _ }, [
        d.buffer,
      ]);
      return;
    }
    if (e.raw) {
      let d = Nt(
          new Uint8Array(e.blob),
          new Uint32Array(e.counts),
          e.firstStrip,
          e.width,
          e.height,
          e.channels,
          e.bitsPerSample,
          e.compression,
          e.rowsPerStrip,
          e.predictor,
          e.sampleFormat,
          e.littleEndian,
          e.planarConfiguration || 1,
          e.orientation || 1,
          e.tileWidth || 0,
          e.tileLength || 0,
          e.blocksAcross || 1,
          e.lercAdditionalCompression || 0,
          e.photometricInterpretation || 1
        ),
        c =
          e.bitsPerSample === 8
            ? d
            : e.sampleFormat === 3
              ? new Float32Array(d.buffer, d.byteOffset, d.byteLength / 4)
              : new Uint16Array(d.buffer, d.byteOffset, d.byteLength / 2),
        l = 1 / 0,
        p = -1 / 0,
        h = !1;
      for (let b = 0; b < c.length; b++) {
        let m = c[b];
        (m < l && (l = m), m > p && (p = m), m !== m && (h = !0));
      }
      if (h || !Number.isFinite(l) || !Number.isFinite(p)) {
        ((l = 1 / 0), (p = -1 / 0));
        for (let b = 0; b < c.length; b++) {
          let m = c[b];
          Number.isFinite(m) && (m < l && (l = m), m > p && (p = m));
        }
      }
      let w = ft(
        c,
        e.width,
        e.height,
        e.outputChannels || e.channels,
        e.firstStrip * e.rowsPerStrip,
        e.orientation || 1
      );
      self.postMessage({ id: e.id, ...w, min: l, max: p, ms: performance.now() - _ }, [
        w.samples.buffer,
      ]);
      return;
    }
    let s = Lt(
        new Uint8Array(e.blob),
        new Uint32Array(e.counts),
        e.firstStrip,
        e.width,
        e.height,
        e.channels,
        e.bitsPerSample,
        e.compression,
        e.rowsPerStrip,
        e.predictor,
        e.sampleFormat,
        e.littleEndian,
        e.planarConfiguration || 1,
        e.orientation || 1,
        e.tileWidth || 0,
        e.tileLength || 0,
        e.blocksAcross || 1,
        e.lercAdditionalCompression || 0,
        e.photometricInterpretation || 1
      ),
      i = 1 / 0,
      o = -1 / 0,
      a = !1;
    for (let d = 0; d < s.length; d++) {
      let c = s[d];
      (c < i && (i = c), c > o && (o = c), c !== c && (a = !0));
    }
    if (a || !Number.isFinite(i) || !Number.isFinite(o)) {
      ((i = 1 / 0), (o = -1 / 0));
      for (let d = 0; d < s.length; d++) {
        let c = s[d];
        Number.isFinite(c) && (c < i && (i = c), c > o && (o = c));
      }
    }
    let f = ft(
      s,
      e.width,
      e.height,
      e.outputChannels || e.channels,
      e.firstStrip * e.rowsPerStrip,
      e.orientation || 1
    );
    self.postMessage({ id: e.id, ...f, min: i, max: o, ms: performance.now() - _ }, [
      f.samples.buffer,
    ]);
  } catch (_) {
    self.postMessage({ id: e.id, error: String(_?.message || _) });
  }
};
