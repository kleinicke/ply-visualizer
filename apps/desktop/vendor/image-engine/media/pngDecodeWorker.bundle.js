var r,
  k = null;
function v() {
  return ((k === null || k.byteLength === 0) && (k = new Uint8Array(r.memory.buffer)), k);
}
var T = new TextDecoder('utf-8', { ignoreBOM: !0, fatal: !0 });
T.decode();
var At = 2146435072,
  K = 0;
function St(n, t) {
  return (
    (K += t),
    K >= At && ((T = new TextDecoder('utf-8', { ignoreBOM: !0, fatal: !0 })), T.decode(), (K = t)),
    T.decode(v().subarray(n, n + t))
  );
}
function w(n, t) {
  return ((n = n >>> 0), St(n, t));
}
var z = null;
function ht() {
  return ((z === null || z.byteLength === 0) && (z = new Uint16Array(r.memory.buffer)), z);
}
function Q(n, t) {
  return ((n = n >>> 0), ht().subarray(n / 2, n / 2 + t));
}
function j(n, t) {
  return ((n = n >>> 0), v().subarray(n / 1, n / 1 + t));
}
var F = null;
function yt() {
  return ((F === null || F.byteLength === 0) && (F = new Float32Array(r.memory.buffer)), F);
}
function h(n, t) {
  return ((n = n >>> 0), yt().subarray(n / 4, n / 4 + t));
}
var p = 0,
  W = new TextEncoder();
'encodeInto' in W ||
  (W.encodeInto = function (n, t) {
    let e = W.encode(n);
    return (t.set(e), { read: n.length, written: e.length });
  });
function Rt(n, t, e) {
  if (e === void 0) {
    let a = W.encode(n),
      c = t(a.length, 1) >>> 0;
    return (
      v()
        .subarray(c, c + a.length)
        .set(a),
      (p = a.length),
      c
    );
  }
  let _ = n.length,
    s = t(_, 1) >>> 0,
    o = v(),
    i = 0;
  for (; i < _; i++) {
    let a = n.charCodeAt(i);
    if (a > 127) break;
    o[s + i] = a;
  }
  if (i !== _) {
    (i !== 0 && (n = n.slice(i)), (s = e(s, _, (_ = i + n.length * 3), 1) >>> 0));
    let a = v().subarray(s + i, s + _),
      c = W.encodeInto(n, a);
    ((i += c.written), (s = e(s, _, i, 1) >>> 0));
  }
  return ((p = i), s);
}
var m = null;
function Z() {
  return (
    (m === null ||
      m.buffer.detached === !0 ||
      (m.buffer.detached === void 0 && m.buffer !== r.memory.buffer)) &&
      (m = new DataView(r.memory.buffer)),
    m
  );
}
function y(n, t) {
  let e = t(n.length * 1, 1) >>> 0;
  return (v().set(n, e / 1), (p = n.length), e);
}
function l(n) {
  let t = r.__wbindgen_externrefs.get(n);
  return (r.__externref_table_dealloc(n), t);
}
function b(n, t) {
  let e = t(n.length * 4, 4) >>> 0;
  return (yt().set(n, e / 4), (p = n.length), e);
}
var A = null;
function mt() {
  return ((A === null || A.byteLength === 0) && (A = new Float64Array(r.memory.buffer)), A);
}
function Wt(n, t) {
  let e = t(n.length * 8, 8) >>> 0;
  return (mt().set(n, e / 8), (p = n.length), e);
}
function x(n, t) {
  let e = t(n.length * 2, 2) >>> 0;
  return (ht().set(n, e / 2), (p = n.length), e);
}
var S = null;
function xt() {
  return ((S === null || S.byteLength === 0) && (S = new Uint32Array(r.memory.buffer)), S);
}
function tt(n, t) {
  let e = t(n.length * 4, 4) >>> 0;
  return (xt().set(n, e / 4), (p = n.length), e);
}
var R = null;
function Mt() {
  return ((R === null || R.byteLength === 0) && (R = new Int32Array(r.memory.buffer)), R);
}
function J(n, t) {
  return ((n = n >>> 0), Mt().subarray(n / 4, n / 4 + t));
}
function vt(n, t) {
  return ((n = n >>> 0), xt().subarray(n / 4, n / 4 + t));
}
function M(n, t) {
  return ((n = n >>> 0), mt().subarray(n / 8, n / 8 + t));
}
function jt(n) {
  let t = y(n, r.__wbindgen_malloc),
    e = p,
    _ = r.decode_png16_fast(t, e);
  if (_[2]) throw l(_[1]);
  return O.__wrap(_[0]);
}
var et =
    typeof FinalizationRegistry > 'u'
      ? { register: () => {}, unregister: () => {} }
      : new FinalizationRegistry(n => r.__wbg_decodedarray_free(n >>> 0, 1)),
  U = class n {
    static __wrap(t) {
      t = t >>> 0;
      let e = Object.create(n.prototype);
      return ((e.__wbg_ptr = t), et.register(e, e.__wbg_ptr, e), e);
    }
    __destroy_into_raw() {
      let t = this.__wbg_ptr;
      return ((this.__wbg_ptr = 0), et.unregister(this), t);
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
        return ((t = _[0]), (e = _[1]), w(_[0], _[1]));
      } finally {
        r.__wbindgen_free(t, e, 1);
      }
    }
    get metadata_json() {
      let t, e;
      try {
        let _ = r.decodedarray_metadata_json(this.__wbg_ptr);
        return ((t = _[0]), (e = _[1]), w(_[0], _[1]));
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
      if (t[3]) throw l(t[2]);
      var e = j(t[0], t[1]).slice();
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
      if (t[3]) throw l(t[2]);
      var e = h(t[0], t[1]).slice();
      return (r.__wbindgen_free(t[0], t[1] * 4, 4), e);
    }
    take_data_as_u16() {
      let t = r.decodedarray_take_data_as_u16(this.__wbg_ptr);
      if (t[3]) throw l(t[2]);
      var e = Q(t[0], t[1]).slice();
      return (r.__wbindgen_free(t[0], t[1] * 2, 2), e);
    }
    get source_data_offset() {
      return r.decodedarray_source_data_offset(this.__wbg_ptr) >>> 0;
    }
    get source_numeric_type() {
      let t, e;
      try {
        let _ = r.decodedarray_source_numeric_type(this.__wbg_ptr);
        return ((t = _[0]), (e = _[1]), w(_[0], _[1]));
      } finally {
        r.__wbindgen_free(t, e, 1);
      }
    }
    copy_data_as_u8_into(t) {
      let e = r.decodedarray_copy_data_as_u8_into(this.__wbg_ptr, t);
      if (e[1]) throw l(e[0]);
    }
    copy_data_as_f32_into(t) {
      let e = r.decodedarray_copy_data_as_f32_into(this.__wbg_ptr, t);
      if (e[1]) throw l(e[0]);
    }
    copy_data_as_u16_into(t) {
      let e = r.decodedarray_copy_data_as_u16_into(this.__wbg_ptr, t);
      if (e[1]) throw l(e[0]);
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
Symbol.dispose && (U.prototype[Symbol.dispose] = U.prototype.free);
var rt =
    typeof FinalizationRegistry > 'u'
      ? { register: () => {}, unregister: () => {} }
      : new FinalizationRegistry(n => r.__wbg_demosaicresult_free(n >>> 0, 1)),
  D = class n {
    static __wrap(t) {
      t = t >>> 0;
      let e = Object.create(n.prototype);
      return ((e.__wbg_ptr = t), rt.register(e, e.__wbg_ptr, e), e);
    }
    __destroy_into_raw() {
      let t = this.__wbg_ptr;
      return ((this.__wbg_ptr = 0), rt.unregister(this), t);
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
      var e = h(t[0], t[1]).slice();
      return (r.__wbindgen_free(t[0], t[1] * 4, 4), e);
    }
  };
Symbol.dispose && (D.prototype[Symbol.dispose] = D.prototype.free);
var _t =
    typeof FinalizationRegistry > 'u'
      ? { register: () => {}, unregister: () => {} }
      : new FinalizationRegistry(n => r.__wbg_exrresult_free(n >>> 0, 1)),
  I = class n {
    static __wrap(t) {
      t = t >>> 0;
      let e = Object.create(n.prototype);
      return ((e.__wbg_ptr = t), _t.register(e, e.__wbg_ptr, e), e);
    }
    __destroy_into_raw() {
      let t = this.__wbg_ptr;
      return ((this.__wbg_ptr = 0), _t.unregister(this), t);
    }
    free() {
      let t = this.__destroy_into_raw();
      r.__wbg_exrresult_free(t, 0);
    }
    get all_tags_json() {
      let t, e;
      try {
        let _ = r.exrresult_all_tags_json(this.__wbg_ptr);
        return ((t = _[0]), (e = _[1]), w(_[0], _[1]));
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
      var e = h(t[0], t[1]).slice();
      return (r.__wbindgen_free(t[0], t[1] * 4, 4), e);
    }
    get channel_names_csv() {
      let t, e;
      try {
        let _ = r.exrresult_channel_names_csv(this.__wbg_ptr);
        return ((t = _[0]), (e = _[1]), w(_[0], _[1]));
      } finally {
        r.__wbindgen_free(t, e, 1);
      }
    }
    get displayed_channels_csv() {
      let t, e;
      try {
        let _ = r.exrresult_displayed_channels_csv(this.__wbg_ptr);
        return ((t = _[0]), (e = _[1]), w(_[0], _[1]));
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
Symbol.dispose && (I.prototype[Symbol.dispose] = I.prototype.free);
var nt =
    typeof FinalizationRegistry > 'u'
      ? { register: () => {}, unregister: () => {} }
      : new FinalizationRegistry(n => r.__wbg_exrzipplanjs_free(n >>> 0, 1)),
  B = class n {
    static __wrap(t) {
      t = t >>> 0;
      let e = Object.create(n.prototype);
      return ((e.__wbg_ptr = t), nt.register(e, e.__wbg_ptr, e), e);
    }
    __destroy_into_raw() {
      let t = this.__wbg_ptr;
      return ((this.__wbg_ptr = 0), nt.unregister(this), t);
    }
    free() {
      let t = this.__destroy_into_raw();
      r.__wbg_exrzipplanjs_free(t, 0);
    }
    get channel_name() {
      let t, e;
      try {
        let _ = r.exrzipplanjs_channel_name(this.__wbg_ptr);
        return ((t = _[0]), (e = _[1]), w(_[0], _[1]));
      } finally {
        r.__wbindgen_free(t, e, 1);
      }
    }
    get all_tags_json() {
      let t, e;
      try {
        let _ = r.exrzipplanjs_all_tags_json(this.__wbg_ptr);
        return ((t = _[0]), (e = _[1]), w(_[0], _[1]));
      } finally {
        r.__wbindgen_free(t, e, 1);
      }
    }
    get y_coordinates() {
      let t = r.exrzipplanjs_y_coordinates(this.__wbg_ptr);
      var e = J(t[0], t[1]).slice();
      return (r.__wbindgen_free(t[0], t[1] * 4, 4), e);
    }
    take_compressed() {
      let t = r.exrzipplanjs_take_compressed(this.__wbg_ptr);
      var e = j(t[0], t[1]).slice();
      return (r.__wbindgen_free(t[0], t[1] * 1, 1), e);
    }
    get width() {
      return r.exrzipplanjs_width(this.__wbg_ptr) >>> 0;
    }
    get counts() {
      let t = r.exrzipplanjs_counts(this.__wbg_ptr);
      var e = vt(t[0], t[1]).slice();
      return (r.__wbindgen_free(t[0], t[1] * 4, 4), e);
    }
    get data_y() {
      return r.exrzipplanjs_data_y(this.__wbg_ptr);
    }
    get height() {
      return r.decodedarray_bits_per_sample(this.__wbg_ptr) >>> 0;
    }
  };
Symbol.dispose && (B.prototype[Symbol.dispose] = B.prototype.free);
var st =
    typeof FinalizationRegistry > 'u'
      ? { register: () => {}, unregister: () => {} }
      : new FinalizationRegistry(n => r.__wbg_hdrresult_free(n >>> 0, 1)),
  L = class n {
    static __wrap(t) {
      t = t >>> 0;
      let e = Object.create(n.prototype);
      return ((e.__wbg_ptr = t), st.register(e, e.__wbg_ptr, e), e);
    }
    __destroy_into_raw() {
      let t = this.__wbg_ptr;
      return ((this.__wbg_ptr = 0), st.unregister(this), t);
    }
    free() {
      let t = this.__destroy_into_raw();
      r.__wbg_hdrresult_free(t, 0);
    }
    get all_tags_json() {
      let t, e;
      try {
        let _ = r.hdrresult_all_tags_json(this.__wbg_ptr);
        return ((t = _[0]), (e = _[1]), w(_[0], _[1]));
      } finally {
        r.__wbindgen_free(t, e, 1);
      }
    }
    take_data_as_f32() {
      let t = r.hdrresult_take_data_as_f32(this.__wbg_ptr);
      var e = h(t[0], t[1]).slice();
      return (r.__wbindgen_free(t[0], t[1] * 4, 4), e);
    }
    take_metadata_as_f64() {
      let t = r.hdrresult_take_metadata_as_f64(this.__wbg_ptr);
      var e = M(t[0], t[1]).slice();
      return (r.__wbindgen_free(t[0], t[1] * 8, 8), e);
    }
    get channels() {
      return r.hdrresult_channels(this.__wbg_ptr) >>> 0;
    }
  };
Symbol.dispose && (L.prototype[Symbol.dispose] = L.prototype.free);
var ot =
    typeof FinalizationRegistry > 'u'
      ? { register: () => {}, unregister: () => {} }
      : new FinalizationRegistry(n => r.__wbg_histogramresult_free(n >>> 0, 1)),
  P = class n {
    static __wrap(t) {
      t = t >>> 0;
      let e = Object.create(n.prototype);
      return ((e.__wbg_ptr = t), ot.register(e, e.__wbg_ptr, e), e);
    }
    __destroy_into_raw() {
      let t = this.__wbg_ptr;
      return ((this.__wbg_ptr = 0), ot.unregister(this), t);
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
      var e = J(t[0], t[1]).slice();
      return (r.__wbindgen_free(t[0], t[1] * 4, 4), e);
    }
  };
Symbol.dispose && (P.prototype[Symbol.dispose] = P.prototype.free);
var it =
    typeof FinalizationRegistry > 'u'
      ? { register: () => {}, unregister: () => {} }
      : new FinalizationRegistry(n => r.__wbg_imagestats_free(n >>> 0, 1)),
  C = class n {
    static __wrap(t) {
      t = t >>> 0;
      let e = Object.create(n.prototype);
      return ((e.__wbg_ptr = t), it.register(e, e.__wbg_ptr, e), e);
    }
    __destroy_into_raw() {
      let t = this.__wbg_ptr;
      return ((this.__wbg_ptr = 0), it.unregister(this), t);
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
Symbol.dispose && (C.prototype[Symbol.dispose] = C.prototype.free);
var at =
    typeof FinalizationRegistry > 'u'
      ? { register: () => {}, unregister: () => {} }
      : new FinalizationRegistry(n => r.__wbg_jpegresult_free(n >>> 0, 1)),
  N = class n {
    static __wrap(t) {
      t = t >>> 0;
      let e = Object.create(n.prototype);
      return ((e.__wbg_ptr = t), at.register(e, e.__wbg_ptr, e), e);
    }
    __destroy_into_raw() {
      let t = this.__wbg_ptr;
      return ((this.__wbg_ptr = 0), at.unregister(this), t);
    }
    free() {
      let t = this.__destroy_into_raw();
      r.__wbg_jpegresult_free(t, 0);
    }
    take_data_as_u8() {
      let t = r.jpegresult_take_data_as_u8(this.__wbg_ptr);
      var e = j(t[0], t[1]).slice();
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
Symbol.dispose && (N.prototype[Symbol.dispose] = N.prototype.free);
var ct =
    typeof FinalizationRegistry > 'u'
      ? { register: () => {}, unregister: () => {} }
      : new FinalizationRegistry(n => r.__wbg_labelresult_free(n >>> 0, 1)),
  V = class n {
    static __wrap(t) {
      t = t >>> 0;
      let e = Object.create(n.prototype);
      return ((e.__wbg_ptr = t), ct.register(e, e.__wbg_ptr, e), e);
    }
    __destroy_into_raw() {
      let t = this.__wbg_ptr;
      return ((this.__wbg_ptr = 0), ct.unregister(this), t);
    }
    free() {
      let t = this.__destroy_into_raw();
      r.__wbg_labelresult_free(t, 0);
    }
    take_labels_as_i32() {
      let t = r.labelresult_take_labels_as_i32(this.__wbg_ptr);
      if (t[3]) throw l(t[2]);
      var e = J(t[0], t[1]).slice();
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
var lt =
    typeof FinalizationRegistry > 'u'
      ? { register: () => {}, unregister: () => {} }
      : new FinalizationRegistry(n => r.__wbg_pngresult_free(n >>> 0, 1)),
  O = class n {
    static __wrap(t) {
      t = t >>> 0;
      let e = Object.create(n.prototype);
      return ((e.__wbg_ptr = t), lt.register(e, e.__wbg_ptr, e), e);
    }
    __destroy_into_raw() {
      let t = this.__wbg_ptr;
      return ((this.__wbg_ptr = 0), lt.unregister(this), t);
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
      var e = Q(t[0], t[1]).slice();
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
Symbol.dispose && (O.prototype[Symbol.dispose] = O.prototype.free);
var dt =
    typeof FinalizationRegistry > 'u'
      ? { register: () => {}, unregister: () => {} }
      : new FinalizationRegistry(n => r.__wbg_rgbalayercompositor_free(n >>> 0, 1)),
  q = class {
    __destroy_into_raw() {
      let t = this.__wbg_ptr;
      return ((this.__wbg_ptr = 0), dt.unregister(this), t);
    }
    free() {
      let t = this.__destroy_into_raw();
      r.__wbg_rgbalayercompositor_free(t, 0);
    }
    get covered_count() {
      return r.exrzipplanjs_width(this.__wbg_ptr) >>> 0;
    }
    add_channels_i8(t, e, _, s, o, i, a, c, d) {
      let f = y(t, r.__wbindgen_malloc),
        g = p,
        u = r.rgbalayercompositor_add_channels_i8(this.__wbg_ptr, f, g, e, _, s, o, i, a, c, d);
      if (u[1]) throw l(u[0]);
    }
    add_channels_u8(t, e, _, s, o, i, a, c, d) {
      let f = y(t, r.__wbindgen_malloc),
        g = p,
        u = r.rgbalayercompositor_add_channels_u8(this.__wbg_ptr, f, g, e, _, s, o, i, a, c, d);
      if (u[1]) throw l(u[0]);
    }
    finish_isolated(t, e) {
      let _ = r.rgbalayercompositor_finish_isolated(this.__wbg_ptr, t, e);
      if (_[1]) throw l(_[0]);
    }
    add_channels_f32(t, e, _, s, o, i, a, c, d) {
      let f = b(t, r.__wbindgen_malloc),
        g = p,
        u = r.rgbalayercompositor_add_channels_f32(this.__wbg_ptr, f, g, e, _, s, o, i, a, c, d);
      if (u[1]) throw l(u[0]);
    }
    add_channels_f64(t, e, _, s, o, i, a, c, d) {
      let f = Wt(t, r.__wbindgen_malloc),
        g = p,
        u = r.rgbalayercompositor_add_channels_f64(this.__wbg_ptr, f, g, e, _, s, o, i, a, c, d);
      if (u[1]) throw l(u[0]);
    }
    add_channels_i16(t, e, _, s, o, i, a, c, d) {
      let f = x(t, r.__wbindgen_malloc),
        g = p,
        u = r.rgbalayercompositor_add_channels_i16(this.__wbg_ptr, f, g, e, _, s, o, i, a, c, d);
      if (u[1]) throw l(u[0]);
    }
    add_channels_i32(t, e, _, s, o, i, a, c, d) {
      let f = tt(t, r.__wbindgen_malloc),
        g = p,
        u = r.rgbalayercompositor_add_channels_i32(this.__wbg_ptr, f, g, e, _, s, o, i, a, c, d);
      if (u[1]) throw l(u[0]);
    }
    add_channels_u16(t, e, _, s, o, i, a, c, d) {
      let f = x(t, r.__wbindgen_malloc),
        g = p,
        u = r.rgbalayercompositor_add_channels_u16(this.__wbg_ptr, f, g, e, _, s, o, i, a, c, d);
      if (u[1]) throw l(u[0]);
    }
    add_channels_u32(t, e, _, s, o, i, a, c, d) {
      let f = tt(t, r.__wbindgen_malloc),
        g = p,
        u = r.rgbalayercompositor_add_channels_u32(this.__wbg_ptr, f, g, e, _, s, o, i, a, c, d);
      if (u[1]) throw l(u[0]);
    }
    begin_isolated_u8(t, e, _, s, o) {
      let i = y(t, r.__wbindgen_malloc),
        a = p,
        c = r.rgbalayercompositor_begin_isolated_u8(this.__wbg_ptr, i, a, e, _, s, o);
      if (c[1]) throw l(c[0]);
    }
    begin_isolated_f32(t, e, _, s, o, i) {
      let a = b(t, r.__wbindgen_malloc),
        c = p,
        d = r.rgbalayercompositor_begin_isolated_f32(this.__wbg_ptr, a, c, e, _, s, o, i);
      if (d[1]) throw l(d[0]);
    }
    begin_isolated_u16(t, e, _, s, o, i) {
      let a = x(t, r.__wbindgen_malloc),
        c = p,
        d = r.rgbalayercompositor_begin_isolated_u16(this.__wbg_ptr, a, c, e, _, s, o, i);
      if (d[1]) throw l(d[0]);
    }
    isolated_apply_hue(t, e, _, s, o) {
      let i = r.rgbalayercompositor_isolated_apply_hue(this.__wbg_ptr, t, e, _, s, o);
      if (i[1]) throw l(i[0]);
    }
    isolated_apply_lut(t, e) {
      let _ = b(t, r.__wbindgen_malloc),
        s = p,
        o = r.rgbalayercompositor_isolated_apply_lut(this.__wbg_ptr, _, s, e);
      if (o[1]) throw l(o[0]);
    }
    isolated_apply_direct(t, e, _) {
      let s = b(e, r.__wbindgen_malloc),
        o = p,
        i = r.rgbalayercompositor_isolated_apply_direct(this.__wbg_ptr, t, s, o, _);
      if (i[1]) throw l(i[0]);
    }
    take_data_as_channels(t) {
      let e = r.rgbalayercompositor_take_data_as_channels(this.__wbg_ptr, t);
      if (e[3]) throw l(e[2]);
      var _ = h(e[0], e[1]).slice();
      return (r.__wbindgen_free(e[0], e[1] * 4, 4), _);
    }
    take_isolated_surface() {
      let t = r.rgbalayercompositor_take_isolated_surface(this.__wbg_ptr);
      if (t[3]) throw l(t[2]);
      var e = h(t[0], t[1]).slice();
      return (r.__wbindgen_free(t[0], t[1] * 4, 4), e);
    }
    isolated_add_f32_surface(t, e, _, s) {
      let o = b(t, r.__wbindgen_malloc),
        i = p,
        a = r.rgbalayercompositor_isolated_add_f32_surface(this.__wbg_ptr, o, i, e, _, s);
      if (a[1]) throw l(a[0]);
    }
    add_arithmetic_f32_surface(t, e, _, s) {
      let o = b(t, r.__wbindgen_malloc),
        i = p,
        a = r.rgbalayercompositor_add_arithmetic_f32_surface(this.__wbg_ptr, o, i, e, _, s);
      if (a[1]) throw l(a[0]);
    }
    isolated_apply_alpha_mask_u8(t, e, _, s, o, i, a, c) {
      let d = y(t, r.__wbindgen_malloc),
        f = p,
        g = r.rgbalayercompositor_isolated_apply_alpha_mask_u8(
          this.__wbg_ptr,
          d,
          f,
          e,
          _,
          s,
          o,
          i,
          a,
          c
        );
      if (g[1]) throw l(g[0]);
    }
    isolated_apply_selective_hue(t, e) {
      let _ = b(t, r.__wbindgen_malloc),
        s = p,
        o = r.rgbalayercompositor_isolated_apply_selective_hue(this.__wbg_ptr, _, s, e);
      if (o[1]) throw l(o[0]);
    }
    isolated_apply_alpha_mask_f32(t, e, _, s, o, i, a, c) {
      let d = b(t, r.__wbindgen_malloc),
        f = p,
        g = r.rgbalayercompositor_isolated_apply_alpha_mask_f32(
          this.__wbg_ptr,
          d,
          f,
          e,
          _,
          s,
          o,
          i,
          a,
          c
        );
      if (g[1]) throw l(g[0]);
    }
    isolated_apply_alpha_mask_u16(t, e, _, s, o, i, a, c) {
      let d = x(t, r.__wbindgen_malloc),
        f = p,
        g = r.rgbalayercompositor_isolated_apply_alpha_mask_u16(
          this.__wbg_ptr,
          d,
          f,
          e,
          _,
          s,
          o,
          i,
          a,
          c
        );
      if (g[1]) throw l(g[0]);
    }
    isolated_begin_masked_adjustment() {
      let t = r.rgbalayercompositor_isolated_begin_masked_adjustment(this.__wbg_ptr);
      if (t[1]) throw l(t[0]);
    }
    apply_brightness_mask_f32_surface(t, e, _, s) {
      let o = b(t, r.__wbindgen_malloc),
        i = p,
        a = r.rgbalayercompositor_apply_brightness_mask_f32_surface(this.__wbg_ptr, o, i, e, _, s);
      if (a[1]) throw l(a[0]);
    }
    isolated_add_arithmetic_f32_surface(t, e, _, s) {
      let o = b(t, r.__wbindgen_malloc),
        i = p,
        a = r.rgbalayercompositor_isolated_add_arithmetic_f32_surface(
          this.__wbg_ptr,
          o,
          i,
          e,
          _,
          s
        );
      if (a[1]) throw l(a[0]);
    }
    isolated_finish_masked_adjustment_u8(t, e, _, s, o, i, a, c) {
      let d = y(t, r.__wbindgen_malloc),
        f = p,
        g = r.rgbalayercompositor_isolated_finish_masked_adjustment_u8(
          this.__wbg_ptr,
          d,
          f,
          e,
          _,
          s,
          o,
          i,
          a,
          c
        );
      if (g[1]) throw l(g[0]);
    }
    isolated_finish_masked_adjustment_f32(t, e, _, s, o, i, a, c) {
      let d = b(t, r.__wbindgen_malloc),
        f = p,
        g = r.rgbalayercompositor_isolated_finish_masked_adjustment_f32(
          this.__wbg_ptr,
          d,
          f,
          e,
          _,
          s,
          o,
          i,
          a,
          c
        );
      if (g[1]) throw l(g[0]);
    }
    isolated_finish_masked_adjustment_u16(t, e, _, s, o, i, a, c) {
      let d = x(t, r.__wbindgen_malloc),
        f = p,
        g = r.rgbalayercompositor_isolated_finish_masked_adjustment_u16(
          this.__wbg_ptr,
          d,
          f,
          e,
          _,
          s,
          o,
          i,
          a,
          c
        );
      if (g[1]) throw l(g[0]);
    }
    constructor(t, e, _) {
      let s = r.rgbalayercompositor_new(t, e, _);
      if (s[2]) throw l(s[1]);
      return ((this.__wbg_ptr = s[0] >>> 0), dt.register(this, this.__wbg_ptr, this), this);
    }
    add_u8(t, e, _, s, o, i, a) {
      let c = y(t, r.__wbindgen_malloc),
        d = p,
        f = r.rgbalayercompositor_add_u8(this.__wbg_ptr, c, d, e, _, s, o, i, a);
      if (f[1]) throw l(f[0]);
    }
    add_f32(t, e, _, s, o, i, a, c) {
      let d = b(t, r.__wbindgen_malloc),
        f = p,
        g = r.rgbalayercompositor_add_f32(this.__wbg_ptr, d, f, e, _, s, o, i, a, c);
      if (g[1]) throw l(g[0]);
    }
    add_u16(t, e, _, s, o, i, a, c) {
      let d = x(t, r.__wbindgen_malloc),
        f = p,
        g = r.rgbalayercompositor_add_u16(this.__wbg_ptr, d, f, e, _, s, o, i, a, c);
      if (g[1]) throw l(g[0]);
    }
    get max_value() {
      return r.rgbalayercompositor_max_value(this.__wbg_ptr);
    }
    get min_value() {
      return r.rgbalayercompositor_min_value(this.__wbg_ptr);
    }
    take_data() {
      let t = r.rgbalayercompositor_take_data(this.__wbg_ptr);
      var e = h(t[0], t[1]).slice();
      return (r.__wbindgen_free(t[0], t[1] * 4, 4), e);
    }
  };
Symbol.dispose && (q.prototype[Symbol.dispose] = q.prototype.free);
var gt =
    typeof FinalizationRegistry > 'u'
      ? { register: () => {}, unregister: () => {} }
      : new FinalizationRegistry(n => r.__wbg_stabilitycurveresult_free(n >>> 0, 1)),
  G = class n {
    static __wrap(t) {
      t = t >>> 0;
      let e = Object.create(n.prototype);
      return ((e.__wbg_ptr = t), gt.register(e, e.__wbg_ptr, e), e);
    }
    __destroy_into_raw() {
      let t = this.__wbg_ptr;
      return ((this.__wbg_ptr = 0), gt.unregister(this), t);
    }
    free() {
      let t = this.__destroy_into_raw();
      r.__wbg_stabilitycurveresult_free(t, 0);
    }
    get object_counts() {
      let t = r.stabilitycurveresult_object_counts(this.__wbg_ptr);
      var e = vt(t[0], t[1]).slice();
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
      var e = M(t[0], t[1]).slice();
      return (r.__wbindgen_free(t[0], t[1] * 8, 8), e);
    }
    get bins() {
      let t = r.stabilitycurveresult_bins(this.__wbg_ptr);
      var e = J(t[0], t[1]).slice();
      return (r.__wbindgen_free(t[0], t[1] * 4, 4), e);
    }
    get values() {
      let t = r.stabilitycurveresult_values(this.__wbg_ptr);
      var e = M(t[0], t[1]).slice();
      return (r.__wbindgen_free(t[0], t[1] * 8, 8), e);
    }
  };
Symbol.dispose && (G.prototype[Symbol.dispose] = G.prototype.free);
var pt =
    typeof FinalizationRegistry > 'u'
      ? { register: () => {}, unregister: () => {} }
      : new FinalizationRegistry(n => r.__wbg_tifffloatstripplanjs_free(n >>> 0, 1)),
  X = class n {
    static __wrap(t) {
      t = t >>> 0;
      let e = Object.create(n.prototype);
      return ((e.__wbg_ptr = t), pt.register(e, e.__wbg_ptr, e), e);
    }
    __destroy_into_raw() {
      let t = this.__wbg_ptr;
      return ((this.__wbg_ptr = 0), pt.unregister(this), t);
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
      var e = M(t[0], t[1]).slice();
      return (r.__wbindgen_free(t[0], t[1] * 8, 8), e);
    }
    get height() {
      return r.tifffloatstripplanjs_height(this.__wbg_ptr) >>> 0;
    }
    get offsets() {
      let t = r.tifffloatstripplanjs_offsets(this.__wbg_ptr);
      var e = M(t[0], t[1]).slice();
      return (r.__wbindgen_free(t[0], t[1] * 8, 8), e);
    }
    get channels() {
      return r.tifffloatstripplanjs_channels(this.__wbg_ptr) >>> 0;
    }
    get predictor() {
      return r.tifffloatstripplanjs_predictor(this.__wbg_ptr) >>> 0;
    }
  };
Symbol.dispose && (X.prototype[Symbol.dispose] = X.prototype.free);
var ft =
    typeof FinalizationRegistry > 'u'
      ? { register: () => {}, unregister: () => {} }
      : new FinalizationRegistry(n => r.__wbg_tiffregiondecoder_free(n >>> 0, 1)),
  Y = class {
    __destroy_into_raw() {
      let t = this.__wbg_ptr;
      return ((this.__wbg_ptr = 0), ft.unregister(this), t);
    }
    free() {
      let t = this.__destroy_into_raw();
      r.__wbg_tiffregiondecoder_free(t, 0);
    }
    constructor(t) {
      let e = y(t, r.__wbindgen_malloc),
        _ = p,
        s = r.tiffregiondecoder_new(e, _);
      return ((this.__wbg_ptr = s >>> 0), ft.register(this, this.__wbg_ptr, this), this);
    }
    decode(t, e, _, s, o) {
      let i = r.tiffregiondecoder_decode(this.__wbg_ptr, t, e, _, s, o);
      if (i[2]) throw l(i[1]);
      return E.__wrap(i[0]);
    }
  };
Symbol.dispose && (Y.prototype[Symbol.dispose] = Y.prototype.free);
var ut =
    typeof FinalizationRegistry > 'u'
      ? { register: () => {}, unregister: () => {} }
      : new FinalizationRegistry(n => r.__wbg_tiffregionjs_free(n >>> 0, 1)),
  E = class n {
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
      var e = h(t[0], t[1]).slice();
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
Symbol.dispose && (E.prototype[Symbol.dispose] = E.prototype.free);
var wt =
    typeof FinalizationRegistry > 'u'
      ? { register: () => {}, unregister: () => {} }
      : new FinalizationRegistry(n => r.__wbg_tiffresult_free(n >>> 0, 1)),
  $ = class n {
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
        return ((t = _[0]), (e = _[1]), w(_[0], _[1]));
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
      var e = j(t[0], t[1]).slice();
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
      var e = h(t[0], t[1]).slice();
      return (r.__wbindgen_free(t[0], t[1] * 4, 4), e);
    }
    take_data_as_u8() {
      let t = r.tiffresult_take_data_as_u8(this.__wbg_ptr);
      var e = j(t[0], t[1]).slice();
      return (r.__wbindgen_free(t[0], t[1] * 1, 1), e);
    }
    get timing_stats_ms() {
      return r.tiffresult_timing_stats_ms(this.__wbg_ptr);
    }
    take_data_as_f32() {
      let t = r.tiffresult_take_data_as_f32(this.__wbg_ptr);
      var e = h(t[0], t[1]).slice();
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
        return ((t = _[0]), (e = _[1]), w(_[0], _[1]));
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
        return ((t = _[0]), (e = _[1]), w(_[0], _[1]));
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
        return ((t = _[0]), (e = _[1]), w(_[0], _[1]));
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
Symbol.dispose && ($.prototype[Symbol.dispose] = $.prototype.free);
var bt =
    typeof FinalizationRegistry > 'u'
      ? { register: () => {}, unregister: () => {} }
      : new FinalizationRegistry(n => r.__wbg_tiffstripmetadatajs_free(n >>> 0, 1)),
  H = class n {
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
      r.__wbg_tiffstripmetadatajs_free(t, 0);
    }
    get page_count() {
      return r.exrresult_height(this.__wbg_ptr) >>> 0;
    }
    get all_tags_json() {
      let t, e;
      try {
        let _ = r.tiffstripmetadatajs_all_tags_json(this.__wbg_ptr);
        return ((t = _[0]), (e = _[1]), w(_[0], _[1]));
      } finally {
        r.__wbindgen_free(t, e, 1);
      }
    }
    get page_directory_json() {
      let t, e;
      try {
        let _ = r.tiffstripmetadatajs_page_directory_json(this.__wbg_ptr);
        return ((t = _[0]), (e = _[1]), w(_[0], _[1]));
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
        return ((t = _[0]), (e = _[1]), w(_[0], _[1]));
      } finally {
        r.__wbindgen_free(t, e, 1);
      }
    }
    get geo_json() {
      let t, e;
      try {
        let _ = r.tiffstripmetadatajs_geo_json(this.__wbg_ptr);
        return ((t = _[0]), (e = _[1]), w(_[0], _[1]));
      } finally {
        r.__wbindgen_free(t, e, 1);
      }
    }
  };
Symbol.dispose && (H.prototype[Symbol.dispose] = H.prototype.free);
var Ot = new Set(['basic', 'cors', 'default']);
async function Et(n, t) {
  if (typeof Response == 'function' && n instanceof Response) {
    if (typeof WebAssembly.instantiateStreaming == 'function')
      try {
        return await WebAssembly.instantiateStreaming(n, t);
      } catch (_) {
        if (n.ok && Ot.has(n.type) && n.headers.get('Content-Type') !== 'application/wasm')
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
function Tt() {
  let n = {};
  return (
    (n.wbg = {}),
    (n.wbg.__wbg___wbindgen_throw_b855445ff6a94295 = function (t, e) {
      throw new Error(w(t, e));
    }),
    (n.wbg.__wbg_error_7534b8e9a36f1ab4 = function (t, e) {
      let _, s;
      try {
        ((_ = t), (s = e), console.error(w(t, e)));
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
      t.set(Q(e, _));
    }),
    (n.wbg.__wbg_set_9e6516df7b7d0f19 = function (t, e, _) {
      t.set(j(e, _));
    }),
    (n.wbg.__wbg_set_eaa55bcb7597ecca = function (t, e, _) {
      t.set(h(e, _));
    }),
    (n.wbg.__wbg_stack_0ed75d68575b0f3c = function (t, e) {
      let _ = e.stack,
        s = Rt(_, r.__wbindgen_malloc, r.__wbindgen_realloc),
        o = p;
      (Z().setInt32(t + 4, o, !0), Z().setInt32(t + 0, s, !0));
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
      return w(t, e);
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
function Ut(n, t) {
  return (
    (r = n.exports),
    (kt.__wbindgen_wasm_module = t),
    (m = null),
    (F = null),
    (A = null),
    (R = null),
    (z = null),
    (S = null),
    (k = null),
    r.__wbindgen_start(),
    r
  );
}
async function kt(n) {
  if (r !== void 0) return r;
  (typeof n < 'u' &&
    (Object.getPrototypeOf(n) === Object.prototype
      ? ({ module_or_path: n } = n)
      : console.warn(
          'using deprecated parameters for the initialization function; pass a single object instead'
        )),
    typeof n > 'u' && (n = new URL('wasm/tiff-wasm.wasm', import.meta.url)));
  let t = Tt();
  (typeof n == 'string' ||
    (typeof Request == 'function' && n instanceof Request) ||
    (typeof URL == 'function' && n instanceof URL)) &&
    (n = fetch(n));
  let { instance: e, module: _ } = await Et(await n, t);
  return Ut(e, _);
}
var zt = kt;
var Ft = !1;
function Dt(n) {
  if (!Ft) throw new Error('PNG WASM decoder not initialized');
  let t = performance.now(),
    e = jt(new Uint8Array(n)),
    _ = e.take_data_as_u16();
  return {
    width: e.width,
    height: e.height,
    depth: e.bit_depth,
    ctype: e.color_type,
    decodedData: _,
    decodedWith: 'rust-png-wasm (png worker)',
    decodeTimings: [{ name: 'decode-png16-rust', durationMs: performance.now() - t }],
  };
}
self.onmessage = async n => {
  let t = n.data;
  if (t.type === 'init') {
    try {
      (await zt({ module_or_path: t.tiffWasmModule || t.tiffWasmBuffer }), (Ft = !0));
    } catch (o) {
      console.warn(
        '[PngDecodeWorker] WASM unavailable; the webview will load its fallback on demand:',
        o
      );
    }
    self.postMessage({ type: 'ready', caps: { png16: !0 } });
    return;
  }
  let { id: e, format: _, buffer: s } = t;
  if (_ !== 'png16') {
    self.postMessage({ id: e, ok: !1, error: `Unsupported PNG worker format: ${_}`, buffer: s }, [
      s,
    ]);
    return;
  }
  try {
    let o = Dt(s),
      i = [];
    (o.decodedData?.buffer instanceof ArrayBuffer
      ? i.push(o.decodedData.buffer)
      : o.data instanceof ArrayBuffer && i.push(o.data),
      self.postMessage({ id: e, ok: !0, result: o }, i));
  } catch (o) {
    self.postMessage({ id: e, ok: !1, error: String(o?.message || o), buffer: s }, [s]);
  }
};
