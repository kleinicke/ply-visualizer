function y(t, n) {
  return `rust-${t}-wasm (${n === 'worker' ? 'worker' : 'main thread'})`;
}
function d(t, n) {
  return [{ name: `decode-${t}-rust`, durationMs: performance.now() - n }];
}
function f(t, n) {
  let r = Number(t.data_len || 0);
  if (n && Number.isSafeInteger(r) && r >= 0) {
    let a = Number(t.source_data_offset || 0);
    if (
      t.can_reuse_source === !0 &&
      t.sample_kind === 0 &&
      Number.isSafeInteger(a) &&
      a >= 0 &&
      a % 4 === 0 &&
      a + r * 4 <= n.byteLength &&
      typeof t.discard_data == 'function'
    ) {
      let e = new Float32Array(n, a, r);
      return (t.discard_data(), e);
    }
    switch (t.sample_kind) {
      case 1:
        if (n.byteLength >= r && typeof t.copy_data_as_u8_into == 'function') {
          let e = new Uint8Array(n, 0, r);
          return (t.copy_data_as_u8_into(e), e);
        }
        break;
      case 2:
        if (n.byteLength >= r * 2 && typeof t.copy_data_as_u16_into == 'function') {
          let e = new Uint16Array(n, 0, r);
          return (t.copy_data_as_u16_into(e), e);
        }
        break;
      case 3:
        if (n.byteLength >= r * 2 && typeof t.copy_data_as_u8_into == 'function') {
          let e = new Uint8Array(n, 0, r * 2);
          return (t.copy_data_as_u8_into(e), new Uint16Array(n, 0, r));
        }
        break;
      default:
        if (n.byteLength >= r * 4 && typeof t.copy_data_as_f32_into == 'function') {
          let e = new Float32Array(n, 0, r);
          return (t.copy_data_as_f32_into(e), e);
        }
    }
  }
  switch (t.sample_kind) {
    case 1:
      return t.take_data_as_u8();
    case 2:
      return t.take_data_as_u16();
    case 3: {
      let a = t.take_data_as_u8();
      return new Uint16Array(a.buffer, a.byteOffset, a.byteLength / 2);
    }
    default:
      return t.take_data_as_f32();
  }
}
function i(t, n, r, a, e = !0, o) {
  let s = f(t, o),
    c = JSON.parse(t.metadata_json);
  return {
    width: t.width,
    height: t.height,
    channels: t.channels,
    data: s,
    metadata: c,
    numericDomain: {
      bitsPerSample: t.bits_per_sample,
      sampleFormat: t.sample_format,
      typeMin: t.type_min,
      typeMax: t.type_max,
      sourceNumericType: t.source_numeric_type,
    },
    stats: e ? { min: t.data_min, max: t.data_max } : void 0,
    nonFiniteCount: t.non_finite_count,
    validCount: t.valid_count,
    formatLabel: t.format_label,
    decodedWith: y(n, r),
    decodeTimings: d(n, a),
  };
}
function m(t, n, r, a = !0) {
  let e = performance.now(),
    o = t(new Uint8Array(n), a);
  return i(o, 'pfm', r, e, !1, n);
}
function A(t, n, r) {
  let a = performance.now(),
    e = t(new Uint8Array(n));
  return i(e, 'ppm', r, a, !1, n);
}
function u(t, n, r) {
  let a = performance.now(),
    e = t(new Uint8Array(n));
  return i(e, 'npy', r, a, !0, n);
}
function p(t, n, r) {
  let a = performance.now(),
    e = t(new Uint8Array(n));
  return i(e, 'jxl', r, a);
}
function _(t, n, r) {
  let a = performance.now(),
    e = t(new Uint8Array(n));
  return i(e, 'jxr', r, a);
}
function g(t, n, r) {
  let a = performance.now(),
    e = t(new Uint8Array(n));
  return i(e, 'jp2', r, a);
}
function w(t, n, r) {
  let a = performance.now(),
    e = t(new Uint8Array(n));
  return i(e, 'fits', r, a);
}
function x(t, n, r, a) {
  let e = performance.now(),
    o = t(new Uint8Array(n), JSON.stringify(r || {}));
  return i(o, 'netcdf', a, e);
}
function U(t, n, r, a) {
  let e = performance.now(),
    o = t(new Uint8Array(n), r >>> 0);
  return i(o, 'dicom', a, e);
}
function b(t, n, r, a) {
  let e = performance.now(),
    o = t(new Uint8Array(n), JSON.stringify(r || {}));
  return i(o, 'czi', a, e);
}
function h(t, n, r, a) {
  let e = performance.now(),
    o = t(new Uint8Array(n), JSON.stringify(r || {}));
  return i(o, 'nd2', a, e);
}
function W(t, n, r, a) {
  let e = performance.now(),
    o = t(new Uint8Array(n), JSON.stringify(r || {}));
  return i(o, 'lif', a, e);
}
function D(t, n, r, a) {
  let e = performance.now(),
    o = t(new Uint8Array(n), JSON.stringify(r || {}));
  return i(o, 'sdt', a, e);
}
export {
  m as a,
  A as b,
  u as c,
  p as d,
  _ as e,
  g as f,
  w as g,
  x as h,
  U as i,
  b as j,
  h as k,
  W as l,
  D as m,
};
