import './chunk-Y6SLVHK3.js';
var r,
  S = null;
function F() {
  return ((S === null || S.byteLength === 0) && (S = new Uint8Array(r.memory.buffer)), S);
}
var I = new TextDecoder('utf-8', { ignoreBOM: !0, fatal: !0 });
I.decode();
var Lt = 2146435072,
  et = 0;
function Bt(_, t) {
  return (
    (et += t),
    et >= Lt &&
      ((I = new TextDecoder('utf-8', { ignoreBOM: !0, fatal: !0 })), I.decode(), (et = t)),
    I.decode(F().subarray(_, _ + t))
  );
}
function w(_, t) {
  return ((_ = _ >>> 0), Bt(_, t));
}
var W = null;
function Ot() {
  return ((W === null || W.byteLength === 0) && (W = new Uint16Array(r.memory.buffer)), W);
}
function rt(_, t) {
  return ((_ = _ >>> 0), Ot().subarray(_ / 2, _ / 2 + t));
}
function A(_, t) {
  return ((_ = _ >>> 0), F().subarray(_ / 1, _ / 1 + t));
}
var M = null;
function Et() {
  return ((M === null || M.byteLength === 0) && (M = new Float32Array(r.memory.buffer)), M);
}
function y(_, t) {
  return ((_ = _ >>> 0), Et().subarray(_ / 4, _ / 4 + t));
}
var d = 0,
  C = new TextEncoder();
'encodeInto' in C ||
  (C.encodeInto = function (_, t) {
    let e = C.encode(_);
    return (t.set(e), { read: _.length, written: e.length });
  });
function Tt(_, t, e) {
  if (e === void 0) {
    let a = C.encode(_),
      l = t(a.length, 1) >>> 0;
    return (
      F()
        .subarray(l, l + a.length)
        .set(a),
      (d = a.length),
      l
    );
  }
  let n = _.length,
    s = t(n, 1) >>> 0,
    i = F(),
    o = 0;
  for (; o < n; o++) {
    let a = _.charCodeAt(o);
    if (a > 127) break;
    i[s + o] = a;
  }
  if (o !== n) {
    (o !== 0 && (_ = _.slice(o)), (s = e(s, n, (n = o + _.length * 3), 1) >>> 0));
    let a = F().subarray(s + o, s + n),
      l = C.encodeInto(_, a);
    ((o += l.written), (s = e(s, n, o, 1) >>> 0));
  }
  return ((d = o), s);
}
var k = null;
function pt() {
  return (
    (k === null ||
      k.buffer.detached === !0 ||
      (k.buffer.detached === void 0 && k.buffer !== r.memory.buffer)) &&
      (k = new DataView(r.memory.buffer)),
    k
  );
}
function b(_, t) {
  let e = t(_.length * 1, 1) >>> 0;
  return (F().set(_, e / 1), (d = _.length), e);
}
function c(_) {
  let t = r.__wbindgen_externrefs.get(_);
  return (r.__externref_table_dealloc(_), t);
}
function h(_, t) {
  let e = t(_.length * 4, 4) >>> 0;
  return (Et().set(_, e / 4), (d = _.length), e);
}
var O = null;
function Ct() {
  return ((O === null || O.byteLength === 0) && (O = new Float64Array(r.memory.buffer)), O);
}
function Vt(_, t) {
  let e = t(_.length * 8, 8) >>> 0;
  return (Ct().set(_, e / 8), (d = _.length), e);
}
function z(_, t) {
  let e = t(_.length * 2, 2) >>> 0;
  return (Ot().set(_, e / 2), (d = _.length), e);
}
var E = null;
function Ut() {
  return ((E === null || E.byteLength === 0) && (E = new Uint32Array(r.memory.buffer)), E);
}
function ft(_, t) {
  let e = t(_.length * 4, 4) >>> 0;
  return (Ut().set(_, e / 4), (d = _.length), e);
}
var T = null;
function Nt() {
  return ((T === null || T.byteLength === 0) && (T = new Int32Array(r.memory.buffer)), T);
}
function tt(_, t) {
  return ((_ = _ >>> 0), Nt().subarray(_ / 4, _ / 4 + t));
}
function Pt(_, t) {
  return ((_ = _ >>> 0), Ut().subarray(_ / 4, _ / 4 + t));
}
function _t(_, t) {
  let e = b(_, r.__wbindgen_malloc),
    n = d,
    s = Tt(t, r.__wbindgen_malloc, r.__wbindgen_realloc),
    i = d,
    o = r.decode_czi_fast(e, n, s, i);
  if (o[2]) throw c(o[1]);
  return x.__wrap(o[0]);
}
function nt(_, t) {
  let e = b(_, r.__wbindgen_malloc),
    n = d,
    s = r.decode_dicom_fast(e, n, t);
  if (s[2]) throw c(s[1]);
  return x.__wrap(s[0]);
}
function st(_) {
  let t = b(_, r.__wbindgen_malloc),
    e = d,
    n = r.decode_tiff_fast(t, e);
  if (n[2]) throw c(n[1]);
  return v.__wrap(n[0]);
}
function ot(_, t) {
  let e = b(_, r.__wbindgen_malloc),
    n = d,
    s = r.decode_tiff_page(e, n, t);
  if (s[2]) throw c(s[1]);
  return v.__wrap(s[0]);
}
function it(_) {
  let t = b(_, r.__wbindgen_malloc),
    e = d,
    n = r.decode_jpegxr_fast(t, e);
  if (n[2]) throw c(n[1]);
  return x.__wrap(n[0]);
}
function at(_) {
  let t = b(_, r.__wbindgen_malloc),
    e = d,
    n = r.tiff_page_count(t, e);
  if (n[2]) throw c(n[1]);
  return n[0] >>> 0;
}
function ct(_) {
  let t = b(_, r.__wbindgen_malloc),
    e = d,
    n = r.decode_tiff(t, e);
  if (n[2]) throw c(n[1]);
  return v.__wrap(n[0]);
}
function U(_, t) {
  return ((_ = _ >>> 0), Ct().subarray(_ / 8, _ / 8 + t));
}
function lt(_, t) {
  let e = b(_, r.__wbindgen_malloc),
    n = d,
    s = r.decode_tiff_page_fast(e, n, t);
  if (s[2]) throw c(s[1]);
  return v.__wrap(s[0]);
}
function dt(_) {
  let t = b(_, r.__wbindgen_malloc),
    e = d,
    n = r.decode_jpeg2000_fast(t, e);
  if (n[2]) throw c(n[1]);
  return x.__wrap(n[0]);
}
var ut =
    typeof FinalizationRegistry > 'u'
      ? { register: () => {}, unregister: () => {} }
      : new FinalizationRegistry(_ => r.__wbg_decodedarray_free(_ >>> 0, 1)),
  x = class _ {
    static __wrap(t) {
      t = t >>> 0;
      let e = Object.create(_.prototype);
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
        let n = r.decodedarray_format_label(this.__wbg_ptr);
        return ((t = n[0]), (e = n[1]), w(n[0], n[1]));
      } finally {
        r.__wbindgen_free(t, e, 1);
      }
    }
    get metadata_json() {
      let t, e;
      try {
        let n = r.decodedarray_metadata_json(this.__wbg_ptr);
        return ((t = n[0]), (e = n[1]), w(n[0], n[1]));
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
      if (t[3]) throw c(t[2]);
      var e = A(t[0], t[1]).slice();
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
      if (t[3]) throw c(t[2]);
      var e = y(t[0], t[1]).slice();
      return (r.__wbindgen_free(t[0], t[1] * 4, 4), e);
    }
    take_data_as_u16() {
      let t = r.decodedarray_take_data_as_u16(this.__wbg_ptr);
      if (t[3]) throw c(t[2]);
      var e = rt(t[0], t[1]).slice();
      return (r.__wbindgen_free(t[0], t[1] * 2, 2), e);
    }
    get source_data_offset() {
      return r.decodedarray_source_data_offset(this.__wbg_ptr) >>> 0;
    }
    get source_numeric_type() {
      let t, e;
      try {
        let n = r.decodedarray_source_numeric_type(this.__wbg_ptr);
        return ((t = n[0]), (e = n[1]), w(n[0], n[1]));
      } finally {
        r.__wbindgen_free(t, e, 1);
      }
    }
    copy_data_as_u8_into(t) {
      let e = r.decodedarray_copy_data_as_u8_into(this.__wbg_ptr, t);
      if (e[1]) throw c(e[0]);
    }
    copy_data_as_f32_into(t) {
      let e = r.decodedarray_copy_data_as_f32_into(this.__wbg_ptr, t);
      if (e[1]) throw c(e[0]);
    }
    copy_data_as_u16_into(t) {
      let e = r.decodedarray_copy_data_as_u16_into(this.__wbg_ptr, t);
      if (e[1]) throw c(e[0]);
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
Symbol.dispose && (x.prototype[Symbol.dispose] = x.prototype.free);
var wt =
    typeof FinalizationRegistry > 'u'
      ? { register: () => {}, unregister: () => {} }
      : new FinalizationRegistry(_ => r.__wbg_demosaicresult_free(_ >>> 0, 1)),
  L = class _ {
    static __wrap(t) {
      t = t >>> 0;
      let e = Object.create(_.prototype);
      return ((e.__wbg_ptr = t), wt.register(e, e.__wbg_ptr, e), e);
    }
    __destroy_into_raw() {
      let t = this.__wbg_ptr;
      return ((this.__wbg_ptr = 0), wt.unregister(this), t);
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
      var e = y(t[0], t[1]).slice();
      return (r.__wbindgen_free(t[0], t[1] * 4, 4), e);
    }
  };
Symbol.dispose && (L.prototype[Symbol.dispose] = L.prototype.free);
var bt =
    typeof FinalizationRegistry > 'u'
      ? { register: () => {}, unregister: () => {} }
      : new FinalizationRegistry(_ => r.__wbg_exrresult_free(_ >>> 0, 1)),
  B = class _ {
    static __wrap(t) {
      t = t >>> 0;
      let e = Object.create(_.prototype);
      return ((e.__wbg_ptr = t), bt.register(e, e.__wbg_ptr, e), e);
    }
    __destroy_into_raw() {
      let t = this.__wbg_ptr;
      return ((this.__wbg_ptr = 0), bt.unregister(this), t);
    }
    free() {
      let t = this.__destroy_into_raw();
      r.__wbg_exrresult_free(t, 0);
    }
    get all_tags_json() {
      let t, e;
      try {
        let n = r.exrresult_all_tags_json(this.__wbg_ptr);
        return ((t = n[0]), (e = n[1]), w(n[0], n[1]));
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
      var e = y(t[0], t[1]).slice();
      return (r.__wbindgen_free(t[0], t[1] * 4, 4), e);
    }
    get channel_names_csv() {
      let t, e;
      try {
        let n = r.exrresult_channel_names_csv(this.__wbg_ptr);
        return ((t = n[0]), (e = n[1]), w(n[0], n[1]));
      } finally {
        r.__wbindgen_free(t, e, 1);
      }
    }
    get displayed_channels_csv() {
      let t, e;
      try {
        let n = r.exrresult_displayed_channels_csv(this.__wbg_ptr);
        return ((t = n[0]), (e = n[1]), w(n[0], n[1]));
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
Symbol.dispose && (B.prototype[Symbol.dispose] = B.prototype.free);
var ht =
    typeof FinalizationRegistry > 'u'
      ? { register: () => {}, unregister: () => {} }
      : new FinalizationRegistry(_ => r.__wbg_exrzipplanjs_free(_ >>> 0, 1)),
  V = class _ {
    static __wrap(t) {
      t = t >>> 0;
      let e = Object.create(_.prototype);
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
        let n = r.exrzipplanjs_channel_name(this.__wbg_ptr);
        return ((t = n[0]), (e = n[1]), w(n[0], n[1]));
      } finally {
        r.__wbindgen_free(t, e, 1);
      }
    }
    get all_tags_json() {
      let t, e;
      try {
        let n = r.exrzipplanjs_all_tags_json(this.__wbg_ptr);
        return ((t = n[0]), (e = n[1]), w(n[0], n[1]));
      } finally {
        r.__wbindgen_free(t, e, 1);
      }
    }
    get y_coordinates() {
      let t = r.exrzipplanjs_y_coordinates(this.__wbg_ptr);
      var e = tt(t[0], t[1]).slice();
      return (r.__wbindgen_free(t[0], t[1] * 4, 4), e);
    }
    take_compressed() {
      let t = r.exrzipplanjs_take_compressed(this.__wbg_ptr);
      var e = A(t[0], t[1]).slice();
      return (r.__wbindgen_free(t[0], t[1] * 1, 1), e);
    }
    get width() {
      return r.exrzipplanjs_width(this.__wbg_ptr) >>> 0;
    }
    get counts() {
      let t = r.exrzipplanjs_counts(this.__wbg_ptr);
      var e = Pt(t[0], t[1]).slice();
      return (r.__wbindgen_free(t[0], t[1] * 4, 4), e);
    }
    get data_y() {
      return r.exrzipplanjs_data_y(this.__wbg_ptr);
    }
    get height() {
      return r.decodedarray_bits_per_sample(this.__wbg_ptr) >>> 0;
    }
  };
Symbol.dispose && (V.prototype[Symbol.dispose] = V.prototype.free);
var yt =
    typeof FinalizationRegistry > 'u'
      ? { register: () => {}, unregister: () => {} }
      : new FinalizationRegistry(_ => r.__wbg_hdrresult_free(_ >>> 0, 1)),
  N = class _ {
    static __wrap(t) {
      t = t >>> 0;
      let e = Object.create(_.prototype);
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
        let n = r.hdrresult_all_tags_json(this.__wbg_ptr);
        return ((t = n[0]), (e = n[1]), w(n[0], n[1]));
      } finally {
        r.__wbindgen_free(t, e, 1);
      }
    }
    take_data_as_f32() {
      let t = r.hdrresult_take_data_as_f32(this.__wbg_ptr);
      var e = y(t[0], t[1]).slice();
      return (r.__wbindgen_free(t[0], t[1] * 4, 4), e);
    }
    take_metadata_as_f64() {
      let t = r.hdrresult_take_metadata_as_f64(this.__wbg_ptr);
      var e = U(t[0], t[1]).slice();
      return (r.__wbindgen_free(t[0], t[1] * 8, 8), e);
    }
    get channels() {
      return r.hdrresult_channels(this.__wbg_ptr) >>> 0;
    }
  };
Symbol.dispose && (N.prototype[Symbol.dispose] = N.prototype.free);
var mt =
    typeof FinalizationRegistry > 'u'
      ? { register: () => {}, unregister: () => {} }
      : new FinalizationRegistry(_ => r.__wbg_histogramresult_free(_ >>> 0, 1)),
  X = class _ {
    static __wrap(t) {
      t = t >>> 0;
      let e = Object.create(_.prototype);
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
      var e = tt(t[0], t[1]).slice();
      return (r.__wbindgen_free(t[0], t[1] * 4, 4), e);
    }
  };
Symbol.dispose && (X.prototype[Symbol.dispose] = X.prototype.free);
var xt =
    typeof FinalizationRegistry > 'u'
      ? { register: () => {}, unregister: () => {} }
      : new FinalizationRegistry(_ => r.__wbg_imagestats_free(_ >>> 0, 1)),
  q = class _ {
    static __wrap(t) {
      t = t >>> 0;
      let e = Object.create(_.prototype);
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
Symbol.dispose && (q.prototype[Symbol.dispose] = q.prototype.free);
var vt =
    typeof FinalizationRegistry > 'u'
      ? { register: () => {}, unregister: () => {} }
      : new FinalizationRegistry(_ => r.__wbg_jpegresult_free(_ >>> 0, 1)),
  Y = class _ {
    static __wrap(t) {
      t = t >>> 0;
      let e = Object.create(_.prototype);
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
      var e = A(t[0], t[1]).slice();
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
Symbol.dispose && (Y.prototype[Symbol.dispose] = Y.prototype.free);
var jt =
    typeof FinalizationRegistry > 'u'
      ? { register: () => {}, unregister: () => {} }
      : new FinalizationRegistry(_ => r.__wbg_labelresult_free(_ >>> 0, 1)),
  $ = class _ {
    static __wrap(t) {
      t = t >>> 0;
      let e = Object.create(_.prototype);
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
      if (t[3]) throw c(t[2]);
      var e = tt(t[0], t[1]).slice();
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
Symbol.dispose && ($.prototype[Symbol.dispose] = $.prototype.free);
var kt =
    typeof FinalizationRegistry > 'u'
      ? { register: () => {}, unregister: () => {} }
      : new FinalizationRegistry(_ => r.__wbg_pngresult_free(_ >>> 0, 1)),
  H = class _ {
    static __wrap(t) {
      t = t >>> 0;
      let e = Object.create(_.prototype);
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
      var e = rt(t[0], t[1]).slice();
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
Symbol.dispose && (H.prototype[Symbol.dispose] = H.prototype.free);
var zt =
    typeof FinalizationRegistry > 'u'
      ? { register: () => {}, unregister: () => {} }
      : new FinalizationRegistry(_ => r.__wbg_rgbalayercompositor_free(_ >>> 0, 1)),
  G = class {
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
    add_channels_i8(t, e, n, s, i, o, a, l, g) {
      let f = b(t, r.__wbindgen_malloc),
        p = d,
        u = r.rgbalayercompositor_add_channels_i8(this.__wbg_ptr, f, p, e, n, s, i, o, a, l, g);
      if (u[1]) throw c(u[0]);
    }
    add_channels_u8(t, e, n, s, i, o, a, l, g) {
      let f = b(t, r.__wbindgen_malloc),
        p = d,
        u = r.rgbalayercompositor_add_channels_u8(this.__wbg_ptr, f, p, e, n, s, i, o, a, l, g);
      if (u[1]) throw c(u[0]);
    }
    finish_isolated(t, e) {
      let n = r.rgbalayercompositor_finish_isolated(this.__wbg_ptr, t, e);
      if (n[1]) throw c(n[0]);
    }
    add_channels_f32(t, e, n, s, i, o, a, l, g) {
      let f = h(t, r.__wbindgen_malloc),
        p = d,
        u = r.rgbalayercompositor_add_channels_f32(this.__wbg_ptr, f, p, e, n, s, i, o, a, l, g);
      if (u[1]) throw c(u[0]);
    }
    add_channels_f64(t, e, n, s, i, o, a, l, g) {
      let f = Vt(t, r.__wbindgen_malloc),
        p = d,
        u = r.rgbalayercompositor_add_channels_f64(this.__wbg_ptr, f, p, e, n, s, i, o, a, l, g);
      if (u[1]) throw c(u[0]);
    }
    add_channels_i16(t, e, n, s, i, o, a, l, g) {
      let f = z(t, r.__wbindgen_malloc),
        p = d,
        u = r.rgbalayercompositor_add_channels_i16(this.__wbg_ptr, f, p, e, n, s, i, o, a, l, g);
      if (u[1]) throw c(u[0]);
    }
    add_channels_i32(t, e, n, s, i, o, a, l, g) {
      let f = ft(t, r.__wbindgen_malloc),
        p = d,
        u = r.rgbalayercompositor_add_channels_i32(this.__wbg_ptr, f, p, e, n, s, i, o, a, l, g);
      if (u[1]) throw c(u[0]);
    }
    add_channels_u16(t, e, n, s, i, o, a, l, g) {
      let f = z(t, r.__wbindgen_malloc),
        p = d,
        u = r.rgbalayercompositor_add_channels_u16(this.__wbg_ptr, f, p, e, n, s, i, o, a, l, g);
      if (u[1]) throw c(u[0]);
    }
    add_channels_u32(t, e, n, s, i, o, a, l, g) {
      let f = ft(t, r.__wbindgen_malloc),
        p = d,
        u = r.rgbalayercompositor_add_channels_u32(this.__wbg_ptr, f, p, e, n, s, i, o, a, l, g);
      if (u[1]) throw c(u[0]);
    }
    begin_isolated_u8(t, e, n, s, i) {
      let o = b(t, r.__wbindgen_malloc),
        a = d,
        l = r.rgbalayercompositor_begin_isolated_u8(this.__wbg_ptr, o, a, e, n, s, i);
      if (l[1]) throw c(l[0]);
    }
    begin_isolated_f32(t, e, n, s, i, o) {
      let a = h(t, r.__wbindgen_malloc),
        l = d,
        g = r.rgbalayercompositor_begin_isolated_f32(this.__wbg_ptr, a, l, e, n, s, i, o);
      if (g[1]) throw c(g[0]);
    }
    begin_isolated_u16(t, e, n, s, i, o) {
      let a = z(t, r.__wbindgen_malloc),
        l = d,
        g = r.rgbalayercompositor_begin_isolated_u16(this.__wbg_ptr, a, l, e, n, s, i, o);
      if (g[1]) throw c(g[0]);
    }
    isolated_apply_hue(t, e, n, s, i) {
      let o = r.rgbalayercompositor_isolated_apply_hue(this.__wbg_ptr, t, e, n, s, i);
      if (o[1]) throw c(o[0]);
    }
    isolated_apply_lut(t, e) {
      let n = h(t, r.__wbindgen_malloc),
        s = d,
        i = r.rgbalayercompositor_isolated_apply_lut(this.__wbg_ptr, n, s, e);
      if (i[1]) throw c(i[0]);
    }
    isolated_apply_direct(t, e, n) {
      let s = h(e, r.__wbindgen_malloc),
        i = d,
        o = r.rgbalayercompositor_isolated_apply_direct(this.__wbg_ptr, t, s, i, n);
      if (o[1]) throw c(o[0]);
    }
    take_data_as_channels(t) {
      let e = r.rgbalayercompositor_take_data_as_channels(this.__wbg_ptr, t);
      if (e[3]) throw c(e[2]);
      var n = y(e[0], e[1]).slice();
      return (r.__wbindgen_free(e[0], e[1] * 4, 4), n);
    }
    take_isolated_surface() {
      let t = r.rgbalayercompositor_take_isolated_surface(this.__wbg_ptr);
      if (t[3]) throw c(t[2]);
      var e = y(t[0], t[1]).slice();
      return (r.__wbindgen_free(t[0], t[1] * 4, 4), e);
    }
    isolated_add_f32_surface(t, e, n, s) {
      let i = h(t, r.__wbindgen_malloc),
        o = d,
        a = r.rgbalayercompositor_isolated_add_f32_surface(this.__wbg_ptr, i, o, e, n, s);
      if (a[1]) throw c(a[0]);
    }
    add_arithmetic_f32_surface(t, e, n, s) {
      let i = h(t, r.__wbindgen_malloc),
        o = d,
        a = r.rgbalayercompositor_add_arithmetic_f32_surface(this.__wbg_ptr, i, o, e, n, s);
      if (a[1]) throw c(a[0]);
    }
    isolated_apply_alpha_mask_u8(t, e, n, s, i, o, a, l) {
      let g = b(t, r.__wbindgen_malloc),
        f = d,
        p = r.rgbalayercompositor_isolated_apply_alpha_mask_u8(
          this.__wbg_ptr,
          g,
          f,
          e,
          n,
          s,
          i,
          o,
          a,
          l
        );
      if (p[1]) throw c(p[0]);
    }
    isolated_apply_selective_hue(t, e) {
      let n = h(t, r.__wbindgen_malloc),
        s = d,
        i = r.rgbalayercompositor_isolated_apply_selective_hue(this.__wbg_ptr, n, s, e);
      if (i[1]) throw c(i[0]);
    }
    isolated_apply_alpha_mask_f32(t, e, n, s, i, o, a, l) {
      let g = h(t, r.__wbindgen_malloc),
        f = d,
        p = r.rgbalayercompositor_isolated_apply_alpha_mask_f32(
          this.__wbg_ptr,
          g,
          f,
          e,
          n,
          s,
          i,
          o,
          a,
          l
        );
      if (p[1]) throw c(p[0]);
    }
    isolated_apply_alpha_mask_u16(t, e, n, s, i, o, a, l) {
      let g = z(t, r.__wbindgen_malloc),
        f = d,
        p = r.rgbalayercompositor_isolated_apply_alpha_mask_u16(
          this.__wbg_ptr,
          g,
          f,
          e,
          n,
          s,
          i,
          o,
          a,
          l
        );
      if (p[1]) throw c(p[0]);
    }
    isolated_begin_masked_adjustment() {
      let t = r.rgbalayercompositor_isolated_begin_masked_adjustment(this.__wbg_ptr);
      if (t[1]) throw c(t[0]);
    }
    apply_brightness_mask_f32_surface(t, e, n, s) {
      let i = h(t, r.__wbindgen_malloc),
        o = d,
        a = r.rgbalayercompositor_apply_brightness_mask_f32_surface(this.__wbg_ptr, i, o, e, n, s);
      if (a[1]) throw c(a[0]);
    }
    isolated_add_arithmetic_f32_surface(t, e, n, s) {
      let i = h(t, r.__wbindgen_malloc),
        o = d,
        a = r.rgbalayercompositor_isolated_add_arithmetic_f32_surface(
          this.__wbg_ptr,
          i,
          o,
          e,
          n,
          s
        );
      if (a[1]) throw c(a[0]);
    }
    isolated_finish_masked_adjustment_u8(t, e, n, s, i, o, a, l) {
      let g = b(t, r.__wbindgen_malloc),
        f = d,
        p = r.rgbalayercompositor_isolated_finish_masked_adjustment_u8(
          this.__wbg_ptr,
          g,
          f,
          e,
          n,
          s,
          i,
          o,
          a,
          l
        );
      if (p[1]) throw c(p[0]);
    }
    isolated_finish_masked_adjustment_f32(t, e, n, s, i, o, a, l) {
      let g = h(t, r.__wbindgen_malloc),
        f = d,
        p = r.rgbalayercompositor_isolated_finish_masked_adjustment_f32(
          this.__wbg_ptr,
          g,
          f,
          e,
          n,
          s,
          i,
          o,
          a,
          l
        );
      if (p[1]) throw c(p[0]);
    }
    isolated_finish_masked_adjustment_u16(t, e, n, s, i, o, a, l) {
      let g = z(t, r.__wbindgen_malloc),
        f = d,
        p = r.rgbalayercompositor_isolated_finish_masked_adjustment_u16(
          this.__wbg_ptr,
          g,
          f,
          e,
          n,
          s,
          i,
          o,
          a,
          l
        );
      if (p[1]) throw c(p[0]);
    }
    constructor(t, e, n) {
      let s = r.rgbalayercompositor_new(t, e, n);
      if (s[2]) throw c(s[1]);
      return ((this.__wbg_ptr = s[0] >>> 0), zt.register(this, this.__wbg_ptr, this), this);
    }
    add_u8(t, e, n, s, i, o, a) {
      let l = b(t, r.__wbindgen_malloc),
        g = d,
        f = r.rgbalayercompositor_add_u8(this.__wbg_ptr, l, g, e, n, s, i, o, a);
      if (f[1]) throw c(f[0]);
    }
    add_f32(t, e, n, s, i, o, a, l) {
      let g = h(t, r.__wbindgen_malloc),
        f = d,
        p = r.rgbalayercompositor_add_f32(this.__wbg_ptr, g, f, e, n, s, i, o, a, l);
      if (p[1]) throw c(p[0]);
    }
    add_u16(t, e, n, s, i, o, a, l) {
      let g = z(t, r.__wbindgen_malloc),
        f = d,
        p = r.rgbalayercompositor_add_u16(this.__wbg_ptr, g, f, e, n, s, i, o, a, l);
      if (p[1]) throw c(p[0]);
    }
    get max_value() {
      return r.rgbalayercompositor_max_value(this.__wbg_ptr);
    }
    get min_value() {
      return r.rgbalayercompositor_min_value(this.__wbg_ptr);
    }
    take_data() {
      let t = r.rgbalayercompositor_take_data(this.__wbg_ptr);
      var e = y(t[0], t[1]).slice();
      return (r.__wbindgen_free(t[0], t[1] * 4, 4), e);
    }
  };
Symbol.dispose && (G.prototype[Symbol.dispose] = G.prototype.free);
var Ft =
    typeof FinalizationRegistry > 'u'
      ? { register: () => {}, unregister: () => {} }
      : new FinalizationRegistry(_ => r.__wbg_stabilitycurveresult_free(_ >>> 0, 1)),
  J = class _ {
    static __wrap(t) {
      t = t >>> 0;
      let e = Object.create(_.prototype);
      return ((e.__wbg_ptr = t), Ft.register(e, e.__wbg_ptr, e), e);
    }
    __destroy_into_raw() {
      let t = this.__wbg_ptr;
      return ((this.__wbg_ptr = 0), Ft.unregister(this), t);
    }
    free() {
      let t = this.__destroy_into_raw();
      r.__wbg_stabilitycurveresult_free(t, 0);
    }
    get object_counts() {
      let t = r.stabilitycurveresult_object_counts(this.__wbg_ptr);
      var e = Pt(t[0], t[1]).slice();
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
      var e = U(t[0], t[1]).slice();
      return (r.__wbindgen_free(t[0], t[1] * 8, 8), e);
    }
    get bins() {
      let t = r.stabilitycurveresult_bins(this.__wbg_ptr);
      var e = tt(t[0], t[1]).slice();
      return (r.__wbindgen_free(t[0], t[1] * 4, 4), e);
    }
    get values() {
      let t = r.stabilitycurveresult_values(this.__wbg_ptr);
      var e = U(t[0], t[1]).slice();
      return (r.__wbindgen_free(t[0], t[1] * 8, 8), e);
    }
  };
Symbol.dispose && (J.prototype[Symbol.dispose] = J.prototype.free);
var At =
    typeof FinalizationRegistry > 'u'
      ? { register: () => {}, unregister: () => {} }
      : new FinalizationRegistry(_ => r.__wbg_tifffloatstripplanjs_free(_ >>> 0, 1)),
  K = class _ {
    static __wrap(t) {
      t = t >>> 0;
      let e = Object.create(_.prototype);
      return ((e.__wbg_ptr = t), At.register(e, e.__wbg_ptr, e), e);
    }
    __destroy_into_raw() {
      let t = this.__wbg_ptr;
      return ((this.__wbg_ptr = 0), At.unregister(this), t);
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
      var e = U(t[0], t[1]).slice();
      return (r.__wbindgen_free(t[0], t[1] * 8, 8), e);
    }
    get height() {
      return r.tifffloatstripplanjs_height(this.__wbg_ptr) >>> 0;
    }
    get offsets() {
      let t = r.tifffloatstripplanjs_offsets(this.__wbg_ptr);
      var e = U(t[0], t[1]).slice();
      return (r.__wbindgen_free(t[0], t[1] * 8, 8), e);
    }
    get channels() {
      return r.tifffloatstripplanjs_channels(this.__wbg_ptr) >>> 0;
    }
    get predictor() {
      return r.tifffloatstripplanjs_predictor(this.__wbg_ptr) >>> 0;
    }
  };
Symbol.dispose && (K.prototype[Symbol.dispose] = K.prototype.free);
var Rt =
    typeof FinalizationRegistry > 'u'
      ? { register: () => {}, unregister: () => {} }
      : new FinalizationRegistry(_ => r.__wbg_tiffregiondecoder_free(_ >>> 0, 1)),
  Q = class {
    __destroy_into_raw() {
      let t = this.__wbg_ptr;
      return ((this.__wbg_ptr = 0), Rt.unregister(this), t);
    }
    free() {
      let t = this.__destroy_into_raw();
      r.__wbg_tiffregiondecoder_free(t, 0);
    }
    constructor(t) {
      let e = b(t, r.__wbindgen_malloc),
        n = d,
        s = r.tiffregiondecoder_new(e, n);
      return ((this.__wbg_ptr = s >>> 0), Rt.register(this, this.__wbg_ptr, this), this);
    }
    decode(t, e, n, s, i) {
      let o = r.tiffregiondecoder_decode(this.__wbg_ptr, t, e, n, s, i);
      if (o[2]) throw c(o[1]);
      return P.__wrap(o[0]);
    }
  };
Symbol.dispose && (Q.prototype[Symbol.dispose] = Q.prototype.free);
var St =
    typeof FinalizationRegistry > 'u'
      ? { register: () => {}, unregister: () => {} }
      : new FinalizationRegistry(_ => r.__wbg_tiffregionjs_free(_ >>> 0, 1)),
  P = class _ {
    static __wrap(t) {
      t = t >>> 0;
      let e = Object.create(_.prototype);
      return ((e.__wbg_ptr = t), St.register(e, e.__wbg_ptr, e), e);
    }
    __destroy_into_raw() {
      let t = this.__wbg_ptr;
      return ((this.__wbg_ptr = 0), St.unregister(this), t);
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
      var e = y(t[0], t[1]).slice();
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
Symbol.dispose && (P.prototype[Symbol.dispose] = P.prototype.free);
var Wt =
    typeof FinalizationRegistry > 'u'
      ? { register: () => {}, unregister: () => {} }
      : new FinalizationRegistry(_ => r.__wbg_tiffresult_free(_ >>> 0, 1)),
  v = class _ {
    static __wrap(t) {
      t = t >>> 0;
      let e = Object.create(_.prototype);
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
        let n = r.tiffresult_all_tags_json(this.__wbg_ptr);
        return ((t = n[0]), (e = n[1]), w(n[0], n[1]));
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
      var e = A(t[0], t[1]).slice();
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
      var e = y(t[0], t[1]).slice();
      return (r.__wbindgen_free(t[0], t[1] * 4, 4), e);
    }
    take_data_as_u8() {
      let t = r.tiffresult_take_data_as_u8(this.__wbg_ptr);
      var e = A(t[0], t[1]).slice();
      return (r.__wbindgen_free(t[0], t[1] * 1, 1), e);
    }
    get timing_stats_ms() {
      return r.tiffresult_timing_stats_ms(this.__wbg_ptr);
    }
    take_data_as_f32() {
      let t = r.tiffresult_take_data_as_f32(this.__wbg_ptr);
      var e = y(t[0], t[1]).slice();
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
        let n = r.tiffresult_page_directory_json(this.__wbg_ptr);
        return ((t = n[0]), (e = n[1]), w(n[0], n[1]));
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
        let n = r.tiffresult_ome_xml(this.__wbg_ptr);
        return ((t = n[0]), (e = n[1]), w(n[0], n[1]));
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
        let n = r.tiffresult_geo_json(this.__wbg_ptr);
        return ((t = n[0]), (e = n[1]), w(n[0], n[1]));
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
Symbol.dispose && (v.prototype[Symbol.dispose] = v.prototype.free);
var Mt =
    typeof FinalizationRegistry > 'u'
      ? { register: () => {}, unregister: () => {} }
      : new FinalizationRegistry(_ => r.__wbg_tiffstripmetadatajs_free(_ >>> 0, 1)),
  Z = class _ {
    static __wrap(t) {
      t = t >>> 0;
      let e = Object.create(_.prototype);
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
        let n = r.tiffstripmetadatajs_all_tags_json(this.__wbg_ptr);
        return ((t = n[0]), (e = n[1]), w(n[0], n[1]));
      } finally {
        r.__wbindgen_free(t, e, 1);
      }
    }
    get page_directory_json() {
      let t, e;
      try {
        let n = r.tiffstripmetadatajs_page_directory_json(this.__wbg_ptr);
        return ((t = n[0]), (e = n[1]), w(n[0], n[1]));
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
        let n = r.tiffstripmetadatajs_ome_xml(this.__wbg_ptr);
        return ((t = n[0]), (e = n[1]), w(n[0], n[1]));
      } finally {
        r.__wbindgen_free(t, e, 1);
      }
    }
    get geo_json() {
      let t, e;
      try {
        let n = r.tiffstripmetadatajs_geo_json(this.__wbg_ptr);
        return ((t = n[0]), (e = n[1]), w(n[0], n[1]));
      } finally {
        r.__wbindgen_free(t, e, 1);
      }
    }
  };
Symbol.dispose && (Z.prototype[Symbol.dispose] = Z.prototype.free);
var Xt = new Set(['basic', 'cors', 'default']);
async function qt(_, t) {
  if (typeof Response == 'function' && _ instanceof Response) {
    if (typeof WebAssembly.instantiateStreaming == 'function')
      try {
        return await WebAssembly.instantiateStreaming(_, t);
      } catch (n) {
        if (_.ok && Xt.has(_.type) && _.headers.get('Content-Type') !== 'application/wasm')
          console.warn(
            '`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n',
            n
          );
        else throw n;
      }
    let e = await _.arrayBuffer();
    return await WebAssembly.instantiate(e, t);
  } else {
    let e = await WebAssembly.instantiate(_, t);
    return e instanceof WebAssembly.Instance ? { instance: e, module: _ } : e;
  }
}
function Yt() {
  let _ = {};
  return (
    (_.wbg = {}),
    (_.wbg.__wbg___wbindgen_throw_b855445ff6a94295 = function (t, e) {
      throw new Error(w(t, e));
    }),
    (_.wbg.__wbg_error_7534b8e9a36f1ab4 = function (t, e) {
      let n, s;
      try {
        ((n = t), (s = e), console.error(w(t, e)));
      } finally {
        r.__wbindgen_free(n, s, 1);
      }
    }),
    (_.wbg.__wbg_length_4126f257d88ef51e = function (t) {
      return t.length;
    }),
    (_.wbg.__wbg_length_58bec3c3f0487eb5 = function (t) {
      return t.length;
    }),
    (_.wbg.__wbg_length_69bca3cb64fc8748 = function (t) {
      return t.length;
    }),
    (_.wbg.__wbg_new_8a6f238a6ece86ea = function () {
      return new Error();
    }),
    (_.wbg.__wbg_now_793306c526e2e3b6 = function () {
      return Date.now();
    }),
    (_.wbg.__wbg_set_7a75d83ea249c6e0 = function (t, e, n) {
      t.set(rt(e, n));
    }),
    (_.wbg.__wbg_set_9e6516df7b7d0f19 = function (t, e, n) {
      t.set(A(e, n));
    }),
    (_.wbg.__wbg_set_eaa55bcb7597ecca = function (t, e, n) {
      t.set(y(e, n));
    }),
    (_.wbg.__wbg_stack_0ed75d68575b0f3c = function (t, e) {
      let n = e.stack,
        s = Tt(n, r.__wbindgen_malloc, r.__wbindgen_realloc),
        i = d;
      (pt().setInt32(t + 4, i, !0), pt().setInt32(t + 0, s, !0));
    }),
    (_.wbg.__wbg_subarray_480600f3d6a9f26c = function (t, e, n) {
      return t.subarray(e >>> 0, n >>> 0);
    }),
    (_.wbg.__wbg_subarray_b24c6237257bcd4d = function (t, e, n) {
      return t.subarray(e >>> 0, n >>> 0);
    }),
    (_.wbg.__wbg_subarray_e9ae4d887d066081 = function (t, e, n) {
      return t.subarray(e >>> 0, n >>> 0);
    }),
    (_.wbg.__wbindgen_cast_2241b6af4c4b2941 = function (t, e) {
      return w(t, e);
    }),
    (_.wbg.__wbindgen_init_externref_table = function () {
      let t = r.__wbindgen_externrefs,
        e = t.grow(4);
      (t.set(0, void 0),
        t.set(e + 0, void 0),
        t.set(e + 1, null),
        t.set(e + 2, !0),
        t.set(e + 3, !1));
    }),
    _
  );
}
function $t(_, t) {
  return (
    (r = _.exports),
    (Dt.__wbindgen_wasm_module = t),
    (k = null),
    (M = null),
    (O = null),
    (T = null),
    (W = null),
    (E = null),
    (S = null),
    r.__wbindgen_start(),
    r
  );
}
async function Dt(_) {
  if (r !== void 0) return r;
  (typeof _ < 'u' &&
    (Object.getPrototypeOf(_) === Object.prototype
      ? ({ module_or_path: _ } = _)
      : console.warn(
          'using deprecated parameters for the initialization function; pass a single object instead'
        )),
    typeof _ > 'u' && (_ = new URL('wasm/codec-wasm.wasm', import.meta.url)));
  let t = Yt();
  (typeof _ == 'string' ||
    (typeof Request == 'function' && _ instanceof Request) ||
    (typeof URL == 'function' && _ instanceof URL)) &&
    (_ = fetch(_));
  let { instance: e, module: n } = await qt(await _, t);
  return $t(e, n);
}
var gt = Dt;
var Ht = /\[external-codec:([^\]]+)\]/;
function Qt(_) {
  let t = _ instanceof Error ? _.message : String(_ ?? '');
  return Ht.exec(t)?.[1] ?? null;
}
var j = null,
  m = null,
  D = null,
  R = null;
function Gt() {
  return [
    globalThis.__tiffVisualizerVendorAssets?.codecWasm,
    new URL('./wasm/codec-wasm.wasm', import.meta.url).href,
    new URL('../wasm/codec-wasm.wasm', import.meta.url).href,
  ].filter(_ => typeof _ == 'string' && _.length > 0);
}
async function It() {
  return (
    D ||
    R ||
    ((R = (async () => {
      let _ = null;
      for (let e of Gt())
        try {
          let n = await fetch(e);
          if (!n.ok) throw new Error(`HTTP ${n.status}`);
          return ((D = await WebAssembly.compile(await n.arrayBuffer())), D);
        } catch (n) {
          _ = n;
        }
      let t = _ instanceof Error ? _.message : String(_);
      throw new Error(`Unable to load the extended codec decoder (${t})`);
    })().catch(_ => {
      throw ((R = null), _);
    })),
    R)
  );
}
async function Zt() {
  if (j) return j;
  if (m) return m;
  m = (async () => (
    await gt({ module_or_path: await It() }),
    (j = {
      decode_tiff: ct,
      decode_tiff_fast: st,
      decode_tiff_page: ot,
      decode_tiff_page_fast: lt,
      tiff_page_count: at,
      decode_dicom_fast: nt,
      decode_czi_fast: _t,
      decode_jpegxr_fast: it,
      decode_jpeg2000_fast: dt,
    }),
    j
  ))();
  try {
    return await m;
  } catch (_) {
    throw ((m = null), _);
  }
}
async function te() {
  return It();
}
async function ee(_) {
  return (
    (D = _),
    (R = Promise.resolve(_)),
    j ||
      (m ||
        (m = (async () => (
          await gt({ module_or_path: _ }),
          (j = {
            decode_tiff: ct,
            decode_tiff_fast: st,
            decode_tiff_page: ot,
            decode_tiff_page_fast: lt,
            tiff_page_count: at,
            decode_dicom_fast: nt,
            decode_czi_fast: _t,
            decode_jpegxr_fast: it,
            decode_jpeg2000_fast: dt,
          }),
          j
        ))().catch(t => {
          throw ((m = null), t);
        })),
      m)
  );
}
export {
  te as codecWasmModule,
  Gt as codecWasmUrls,
  Qt as externalCodecName,
  Zt as initCodecDecoder,
  ee as initCodecDecoderFrom,
};
