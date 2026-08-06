/**
 * NRRD volume reader.
 *
 * NRRD is the bridge payload between `tiff-visualizer` (which decodes DICOM,
 * OME-TIFF and friends) and this viewer: a plain-text header followed by raw
 * voxels. It was chosen over a bespoke descriptor because it is a documented
 * standard that already carries everything the handover needs — a full affine,
 * world units, dtype and endianness — so there is no private contract for two
 * repositories to keep in sync, and `.nrrd` files from 3D Slicer/ITK open here
 * directly as a side effect.
 *
 * This reader deliberately stops at "a volume in world space". Turning that
 * into geometry is `visualization/marchingCubes.ts`; nothing here knows about
 * Three.js.
 */

/** Voxel sample types NRRD can declare, normalised to the typed array we use. */
export type VolumeScalarArray =
  | Int8Array
  | Uint8Array
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | Float32Array
  | Float64Array;

export interface VolumeData {
  /** Voxel counts along the volume's own i/j/k axes. */
  sizes: [number, number, number];
  /** Samples in i-fastest order, length = sizes[0] * sizes[1] * sizes[2]. */
  samples: VolumeScalarArray;
  /**
   * Voxel index (i,j,k,1) to world space, row-major 4x4.
   *
   * This is the whole reason the bridge carries an affine rather than a
   * spacing triple: DICOM series are routinely oblique, so axis-aligned
   * spacing cannot represent them. An axis-aligned volume is just an affine
   * with a diagonal 3x3.
   */
  ijkToWorld: number[];
  /** World unit of the affine's translation/scale, e.g. "mm". */
  spaceUnits: string;
  /**
   * What a sample *means*. CT arrives in Hounsfield units once
   * RescaleSlope/RescaleIntercept have been applied, which is what makes a
   * threshold like "+300 HU" mean bone rather than an arbitrary number.
   * Microscopy has no such scale and leaves this undefined.
   */
  intensityUnits?: string;
  /** Inclusive sample range, when the producer measured it. */
  range?: { min: number; max: number };
  /** Channel/component count; only channel 0 is used for isosurfacing today. */
  channels: number;
  /** Everything from the header, including `key:=value` pairs. */
  header: Record<string, string>;
  fileName?: string;
}

interface TypeInfo {
  make: (buffer: ArrayBuffer, count: number) => VolumeScalarArray;
  bytes: number;
  /** Single-byte types are endian-independent. */
  endianSensitive: boolean;
}

// The `_t` spellings are NRRD's own type names (it accepts the C99 stdint
// forms alongside the C ones), so they are data, not identifiers we chose.
/* eslint-disable @typescript-eslint/naming-convention */
const TYPES: Record<string, TypeInfo> = {
  'signed char': { make: b => new Int8Array(b), bytes: 1, endianSensitive: false },
  int8: { make: b => new Int8Array(b), bytes: 1, endianSensitive: false },
  int8_t: { make: b => new Int8Array(b), bytes: 1, endianSensitive: false },
  uchar: { make: b => new Uint8Array(b), bytes: 1, endianSensitive: false },
  'unsigned char': { make: b => new Uint8Array(b), bytes: 1, endianSensitive: false },
  uint8: { make: b => new Uint8Array(b), bytes: 1, endianSensitive: false },
  uint8_t: { make: b => new Uint8Array(b), bytes: 1, endianSensitive: false },
  short: { make: b => new Int16Array(b), bytes: 2, endianSensitive: true },
  'short int': { make: b => new Int16Array(b), bytes: 2, endianSensitive: true },
  'signed short': { make: b => new Int16Array(b), bytes: 2, endianSensitive: true },
  int16: { make: b => new Int16Array(b), bytes: 2, endianSensitive: true },
  int16_t: { make: b => new Int16Array(b), bytes: 2, endianSensitive: true },
  ushort: { make: b => new Uint16Array(b), bytes: 2, endianSensitive: true },
  'unsigned short': { make: b => new Uint16Array(b), bytes: 2, endianSensitive: true },
  uint16: { make: b => new Uint16Array(b), bytes: 2, endianSensitive: true },
  uint16_t: { make: b => new Uint16Array(b), bytes: 2, endianSensitive: true },
  int: { make: b => new Int32Array(b), bytes: 4, endianSensitive: true },
  'signed int': { make: b => new Int32Array(b), bytes: 4, endianSensitive: true },
  int32: { make: b => new Int32Array(b), bytes: 4, endianSensitive: true },
  int32_t: { make: b => new Int32Array(b), bytes: 4, endianSensitive: true },
  uint: { make: b => new Uint32Array(b), bytes: 4, endianSensitive: true },
  'unsigned int': { make: b => new Uint32Array(b), bytes: 4, endianSensitive: true },
  uint32: { make: b => new Uint32Array(b), bytes: 4, endianSensitive: true },
  uint32_t: { make: b => new Uint32Array(b), bytes: 4, endianSensitive: true },
  float: { make: b => new Float32Array(b), bytes: 4, endianSensitive: true },
  double: { make: b => new Float64Array(b), bytes: 8, endianSensitive: true },
};
/* eslint-enable @typescript-eslint/naming-convention */

/** How the reader gets at a detached `.nhdr`'s data file. */
export type DataFileResolver = (relativePath: string) => Promise<Uint8Array>;

export class NrrdParser {
  async parse(
    data: Uint8Array,
    fileName = 'volume.nrrd',
    timingCallback?: (message: string) => void,
    resolveDataFile?: DataFileResolver
  ): Promise<VolumeData> {
    const start = performance.now();
    timingCallback?.('🔍 NRRD: reading header...');

    const { header, dataStart } = readHeader(data);

    const magic = header['__magic__'] || '';
    if (!/^NRRD\d+$/.test(magic)) {
      throw new Error('Not an NRRD file: missing "NRRD000x" magic line');
    }

    const dimension = Number(header['dimension']);
    if (!Number.isFinite(dimension) || dimension < 3 || dimension > 4) {
      throw new Error(
        `NRRD dimension ${header['dimension'] ?? '(missing)'} is not supported; ` +
          'this viewer reads 3D volumes, optionally with one channel axis'
      );
    }

    const sizesField = numbers(header['sizes']);
    if (sizesField.length !== dimension) {
      throw new Error(
        `NRRD "sizes" lists ${sizesField.length} entries but dimension is ${dimension}`
      );
    }

    // A 4D NRRD carries a channel axis. Per the spec it is whichever axis has a
    // non-spatial `kinds` entry; in practice producers put it first. Detect it
    // rather than assuming, because guessing wrong silently transposes the
    // volume instead of failing.
    const kinds = (header['kinds'] || '').trim().split(/\s+/).filter(Boolean);
    let channelAxis = -1;
    if (dimension === 4) {
      channelAxis = kinds.findIndex(kind => !/^domain$|^space$/i.test(kind));
      if (channelAxis === -1) {
        channelAxis = 0;
      }
      if (channelAxis !== 0) {
        throw new Error(
          'NRRD has a channel axis that is not the first axis; only channel-first ' +
            '4D volumes are supported. Re-save with the channel axis first.'
        );
      }
    }

    const channels = channelAxis === -1 ? 1 : sizesField[channelAxis];
    const spatialSizes = (channelAxis === -1 ? sizesField : sizesField.slice(1)) as number[];
    const sizes: [number, number, number] = [spatialSizes[0], spatialSizes[1], spatialSizes[2]];
    const voxelCount = sizes[0] * sizes[1] * sizes[2];
    if (!voxelCount) {
      throw new Error('NRRD volume is empty');
    }

    const typeKey = (header['type'] || '').trim().toLowerCase();
    const type = TYPES[typeKey];
    if (!type) {
      throw new Error(`Unsupported NRRD sample type "${header['type']}"`);
    }

    const encoding = (header['encoding'] || 'raw').trim().toLowerCase();

    let payload: Uint8Array;
    if (header['data file'] || header['datafile']) {
      const relative = (header['data file'] || header['datafile']).trim();
      if (relative.startsWith('LIST')) {
        throw new Error('Detached NRRD "data file: LIST" (one file per slice) is not supported');
      }
      if (!resolveDataFile) {
        throw new Error(
          `NRRD header references a detached data file "${relative}" but no way to read it was provided`
        );
      }
      payload = await resolveDataFile(relative);
    } else {
      payload = data.subarray(dataStart);
    }

    timingCallback?.(`🔍 NRRD: decoding ${encoding} payload...`);
    const raw = await decodePayload(payload, encoding, type, voxelCount * channels);

    const expectedBytes = voxelCount * channels * type.bytes;
    if (raw.byteLength < expectedBytes) {
      throw new Error(
        `NRRD data is truncated: expected ${expectedBytes} bytes for ` +
          `${sizes.join('x')}${channels > 1 ? ` x ${channels} channels` : ''}, got ${raw.byteLength}`
      );
    }

    // Copy to an exactly-sized, correctly-aligned buffer. `subarray` on the
    // file bytes is a view whose byteOffset is almost never a multiple of the
    // sample size, which typed-array constructors reject.
    const aligned = raw.buffer.slice(raw.byteOffset, raw.byteOffset + expectedBytes) as ArrayBuffer;

    if (type.endianSensitive && (header['endian'] || 'little').trim().toLowerCase() === 'big') {
      swapEndianness(aligned, type.bytes);
    }

    let samples = type.make(aligned, voxelCount * channels);
    if (channels > 1) {
      samples = extractChannel(samples, channels, 0);
    }

    const volume: VolumeData = {
      sizes,
      samples,
      ijkToWorld: buildAffine(header, sizes, channelAxis !== -1),
      spaceUnits: readSpaceUnits(header),
      intensityUnits: readIntensityUnits(header),
      range: readRange(header),
      channels,
      header,
      fileName,
    };

    timingCallback?.(
      `✅ NRRD: ${sizes.join('x')} ${typeKey} volume in ${(performance.now() - start).toFixed(1)}ms`
    );
    return volume;
  }
}

/**
 * Splits the header from the data.
 *
 * The header is ASCII lines terminated by a blank line; the data begins on the
 * byte after it. Scanning bytes rather than decoding the whole file matters:
 * decoding a gigabyte of voxels as UTF-8 to find a newline is both slow and
 * lossy.
 */
function readHeader(data: Uint8Array): { header: Record<string, string>; dataStart: number } {
  const header: Record<string, string> = {};
  let offset = 0;
  let lineIndex = 0;
  const limit = Math.min(data.length, 1 << 20);

  while (offset < limit) {
    let end = offset;
    while (end < limit && data[end] !== 0x0a) {
      end++;
    }
    // Tolerate CRLF, which Windows producers emit.
    let textEnd = end;
    if (textEnd > offset && data[textEnd - 1] === 0x0d) {
      textEnd--;
    }

    const line = latin1(data, offset, textEnd);
    offset = end + 1;

    if (lineIndex === 0) {
      header['__magic__'] = line.trim();
      lineIndex++;
      continue;
    }
    lineIndex++;

    if (line.trim() === '') {
      return { header, dataStart: offset };
    }
    if (line.startsWith('#')) {
      continue;
    }

    // `key:=value` is a key/value pair, `key: value` a field. Both are kept in
    // one map; the `:=` form is how producers attach custom metadata such as
    // the intensity units this viewer reads back.
    const kv = line.indexOf(':=');
    if (kv > 0) {
      header[line.slice(0, kv).trim().toLowerCase()] = line.slice(kv + 2).trim();
      continue;
    }
    const colon = line.indexOf(':');
    if (colon > 0) {
      header[line.slice(0, colon).trim().toLowerCase()] = line.slice(colon + 1).trim();
    }
  }

  throw new Error('NRRD header is not terminated by a blank line');
}

function latin1(data: Uint8Array, from: number, to: number): string {
  let out = '';
  for (let i = from; i < to; i++) {
    out += String.fromCharCode(data[i]);
  }
  return out;
}

function numbers(value: string | undefined): number[] {
  if (!value) {
    return [];
  }
  return value
    .trim()
    .split(/\s+/)
    .map(Number)
    .filter(n => Number.isFinite(n));
}

/** Parses NRRD's `(x,y,z)` vector syntax; `none` marks a non-spatial axis. */
function parseVectors(value: string | undefined): (number[] | null)[] {
  if (!value) {
    return [];
  }
  const out: (number[] | null)[] = [];
  const pattern = /none|\(([^)]*)\)/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(value)) !== null) {
    if (match[0].toLowerCase() === 'none') {
      out.push(null);
    } else {
      out.push(match[1].split(',').map(part => Number(part.trim())));
    }
  }
  return out;
}

/**
 * Builds the voxel-to-world affine, normalising to RAS.
 *
 * DICOM — and therefore anything derived from it — is LPS: +x left, +y
 * posterior. RAS is the convention this viewer treats as world space, so an
 * LPS volume has its first two world axes negated. Without this a CT scan
 * loads mirrored, which is the kind of error that looks plausible on a
 * roughly-symmetric body and is then very hard to notice.
 */
function buildAffine(
  header: Record<string, string>,
  sizes: [number, number, number],
  hasChannelAxis: boolean
): number[] {
  const directions = parseVectors(header['space directions']).filter(v => v !== null) as number[][];
  const origin = parseVectors(header['space origin'])[0] || [0, 0, 0];
  const spacings = numbers(header['spacings']);

  let columns: number[][];
  if (directions.length >= 3) {
    columns = directions.slice(0, 3);
  } else {
    // No `space directions`: fall back to axis-aligned `spacings`, then to
    // unit voxels. Both are legal NRRD and common in non-medical volumes.
    const offset = hasChannelAxis && spacings.length > 3 ? 1 : 0;
    const s = [0, 1, 2].map(i => {
      const value = spacings[i + offset];
      return Number.isFinite(value) && value !== 0 ? value : 1;
    });
    columns = [
      [s[0], 0, 0],
      [0, s[1], 0],
      [0, 0, s[2]],
    ];
  }

  const space = (header['space'] || '').trim().toLowerCase();
  const isLps = space.startsWith('left-posterior-superior') || space === 'lps';
  const flip = isLps ? [-1, -1, 1] : [1, 1, 1];

  // Row-major 4x4: world = M * (i, j, k, 1).
  const m = [
    flip[0] * columns[0][0],
    flip[0] * columns[1][0],
    flip[0] * columns[2][0],
    flip[0] * (origin[0] ?? 0),
    flip[1] * columns[0][1],
    flip[1] * columns[1][1],
    flip[1] * columns[2][1],
    flip[1] * (origin[1] ?? 0),
    flip[2] * columns[0][2],
    flip[2] * columns[1][2],
    flip[2] * columns[2][2],
    flip[2] * (origin[2] ?? 0),
    0,
    0,
    0,
    1,
  ];
  void sizes;
  return m;
}

function readSpaceUnits(header: Record<string, string>): string {
  const declared = header['space units'];
  if (declared) {
    const first = declared.match(/"([^"]*)"/);
    if (first?.[1]) {
      return first[1];
    }
  }
  // Medical NRRD without explicit units is millimetres by convention.
  return 'mm';
}

/**
 * Intensity semantics, which NRRD has no standard field for.
 *
 * `units:=HU` is what the tiff-visualizer bridge writes after applying
 * RescaleSlope/RescaleIntercept. `modality` is the DICOM-derived fallback so a
 * CT written by another tool still gets Hounsfield-aware defaults.
 */
function readIntensityUnits(header: Record<string, string>): string | undefined {
  const explicit = (header['units'] || header['intensity units'] || '').replace(/"/g, '').trim();
  if (explicit) {
    return explicit;
  }
  const modality = (header['modality'] || '').trim().toUpperCase();
  if (modality === 'CT' || modality.endsWith(':CT')) {
    return 'HU';
  }
  return undefined;
}

function readRange(header: Record<string, string>): { min: number; max: number } | undefined {
  const min = Number(header['min']);
  const max = Number(header['max']);
  if (Number.isFinite(min) && Number.isFinite(max) && max > min) {
    return { min, max };
  }
  return undefined;
}

async function decodePayload(
  payload: Uint8Array,
  encoding: string,
  type: TypeInfo,
  sampleCount: number
): Promise<Uint8Array> {
  if (encoding === 'raw') {
    return payload;
  }
  if (encoding === 'gzip' || encoding === 'gz') {
    return inflateGzip(payload);
  }
  if (encoding === 'ascii' || encoding === 'text' || encoding === 'txt') {
    return encodeAscii(payload, type, sampleCount);
  }
  throw new Error(
    `NRRD encoding "${encoding}" is not supported (raw, gzip and ascii are). ` +
      'Re-save the volume with "encoding: gzip".'
  );
}

/**
 * Gzip via the platform's DecompressionStream — present in every browser this
 * viewer targets and in the Node the extension host runs, so the bridge needs
 * no bundled inflate.
 */
async function inflateGzip(payload: Uint8Array): Promise<Uint8Array> {
  const decompressionStream = (globalThis as any).DecompressionStream;
  if (typeof decompressionStream !== 'function') {
    throw new Error('Gzip-encoded NRRD needs DecompressionStream, which this runtime lacks');
  }
  const stream = new Blob([payload as unknown as BlobPart])
    .stream()
    .pipeThrough(new decompressionStream('gzip'));
  const buffer = await new Response(stream).arrayBuffer();
  return new Uint8Array(buffer);
}

function encodeAscii(payload: Uint8Array, type: TypeInfo, sampleCount: number): Uint8Array {
  const text = new TextDecoder().decode(payload);
  const tokens = text.trim().split(/\s+/);
  if (tokens.length < sampleCount) {
    throw new Error(`ASCII NRRD holds ${tokens.length} values but ${sampleCount} were expected`);
  }
  const buffer = new ArrayBuffer(sampleCount * type.bytes);
  const target = type.make(buffer, sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    target[i] = Number(tokens[i]);
  }
  return new Uint8Array(buffer);
}

function swapEndianness(buffer: ArrayBuffer, bytesPerSample: number): void {
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i += bytesPerSample) {
    for (let low = 0, high = bytesPerSample - 1; low < high; low++, high--) {
      const temp = bytes[i + low];
      bytes[i + low] = bytes[i + high];
      bytes[i + high] = temp;
    }
  }
}

/** Interleaved channel-first samples to one channel's plane. */
function extractChannel(
  samples: VolumeScalarArray,
  channels: number,
  channel: number
): VolumeScalarArray {
  const count = samples.length / channels;
  const out = new (samples.constructor as new (length: number) => VolumeScalarArray)(count);
  for (let i = 0; i < count; i++) {
    out[i] = samples[i * channels + channel];
  }
  return out;
}
