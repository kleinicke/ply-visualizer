/* @ts-self-types="./pointcloud_parser.d.ts" */

export class LidarCollectionResult {
  static __wrap(ptr) {
    const obj = Object.create(LidarCollectionResult.prototype);
    obj.__wbg_ptr = ptr;
    LidarCollectionResultFinalization.register(obj, obj.__wbg_ptr, obj);
    return obj;
  }
  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;
    LidarCollectionResultFinalization.unregister(this);
    return ptr;
  }
  free() {
    const ptr = this.__destroy_into_raw();
    wasm.__wbg_lidarcollectionresult_free(ptr, 0);
  }
  /**
   * @returns {number}
   */
  get scan_count() {
    const ret = wasm.lidarcollectionresult_scan_count(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * @param {number} index
   * @returns {LidarScanResult}
   */
  take_scan(index) {
    const ret = wasm.lidarcollectionresult_take_scan(this.__wbg_ptr, index);
    if (ret[2]) {
      throw takeFromExternrefTable0(ret[1]);
    }
    return LidarScanResult.__wrap(ret[0]);
  }
}
if (Symbol.dispose)
  LidarCollectionResult.prototype[Symbol.dispose] = LidarCollectionResult.prototype.free;

/**
 * A single decoded LAS/LAZ cloud or E57 scan. Buffers are moved to JS with
 * `take_*`, avoiding an additional Rust-side clone at the WASM boundary.
 */
export class LidarScanResult {
  static __wrap(ptr) {
    const obj = Object.create(LidarScanResult.prototype);
    obj.__wbg_ptr = ptr;
    LidarScanResultFinalization.register(obj, obj.__wbg_ptr, obj);
    return obj;
  }
  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;
    LidarScanResultFinalization.unregister(this);
    return ptr;
  }
  free() {
    const ptr = this.__destroy_into_raw();
    wasm.__wbg_lidarscanresult_free(ptr, 0);
  }
  /**
   * @returns {Float32Array}
   */
  bbox() {
    const ret = wasm.lidarscanresult_bbox(this.__wbg_ptr);
    var v1 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v1;
  }
  /**
   * @returns {boolean}
   */
  get has_colors() {
    const ret = wasm.lidarscanresult_has_colors(this.__wbg_ptr);
    return ret !== 0;
  }
  /**
   * @returns {string}
   */
  get metadata_json() {
    let deferred1_0;
    let deferred1_1;
    try {
      const ret = wasm.lidarscanresult_metadata_json(this.__wbg_ptr);
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
  get name() {
    let deferred1_0;
    let deferred1_1;
    try {
      const ret = wasm.lidarscanresult_name(this.__wbg_ptr);
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
  get source_count() {
    const ret = wasm.lidarscanresult_source_count(this.__wbg_ptr);
    return ret;
  }
  /**
   * @returns {Float64Array}
   */
  source_origin() {
    const ret = wasm.lidarscanresult_source_origin(this.__wbg_ptr);
    var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v1;
  }
  /**
   * @returns {Float32Array}
   */
  take_classification() {
    const ret = wasm.lidarscanresult_take_classification(this.__wbg_ptr);
    var v1 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v1;
  }
  /**
   * @returns {Uint8Array}
   */
  take_colors() {
    const ret = wasm.lidarscanresult_take_colors(this.__wbg_ptr);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
  }
  /**
   * @returns {Float32Array}
   */
  take_column_index() {
    const ret = wasm.lidarscanresult_take_column_index(this.__wbg_ptr);
    var v1 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v1;
  }
  /**
   * @returns {Float32Array}
   */
  take_gps_time() {
    const ret = wasm.lidarscanresult_take_gps_time(this.__wbg_ptr);
    var v1 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v1;
  }
  /**
   * @returns {Float32Array}
   */
  take_intensity() {
    const ret = wasm.lidarscanresult_take_intensity(this.__wbg_ptr);
    var v1 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v1;
  }
  /**
   * @returns {Float32Array}
   */
  take_number_of_returns() {
    const ret = wasm.lidarscanresult_take_number_of_returns(this.__wbg_ptr);
    var v1 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v1;
  }
  /**
   * @returns {Float32Array}
   */
  take_point_source_id() {
    const ret = wasm.lidarscanresult_take_point_source_id(this.__wbg_ptr);
    var v1 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v1;
  }
  /**
   * @returns {Float32Array}
   */
  take_positions() {
    const ret = wasm.lidarscanresult_take_positions(this.__wbg_ptr);
    var v1 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v1;
  }
  /**
   * @returns {Float32Array}
   */
  take_return_number() {
    const ret = wasm.lidarscanresult_take_return_number(this.__wbg_ptr);
    var v1 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v1;
  }
  /**
   * @returns {Float32Array}
   */
  take_row_index() {
    const ret = wasm.lidarscanresult_take_row_index(this.__wbg_ptr);
    var v1 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v1;
  }
  /**
   * @returns {Float32Array}
   */
  take_scan_angle() {
    const ret = wasm.lidarscanresult_take_scan_angle(this.__wbg_ptr);
    var v1 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v1;
  }
  /**
   * @returns {Float32Array}
   */
  take_user_data() {
    const ret = wasm.lidarscanresult_take_user_data(this.__wbg_ptr);
    var v1 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v1;
  }
  /**
   * @returns {number}
   */
  get vertex_count() {
    const ret = wasm.lidarscanresult_vertex_count(this.__wbg_ptr);
    return ret >>> 0;
  }
}
if (Symbol.dispose) LidarScanResult.prototype[Symbol.dispose] = LidarScanResult.prototype.free;

/**
 * Parsed point cloud, returned to JS. Large buffers are moved out with the
 * `take_*` methods (no clone) the way wasm-bindgen marshals `Vec<T>`.
 */
export class PointCloudResult {
  static __wrap(ptr) {
    const obj = Object.create(PointCloudResult.prototype);
    obj.__wbg_ptr = ptr;
    PointCloudResultFinalization.register(obj, obj.__wbg_ptr, obj);
    return obj;
  }
  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;
    PointCloudResultFinalization.unregister(this);
    return ptr;
  }
  free() {
    const ptr = this.__destroy_into_raw();
    wasm.__wbg_pointcloudresult_free(ptr, 0);
  }
  /**
   * [min_x, min_y, min_z, max_x, max_y, max_z]
   * @returns {Float32Array}
   */
  bbox() {
    const ret = wasm.pointcloudresult_bbox(this.__wbg_ptr);
    var v1 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v1;
  }
  /**
   * @returns {boolean}
   */
  get has_colors() {
    const ret = wasm.pointcloudresult_has_colors(this.__wbg_ptr);
    return ret !== 0;
  }
  /**
   * @returns {boolean}
   */
  get has_intensity() {
    const ret = wasm.pointcloudresult_has_intensity(this.__wbg_ptr);
    return ret !== 0;
  }
  /**
   * @returns {boolean}
   */
  get has_normals() {
    const ret = wasm.pointcloudresult_has_normals(this.__wbg_ptr);
    return ret !== 0;
  }
  /**
   * @returns {Uint8Array}
   */
  take_colors() {
    const ret = wasm.pointcloudresult_take_colors(this.__wbg_ptr);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
  }
  /**
   * @returns {Float32Array}
   */
  take_intensity() {
    const ret = wasm.pointcloudresult_take_intensity(this.__wbg_ptr);
    var v1 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v1;
  }
  /**
   * @returns {Float32Array}
   */
  take_normals() {
    const ret = wasm.pointcloudresult_take_normals(this.__wbg_ptr);
    var v1 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v1;
  }
  /**
   * @returns {Float32Array}
   */
  take_positions() {
    const ret = wasm.pointcloudresult_take_positions(this.__wbg_ptr);
    var v1 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v1;
  }
  /**
   * @returns {number}
   */
  get vertex_count() {
    const ret = wasm.pointcloudresult_vertex_count(this.__wbg_ptr);
    return ret >>> 0;
  }
}
if (Symbol.dispose) PointCloudResult.prototype[Symbol.dispose] = PointCloudResult.prototype.free;

/**
 * Incremental parser for streaming/overlapped loading. JS reads the file in
 * chunks and calls `push` on each (while the next chunk's read is in flight),
 * then `finish`. Partial lines are stitched across chunk boundaries via carry.
 */
export class StreamParser {
  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;
    StreamParserFinalization.unregister(this);
    return ptr;
  }
  free() {
    const ptr = this.__destroy_into_raw();
    wasm.__wbg_streamparser_free(ptr, 0);
  }
  /**
   * True if a parse error occurred; the caller should discard and use the JS
   * parser (the result from `finish` would be empty/partial).
   * @returns {boolean}
   */
  get failed() {
    const ret = wasm.streamparser_failed(this.__wbg_ptr);
    return ret !== 0;
  }
  /**
   * @returns {PointCloudResult}
   */
  finish() {
    const ret = wasm.streamparser_finish(this.__wbg_ptr);
    return PointCloudResult.__wrap(ret);
  }
  /**
   * @param {string} format
   * @param {string} color_mode
   */
  constructor(format, color_mode) {
    const ptr0 = passStringToWasm0(format, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passStringToWasm0(color_mode, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.streamparser_new(ptr0, len0, ptr1, len1);
    this.__wbg_ptr = ret;
    StreamParserFinalization.register(this, this.__wbg_ptr, this);
    return this;
  }
  /**
   * @param {Uint8Array} chunk
   */
  push(chunk) {
    const ptr0 = passArray8ToWasm0(chunk, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    wasm.streamparser_push(this.__wbg_ptr, ptr0, len0);
  }
}
if (Symbol.dispose) StreamParser.prototype[Symbol.dispose] = StreamParser.prototype.free;

/**
 * Reserve `len` bytes in WASM memory and return the offset. Caller fills it,
 * passes it to `parse_at`, then releases it with `dealloc`.
 * @param {number} len
 * @returns {number}
 */
export function alloc(len) {
  const ret = wasm.alloc(len);
  return ret >>> 0;
}

/**
 * Free a buffer previously returned by `alloc`.
 * @param {number} ptr
 * @param {number} len
 */
export function dealloc(ptr, len) {
  wasm.dealloc(ptr, len);
}

/**
 * Parse an ASCII PLY: read the header to learn the vertex count + property
 * order, then parse the vertex rows. Falls back to an error string the JS side
 * can catch (and use its own parser) on anything unexpected.
 * @param {Uint8Array} data
 * @returns {PointCloudResult}
 */
export function parse_ascii_ply(data) {
  const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
  const len0 = WASM_VECTOR_LEN;
  const ret = wasm.parse_ascii_ply(ptr0, len0);
  if (ret[2]) {
    throw takeFromExternrefTable0(ret[1]);
  }
  return PointCloudResult.__wrap(ret[0]);
}

/**
 * Parse a buffer already sitting in WASM memory at `ptr`/`len`.
 * @param {number} ptr
 * @param {number} len
 * @param {string} format
 * @returns {PointCloudResult}
 */
export function parse_at(ptr, len, format) {
  const ptr0 = passStringToWasm0(format, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
  const len0 = WASM_VECTOR_LEN;
  const ret = wasm.parse_at(ptr, len, ptr0, len0);
  if (ret[2]) {
    throw takeFromExternrefTable0(ret[1]);
  }
  return PointCloudResult.__wrap(ret[0]);
}

/**
 * @param {Uint8Array} data
 * @param {string} file_name
 * @returns {LidarCollectionResult}
 */
export function parse_e57(data, file_name) {
  const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
  const len0 = WASM_VECTOR_LEN;
  const ptr1 = passStringToWasm0(file_name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
  const len1 = WASM_VECTOR_LEN;
  const ret = wasm.parse_e57(ptr0, len0, ptr1, len1);
  if (ret[2]) {
    throw takeFromExternrefTable0(ret[1]);
  }
  return LidarCollectionResult.__wrap(ret[0]);
}

/**
 * @param {Uint8Array} data
 * @param {string} file_name
 * @returns {LidarCollectionResult}
 */
export function parse_las(data, file_name) {
  const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
  const len0 = WASM_VECTOR_LEN;
  const ptr1 = passStringToWasm0(file_name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
  const len1 = WASM_VECTOR_LEN;
  const ret = wasm.parse_las(ptr0, len0, ptr1, len1);
  if (ret[2]) {
    throw takeFromExternrefTable0(ret[1]);
  }
  return LidarCollectionResult.__wrap(ret[0]);
}

/**
 * Parse an ASCII PCD point cloud. Reads the FIELDS/COUNT header to build a
 * column layout (including PCD's packed-float `rgb`), then parses the rows.
 * Returns an error (→ JS fallback) for binary PCD or anything unsupported.
 * @param {Uint8Array} data
 * @returns {PointCloudResult}
 */
export function parse_pcd_ascii(data) {
  const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
  const len0 = WASM_VECTOR_LEN;
  const ret = wasm.parse_pcd_ascii(ptr0, len0);
  if (ret[2]) {
    throw takeFromExternrefTable0(ret[1]);
  }
  return PointCloudResult.__wrap(ret[0]);
}

/**
 * Parse a binary PCD point cloud (`DATA binary`; not `binary_compressed`). Reads
 * the FIELDS/SIZE/TYPE/COUNT header to map each field to a byte offset + reader,
 * then walks fixed-size records straight into the packed output arrays — no
 * text parsing, so it's orders of magnitude faster than the JS binary path.
 * Returns Err (→ JS fallback) for ascii/compressed PCD, missing x/y/z, or a
 * header whose SIZE/TYPE don't line up with FIELDS.
 * @param {Uint8Array} data
 * @returns {PointCloudResult}
 */
export function parse_pcd_binary(data) {
  const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
  const len0 = WASM_VECTOR_LEN;
  const ret = wasm.parse_pcd_binary(ptr0, len0);
  if (ret[2]) {
    throw takeFromExternrefTable0(ret[1]);
  }
  return PointCloudResult.__wrap(ret[0]);
}

/**
 * Parse a PTS point cloud. PTS has an optional leading count line + comments
 * (both have < 3 numeric columns, so `parse_rows` skips them automatically),
 * then rows auto-detected from the first data row:
 *   3 → x y z · 4 → x y z intensity · 6 → x y z r g b ·
 *   7 → x y z intensity r g b (Open3D default).
 * Colors are 0-255 integers (the shared 0-1-vs-int heuristic in `Builder`
 * handles the common case; a rare all-channels-≤1 row could be misread — see
 * PERFORMANCE_PLAN raw-int colors note).
 * @param {Uint8Array} data
 * @returns {PointCloudResult}
 */
export function parse_pts(data) {
  const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
  const len0 = WASM_VECTOR_LEN;
  const ret = wasm.parse_pts(ptr0, len0);
  return PointCloudResult.__wrap(ret);
}

/**
 * Parse XYZ / XYZN / XYZRGB. For plain "xyz" the layout is auto-detected from
 * the first valid row (3 = xyz, 4 = xyz+intensity, 6 = xyz+rgb).
 * @param {Uint8Array} data
 * @param {string} variant
 * @param {string} color_mode
 * @returns {PointCloudResult}
 */
export function parse_xyz(data, variant, color_mode) {
  const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
  const len0 = WASM_VECTOR_LEN;
  const ptr1 = passStringToWasm0(variant, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
  const len1 = WASM_VECTOR_LEN;
  const ptr2 = passStringToWasm0(color_mode, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
  const len2 = WASM_VECTOR_LEN;
  const ret = wasm.parse_xyz(ptr0, len0, ptr1, len1, ptr2, len2);
  return PointCloudResult.__wrap(ret);
}
function __wbg_get_imports() {
  const import0 = {
    __proto__: null,
    __wbg___wbindgen_throw_344f42d3211c4765: function (arg0, arg1) {
      throw new Error(getStringFromWasm0(arg0, arg1));
    },
    __wbindgen_cast_0000000000000001: function (arg0, arg1) {
      // Cast intrinsic for `Ref(String) -> Externref`.
      const ret = getStringFromWasm0(arg0, arg1);
      return ret;
    },
    __wbindgen_init_externref_table: function () {
      const table = wasm.__wbindgen_externrefs;
      const offset = table.grow(4);
      table.set(0, undefined);
      table.set(offset + 0, undefined);
      table.set(offset + 1, null);
      table.set(offset + 2, true);
      table.set(offset + 3, false);
    },
  };
  return {
    __proto__: null,
    './pointcloud_parser_bg.js': import0,
  };
}

const LidarCollectionResultFinalization =
  typeof FinalizationRegistry === 'undefined'
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_lidarcollectionresult_free(ptr, 1));
const LidarScanResultFinalization =
  typeof FinalizationRegistry === 'undefined'
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_lidarscanresult_free(ptr, 1));
const PointCloudResultFinalization =
  typeof FinalizationRegistry === 'undefined'
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_pointcloudresult_free(ptr, 1));
const StreamParserFinalization =
  typeof FinalizationRegistry === 'undefined'
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_streamparser_free(ptr, 1));

function getArrayF32FromWasm0(ptr, len) {
  ptr = ptr >>> 0;
  return getFloat32ArrayMemory0().subarray(ptr / 4, ptr / 4 + len);
}

function getArrayF64FromWasm0(ptr, len) {
  ptr = ptr >>> 0;
  return getFloat64ArrayMemory0().subarray(ptr / 8, ptr / 8 + len);
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

let cachedFloat64ArrayMemory0 = null;
function getFloat64ArrayMemory0() {
  if (cachedFloat64ArrayMemory0 === null || cachedFloat64ArrayMemory0.byteLength === 0) {
    cachedFloat64ArrayMemory0 = new Float64Array(wasm.memory.buffer);
  }
  return cachedFloat64ArrayMemory0;
}

function getStringFromWasm0(ptr, len) {
  return decodeText(ptr >>> 0, len);
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
  if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
    cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
  }
  return cachedUint8ArrayMemory0;
}

function passArray8ToWasm0(arg, malloc) {
  const ptr = malloc(arg.length * 1, 1) >>> 0;
  getUint8ArrayMemory0().set(arg, ptr / 1);
  WASM_VECTOR_LEN = arg.length;
  return ptr;
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

function takeFromExternrefTable0(idx) {
  const value = wasm.__wbindgen_externrefs.get(idx);
  wasm.__externref_table_dealloc(idx);
  return value;
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

let WASM_VECTOR_LEN = 0;

let wasmModule, wasmInstance, wasm;
function __wbg_finalize_init(instance, module) {
  wasmInstance = instance;
  wasm = instance.exports;
  wasmModule = module;
  cachedFloat32ArrayMemory0 = null;
  cachedFloat64ArrayMemory0 = null;
  cachedUint8ArrayMemory0 = null;
  wasm.__wbindgen_start();
  return wasm;
}

async function __wbg_load(module, imports) {
  if (typeof Response === 'function' && module instanceof Response) {
    if (typeof WebAssembly.instantiateStreaming === 'function') {
      try {
        return await WebAssembly.instantiateStreaming(module, imports);
      } catch (e) {
        const validResponse = module.ok && expectedResponseType(module.type);

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

  function expectedResponseType(type) {
    switch (type) {
      case 'basic':
      case 'cors':
      case 'default':
        return true;
    }
    return false;
  }
}

function initSync(module) {
  if (wasm !== undefined) return wasm;

  if (module !== undefined) {
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

  if (module_or_path !== undefined) {
    if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
      ({ module_or_path } = module_or_path);
    } else {
      console.warn(
        'using deprecated parameters for the initialization function; pass a single object instead'
      );
    }
  }

  if (module_or_path === undefined) {
    module_or_path = new URL('pointcloud_parser_bg.wasm', import.meta.url);
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

export { initSync, __wbg_init as default };
