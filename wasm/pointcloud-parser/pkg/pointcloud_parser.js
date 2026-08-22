/* @ts-self-types="./pointcloud_parser.d.ts" */

/**
 * An embedded E57 JPEG/PNG representation and its optional PNG validity mask.
 * Encoded bytes are kept encoded across the WASM boundary so callers can
 * decode one image at a time instead of retaining every full-resolution RGB
 * buffer.
 */
class E57ImageResult {
  static __wrap(ptr) {
    const obj = Object.create(E57ImageResult.prototype);
    obj.__wbg_ptr = ptr;
    E57ImageResultFinalization.register(obj, obj.__wbg_ptr, obj);
    return obj;
  }
  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;
    E57ImageResultFinalization.unregister(this);
    return ptr;
  }
  free() {
    const ptr = this.__destroy_into_raw();
    wasm.__wbg_e57imageresult_free(ptr, 0);
  }
  /**
   * @returns {string}
   */
  get metadata_json() {
    let deferred1_0;
    let deferred1_1;
    try {
      const ret = wasm.e57imageresult_metadata_json(this.__wbg_ptr);
      deferred1_0 = ret[0];
      deferred1_1 = ret[1];
      return getStringFromWasm0(ret[0], ret[1]);
    } finally {
      wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
  }
  /**
   * @returns {Uint8Array}
   */
  take_data() {
    const ret = wasm.e57imageresult_take_data(this.__wbg_ptr);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
  }
  /**
   * @returns {Uint8Array}
   */
  take_mask() {
    const ret = wasm.e57imageresult_take_mask(this.__wbg_ptr);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
  }
}
if (Symbol.dispose) E57ImageResult.prototype[Symbol.dispose] = E57ImageResult.prototype.free;
exports.E57ImageResult = E57ImageResult;

/**
 * A triangle mesh, ready for a `BufferGeometry`.
 */
class IsosurfaceMesh {
  static __wrap(ptr) {
    const obj = Object.create(IsosurfaceMesh.prototype);
    obj.__wbg_ptr = ptr;
    IsosurfaceMeshFinalization.register(obj, obj.__wbg_ptr, obj);
    return obj;
  }
  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;
    IsosurfaceMeshFinalization.unregister(this);
    return ptr;
  }
  free() {
    const ptr = this.__destroy_into_raw();
    wasm.__wbg_isosurfacemesh_free(ptr, 0);
  }
  /**
   * The decimation actually used, so callers can report what they rendered.
   * @returns {Uint32Array}
   */
  get step() {
    const ret = wasm.isosurfacemesh_step(this.__wbg_ptr);
    var v1 = getArrayU32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v1;
  }
  /**
   * @returns {Float32Array}
   */
  take_gradient_magnitudes() {
    const ret = wasm.isosurfacemesh_take_gradient_magnitudes(this.__wbg_ptr);
    var v1 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v1;
  }
  /**
   * @returns {Uint32Array}
   */
  take_indices() {
    const ret = wasm.isosurfacemesh_take_indices(this.__wbg_ptr);
    var v1 = getArrayU32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v1;
  }
  /**
   * @returns {Float32Array}
   */
  take_normals() {
    const ret = wasm.isosurfacemesh_take_normals(this.__wbg_ptr);
    var v1 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v1;
  }
  /**
   * @returns {Float32Array}
   */
  take_positions() {
    const ret = wasm.isosurfacemesh_take_positions(this.__wbg_ptr);
    var v1 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v1;
  }
  /**
   * @returns {number}
   */
  get triangle_count() {
    const ret = wasm.isosurfacemesh_triangle_count(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * @returns {number}
   */
  get vertex_count() {
    const ret = wasm.isosurfacemesh_vertex_count(this.__wbg_ptr);
    return ret >>> 0;
  }
}
if (Symbol.dispose) IsosurfaceMesh.prototype[Symbol.dispose] = IsosurfaceMesh.prototype.free;
exports.IsosurfaceMesh = IsosurfaceMesh;

class LidarCollectionResult {
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
   * @returns {string}
   */
  get errors_json() {
    let deferred1_0;
    let deferred1_1;
    try {
      const ret = wasm.lidarcollectionresult_errors_json(this.__wbg_ptr);
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
  get image_count() {
    const ret = wasm.lidarcollectionresult_image_count(this.__wbg_ptr);
    return ret >>> 0;
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
   * @returns {E57ImageResult}
   */
  take_image(index) {
    const ret = wasm.lidarcollectionresult_take_image(this.__wbg_ptr, index);
    if (ret[2]) {
      throw takeFromExternrefTable0(ret[1]);
    }
    return E57ImageResult.__wrap(ret[0]);
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
exports.LidarCollectionResult = LidarCollectionResult;

/**
 * A single decoded LAS/LAZ cloud or E57 scan. Buffers are moved to JS with
 * `take_*`, avoiding an additional Rust-side clone at the WASM boundary.
 */
class LidarScanResult {
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
exports.LidarScanResult = LidarScanResult;

/**
 * One array, decoded to f32.
 */
class NpyArrayResult {
  static __wrap(ptr) {
    const obj = Object.create(NpyArrayResult.prototype);
    obj.__wbg_ptr = ptr;
    NpyArrayResultFinalization.register(obj, obj.__wbg_ptr, obj);
    return obj;
  }
  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;
    NpyArrayResultFinalization.unregister(this);
    return ptr;
  }
  free() {
    const ptr = this.__destroy_into_raw();
    wasm.__wbg_npyarrayresult_free(ptr, 0);
  }
  /**
   * The NumPy descr string, e.g. `<f4`.
   * @returns {string}
   */
  get dtype() {
    let deferred1_0;
    let deferred1_1;
    try {
      const ret = wasm.npyarrayresult_dtype(this.__wbg_ptr);
      deferred1_0 = ret[0];
      deferred1_1 = ret[1];
      return getStringFromWasm0(ret[0], ret[1]);
    } finally {
      wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
  }
  /**
   * Empty for a plain `.npy`; the archive key for a member of an `.npz`.
   * @returns {string}
   */
  get name() {
    let deferred1_0;
    let deferred1_1;
    try {
      const ret = wasm.npyarrayresult_name(this.__wbg_ptr);
      deferred1_0 = ret[0];
      deferred1_1 = ret[1];
      return getStringFromWasm0(ret[0], ret[1]);
    } finally {
      wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
  }
  /**
   * @returns {Uint32Array}
   */
  get shape() {
    const ret = wasm.npyarrayresult_shape(this.__wbg_ptr);
    var v1 = getArrayU32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v1;
  }
  /**
   * @returns {Float32Array}
   */
  take_values() {
    const ret = wasm.npyarrayresult_take_values(this.__wbg_ptr);
    var v1 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v1;
  }
}
if (Symbol.dispose) NpyArrayResult.prototype[Symbol.dispose] = NpyArrayResult.prototype.free;
exports.NpyArrayResult = NpyArrayResult;

/**
 * A decoded volume, handed to JS as f32 samples plus its header facts.
 */
class NrrdVolume {
  static __wrap(ptr) {
    const obj = Object.create(NrrdVolume.prototype);
    obj.__wbg_ptr = ptr;
    NrrdVolumeFinalization.register(obj, obj.__wbg_ptr, obj);
    return obj;
  }
  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;
    NrrdVolumeFinalization.unregister(this);
    return ptr;
  }
  free() {
    const ptr = this.__destroy_into_raw();
    wasm.__wbg_nrrdvolume_free(ptr, 0);
  }
  /**
   * @returns {number}
   */
  get channels() {
    const ret = wasm.nrrdvolume_channels(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * @returns {Float64Array}
   */
  get ijk_to_world() {
    const ret = wasm.nrrdvolume_ijk_to_world(this.__wbg_ptr);
    var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v1;
  }
  /**
   * Header facts as JSON: every field, plus the units and range the viewer
   * reads back out of them.
   * @returns {string}
   */
  get metadata_json() {
    let deferred1_0;
    let deferred1_1;
    try {
      const ret = wasm.nrrdvolume_metadata_json(this.__wbg_ptr);
      deferred1_0 = ret[0];
      deferred1_1 = ret[1];
      return getStringFromWasm0(ret[0], ret[1]);
    } finally {
      wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
  }
  /**
   * @returns {Uint32Array}
   */
  get sizes() {
    const ret = wasm.nrrdvolume_sizes(this.__wbg_ptr);
    var v1 = getArrayU32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v1;
  }
  /**
   * @returns {Float32Array}
   */
  take_samples() {
    const ret = wasm.nrrdvolume_take_samples(this.__wbg_ptr);
    var v1 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v1;
  }
}
if (Symbol.dispose) NrrdVolume.prototype[Symbol.dispose] = NrrdVolume.prototype.free;
exports.NrrdVolume = NrrdVolume;

/**
 * Parsed PLY, handed to JS. Large buffers move out with the `take_*` methods.
 */
class PlyResult {
  static __wrap(ptr) {
    const obj = Object.create(PlyResult.prototype);
    obj.__wbg_ptr = ptr;
    PlyResultFinalization.register(obj, obj.__wbg_ptr, obj);
    return obj;
  }
  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;
    PlyResultFinalization.unregister(this);
    return ptr;
  }
  free() {
    const ptr = this.__destroy_into_raw();
    wasm.__wbg_plyresult_free(ptr, 0);
  }
  /**
   * [min_x, min_y, min_z, max_x, max_y, max_z]
   * @returns {Float32Array}
   */
  bbox() {
    const ret = wasm.plyresult_bbox(this.__wbg_ptr);
    var v1 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v1;
  }
  /**
   * @returns {number}
   */
  get face_count() {
    const ret = wasm.plyresult_face_count(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * @returns {boolean}
   */
  get has_colors() {
    const ret = wasm.plyresult_has_colors(this.__wbg_ptr);
    return ret !== 0;
  }
  /**
   * @returns {boolean}
   */
  get has_intensity() {
    const ret = wasm.plyresult_has_intensity(this.__wbg_ptr);
    return ret !== 0;
  }
  /**
   * @returns {boolean}
   */
  get has_normals() {
    const ret = wasm.plyresult_has_normals(this.__wbg_ptr);
    return ret !== 0;
  }
  /**
   * @returns {boolean}
   */
  get is_gaussian_splat() {
    const ret = wasm.plyresult_is_gaussian_splat(this.__wbg_ptr);
    return ret !== 0;
  }
  /**
   * Header facts as JSON: format, version and comments.
   * @returns {string}
   */
  get metadata_json() {
    let deferred1_0;
    let deferred1_1;
    try {
      const ret = wasm.plyresult_metadata_json(this.__wbg_ptr);
      deferred1_0 = ret[0];
      deferred1_1 = ret[1];
      return getStringFromWasm0(ret[0], ret[1]);
    } finally {
      wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
  }
  /**
   * Scalar-field names, in the order `take_scalar_at` expects.
   * @returns {string[]}
   */
  get scalar_field_names() {
    const ret = wasm.plyresult_scalar_field_names(this.__wbg_ptr);
    var v1 = getArrayJsValueFromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v1;
  }
  /**
   * @returns {Uint8Array}
   */
  take_colors() {
    const ret = wasm.plyresult_take_colors(this.__wbg_ptr);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
  }
  /**
   * @returns {Uint32Array}
   */
  take_face_indices() {
    const ret = wasm.plyresult_take_face_indices(this.__wbg_ptr);
    var v1 = getArrayU32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v1;
  }
  /**
   * Vertices per face, parallel to the runs in `take_face_indices`.
   * @returns {Uint32Array}
   */
  take_face_sizes() {
    const ret = wasm.plyresult_take_face_sizes(this.__wbg_ptr);
    var v1 = getArrayU32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v1;
  }
  /**
   * @returns {Float32Array}
   */
  take_intensity() {
    const ret = wasm.plyresult_take_intensity(this.__wbg_ptr);
    var v1 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v1;
  }
  /**
   * @returns {Float32Array}
   */
  take_normals() {
    const ret = wasm.plyresult_take_normals(this.__wbg_ptr);
    var v1 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v1;
  }
  /**
   * @returns {Float32Array}
   */
  take_positions() {
    const ret = wasm.plyresult_take_positions(this.__wbg_ptr);
    var v1 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v1;
  }
  /**
   * @param {number} index
   * @returns {Float32Array}
   */
  take_scalar_at(index) {
    const ret = wasm.plyresult_take_scalar_at(this.__wbg_ptr, index);
    var v1 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v1;
  }
  /**
   * @returns {number}
   */
  get vertex_count() {
    const ret = wasm.plyresult_vertex_count(this.__wbg_ptr);
    return ret >>> 0;
  }
}
if (Symbol.dispose) PlyResult.prototype[Symbol.dispose] = PlyResult.prototype.free;
exports.PlyResult = PlyResult;

/**
 * Parsed point cloud, returned to JS. Large buffers are moved out with the
 * `take_*` methods (no clone) the way wasm-bindgen marshals `Vec<T>`.
 */
class PointCloudResult {
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
   * @returns {string}
   */
  get metadata_json() {
    let deferred1_0;
    let deferred1_1;
    try {
      const ret = wasm.pointcloudresult_metadata_json(this.__wbg_ptr);
      deferred1_0 = ret[0];
      deferred1_1 = ret[1];
      return getStringFromWasm0(ret[0], ret[1]);
    } finally {
      wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
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
exports.PointCloudResult = PointCloudResult;

/**
 * Column-major 4x4 pose plus a JSON stats blob, for every stage.
 */
class RegistrationResult {
  static __wrap(ptr) {
    const obj = Object.create(RegistrationResult.prototype);
    obj.__wbg_ptr = ptr;
    RegistrationResultFinalization.register(obj, obj.__wbg_ptr, obj);
    return obj;
  }
  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;
    RegistrationResultFinalization.unregister(this);
    return ptr;
  }
  free() {
    const ptr = this.__destroy_into_raw();
    wasm.__wbg_registrationresult_free(ptr, 0);
  }
  /**
   * @returns {Float64Array}
   */
  get matrix() {
    const ret = wasm.registrationresult_matrix(this.__wbg_ptr);
    var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v1;
  }
  /**
   * @returns {string}
   */
  get stats() {
    let deferred1_0;
    let deferred1_1;
    try {
      const ret = wasm.registrationresult_stats(this.__wbg_ptr);
      deferred1_0 = ret[0];
      deferred1_1 = ret[1];
      return getStringFromWasm0(ret[0], ret[1]);
    } finally {
      wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
  }
}
if (Symbol.dispose)
  RegistrationResult.prototype[Symbol.dispose] = RegistrationResult.prototype.free;
exports.RegistrationResult = RegistrationResult;

class StonexColourResult {
  static __wrap(ptr) {
    const obj = Object.create(StonexColourResult.prototype);
    obj.__wbg_ptr = ptr;
    StonexColourResultFinalization.register(obj, obj.__wbg_ptr, obj);
    return obj;
  }
  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;
    StonexColourResultFinalization.unregister(this);
    return ptr;
  }
  free() {
    const ptr = this.__destroy_into_raw();
    wasm.__wbg_stonexcolourresult_free(ptr, 0);
  }
  /**
   * @returns {number}
   */
  get candidate_total() {
    const ret = wasm.stonexcolourresult_candidate_total(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * @returns {number}
   */
  get coloured_points() {
    const ret = wasm.stonexcolourresult_coloured_points(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * @returns {number}
   */
  get pixels_in_frame() {
    const ret = wasm.stonexcolourresult_pixels_in_frame(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * @returns {Uint8Array}
   */
  take_colours() {
    const ret = wasm.stonexcolourresult_take_colours(this.__wbg_ptr);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
  }
  /**
   * @returns {Uint16Array}
   */
  take_frame_indices() {
    const ret = wasm.stonexcolourresult_take_frame_indices(this.__wbg_ptr);
    var v1 = getArrayU16FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 2, 2);
    return v1;
  }
}
if (Symbol.dispose)
  StonexColourResult.prototype[Symbol.dispose] = StonexColourResult.prototype.free;
exports.StonexColourResult = StonexColourResult;

/**
 * Holds an archive's frames for the length of a parse.
 *
 * The pixels and the decoded panoramas live here rather than in each call:
 * they are shared by every scan, and rebuilding them per scan meant a
 * six-scan archive demosaicing its ten frames sixty times and copying the
 * pixel buffer six times over. Created once, coloured scan by scan, dropped at
 * the end.
 */
class StonexColourSession {
  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;
    StonexColourSessionFinalization.unregister(this);
    return ptr;
  }
  free() {
    const ptr = this.__destroy_into_raw();
    wasm.__wbg_stonexcoloursession_free(ptr, 0);
  }
  /**
   * Colours one scan from the frames named in `active_frames`.
   *
   * Returned frame indices address this session's frame list, which is the
   * archive's own ordering, so no remapping is needed on the way out.
   * @param {Float32Array} positions
   * @param {Float64Array} column_azimuths
   * @param {Uint32Array} points_per_column
   * @param {Uint32Array} active_frames
   * @returns {StonexColourResult}
   */
  colour_scan(positions, column_azimuths, points_per_column, active_frames) {
    const ptr0 = passArrayF32ToWasm0(positions, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArrayF64ToWasm0(column_azimuths, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passArray32ToWasm0(points_per_column, wasm.__wbindgen_malloc);
    const len2 = WASM_VECTOR_LEN;
    const ptr3 = passArray32ToWasm0(active_frames, wasm.__wbindgen_malloc);
    const len3 = WASM_VECTOR_LEN;
    const ret = wasm.stonexcoloursession_colour_scan(
      this.__wbg_ptr,
      ptr0,
      len0,
      ptr1,
      len1,
      ptr2,
      len2,
      ptr3,
      len3
    );
    return StonexColourResult.__wrap(ret);
  }
  /**
   * Builds the camera-panel thumbnail from the same decoded image used for
   * point colouring. Keeping this here avoids demosaicing every frame again
   * in JavaScript after the colour-pass timer has stopped.
   * @param {number} frame_index
   * @param {number} preview_scale
   * @returns {StonexPreview}
   */
  frame_preview(frame_index, preview_scale) {
    const ret = wasm.stonexcoloursession_frame_preview(this.__wbg_ptr, frame_index, preview_scale);
    return StonexPreview.__wrap(ret);
  }
  /**
   * `pixels` holds every frame's raw plane; each descriptor points into it.
   * Takes `pixels` by value: a `&[u8]` is copied into wasm memory for the
   * call and then copied again to retain it, which is 300 MB of duplication
   * on a large archive. Owning it costs one copy instead of two, and the
   * caller can drop its own reference immediately afterwards.
   * @param {Uint8Array} pixels
   * @param {string} frames_json
   */
  constructor(pixels, frames_json) {
    const ptr0 = passArray8ToWasm0(pixels, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passStringToWasm0(frames_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.stonexcoloursession_new(ptr0, len0, ptr1, len1);
    if (ret[2]) {
      throw takeFromExternrefTable0(ret[1]);
    }
    this.__wbg_ptr = ret[0];
    StonexColourSessionFinalization.register(this, this.__wbg_ptr, this);
    return this;
  }
}
if (Symbol.dispose)
  StonexColourSession.prototype[Symbol.dispose] = StonexColourSession.prototype.free;
exports.StonexColourSession = StonexColourSession;

class StonexPreview {
  static __wrap(ptr) {
    const obj = Object.create(StonexPreview.prototype);
    obj.__wbg_ptr = ptr;
    StonexPreviewFinalization.register(obj, obj.__wbg_ptr, obj);
    return obj;
  }
  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;
    StonexPreviewFinalization.unregister(this);
    return ptr;
  }
  free() {
    const ptr = this.__destroy_into_raw();
    wasm.__wbg_stonexpreview_free(ptr, 0);
  }
  /**
   * @returns {number}
   */
  get height() {
    const ret = wasm.stonexpreview_height(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * @returns {Uint8Array}
   */
  take_rgba() {
    const ret = wasm.stonexpreview_take_rgba(this.__wbg_ptr);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
  }
  /**
   * @returns {number}
   */
  get width() {
    const ret = wasm.stonexpreview_width(this.__wbg_ptr);
    return ret >>> 0;
  }
}
if (Symbol.dispose) StonexPreview.prototype[Symbol.dispose] = StonexPreview.prototype.free;
exports.StonexPreview = StonexPreview;

/**
 * Decoded frame for JS: interleaved RGB at `CAMERA_RGB_SCALE`.
 */
class StonexRgbImage {
  static __wrap(ptr) {
    const obj = Object.create(StonexRgbImage.prototype);
    obj.__wbg_ptr = ptr;
    StonexRgbImageFinalization.register(obj, obj.__wbg_ptr, obj);
    return obj;
  }
  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;
    StonexRgbImageFinalization.unregister(this);
    return ptr;
  }
  free() {
    const ptr = this.__destroy_into_raw();
    wasm.__wbg_stonexrgbimage_free(ptr, 0);
  }
  /**
   * @returns {number}
   */
  get height() {
    const ret = wasm.stonexrgbimage_height(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * @returns {Uint8Array}
   */
  take_data() {
    const ret = wasm.stonexrgbimage_take_data(this.__wbg_ptr);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
  }
  /**
   * @returns {number}
   */
  get width() {
    const ret = wasm.stonexrgbimage_width(this.__wbg_ptr);
    return ret >>> 0;
  }
}
if (Symbol.dispose) StonexRgbImage.prototype[Symbol.dispose] = StonexRgbImage.prototype.free;
exports.StonexRgbImage = StonexRgbImage;

/**
 * One decoded X3R record, for comparison against the TypeScript decoder.
 */
class StonexScanPoints {
  static __wrap(ptr) {
    const obj = Object.create(StonexScanPoints.prototype);
    obj.__wbg_ptr = ptr;
    StonexScanPointsFinalization.register(obj, obj.__wbg_ptr, obj);
    return obj;
  }
  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;
    StonexScanPointsFinalization.unregister(this);
    return ptr;
  }
  free() {
    const ptr = this.__destroy_into_raw();
    wasm.__wbg_stonexscanpoints_free(ptr, 0);
  }
  /**
   * @returns {number}
   */
  get point_count() {
    const ret = wasm.stonexscanpoints_point_count(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * @returns {Float64Array}
   */
  take_column_azimuths() {
    const ret = wasm.stonexscanpoints_take_column_azimuths(this.__wbg_ptr);
    var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v1;
  }
  /**
   * @returns {Float32Array}
   */
  take_intensity() {
    const ret = wasm.stonexscanpoints_take_intensity(this.__wbg_ptr);
    var v1 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v1;
  }
  /**
   * @returns {Uint32Array}
   */
  take_points_per_column() {
    const ret = wasm.stonexscanpoints_take_points_per_column(this.__wbg_ptr);
    var v1 = getArrayU32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v1;
  }
  /**
   * @returns {Float32Array}
   */
  take_positions() {
    const ret = wasm.stonexscanpoints_take_positions(this.__wbg_ptr);
    var v1 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v1;
  }
}
if (Symbol.dispose) StonexScanPoints.prototype[Symbol.dispose] = StonexScanPoints.prototype.free;
exports.StonexScanPoints = StonexScanPoints;

/**
 * Colours an archive's scans from every station's cameras, one scan at a time.
 *
 * Built once per pass and kept alive across scans, for the same reason the
 * parser's own colour session is: the point cloud, the raw planes and each
 * demosaiced panorama are shared by every scan, and the per-station depth
 * buffers cost a full pass over that station's points to build. Colouring
 * scan by scan rather than in one call is what lets the host publish a
 * finished scan while the rest are still running.
 */
class StonexStationSession {
  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;
    StonexStationSessionFinalization.unregister(this);
    return ptr;
  }
  free() {
    const ptr = this.__destroy_into_raw();
    wasm.__wbg_stonexstationsession_free(ptr, 0);
  }
  /**
   * Colours one scan from every station's cameras.
   *
   * Returns true when it wrote anything, so the host can publish only the
   * scans that actually changed.
   * @param {number} scan_index
   * @returns {boolean}
   */
  colour_scan(scan_index) {
    const ret = wasm.stonexstationsession_colour_scan(this.__wbg_ptr, scan_index);
    return ret !== 0;
  }
  /**
   * Takes the point cloud, the raw planes and the colour arrays by value.
   *
   * A `&[f32]` argument is copied into wasm memory for the call and would
   * have to be copied again to retain it; owning them costs one copy of the
   * archive instead of two, and the host keeps its own arrays untouched
   * until it reads the results back at the end.
   * @param {Float32Array} positions
   * @param {Uint8Array} pixels
   * @param {Uint8Array} raw_colours
   * @param {Uint16Array} frame_indices
   * @param {Uint8Array} coloured
   * @param {string} frames_json
   * @param {string} scans_json
   * @param {string} options_json
   */
  constructor(
    positions,
    pixels,
    raw_colours,
    frame_indices,
    coloured,
    frames_json,
    scans_json,
    options_json
  ) {
    const ptr0 = passArrayF32ToWasm0(positions, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(pixels, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passArray8ToWasm0(raw_colours, wasm.__wbindgen_malloc);
    const len2 = WASM_VECTOR_LEN;
    const ptr3 = passArray16ToWasm0(frame_indices, wasm.__wbindgen_malloc);
    const len3 = WASM_VECTOR_LEN;
    const ptr4 = passArray8ToWasm0(coloured, wasm.__wbindgen_malloc);
    const len4 = WASM_VECTOR_LEN;
    const ptr5 = passStringToWasm0(frames_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len5 = WASM_VECTOR_LEN;
    const ptr6 = passStringToWasm0(scans_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len6 = WASM_VECTOR_LEN;
    const ptr7 = passStringToWasm0(options_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len7 = WASM_VECTOR_LEN;
    const ret = wasm.stonexstationsession_new(
      ptr0,
      len0,
      ptr1,
      len1,
      ptr2,
      len2,
      ptr3,
      len3,
      ptr4,
      len4,
      ptr5,
      len5,
      ptr6,
      len6,
      ptr7,
      len7
    );
    if (ret[2]) {
      throw takeFromExternrefTable0(ret[1]);
    }
    this.__wbg_ptr = ret[0];
    StonexStationSessionFinalization.register(this, this.__wbg_ptr, this);
    return this;
  }
  /**
   * Points that gained colour they did not have before.
   * @returns {number}
   */
  get newly_colored() {
    const ret = wasm.stonexstationsession_newly_colored(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * Point-station pairs rejected because that station could not see the
   * point. Counted per attempt: one point hidden from three stations
   * contributes three.
   * @returns {number}
   */
  get occluded_samples() {
    const ret = wasm.stonexstationsession_occluded_samples(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * Points whose colour was replaced by a better view.
   * @returns {number}
   */
  get recolored() {
    const ret = wasm.stonexstationsession_recolored(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * This scan's colours, for publishing it before the rest are done.
   * @param {number} scan_index
   * @returns {Uint8Array}
   */
  scan_colours(scan_index) {
    const ret = wasm.stonexstationsession_scan_colours(this.__wbg_ptr, scan_index);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
  }
  /**
   * @returns {number}
   */
  get scan_count() {
    const ret = wasm.stonexstationsession_scan_count(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * @param {number} scan_index
   * @returns {Uint16Array}
   */
  scan_frame_indices(scan_index) {
    const ret = wasm.stonexstationsession_scan_frame_indices(this.__wbg_ptr, scan_index);
    var v1 = getArrayU16FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 2, 2);
    return v1;
  }
  /**
   * One flag per point, set where this pass wrote.
   * @returns {Uint8Array}
   */
  take_changed() {
    const ret = wasm.stonexstationsession_take_changed(this.__wbg_ptr);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
  }
  /**
   * @returns {Uint8Array}
   */
  take_coloured() {
    const ret = wasm.stonexstationsession_take_coloured(this.__wbg_ptr);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
  }
  /**
   * @returns {Uint8Array}
   */
  take_colours() {
    const ret = wasm.stonexstationsession_take_colours(this.__wbg_ptr);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
  }
  /**
   * @returns {Uint16Array}
   */
  take_frame_indices() {
    const ret = wasm.stonexstationsession_take_frame_indices(this.__wbg_ptr);
    var v1 = getArrayU16FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 2, 2);
    return v1;
  }
}
if (Symbol.dispose)
  StonexStationSession.prototype[Symbol.dispose] = StonexStationSession.prototype.free;
exports.StonexStationSession = StonexStationSession;

/**
 * Incremental parser for streaming/overlapped loading. JS reads the file in
 * chunks and calls `push` on each (while the next chunk's read is in flight),
 * then `finish`. Partial lines are stitched across chunk boundaries via carry.
 */
class StreamParser {
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
exports.StreamParser = StreamParser;

/**
 * A voxel-shell mesh, ready for a `BufferGeometry`.
 */
class VoxelMesh {
  static __wrap(ptr) {
    const obj = Object.create(VoxelMesh.prototype);
    obj.__wbg_ptr = ptr;
    VoxelMeshFinalization.register(obj, obj.__wbg_ptr, obj);
    return obj;
  }
  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;
    VoxelMeshFinalization.unregister(this);
    return ptr;
  }
  free() {
    const ptr = this.__destroy_into_raw();
    wasm.__wbg_voxelmesh_free(ptr, 0);
  }
  /**
   * @returns {number}
   */
  get face_count() {
    const ret = wasm.voxelmesh_face_count(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * The decimation actually used: the stride grows until the build fits the
   * face budget, and callers report what they rendered.
   * @returns {Uint32Array}
   */
  get step() {
    const ret = wasm.voxelmesh_step(this.__wbg_ptr);
    var v1 = getArrayU32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v1;
  }
  /**
   * @returns {Uint8Array}
   */
  take_colors() {
    const ret = wasm.voxelmesh_take_colors(this.__wbg_ptr);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
  }
  /**
   * @returns {Uint32Array}
   */
  take_indices() {
    const ret = wasm.voxelmesh_take_indices(this.__wbg_ptr);
    var v1 = getArrayU32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v1;
  }
  /**
   * @returns {Float32Array}
   */
  take_intensity() {
    const ret = wasm.voxelmesh_take_intensity(this.__wbg_ptr);
    var v1 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v1;
  }
  /**
   * @returns {Float32Array}
   */
  take_positions() {
    const ret = wasm.voxelmesh_take_positions(this.__wbg_ptr);
    var v1 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v1;
  }
  /**
   * @returns {number}
   */
  get vertex_count() {
    const ret = wasm.voxelmesh_vertex_count(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * Voxels at or above the threshold, whether or not they showed a face.
   * Reported to the user as what the render mode actually kept.
   * @returns {number}
   */
  get voxel_count() {
    const ret = wasm.voxelmesh_voxel_count(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * World-space edge lengths of one emitted box, along i/j/k.
   * @returns {Float32Array}
   */
  get voxel_size() {
    const ret = wasm.voxelmesh_voxel_size(this.__wbg_ptr);
    var v1 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v1;
  }
}
if (Symbol.dispose) VoxelMesh.prototype[Symbol.dispose] = VoxelMesh.prototype.free;
exports.VoxelMesh = VoxelMesh;

/**
 * Reserve `len` bytes in WASM memory and return the offset. Caller fills it,
 * passes it to `parse_at`, then releases it with `dealloc`.
 * @param {number} len
 * @returns {number}
 */
function alloc(len) {
  const ret = wasm.alloc(len);
  return ret >>> 0;
}
exports.alloc = alloc;

/**
 * Build the exposed shell of every retained voxel.
 *
 * `clip` is six inclusive bounds (i0,i1,j0,j1,k0,k1); the stride grows from
 * `step` until the face count fits `max_faces`, because a low threshold on a
 * large volume would otherwise allocate hundreds of megabytes of geometry.
 * @param {Float32Array} samples
 * @param {Uint32Array} sizes
 * @param {Float64Array} ijk_to_world
 * @param {number} threshold
 * @param {Uint32Array} step
 * @param {number} max_faces
 * @param {Uint32Array} clip
 * @param {string} brightness_mode
 * @param {number} window_center
 * @param {number} window_width
 * @param {Float64Array} slice_ranges
 * @param {Float64Array} volume_range
 * @param {boolean} monochrome1
 * @returns {VoxelMesh}
 */
function build_volume_voxels(
  samples,
  sizes,
  ijk_to_world,
  threshold,
  step,
  max_faces,
  clip,
  brightness_mode,
  window_center,
  window_width,
  slice_ranges,
  volume_range,
  monochrome1
) {
  const ptr0 = passArrayF32ToWasm0(samples, wasm.__wbindgen_malloc);
  const len0 = WASM_VECTOR_LEN;
  const ptr1 = passArray32ToWasm0(sizes, wasm.__wbindgen_malloc);
  const len1 = WASM_VECTOR_LEN;
  const ptr2 = passArrayF64ToWasm0(ijk_to_world, wasm.__wbindgen_malloc);
  const len2 = WASM_VECTOR_LEN;
  const ptr3 = passArray32ToWasm0(step, wasm.__wbindgen_malloc);
  const len3 = WASM_VECTOR_LEN;
  const ptr4 = passArray32ToWasm0(clip, wasm.__wbindgen_malloc);
  const len4 = WASM_VECTOR_LEN;
  const ptr5 = passStringToWasm0(brightness_mode, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
  const len5 = WASM_VECTOR_LEN;
  const ptr6 = passArrayF64ToWasm0(slice_ranges, wasm.__wbindgen_malloc);
  const len6 = WASM_VECTOR_LEN;
  const ptr7 = passArrayF64ToWasm0(volume_range, wasm.__wbindgen_malloc);
  const len7 = WASM_VECTOR_LEN;
  const ret = wasm.build_volume_voxels(
    ptr0,
    len0,
    ptr1,
    len1,
    ptr2,
    len2,
    threshold,
    ptr3,
    len3,
    max_faces,
    ptr4,
    len4,
    ptr5,
    len5,
    window_center,
    window_width,
    ptr6,
    len6,
    ptr7,
    len7,
    monochrome1
  );
  if (ret[2]) {
    throw takeFromExternrefTable0(ret[1]);
  }
  return VoxelMesh.__wrap(ret[0]);
}
exports.build_volume_voxels = build_volume_voxels;

/**
 * Smallest eigenvalue of a cloud's normalized normal-covariance, in [0, 1/3].
 *
 * A caller ordering a multi-cloud alignment uses this to tell which clouds can
 * be placed from a blind search and which have to wait for a neighbour: see
 * `position_conditioning`.
 * @param {Float32Array} points
 * @param {number} cell
 * @returns {number}
 */
function cloud_position_conditioning(points, cell) {
  const ptr0 = passArrayF32ToWasm0(points, wasm.__wbindgen_malloc);
  const len0 = WASM_VECTOR_LEN;
  const ret = wasm.cloud_position_conditioning(ptr0, len0, cell);
  return ret;
}
exports.cloud_position_conditioning = cloud_position_conditioning;

/**
 * Coarse stage alone, for callers that want the shortlist without paying for
 * refinement.
 * @param {Float32Array} source
 * @param {Float32Array} target
 * @param {string} settings_json
 * @returns {RegistrationResult | undefined}
 */
function coarse_align(source, target, settings_json) {
  const ptr0 = passArrayF32ToWasm0(source, wasm.__wbindgen_malloc);
  const len0 = WASM_VECTOR_LEN;
  const ptr1 = passArrayF32ToWasm0(target, wasm.__wbindgen_malloc);
  const len1 = WASM_VECTOR_LEN;
  const ptr2 = passStringToWasm0(settings_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
  const len2 = WASM_VECTOR_LEN;
  const ret = wasm.coarse_align(ptr0, len0, ptr1, len1, ptr2, len2);
  return ret === 0 ? undefined : RegistrationResult.__wrap(ret);
}
exports.coarse_align = coarse_align;

/**
 * Free a buffer previously returned by `alloc`.
 * @param {number} ptr
 * @param {number} len
 */
function dealloc(ptr, len) {
  wasm.dealloc(ptr, len);
}
exports.dealloc = dealloc;

/**
 * Extract an isosurface at `threshold`.
 *
 * `sizes` is the volume's (nx, ny, nz); `ijk_to_world` is its row-major 4x4;
 * `step` is the per-axis decimation, which the caller has already chosen.
 * @param {Float32Array} samples
 * @param {Uint32Array} sizes
 * @param {Float64Array} ijk_to_world
 * @param {number} threshold
 * @param {Uint32Array} step
 * @param {number} max_triangles
 * @returns {IsosurfaceMesh}
 */
function extract_isosurface(samples, sizes, ijk_to_world, threshold, step, max_triangles) {
  const ptr0 = passArrayF32ToWasm0(samples, wasm.__wbindgen_malloc);
  const len0 = WASM_VECTOR_LEN;
  const ptr1 = passArray32ToWasm0(sizes, wasm.__wbindgen_malloc);
  const len1 = WASM_VECTOR_LEN;
  const ptr2 = passArrayF64ToWasm0(ijk_to_world, wasm.__wbindgen_malloc);
  const len2 = WASM_VECTOR_LEN;
  const ptr3 = passArray32ToWasm0(step, wasm.__wbindgen_malloc);
  const len3 = WASM_VECTOR_LEN;
  const ret = wasm.extract_isosurface(
    ptr0,
    len0,
    ptr1,
    len1,
    ptr2,
    len2,
    threshold,
    ptr3,
    len3,
    max_triangles
  );
  if (ret[2]) {
    throw takeFromExternrefTable0(ret[1]);
  }
  return IsosurfaceMesh.__wrap(ret[0]);
}
exports.extract_isosurface = extract_isosurface;

/**
 * Closed-form fit from matched correspondences.
 * @param {Float32Array} source
 * @param {Float32Array} target
 * @returns {RegistrationResult | undefined}
 */
function fit_correspondences(source, target) {
  const ptr0 = passArrayF32ToWasm0(source, wasm.__wbindgen_malloc);
  const len0 = WASM_VECTOR_LEN;
  const ptr1 = passArrayF32ToWasm0(target, wasm.__wbindgen_malloc);
  const len1 = WASM_VECTOR_LEN;
  const ret = wasm.fit_correspondences(ptr0, len0, ptr1, len1);
  return ret === 0 ? undefined : RegistrationResult.__wrap(ret);
}
exports.fit_correspondences = fit_correspondences;

/**
 * ICP refinement alone, from `settings.initial` (identity when absent).
 * @param {Float32Array} source
 * @param {Float32Array} target
 * @param {string} settings_json
 * @returns {RegistrationResult | undefined}
 */
function icp_refine(source, target, settings_json) {
  const ptr0 = passArrayF32ToWasm0(source, wasm.__wbindgen_malloc);
  const len0 = WASM_VECTOR_LEN;
  const ptr1 = passArrayF32ToWasm0(target, wasm.__wbindgen_malloc);
  const len1 = WASM_VECTOR_LEN;
  const ptr2 = passStringToWasm0(settings_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
  const len2 = WASM_VECTOR_LEN;
  const ret = wasm.icp_refine(ptr0, len0, ptr1, len1, ptr2, len2);
  return ret === 0 ? undefined : RegistrationResult.__wrap(ret);
}
exports.icp_refine = icp_refine;

/**
 * What a `.npy` or `.npz` holds, without decoding any of it: a JSON array of
 * `{name, shape, dtype}`. Callers use it to decide whether a file is a point
 * cloud or a depth image, and which member of an archive to ask for.
 * @param {Uint8Array} data
 * @returns {string}
 */
function npy_inspect(data) {
  let deferred3_0;
  let deferred3_1;
  try {
    const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.npy_inspect(ptr0, len0);
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
exports.npy_inspect = npy_inspect;

/**
 * Decode one array to f32. `name` selects an archive member; it is ignored for
 * a plain `.npy`, and an empty name takes the archive's first array.
 * @param {Uint8Array} data
 * @param {string} name
 * @returns {NpyArrayResult}
 */
function npy_read(data, name) {
  const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
  const len0 = WASM_VECTOR_LEN;
  const ptr1 = passStringToWasm0(name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
  const len1 = WASM_VECTOR_LEN;
  const ret = wasm.npy_read(ptr0, len0, ptr1, len1);
  if (ret[2]) {
    throw takeFromExternrefTable0(ret[1]);
  }
  return NpyArrayResult.__wrap(ret[0]);
}
exports.npy_read = npy_read;

/**
 * Parse an ASCII PLY: read the header to learn the vertex count + property
 * order, then parse the vertex rows. Falls back to an error string the JS side
 * can catch (and use its own parser) on anything unexpected.
 * @param {Uint8Array} data
 * @returns {PointCloudResult}
 */
function parse_ascii_ply(data) {
  const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
  const len0 = WASM_VECTOR_LEN;
  const ret = wasm.parse_ascii_ply(ptr0, len0);
  if (ret[2]) {
    throw takeFromExternrefTable0(ret[1]);
  }
  return PointCloudResult.__wrap(ret[0]);
}
exports.parse_ascii_ply = parse_ascii_ply;

/**
 * Parse a buffer already sitting in WASM memory at `ptr`/`len`.
 * @param {number} ptr
 * @param {number} len
 * @param {string} format
 * @returns {PointCloudResult}
 */
function parse_at(ptr, len, format) {
  const ptr0 = passStringToWasm0(format, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
  const len0 = WASM_VECTOR_LEN;
  const ret = wasm.parse_at(ptr, len, ptr0, len0);
  if (ret[2]) {
    throw takeFromExternrefTable0(ret[1]);
  }
  return PointCloudResult.__wrap(ret[0]);
}
exports.parse_at = parse_at;

/**
 * @param {Uint8Array} data
 * @param {string} file_name
 * @returns {LidarCollectionResult}
 */
function parse_e57(data, file_name) {
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
exports.parse_e57 = parse_e57;

/**
 * @param {Uint8Array} data
 * @param {string} file_name
 * @returns {LidarCollectionResult}
 */
function parse_las(data, file_name) {
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
exports.parse_las = parse_las;

/**
 * Parse a NRRD volume. `payload` supplies a detached data file when the header
 * names one; pass an empty slice otherwise.
 * @param {Uint8Array} data
 * @param {Uint8Array} detached
 * @returns {NrrdVolume}
 */
function parse_nrrd(data, detached) {
  const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
  const len0 = WASM_VECTOR_LEN;
  const ptr1 = passArray8ToWasm0(detached, wasm.__wbindgen_malloc);
  const len1 = WASM_VECTOR_LEN;
  const ret = wasm.parse_nrrd(ptr0, len0, ptr1, len1);
  if (ret[2]) {
    throw takeFromExternrefTable0(ret[1]);
  }
  return NrrdVolume.__wrap(ret[0]);
}
exports.parse_nrrd = parse_nrrd;

/**
 * Parse a PCD point cloud in any of its three encodings.
 *
 * One entry point rather than one per encoding: the caller cannot know which
 * it has without reading the header, and the header is read here.
 * @param {Uint8Array} data
 * @returns {PointCloudResult}
 */
function parse_pcd(data) {
  const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
  const len0 = WASM_VECTOR_LEN;
  const ret = wasm.parse_pcd(ptr0, len0);
  if (ret[2]) {
    throw takeFromExternrefTable0(ret[1]);
  }
  return PointCloudResult.__wrap(ret[0]);
}
exports.parse_pcd = parse_pcd;

/**
 * Parse a PLY file in either encoding, with faces, scalar fields and 3DGS
 * colour synthesis.
 * @param {Uint8Array} data
 * @returns {PlyResult}
 */
function parse_ply(data) {
  const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
  const len0 = WASM_VECTOR_LEN;
  const ret = wasm.parse_ply(ptr0, len0);
  if (ret[2]) {
    throw takeFromExternrefTable0(ret[1]);
  }
  return PlyResult.__wrap(ret[0]);
}
exports.parse_ply = parse_ply;

/**
 * Parse a PLY already sitting in wasm memory at `ptr`/`len`.
 *
 * The `&[u8]` entry point above makes wasm-bindgen copy the whole file across
 * the boundary first, which on a 200 MB point cloud costs more than the parse.
 * The caller can instead `alloc` a buffer, stream the file straight into it,
 * and parse it where it lies.
 *
 * # Safety
 * `ptr`/`len` must describe a buffer returned by `alloc` and still live.
 * @param {number} ptr
 * @param {number} len
 * @returns {PlyResult}
 */
function parse_ply_at(ptr, len) {
  const ret = wasm.parse_ply_at(ptr, len);
  if (ret[2]) {
    throw takeFromExternrefTable0(ret[1]);
  }
  return PlyResult.__wrap(ret[0]);
}
exports.parse_ply_at = parse_ply_at;

/**
 * Parse a PTS point cloud. PTS has an optional leading count line + comments
 * (both have < 3 numeric columns, so `parse_rows` skips them automatically),
 * then rows auto-detected from the first data row:
 *   3 → x y z · 4 → x y z intensity · 6 → x y z r g b ·
 *   7 → x y z intensity r g b (Open3D default) ·
 *   9 → x y z r g b nx ny nz.
 * PTS colors are always 0-255 integers, so `ColorMode::Byte` is forced rather
 * than left to the value heuristic — otherwise a dark row like `1 1 1` would
 * be read as 0..1 floats and turn white.
 * @param {Uint8Array} data
 * @returns {PointCloudResult}
 */
function parse_pts(data) {
  const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
  const len0 = WASM_VECTOR_LEN;
  const ret = wasm.parse_pts(ptr0, len0);
  return PointCloudResult.__wrap(ret);
}
exports.parse_pts = parse_pts;

/**
 * Parse XYZ / XYZN / XYZRGB. For plain "xyz" the layout is auto-detected from
 * the first valid row (3 = xyz, 4 = xyz+intensity, 6 = xyz+rgb).
 * @param {Uint8Array} data
 * @param {string} variant
 * @param {string} color_mode
 * @returns {PointCloudResult}
 */
function parse_xyz(data, variant, color_mode) {
  const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
  const len0 = WASM_VECTOR_LEN;
  const ptr1 = passStringToWasm0(variant, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
  const len1 = WASM_VECTOR_LEN;
  const ptr2 = passStringToWasm0(color_mode, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
  const len2 = WASM_VECTOR_LEN;
  const ret = wasm.parse_xyz(ptr0, len0, ptr1, len1, ptr2, len2);
  return PointCloudResult.__wrap(ret);
}
exports.parse_xyz = parse_xyz;

/**
 * Coarse sweep and/or ICP refinement, per `settings_json`.
 *
 * `source` and `target` are flat xyz triples in world space. Returns
 * `undefined` when nothing could be registered.
 * @param {Float32Array} source
 * @param {Float32Array} target
 * @param {string} settings_json
 * @returns {RegistrationResult | undefined}
 */
function register_pair(source, target, settings_json) {
  const ptr0 = passArrayF32ToWasm0(source, wasm.__wbindgen_malloc);
  const len0 = WASM_VECTOR_LEN;
  const ptr1 = passArrayF32ToWasm0(target, wasm.__wbindgen_malloc);
  const len1 = WASM_VECTOR_LEN;
  const ptr2 = passStringToWasm0(settings_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
  const len2 = WASM_VECTOR_LEN;
  const ret = wasm.register_pair(ptr0, len0, ptr1, len1, ptr2, len2);
  return ret === 0 ? undefined : RegistrationResult.__wrap(ret);
}
exports.register_pair = register_pair;

/**
 * Demosaics one X3I frame.
 *
 * `pixels` is the raw GRBG plane for this frame alone. Exposed while the port
 * is in progress so the TypeScript decode can be compared against this one on
 * real frames; the colour pass will call it internally rather than handing
 * images back across the boundary.
 * @param {Uint8Array} pixels
 * @param {number} raw_width
 * @param {number} raw_height
 * @param {number} image_width
 * @param {number} image_height
 * @returns {StonexRgbImage}
 */
function stonex_decode_frame(pixels, raw_width, raw_height, image_width, image_height) {
  const ptr0 = passArray8ToWasm0(pixels, wasm.__wbindgen_malloc);
  const len0 = WASM_VECTOR_LEN;
  const ret = wasm.stonex_decode_frame(
    ptr0,
    len0,
    raw_width,
    raw_height,
    image_width,
    image_height
  );
  return StonexRgbImage.__wrap(ret);
}
exports.stonex_decode_frame = stonex_decode_frame;

/**
 * Decodes one X3R record's points.
 *
 * `record` is the member's bytes on their own. Exposed while the port is in
 * progress so the TypeScript decoder can be checked against this one on the
 * real archives.
 * @param {Uint8Array} record
 * @returns {StonexScanPoints}
 */
function stonex_decode_scan(record) {
  const ptr0 = passArray8ToWasm0(record, wasm.__wbindgen_malloc);
  const len0 = WASM_VECTOR_LEN;
  const ret = wasm.stonex_decode_scan(ptr0, len0);
  if (ret[2]) {
    throw takeFromExternrefTable0(ret[1]);
  }
  return StonexScanPoints.__wrap(ret[0]);
}
exports.stonex_decode_scan = stonex_decode_scan;

/**
 * Decodes a scan whose layout was already validated and counted by the archive
 * parser. Avoids scanning every range a second time merely to rediscover the
 * same valid-point count before decoding it.
 * @param {Uint8Array} record
 * @param {number} columns
 * @param {number} rows
 * @param {number} column_offset
 * @param {number} column_stride
 * @param {number} valid_points
 * @returns {StonexScanPoints}
 */
function stonex_decode_scan_known_layout(
  record,
  columns,
  rows,
  column_offset,
  column_stride,
  valid_points
) {
  const ptr0 = passArray8ToWasm0(record, wasm.__wbindgen_malloc);
  const len0 = WASM_VECTOR_LEN;
  const ret = wasm.stonex_decode_scan_known_layout(
    ptr0,
    len0,
    columns,
    rows,
    column_offset,
    column_stride,
    valid_points
  );
  if (ret[2]) {
    throw takeFromExternrefTable0(ret[1]);
  }
  return StonexScanPoints.__wrap(ret[0]);
}
exports.stonex_decode_scan_known_layout = stonex_decode_scan_known_layout;
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

const E57ImageResultFinalization =
  typeof FinalizationRegistry === 'undefined'
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_e57imageresult_free(ptr, 1));
const IsosurfaceMeshFinalization =
  typeof FinalizationRegistry === 'undefined'
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_isosurfacemesh_free(ptr, 1));
const LidarCollectionResultFinalization =
  typeof FinalizationRegistry === 'undefined'
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_lidarcollectionresult_free(ptr, 1));
const LidarScanResultFinalization =
  typeof FinalizationRegistry === 'undefined'
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_lidarscanresult_free(ptr, 1));
const NpyArrayResultFinalization =
  typeof FinalizationRegistry === 'undefined'
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_npyarrayresult_free(ptr, 1));
const NrrdVolumeFinalization =
  typeof FinalizationRegistry === 'undefined'
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_nrrdvolume_free(ptr, 1));
const PlyResultFinalization =
  typeof FinalizationRegistry === 'undefined'
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_plyresult_free(ptr, 1));
const PointCloudResultFinalization =
  typeof FinalizationRegistry === 'undefined'
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_pointcloudresult_free(ptr, 1));
const RegistrationResultFinalization =
  typeof FinalizationRegistry === 'undefined'
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_registrationresult_free(ptr, 1));
const StonexColourResultFinalization =
  typeof FinalizationRegistry === 'undefined'
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_stonexcolourresult_free(ptr, 1));
const StonexColourSessionFinalization =
  typeof FinalizationRegistry === 'undefined'
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_stonexcoloursession_free(ptr, 1));
const StonexPreviewFinalization =
  typeof FinalizationRegistry === 'undefined'
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_stonexpreview_free(ptr, 1));
const StonexRgbImageFinalization =
  typeof FinalizationRegistry === 'undefined'
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_stonexrgbimage_free(ptr, 1));
const StonexScanPointsFinalization =
  typeof FinalizationRegistry === 'undefined'
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_stonexscanpoints_free(ptr, 1));
const StonexStationSessionFinalization =
  typeof FinalizationRegistry === 'undefined'
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_stonexstationsession_free(ptr, 1));
const StreamParserFinalization =
  typeof FinalizationRegistry === 'undefined'
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_streamparser_free(ptr, 1));
const VoxelMeshFinalization =
  typeof FinalizationRegistry === 'undefined'
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_voxelmesh_free(ptr, 1));

function getArrayF32FromWasm0(ptr, len) {
  ptr = ptr >>> 0;
  return getFloat32ArrayMemory0().subarray(ptr / 4, ptr / 4 + len);
}

function getArrayF64FromWasm0(ptr, len) {
  ptr = ptr >>> 0;
  return getFloat64ArrayMemory0().subarray(ptr / 8, ptr / 8 + len);
}

function getArrayJsValueFromWasm0(ptr, len) {
  ptr = ptr >>> 0;
  const mem = getDataViewMemory0();
  const result = [];
  for (let i = ptr; i < ptr + 4 * len; i += 4) {
    result.push(wasm.__wbindgen_externrefs.get(mem.getUint32(i, true)));
  }
  wasm.__externref_drop_slice(ptr, len);
  return result;
}

function getArrayU16FromWasm0(ptr, len) {
  ptr = ptr >>> 0;
  return getUint16ArrayMemory0().subarray(ptr / 2, ptr / 2 + len);
}

function getArrayU32FromWasm0(ptr, len) {
  ptr = ptr >>> 0;
  return getUint32ArrayMemory0().subarray(ptr / 4, ptr / 4 + len);
}

function getArrayU8FromWasm0(ptr, len) {
  ptr = ptr >>> 0;
  return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
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

let cachedUint16ArrayMemory0 = null;
function getUint16ArrayMemory0() {
  if (cachedUint16ArrayMemory0 === null || cachedUint16ArrayMemory0.byteLength === 0) {
    cachedUint16ArrayMemory0 = new Uint16Array(wasm.memory.buffer);
  }
  return cachedUint16ArrayMemory0;
}

let cachedUint32ArrayMemory0 = null;
function getUint32ArrayMemory0() {
  if (cachedUint32ArrayMemory0 === null || cachedUint32ArrayMemory0.byteLength === 0) {
    cachedUint32ArrayMemory0 = new Uint32Array(wasm.memory.buffer);
  }
  return cachedUint32ArrayMemory0;
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
  if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
    cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
  }
  return cachedUint8ArrayMemory0;
}

function passArray16ToWasm0(arg, malloc) {
  const ptr = malloc(arg.length * 2, 2) >>> 0;
  getUint16ArrayMemory0().set(arg, ptr / 2);
  WASM_VECTOR_LEN = arg.length;
  return ptr;
}

function passArray32ToWasm0(arg, malloc) {
  const ptr = malloc(arg.length * 4, 4) >>> 0;
  getUint32ArrayMemory0().set(arg, ptr / 4);
  WASM_VECTOR_LEN = arg.length;
  return ptr;
}

function passArray8ToWasm0(arg, malloc) {
  const ptr = malloc(arg.length * 1, 1) >>> 0;
  getUint8ArrayMemory0().set(arg, ptr / 1);
  WASM_VECTOR_LEN = arg.length;
  return ptr;
}

function passArrayF32ToWasm0(arg, malloc) {
  const ptr = malloc(arg.length * 4, 4) >>> 0;
  getFloat32ArrayMemory0().set(arg, ptr / 4);
  WASM_VECTOR_LEN = arg.length;
  return ptr;
}

function passArrayF64ToWasm0(arg, malloc) {
  const ptr = malloc(arg.length * 8, 8) >>> 0;
  getFloat64ArrayMemory0().set(arg, ptr / 8);
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
function decodeText(ptr, len) {
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

const wasmPath = `${__dirname}/pointcloud_parser_bg.wasm`;
const wasmBytes = require('fs').readFileSync(wasmPath);
const wasmModule = new WebAssembly.Module(wasmBytes);
let wasmInstance = new WebAssembly.Instance(wasmModule, __wbg_get_imports());
let wasm = wasmInstance.exports;
wasm.__wbindgen_start();
