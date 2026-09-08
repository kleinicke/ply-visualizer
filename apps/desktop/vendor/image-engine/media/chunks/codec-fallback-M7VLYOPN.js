import { e as t, f as i, i as s, j as a } from './chunk-V6CXALVX.js';
import './chunk-Y6SLVHK3.js';
var n = new Set(['tiff', 'dicom', 'czi', 'jxr', 'jp2']);
function p(e, r, d, c, o) {
  switch (r) {
    case 'dicom':
      return s(e.decode_dicom_fast, d, Number(c?.frameIndex || 0), o);
    case 'czi':
      return a(e.decode_czi_fast, d, c || {}, o);
    case 'jxr':
      return t(e.decode_jpegxr_fast, d, o);
    case 'jp2':
      return i(e.decode_jpeg2000_fast, d, o);
    default:
      throw new Error(`${r} has no codec-module decoder`);
  }
}
export { n as CODEC_FALLBACK_FORMATS, p as decodeNonTiffWithCodecModule };
