let wasm_bindgen;
(function () {
  const __exports = {};
  let script_src;
  if (typeof document !== 'undefined' && document.currentScript !== null) {
    script_src = new URL(document.currentScript.src, location.href).toString();
  }
  let wasm = undefined;

  let cachedUint8ArrayMemory0 = null;

  function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
      cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
  }

  let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });

  cachedTextDecoder.decode();

  function decodeText(ptr, len) {
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
  /**
   * Decode a TIFF file without eagerly computing min/max statistics.
   *
   * The webview render path computes stats lazily when a non-gamma mode needs
   * them. Skipping eager stats saves a full pass over large float TIFFs during
   * the common gamma-mode initial load.
   * @param {Uint8Array} data
   * @returns {TiffResult}
   */
  __exports.decode_tiff_fast = function (data) {
    const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.decode_tiff_fast(ptr0, len0);
    if (ret[2]) {
      throw takeFromExternrefTable0(ret[1]);
    }
    return TiffResult.__wrap(ret[0]);
  };

  /**
   * @param {Uint8Array} data
   * @returns {ExrResult}
   */
  __exports.decode_exr_fast = function (data) {
    const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.decode_exr_fast(ptr0, len0);
    if (ret[2]) {
      throw takeFromExternrefTable0(ret[1]);
    }
    return ExrResult.__wrap(ret[0]);
  };

  function passArrayF32ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 4, 4) >>> 0;
    getFloat32ArrayMemory0().set(arg, ptr / 4);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
  }
  /**
   * @param {Float32Array} data
   * @param {number} width
   * @param {number} height
   * @param {string} kind
   * @param {string} camera_model
   * @param {string} convention
   * @param {number} fx
   * @param {number} fy
   * @param {number} cx
   * @param {number} cy
   * @param {number} k1
   * @param {number} k2
   * @param {number} k3
   * @param {number} k4
   * @param {number} k5
   * @param {number} p1
   * @param {number} p2
   * @returns {DepthProjectResult}
   */
  __exports.project_depth_fast = function (
    data,
    width,
    height,
    kind,
    camera_model,
    convention,
    fx,
    fy,
    cx,
    cy,
    k1,
    k2,
    k3,
    k4,
    k5,
    p1,
    p2
  ) {
    const ptr0 = passArrayF32ToWasm0(data, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passStringToWasm0(kind, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passStringToWasm0(camera_model, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len2 = WASM_VECTOR_LEN;
    const ptr3 = passStringToWasm0(convention, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len3 = WASM_VECTOR_LEN;
    const ret = wasm.project_depth_fast(
      ptr0,
      len0,
      width,
      height,
      ptr1,
      len1,
      ptr2,
      len2,
      ptr3,
      len3,
      fx,
      fy,
      cx,
      cy,
      k1,
      k2,
      k3,
      k4,
      k5,
      p1,
      p2
    );
    if (ret[2]) {
      throw takeFromExternrefTable0(ret[1]);
    }
    return DepthProjectResult.__wrap(ret[0]);
  };

  /**
   * Decode a TIFF file from an ArrayBuffer
   * Returns TiffResult with image data and metadata
   * @param {Uint8Array} data
   * @returns {TiffResult}
   */
  __exports.decode_tiff = function (data) {
    const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.decode_tiff(ptr0, len0);
    if (ret[2]) {
      throw takeFromExternrefTable0(ret[1]);
    }
    return TiffResult.__wrap(ret[0]);
  };

  /**
   * @param {Uint8Array} data
   * @returns {PngResult}
   */
  __exports.decode_png16_fast = function (data) {
    const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.decode_png16_fast(ptr0, len0);
    if (ret[2]) {
      throw takeFromExternrefTable0(ret[1]);
    }
    return PngResult.__wrap(ret[0]);
  };

  /**
   * @param {Uint8Array} data
   * @returns {HdrResult}
   */
  __exports.decode_hdr_fast = function (data) {
    const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.decode_hdr_fast(ptr0, len0);
    if (ret[2]) {
      throw takeFromExternrefTable0(ret[1]);
    }
    return HdrResult.__wrap(ret[0]);
  };

  let cachedFloat64ArrayMemory0 = null;

  function getFloat64ArrayMemory0() {
    if (cachedFloat64ArrayMemory0 === null || cachedFloat64ArrayMemory0.byteLength === 0) {
      cachedFloat64ArrayMemory0 = new Float64Array(wasm.memory.buffer);
    }
    return cachedFloat64ArrayMemory0;
  }

  function getArrayF64FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getFloat64ArrayMemory0().subarray(ptr / 8, ptr / 8 + len);
  }

  const DepthProjectResultFinalization =
    typeof FinalizationRegistry === 'undefined'
      ? { register: () => {}, unregister: () => {} }
      : new FinalizationRegistry(ptr => wasm.__wbg_depthprojectresult_free(ptr >>> 0, 1));

  class DepthProjectResult {
    static __wrap(ptr) {
      ptr = ptr >>> 0;
      const obj = Object.create(DepthProjectResult.prototype);
      obj.__wbg_ptr = ptr;
      DepthProjectResultFinalization.register(obj, obj.__wbg_ptr, obj);
      return obj;
    }

    __destroy_into_raw() {
      const ptr = this.__wbg_ptr;
      this.__wbg_ptr = 0;
      DepthProjectResultFinalization.unregister(this);
      return ptr;
    }

    free() {
      const ptr = this.__destroy_into_raw();
      wasm.__wbg_depthprojectresult_free(ptr, 0);
    }
    /**
     * @returns {number}
     */
    get point_count() {
      const ret = wasm.depthprojectresult_point_count(this.__wbg_ptr);
      return ret >>> 0;
    }
    /**
     * @returns {Uint8Array}
     */
    take_colors() {
      const ret = wasm.depthprojectresult_take_colors(this.__wbg_ptr);
      var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
      wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
      return v1;
    }
    /**
     * @returns {Float32Array}
     */
    take_positions() {
      const ret = wasm.depthprojectresult_take_positions(this.__wbg_ptr);
      var v1 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
      wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
      return v1;
    }
    /**
     * @returns {boolean}
     */
    get has_pixel_coords() {
      const ret = wasm.depthprojectresult_has_pixel_coords(this.__wbg_ptr);
      return ret !== 0;
    }
    /**
     * @returns {Uint16Array}
     */
    take_pixel_coords() {
      const ret = wasm.depthprojectresult_take_pixel_coords(this.__wbg_ptr);
      var v1 = getArrayU16FromWasm0(ret[0], ret[1]).slice();
      wasm.__wbindgen_free(ret[0], ret[1] * 2, 2);
      return v1;
    }
    /**
     * @returns {number}
     */
    get width() {
      const ret = wasm.depthprojectresult_width(this.__wbg_ptr);
      return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    get height() {
      const ret = wasm.depthprojectresult_height(this.__wbg_ptr);
      return ret >>> 0;
    }
  }
  if (Symbol.dispose)
    DepthProjectResult.prototype[Symbol.dispose] = DepthProjectResult.prototype.free;

  __exports.DepthProjectResult = DepthProjectResult;

  const ExrResultFinalization =
    typeof FinalizationRegistry === 'undefined'
      ? { register: () => {}, unregister: () => {} }
      : new FinalizationRegistry(ptr => wasm.__wbg_exrresult_free(ptr >>> 0, 1));

  class ExrResult {
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
     * @returns {number}
     */
    get timing_pack_ms() {
      const ret = wasm.exrresult_timing_pack_ms(this.__wbg_ptr);
      return ret;
    }
    /**
     * @returns {number}
     */
    get timing_read_ms() {
      const ret = wasm.exrresult_timing_read_ms(this.__wbg_ptr);
      return ret;
    }
    /**
     * @returns {number}
     */
    get timing_total_ms() {
      const ret = wasm.exrresult_timing_total_ms(this.__wbg_ptr);
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
      const ret = wasm.depthprojectresult_width(this.__wbg_ptr);
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
      const ret = wasm.exrresult_channels(this.__wbg_ptr);
      return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    get data_type() {
      const ret = wasm.exrresult_data_type(this.__wbg_ptr);
      return ret >>> 0;
    }
  }
  if (Symbol.dispose) ExrResult.prototype[Symbol.dispose] = ExrResult.prototype.free;

  __exports.ExrResult = ExrResult;

  const HdrResultFinalization =
    typeof FinalizationRegistry === 'undefined'
      ? { register: () => {}, unregister: () => {} }
      : new FinalizationRegistry(ptr => wasm.__wbg_hdrresult_free(ptr >>> 0, 1));

  class HdrResult {
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
  }
  if (Symbol.dispose) HdrResult.prototype[Symbol.dispose] = HdrResult.prototype.free;

  __exports.HdrResult = HdrResult;

  const PngResultFinalization =
    typeof FinalizationRegistry === 'undefined'
      ? { register: () => {}, unregister: () => {} }
      : new FinalizationRegistry(ptr => wasm.__wbg_pngresult_free(ptr >>> 0, 1));

  class PngResult {
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
      const ret = wasm.pngresult_color_type(this.__wbg_ptr);
      return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    get timing_total_ms() {
      const ret = wasm.pngresult_timing_total_ms(this.__wbg_ptr);
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
      const ret = wasm.exrresult_timing_pack_ms(this.__wbg_ptr);
      return ret;
    }
    /**
     * @returns {number}
     */
    get timing_convert_ms() {
      const ret = wasm.exrresult_timing_total_ms(this.__wbg_ptr);
      return ret;
    }
    /**
     * @returns {number}
     */
    get timing_read_info_ms() {
      const ret = wasm.exrresult_timing_read_ms(this.__wbg_ptr);
      return ret;
    }
    /**
     * @returns {number}
     */
    get width() {
      const ret = wasm.exrresult_channels(this.__wbg_ptr);
      return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    get height() {
      const ret = wasm.depthprojectresult_width(this.__wbg_ptr);
      return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    get channels() {
      const ret = wasm.exrresult_data_type(this.__wbg_ptr);
      return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    get bit_depth() {
      const ret = wasm.pngresult_bit_depth(this.__wbg_ptr);
      return ret >>> 0;
    }
  }
  if (Symbol.dispose) PngResult.prototype[Symbol.dispose] = PngResult.prototype.free;

  __exports.PngResult = PngResult;

  const TiffResultFinalization =
    typeof FinalizationRegistry === 'undefined'
      ? { register: () => {}, unregister: () => {} }
      : new FinalizationRegistry(ptr => wasm.__wbg_tiffresult_free(ptr >>> 0, 1));
  /**
   * Result type for TIFF decoding operations
   */
  class TiffResult {
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
     * Get raw data as bytes (for transferring to JS)
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
     * Get data as Float32Array (most common for visualization)
     * @returns {Float32Array}
     */
    get_data_as_f32() {
      const ret = wasm.tiffresult_get_data_as_f32(this.__wbg_ptr);
      var v1 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
      wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
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
     * Move float data out of the result when possible. This avoids cloning the
     * decoded f32 vector before wasm-bindgen copies it into JS-owned memory.
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
      const ret = wasm.tiffresult_timing_decode_ms(this.__wbg_ptr);
      return ret;
    }
    /**
     * @returns {number}
     */
    get timing_convert_ms() {
      const ret = wasm.tiffresult_timing_convert_ms(this.__wbg_ptr);
      return ret;
    }
    /**
     * @returns {number}
     */
    get timing_metadata_ms() {
      const ret = wasm.tiffresult_timing_metadata_ms(this.__wbg_ptr);
      return ret;
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
     * @returns {number}
     */
    get channels() {
      const ret = wasm.tiffresult_channels(this.__wbg_ptr);
      return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    get max_value() {
      const ret = wasm.pngresult_timing_total_ms(this.__wbg_ptr);
      return ret;
    }
    /**
     * @returns {number}
     */
    get min_value() {
      const ret = wasm.exrresult_timing_total_ms(this.__wbg_ptr);
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

  __exports.TiffResult = TiffResult;

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
    imports.wbg.__wbg_log_8cec76766b8c0e33 = function (arg0) {
      console.log(arg0);
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
    cachedFloat64ArrayMemory0 = null;
    cachedUint16ArrayMemory0 = null;
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

    if (typeof module_or_path === 'undefined' && typeof script_src !== 'undefined') {
      module_or_path = script_src.replace(/\.js$/, '_bg.wasm');
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

  wasm_bindgen = Object.assign(__wbg_init, { initSync }, __exports);
})();
