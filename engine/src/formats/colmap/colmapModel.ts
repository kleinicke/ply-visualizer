/**
 * COLMAP sparse reconstruction model: `cameras`, `images` and `points3D`.
 *
 * Both encodings are supported. Recent COLMAP writes `.bin` by default, so the
 * binary readers are the ones that matter in practice; `.txt` is what people
 * hand-edit and what most tutorials show.
 *
 * Everything here is pure: buffers in, plain data out, no Three.js. The scene
 * side lives in colmapReconstruction.ts and the pose maths in colmapPose.ts.
 */

/**
 * COLMAP's `model_id` ordering, which is positional and must not be reordered:
 * the binary format stores the index, and the parameter count that follows is
 * looked up from it, so an entry in the wrong slot desynchronises the stream.
 *
 * Ids 0-10 are the long-standing models. 11-17 arrived with COLMAP 4.x,
 * including EUCM and the equirectangular model that makes native 360
 * reconstruction possible - a model produced by COLMAP 4.1 cannot be read at
 * all without them.
 *
 * Counts are the length of each model's `params_info` in
 * `src/colmap/sensor/models.h`.
 */
const CAMERA_MODELS = [
  { name: 'SIMPLE_PINHOLE', paramCount: 3 }, // f, cx, cy
  { name: 'PINHOLE', paramCount: 4 }, // fx, fy, cx, cy
  { name: 'SIMPLE_RADIAL', paramCount: 4 }, // f, cx, cy, k
  { name: 'RADIAL', paramCount: 5 }, // f, cx, cy, k1, k2
  { name: 'OPENCV', paramCount: 8 }, // fx, fy, cx, cy, k1, k2, p1, p2
  { name: 'OPENCV_FISHEYE', paramCount: 8 }, // fx, fy, cx, cy, k1..k4
  { name: 'FULL_OPENCV', paramCount: 12 },
  { name: 'FOV', paramCount: 5 }, // fx, fy, cx, cy, omega
  { name: 'SIMPLE_RADIAL_FISHEYE', paramCount: 4 },
  { name: 'RADIAL_FISHEYE', paramCount: 5 },
  { name: 'THIN_PRISM_FISHEYE', paramCount: 12 },
  { name: 'RAD_TAN_THIN_PRISM_FISHEYE', paramCount: 16 }, // fx, fy, cx, cy, k0..k5, p0, p1, s0..s3
  { name: 'SIMPLE_DIVISION', paramCount: 4 }, // f, cx, cy, k
  { name: 'DIVISION', paramCount: 5 }, // fx, fy, cx, cy, k
  { name: 'SIMPLE_FISHEYE', paramCount: 3 }, // f, cx, cy
  { name: 'FISHEYE', paramCount: 4 }, // fx, fy, cx, cy
  { name: 'EUCM', paramCount: 6 }, // fx, fy, cx, cy, alpha, beta
  { name: 'EQUIRECTANGULAR', paramCount: 2 }, // w, h - no focal length at all
] as const;

/** Models storing `fx, fy` separately; the rest share one focal length. */
const TWO_FOCAL_MODELS = new Set<string>([
  'PINHOLE',
  'OPENCV',
  'OPENCV_FISHEYE',
  'FULL_OPENCV',
  'FOV',
  'THIN_PRISM_FISHEYE',
  'RAD_TAN_THIN_PRISM_FISHEYE',
  'DIVISION',
  'FISHEYE',
  'EUCM',
]);

/**
 * Index of `fy` in a model's parameter list, or null when the model has no
 * focal length (the equirectangular model is parameterised by image size).
 */
export function focalYIndex(model: string): number | null {
  if (model === 'EQUIRECTANGULAR') {
    return null;
  }
  return TWO_FOCAL_MODELS.has(model) ? 1 : 0;
}

export type ColmapCameraModelName = (typeof CAMERA_MODELS)[number]['name'];

export interface ColmapCamera {
  id: number;
  model: ColmapCameraModelName;
  width: number;
  height: number;
  /** Raw model parameters, in COLMAP's order for that model. */
  params: number[];
}

export interface ColmapImage {
  id: number;
  /** World-to-camera rotation, COLMAP order [qw, qx, qy, qz]. */
  qvec: [number, number, number, number];
  /** World-to-camera translation. */
  tvec: [number, number, number];
  cameraId: number;
  name: string;
}

export interface ColmapPoint3D {
  id: number;
  xyz: [number, number, number];
  rgb: [number, number, number];
  /** Mean reprojection error in pixels; exposed as a scalar field. */
  error: number;
}

export interface ColmapModel {
  cameras: Map<number, ColmapCamera>;
  images: ColmapImage[];
  points: ColmapPoint3D[];
}

function modelByName(name: string): (typeof CAMERA_MODELS)[number] | null {
  return CAMERA_MODELS.find(model => model.name === name) ?? null;
}

/** Strips comments and blank lines, which both text formats use identically. */
function contentLines(text: string): string[] {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0 && !line.startsWith('#'));
}

class BinaryCursor {
  private offset = 0;
  private readonly view: DataView;

  constructor(private readonly bytes: Uint8Array) {
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  get done(): boolean {
    return this.offset >= this.bytes.byteLength;
  }

  u8(): number {
    const value = this.view.getUint8(this.offset);
    this.offset += 1;
    return value;
  }

  u32(): number {
    const value = this.view.getUint32(this.offset, true);
    this.offset += 4;
    return value;
  }

  i32(): number {
    const value = this.view.getInt32(this.offset, true);
    this.offset += 4;
    return value;
  }

  /**
   * COLMAP writes 64-bit counts and ids. Number loses precision past 2^53, but
   * counts and point ids in real reconstructions stay far below that, and
   * BigInt everywhere would cost more than it buys.
   */
  u64(): number {
    const value = this.view.getBigUint64(this.offset, true);
    this.offset += 8;
    return Number(value);
  }

  f64(): number {
    const value = this.view.getFloat64(this.offset, true);
    this.offset += 8;
    return value;
  }

  /** Null-terminated UTF-8, as used for image names. */
  cString(): string {
    const start = this.offset;
    while (this.offset < this.bytes.byteLength && this.bytes[this.offset] !== 0) {
      this.offset += 1;
    }
    const text = new TextDecoder().decode(this.bytes.subarray(start, this.offset));
    this.offset += 1; // consume the terminator
    return text;
  }

  skip(byteCount: number): void {
    this.offset += byteCount;
  }
}

// ---------------------------------------------------------------------------
// cameras
// ---------------------------------------------------------------------------

/** `CAMERA_ID MODEL WIDTH HEIGHT PARAMS[]` */
export function parseCamerasText(text: string): Map<number, ColmapCamera> {
  const cameras = new Map<number, ColmapCamera>();
  for (const line of contentLines(text)) {
    const parts = line.split(/\s+/);
    if (parts.length < 5) {
      continue;
    }
    const definition = modelByName(parts[1].toUpperCase());
    if (!definition) {
      console.warn(`COLMAP: unknown camera model "${parts[1]}", skipping camera ${parts[0]}`);
      continue;
    }
    const params = parts.slice(4).map(Number);
    if (params.length !== definition.paramCount || params.some(Number.isNaN)) {
      console.warn(
        `COLMAP: ${definition.name} expects ${definition.paramCount} parameters, got ${params.length}`
      );
      continue;
    }
    const id = Number(parts[0]);
    cameras.set(id, {
      id,
      model: definition.name,
      width: Number(parts[2]),
      height: Number(parts[3]),
      params,
    });
  }
  return cameras;
}

export function parseCamerasBinary(bytes: Uint8Array): Map<number, ColmapCamera> {
  const cursor = new BinaryCursor(bytes);
  const cameras = new Map<number, ColmapCamera>();
  const count = cursor.u64();
  for (let i = 0; i < count; i++) {
    const id = cursor.u32();
    const modelId = cursor.i32();
    const width = cursor.u64();
    const height = cursor.u64();
    const definition = CAMERA_MODELS[modelId];
    if (!definition) {
      // Parameter count is unknown, so the stream cannot be resynchronised.
      throw new Error(`COLMAP: unknown camera model id ${modelId} for camera ${id}`);
    }
    const params: number[] = [];
    for (let p = 0; p < definition.paramCount; p++) {
      params.push(cursor.f64());
    }
    cameras.set(id, { id, model: definition.name, width, height, params });
  }
  return cameras;
}

// ---------------------------------------------------------------------------
// images
// ---------------------------------------------------------------------------

/**
 * Two lines per image:
 *   IMAGE_ID QW QX QY QZ TX TY TZ CAMERA_ID NAME
 *   POINTS2D[] as (X, Y, POINT3D_ID)
 * The second line is skipped - the 2D observations are not used here.
 */
export function parseImagesText(text: string): ColmapImage[] {
  const lines = contentLines(text);
  const images: ColmapImage[] = [];
  for (let i = 0; i < lines.length; i += 2) {
    const parts = lines[i].split(/\s+/);
    if (parts.length < 10) {
      continue;
    }
    const numbers = parts.slice(0, 9).map(Number);
    if (numbers.some(Number.isNaN)) {
      continue;
    }
    images.push({
      id: numbers[0],
      qvec: [numbers[1], numbers[2], numbers[3], numbers[4]],
      tvec: [numbers[5], numbers[6], numbers[7]],
      cameraId: numbers[8],
      // Names may contain spaces (e.g. "front left/0001.jpg").
      name: parts.slice(9).join(' '),
    });
  }
  return images;
}

export function parseImagesBinary(bytes: Uint8Array): ColmapImage[] {
  const cursor = new BinaryCursor(bytes);
  const images: ColmapImage[] = [];
  const count = cursor.u64();
  for (let i = 0; i < count; i++) {
    const id = cursor.u32();
    const qvec: [number, number, number, number] = [
      cursor.f64(),
      cursor.f64(),
      cursor.f64(),
      cursor.f64(),
    ];
    const tvec: [number, number, number] = [cursor.f64(), cursor.f64(), cursor.f64()];
    const cameraId = cursor.u32();
    const name = cursor.cString();
    // Each 2D observation is x (f64), y (f64) and a point3D id (8 bytes).
    const numPoints2D = cursor.u64();
    cursor.skip(numPoints2D * 24);
    images.push({ id, qvec, tvec, cameraId, name });
  }
  return images;
}

// ---------------------------------------------------------------------------
// points3D
// ---------------------------------------------------------------------------

/** `POINT3D_ID X Y Z R G B ERROR TRACK[]` */
export function parsePoints3DText(text: string): ColmapPoint3D[] {
  const points: ColmapPoint3D[] = [];
  for (const line of contentLines(text)) {
    const parts = line.split(/\s+/);
    if (parts.length < 8) {
      continue;
    }
    const numbers = parts.slice(0, 8).map(Number);
    if (numbers.some(Number.isNaN)) {
      continue;
    }
    points.push({
      id: numbers[0],
      xyz: [numbers[1], numbers[2], numbers[3]],
      rgb: [numbers[4], numbers[5], numbers[6]],
      error: numbers[7],
    });
  }
  return points;
}

export function parsePoints3DBinary(bytes: Uint8Array): ColmapPoint3D[] {
  const cursor = new BinaryCursor(bytes);
  const points: ColmapPoint3D[] = [];
  const count = cursor.u64();
  for (let i = 0; i < count; i++) {
    const id = cursor.u64();
    const xyz: [number, number, number] = [cursor.f64(), cursor.f64(), cursor.f64()];
    const rgb: [number, number, number] = [cursor.u8(), cursor.u8(), cursor.u8()];
    const error = cursor.f64();
    // Each track element is an image id and a 2D point index.
    const trackLength = cursor.u64();
    cursor.skip(trackLength * 8);
    points.push({ id, xyz, rgb, error });
  }
  return points;
}

/**
 * Chooses the reader by content rather than by extension: the text formats
 * always start with a `#` comment or an ASCII digit, while the binary ones open
 * with a little-endian 64-bit count whose high bytes are zero.
 */
export function looksLikeBinary(bytes: Uint8Array): boolean {
  if (bytes.byteLength < 8) {
    return false;
  }
  // Byte 7 is the most significant of the leading u64 count; a text file would
  // have a printable character there.
  return bytes[7] === 0 && bytes[6] === 0 && bytes[5] === 0;
}
