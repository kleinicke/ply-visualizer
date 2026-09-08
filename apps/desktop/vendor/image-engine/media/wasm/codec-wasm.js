let wasm;

let cachedUint8ArrayMemory0 = null;

function getUint8ArrayMemory0() {
  if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
    cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
  }
  return cachedUint8ArrayMemory0;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });

cachedTextDecoder.decode();

const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(ptr, len) {
  numBytesDecoded += len;
  if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
    cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
    cachedTextDecoder.decode();
    numBytesDecoded = len;
  }
  return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

function getStringFromWasm0(ptr, len) {
  ptr = ptr >>> 0;
  return decodeText(ptr, len);
}

let cachedUint16ArrayMemory0 = null;

function getUint16ArrayMemory0() {
  if (cachedUint16ArrayMemory0 === null || cachedUint16ArrayMemory0.byteLength === 0) {
    cachedUint16ArrayMemory0 = new Uint16Array(wasm.memory.buffer);
  }
  return cachedUint16ArrayMemory0;
}

function getArrayU16FromWasm0(ptr, len) {
  ptr = ptr >>> 0;
  return getUint16ArrayMemory0().subarray(ptr / 2, ptr / 2 + len);
}

function getArrayU8FromWasm0(ptr, len) {
  ptr = ptr >>> 0;
  return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}

let cachedFloat32ArrayMemory0 = null;

function getFloat32ArrayMemory0() {
  if (cachedFloat32ArrayMemory0 === null || cachedFloat32ArrayMemory0.byteLength === 0) {
    cachedFloat32ArrayMemory0 = new Float32Array(wasm.memory.buffer);
  }
  return cachedFloat32ArrayMemory0;
}

function getArrayF32FromWasm0(ptr, len) {
  ptr = ptr >>> 0;
  return getFloat32ArrayMemory0().subarray(ptr / 4, ptr / 4 + len);
}

let WASM_VECTOR_LEN = 0;

const cachedTextEncoder = new TextEncoder();

if (!('encodeInto' in cachedTextEncoder)) {
  cachedTextEncoder.encodeInto = function (arg, view) {
    const buf = cachedTextEncoder.encode(arg);
    view.set(buf);
    return {
      read: arg.length,
      written: buf.length,
    };
  };
}

function passStringToWasm0(arg, malloc, realloc) {
  if (realloc === undefined) {
    const buf = cachedTextEncoder.encode(arg);
    const ptr = malloc(buf.length, 1) >>> 0;
    getUint8ArrayMemory0()
      .subarray(ptr, ptr + buf.length)
      .set(buf);
    WASM_VECTOR_LEN = buf.length;
    return ptr;
  }

  let len = arg.length;
  let ptr = malloc(len, 1) >>> 0;

  const mem = getUint8ArrayMemory0();

  let offset = 0;

  for (; offset < len; offset++) {
    const code = arg.charCodeAt(offset);
    if (code > 0x7f) break;
    mem[ptr + offset] = code;
  }

  if (offset !== len) {
    if (offset !== 0) {
      arg = arg.slice(offset);
    }
    ptr = realloc(ptr, len, (len = offset + arg.length * 3), 1) >>> 0;
    const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
    const ret = cachedTextEncoder.encodeInto(arg, view);

    offset += ret.written;
    ptr = realloc(ptr, len, offset, 1) >>> 0;
  }

  WASM_VECTOR_LEN = offset;
  return ptr;
}

let cachedDataViewMemory0 = null;

function getDataViewMemory0() {
  if (
    cachedDataViewMemory0 === null ||
    cachedDataViewMemory0.buffer.detached === true ||
    (cachedDataViewMemory0.buffer.detached === undefined &&
      cachedDataViewMemory0.buffer !== wasm.memory.buffer)
  ) {
    cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
  }
  return cachedDataViewMemory0;
}

function passArray8ToWasm0(arg, malloc) {
  const ptr = malloc(arg.length * 1, 1) >>> 0;
  getUint8ArrayMemory0().set(arg, ptr / 1);
  WASM_VECTOR_LEN = arg.length;
  return ptr;
}

function takeFromExternrefTable0(idx) {
  const value = wasm.__wbindgen_externrefs.get(idx);
  wasm.__externref_table_dealloc(idx);
  return value;
}

function passArrayF32ToWasm0(arg, malloc) {
  const ptr = malloc(arg.length * 4, 4) >>> 0;
  getFloat32ArrayMemory0().set(arg, ptr / 4);
  WASM_VECTOR_LEN = arg.length;
  return ptr;
}

let cachedFloat64ArrayMemory0 = null;

function getFloat64ArrayMemory0() {
  if (cachedFloat64ArrayMemory0 === null || cachedFloat64ArrayMemory0.byteLength === 0) {
    cachedFloat64ArrayMemory0 = new Float64Array(wasm.memory.buffer);
  }
  return cachedFloat64ArrayMemory0;
}

function passArrayF64ToWasm0(arg, malloc) {
  const ptr = malloc(arg.length * 8, 8) >>> 0;
  getFloat64ArrayMemory0().set(arg, ptr / 8);
  WASM_VECTOR_LEN = arg.length;
  return ptr;
}

function passArray16ToWasm0(arg, malloc) {
  const ptr = malloc(arg.length * 2, 2) >>> 0;
  getUint16ArrayMemory0().set(arg, ptr / 2);
  WASM_VECTOR_LEN = arg.length;
  return ptr;
}

let cachedUint32ArrayMemory0 = null;

function getUint32ArrayMemory0() {
  if (cachedUint32ArrayMemory0 === null || cachedUint32ArrayMemory0.byteLength === 0) {
    cachedUint32ArrayMemory0 = new Uint32Array(wasm.memory.buffer);
  }
  return cachedUint32ArrayMemory0;
}

function passArray32ToWasm0(arg, malloc) {
  const ptr = malloc(arg.length * 4, 4) >>> 0;
  getUint32ArrayMemory0().set(arg, ptr / 4);
  WASM_VECTOR_LEN = arg.length;
  return ptr;
}

let cachedInt32ArrayMemory0 = null;

function getInt32ArrayMemory0() {
  if (cachedInt32ArrayMemory0 === null || cachedInt32ArrayMemory0.byteLength === 0) {
    cachedInt32ArrayMemory0 = new Int32Array(wasm.memory.buffer);
  }
  return cachedInt32ArrayMemory0;
}

function getArrayI32FromWasm0(ptr, len) {
  ptr = ptr >>> 0;
  return getInt32ArrayMemory0().subarray(ptr / 4, ptr / 4 + len);
}

function getArrayU32FromWasm0(ptr, len) {
  ptr = ptr >>> 0;
  return getUint32ArrayMemory0().subarray(ptr / 4, ptr / 4 + len);
}
/**
 * @param {Uint8Array} data
 * @param {string} options_json
 * @returns {DecodedArray}
 */
export function decode_czi_fast(data, options_json) {
  const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
  const len0 = WASM_VECTOR_LEN;
  const ptr1 = passStringToWasm0(options_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
  const len1 = WASM_VECTOR_LEN;
  const ret = wasm.decode_czi_fast(ptr0, len0, ptr1, len1);
  if (ret[2]) {
    throw takeFromExternrefTable0(ret[1]);
  }
  return DecodedArray.__wrap(ret[0]);
}

/**
 * Decode the units `[first_strip, first_strip + counts.len() / blocks_per_unit)`.
 *
 * `blob` is those units' blocks' compressed bytes concatenated in order;
 * `counts` their individual lengths, one entry per BLOCK. The geometry
 * arguments come from the plan; `tile_width`/`tile_length` are zero for a
 * stripped file, in which case a unit is one strip.
 * @param {Uint8Array} blob
 * @param {Uint32Array} counts
 * @param {number} first_strip
 * @param {number} width
 * @param {number} height
 * @param {number} channels
 * @param {number} bits_per_sample
 * @param {number} compression
 * @param {number} rows_per_strip
 * @param {number} predictor
 * @param {number} sample_format
 * @param {boolean} little_endian
 * @param {number} planar_configuration
 * @param {number} orientation
 * @param {number} tile_width
 * @param {number} tile_length
 * @param {number} blocks_across
 * @param {number} lerc_additional_compression
 * @param {number} photometric_interpretation
 * @returns {Float32Array}
 */
export function decode_tiff_float_strip_range(
  blob,
  counts,
  first_strip,
  width,
  height,
  channels,
  bits_per_sample,
  compression,
  rows_per_strip,
  predictor,
  sample_format,
  little_endian,
  planar_configuration,
  orientation,
  tile_width,
  tile_length,
  blocks_across,
  lerc_additional_compression,
  photometric_interpretation
) {
  const ptr0 = passArray8ToWasm0(blob, wasm.__wbindgen_malloc);
  const len0 = WASM_VECTOR_LEN;
  const ptr1 = passArray32ToWasm0(counts, wasm.__wbindgen_malloc);
  const len1 = WASM_VECTOR_LEN;
  const ret = wasm.decode_tiff_float_strip_range(
    ptr0,
    len0,
    ptr1,
    len1,
    first_strip,
    width,
    height,
    channels,
    bits_per_sample,
    compression,
    rows_per_strip,
    predictor,
    sample_format,
    little_endian,
    planar_configuration,
    orientation,
    tile_width,
    tile_length,
    blocks_across,
    lerc_additional_compression,
    photometric_interpretation
  );
  if (ret[3]) {
    throw takeFromExternrefTable0(ret[2]);
  }
  var v3 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
  wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
  return v3;
}

/**
 * @param {Uint8Array} data
 * @returns {TiffFloatStripPlanJs | undefined}
 */
export function tiff_float_strip_plan(data) {
  const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
  const len0 = WASM_VECTOR_LEN;
  const ret = wasm.tiff_float_strip_plan(ptr0, len0);
  return ret === 0 ? undefined : TiffFloatStripPlanJs.__wrap(ret);
}

/**
 * @param {Uint8Array} data
 * @param {boolean} top_down
 * @returns {DecodedArray}
 */
export function decode_pfm_display_fast(data, top_down) {
  const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
  const len0 = WASM_VECTOR_LEN;
  const ret = wasm.decode_pfm_display_fast(ptr0, len0, top_down);
  if (ret[2]) {
    throw takeFromExternrefTable0(ret[1]);
  }
  return DecodedArray.__wrap(ret[0]);
}

/**
 * Classify every image in a TIFF's IFD chain without decoding pixels. Used
 * when a page directory is wanted for a file that was not decoded through
 * this module (or before deciding which page to decode).
 * @param {Uint8Array} data
 * @returns {string}
 */
export function tiff_page_directory(data) {
  let deferred2_0;
  let deferred2_1;
  try {
    const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.tiff_page_directory(ptr0, len0);
    deferred2_0 = ret[0];
    deferred2_1 = ret[1];
    return getStringFromWasm0(ret[0], ret[1]);
  } finally {
    wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
  }
}

/**
 * @param {Uint8Array} data
 * @param {number} frame_index
 * @returns {DecodedArray}
 */
export function decode_dicom_fast(data, frame_index) {
  const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
  const len0 = WASM_VECTOR_LEN;
  const ret = wasm.decode_dicom_fast(ptr0, len0, frame_index);
  if (ret[2]) {
    throw takeFromExternrefTable0(ret[1]);
  }
  return DecodedArray.__wrap(ret[0]);
}

/**
 * @param {Uint8Array} data
 * @returns {TiffResult}
 */
export function decode_tiff_fast(data) {
  const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
  const len0 = WASM_VECTOR_LEN;
  const ret = wasm.decode_tiff_fast(ptr0, len0);
  if (ret[2]) {
    throw takeFromExternrefTable0(ret[1]);
  }
  return TiffResult.__wrap(ret[0]);
}

/**
 * @param {Uint8Array} data
 * @returns {DecodedArray}
 */
export function decode_npy_fast(data) {
  const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
  const len0 = WASM_VECTOR_LEN;
  const ret = wasm.decode_npy_fast(ptr0, len0);
  if (ret[2]) {
    throw takeFromExternrefTable0(ret[1]);
  }
  return DecodedArray.__wrap(ret[0]);
}

/**
 * @param {Uint8Array} data
 * @param {number} page_index
 * @returns {TiffResult}
 */
export function decode_tiff_page(data, page_index) {
  const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
  const len0 = WASM_VECTOR_LEN;
  const ret = wasm.decode_tiff_page(ptr0, len0, page_index);
  if (ret[2]) {
    throw takeFromExternrefTable0(ret[1]);
  }
  return TiffResult.__wrap(ret[0]);
}

/**
 * Whether a page can be served a region at a time, without decoding anything.
 * @param {Uint8Array} data
 * @param {number} page_index
 * @returns {boolean}
 */
export function tiff_region_decode_available(data, page_index) {
  const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
  const len0 = WASM_VECTOR_LEN;
  const ret = wasm.tiff_region_decode_available(ptr0, len0, page_index);
  return ret !== 0;
}

/**
 * @param {Uint8Array} data
 * @param {number} page_index
 * @param {number} x
 * @param {number} y
 * @param {number} width
 * @param {number} height
 * @returns {TiffRegionJs}
 */
export function decode_tiff_region(data, page_index, x, y, width, height) {
  const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
  const len0 = WASM_VECTOR_LEN;
  const ret = wasm.decode_tiff_region(ptr0, len0, page_index, x, y, width, height);
  if (ret[2]) {
    throw takeFromExternrefTable0(ret[1]);
  }
  return TiffRegionJs.__wrap(ret[0]);
}

/**
 * @param {Uint8Array} data
 * @returns {ExrResult}
 */
export function decode_exr_fast(data) {
  const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
  const len0 = WASM_VECTOR_LEN;
  const ret = wasm.decode_exr_fast(ptr0, len0);
  if (ret[2]) {
    throw takeFromExternrefTable0(ret[1]);
  }
  return ExrResult.__wrap(ret[0]);
}

/**
 * Standalone JPEG XR (`.jxr`, `.wdp`, `.hdp`). The TIFF path decodes the same
 * codestream under compression 34934; this reads the pixel format off the
 * codestream itself, there being no TIFF tags to describe it.
 *
 * Present only in the codec module: the decoder is 189 KiB and no other
 * format in the core build needs it.
 * @param {Uint8Array} data
 * @returns {DecodedArray}
 */
export function decode_jpegxr_fast(data) {
  const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
  const len0 = WASM_VECTOR_LEN;
  const ret = wasm.decode_jpegxr_fast(ptr0, len0);
  if (ret[2]) {
    throw takeFromExternrefTable0(ret[1]);
  }
  return DecodedArray.__wrap(ret[0]);
}

/**
 * @param {Uint8Array} data
 * @param {string} options_json
 * @returns {DecodedArray}
 */
export function decode_netcdf_fast(data, options_json) {
  const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
  const len0 = WASM_VECTOR_LEN;
  const ptr1 = passStringToWasm0(options_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
  const len1 = WASM_VECTOR_LEN;
  const ret = wasm.decode_netcdf_fast(ptr0, len0, ptr1, len1);
  if (ret[2]) {
    throw takeFromExternrefTable0(ret[1]);
  }
  return DecodedArray.__wrap(ret[0]);
}

/**
 * @param {Float32Array} data
 * @param {number} width
 * @param {number} height
 * @param {string} pattern
 * @param {string} algorithm
 * @param {number} offset_x
 * @param {number} offset_y
 * @param {number} black
 * @param {number} white
 * @param {boolean} auto_wb
 * @param {number} gain_r
 * @param {number} gain_g
 * @param {number} gain_b
 * @returns {DemosaicResult}
 */
export function demosaic(
  data,
  width,
  height,
  pattern,
  algorithm,
  offset_x,
  offset_y,
  black,
  white,
  auto_wb,
  gain_r,
  gain_g,
  gain_b
) {
  const ptr0 = passArrayF32ToWasm0(data, wasm.__wbindgen_malloc);
  const len0 = WASM_VECTOR_LEN;
  const ptr1 = passStringToWasm0(pattern, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
  const len1 = WASM_VECTOR_LEN;
  const ptr2 = passStringToWasm0(algorithm, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
  const len2 = WASM_VECTOR_LEN;
  const ret = wasm.demosaic(
    ptr0,
    len0,
    width,
    height,
    ptr1,
    len1,
    ptr2,
    len2,
    offset_x,
    offset_y,
    black,
    white,
    auto_wb,
    gain_r,
    gain_g,
    gain_b
  );
  if (ret[2]) {
    throw takeFromExternrefTable0(ret[1]);
  }
  return DemosaicResult.__wrap(ret[0]);
}

/**
 * @param {Uint8Array} data
 * @returns {DecodedArray}
 */
export function decode_npy_display_fast(data) {
  const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
  const len0 = WASM_VECTOR_LEN;
  const ret = wasm.decode_npy_display_fast(ptr0, len0);
  if (ret[2]) {
    throw takeFromExternrefTable0(ret[1]);
  }
  return DecodedArray.__wrap(ret[0]);
}

/**
 * @param {Uint8Array} data
 * @returns {string}
 */
export function extract_exif_tags(data) {
  let deferred2_0;
  let deferred2_1;
  try {
    const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.extract_exif_tags(ptr0, len0);
    deferred2_0 = ret[0];
    deferred2_1 = ret[1];
    return getStringFromWasm0(ret[0], ret[1]);
  } finally {
    wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
  }
}

/**
 * @param {Uint8Array} data
 * @returns {number}
 */
export function tiff_page_count(data) {
  const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
  const len0 = WASM_VECTOR_LEN;
  const ret = wasm.tiff_page_count(ptr0, len0);
  if (ret[2]) {
    throw takeFromExternrefTable0(ret[1]);
  }
  return ret[0] >>> 0;
}

/**
 * @param {Uint8Array} data
 * @returns {DecodedArray}
 */
export function decode_ppm_display_fast(data) {
  const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
  const len0 = WASM_VECTOR_LEN;
  const ret = wasm.decode_ppm_display_fast(ptr0, len0);
  if (ret[2]) {
    throw takeFromExternrefTable0(ret[1]);
  }
  return DecodedArray.__wrap(ret[0]);
}

/**
 * @param {Uint8Array} data
 * @returns {TiffResult}
 */
export function decode_tiff(data) {
  const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
  const len0 = WASM_VECTOR_LEN;
  const ret = wasm.decode_tiff(ptr0, len0);
  if (ret[2]) {
    throw takeFromExternrefTable0(ret[1]);
  }
  return TiffResult.__wrap(ret[0]);
}

/**
 * @param {Uint8Array} data
 * @returns {HdrResult}
 */
export function decode_hdr_fast(data) {
  const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
  const len0 = WASM_VECTOR_LEN;
  const ret = wasm.decode_hdr_fast(ptr0, len0);
  if (ret[2]) {
    throw takeFromExternrefTable0(ret[1]);
  }
  return HdrResult.__wrap(ret[0]);
}

/**
 * @param {Uint8Array} data
 * @returns {PngResult}
 */
export function decode_png16_fast(data) {
  const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
  const len0 = WASM_VECTOR_LEN;
  const ret = wasm.decode_png16_fast(ptr0, len0);
  if (ret[2]) {
    throw takeFromExternrefTable0(ret[1]);
  }
  return PngResult.__wrap(ret[0]);
}

/**
 * Like `decode_tiff_float_strip_range`, but returns native little-endian
 * sample bytes so the caller can wrap them in the carrier type its pipeline
 * expects with no conversion pass.
 * @param {Uint8Array} blob
 * @param {Uint32Array} counts
 * @param {number} first_strip
 * @param {number} width
 * @param {number} height
 * @param {number} channels
 * @param {number} bits_per_sample
 * @param {number} compression
 * @param {number} rows_per_strip
 * @param {number} predictor
 * @param {number} sample_format
 * @param {boolean} little_endian
 * @param {number} planar_configuration
 * @param {number} orientation
 * @param {number} tile_width
 * @param {number} tile_length
 * @param {number} blocks_across
 * @param {number} lerc_additional_compression
 * @param {number} photometric_interpretation
 * @returns {Uint8Array}
 */
export function decode_tiff_strip_range_raw(
  blob,
  counts,
  first_strip,
  width,
  height,
  channels,
  bits_per_sample,
  compression,
  rows_per_strip,
  predictor,
  sample_format,
  little_endian,
  planar_configuration,
  orientation,
  tile_width,
  tile_length,
  blocks_across,
  lerc_additional_compression,
  photometric_interpretation
) {
  const ptr0 = passArray8ToWasm0(blob, wasm.__wbindgen_malloc);
  const len0 = WASM_VECTOR_LEN;
  const ptr1 = passArray32ToWasm0(counts, wasm.__wbindgen_malloc);
  const len1 = WASM_VECTOR_LEN;
  const ret = wasm.decode_tiff_strip_range_raw(
    ptr0,
    len0,
    ptr1,
    len1,
    first_strip,
    width,
    height,
    channels,
    bits_per_sample,
    compression,
    rows_per_strip,
    predictor,
    sample_format,
    little_endian,
    planar_configuration,
    orientation,
    tile_width,
    tile_length,
    blocks_across,
    lerc_additional_compression,
    photometric_interpretation
  );
  if (ret[3]) {
    throw takeFromExternrefTable0(ret[2]);
  }
  var v3 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
  wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
  return v3;
}

/**
 * @param {Uint8Array} header
 * @returns {string}
 */
export function remote_tiff_header(header) {
  let deferred3_0;
  let deferred3_1;
  try {
    const ptr0 = passArray8ToWasm0(header, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.remote_tiff_header(ptr0, len0);
    var ptr2 = ret[0];
    var len2 = ret[1];
    if (ret[3]) {
      ptr2 = 0;
      len2 = 0;
      throw takeFromExternrefTable0(ret[2]);
    }
    deferred3_0 = ptr2;
    deferred3_1 = len2;
    return getStringFromWasm0(ptr2, len2);
  } finally {
    wasm.__wbindgen_free(deferred3_0, deferred3_1, 1);
  }
}

function getArrayF64FromWasm0(ptr, len) {
  ptr = ptr >>> 0;
  return getFloat64ArrayMemory0().subarray(ptr / 8, ptr / 8 + len);
}
/**
 * @param {Uint8Array} data
 * @param {number} item_bytes
 * @param {boolean} little
 * @returns {Float64Array}
 */
export function remote_tiff_index_values(data, item_bytes, little) {
  const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
  const len0 = WASM_VECTOR_LEN;
  const ret = wasm.remote_tiff_index_values(ptr0, len0, item_bytes, little);
  if (ret[3]) {
    throw takeFromExternrefTable0(ret[2]);
  }
  var v2 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
  wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
  return v2;
}

/**
 * @param {Uint8Array} data
 * @param {number} page_index
 * @returns {TiffResult}
 */
export function decode_tiff_page_fast(data, page_index) {
  const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
  const len0 = WASM_VECTOR_LEN;
  const ret = wasm.decode_tiff_page_fast(ptr0, len0, page_index);
  if (ret[2]) {
    throw takeFromExternrefTable0(ret[1]);
  }
  return TiffResult.__wrap(ret[0]);
}

/**
 * Standalone JPEG 2000 (`.jp2`, `.jpf`, `.jpx`, `.j2k`, `.j2c`, `.jpc`). The
 * TIFF path decodes the same codestream under compression 34712; this reads
 * the geometry and precision off the codestream itself, there being no TIFF
 * tags to describe them.
 *
 * Present only in the codec module, for the same reason as JPEG XR above: no
 * format in the core build needs the JPEG 2000 decoder.
 * @param {Uint8Array} data
 * @returns {DecodedArray}
 */
export function decode_jpeg2000_fast(data) {
  const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
  const len0 = WASM_VECTOR_LEN;
  const ret = wasm.decode_jpeg2000_fast(ptr0, len0);
  if (ret[2]) {
    throw takeFromExternrefTable0(ret[1]);
  }
  return DecodedArray.__wrap(ret[0]);
}

/**
 * @param {Uint8Array} data
 * @returns {ExrZipPlanJs | undefined}
 */
export function exr_zip_f32_plan(data) {
  const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
  const len0 = WASM_VECTOR_LEN;
  const ret = wasm.exr_zip_f32_plan(ptr0, len0);
  if (ret[2]) {
    throw takeFromExternrefTable0(ret[1]);
  }
  return ret[0] === 0 ? undefined : ExrZipPlanJs.__wrap(ret[0]);
}

/**
 * @param {Uint8Array} data
 * @param {string} options_json
 * @returns {DecodedArray}
 */
export function decode_lif_fast(data, options_json) {
  const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
  const len0 = WASM_VECTOR_LEN;
  const ptr1 = passStringToWasm0(options_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
  const len1 = WASM_VECTOR_LEN;
  const ret = wasm.decode_lif_fast(ptr0, len0, ptr1, len1);
  if (ret[2]) {
    throw takeFromExternrefTable0(ret[1]);
  }
  return DecodedArray.__wrap(ret[0]);
}

/**
 * @param {Uint8Array} blob
 * @param {Uint32Array} counts
 * @param {Uint32Array} rows
 * @param {number} width
 * @returns {Uint8Array}
 */
export function decode_exr_zip_f32_blocks(blob, counts, rows, width) {
  const ptr0 = passArray8ToWasm0(blob, wasm.__wbindgen_malloc);
  const len0 = WASM_VECTOR_LEN;
  const ptr1 = passArray32ToWasm0(counts, wasm.__wbindgen_malloc);
  const len1 = WASM_VECTOR_LEN;
  const ptr2 = passArray32ToWasm0(rows, wasm.__wbindgen_malloc);
  const len2 = WASM_VECTOR_LEN;
  const ret = wasm.decode_exr_zip_f32_blocks(ptr0, len0, ptr1, len1, ptr2, len2, width);
  if (ret[3]) {
    throw takeFromExternrefTable0(ret[2]);
  }
  var v4 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
  wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
  return v4;
}

/**
 * @param {Uint8Array} data
 * @returns {JpegResult}
 */
export function decode_jpeg_fast(data) {
  const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
  const len0 = WASM_VECTOR_LEN;
  const ret = wasm.decode_jpeg_fast(ptr0, len0);
  if (ret[2]) {
    throw takeFromExternrefTable0(ret[1]);
  }
  return JpegResult.__wrap(ret[0]);
}

/**
 * @param {Uint8Array} header
 * @param {Uint8Array} data
 * @param {number} offset
 * @returns {string}
 */
export function remote_tiff_ifd(header, data, offset) {
  let deferred4_0;
  let deferred4_1;
  try {
    const ptr0 = passArray8ToWasm0(header, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.remote_tiff_ifd(ptr0, len0, ptr1, len1, offset);
    var ptr3 = ret[0];
    var len3 = ret[1];
    if (ret[3]) {
      ptr3 = 0;
      len3 = 0;
      throw takeFromExternrefTable0(ret[2]);
    }
    deferred4_0 = ptr3;
    deferred4_1 = len3;
    return getStringFromWasm0(ptr3, len3);
  } finally {
    wasm.__wbindgen_free(deferred4_0, deferred4_1, 1);
  }
}

/**
 * @param {Uint8Array} data
 * @param {string} options_json
 * @returns {DecodedArray}
 */
export function decode_nd2_fast(data, options_json) {
  const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
  const len0 = WASM_VECTOR_LEN;
  const ptr1 = passStringToWasm0(options_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
  const len1 = WASM_VECTOR_LEN;
  const ret = wasm.decode_nd2_fast(ptr0, len0, ptr1, len1);
  if (ret[2]) {
    throw takeFromExternrefTable0(ret[1]);
  }
  return DecodedArray.__wrap(ret[0]);
}

/**
 * Tags and page count for a strip-parallel decode. Parses the IFD only — the
 * pixels come from `decode_tiff_float_strip_range` on the worker pool.
 * @param {Uint8Array} data
 * @returns {TiffStripMetadataJs}
 */
export function tiff_strip_metadata(data) {
  const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
  const len0 = WASM_VECTOR_LEN;
  const ret = wasm.tiff_strip_metadata(ptr0, len0);
  if (ret[2]) {
    throw takeFromExternrefTable0(ret[1]);
  }
  return TiffStripMetadataJs.__wrap(ret[0]);
}

/**
 * @param {Uint8Array} data
 * @returns {DecodedArray}
 */
export function decode_ppm_fast(data) {
  const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
  const len0 = WASM_VECTOR_LEN;
  const ret = wasm.decode_ppm_fast(ptr0, len0);
  if (ret[2]) {
    throw takeFromExternrefTable0(ret[1]);
  }
  return DecodedArray.__wrap(ret[0]);
}

/**
 * @param {Uint8Array} data
 * @param {boolean} top_down
 * @returns {DecodedArray}
 */
export function decode_pfm_fast(data, top_down) {
  const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
  const len0 = WASM_VECTOR_LEN;
  const ret = wasm.decode_pfm_fast(ptr0, len0, top_down);
  if (ret[2]) {
    throw takeFromExternrefTable0(ret[1]);
  }
  return DecodedArray.__wrap(ret[0]);
}

/**
 * @param {Uint8Array} data
 * @returns {TiffResult}
 */
export function decode_tiff_preview(data) {
  const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
  const len0 = WASM_VECTOR_LEN;
  const ret = wasm.decode_tiff_preview(ptr0, len0);
  if (ret[2]) {
    throw takeFromExternrefTable0(ret[1]);
  }
  return TiffResult.__wrap(ret[0]);
}

/**
 * @param {Uint8Array} data
 * @param {string} options_json
 * @returns {DecodedArray}
 */
export function decode_sdt_fast(data, options_json) {
  const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
  const len0 = WASM_VECTOR_LEN;
  const ptr1 = passStringToWasm0(options_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
  const len1 = WASM_VECTOR_LEN;
  const ret = wasm.decode_sdt_fast(ptr0, len0, ptr1, len1);
  if (ret[2]) {
    throw takeFromExternrefTable0(ret[1]);
  }
  return DecodedArray.__wrap(ret[0]);
}

/**
 * @param {Uint8Array} data
 * @returns {DecodedArray}
 */
export function decode_fits_fast(data) {
  const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
  const len0 = WASM_VECTOR_LEN;
  const ret = wasm.decode_fits_fast(ptr0, len0);
  if (ret[2]) {
    throw takeFromExternrefTable0(ret[1]);
  }
  return DecodedArray.__wrap(ret[0]);
}

/**
 * @param {Uint8Array} data
 * @returns {number}
 */
export function tiff_preview_reduction(data) {
  const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
  const len0 = WASM_VECTOR_LEN;
  const ret = wasm.tiff_preview_reduction(ptr0, len0);
  return ret >>> 0;
}

/**
 * SQUARED Euclidean distance from each set pixel to the nearest background
 * pixel — the same convention the TypeScript used, so callers that compare
 * against a squared radius keep working unchanged.
 * @param {Uint8Array} mask
 * @param {number} width
 * @param {number} height
 * @returns {Float64Array}
 */
export function distance_transform_fast(mask, width, height) {
  const ptr0 = passArray8ToWasm0(mask, wasm.__wbindgen_malloc);
  const len0 = WASM_VECTOR_LEN;
  const ret = wasm.distance_transform_fast(ptr0, len0, width, height);
  if (ret[3]) {
    throw takeFromExternrefTable0(ret[2]);
  }
  var v2 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
  wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
  return v2;
}

/**
 * Any global auto-threshold method applied per neighbourhood, bilinearly
 * interpolated between tiles. `min_contrast` uses NaN to mean "use the
 * method's default (0.25)".
 * @param {Float32Array} plane
 * @param {number} width
 * @param {number} height
 * @param {string} method
 * @param {number} radius
 * @param {boolean} dark_background
 * @param {number} min_contrast
 * @returns {Uint8Array}
 */
export function local_auto_threshold_mask_fast(
  plane,
  width,
  height,
  method,
  radius,
  dark_background,
  min_contrast
) {
  const ptr0 = passArrayF32ToWasm0(plane, wasm.__wbindgen_malloc);
  const len0 = WASM_VECTOR_LEN;
  const ptr1 = passStringToWasm0(method, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
  const len1 = WASM_VECTOR_LEN;
  const ret = wasm.local_auto_threshold_mask_fast(
    ptr0,
    len0,
    width,
    height,
    ptr1,
    len1,
    radius,
    dark_background,
    min_contrast
  );
  if (ret[3]) {
    throw takeFromExternrefTable0(ret[2]);
  }
  var v3 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
  wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
  return v3;
}

/**
 * Binary mask from a global value window.
 * @param {Float32Array} plane
 * @param {number} low
 * @param {number} high
 * @returns {Uint8Array}
 */
export function global_threshold_mask_fast(plane, low, high) {
  const ptr0 = passArrayF32ToWasm0(plane, wasm.__wbindgen_malloc);
  const len0 = WASM_VECTOR_LEN;
  const ret = wasm.global_threshold_mask_fast(ptr0, len0, low, high);
  var v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
  wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
  return v2;
}

/**
 * Min/max/mean/std over a uint16 raster. See `compute_image_stats_u8`.
 * @param {Uint16Array} data
 * @param {number} width
 * @param {number} height
 * @param {number} channels
 * @param {boolean} rgb_as_24bit
 * @returns {ImageStats}
 */
export function compute_image_stats_u16(data, width, height, channels, rgb_as_24bit) {
  const ptr0 = passArray16ToWasm0(data, wasm.__wbindgen_malloc);
  const len0 = WASM_VECTOR_LEN;
  const ret = wasm.compute_image_stats_u16(ptr0, len0, width, height, channels, rgb_as_24bit);
  return ImageStats.__wrap(ret);
}

/**
 * Build the 256-bin histogram of a scalar plane. `step` subsamples for
 * interactive use (pass 1 for the full plane).
 * @param {Float32Array} plane
 * @param {number} step
 * @returns {HistogramResult}
 */
export function build_histogram_fast(plane, step) {
  const ptr0 = passArrayF32ToWasm0(plane, wasm.__wbindgen_malloc);
  const len0 = WASM_VECTOR_LEN;
  const ret = wasm.build_histogram_fast(ptr0, len0, step);
  return HistogramResult.__wrap(ret);
}

/**
 * Labels connected runs of non-zero mask entries. `connectivity` is 4 or 8.
 * @param {Uint8Array} mask
 * @param {number} width
 * @param {number} height
 * @param {number} connectivity
 * @returns {LabelResult}
 */
export function label_components_fast(mask, width, height, connectivity) {
  const ptr0 = passArray8ToWasm0(mask, wasm.__wbindgen_malloc);
  const len0 = WASM_VECTOR_LEN;
  const ret = wasm.label_components_fast(ptr0, len0, width, height, connectivity);
  if (ret[2]) {
    throw takeFromExternrefTable0(ret[1]);
  }
  return LabelResult.__wrap(ret[0]);
}

/**
 * Min/max/mean/std over a uint8 raster, ported from
 * `ImageStatsCalculator.calculateIntegerStats`. `rgb_as_24bit` packs the
 * first three channels into one 24-bit value (see
 * `pipeline::stats::compute_image_stats_uint_impl`); it only takes effect
 * when `channels >= 3`, matching the TS guard.
 * @param {Uint8Array} data
 * @param {number} width
 * @param {number} height
 * @param {number} channels
 * @param {boolean} rgb_as_24bit
 * @returns {ImageStats}
 */
export function compute_image_stats_u8(data, width, height, channels, rgb_as_24bit) {
  const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
  const len0 = WASM_VECTOR_LEN;
  const ret = wasm.compute_image_stats_u8(ptr0, len0, width, height, channels, rgb_as_24bit);
  return ImageStats.__wrap(ret);
}

/**
 * Fills enclosed holes in a binary mask. Returns a mask of the same size.
 * @param {Uint8Array} mask
 * @param {number} width
 * @param {number} height
 * @returns {Uint8Array}
 */
export function fill_mask_holes_fast(mask, width, height) {
  const ptr0 = passArray8ToWasm0(mask, wasm.__wbindgen_malloc);
  const len0 = WASM_VECTOR_LEN;
  const ret = wasm.fill_mask_holes_fast(ptr0, len0, width, height);
  if (ret[3]) {
    throw takeFromExternrefTable0(ret[2]);
  }
  var v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
  wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
  return v2;
}

/**
 * Per-pixel local threshold surface (Sauvola/Niblack/Phansalkar/mean/median).
 * `r` and `offset` use NaN to mean "use the method's default", matching the
 * TypeScript's optional `r?`/`offset?` fields.
 * @param {Float32Array} plane
 * @param {number} width
 * @param {number} height
 * @param {string} method
 * @param {number} radius
 * @param {number} k
 * @param {number} r
 * @param {number} offset
 * @param {boolean} dark_background
 * @returns {Uint8Array}
 */
export function local_threshold_mask_fast(
  plane,
  width,
  height,
  method,
  radius,
  k,
  r,
  offset,
  dark_background
) {
  const ptr0 = passArrayF32ToWasm0(plane, wasm.__wbindgen_malloc);
  const len0 = WASM_VECTOR_LEN;
  const ptr1 = passStringToWasm0(method, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
  const len1 = WASM_VECTOR_LEN;
  const ret = wasm.local_threshold_mask_fast(
    ptr0,
    len0,
    width,
    height,
    ptr1,
    len1,
    radius,
    k,
    r,
    offset,
    dark_background
  );
  if (ret[3]) {
    throw takeFromExternrefTable0(ret[2]);
  }
  var v3 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
  wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
  return v3;
}

/**
 * @param {Float32Array} plane
 * @param {number} width
 * @param {number} height
 * @param {number} histogram_min
 * @param {number} histogram_max
 * @param {number} samples
 * @param {number} max_pixels
 * @param {boolean} dark_background
 * @returns {StabilityCurveResult}
 */
export function compute_stability_curve_fast(
  plane,
  width,
  height,
  histogram_min,
  histogram_max,
  samples,
  max_pixels,
  dark_background
) {
  const ptr0 = passArrayF32ToWasm0(plane, wasm.__wbindgen_malloc);
  const len0 = WASM_VECTOR_LEN;
  const ret = wasm.compute_stability_curve_fast(
    ptr0,
    len0,
    width,
    height,
    histogram_min,
    histogram_max,
    samples,
    max_pixels,
    dark_background
  );
  if (ret[2]) {
    throw takeFromExternrefTable0(ret[1]);
  }
  return StabilityCurveResult.__wrap(ret[0]);
}

/**
 * Background subtraction by morphological opening.
 * @param {Float32Array} plane
 * @param {number} width
 * @param {number} height
 * @param {number} radius
 * @param {boolean} light_background
 * @returns {Float32Array}
 */
export function subtract_background_fast(plane, width, height, radius, light_background) {
  const ptr0 = passArrayF32ToWasm0(plane, wasm.__wbindgen_malloc);
  const len0 = WASM_VECTOR_LEN;
  const ret = wasm.subtract_background_fast(ptr0, len0, width, height, radius, light_background);
  if (ret[3]) {
    throw takeFromExternrefTable0(ret[2]);
  }
  var v2 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
  wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
  return v2;
}

/**
 * Separable Gaussian blur. Non-finite samples are skipped and the weights
 * renormalised, so a NaN neighbour is ignored rather than darkening the result.
 * @param {Float32Array} plane
 * @param {number} width
 * @param {number} height
 * @param {number} sigma
 * @returns {Float32Array}
 */
export function gaussian_blur_fast(plane, width, height, sigma) {
  const ptr0 = passArrayF32ToWasm0(plane, wasm.__wbindgen_malloc);
  const len0 = WASM_VECTOR_LEN;
  const ret = wasm.gaussian_blur_fast(ptr0, len0, width, height, sigma);
  if (ret[3]) {
    throw takeFromExternrefTable0(ret[2]);
  }
  var v2 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
  wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
  return v2;
}

/**
 * Min/max/mean/std/valid & non-finite counts over a float32 raster, ported
 * from `ImageStatsCalculator.calculateFloatStats` (`extended = false`) and
 * `.calculateExtendedStats` (`extended = true`) in
 * `media/modules/normalization-helper.ts`. `extended` only changes the
 * "no valid samples" min/max fallback (+/-Infinity vs NaN) — every other
 * field is always computed. See `pipeline::stats::compute_image_stats_f32_impl`
 * for the exact non-finite-handling semantics this must stay bit-identical
 * to (CLAUDE.md's `!Number.isFinite()` rule).
 * @param {Float32Array} data
 * @param {number} width
 * @param {number} height
 * @param {number} channels
 * @param {boolean} extended
 * @returns {ImageStats}
 */
export function compute_image_stats_f32(data, width, height, channels, extended) {
  const ptr0 = passArrayF32ToWasm0(data, wasm.__wbindgen_malloc);
  const len0 = WASM_VECTOR_LEN;
  const ret = wasm.compute_image_stats_f32(ptr0, len0, width, height, channels, extended);
  return ImageStats.__wrap(ret);
}

/**
 * Apply one auto-threshold method to a 256-bin histogram. Returns a bin
 * index, or -1 on failure. Unknown method names fall back to Otsu.
 * @param {Int32Array} counts
 * @param {string} method
 * @returns {number}
 */
export function auto_threshold_bin_fast(counts, method) {
  const ptr0 = passArray32ToWasm0(counts, wasm.__wbindgen_malloc);
  const len0 = WASM_VECTOR_LEN;
  const ptr1 = passStringToWasm0(method, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
  const len1 = WASM_VECTOR_LEN;
  const ret = wasm.auto_threshold_bin_fast(ptr0, len0, ptr1, len1);
  if (ret[2]) {
    throw takeFromExternrefTable0(ret[1]);
  }
  return ret[0];
}

const DecodedArrayFinalization =
  typeof FinalizationRegistry === 'undefined'
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_decodedarray_free(ptr >>> 0, 1));

export class DecodedArray {
  static __wrap(ptr) {
    ptr = ptr >>> 0;
    const obj = Object.create(DecodedArray.prototype);
    obj.__wbg_ptr = ptr;
    DecodedArrayFinalization.register(obj, obj.__wbg_ptr, obj);
    return obj;
  }

  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;
    DecodedArrayFinalization.unregister(this);
    return ptr;
  }

  free() {
    const ptr = this.__destroy_into_raw();
    wasm.__wbg_decodedarray_free(ptr, 0);
  }
  /**
   * @returns {number}
   */
  get sample_kind() {
    const ret = wasm.decodedarray_sample_kind(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * @returns {number}
   */
  get valid_count() {
    const ret = wasm.decodedarray_valid_count(this.__wbg_ptr);
    return ret;
  }
  discard_data() {
    wasm.decodedarray_discard_data(this.__wbg_ptr);
  }
  /**
   * @returns {string}
   */
  get format_label() {
    let deferred1_0;
    let deferred1_1;
    try {
      const ret = wasm.decodedarray_format_label(this.__wbg_ptr);
      deferred1_0 = ret[0];
      deferred1_1 = ret[1];
      return getStringFromWasm0(ret[0], ret[1]);
    } finally {
      wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
  }
  /**
   * @returns {string}
   */
  get metadata_json() {
    let deferred1_0;
    let deferred1_1;
    try {
      const ret = wasm.decodedarray_metadata_json(this.__wbg_ptr);
      deferred1_0 = ret[0];
      deferred1_1 = ret[1];
      return getStringFromWasm0(ret[0], ret[1]);
    } finally {
      wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
  }
  /**
   * @returns {number}
   */
  get sample_format() {
    const ret = wasm.decodedarray_sample_format(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * @returns {number}
   */
  get bits_per_sample() {
    const ret = wasm.decodedarray_bits_per_sample(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * @returns {Uint8Array}
   */
  take_data_as_u8() {
    const ret = wasm.decodedarray_take_data_as_u8(this.__wbg_ptr);
    if (ret[3]) {
      throw takeFromExternrefTable0(ret[2]);
    }
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
  }
  /**
   * @returns {boolean}
   */
  get can_reuse_source() {
    const ret = wasm.decodedarray_can_reuse_source(this.__wbg_ptr);
    return ret !== 0;
  }
  /**
   * @returns {number}
   */
  get non_finite_count() {
    const ret = wasm.decodedarray_non_finite_count(this.__wbg_ptr);
    return ret;
  }
  /**
   * @returns {Float32Array}
   */
  take_data_as_f32() {
    const ret = wasm.decodedarray_take_data_as_f32(this.__wbg_ptr);
    if (ret[3]) {
      throw takeFromExternrefTable0(ret[2]);
    }
    var v1 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v1;
  }
  /**
   * @returns {Uint16Array}
   */
  take_data_as_u16() {
    const ret = wasm.decodedarray_take_data_as_u16(this.__wbg_ptr);
    if (ret[3]) {
      throw takeFromExternrefTable0(ret[2]);
    }
    var v1 = getArrayU16FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 2, 2);
    return v1;
  }
  /**
   * @returns {number}
   */
  get source_data_offset() {
    const ret = wasm.decodedarray_source_data_offset(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * @returns {string}
   */
  get source_numeric_type() {
    let deferred1_0;
    let deferred1_1;
    try {
      const ret = wasm.decodedarray_source_numeric_type(this.__wbg_ptr);
      deferred1_0 = ret[0];
      deferred1_1 = ret[1];
      return getStringFromWasm0(ret[0], ret[1]);
    } finally {
      wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
  }
  /**
   * @param {Uint8Array} target
   */
  copy_data_as_u8_into(target) {
    const ret = wasm.decodedarray_copy_data_as_u8_into(this.__wbg_ptr, target);
    if (ret[1]) {
      throw takeFromExternrefTable0(ret[0]);
    }
  }
  /**
   * Consume the decoded carrier while copying it directly into a
   * JavaScript-owned buffer. Unlike returning `Vec<T>`, wasm-bindgen does
   * not allocate a second JS typed array here; callers can reuse the source
   * ArrayBuffer that was already transferred into the decode worker.
   * @param {Float32Array} target
   */
  copy_data_as_f32_into(target) {
    const ret = wasm.decodedarray_copy_data_as_f32_into(this.__wbg_ptr, target);
    if (ret[1]) {
      throw takeFromExternrefTable0(ret[0]);
    }
  }
  /**
   * @param {Uint16Array} target
   */
  copy_data_as_u16_into(target) {
    const ret = wasm.decodedarray_copy_data_as_u16_into(this.__wbg_ptr, target);
    if (ret[1]) {
      throw takeFromExternrefTable0(ret[0]);
    }
  }
  /**
   * @returns {number}
   */
  get width() {
    const ret = wasm.decodedarray_width(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * @returns {number}
   */
  get height() {
    const ret = wasm.decodedarray_height(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * @returns {number}
   */
  get channels() {
    const ret = wasm.decodedarray_channels(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * @returns {number}
   */
  get data_len() {
    const ret = wasm.decodedarray_data_len(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * @returns {number}
   */
  get data_max() {
    const ret = wasm.decodedarray_data_max(this.__wbg_ptr);
    return ret;
  }
  /**
   * @returns {number}
   */
  get data_min() {
    const ret = wasm.decodedarray_data_min(this.__wbg_ptr);
    return ret;
  }
  /**
   * @returns {number}
   */
  get type_max() {
    const ret = wasm.decodedarray_type_max(this.__wbg_ptr);
    return ret;
  }
  /**
   * @returns {number}
   */
  get type_min() {
    const ret = wasm.decodedarray_type_min(this.__wbg_ptr);
    return ret;
  }
}
if (Symbol.dispose) DecodedArray.prototype[Symbol.dispose] = DecodedArray.prototype.free;

const DemosaicResultFinalization =
  typeof FinalizationRegistry === 'undefined'
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_demosaicresult_free(ptr >>> 0, 1));

export class DemosaicResult {
  static __wrap(ptr) {
    ptr = ptr >>> 0;
    const obj = Object.create(DemosaicResult.prototype);
    obj.__wbg_ptr = ptr;
    DemosaicResultFinalization.register(obj, obj.__wbg_ptr, obj);
    return obj;
  }

  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;
    DemosaicResultFinalization.unregister(this);
    return ptr;
  }

  free() {
    const ptr = this.__destroy_into_raw();
    wasm.__wbg_demosaicresult_free(ptr, 0);
  }
  /**
   * @returns {number}
   */
  get width() {
    const ret = wasm.demosaicresult_width(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * @returns {number}
   */
  get gain_b() {
    const ret = wasm.demosaicresult_gain_b(this.__wbg_ptr);
    return ret;
  }
  /**
   * @returns {number}
   */
  get gain_g() {
    const ret = wasm.demosaicresult_gain_g(this.__wbg_ptr);
    return ret;
  }
  /**
   * @returns {number}
   */
  get gain_r() {
    const ret = wasm.demosaicresult_gain_r(this.__wbg_ptr);
    return ret;
  }
  /**
   * @returns {number}
   */
  get height() {
    const ret = wasm.demosaicresult_height(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * @returns {number}
   */
  get channels() {
    const ret = wasm.demosaicresult_channels(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * @returns {Float32Array}
   */
  take_data() {
    const ret = wasm.demosaicresult_take_data(this.__wbg_ptr);
    var v1 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v1;
  }
}
if (Symbol.dispose) DemosaicResult.prototype[Symbol.dispose] = DemosaicResult.prototype.free;

const ExrResultFinalization =
  typeof FinalizationRegistry === 'undefined'
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_exrresult_free(ptr >>> 0, 1));

export class ExrResult {
  static __wrap(ptr) {
    ptr = ptr >>> 0;
    const obj = Object.create(ExrResult.prototype);
    obj.__wbg_ptr = ptr;
    ExrResultFinalization.register(obj, obj.__wbg_ptr, obj);
    return obj;
  }

  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;
    ExrResultFinalization.unregister(this);
    return ptr;
  }

  free() {
    const ptr = this.__destroy_into_raw();
    wasm.__wbg_exrresult_free(ptr, 0);
  }
  /**
   * @returns {string}
   */
  get all_tags_json() {
    let deferred1_0;
    let deferred1_1;
    try {
      const ret = wasm.exrresult_all_tags_json(this.__wbg_ptr);
      deferred1_0 = ret[0];
      deferred1_1 = ret[1];
      return getStringFromWasm0(ret[0], ret[1]);
    } finally {
      wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
  }
  /**
   * @returns {number}
   */
  get timing_pack_ms() {
    const ret = wasm.decodedarray_type_max(this.__wbg_ptr);
    return ret;
  }
  /**
   * @returns {number}
   */
  get timing_read_ms() {
    const ret = wasm.decodedarray_type_min(this.__wbg_ptr);
    return ret;
  }
  /**
   * @returns {number}
   */
  get timing_total_ms() {
    const ret = wasm.decodedarray_data_min(this.__wbg_ptr);
    return ret;
  }
  /**
   * @returns {Float32Array}
   */
  take_data_as_f32() {
    const ret = wasm.exrresult_take_data_as_f32(this.__wbg_ptr);
    var v1 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v1;
  }
  /**
   * @returns {string}
   */
  get channel_names_csv() {
    let deferred1_0;
    let deferred1_1;
    try {
      const ret = wasm.exrresult_channel_names_csv(this.__wbg_ptr);
      deferred1_0 = ret[0];
      deferred1_1 = ret[1];
      return getStringFromWasm0(ret[0], ret[1]);
    } finally {
      wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
  }
  /**
   * @returns {string}
   */
  get displayed_channels_csv() {
    let deferred1_0;
    let deferred1_1;
    try {
      const ret = wasm.exrresult_displayed_channels_csv(this.__wbg_ptr);
      deferred1_0 = ret[0];
      deferred1_1 = ret[1];
      return getStringFromWasm0(ret[0], ret[1]);
    } finally {
      wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
  }
  /**
   * @returns {number}
   */
  get width() {
    const ret = wasm.exrresult_width(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * @returns {number}
   */
  get format() {
    const ret = wasm.decodedarray_height(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * @returns {number}
   */
  get height() {
    const ret = wasm.exrresult_height(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * @returns {number}
   */
  get channels() {
    const ret = wasm.decodedarray_width(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * @returns {number}
   */
  get data_max() {
    const ret = wasm.decodedarray_non_finite_count(this.__wbg_ptr);
    return ret;
  }
  /**
   * @returns {number}
   */
  get data_min() {
    const ret = wasm.decodedarray_data_max(this.__wbg_ptr);
    return ret;
  }
  /**
   * @returns {number}
   */
  get data_type() {
    const ret = wasm.decodedarray_channels(this.__wbg_ptr);
    return ret >>> 0;
  }
}
if (Symbol.dispose) ExrResult.prototype[Symbol.dispose] = ExrResult.prototype.free;

const ExrZipPlanJsFinalization =
  typeof FinalizationRegistry === 'undefined'
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_exrzipplanjs_free(ptr >>> 0, 1));
/**
 * Metadata plus the independently compressed scanline blocks for the common
 * single-channel Float32 ZIP16 EXR layout. `None` means the caller must use
 * the full compatibility decoder.
 */
export class ExrZipPlanJs {
  static __wrap(ptr) {
    ptr = ptr >>> 0;
    const obj = Object.create(ExrZipPlanJs.prototype);
    obj.__wbg_ptr = ptr;
    ExrZipPlanJsFinalization.register(obj, obj.__wbg_ptr, obj);
    return obj;
  }

  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;
    ExrZipPlanJsFinalization.unregister(this);
    return ptr;
  }

  free() {
    const ptr = this.__destroy_into_raw();
    wasm.__wbg_exrzipplanjs_free(ptr, 0);
  }
  /**
   * @returns {string}
   */
  get channel_name() {
    let deferred1_0;
    let deferred1_1;
    try {
      const ret = wasm.exrzipplanjs_channel_name(this.__wbg_ptr);
      deferred1_0 = ret[0];
      deferred1_1 = ret[1];
      return getStringFromWasm0(ret[0], ret[1]);
    } finally {
      wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
  }
  /**
   * @returns {string}
   */
  get all_tags_json() {
    let deferred1_0;
    let deferred1_1;
    try {
      const ret = wasm.exrzipplanjs_all_tags_json(this.__wbg_ptr);
      deferred1_0 = ret[0];
      deferred1_1 = ret[1];
      return getStringFromWasm0(ret[0], ret[1]);
    } finally {
      wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
  }
  /**
   * @returns {Int32Array}
   */
  get y_coordinates() {
    const ret = wasm.exrzipplanjs_y_coordinates(this.__wbg_ptr);
    var v1 = getArrayI32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v1;
  }
  /**
   * Move the compressed payload into JavaScript without retaining a second
   * copy in the plan object.
   * @returns {Uint8Array}
   */
  take_compressed() {
    const ret = wasm.exrzipplanjs_take_compressed(this.__wbg_ptr);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
  }
  /**
   * @returns {number}
   */
  get width() {
    const ret = wasm.exrzipplanjs_width(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * @returns {Uint32Array}
   */
  get counts() {
    const ret = wasm.exrzipplanjs_counts(this.__wbg_ptr);
    var v1 = getArrayU32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v1;
  }
  /**
   * @returns {number}
   */
  get data_y() {
    const ret = wasm.exrzipplanjs_data_y(this.__wbg_ptr);
    return ret;
  }
  /**
   * @returns {number}
   */
  get height() {
    const ret = wasm.decodedarray_bits_per_sample(this.__wbg_ptr);
    return ret >>> 0;
  }
}
if (Symbol.dispose) ExrZipPlanJs.prototype[Symbol.dispose] = ExrZipPlanJs.prototype.free;

const HdrResultFinalization =
  typeof FinalizationRegistry === 'undefined'
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_hdrresult_free(ptr >>> 0, 1));

export class HdrResult {
  static __wrap(ptr) {
    ptr = ptr >>> 0;
    const obj = Object.create(HdrResult.prototype);
    obj.__wbg_ptr = ptr;
    HdrResultFinalization.register(obj, obj.__wbg_ptr, obj);
    return obj;
  }

  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;
    HdrResultFinalization.unregister(this);
    return ptr;
  }

  free() {
    const ptr = this.__destroy_into_raw();
    wasm.__wbg_hdrresult_free(ptr, 0);
  }
  /**
   * @returns {string}
   */
  get all_tags_json() {
    let deferred1_0;
    let deferred1_1;
    try {
      const ret = wasm.hdrresult_all_tags_json(this.__wbg_ptr);
      deferred1_0 = ret[0];
      deferred1_1 = ret[1];
      return getStringFromWasm0(ret[0], ret[1]);
    } finally {
      wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
  }
  /**
   * @returns {Float32Array}
   */
  take_data_as_f32() {
    const ret = wasm.hdrresult_take_data_as_f32(this.__wbg_ptr);
    var v1 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v1;
  }
  /**
   * @returns {Float64Array}
   */
  take_metadata_as_f64() {
    const ret = wasm.hdrresult_take_metadata_as_f64(this.__wbg_ptr);
    var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v1;
  }
  /**
   * @returns {number}
   */
  get channels() {
    const ret = wasm.hdrresult_channels(this.__wbg_ptr);
    return ret >>> 0;
  }
}
if (Symbol.dispose) HdrResult.prototype[Symbol.dispose] = HdrResult.prototype.free;

const HistogramResultFinalization =
  typeof FinalizationRegistry === 'undefined'
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_histogramresult_free(ptr >>> 0, 1));
/**
 * A 256-bin histogram of a scalar plane. Small enough that getters clone
 * rather than following the one-shot `take_*` convention used for
 * full-resolution rasters.
 */
export class HistogramResult {
  static __wrap(ptr) {
    ptr = ptr >>> 0;
    const obj = Object.create(HistogramResult.prototype);
    obj.__wbg_ptr = ptr;
    HistogramResultFinalization.register(obj, obj.__wbg_ptr, obj);
    return obj;
  }

  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;
    HistogramResultFinalization.unregister(this);
    return ptr;
  }

  free() {
    const ptr = this.__destroy_into_raw();
    wasm.__wbg_histogramresult_free(ptr, 0);
  }
  /**
   * @returns {number}
   */
  get non_finite_count() {
    const ret = wasm.histogramresult_non_finite_count(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * @returns {number}
   */
  get max() {
    const ret = wasm.decodedarray_type_max(this.__wbg_ptr);
    return ret;
  }
  /**
   * @returns {number}
   */
  get min() {
    const ret = wasm.decodedarray_type_min(this.__wbg_ptr);
    return ret;
  }
  /**
   * @returns {number}
   */
  get total() {
    const ret = wasm.histogramresult_total(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * @returns {Int32Array}
   */
  get counts() {
    const ret = wasm.histogramresult_counts(this.__wbg_ptr);
    var v1 = getArrayI32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v1;
  }
}
if (Symbol.dispose) HistogramResult.prototype[Symbol.dispose] = HistogramResult.prototype.free;

const ImageStatsFinalization =
  typeof FinalizationRegistry === 'undefined'
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_imagestats_free(ptr >>> 0, 1));
/**
 * Result of `compute_image_stats_f32/u8/u16`, ported from
 * `ImageStatsCalculator` in `media/modules/normalization-helper.ts`. Unlike
 * `DecodedArray`, this is small (7 numbers) so it uses plain getters —
 * no one-shot `take_*` contract needed.
 */
export class ImageStats {
  static __wrap(ptr) {
    ptr = ptr >>> 0;
    const obj = Object.create(ImageStats.prototype);
    obj.__wbg_ptr = ptr;
    ImageStatsFinalization.register(obj, obj.__wbg_ptr, obj);
    return obj;
  }

  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;
    ImageStatsFinalization.unregister(this);
    return ptr;
  }

  free() {
    const ptr = this.__destroy_into_raw();
    wasm.__wbg_imagestats_free(ptr, 0);
  }
  /**
   * @returns {number}
   */
  get total_count() {
    const ret = wasm.imagestats_total_count(this.__wbg_ptr);
    return ret;
  }
  /**
   * @returns {number}
   */
  get valid_count() {
    const ret = wasm.decodedarray_non_finite_count(this.__wbg_ptr);
    return ret;
  }
  /**
   * @returns {number}
   */
  get non_finite_count() {
    const ret = wasm.decodedarray_valid_count(this.__wbg_ptr);
    return ret;
  }
  /**
   * @returns {number}
   */
  get max() {
    const ret = wasm.decodedarray_type_max(this.__wbg_ptr);
    return ret;
  }
  /**
   * @returns {number}
   */
  get min() {
    const ret = wasm.decodedarray_type_min(this.__wbg_ptr);
    return ret;
  }
  /**
   * @returns {number}
   */
  get std() {
    const ret = wasm.decodedarray_data_max(this.__wbg_ptr);
    return ret;
  }
  /**
   * @returns {number}
   */
  get mean() {
    const ret = wasm.decodedarray_data_min(this.__wbg_ptr);
    return ret;
  }
}
if (Symbol.dispose) ImageStats.prototype[Symbol.dispose] = ImageStats.prototype.free;

const JpegResultFinalization =
  typeof FinalizationRegistry === 'undefined'
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_jpegresult_free(ptr >>> 0, 1));

export class JpegResult {
  static __wrap(ptr) {
    ptr = ptr >>> 0;
    const obj = Object.create(JpegResult.prototype);
    obj.__wbg_ptr = ptr;
    JpegResultFinalization.register(obj, obj.__wbg_ptr, obj);
    return obj;
  }

  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;
    JpegResultFinalization.unregister(this);
    return ptr;
  }

  free() {
    const ptr = this.__destroy_into_raw();
    wasm.__wbg_jpegresult_free(ptr, 0);
  }
  /**
   * @returns {Uint8Array}
   */
  take_data_as_u8() {
    const ret = wasm.jpegresult_take_data_as_u8(this.__wbg_ptr);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
  }
  /**
   * @returns {number}
   */
  get width() {
    const ret = wasm.demosaicresult_width(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * @returns {number}
   */
  get height() {
    const ret = wasm.demosaicresult_height(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * @returns {number}
   */
  get channels() {
    const ret = wasm.demosaicresult_channels(this.__wbg_ptr);
    return ret >>> 0;
  }
}
if (Symbol.dispose) JpegResult.prototype[Symbol.dispose] = JpegResult.prototype.free;

const LabelResultFinalization =
  typeof FinalizationRegistry === 'undefined'
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_labelresult_free(ptr >>> 0, 1));
/**
 * Connected-component labelling result.
 *
 * `take_labels_as_i32` follows the same one-shot convention as
 * `DecodedArray`: a full-resolution label image is large, so it is moved out
 * rather than copied, and a second call fails loudly instead of returning an
 * empty array.
 */
export class LabelResult {
  static __wrap(ptr) {
    ptr = ptr >>> 0;
    const obj = Object.create(LabelResult.prototype);
    obj.__wbg_ptr = ptr;
    LabelResultFinalization.register(obj, obj.__wbg_ptr, obj);
    return obj;
  }

  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;
    LabelResultFinalization.unregister(this);
    return ptr;
  }

  free() {
    const ptr = this.__destroy_into_raw();
    wasm.__wbg_labelresult_free(ptr, 0);
  }
  /**
   * Moves the label image out. One-shot; see `DecodedArray::take_data_as_f32`.
   * @returns {Int32Array}
   */
  take_labels_as_i32() {
    const ret = wasm.labelresult_take_labels_as_i32(this.__wbg_ptr);
    if (ret[3]) {
      throw takeFromExternrefTable0(ret[2]);
    }
    var v1 = getArrayI32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v1;
  }
  /**
   * @returns {number}
   */
  get count() {
    const ret = wasm.demosaicresult_width(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * @returns {number}
   */
  get width() {
    const ret = wasm.demosaicresult_height(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * @returns {number}
   */
  get height() {
    const ret = wasm.demosaicresult_channels(this.__wbg_ptr);
    return ret >>> 0;
  }
}
if (Symbol.dispose) LabelResult.prototype[Symbol.dispose] = LabelResult.prototype.free;

const PngResultFinalization =
  typeof FinalizationRegistry === 'undefined'
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_pngresult_free(ptr >>> 0, 1));

export class PngResult {
  static __wrap(ptr) {
    ptr = ptr >>> 0;
    const obj = Object.create(PngResult.prototype);
    obj.__wbg_ptr = ptr;
    PngResultFinalization.register(obj, obj.__wbg_ptr, obj);
    return obj;
  }

  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;
    PngResultFinalization.unregister(this);
    return ptr;
  }

  free() {
    const ptr = this.__destroy_into_raw();
    wasm.__wbg_pngresult_free(ptr, 0);
  }
  /**
   * @returns {number}
   */
  get color_type() {
    const ret = wasm.decodedarray_width(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * @returns {number}
   */
  get timing_total_ms() {
    const ret = wasm.decodedarray_data_max(this.__wbg_ptr);
    return ret;
  }
  /**
   * @returns {Uint16Array}
   */
  take_data_as_u16() {
    const ret = wasm.pngresult_take_data_as_u16(this.__wbg_ptr);
    var v1 = getArrayU16FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 2, 2);
    return v1;
  }
  /**
   * @returns {number}
   */
  get timing_decode_ms() {
    const ret = wasm.decodedarray_type_max(this.__wbg_ptr);
    return ret;
  }
  /**
   * @returns {number}
   */
  get timing_convert_ms() {
    const ret = wasm.decodedarray_data_min(this.__wbg_ptr);
    return ret;
  }
  /**
   * @returns {number}
   */
  get timing_read_info_ms() {
    const ret = wasm.decodedarray_type_min(this.__wbg_ptr);
    return ret;
  }
  /**
   * @returns {number}
   */
  get width() {
    const ret = wasm.pngresult_width(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * @returns {number}
   */
  get height() {
    const ret = wasm.pngresult_height(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * @returns {number}
   */
  get channels() {
    const ret = wasm.exrresult_width(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * @returns {number}
   */
  get bit_depth() {
    const ret = wasm.exrresult_height(this.__wbg_ptr);
    return ret >>> 0;
  }
}
if (Symbol.dispose) PngResult.prototype[Symbol.dispose] = PngResult.prototype.free;

const RgbaLayerCompositorFinalization =
  typeof FinalizationRegistry === 'undefined'
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_rgbalayercompositor_free(ptr >>> 0, 1));
/**
 * Persistent full-resolution RGBA compositor used by the layer worker.
 *
 * Keeping the accumulation buffer in WASM is important: only each source
 * layer crosses the JS/WASM boundary once and only the finished composite is
 * copied back. The TypeScript compositor remains the correctness fallback for
 * hierarchy, masks, adjustments, arithmetic modes, and non-RGBA stacks.
 */
export class RgbaLayerCompositor {
  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;
    RgbaLayerCompositorFinalization.unregister(this);
    return ptr;
  }

  free() {
    const ptr = this.__destroy_into_raw();
    wasm.__wbg_rgbalayercompositor_free(ptr, 0);
  }
  /**
   * @returns {number}
   */
  get covered_count() {
    const ret = wasm.exrzipplanjs_width(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * @param {Int8Array} source
   * @param {number} width
   * @param {number} height
   * @param {number} channels
   * @param {number} source_type_max
   * @param {number} offset_x
   * @param {number} offset_y
   * @param {number} opacity
   * @param {number} blend_mode
   */
  add_channels_i8(
    source,
    width,
    height,
    channels,
    source_type_max,
    offset_x,
    offset_y,
    opacity,
    blend_mode
  ) {
    const ptr0 = passArray8ToWasm0(source, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.rgbalayercompositor_add_channels_i8(
      this.__wbg_ptr,
      ptr0,
      len0,
      width,
      height,
      channels,
      source_type_max,
      offset_x,
      offset_y,
      opacity,
      blend_mode
    );
    if (ret[1]) {
      throw takeFromExternrefTable0(ret[0]);
    }
  }
  /**
   * @param {Uint8Array} source
   * @param {number} width
   * @param {number} height
   * @param {number} channels
   * @param {number} source_type_max
   * @param {number} offset_x
   * @param {number} offset_y
   * @param {number} opacity
   * @param {number} blend_mode
   */
  add_channels_u8(
    source,
    width,
    height,
    channels,
    source_type_max,
    offset_x,
    offset_y,
    opacity,
    blend_mode
  ) {
    const ptr0 = passArray8ToWasm0(source, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.rgbalayercompositor_add_channels_u8(
      this.__wbg_ptr,
      ptr0,
      len0,
      width,
      height,
      channels,
      source_type_max,
      offset_x,
      offset_y,
      opacity,
      blend_mode
    );
    if (ret[1]) {
      throw takeFromExternrefTable0(ret[0]);
    }
  }
  /**
   * @param {number} opacity
   * @param {number} blend_mode
   */
  finish_isolated(opacity, blend_mode) {
    const ret = wasm.rgbalayercompositor_finish_isolated(this.__wbg_ptr, opacity, blend_mode);
    if (ret[1]) {
      throw takeFromExternrefTable0(ret[0]);
    }
  }
  /**
   * @param {Float32Array} source
   * @param {number} width
   * @param {number} height
   * @param {number} channels
   * @param {number} source_type_max
   * @param {number} offset_x
   * @param {number} offset_y
   * @param {number} opacity
   * @param {number} blend_mode
   */
  add_channels_f32(
    source,
    width,
    height,
    channels,
    source_type_max,
    offset_x,
    offset_y,
    opacity,
    blend_mode
  ) {
    const ptr0 = passArrayF32ToWasm0(source, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.rgbalayercompositor_add_channels_f32(
      this.__wbg_ptr,
      ptr0,
      len0,
      width,
      height,
      channels,
      source_type_max,
      offset_x,
      offset_y,
      opacity,
      blend_mode
    );
    if (ret[1]) {
      throw takeFromExternrefTable0(ret[0]);
    }
  }
  /**
   * @param {Float64Array} source
   * @param {number} width
   * @param {number} height
   * @param {number} channels
   * @param {number} source_type_max
   * @param {number} offset_x
   * @param {number} offset_y
   * @param {number} opacity
   * @param {number} blend_mode
   */
  add_channels_f64(
    source,
    width,
    height,
    channels,
    source_type_max,
    offset_x,
    offset_y,
    opacity,
    blend_mode
  ) {
    const ptr0 = passArrayF64ToWasm0(source, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.rgbalayercompositor_add_channels_f64(
      this.__wbg_ptr,
      ptr0,
      len0,
      width,
      height,
      channels,
      source_type_max,
      offset_x,
      offset_y,
      opacity,
      blend_mode
    );
    if (ret[1]) {
      throw takeFromExternrefTable0(ret[0]);
    }
  }
  /**
   * @param {Int16Array} source
   * @param {number} width
   * @param {number} height
   * @param {number} channels
   * @param {number} source_type_max
   * @param {number} offset_x
   * @param {number} offset_y
   * @param {number} opacity
   * @param {number} blend_mode
   */
  add_channels_i16(
    source,
    width,
    height,
    channels,
    source_type_max,
    offset_x,
    offset_y,
    opacity,
    blend_mode
  ) {
    const ptr0 = passArray16ToWasm0(source, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.rgbalayercompositor_add_channels_i16(
      this.__wbg_ptr,
      ptr0,
      len0,
      width,
      height,
      channels,
      source_type_max,
      offset_x,
      offset_y,
      opacity,
      blend_mode
    );
    if (ret[1]) {
      throw takeFromExternrefTable0(ret[0]);
    }
  }
  /**
   * @param {Int32Array} source
   * @param {number} width
   * @param {number} height
   * @param {number} channels
   * @param {number} source_type_max
   * @param {number} offset_x
   * @param {number} offset_y
   * @param {number} opacity
   * @param {number} blend_mode
   */
  add_channels_i32(
    source,
    width,
    height,
    channels,
    source_type_max,
    offset_x,
    offset_y,
    opacity,
    blend_mode
  ) {
    const ptr0 = passArray32ToWasm0(source, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.rgbalayercompositor_add_channels_i32(
      this.__wbg_ptr,
      ptr0,
      len0,
      width,
      height,
      channels,
      source_type_max,
      offset_x,
      offset_y,
      opacity,
      blend_mode
    );
    if (ret[1]) {
      throw takeFromExternrefTable0(ret[0]);
    }
  }
  /**
   * @param {Uint16Array} source
   * @param {number} width
   * @param {number} height
   * @param {number} channels
   * @param {number} source_type_max
   * @param {number} offset_x
   * @param {number} offset_y
   * @param {number} opacity
   * @param {number} blend_mode
   */
  add_channels_u16(
    source,
    width,
    height,
    channels,
    source_type_max,
    offset_x,
    offset_y,
    opacity,
    blend_mode
  ) {
    const ptr0 = passArray16ToWasm0(source, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.rgbalayercompositor_add_channels_u16(
      this.__wbg_ptr,
      ptr0,
      len0,
      width,
      height,
      channels,
      source_type_max,
      offset_x,
      offset_y,
      opacity,
      blend_mode
    );
    if (ret[1]) {
      throw takeFromExternrefTable0(ret[0]);
    }
  }
  /**
   * @param {Uint32Array} source
   * @param {number} width
   * @param {number} height
   * @param {number} channels
   * @param {number} source_type_max
   * @param {number} offset_x
   * @param {number} offset_y
   * @param {number} opacity
   * @param {number} blend_mode
   */
  add_channels_u32(
    source,
    width,
    height,
    channels,
    source_type_max,
    offset_x,
    offset_y,
    opacity,
    blend_mode
  ) {
    const ptr0 = passArray32ToWasm0(source, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.rgbalayercompositor_add_channels_u32(
      this.__wbg_ptr,
      ptr0,
      len0,
      width,
      height,
      channels,
      source_type_max,
      offset_x,
      offset_y,
      opacity,
      blend_mode
    );
    if (ret[1]) {
      throw takeFromExternrefTable0(ret[0]);
    }
  }
  /**
   * Start an isolated clipping surface from one 8-bit RGBA raster. Filters
   * modify this straight-colour surface before its original blend mode and
   * opacity are applied to the main document.
   * @param {Uint8Array} source
   * @param {number} width
   * @param {number} height
   * @param {number} offset_x
   * @param {number} offset_y
   */
  begin_isolated_u8(source, width, height, offset_x, offset_y) {
    const ptr0 = passArray8ToWasm0(source, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.rgbalayercompositor_begin_isolated_u8(
      this.__wbg_ptr,
      ptr0,
      len0,
      width,
      height,
      offset_x,
      offset_y
    );
    if (ret[1]) {
      throw takeFromExternrefTable0(ret[0]);
    }
  }
  /**
   * @param {Float32Array} source
   * @param {number} width
   * @param {number} height
   * @param {number} source_type_max
   * @param {number} offset_x
   * @param {number} offset_y
   */
  begin_isolated_f32(source, width, height, source_type_max, offset_x, offset_y) {
    const ptr0 = passArrayF32ToWasm0(source, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.rgbalayercompositor_begin_isolated_f32(
      this.__wbg_ptr,
      ptr0,
      len0,
      width,
      height,
      source_type_max,
      offset_x,
      offset_y
    );
    if (ret[1]) {
      throw takeFromExternrefTable0(ret[0]);
    }
  }
  /**
   * @param {Uint16Array} source
   * @param {number} width
   * @param {number} height
   * @param {number} source_type_max
   * @param {number} offset_x
   * @param {number} offset_y
   */
  begin_isolated_u16(source, width, height, source_type_max, offset_x, offset_y) {
    const ptr0 = passArray16ToWasm0(source, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.rgbalayercompositor_begin_isolated_u16(
      this.__wbg_ptr,
      ptr0,
      len0,
      width,
      height,
      source_type_max,
      offset_x,
      offset_y
    );
    if (ret[1]) {
      throw takeFromExternrefTable0(ret[0]);
    }
  }
  /**
   * @param {number} hue_degrees
   * @param {number} saturation_delta
   * @param {number} lightness_delta
   * @param {boolean} colorize
   * @param {number} amount
   */
  isolated_apply_hue(hue_degrees, saturation_delta, lightness_delta, colorize, amount) {
    const ret = wasm.rgbalayercompositor_isolated_apply_hue(
      this.__wbg_ptr,
      hue_degrees,
      saturation_delta,
      lightness_delta,
      colorize,
      amount
    );
    if (ret[1]) {
      throw takeFromExternrefTable0(ret[0]);
    }
  }
  /**
   * Apply three 256-entry channel LUTs to the active isolated surface.
   * Values in the LUT use the compositor's native value range.
   * @param {Float32Array} tables
   * @param {number} amount
   */
  isolated_apply_lut(tables, amount) {
    const ptr0 = passArrayF32ToWasm0(tables, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.rgbalayercompositor_isolated_apply_lut(this.__wbg_ptr, ptr0, len0, amount);
    if (ret[1]) {
      throw takeFromExternrefTable0(ret[0]);
    }
  }
  /**
   * Apply the remaining pixel-local document adjustments. The operation
   * codes and compact parameter layouts are defined by the layer worker:
   * 2 brightness/contrast, 3 exposure, 4 invert, 5 channel mixer,
   * 6 color balance, 7 black & white, 8 threshold, 9 posterize,
   * 10 gradient-map LUT.
   * @param {number} operation
   * @param {Float32Array} parameters
   * @param {number} amount
   */
  isolated_apply_direct(operation, parameters, amount) {
    const ptr0 = passArrayF32ToWasm0(parameters, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.rgbalayercompositor_isolated_apply_direct(
      this.__wbg_ptr,
      operation,
      ptr0,
      len0,
      amount
    );
    if (ret[1]) {
      throw takeFromExternrefTable0(ret[0]);
    }
  }
  /**
   * @param {number} channels
   * @returns {Float32Array}
   */
  take_data_as_channels(channels) {
    const ret = wasm.rgbalayercompositor_take_data_as_channels(this.__wbg_ptr, channels);
    if (ret[3]) {
      throw takeFromExternrefTable0(ret[2]);
    }
    var v1 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v1;
  }
  /**
   * @returns {Float32Array}
   */
  take_isolated_surface() {
    const ret = wasm.rgbalayercompositor_take_isolated_surface(this.__wbg_ptr);
    if (ret[3]) {
      throw takeFromExternrefTable0(ret[2]);
    }
    var v1 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v1;
  }
  /**
   * @param {Float32Array} source
   * @param {number} source_type_max
   * @param {number} opacity
   * @param {number} blend_mode
   */
  isolated_add_f32_surface(source, source_type_max, opacity, blend_mode) {
    const ptr0 = passArrayF32ToWasm0(source, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.rgbalayercompositor_isolated_add_f32_surface(
      this.__wbg_ptr,
      ptr0,
      len0,
      source_type_max,
      opacity,
      blend_mode
    );
    if (ret[1]) {
      throw takeFromExternrefTable0(ret[0]);
    }
  }
  /**
   * @param {Float32Array} source
   * @param {number} source_type_max
   * @param {number} opacity
   * @param {number} blend_mode
   */
  add_arithmetic_f32_surface(source, source_type_max, opacity, blend_mode) {
    const ptr0 = passArrayF32ToWasm0(source, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.rgbalayercompositor_add_arithmetic_f32_surface(
      this.__wbg_ptr,
      ptr0,
      len0,
      source_type_max,
      opacity,
      blend_mode
    );
    if (ret[1]) {
      throw takeFromExternrefTable0(ret[0]);
    }
  }
  /**
   * @param {Uint8Array} mask
   * @param {number} width
   * @param {number} height
   * @param {number} channels
   * @param {number} type_max
   * @param {number} offset_x
   * @param {number} offset_y
   * @param {boolean} invert
   */
  isolated_apply_alpha_mask_u8(
    mask,
    width,
    height,
    channels,
    type_max,
    offset_x,
    offset_y,
    invert
  ) {
    const ptr0 = passArray8ToWasm0(mask, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.rgbalayercompositor_isolated_apply_alpha_mask_u8(
      this.__wbg_ptr,
      ptr0,
      len0,
      width,
      height,
      channels,
      type_max,
      offset_x,
      offset_y,
      invert
    );
    if (ret[1]) {
      throw takeFromExternrefTable0(ret[0]);
    }
  }
  /**
   * Apply master plus six selective hue/saturation ranges. `parameters`
   * contains master H/S/L followed by six records of
   * a/b/c/d/H/S/L for red, yellow, green, cyan, blue, and magenta.
   * @param {Float32Array} parameters
   * @param {number} amount
   */
  isolated_apply_selective_hue(parameters, amount) {
    const ptr0 = passArrayF32ToWasm0(parameters, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.rgbalayercompositor_isolated_apply_selective_hue(
      this.__wbg_ptr,
      ptr0,
      len0,
      amount
    );
    if (ret[1]) {
      throw takeFromExternrefTable0(ret[0]);
    }
  }
  /**
   * @param {Float32Array} mask
   * @param {number} width
   * @param {number} height
   * @param {number} channels
   * @param {number} type_max
   * @param {number} offset_x
   * @param {number} offset_y
   * @param {boolean} invert
   */
  isolated_apply_alpha_mask_f32(
    mask,
    width,
    height,
    channels,
    type_max,
    offset_x,
    offset_y,
    invert
  ) {
    const ptr0 = passArrayF32ToWasm0(mask, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.rgbalayercompositor_isolated_apply_alpha_mask_f32(
      this.__wbg_ptr,
      ptr0,
      len0,
      width,
      height,
      channels,
      type_max,
      offset_x,
      offset_y,
      invert
    );
    if (ret[1]) {
      throw takeFromExternrefTable0(ret[0]);
    }
  }
  /**
   * @param {Uint16Array} mask
   * @param {number} width
   * @param {number} height
   * @param {number} channels
   * @param {number} type_max
   * @param {number} offset_x
   * @param {number} offset_y
   * @param {boolean} invert
   */
  isolated_apply_alpha_mask_u16(
    mask,
    width,
    height,
    channels,
    type_max,
    offset_x,
    offset_y,
    invert
  ) {
    const ptr0 = passArray16ToWasm0(mask, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.rgbalayercompositor_isolated_apply_alpha_mask_u16(
      this.__wbg_ptr,
      ptr0,
      len0,
      width,
      height,
      channels,
      type_max,
      offset_x,
      offset_y,
      invert
    );
    if (ret[1]) {
      throw takeFromExternrefTable0(ret[0]);
    }
  }
  isolated_begin_masked_adjustment() {
    const ret = wasm.rgbalayercompositor_isolated_begin_masked_adjustment(this.__wbg_ptr);
    if (ret[1]) {
      throw takeFromExternrefTable0(ret[0]);
    }
  }
  /**
   * @param {Float32Array} source
   * @param {number} source_type_max
   * @param {number} condition
   * @param {number} threshold
   */
  apply_brightness_mask_f32_surface(source, source_type_max, condition, threshold) {
    const ptr0 = passArrayF32ToWasm0(source, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.rgbalayercompositor_apply_brightness_mask_f32_surface(
      this.__wbg_ptr,
      ptr0,
      len0,
      source_type_max,
      condition,
      threshold
    );
    if (ret[1]) {
      throw takeFromExternrefTable0(ret[0]);
    }
  }
  /**
   * @param {Float32Array} source
   * @param {number} source_type_max
   * @param {number} opacity
   * @param {number} blend_mode
   */
  isolated_add_arithmetic_f32_surface(source, source_type_max, opacity, blend_mode) {
    const ptr0 = passArrayF32ToWasm0(source, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.rgbalayercompositor_isolated_add_arithmetic_f32_surface(
      this.__wbg_ptr,
      ptr0,
      len0,
      source_type_max,
      opacity,
      blend_mode
    );
    if (ret[1]) {
      throw takeFromExternrefTable0(ret[0]);
    }
  }
  /**
   * @param {Uint8Array} mask
   * @param {number} width
   * @param {number} height
   * @param {number} channels
   * @param {number} type_max
   * @param {number} offset_x
   * @param {number} offset_y
   * @param {boolean} invert
   */
  isolated_finish_masked_adjustment_u8(
    mask,
    width,
    height,
    channels,
    type_max,
    offset_x,
    offset_y,
    invert
  ) {
    const ptr0 = passArray8ToWasm0(mask, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.rgbalayercompositor_isolated_finish_masked_adjustment_u8(
      this.__wbg_ptr,
      ptr0,
      len0,
      width,
      height,
      channels,
      type_max,
      offset_x,
      offset_y,
      invert
    );
    if (ret[1]) {
      throw takeFromExternrefTable0(ret[0]);
    }
  }
  /**
   * @param {Float32Array} mask
   * @param {number} width
   * @param {number} height
   * @param {number} channels
   * @param {number} type_max
   * @param {number} offset_x
   * @param {number} offset_y
   * @param {boolean} invert
   */
  isolated_finish_masked_adjustment_f32(
    mask,
    width,
    height,
    channels,
    type_max,
    offset_x,
    offset_y,
    invert
  ) {
    const ptr0 = passArrayF32ToWasm0(mask, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.rgbalayercompositor_isolated_finish_masked_adjustment_f32(
      this.__wbg_ptr,
      ptr0,
      len0,
      width,
      height,
      channels,
      type_max,
      offset_x,
      offset_y,
      invert
    );
    if (ret[1]) {
      throw takeFromExternrefTable0(ret[0]);
    }
  }
  /**
   * @param {Uint16Array} mask
   * @param {number} width
   * @param {number} height
   * @param {number} channels
   * @param {number} type_max
   * @param {number} offset_x
   * @param {number} offset_y
   * @param {boolean} invert
   */
  isolated_finish_masked_adjustment_u16(
    mask,
    width,
    height,
    channels,
    type_max,
    offset_x,
    offset_y,
    invert
  ) {
    const ptr0 = passArray16ToWasm0(mask, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.rgbalayercompositor_isolated_finish_masked_adjustment_u16(
      this.__wbg_ptr,
      ptr0,
      len0,
      width,
      height,
      channels,
      type_max,
      offset_x,
      offset_y,
      invert
    );
    if (ret[1]) {
      throw takeFromExternrefTable0(ret[0]);
    }
  }
  /**
   * @param {number} width
   * @param {number} height
   * @param {number} type_max
   */
  constructor(width, height, type_max) {
    const ret = wasm.rgbalayercompositor_new(width, height, type_max);
    if (ret[2]) {
      throw takeFromExternrefTable0(ret[1]);
    }
    this.__wbg_ptr = ret[0] >>> 0;
    RgbaLayerCompositorFinalization.register(this, this.__wbg_ptr, this);
    return this;
  }
  /**
   * @param {Uint8Array} source
   * @param {number} width
   * @param {number} height
   * @param {number} offset_x
   * @param {number} offset_y
   * @param {number} opacity
   * @param {number} blend_mode
   */
  add_u8(source, width, height, offset_x, offset_y, opacity, blend_mode) {
    const ptr0 = passArray8ToWasm0(source, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.rgbalayercompositor_add_u8(
      this.__wbg_ptr,
      ptr0,
      len0,
      width,
      height,
      offset_x,
      offset_y,
      opacity,
      blend_mode
    );
    if (ret[1]) {
      throw takeFromExternrefTable0(ret[0]);
    }
  }
  /**
   * @param {Float32Array} source
   * @param {number} width
   * @param {number} height
   * @param {number} source_type_max
   * @param {number} offset_x
   * @param {number} offset_y
   * @param {number} opacity
   * @param {number} blend_mode
   */
  add_f32(source, width, height, source_type_max, offset_x, offset_y, opacity, blend_mode) {
    const ptr0 = passArrayF32ToWasm0(source, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.rgbalayercompositor_add_f32(
      this.__wbg_ptr,
      ptr0,
      len0,
      width,
      height,
      source_type_max,
      offset_x,
      offset_y,
      opacity,
      blend_mode
    );
    if (ret[1]) {
      throw takeFromExternrefTable0(ret[0]);
    }
  }
  /**
   * @param {Uint16Array} source
   * @param {number} width
   * @param {number} height
   * @param {number} source_type_max
   * @param {number} offset_x
   * @param {number} offset_y
   * @param {number} opacity
   * @param {number} blend_mode
   */
  add_u16(source, width, height, source_type_max, offset_x, offset_y, opacity, blend_mode) {
    const ptr0 = passArray16ToWasm0(source, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.rgbalayercompositor_add_u16(
      this.__wbg_ptr,
      ptr0,
      len0,
      width,
      height,
      source_type_max,
      offset_x,
      offset_y,
      opacity,
      blend_mode
    );
    if (ret[1]) {
      throw takeFromExternrefTable0(ret[0]);
    }
  }
  /**
   * @returns {number}
   */
  get max_value() {
    const ret = wasm.rgbalayercompositor_max_value(this.__wbg_ptr);
    return ret;
  }
  /**
   * @returns {number}
   */
  get min_value() {
    const ret = wasm.rgbalayercompositor_min_value(this.__wbg_ptr);
    return ret;
  }
  /**
   * @returns {Float32Array}
   */
  take_data() {
    const ret = wasm.rgbalayercompositor_take_data(this.__wbg_ptr);
    var v1 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v1;
  }
}
if (Symbol.dispose)
  RgbaLayerCompositor.prototype[Symbol.dispose] = RgbaLayerCompositor.prototype.free;

const StabilityCurveResultFinalization =
  typeof FinalizationRegistry === 'undefined'
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_stabilitycurveresult_free(ptr >>> 0, 1));
/**
 * Object count / area-fraction as a function of threshold, for the stability
 * curve UI. Small result (default 64 points), so getters clone.
 */
export class StabilityCurveResult {
  static __wrap(ptr) {
    ptr = ptr >>> 0;
    const obj = Object.create(StabilityCurveResult.prototype);
    obj.__wbg_ptr = ptr;
    StabilityCurveResultFinalization.register(obj, obj.__wbg_ptr, obj);
    return obj;
  }

  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;
    StabilityCurveResultFinalization.unregister(this);
    return ptr;
  }

  free() {
    const ptr = this.__destroy_into_raw();
    wasm.__wbg_stabilitycurveresult_free(ptr, 0);
  }
  /**
   * @returns {Uint32Array}
   */
  get object_counts() {
    const ret = wasm.stabilitycurveresult_object_counts(this.__wbg_ptr);
    var v1 = getArrayU32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v1;
  }
  /**
   * @returns {number}
   */
  get plateau_width() {
    const ret = wasm.stabilitycurveresult_plateau_width(this.__wbg_ptr);
    return ret;
  }
  /**
   * @returns {number}
   */
  get suggested_bin() {
    const ret = wasm.exrresult_height(this.__wbg_ptr);
    return ret;
  }
  /**
   * @returns {Float64Array}
   */
  get area_fractions() {
    const ret = wasm.stabilitycurveresult_area_fractions(this.__wbg_ptr);
    var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v1;
  }
  /**
   * @returns {Int32Array}
   */
  get bins() {
    const ret = wasm.stabilitycurveresult_bins(this.__wbg_ptr);
    var v1 = getArrayI32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v1;
  }
  /**
   * @returns {Float64Array}
   */
  get values() {
    const ret = wasm.stabilitycurveresult_values(this.__wbg_ptr);
    var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v1;
  }
}
if (Symbol.dispose)
  StabilityCurveResult.prototype[Symbol.dispose] = StabilityCurveResult.prototype.free;

const TiffFloatStripPlanJsFinalization =
  typeof FinalizationRegistry === 'undefined'
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_tifffloatstripplanjs_free(ptr >>> 0, 1));

export class TiffFloatStripPlanJs {
  static __wrap(ptr) {
    ptr = ptr >>> 0;
    const obj = Object.create(TiffFloatStripPlanJs.prototype);
    obj.__wbg_ptr = ptr;
    TiffFloatStripPlanJsFinalization.register(obj, obj.__wbg_ptr, obj);
    return obj;
  }

  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;
    TiffFloatStripPlanJsFinalization.unregister(this);
    return ptr;
  }

  free() {
    const ptr = this.__destroy_into_raw();
    wasm.__wbg_tifffloatstripplanjs_free(ptr, 0);
  }
  /**
   * @returns {number}
   */
  get tile_width() {
    const ret = wasm.exrzipplanjs_data_y(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * Blocks in the file, which is what `offsets`/`counts` list.
   * @returns {number}
   */
  get block_count() {
    const ret = wasm.tifffloatstripplanjs_block_count(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * @returns {number}
   */
  get compression() {
    const ret = wasm.pngresult_height(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * @returns {number}
   */
  get orientation() {
    const ret = wasm.decodedarray_height(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * Units of work, NOT blocks: tile rows for a tiled file.
   * @returns {number}
   */
  get strip_count() {
    const ret = wasm.tifffloatstripplanjs_strip_count(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * @returns {number}
   */
  get tile_length() {
    const ret = wasm.decodedarray_sample_kind(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * @returns {number}
   */
  get blocks_across() {
    const ret = wasm.tifffloatstripplanjs_blocks_across(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * @returns {boolean}
   */
  get little_endian() {
    const ret = wasm.tifffloatstripplanjs_little_endian(this.__wbg_ptr);
    return ret !== 0;
  }
  /**
   * @returns {number}
   */
  get sample_format() {
    const ret = wasm.exrresult_height(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * @returns {number}
   */
  get rows_per_strip() {
    const ret = wasm.decodedarray_bits_per_sample(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * @returns {number}
   */
  get bits_per_sample() {
    const ret = wasm.hdrresult_channels(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * Blocks per unit of work: 1 for strips, one per tile column for tiles.
   * @returns {number}
   */
  get blocks_per_unit() {
    const ret = wasm.tifffloatstripplanjs_blocks_per_unit(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * @returns {number}
   */
  get planar_configuration() {
    const ret = wasm.stabilitycurveresult_plateau_width(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * @returns {number}
   */
  get photometric_interpretation() {
    const ret = wasm.exrzipplanjs_width(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * @returns {number}
   */
  get lerc_additional_compression() {
    const ret = wasm.tifffloatstripplanjs_lerc_additional_compression(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * @returns {number}
   */
  get width() {
    const ret = wasm.histogramresult_non_finite_count(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * @returns {Float64Array}
   */
  get counts() {
    const ret = wasm.tifffloatstripplanjs_counts(this.__wbg_ptr);
    var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v1;
  }
  /**
   * @returns {number}
   */
  get height() {
    const ret = wasm.tifffloatstripplanjs_height(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * Strip byte offsets as f64 (exact for any offset below 2^53, which covers
   * BigTIFF in practice and avoids BigInt64Array plumbing on the JS side).
   * @returns {Float64Array}
   */
  get offsets() {
    const ret = wasm.tifffloatstripplanjs_offsets(this.__wbg_ptr);
    var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v1;
  }
  /**
   * @returns {number}
   */
  get channels() {
    const ret = wasm.tifffloatstripplanjs_channels(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * @returns {number}
   */
  get predictor() {
    const ret = wasm.tifffloatstripplanjs_predictor(this.__wbg_ptr);
    return ret >>> 0;
  }
}
if (Symbol.dispose)
  TiffFloatStripPlanJs.prototype[Symbol.dispose] = TiffFloatStripPlanJs.prototype.free;

const TiffRegionDecoderFinalization =
  typeof FinalizationRegistry === 'undefined'
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_tiffregiondecoder_free(ptr >>> 0, 1));
/**
 * A TIFF source retained inside WebAssembly for repeated viewport reads.
 *
 * Passing `&[u8]` through wasm-bindgen copies the source into linear memory.
 * Keeping that copy here makes the cost occur once when an image is opened,
 * rather than once per tile (which is prohibitive for large local COGs).
 */
export class TiffRegionDecoder {
  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;
    TiffRegionDecoderFinalization.unregister(this);
    return ptr;
  }

  free() {
    const ptr = this.__destroy_into_raw();
    wasm.__wbg_tiffregiondecoder_free(ptr, 0);
  }
  /**
   * @param {Uint8Array} data
   */
  constructor(data) {
    const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.tiffregiondecoder_new(ptr0, len0);
    this.__wbg_ptr = ret >>> 0;
    TiffRegionDecoderFinalization.register(this, this.__wbg_ptr, this);
    return this;
  }
  /**
   * @param {number} page_index
   * @param {number} x
   * @param {number} y
   * @param {number} width
   * @param {number} height
   * @returns {TiffRegionJs}
   */
  decode(page_index, x, y, width, height) {
    const ret = wasm.tiffregiondecoder_decode(this.__wbg_ptr, page_index, x, y, width, height);
    if (ret[2]) {
      throw takeFromExternrefTable0(ret[1]);
    }
    return TiffRegionJs.__wrap(ret[0]);
  }
}
if (Symbol.dispose) TiffRegionDecoder.prototype[Symbol.dispose] = TiffRegionDecoder.prototype.free;

const TiffRegionJsFinalization =
  typeof FinalizationRegistry === 'undefined'
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_tiffregionjs_free(ptr >>> 0, 1));
/**
 * One rectangle of one page, decoded on its own.
 *
 * The cost follows the rectangle rather than the image, which is what lets a
 * viewport of a gigapixel scene be shown at full resolution. Returns an error
 * for layouts that are only decoded whole; the caller falls back to
 * `decode_tiff_page`.
 */
export class TiffRegionJs {
  static __wrap(ptr) {
    ptr = ptr >>> 0;
    const obj = Object.create(TiffRegionJs.prototype);
    obj.__wbg_ptr = ptr;
    TiffRegionJsFinalization.register(obj, obj.__wbg_ptr, obj);
    return obj;
  }

  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;
    TiffRegionJsFinalization.unregister(this);
    return ptr;
  }

  free() {
    const ptr = this.__destroy_into_raw();
    wasm.__wbg_tiffregionjs_free(ptr, 0);
  }
  /**
   * @returns {number}
   */
  get sample_format() {
    const ret = wasm.hdrresult_channels(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * Strips or tiles actually read. The number a caller watches to confirm
   * the cost is following the window and not the file.
   * @returns {number}
   */
  get blocks_decoded() {
    const ret = wasm.pngresult_height(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * @returns {number}
   */
  get bits_per_sample() {
    const ret = wasm.tifffloatstripplanjs_channels(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * Moves the samples out; a second call returns an empty array, as with the
   * other decode results.
   * @returns {Float32Array}
   */
  take_data_as_f32() {
    const ret = wasm.tiffregionjs_take_data_as_f32(this.__wbg_ptr);
    var v1 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v1;
  }
  /**
   * @returns {number}
   */
  get x() {
    const ret = wasm.demosaicresult_width(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * @returns {number}
   */
  get y() {
    const ret = wasm.demosaicresult_height(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * @returns {number}
   */
  get width() {
    const ret = wasm.demosaicresult_channels(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * @returns {number}
   */
  get height() {
    const ret = wasm.histogramresult_non_finite_count(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * @returns {number}
   */
  get channels() {
    const ret = wasm.tifffloatstripplanjs_height(this.__wbg_ptr);
    return ret >>> 0;
  }
}
if (Symbol.dispose) TiffRegionJs.prototype[Symbol.dispose] = TiffRegionJs.prototype.free;

const TiffResultFinalization =
  typeof FinalizationRegistry === 'undefined'
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_tiffresult_free(ptr >>> 0, 1));

export class TiffResult {
  static __wrap(ptr) {
    ptr = ptr >>> 0;
    const obj = Object.create(TiffResult.prototype);
    obj.__wbg_ptr = ptr;
    TiffResultFinalization.register(obj, obj.__wbg_ptr, obj);
    return obj;
  }

  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;
    TiffResultFinalization.unregister(this);
    return ptr;
  }

  free() {
    const ptr = this.__destroy_into_raw();
    wasm.__wbg_tiffresult_free(ptr, 0);
  }
  /**
   * @returns {number}
   */
  get tile_count() {
    const ret = wasm.tiffresult_tile_count(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * @returns {number}
   */
  get tile_width() {
    const ret = wasm.tiffresult_tile_width(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * @returns {number}
   */
  get compression() {
    const ret = wasm.tiffresult_compression(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * @returns {number}
   */
  get sample_kind() {
    const ret = wasm.tiffresult_sample_kind(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * @returns {number}
   */
  get strip_count() {
    const ret = wasm.tiffresult_strip_count(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * @returns {number}
   */
  get tile_length() {
    const ret = wasm.tiffresult_tile_length(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * @returns {string}
   */
  get all_tags_json() {
    let deferred1_0;
    let deferred1_1;
    try {
      const ret = wasm.tiffresult_all_tags_json(this.__wbg_ptr);
      deferred1_0 = ret[0];
      deferred1_1 = ret[1];
      return getStringFromWasm0(ret[0], ret[1]);
    } finally {
      wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
  }
  /**
   * @returns {boolean}
   */
  get direct_decode() {
    const ret = wasm.tiffresult_direct_decode(this.__wbg_ptr);
    return ret !== 0;
  }
  /**
   * @returns {number}
   */
  get sample_format() {
    const ret = wasm.tiffresult_sample_format(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * @returns {Uint8Array}
   */
  get_data_bytes() {
    const ret = wasm.tiffresult_get_data_bytes(this.__wbg_ptr);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
  }
  /**
   * @returns {number}
   */
  get rows_per_strip() {
    const ret = wasm.tiffresult_rows_per_strip(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * @returns {number}
   */
  get timing_pack_ms() {
    const ret = wasm.tiffresult_timing_pack_ms(this.__wbg_ptr);
    return ret;
  }
  /**
   * @returns {number}
   */
  get bits_per_sample() {
    const ret = wasm.tiffresult_bits_per_sample(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * @returns {Float32Array}
   */
  get_data_as_f32() {
    const ret = wasm.tiffresult_get_data_as_f32(this.__wbg_ptr);
    var v1 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v1;
  }
  /**
   * @returns {Uint8Array}
   */
  take_data_as_u8() {
    const ret = wasm.tiffresult_take_data_as_u8(this.__wbg_ptr);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
  }
  /**
   * @returns {number}
   */
  get timing_stats_ms() {
    const ret = wasm.tiffresult_timing_stats_ms(this.__wbg_ptr);
    return ret;
  }
  /**
   * @returns {Float32Array}
   */
  take_data_as_f32() {
    const ret = wasm.tiffresult_take_data_as_f32(this.__wbg_ptr);
    var v1 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v1;
  }
  /**
   * @returns {number}
   */
  get timing_decode_ms() {
    const ret = wasm.decodedarray_valid_count(this.__wbg_ptr);
    return ret;
  }
  /**
   * @returns {number}
   */
  get timing_convert_ms() {
    const ret = wasm.imagestats_total_count(this.__wbg_ptr);
    return ret;
  }
  /**
   * @returns {number}
   */
  get timing_metadata_ms() {
    const ret = wasm.decodedarray_non_finite_count(this.__wbg_ptr);
    return ret;
  }
  /**
   * What the file's other images are — pages, pyramid overviews, or masks —
   * as JSON. Empty for a file with no readable directory. See
   * `formats::tiff::pages`.
   * @returns {string}
   */
  get page_directory_json() {
    let deferred1_0;
    let deferred1_1;
    try {
      const ret = wasm.tiffresult_page_directory_json(this.__wbg_ptr);
      deferred1_0 = ret[0];
      deferred1_1 = ret[1];
      return getStringFromWasm0(ret[0], ret[1]);
    } finally {
      wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
  }
  /**
   * @returns {number}
   */
  get planar_configuration() {
    const ret = wasm.tiffresult_planar_configuration(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * @returns {number}
   */
  get strip_byte_count_max() {
    const ret = wasm.tiffresult_strip_byte_count_max(this.__wbg_ptr);
    return ret;
  }
  /**
   * @returns {number}
   */
  get strip_byte_count_total() {
    const ret = wasm.tiffresult_strip_byte_count_total(this.__wbg_ptr);
    return ret;
  }
  /**
   * @returns {number}
   */
  get photometric_interpretation() {
    const ret = wasm.tiffresult_photometric_interpretation(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * @returns {number}
   */
  get width() {
    const ret = wasm.decodedarray_source_data_offset(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * @returns {number}
   */
  get height() {
    const ret = wasm.tifffloatstripplanjs_lerc_additional_compression(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * @returns {string}
   */
  get ome_xml() {
    let deferred1_0;
    let deferred1_1;
    try {
      const ret = wasm.tiffresult_ome_xml(this.__wbg_ptr);
      deferred1_0 = ret[0];
      deferred1_1 = ret[1];
      return getStringFromWasm0(ret[0], ret[1]);
    } finally {
      wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
  }
  /**
   * @returns {number}
   */
  get channels() {
    const ret = wasm.tiffresult_channels(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * @returns {number}
   */
  get data_len() {
    const ret = wasm.tiffresult_data_len(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * GeoTIFF georeferencing as JSON — the unpacked key directory's CRS plus
   * the raster-to-model transform. Empty for a TIFF that carries none.
   * @returns {string}
   */
  get geo_json() {
    let deferred1_0;
    let deferred1_1;
    try {
      const ret = wasm.tiffresult_geo_json(this.__wbg_ptr);
      deferred1_0 = ret[0];
      deferred1_1 = ret[1];
      return getStringFromWasm0(ret[0], ret[1]);
    } finally {
      wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
  }
  /**
   * @returns {number}
   */
  get max_value() {
    const ret = wasm.decodedarray_data_max(this.__wbg_ptr);
    return ret;
  }
  /**
   * @returns {number}
   */
  get min_value() {
    const ret = wasm.decodedarray_data_min(this.__wbg_ptr);
    return ret;
  }
  /**
   * @returns {number}
   */
  get predictor() {
    const ret = wasm.tiffresult_predictor(this.__wbg_ptr);
    return ret >>> 0;
  }
}
if (Symbol.dispose) TiffResult.prototype[Symbol.dispose] = TiffResult.prototype.free;

const TiffStripMetadataJsFinalization =
  typeof FinalizationRegistry === 'undefined'
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_tiffstripmetadatajs_free(ptr >>> 0, 1));

export class TiffStripMetadataJs {
  static __wrap(ptr) {
    ptr = ptr >>> 0;
    const obj = Object.create(TiffStripMetadataJs.prototype);
    obj.__wbg_ptr = ptr;
    TiffStripMetadataJsFinalization.register(obj, obj.__wbg_ptr, obj);
    return obj;
  }

  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;
    TiffStripMetadataJsFinalization.unregister(this);
    return ptr;
  }

  free() {
    const ptr = this.__destroy_into_raw();
    wasm.__wbg_tiffstripmetadatajs_free(ptr, 0);
  }
  /**
   * @returns {number}
   */
  get page_count() {
    const ret = wasm.exrresult_height(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * @returns {string}
   */
  get all_tags_json() {
    let deferred1_0;
    let deferred1_1;
    try {
      const ret = wasm.tiffstripmetadatajs_all_tags_json(this.__wbg_ptr);
      deferred1_0 = ret[0];
      deferred1_1 = ret[1];
      return getStringFromWasm0(ret[0], ret[1]);
    } finally {
      wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
  }
  /**
   * @returns {string}
   */
  get page_directory_json() {
    let deferred1_0;
    let deferred1_1;
    try {
      const ret = wasm.tiffstripmetadatajs_page_directory_json(this.__wbg_ptr);
      deferred1_0 = ret[0];
      deferred1_1 = ret[1];
      return getStringFromWasm0(ret[0], ret[1]);
    } finally {
      wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
  }
  /**
   * @returns {number}
   */
  get photometric_interpretation() {
    const ret = wasm.stabilitycurveresult_plateau_width(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * @returns {string}
   */
  get ome_xml() {
    let deferred1_0;
    let deferred1_1;
    try {
      const ret = wasm.tiffstripmetadatajs_ome_xml(this.__wbg_ptr);
      deferred1_0 = ret[0];
      deferred1_1 = ret[1];
      return getStringFromWasm0(ret[0], ret[1]);
    } finally {
      wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
  }
  /**
   * @returns {string}
   */
  get geo_json() {
    let deferred1_0;
    let deferred1_1;
    try {
      const ret = wasm.tiffstripmetadatajs_geo_json(this.__wbg_ptr);
      deferred1_0 = ret[0];
      deferred1_1 = ret[1];
      return getStringFromWasm0(ret[0], ret[1]);
    } finally {
      wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
  }
}
if (Symbol.dispose)
  TiffStripMetadataJs.prototype[Symbol.dispose] = TiffStripMetadataJs.prototype.free;

const EXPECTED_RESPONSE_TYPES = new Set(['basic', 'cors', 'default']);

async function __wbg_load(module, imports) {
  if (typeof Response === 'function' && module instanceof Response) {
    if (typeof WebAssembly.instantiateStreaming === 'function') {
      try {
        return await WebAssembly.instantiateStreaming(module, imports);
      } catch (e) {
        const validResponse = module.ok && EXPECTED_RESPONSE_TYPES.has(module.type);

        if (validResponse && module.headers.get('Content-Type') !== 'application/wasm') {
          console.warn(
            '`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n',
            e
          );
        } else {
          throw e;
        }
      }
    }

    const bytes = await module.arrayBuffer();
    return await WebAssembly.instantiate(bytes, imports);
  } else {
    const instance = await WebAssembly.instantiate(module, imports);

    if (instance instanceof WebAssembly.Instance) {
      return { instance, module };
    } else {
      return instance;
    }
  }
}

function __wbg_get_imports() {
  const imports = {};
  imports.wbg = {};
  imports.wbg.__wbg___wbindgen_throw_b855445ff6a94295 = function (arg0, arg1) {
    throw new Error(getStringFromWasm0(arg0, arg1));
  };
  imports.wbg.__wbg_error_7534b8e9a36f1ab4 = function (arg0, arg1) {
    let deferred0_0;
    let deferred0_1;
    try {
      deferred0_0 = arg0;
      deferred0_1 = arg1;
      console.error(getStringFromWasm0(arg0, arg1));
    } finally {
      wasm.__wbindgen_free(deferred0_0, deferred0_1, 1);
    }
  };
  imports.wbg.__wbg_length_4126f257d88ef51e = function (arg0) {
    const ret = arg0.length;
    return ret;
  };
  imports.wbg.__wbg_length_58bec3c3f0487eb5 = function (arg0) {
    const ret = arg0.length;
    return ret;
  };
  imports.wbg.__wbg_length_69bca3cb64fc8748 = function (arg0) {
    const ret = arg0.length;
    return ret;
  };
  imports.wbg.__wbg_new_8a6f238a6ece86ea = function () {
    const ret = new Error();
    return ret;
  };
  imports.wbg.__wbg_now_793306c526e2e3b6 = function () {
    const ret = Date.now();
    return ret;
  };
  imports.wbg.__wbg_set_7a75d83ea249c6e0 = function (arg0, arg1, arg2) {
    arg0.set(getArrayU16FromWasm0(arg1, arg2));
  };
  imports.wbg.__wbg_set_9e6516df7b7d0f19 = function (arg0, arg1, arg2) {
    arg0.set(getArrayU8FromWasm0(arg1, arg2));
  };
  imports.wbg.__wbg_set_eaa55bcb7597ecca = function (arg0, arg1, arg2) {
    arg0.set(getArrayF32FromWasm0(arg1, arg2));
  };
  imports.wbg.__wbg_stack_0ed75d68575b0f3c = function (arg0, arg1) {
    const ret = arg1.stack;
    const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
    getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
  };
  imports.wbg.__wbg_subarray_480600f3d6a9f26c = function (arg0, arg1, arg2) {
    const ret = arg0.subarray(arg1 >>> 0, arg2 >>> 0);
    return ret;
  };
  imports.wbg.__wbg_subarray_b24c6237257bcd4d = function (arg0, arg1, arg2) {
    const ret = arg0.subarray(arg1 >>> 0, arg2 >>> 0);
    return ret;
  };
  imports.wbg.__wbg_subarray_e9ae4d887d066081 = function (arg0, arg1, arg2) {
    const ret = arg0.subarray(arg1 >>> 0, arg2 >>> 0);
    return ret;
  };
  imports.wbg.__wbindgen_cast_2241b6af4c4b2941 = function (arg0, arg1) {
    // Cast intrinsic for `Ref(String) -> Externref`.
    const ret = getStringFromWasm0(arg0, arg1);
    return ret;
  };
  imports.wbg.__wbindgen_init_externref_table = function () {
    const table = wasm.__wbindgen_externrefs;
    const offset = table.grow(4);
    table.set(0, undefined);
    table.set(offset + 0, undefined);
    table.set(offset + 1, null);
    table.set(offset + 2, true);
    table.set(offset + 3, false);
  };

  return imports;
}

function __wbg_finalize_init(instance, module) {
  wasm = instance.exports;
  __wbg_init.__wbindgen_wasm_module = module;
  cachedDataViewMemory0 = null;
  cachedFloat32ArrayMemory0 = null;
  cachedFloat64ArrayMemory0 = null;
  cachedInt32ArrayMemory0 = null;
  cachedUint16ArrayMemory0 = null;
  cachedUint32ArrayMemory0 = null;
  cachedUint8ArrayMemory0 = null;

  wasm.__wbindgen_start();
  return wasm;
}

function initSync(module) {
  if (wasm !== undefined) return wasm;

  if (typeof module !== 'undefined') {
    if (Object.getPrototypeOf(module) === Object.prototype) {
      ({ module } = module);
    } else {
      console.warn('using deprecated parameters for `initSync()`; pass a single object instead');
    }
  }

  const imports = __wbg_get_imports();

  if (!(module instanceof WebAssembly.Module)) {
    module = new WebAssembly.Module(module);
  }

  const instance = new WebAssembly.Instance(module, imports);

  return __wbg_finalize_init(instance, module);
}

async function __wbg_init(module_or_path) {
  if (wasm !== undefined) return wasm;

  if (typeof module_or_path !== 'undefined') {
    if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
      ({ module_or_path } = module_or_path);
    } else {
      console.warn(
        'using deprecated parameters for the initialization function; pass a single object instead'
      );
    }
  }

  if (typeof module_or_path === 'undefined') {
    module_or_path = new URL('wasm/codec-wasm.wasm', import.meta.url);
  }
  const imports = __wbg_get_imports();

  if (
    typeof module_or_path === 'string' ||
    (typeof Request === 'function' && module_or_path instanceof Request) ||
    (typeof URL === 'function' && module_or_path instanceof URL)
  ) {
    module_or_path = fetch(module_or_path);
  }

  const { instance, module } = await __wbg_load(await module_or_path, imports);

  return __wbg_finalize_init(instance, module);
}

export { initSync };
export default __wbg_init;
