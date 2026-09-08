var r,
  b = null;
function g() {
  return ((b === null || b.byteLength === 0) && (b = new Uint8Array(r.memory.buffer)), b);
}
var x = new TextDecoder('utf-8', { ignoreBOM: !0, fatal: !0 });
x.decode();
var P = 2146435072,
  E = 0;
function L(e, t) {
  return (
    (E += t),
    E >= P && ((x = new TextDecoder('utf-8', { ignoreBOM: !0, fatal: !0 })), x.decode(), (E = t)),
    x.decode(g().subarray(e, e + t))
  );
}
function a(e, t) {
  return ((e = e >>> 0), L(e, t));
}
var o = 0,
  h = new TextEncoder();
'encodeInto' in h ||
  (h.encodeInto = function (e, t) {
    let n = h.encode(e);
    return (t.set(n), { read: e.length, written: n.length });
  });
function B(e, t, n) {
  if (n === void 0) {
    let c = h.encode(e),
      p = t(c.length, 1) >>> 0;
    return (
      g()
        .subarray(p, p + c.length)
        .set(c),
      (o = c.length),
      p
    );
  }
  let _ = e.length,
    s = t(_, 1) >>> 0,
    A = g(),
    i = 0;
  for (; i < _; i++) {
    let c = e.charCodeAt(i);
    if (c > 127) break;
    A[s + i] = c;
  }
  if (i !== _) {
    (i !== 0 && (e = e.slice(i)), (s = n(s, _, (_ = i + e.length * 3), 1) >>> 0));
    let c = g().subarray(s + i, s + _),
      p = h.encodeInto(e, c);
    ((i += p.written), (s = n(s, _, i, 1) >>> 0));
  }
  return ((o = i), s);
}
var l = null;
function M() {
  return (
    (l === null ||
      l.buffer.detached === !0 ||
      (l.buffer.detached === void 0 && l.buffer !== r.memory.buffer)) &&
      (l = new DataView(r.memory.buffer)),
    l
  );
}
function d(e) {
  let t = r.__wbindgen_externrefs.get(e);
  return (r.__externref_table_dealloc(e), t);
}
var y = null;
function J() {
  return ((y === null || y.byteLength === 0) && (y = new Float32Array(r.memory.buffer)), y);
}
function W(e, t) {
  return ((e = e >>> 0), J().subarray(e / 4, e / 4 + t));
}
function V(e, t) {
  return ((e = e >>> 0), g().subarray(e / 1, e / 1 + t));
}
function u(e, t) {
  let n = t(e.length * 1, 1) >>> 0;
  return (g().set(e, n / 1), (o = e.length), n);
}
function v(e) {
  let t = u(e, r.__wbindgen_malloc),
    n = o,
    _ = r.decode_tiff_fast(t, n);
  if (_[2]) throw d(_[1]);
  return f.__wrap(_[0]);
}
function R(e) {
  let t = u(e, r.__wbindgen_malloc),
    n = o,
    _ = r.decode_jxl_fast(t, n);
  if (_[2]) throw d(_[1]);
  return w.__wrap(_[0]);
}
function F(e, t) {
  let n = u(e, r.__wbindgen_malloc),
    _ = o,
    s = r.decode_tiff_page(n, _, t);
  if (s[2]) throw d(s[1]);
  return f.__wrap(s[0]);
}
function T(e, t) {
  let n = u(e, r.__wbindgen_malloc),
    _ = o,
    s = r.decode_tiff_page_fast(n, _, t);
  if (s[2]) throw d(s[1]);
  return f.__wrap(s[0]);
}
function O(e) {
  let t = u(e, r.__wbindgen_malloc),
    n = o,
    _ = r.decode_tiff(t, n);
  if (_[2]) throw d(_[1]);
  return f.__wrap(_[0]);
}
function D(e, t) {
  let n = u(e, r.__wbindgen_malloc),
    _ = o,
    s = r.decode_dicom_fast(n, _, t);
  if (s[2]) throw d(s[1]);
  return w.__wrap(s[0]);
}
function U(e) {
  let t = u(e, r.__wbindgen_malloc),
    n = o,
    _ = r.tiff_page_count(t, n);
  if (_[2]) throw d(_[1]);
  return _[0] >>> 0;
}
var S =
    typeof FinalizationRegistry > 'u'
      ? { register: () => {}, unregister: () => {} }
      : new FinalizationRegistry(e => r.__wbg_jxldecoded_free(e >>> 0, 1)),
  w = class e {
    static __wrap(t) {
      t = t >>> 0;
      let n = Object.create(e.prototype);
      return ((n.__wbg_ptr = t), S.register(n, n.__wbg_ptr, n), n);
    }
    __destroy_into_raw() {
      let t = this.__wbg_ptr;
      return ((this.__wbg_ptr = 0), S.unregister(this), t);
    }
    free() {
      let t = this.__destroy_into_raw();
      r.__wbg_jxldecoded_free(t, 0);
    }
    get sample_kind() {
      return r.jxldecoded_sample_kind(this.__wbg_ptr) >>> 0;
    }
    get valid_count() {
      return r.jxldecoded_valid_count(this.__wbg_ptr);
    }
    get format_label() {
      let t, n;
      try {
        let _ = r.jxldecoded_format_label(this.__wbg_ptr);
        return ((t = _[0]), (n = _[1]), a(_[0], _[1]));
      } finally {
        r.__wbindgen_free(t, n, 1);
      }
    }
    get metadata_json() {
      let t, n;
      try {
        let _ = r.jxldecoded_metadata_json(this.__wbg_ptr);
        return ((t = _[0]), (n = _[1]), a(_[0], _[1]));
      } finally {
        r.__wbindgen_free(t, n, 1);
      }
    }
    get sample_format() {
      return r.jxldecoded_sample_format(this.__wbg_ptr) >>> 0;
    }
    get bits_per_sample() {
      return r.jxldecoded_bits_per_sample(this.__wbg_ptr) >>> 0;
    }
    get non_finite_count() {
      return r.jxldecoded_non_finite_count(this.__wbg_ptr);
    }
    take_data_as_f32() {
      let t = r.jxldecoded_take_data_as_f32(this.__wbg_ptr);
      if (t[3]) throw d(t[2]);
      var n = W(t[0], t[1]).slice();
      return (r.__wbindgen_free(t[0], t[1] * 4, 4), n);
    }
    get source_numeric_type() {
      let t, n;
      try {
        let _ = r.jxldecoded_source_numeric_type(this.__wbg_ptr);
        return ((t = _[0]), (n = _[1]), a(_[0], _[1]));
      } finally {
        r.__wbindgen_free(t, n, 1);
      }
    }
    get width() {
      return r.jxldecoded_width(this.__wbg_ptr) >>> 0;
    }
    get height() {
      return r.jxldecoded_height(this.__wbg_ptr) >>> 0;
    }
    get channels() {
      return r.jxldecoded_channels(this.__wbg_ptr) >>> 0;
    }
    get data_len() {
      return r.jxldecoded_data_len(this.__wbg_ptr) >>> 0;
    }
    get data_max() {
      return r.jxldecoded_data_max(this.__wbg_ptr);
    }
    get data_min() {
      return r.jxldecoded_data_min(this.__wbg_ptr);
    }
    get type_max() {
      return r.jxldecoded_type_max(this.__wbg_ptr);
    }
    get type_min() {
      return r.jxldecoded_type_min(this.__wbg_ptr);
    }
  };
Symbol.dispose && (w.prototype[Symbol.dispose] = w.prototype.free);
var k =
    typeof FinalizationRegistry > 'u'
      ? { register: () => {}, unregister: () => {} }
      : new FinalizationRegistry(e => r.__wbg_tiffresult_free(e >>> 0, 1)),
  f = class e {
    static __wrap(t) {
      t = t >>> 0;
      let n = Object.create(e.prototype);
      return ((n.__wbg_ptr = t), k.register(n, n.__wbg_ptr, n), n);
    }
    __destroy_into_raw() {
      let t = this.__wbg_ptr;
      return ((this.__wbg_ptr = 0), k.unregister(this), t);
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
      let t, n;
      try {
        let _ = r.tiffresult_all_tags_json(this.__wbg_ptr);
        return ((t = _[0]), (n = _[1]), a(_[0], _[1]));
      } finally {
        r.__wbindgen_free(t, n, 1);
      }
    }
    get direct_decode() {
      return r.tiffresult_direct_decode(this.__wbg_ptr) !== 0;
    }
    get sample_format() {
      return r.tiffresult_sample_format(this.__wbg_ptr) >>> 0;
    }
    get rows_per_strip() {
      return r.tiffresult_rows_per_strip(this.__wbg_ptr) >>> 0;
    }
    get bits_per_sample() {
      return r.tiffresult_bits_per_sample(this.__wbg_ptr) >>> 0;
    }
    get_data_as_f32() {
      let t = r.tiffresult_get_data_as_f32(this.__wbg_ptr);
      var n = W(t[0], t[1]).slice();
      return (r.__wbindgen_free(t[0], t[1] * 4, 4), n);
    }
    take_data_as_u8() {
      let t = r.tiffresult_take_data_as_u8(this.__wbg_ptr);
      var n = V(t[0], t[1]).slice();
      return (r.__wbindgen_free(t[0], t[1] * 1, 1), n);
    }
    take_data_as_f32() {
      let t = r.tiffresult_take_data_as_f32(this.__wbg_ptr);
      var n = W(t[0], t[1]).slice();
      return (r.__wbindgen_free(t[0], t[1] * 4, 4), n);
    }
    get page_directory_json() {
      let t, n;
      try {
        let _ = r.tiffresult_page_directory_json(this.__wbg_ptr);
        return ((t = _[0]), (n = _[1]), a(_[0], _[1]));
      } finally {
        r.__wbindgen_free(t, n, 1);
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
      return r.tiffresult_width(this.__wbg_ptr) >>> 0;
    }
    get height() {
      return r.tiffresult_height(this.__wbg_ptr) >>> 0;
    }
    get ome_xml() {
      let t, n;
      try {
        let _ = r.tiffresult_ome_xml(this.__wbg_ptr);
        return ((t = _[0]), (n = _[1]), a(_[0], _[1]));
      } finally {
        r.__wbindgen_free(t, n, 1);
      }
    }
    get channels() {
      return r.tiffresult_channels(this.__wbg_ptr) >>> 0;
    }
    get data_len() {
      return r.tiffresult_data_len(this.__wbg_ptr) >>> 0;
    }
    get geo_json() {
      let t, n;
      try {
        let _ = r.tiffresult_geo_json(this.__wbg_ptr);
        return ((t = _[0]), (n = _[1]), a(_[0], _[1]));
      } finally {
        r.__wbindgen_free(t, n, 1);
      }
    }
    get max_value() {
      return r.jxldecoded_data_max(this.__wbg_ptr);
    }
    get min_value() {
      return r.jxldecoded_data_min(this.__wbg_ptr);
    }
    get predictor() {
      return r.tiffresult_predictor(this.__wbg_ptr) >>> 0;
    }
  };
Symbol.dispose && (f.prototype[Symbol.dispose] = f.prototype.free);
var C = new Set(['basic', 'cors', 'default']);
async function X(e, t) {
  if (typeof Response == 'function' && e instanceof Response) {
    if (typeof WebAssembly.instantiateStreaming == 'function')
      try {
        return await WebAssembly.instantiateStreaming(e, t);
      } catch (_) {
        if (e.ok && C.has(e.type) && e.headers.get('Content-Type') !== 'application/wasm')
          console.warn(
            '`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n',
            _
          );
        else throw _;
      }
    let n = await e.arrayBuffer();
    return await WebAssembly.instantiate(n, t);
  } else {
    let n = await WebAssembly.instantiate(e, t);
    return n instanceof WebAssembly.Instance ? { instance: n, module: e } : n;
  }
}
function q() {
  let e = {};
  return (
    (e.wbg = {}),
    (e.wbg.__wbg___wbindgen_throw_b855445ff6a94295 = function (t, n) {
      throw new Error(a(t, n));
    }),
    (e.wbg.__wbg_error_7534b8e9a36f1ab4 = function (t, n) {
      let _, s;
      try {
        ((_ = t), (s = n), console.error(a(t, n)));
      } finally {
        r.__wbindgen_free(_, s, 1);
      }
    }),
    (e.wbg.__wbg_new_8a6f238a6ece86ea = function () {
      return new Error();
    }),
    (e.wbg.__wbg_now_793306c526e2e3b6 = function () {
      return Date.now();
    }),
    (e.wbg.__wbg_stack_0ed75d68575b0f3c = function (t, n) {
      let _ = n.stack,
        s = B(_, r.__wbindgen_malloc, r.__wbindgen_realloc),
        A = o;
      (M().setInt32(t + 4, A, !0), M().setInt32(t + 0, s, !0));
    }),
    (e.wbg.__wbindgen_cast_2241b6af4c4b2941 = function (t, n) {
      return a(t, n);
    }),
    (e.wbg.__wbindgen_init_externref_table = function () {
      let t = r.__wbindgen_externrefs,
        n = t.grow(4);
      (t.set(0, void 0),
        t.set(n + 0, void 0),
        t.set(n + 1, null),
        t.set(n + 2, !0),
        t.set(n + 3, !1));
    }),
    e
  );
}
function N(e, t) {
  return (
    (r = e.exports),
    (z.__wbindgen_wasm_module = t),
    (l = null),
    (y = null),
    (b = null),
    r.__wbindgen_start(),
    r
  );
}
async function z(e) {
  if (r !== void 0) return r;
  (typeof e < 'u' &&
    (Object.getPrototypeOf(e) === Object.prototype
      ? ({ module_or_path: e } = e)
      : console.warn(
          'using deprecated parameters for the initialization function; pass a single object instead'
        )),
    typeof e > 'u' && (e = new URL('wasm/jxl-wasm.wasm', import.meta.url)));
  let t = q();
  (typeof e == 'string' ||
    (typeof Request == 'function' && e instanceof Request) ||
    (typeof URL == 'function' && e instanceof URL)) &&
    (e = fetch(e));
  let { instance: n, module: _ } = await X(await e, t);
  return N(n, _);
}
var I = z;
var j = null,
  m = null;
function Y() {
  return [
    globalThis.__tiffVisualizerVendorAssets?.jxlWasm,
    new URL('./wasm/jxl-wasm.wasm', import.meta.url).href,
    new URL('../wasm/jxl-wasm.wasm', import.meta.url).href,
  ].filter(Boolean);
}
async function H() {
  if (j) return j;
  if (m) return m;
  m = (async () => {
    let e = null;
    for (let n of Y())
      try {
        let _ = await fetch(n);
        if (!_.ok) throw new Error(`HTTP ${_.status}`);
        return (
          await I({ module_or_path: await _.arrayBuffer() }),
          (j = {
            decode_jxl_fast: R,
            decode_dicom_fast: D,
            decode_tiff: O,
            decode_tiff_fast: v,
            decode_tiff_page: F,
            decode_tiff_page_fast: T,
            tiff_page_count: U,
          }),
          j
        );
      } catch (_) {
        e = _;
      }
    let t = e instanceof Error ? e.message : String(e);
    throw new Error(`Unable to initialize the JPEG XL decoder WASM (${t})`);
  })();
  try {
    return await m;
  } catch (e) {
    throw ((m = null), e);
  }
}
export { Y as a, H as b };
