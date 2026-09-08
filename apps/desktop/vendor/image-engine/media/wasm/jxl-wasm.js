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

function takeFromExternrefTable0(idx) {
  const value = wasm.__wbindgen_externrefs.get(idx);
  wasm.__externref_table_dealloc(idx);
  return value;
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

function getArrayU8FromWasm0(ptr, len) {
  ptr = ptr >>> 0;
  return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}

function passArray8ToWasm0(arg, malloc) {
  const ptr = malloc(arg.length * 1, 1) >>> 0;
  getUint8ArrayMemory0().set(arg, ptr / 1);
  WASM_VECTOR_LEN = arg.length;
  return ptr;
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
 * @returns {JxlDecoded}
 */
export function decode_jxl_fast(data) {
  const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
  const len0 = WASM_VECTOR_LEN;
  const ret = wasm.decode_jxl_fast(ptr0, len0);
  if (ret[2]) {
    throw takeFromExternrefTable0(ret[1]);
  }
  return JxlDecoded.__wrap(ret[0]);
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
 * @param {number} frame_index
 * @returns {JxlDecoded}
 */
export function decode_dicom_fast(data, frame_index) {
  const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
  const len0 = WASM_VECTOR_LEN;
  const ret = wasm.decode_dicom_fast(ptr0, len0, frame_index);
  if (ret[2]) {
    throw takeFromExternrefTable0(ret[1]);
  }
  return JxlDecoded.__wrap(ret[0]);
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

const JxlDecodedFinalization =
  typeof FinalizationRegistry === 'undefined'
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_jxldecoded_free(ptr >>> 0, 1));
/**
 * The decoded image, shaped so `assembleDecoded` in
 * `media/modules/wasm-decoders.ts` can read it unchanged.
 *
 * It is deliberately NARROWER than the main module's `DecodedArray`: JPEG XL
 * always arrives here as f32 samples (`sample_kind` 0) built inside the
 * decoder, so the u8/u16 carriers and the zero-copy `can_reuse_source` path —
 * which exist for formats whose bytes are already a JavaScript TypedArray —
 * have nothing to do. Exposing stubs for them would only invite a caller to
 * believe in a fast path that is not there.
 */
export class JxlDecoded {
  static __wrap(ptr) {
    ptr = ptr >>> 0;
    const obj = Object.create(JxlDecoded.prototype);
    obj.__wbg_ptr = ptr;
    JxlDecodedFinalization.register(obj, obj.__wbg_ptr, obj);
    return obj;
  }

  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;
    JxlDecodedFinalization.unregister(this);
    return ptr;
  }

  free() {
    const ptr = this.__destroy_into_raw();
    wasm.__wbg_jxldecoded_free(ptr, 0);
  }
  /**
   * Always 0 (f32) — see the note on the struct.
   * @returns {number}
   */
  get sample_kind() {
    const ret = wasm.jxldecoded_sample_kind(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * @returns {number}
   */
  get valid_count() {
    const ret = wasm.jxldecoded_valid_count(this.__wbg_ptr);
    return ret;
  }
  /**
   * @returns {string}
   */
  get format_label() {
    let deferred1_0;
    let deferred1_1;
    try {
      const ret = wasm.jxldecoded_format_label(this.__wbg_ptr);
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
      const ret = wasm.jxldecoded_metadata_json(this.__wbg_ptr);
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
    const ret = wasm.jxldecoded_sample_format(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * @returns {number}
   */
  get bits_per_sample() {
    const ret = wasm.jxldecoded_bits_per_sample(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * @returns {number}
   */
  get non_finite_count() {
    const ret = wasm.jxldecoded_non_finite_count(this.__wbg_ptr);
    return ret;
  }
  /**
   * ONE-SHOT, exactly like the main module's `take_data_as_f32`: the samples
   * are moved out, and a second call throws.
   * @returns {Float32Array}
   */
  take_data_as_f32() {
    const ret = wasm.jxldecoded_take_data_as_f32(this.__wbg_ptr);
    if (ret[3]) {
      throw takeFromExternrefTable0(ret[2]);
    }
    var v1 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v1;
  }
  /**
   * @returns {string}
   */
  get source_numeric_type() {
    let deferred1_0;
    let deferred1_1;
    try {
      const ret = wasm.jxldecoded_source_numeric_type(this.__wbg_ptr);
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
    const ret = wasm.jxldecoded_width(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * @returns {number}
   */
  get height() {
    const ret = wasm.jxldecoded_height(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * @returns {number}
   */
  get channels() {
    const ret = wasm.jxldecoded_channels(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * @returns {number}
   */
  get data_len() {
    const ret = wasm.jxldecoded_data_len(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * @returns {number}
   */
  get data_max() {
    const ret = wasm.jxldecoded_data_max(this.__wbg_ptr);
    return ret;
  }
  /**
   * @returns {number}
   */
  get data_min() {
    const ret = wasm.jxldecoded_data_min(this.__wbg_ptr);
    return ret;
  }
  /**
   * @returns {number}
   */
  get type_max() {
    const ret = wasm.jxldecoded_type_max(this.__wbg_ptr);
    return ret;
  }
  /**
   * @returns {number}
   */
  get type_min() {
    const ret = wasm.jxldecoded_type_min(this.__wbg_ptr);
    return ret;
  }
}
if (Symbol.dispose) JxlDecoded.prototype[Symbol.dispose] = JxlDecoded.prototype.free;

const TiffResultFinalization =
  typeof FinalizationRegistry === 'undefined'
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_tiffresult_free(ptr >>> 0, 1));
/**
 * TIFF result contract mirrored from the main adapter. Keeping the container
 * whole preserves orientation, tags, page navigation, and OME/Geo metadata.
 */
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
   * @returns {number}
   */
  get rows_per_strip() {
    const ret = wasm.tiffresult_rows_per_strip(this.__wbg_ptr);
    return ret >>> 0;
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
   * @returns {Float32Array}
   */
  take_data_as_f32() {
    const ret = wasm.tiffresult_take_data_as_f32(this.__wbg_ptr);
    var v1 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v1;
  }
  /**
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
    const ret = wasm.tiffresult_width(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * @returns {number}
   */
  get height() {
    const ret = wasm.tiffresult_height(this.__wbg_ptr);
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
    const ret = wasm.jxldecoded_data_max(this.__wbg_ptr);
    return ret;
  }
  /**
   * @returns {number}
   */
  get min_value() {
    const ret = wasm.jxldecoded_data_min(this.__wbg_ptr);
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
  imports.wbg.__wbg_new_8a6f238a6ece86ea = function () {
    const ret = new Error();
    return ret;
  };
  imports.wbg.__wbg_now_793306c526e2e3b6 = function () {
    const ret = Date.now();
    return ret;
  };
  imports.wbg.__wbg_stack_0ed75d68575b0f3c = function (arg0, arg1) {
    const ret = arg1.stack;
    const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
    getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
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
    module_or_path = new URL('wasm/jxl-wasm.wasm', import.meta.url);
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
