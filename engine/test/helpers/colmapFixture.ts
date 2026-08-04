/**
 * Writes COLMAP binary model files.
 *
 * Used two ways: colmap-model.spec.ts encodes a known model and reads it back,
 * and colmap-loading.spec.ts writes the same model into testfiles/ before
 * driving the browser. Sharing one encoder means the fixture and the
 * expectations cannot disagree.
 *
 * Layouts follow COLMAP's `src/colmap/scene/reconstruction.cc` writers.
 */

export interface FixtureCamera {
  id: number;
  modelId: number;
  width: number;
  height: number;
  params: number[];
}

export interface FixtureImage {
  id: number;
  qvec: [number, number, number, number];
  tvec: [number, number, number];
  cameraId: number;
  name: string;
}

export interface FixturePoint {
  id: number;
  xyz: [number, number, number];
  rgb: [number, number, number];
  error: number;
}

class Writer {
  private readonly chunks: number[] = [];

  u8(value: number): void {
    this.chunks.push(value & 0xff);
  }

  u32(value: number): void {
    const buffer = new DataView(new ArrayBuffer(4));
    buffer.setUint32(0, value, true);
    this.pushView(buffer);
  }

  i32(value: number): void {
    const buffer = new DataView(new ArrayBuffer(4));
    buffer.setInt32(0, value, true);
    this.pushView(buffer);
  }

  u64(value: number): void {
    const buffer = new DataView(new ArrayBuffer(8));
    buffer.setBigUint64(0, BigInt(value), true);
    this.pushView(buffer);
  }

  f64(value: number): void {
    const buffer = new DataView(new ArrayBuffer(8));
    buffer.setFloat64(0, value, true);
    this.pushView(buffer);
  }

  cString(value: string): void {
    for (const byte of new TextEncoder().encode(value)) {
      this.chunks.push(byte);
    }
    this.chunks.push(0);
  }

  private pushView(view: DataView): void {
    for (let i = 0; i < view.byteLength; i++) {
      this.chunks.push(view.getUint8(i));
    }
  }

  bytes(): Uint8Array {
    return new Uint8Array(this.chunks);
  }
}

export function writeCamerasBinary(cameras: FixtureCamera[]): Uint8Array {
  const writer = new Writer();
  writer.u64(cameras.length);
  for (const camera of cameras) {
    writer.u32(camera.id);
    writer.i32(camera.modelId);
    writer.u64(camera.width);
    writer.u64(camera.height);
    for (const param of camera.params) {
      writer.f64(param);
    }
  }
  return writer.bytes();
}

export function writeImagesBinary(images: FixtureImage[]): Uint8Array {
  const writer = new Writer();
  writer.u64(images.length);
  for (const image of images) {
    writer.u32(image.id);
    for (const component of image.qvec) {
      writer.f64(component);
    }
    for (const component of image.tvec) {
      writer.f64(component);
    }
    writer.u32(image.cameraId);
    writer.cString(image.name);
    // One 2D observation, so the skip-over-observations path is exercised
    // rather than always hitting a zero-length list.
    writer.u64(1);
    writer.f64(12.5);
    writer.f64(34.5);
    writer.u64(image.id);
  }
  return writer.bytes();
}

export function writePoints3DBinary(points: FixturePoint[]): Uint8Array {
  const writer = new Writer();
  writer.u64(points.length);
  for (const point of points) {
    writer.u64(point.id);
    for (const component of point.xyz) {
      writer.f64(component);
    }
    for (const channel of point.rgb) {
      writer.u8(channel);
    }
    writer.f64(point.error);
    // A two-element track, again to exercise the skip.
    writer.u64(2);
    writer.u32(1);
    writer.u32(0);
    writer.u32(2);
    writer.u32(0);
  }
  return writer.bytes();
}

/**
 * A tiny but non-degenerate reconstruction: two cameras with different models,
 * three posed images (one of them rotated), and coloured points.
 */
export const SAMPLE_CAMERAS: FixtureCamera[] = [
  { id: 1, modelId: 1, width: 640, height: 480, params: [500, 520, 320, 240] }, // PINHOLE
  { id: 2, modelId: 4, width: 800, height: 600, params: [700, 700, 400, 300, 0.1, -0.02, 0, 0] }, // OPENCV
];

export const SAMPLE_IMAGES: FixtureImage[] = [
  { id: 1, qvec: [1, 0, 0, 0], tvec: [0, 0, 0], cameraId: 1, name: 'frame_0001.jpg' },
  { id: 2, qvec: [1, 0, 0, 0], tvec: [1, 2, 3], cameraId: 1, name: 'frame_0002.jpg' },
  {
    id: 3,
    qvec: [Math.SQRT1_2, 0, Math.SQRT1_2, 0],
    tvec: [0, 0, 1],
    cameraId: 2,
    name: 'frame_0003.jpg',
  },
];

export const SAMPLE_POINTS: FixturePoint[] = [
  { id: 1, xyz: [0, 0, 5], rgb: [255, 0, 0], error: 0.5 },
  { id: 2, xyz: [1, 0, 5], rgb: [0, 255, 0], error: 1.25 },
  { id: 3, xyz: [0, 1, 5], rgb: [0, 0, 255], error: 2 },
  { id: 4, xyz: [-1, -1, 4], rgb: [255, 255, 0], error: 0.75 },
];

export function camerasText(): string {
  return [
    '# Camera list with one line of data per camera:',
    '#   CAMERA_ID, MODEL, WIDTH, HEIGHT, PARAMS[]',
    '1 PINHOLE 640 480 500 520 320 240',
    '2 OPENCV 800 600 700 700 400 300 0.1 -0.02 0 0',
    '',
  ].join('\n');
}

export function imagesText(): string {
  const lines = ['# Image list with two lines of data per image:'];
  for (const image of SAMPLE_IMAGES) {
    lines.push(
      `${image.id} ${image.qvec.join(' ')} ${image.tvec.join(' ')} ${image.cameraId} ${image.name}`
    );
    lines.push('12.5 34.5 1');
  }
  lines.push('');
  return lines.join('\n');
}

export function points3DText(): string {
  const lines = ['# 3D point list with one line of data per point:'];
  for (const point of SAMPLE_POINTS) {
    lines.push(`${point.id} ${point.xyz.join(' ')} ${point.rgb.join(' ')} ${point.error} 1 0 2 0`);
  }
  lines.push('');
  return lines.join('\n');
}
