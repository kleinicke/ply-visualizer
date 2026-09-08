import { b as d } from './chunk-DZXXIB7W.js';
import { j as i } from './chunk-W2ORCHQ2.js';
import {
  a as s,
  b as m,
  c as f,
  d as u,
  e as y,
  f as w,
  g as p,
  h as l,
  i as c,
  j as W,
  k as _,
  l as x,
  m as h,
} from './chunk-V6CXALVX.js';
async function o(e) {
  let a = await i();
  if (!a)
    throw new Error(
      `Cannot decode ${e}: the Rust/WASM decoder failed to load. ${e} is decoded exclusively by WebAssembly in this extension.`
    );
  return a;
}
async function I(e, a = {}) {
  let t = await o('PFM');
  return s(t.decode_pfm_display_fast, e, 'main', a.topDown !== !1);
}
async function M(e) {
  let a = await o('NetPBM');
  return m(a.decode_ppm_display_fast, e, 'main');
}
async function S(e) {
  let a = await o('NPY');
  return f(a.decode_npy_display_fast, e, 'main');
}
async function z(e) {
  let a = await d();
  return u(a.decode_jxl_fast, e, 'main');
}
async function A(e, a, t, L) {
  try {
    return await L();
  } catch (r) {
    let { externalCodecName: B, initCodecDecoder: g } =
        await import('./codec-wasm-wrapper-NJAWPBBK.js'),
      { decodeNonTiffWithCodecModule: N } = await import('./codec-fallback-M7VLYOPN.js'),
      n = B(r);
    if (!n) throw r;
    if (n === 'JPEG XL' && e === 'dicom') {
      let { initJxlDecoder: D } = await import('./jxl-wasm-wrapper-VTRTRVT7.js'),
        P = await D();
      return c(P.decode_dicom_fast, a, Number(t.frameIndex || 0), 'main');
    }
    let C = await g();
    return N(C, e, a, t, 'main');
  }
}
async function b(e) {
  let { initCodecDecoder: a } = await import('./codec-wasm-wrapper-NJAWPBBK.js'),
    t = await a();
  return y(t.decode_jpegxr_fast, e, 'main');
}
async function j(e) {
  let { initCodecDecoder: a } = await import('./codec-wasm-wrapper-NJAWPBBK.js'),
    t = await a();
  return w(t.decode_jpeg2000_fast, e, 'main');
}
async function E(e) {
  let a = await o('FITS');
  return p(a.decode_fits_fast, e, 'main');
}
async function $(e, a = {}) {
  let t = await o('NetCDF');
  return l(t.decode_netcdf_fast, e, a, 'main');
}
async function k(e, a = {}) {
  return A('dicom', e, a, () => R(e, a));
}
async function R(e, a = {}) {
  let t = await o('DICOM');
  return c(t.decode_dicom_fast, e, Number(a.frameIndex || 0), 'main');
}
async function q(e, a = {}) {
  let t = await o('ND2');
  return _(t.decode_nd2_fast, e, a, 'main');
}
async function v(e, a = {}) {
  let t = await o('LIF');
  return x(t.decode_lif_fast, e, a, 'main');
}
async function G(e, a = {}) {
  let t = await o('SDT');
  return h(t.decode_sdt_fast, e, a, 'main');
}
async function O(e, a = {}) {
  return A('czi', e, a, async () => {
    let t = await o('CZI');
    return W(t.decode_czi_fast, e, a, 'main');
  });
}
export {
  I as a,
  M as b,
  S as c,
  z as d,
  b as e,
  j as f,
  E as g,
  $ as h,
  k as i,
  q as j,
  v as k,
  G as l,
  O as m,
};
