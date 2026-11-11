// Memory a point-cloud load takes, computed from file headers with the same
// rules the viewer's loading code applies. Shared by the main process (the
// "may not fit" warning) and the page (the subsampling dialog), so it is a
// plain script: CommonJS in Node, `window.plyLoadBudget` in the page.
//
// Where the numbers come from (engine + wasm/pointcloud-parser):
//
//   per point, CPU (the page)                               GPU buffer
//   positions  Float32 x3, shared zero-copy with the GPU 12   12
//   colors     Uint8 x3, raw sRGB, zero-copy                  3    3
//   normals    packed to snorm16 (points: CPU only)            6    -
//   intensity  Float32 (also scalarFields.intensity)           4    -
//   intensity colour attribute (default mode without RGB)      6    6   Uint16 x3
//   scalar fields: Float32 from the parser, then whole-number fields are
//     narrowed (Uint8 / Uint16 / Int16), so by declared type:
//     uchar 1, char/short/ushort 2, other 4
//   3DGS: the whole file stays in memory for splat mode       stride
//   after subsampling: sourcePointIndices Uint32               4
//
// Loading adds, until the file is done: the file's bytes, the Float32 normals
// before packing (12) and each narrowed field's Float32 (4). A binary
// vertex-only PLY streams through a 4 MB wasm buffer; any other PLY (ASCII,
// or with faces) is copied into wasm memory together with the parser's
// outputs, and wasm memory never shrinks, so that stays.
//
// Measured on Linux (5M and 2M points, six layouts): the page grows by exactly
// these bytes plus a fixed ~44 MB (PCD, LAS, XYZ: within 5%). The GPU figures
// are the buffers uploaded; drivers may keep more (Linux/NVIDIA: 1.7-3.6x), so
// they are a lower bound. Peaks are lower bounds too: parsers that decode in
// slices leave each slice's copies to the garbage collector (PCD: up to ~20
// B/pt more, depending on when it runs).
//
// Other formats follow the same rules; see pcdCost, lasCost, textCost.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.plyLoadBudget = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const MB = 1024 * 1024;
  /** Fixed cost of a window's first loaded cloud (measured, see above). */
  const FIXED_BYTES = 44 * MB;
  const WASM_STREAM_SCRATCH = 4 * MB;
  /** Added per kept point when subsampling (sourcePointIndices). */
  const SUBSAMPLE_INDEX_BYTES = 4;

  const TYPE_SIZE = {
    char: 1,
    int8: 1,
    uchar: 1,
    uint8: 1,
    short: 2,
    int16: 2,
    ushort: 2,
    uint16: 2,
    int: 4,
    int32: 4,
    uint: 4,
    uint32: 4,
    float: 4,
    float32: 4,
    double: 8,
    float64: 8,
  };
  /** Bytes a scalar field keeps after narrowing, by declared type. */
  const NARROWED = {
    uchar: 1,
    uint8: 1,
    char: 2,
    int8: 2,
    short: 2,
    int16: 2,
    ushort: 2,
    uint16: 2,
  };
  const INTENSITY = ['intensity', 'reflectivity', 'reflectance', 'remission'];
  const CONSUMED = ['x', 'y', 'z', 'red', 'green', 'blue', 'alpha', 'nx', 'ny', 'nz'];

  /** The parts of a PLY header that decide memory; null when it is not one. */
  function parsePlyHeader(text) {
    const end = text.indexOf('end_header');
    if (!text.startsWith('ply') || end < 0) return null;
    const lines = text.slice(0, end).split(/\r?\n/);
    let format = null;
    const elements = [];
    for (const raw of lines) {
      const t = raw.trim().split(/\s+/);
      if (t[0] === 'format') format = t[1];
      else if (t[0] === 'element')
        elements.push({ name: t[1], count: Number(t[2]) || 0, props: [] });
      else if (t[0] === 'property' && elements.length) {
        const el = elements[elements.length - 1];
        if (t[1] === 'list') el.props.push({ list: true, name: t[4] });
        else el.props.push({ type: t[1], name: t[2] });
      }
    }
    const vertex = elements.find(e => e.name === 'vertex');
    if (!format || !vertex) return null;
    const faces = elements.filter(e => e.name === 'face').reduce((sum, e) => sum + e.count, 0);
    return { format, vertex, faces, vertexFirst: elements[0] === vertex };
  }

  /**
   * Cost of one PLY file: bytes per point (CPU, GPU) once loaded, extra bytes
   * per point while it loads, persistent wasm memory, and whether it can be
   * subsampled.
   */
  function plyCost(header, size) {
    const props = header.vertex.props;
    const names = props.map(p => p.name.toLowerCase());
    const has = n => names.includes(n);
    const splat = ['f_dc_0', 'f_dc_1', 'f_dc_2'].every(has) && !['red', 'green', 'blue'].some(has);
    const rgb = splat || ['red', 'green', 'blue'].some(has);
    const normals = !splat && ['nx', 'ny', 'nz'].some(has);
    const intensity = names.some(n => INTENSITY.includes(n));
    let scalarBytes = 0;
    let narrowedFields = 0;
    let scalarCount = 0;
    let stride = 0;
    for (const p of props) {
      if (p.list) {
        stride = NaN;
        continue;
      }
      stride += TYPE_SIZE[p.type] ?? 4;
      const n = p.name.toLowerCase();
      const consumed =
        CONSUMED.includes(n) || INTENSITY.includes(n) || (splat && /^(f_dc_|f_rest_|rot_)/.test(n));
      if (consumed) continue;
      scalarCount++;
      const narrowed = NARROWED[p.type];
      scalarBytes += narrowed ?? 4;
      if (narrowed) narrowedFields++;
    }
    const points = header.vertex.count;
    const mesh = header.faces > 0;
    const streamed =
      header.format !== 'ascii' && header.vertexFirst && !mesh && Number.isFinite(stride);
    // Arrays the parser itself returns (all Float32 except colors).
    const parserOut =
      12 + (rgb ? 3 : 0) + (normals ? 12 : 0) + (intensity ? 4 : 0) + 4 * scalarCount;

    let cpu;
    let gpu;
    let perFace = 0;
    if (mesh) {
      // Meshes keep Float32 normals (computed when absent) and 16-bit linear
      // colours, all uploaded; triangles are Uint32 indices (CPU + GPU).
      cpu = 12 + 12 + (rgb ? 3 + 6 : 0) + (intensity ? 4 : 0) + scalarBytes;
      gpu = 12 + 12 + (rgb ? 6 : 0);
      perFace = 12 + 12;
    } else {
      cpu =
        12 +
        (rgb ? 3 : 0) +
        (normals ? 6 : 0) +
        (intensity ? 4 : 0) +
        (intensity && !rgb ? 6 : 0) +
        scalarBytes +
        (splat && Number.isFinite(stride) ? stride : 0);
      gpu = 12 + (rgb ? 3 : intensity ? 6 : 0);
    }
    return {
      points,
      exact: true,
      cpu,
      gpu,
      faceBytes: perFace * header.faces,
      // Float32 normals before packing; Float32 copies of narrowed fields.
      loadExtra: (normals && !mesh ? 12 : 0) + 4 * narrowedFields,
      // A 3DGS file is kept whole, so its bytes are already in `cpu`.
      holdsFile: splat,
      wasm: streamed ? WASM_STREAM_SCRATCH : size + points * parserOut,
      subsamplable: !mesh && !splat,
      kind: mesh ? 'mesh' : splat ? '3DGS' : 'points',
      describe: describePly({
        rgb,
        normals,
        intensity,
        scalarCount,
        splat,
        mesh,
        faces: header.faces,
      }),
    };
  }

  function describePly(f) {
    const parts = ['xyz'];
    if (f.splat) parts.push('3DGS');
    else if (f.rgb) parts.push('rgb');
    if (f.normals) parts.push('normals');
    if (f.intensity) parts.push('intensity');
    if (f.scalarCount) parts.push(`${f.scalarCount} scalar${f.scalarCount === 1 ? '' : 's'}`);
    if (f.mesh) parts.push(`${f.faces} faces`);
    return parts.join(' + ');
  }

  /** Shared shape of a point-cloud cost. */
  function pointCost(points, size, f) {
    const rgb = !!f.rgb;
    const intensity = !!f.intensity;
    const narrowed = f.narrowedFields || 0;
    return {
      points,
      exact: f.exact !== false,
      cpu:
        12 +
        (rgb ? 3 : 0) +
        (f.normals ? 6 : 0) +
        (intensity ? 4 : 0) +
        // Without RGB, intensity is the default colour mode: Uint16 x3.
        (intensity && !rgb ? 6 : 0) +
        (f.scalarBytes || 0),
      gpu: 12 + (rgb ? 3 : intensity ? 6 : 0),
      faceBytes: 0,
      loadExtra: (f.normals ? 12 : 0) + 4 * narrowed + (f.loadExtra || 0),
      loadFixed: f.loadFixed || 0,
      holdsFile: false,
      wasm: f.wasm ?? size,
      subsamplable: true,
      kind: 'points',
      describe: f.describe,
    };
  }

  function describeFields(f) {
    const parts = ['xyz'];
    if (f.rgb) parts.push('rgb');
    if (f.normals) parts.push('normals');
    if (f.intensity) parts.push('intensity');
    if (f.scalarCount) parts.push(`${f.scalarCount} scalar${f.scalarCount === 1 ? '' : 's'}`);
    return parts.join(' + ');
  }

  /** PCD header (engine: parsePcdWasm; wasm: lib.rs parse_pcd). */
  function parsePcdHeader(text) {
    const get = key => {
      const m = new RegExp(`^${key}\\s+(.*)$`, 'mi').exec(text);
      return m ? m[1].trim().split(/\s+/) : null;
    };
    const fields = get('FIELDS');
    const data = get('DATA');
    if (!fields || !data) return null;
    const size = get('SIZE') || [];
    const type = get('TYPE') || [];
    const count = get('COUNT') || [];
    const points = Number((get('POINTS') || [])[0]);
    const width = Number((get('WIDTH') || [])[0]) || 0;
    const height = Number((get('HEIGHT') || [])[0]) || 1;
    return {
      fields: fields.map((name, i) => ({
        name: name.toLowerCase(),
        size: Number(size[i]) || 4,
        type: (type[i] || 'F').toUpperCase(),
        count: Number(count[i]) || 1,
      })),
      data: data[0].toLowerCase(),
      points: points > 0 ? points : width * height,
    };
  }

  function pcdCost(header, size) {
    const names = header.fields.map(f => f.name);
    const has = n => names.includes(n);
    const rgb = ['rgb', 'rgba', 'r', 'g', 'b', 'red', 'green', 'blue'].some(has);
    const normals = ['normal_x', 'normal_y', 'normal_z', 'nx', 'ny', 'nz'].some(has);
    const intensity = names.some(n => INTENSITY.includes(n));
    const mapped = [
      'x',
      'y',
      'z',
      'rgb',
      'rgba',
      'r',
      'g',
      'b',
      'red',
      'green',
      'blue',
      'normal_x',
      'normal_y',
      'normal_z',
      'nx',
      'ny',
      'nz',
      '_',
      ...INTENSITY,
    ];
    let scalarBytes = 0;
    let scalarCount = 0;
    let narrowedFields = 0;
    let stride = 0;
    for (const f of header.fields) {
      stride += f.size * f.count;
      if (mapped.includes(f.name)) continue;
      // One scalar field per component; narrowed by declared type.
      const bytes = f.type === 'U' && f.size === 1 ? 1 : f.size <= 2 && f.type !== 'F' ? 2 : 4;
      scalarCount += f.count;
      scalarBytes += bytes * f.count;
      if (bytes < 4) narrowedFields += f.count;
    }
    const points = header.points;
    const parserOut =
      12 + (rgb ? 3 : 0) + (normals ? 12 : 0) + (intensity ? 4 : 0) + 4 * scalarCount;
    // Binary PCD over 4 MiB is decoded in 4 MiB slices; everything else is
    // copied into wasm with its outputs (and a row index map).
    const sliced = header.data === 'binary' && size > 4 * MB;
    const wasm = sliced
      ? WASM_STREAM_SCRATCH + Math.ceil((4 * MB) / Math.max(1, stride)) * (parserOut + 4)
      : size +
        points * (parserOut + 4) +
        (header.data === 'binary_compressed' ? points * stride : 0);
    return pointCost(points, size, {
      rgb,
      normals,
      intensity,
      scalarBytes,
      narrowedFields,
      wasm,
      describe: describeFields({ rgb, normals, intensity, scalarCount }),
    });
  }

  /**
   * LAS/LAZ from its header (wasm: lidar.rs parse_las, in a worker). Kept:
   * positions, intensity (always), classification, return number, number of
   * returns, user data, point source id (1 B each once narrowed), scan angle
   * (1 B in formats 0-5, Float32 in 6-10), GPS time Float32, RGB.
   */
  function lasCost(info, size) {
    const format = info.format;
    const gps = [1, 3, 4, 5, 6, 7, 8, 9, 10].includes(format);
    const rgb = [2, 3, 5, 7, 8, 10].includes(format);
    const scanAngle = format >= 6 ? 4 : 1;
    const scalarBytes = 5 + scanAngle + (gps ? 4 : 0);
    return pointCost(info.points, size, {
      rgb,
      intensity: true,
      scalarBytes,
      narrowedFields: format >= 6 ? 5 : 6,
      // The worker copies the file into its wasm memory and decodes into its
      // own arrays (40 B/pt + GPS + 16-bit colour), then exits: load-time only.
      loadExtra: 40 + (gps ? 4 : 0) + (rgb ? 9 : 0),
      loadFixed: size,
      wasm: 0,
      describe:
        `LAS format ${format}: ` +
        describeFields({ rgb, intensity: true, scalarCount: 6 + (gps ? 1 : 0) }),
    });
  }

  /**
   * Text point clouds (wasm: lib.rs xyz/pts rows; text_table.rs). `columns`
   * is the first data row's number count; `points` is estimated from lines.
   */
  function textCost(ext, columns, points, size) {
    let f = {};
    if (ext === '.xyzn') f = { normals: true };
    else if (ext === '.xyzrgb') f = { rgb: true };
    else if (ext === '.xyz') {
      f = columns === 4 ? { intensity: true } : columns >= 6 ? { rgb: true } : {};
    } else if (ext === '.pts') {
      f =
        columns === 4
          ? { intensity: true }
          : columns === 7
            ? { intensity: true, rgb: true }
            : columns >= 9
              ? { rgb: true, normals: true }
              : columns >= 6
                ? { rgb: true }
                : {};
    }
    // csv / txt / asc go through the text-table import: positions only.
    const parserOut = 12 + (f.rgb ? 3 : 0) + (f.normals ? 12 : 0) + (f.intensity ? 4 : 0);
    const streamed = ['.xyz', '.xyzn', '.xyzrgb', '.pts'].includes(ext) && size > 4 * MB;
    return pointCost(points, size, {
      ...f,
      exact: false,
      // Streamed rows: outputs (about 1.1x) live in wasm next to a 4 MB
      // chunk; otherwise the file is copied in too. Wasm never shrinks.
      wasm: (streamed ? WASM_STREAM_SCRATCH : size) + Math.round(points * 1.1 * parserOut),
      describe: describeFields(f),
    });
  }

  /** Cost when only the point count is known (positions only: a lower bound). */
  function minimalCost(points, size, exact) {
    return {
      points,
      exact,
      cpu: 12,
      gpu: 12,
      faceBytes: 0,
      loadExtra: 0,
      holdsFile: false,
      wasm: size,
      subsamplable: true,
      kind: 'points',
      describe: exact ? 'xyz (other fields unknown)' : 'unknown layout',
    };
  }

  /** Points a file keeps under `options` ({fraction} / {maxPoints} / null). */
  function keptPoints(file, options) {
    if (!options || !file.subsamplable) return file.points;
    let kept = file.points;
    if (options.fraction > 0 && options.fraction < 1) {
      kept = Math.max(1, Math.round(file.points * options.fraction));
    }
    if (options.maxPoints > 0) kept = Math.min(kept, Math.floor(options.maxPoints));
    return Math.min(kept, file.points);
  }

  /** Bytes a file takes once loaded, keeping `kept` of its points. */
  function steadyBytes(file, kept) {
    const thinned = kept < file.points;
    return kept * (file.cpu + file.gpu + (thinned ? SUBSAMPLE_INDEX_BYTES : 0)) + file.faceBytes;
  }

  /**
   * Memory for loading `files` (costs as above, each with `size`):
   * `steady` once everything is loaded, `peak` while loading.
   * - A normal open reads every file before parsing any, so all their bytes
   *   are held at once.
   * - A subsampled open goes one file at a time: a file's full arrays exist
   *   only until it is thinned.
   * Persistent wasm memory is the largest single need (it is reused).
   */
  function planLoad(files, options) {
    const sequential = !!options;
    let steady = FIXED_BYTES;
    let kept = 0;
    let wasm = 0;
    let rawAll = 0;
    let worstExtra = 0;
    let worstFile = 0;
    for (const file of files) {
      const k = keptPoints(file, options);
      kept += k;
      steady += steadyBytes(file, k);
      wasm = Math.max(wasm, file.wasm);
      const raw = file.holdsFile ? 0 : file.size;
      rawAll += raw;
      const extra = file.points * file.loadExtra + (file.loadFixed || 0);
      worstExtra = Math.max(worstExtra, extra);
      // Subsampled: while this file loads, its bytes, its full parsed arrays
      // (when it will be thinned; GPU buffers are built after thinning) and
      // the temporary copies made building them.
      const full = k < file.points ? file.points * file.cpu : 0;
      worstFile = Math.max(worstFile, raw + extra + full);
    }
    steady += wasm;
    const peak = sequential ? steady + worstFile : steady + rawAll + worstExtra;
    return { kept, steady, peak };
  }

  /**
   * The fraction of points to keep so that a subsampled load peaks within
   * `budget` bytes (1 when everything fits; null when even 0 does not).
   */
  function fractionForBudget(files, budget) {
    const at = f => planLoad(files, { fraction: f }).peak;
    if (at(1) <= budget) return 1;
    if (at(1e-6) > budget) return null;
    let lo = 1e-6;
    let hi = 1;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (at(mid) <= budget) lo = mid;
      else hi = mid;
    }
    return lo;
  }

  return {
    FIXED_BYTES,
    parsePlyHeader,
    plyCost,
    parsePcdHeader,
    pcdCost,
    lasCost,
    textCost,
    pointCost,
    minimalCost,
    keptPoints,
    steadyBytes,
    planLoad,
    fractionForBudget,
  };
});
