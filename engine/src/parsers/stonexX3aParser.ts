/**
 * Experimental reader for Stonex X300 RAW archives (.x3a).
 *
 * X3A is a proprietary CRAX container.  X300 scan records inside it use the
 * X3R layout observed in firmware v14: a descriptor followed by XCOL blocks,
 * each containing an azimuth and an organized column of range/pulse-width
 * samples. X3I members are uncompressed 8-bit GRBG Bayer frames; the paired
 * XML calibration files contain OpenCV intrinsics and model-to-camera poses.
 *
 * Photographic colour is decoded RAW here. White balance and exposure are
 * measured but not baked in; the parser emits the raw colours, a per-point
 * camera-frame index and the measurements, and
 * `visualization/stonexColorCorrection` applies the user's chosen modes. A
 * re-parse of a 113 MB archive costs ~5 s, so switching modes has to be a
 * colour-array pass rather than a reload.
 */

import { registerPair, type UpAxis } from '../registration';
import { loadStonexWasm, type StonexColourSession } from './stonexWasm';
import { colorFromAllStations, type StationFrame, type StationScan } from './stonexStationColoring';
import {
  applyStonexColorCorrectionToPoints,
  buildStonexColorCalibration,
  computeStonexFrameMultipliers,
  DEFAULT_STONEX_COLOR_CORRECTION,
  STONEX_NO_FRAME,
  type StonexBandGains,
  type StonexColorCalibration,
  type StonexFrameCalibration,
} from '../visualization/stonexColorCorrection';

export interface StonexX3aData {
  vertexCount: number;
  sourcePointCount: number;
  faceCount: 0;
  hasColors: boolean;
  hasNormals: false;
  hasIntensity: true;
  format: 'binary_little_endian';
  version: '1.0';
  fileName: string;
  fileIndex?: number;
  comments: string[];
  vertices: never[];
  faces: never[];
  positionsArray: Float32Array;
  colorsArray: Uint8Array | null;
  normalsArray: null;
  intensityArray: Float32Array;
  scalarFields: Record<string, Float32Array>;
  useTypedArrays: true;
  metadata: Record<string, unknown>;
}

interface ArchiveMember {
  name: string;
  offset: number;
  size: number;
}

interface ScanLayout extends ArchiveMember {
  columns: number;
  rows: number;
  columnOffset: number;
  columnStride: number;
  validPoints: number;
}

interface ScanPointRange {
  name: string;
  memberSize: number;
  sourcePointCount: number;
  pointOffset: number;
  pointCount: number;
  photographicallyColoredPoints: number;
}

interface CameraCalibration {
  type: 'U' | 'D';
  width: number;
  height: number;
  fovX: number;
  fovY: number;
  fx: number;
  fy: number;
  cx: number;
  cy: number;
  distortionCoefficients: number[];
  modelToCamera: number[];
}

export interface StonexCameraProjectionRequest {
  positions: Float32Array;
  indices: Uint32Array;
  fx: number;
  fy: number;
  cx: number;
  cy: number;
  coefficients: readonly number[];
  transform: readonly number[];
  maxNormalizedX: number;
  maxNormalizedY: number;
}

export type StonexCameraBatchProjector = (
  request: StonexCameraProjectionRequest
) => Float32Array | null;

export type StonexProjectionDiagnostic =
  | 'normal'
  | 'own-station-only'
  | 'u-only'
  | 'd-only'
  | 'ideal-pinhole'
  | 'reverse-pan'
  | 'invert-extrinsic';

interface CameraFrame {
  /** Stable position in the archive's complete X3I list, even in a scoped run. */
  archiveFrameIndex: number;
  member: ArchiveMember;
  scanStem: string;
  type: 'U' | 'D';
  panDegrees: number;
  rawWidth: number;
  rawHeight: number;
  pixelsOffset: number;
  /**
   * Measured per-frame characteristics. Gains are NOT applied while decoding —
   * pixels stay raw and `stonexColorCorrection` applies the user's chosen mode
   * afterwards, so the modes stay switchable without a re-parse.
   */
  grayRedGain: number;
  grayBlueGain: number;
  meanGreen: number;
  rgbImage?: CameraRgbImage;
  preview?: { width: number; height: number; rgba: Uint8Array };
  calibration: CameraCalibration;
}

interface CameraRgbImage {
  width: number;
  height: number;
  data: Uint8Array;
}

export interface StonexCameraFrameMetadata {
  name: string;
  /**
   * Stem of the scan this frame was shot from, i.e. which station it belongs
   * to. The viewer needs it to place panoramas from different stations where
   * they were actually taken instead of stacking them on one origin.
   */
  scanStem?: string;
  type: 'U' | 'D';
  panDegrees: number;
  imageWidth: number;
  imageHeight: number;
  fx: number;
  fy: number;
  cx: number;
  cy: number;
  distortionCoefficients: number[];
  modelToCamera: number[];
  previewWidth: number;
  previewHeight: number;
  /** RAW (un-white-balanced) thumbnail; stonexCameras corrects it per frame. */
  previewRgba: Uint8Array;
}

const ARCHIVE_MAGIC = 'CRAX';
const X3R_MAGIC = '003X';
const COLUMN_MAGIC = 'XCOL';
const ARCHIVE_HEADER_BYTES = 88;
const ARCHIVE_ENTRY_BYTES = 512;
const ARCHIVE_NAME_BYTES = 496;
const X3R_COLUMN_OFFSET = 16_408;
const X3R_COLUMN_HEADER_BYTES = 48;
const RANGE_SCALE_METRES = 1e-4;
const PULSE_WIDTH_MAX = 16_383;
const INVALID_RANGE_MAX = 0x7fffffff;
const VERTICAL_MIN_DEGREES = -25;
const VERTICAL_SPAN_DEGREES = 90;
const VERTICAL_MAX_DEGREES = VERTICAL_MIN_DEGREES + VERTICAL_SPAN_DEGREES;
const X3I_HEADER_BYTES = 64;
const CAMERA_RGB_SCALE = 0.5;
// Diagnostic switches retained for future calibration investigations. Normal
// loading uses both camera families and their calibrated distortion.
const CAMERA_COLOR_DIAGNOSTIC_TYPE: 'U' | 'D' | null = null;
const CAMERA_COLOR_DIAGNOSTIC_IDEAL_PINHOLE = false;

function ascii(data: Uint8Array, offset: number, length: number): string {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += String.fromCharCode(data[offset + i]);
  }
  return result;
}

function findColumnOffset(data: Uint8Array, member: ArchiveMember): number {
  const expected = member.offset + X3R_COLUMN_OFFSET;
  if (expected + 4 <= member.offset + member.size && ascii(data, expected, 4) === COLUMN_MAGIC) {
    return expected;
  }

  // Keep the decoder useful for nearby firmware layouts while still placing
  // a conservative bound on malformed-file work.
  const end = Math.min(member.offset + member.size, member.offset + 1024 * 1024);
  for (let offset = member.offset + 16; offset + 4 <= end; offset += 4) {
    if (ascii(data, offset, 4) === COLUMN_MAGIC) {
      return offset;
    }
  }
  throw new Error(`Stonex X3A: ${member.name} has no XCOL scan data`);
}

function xmlAttribute(tag: string, name: string): number {
  const match = tag.match(new RegExp(`${name}="([^"]+)"`));
  return match ? Number(match[1]) : Number.NaN;
}

function xmlStringAttribute(tag: string, name: string): string | null {
  return tag.match(new RegExp(`${name}="([^"]+)"`))?.[1] ?? null;
}

function parseCalibration(data: Uint8Array, member: ArchiveMember): CameraCalibration | null {
  const type = member.name.toUpperCase().startsWith('U_')
    ? 'U'
    : member.name.toUpperCase().startsWith('D_')
      ? 'D'
      : null;
  if (!type) {
    return null;
  }
  const xml = new TextDecoder().decode(data.subarray(member.offset, member.offset + member.size));
  const root = xml.match(/<CameraCalibration\b[^>]*>/)?.[0];
  const intrinsics = xml.match(/<InternalOpenCV\b[^>]*>/)?.[0];
  const matrixText = xml.match(/<Model2CameraMatrix>[\s\S]*?RowOrder="([^"]+)"/)?.[1];
  if (!root || !intrinsics || !matrixText) {
    return null;
  }
  const modelToCamera = matrixText.trim().split(/\s+/).map(Number);
  const distortionCoefficients = (xmlStringAttribute(intrinsics, 'DistCoeffs') ?? '')
    .split(',')
    .map(value => Number(value.trim()));
  const calibration: CameraCalibration = {
    type,
    width: xmlAttribute(root, 'Width'),
    height: xmlAttribute(root, 'Height'),
    fovX: xmlAttribute(root, 'FOVX'),
    fovY: xmlAttribute(root, 'FOVY'),
    fx: xmlAttribute(intrinsics, 'fx'),
    fy: xmlAttribute(intrinsics, 'fy'),
    cx: xmlAttribute(intrinsics, 'cx'),
    cy: xmlAttribute(intrinsics, 'cy'),
    distortionCoefficients,
    modelToCamera,
  };
  return modelToCamera.length === 16 &&
    [4, 5, 8, 12, 14].includes(distortionCoefficients.length) &&
    Object.values(calibration).every(value =>
      Array.isArray(value)
        ? value.every(Number.isFinite)
        : typeof value === 'string' || Number.isFinite(value)
    )
    ? calibration
    : null;
}

function bayerWhiteBalance(
  data: Uint8Array,
  pixelsOffset: number,
  width: number,
  height: number
): { grayRedGain: number; grayBlueGain: number; meanGreen: number } {
  let red = 0;
  let green = 0;
  let blue = 0;
  let samples = 0;
  // GRBG: even row = G R, odd row = B G. Subsampling keeps this cheap while
  // gray-world balancing removes the strong raw-sensor green cast.
  for (let y = 0; y + 1 < height; y += 16) {
    const evenY = y & ~1;
    for (let x = 0; x + 1 < width; x += 16) {
      const evenX = x & ~1;
      const row0 = pixelsOffset + evenY * width + evenX;
      const row1 = row0 + width;
      green += (data[row0] + data[row1 + 1]) * 0.5;
      red += data[row0 + 1];
      blue += data[row1];
      samples++;
    }
  }
  if (samples === 0 || red === 0 || blue === 0) {
    return { grayRedGain: 1, grayBlueGain: 1, meanGreen: green / Math.max(1, samples) };
  }
  return {
    grayRedGain: green / red,
    grayBlueGain: green / blue,
    meanGreen: green / samples,
  };
}

function parseCameraFrames(
  data: Uint8Array,
  view: DataView,
  members: ArchiveMember[],
  calibrations: Map<'U' | 'D', CameraCalibration>
): { frames: CameraFrame[]; bandGains: Partial<Record<'U' | 'D', StonexBandGains>> } {
  const frames: CameraFrame[] = [];
  const bandGains: Partial<Record<'U' | 'D', StonexBandGains>> = {};
  for (const member of members) {
    const match = member.name.match(/^(.*)-([UD])(\d{9})\.x3i$/i);
    if (!match || member.size < X3I_HEADER_BYTES) {
      continue;
    }
    const type = match[2].toUpperCase() as 'U' | 'D';
    const calibration = calibrations.get(type);
    if (!calibration) {
      continue;
    }
    const rawWidth = view.getUint32(member.offset + 8, true);
    const rawHeight = view.getUint32(member.offset + 12, true);
    const payloadBytes = view.getUint32(member.offset + 16, true);
    if (
      rawWidth * rawHeight !== payloadBytes ||
      X3I_HEADER_BYTES + payloadBytes > member.size ||
      calibration.width !== rawHeight ||
      calibration.height !== rawWidth
    ) {
      continue;
    }
    const pixelsOffset = member.offset + X3I_HEADER_BYTES;
    const gains = bayerWhiteBalance(data, pixelsOffset, rawWidth, rawHeight);
    frames.push({
      archiveFrameIndex: frames.length,
      member,
      scanStem: match[1],
      type,
      panDegrees: Number(match[3]) * 1e-6,
      rawWidth,
      rawHeight,
      pixelsOffset,
      ...gains,
      calibration,
    });
  }
  if (frames.length > 0) {
    for (const type of ['U', 'D'] as const) {
      const typedFrames = frames.filter(frame => frame.type === type);
      if (typedFrames.length === 0) {
        continue;
      }
      const fallback = {
        redGain:
          typedFrames.reduce((sum, frame) => sum + frame.grayRedGain, 0) / typedFrames.length,
        blueGain:
          typedFrames.reduce((sum, frame) => sum + frame.grayBlueGain, 0) / typedFrames.length,
      };
      const references = typedFrames
        .map(frame => portraitTopLeftWhiteBalance(data, frame))
        .filter((value): value is { redGain: number; blueGain: number; score: number } => !!value)
        .sort((a, b) => b.score - a.score);
      bandGains[type] = references[0]
        ? { redGain: references[0].redGain, blueGain: references[0].blueGain }
        : fallback;
    }
  }
  // Deliberately *not* decoding the frames here. The demosaic is a fifth of a
  // large archive's load and a half of a small one's, and doing it up front
  // means the points cannot be shown until every photograph has been unpacked.
  // `sampleCameraRgb` decodes each frame the first time it is read instead.
  return { frames, bandGains };
}

function portraitTopLeftWhiteBalance(
  data: Uint8Array,
  frame: CameraFrame
): { redGain: number; blueGain: number; score: number } | null {
  const patchSize = Math.min(200, frame.rawWidth, frame.rawHeight);
  let red = 0;
  let green = 0;
  let greenSquares = 0;
  let blue = 0;
  let samples = 0;
  for (let y = frame.rawHeight - patchSize; y + 1 < frame.rawHeight; y += 2) {
    for (let x = 0; x + 1 < patchSize; x += 2) {
      const row0 = frame.pixelsOffset + y * frame.rawWidth + x;
      const row1 = row0 + frame.rawWidth;
      const sampleGreen = (data[row0] + data[row1 + 1]) * 0.5;
      green += sampleGreen;
      greenSquares += sampleGreen * sampleGreen;
      red += data[row0 + 1];
      blue += data[row1];
      samples++;
    }
  }
  if (!samples || !red || !blue) {
    return null;
  }
  const meanRed = red / samples;
  const meanGreen = green / samples;
  const meanBlue = blue / samples;
  if (Math.max(meanRed, meanGreen, meanBlue) >= 250) {
    return null;
  }
  const greenDeviation = Math.sqrt(Math.max(0, greenSquares / samples - meanGreen * meanGreen));
  return {
    redGain: meanGreen / meanRed,
    blueGain: meanGreen / meanBlue,
    score: meanGreen / (1 + greenDeviation),
  };
}

function nearestParity(value: number, parity: 0 | 1, maximum: number): number {
  let result = Math.round(value);
  if ((result & 1) !== parity) {
    result += value >= result ? 1 : -1;
  }
  return Math.max(0, Math.min(maximum - 1, result));
}

function sampleBayerLattice(
  data: Uint8Array,
  frame: CameraFrame,
  rawX: number,
  rawY: number,
  parityX: 0 | 1,
  parityY: 0 | 1
): number {
  const latticeX = (rawX - parityX) * 0.5;
  const latticeY = (rawY - parityY) * 0.5;
  const x0 = Math.floor(latticeX);
  const y0 = Math.floor(latticeY);
  const tx = latticeX - x0;
  const ty = latticeY - y0;
  const maxX = Math.floor((frame.rawWidth - 1 - parityX) * 0.5);
  const maxY = Math.floor((frame.rawHeight - 1 - parityY) * 0.5);
  const clampX = (value: number) => Math.max(0, Math.min(maxX, value));
  const clampY = (value: number) => Math.max(0, Math.min(maxY, value));
  const read = (x: number, y: number) =>
    data[frame.pixelsOffset + (clampY(y) * 2 + parityY) * frame.rawWidth + clampX(x) * 2 + parityX];
  const top = read(x0, y0) * (1 - tx) + read(x0 + 1, y0) * tx;
  const bottom = read(x0, y0 + 1) * (1 - tx) + read(x0 + 1, y0 + 1) * tx;
  return top * (1 - ty) + bottom * ty;
}

function sampleGrbgInterpolated(
  data: Uint8Array,
  frame: CameraFrame,
  portraitX: number,
  portraitY: number
): [number, number, number] {
  const rawX = portraitY;
  const rawY = frame.rawHeight - 1 - portraitX;
  // Raw sensor values: white balance is applied later by stonexColorCorrection.
  const red = sampleBayerLattice(data, frame, rawX, rawY, 1, 0);
  const green =
    (sampleBayerLattice(data, frame, rawX, rawY, 0, 0) +
      sampleBayerLattice(data, frame, rawX, rawY, 1, 1)) *
    0.5;
  const blue = sampleBayerLattice(data, frame, rawX, rawY, 0, 1);
  return [Math.min(255, red), Math.min(255, green), Math.min(255, blue)];
}

/**
 * Frame description in the shape the Rust colour pass takes. Exported for the
 * port's differential test, which has to drive both implementations from the
 * same calibration rather than restating it.
 */
export function stonexFrameDescriptorForComparison(
  frame: CameraFrame,
  pixelOffset: number
): Record<string, unknown> {
  return stonexFrameDescriptor(frame, pixelOffset);
}

/** Frame description in the shape the Rust colour pass takes. */
function stonexFrameDescriptor(frame: CameraFrame, pixelOffset: number): Record<string, unknown> {
  const calibration = frame.calibration;
  return {
    pixelOffset,
    rawWidth: frame.rawWidth,
    rawHeight: frame.rawHeight,
    imageWidth: calibration.width,
    imageHeight: calibration.height,
    panDegrees: frame.panDegrees,
    fx: calibration.fx,
    fy: calibration.fy,
    cx: calibration.cx,
    cy: calibration.cy,
    distortion: [...calibration.distortionCoefficients],
    viewerToCamera: viewerToCameraTransform(frame),
    maxNormalizedX: Math.tan((calibration.fovX * Math.PI) / 360),
    maxNormalizedY: Math.tan((calibration.fovY * Math.PI) / 360),
  };
}

/**
 * Exported for the Rust port's differential test: the Rust demosaic has to be
 * byte-identical to this before it replaces it.
 */
export function decodeCameraRgbForComparison(
  pixels: Uint8Array,
  rawWidth: number,
  rawHeight: number,
  imageWidth: number,
  imageHeight: number
): CameraRgbImage {
  return decodeCameraRgb(pixels, {
    pixelsOffset: 0,
    rawWidth,
    rawHeight,
    calibration: { width: imageWidth, height: imageHeight },
  } as unknown as CameraFrame);
}

function decodeCameraRgb(data: Uint8Array, frame: CameraFrame): CameraRgbImage {
  const width = Math.ceil(frame.calibration.width * CAMERA_RGB_SCALE);
  const height = Math.ceil(frame.calibration.height * CAMERA_RGB_SCALE);
  const rgb = new Uint8Array(width * height * 3);
  for (let y = 0; y < height; y++) {
    const portraitY = (y + 0.5) / CAMERA_RGB_SCALE - 0.5;
    for (let x = 0; x < width; x++) {
      const portraitX = (x + 0.5) / CAMERA_RGB_SCALE - 0.5;
      const color = sampleGrbgInterpolated(data, frame, portraitX, portraitY);
      const offset = (y * width + x) * 3;
      rgb[offset] = Math.round(color[0]);
      rgb[offset + 1] = Math.round(color[1]);
      rgb[offset + 2] = Math.round(color[2]);
    }
  }
  return { width, height, data: rgb };
}

function sampleCameraRgb(
  data: Uint8Array,
  frame: CameraFrame,
  portraitX: number,
  portraitY: number
): [number, number, number] {
  // Decoded on demand and cached on the frame: the first sample of a frame
  // pays for its demosaic, which keeps the whole cost after the geometry has
  // already been handed over.
  const image = frame.rgbImage ?? (frame.rgbImage = decodeCameraRgb(data, frame));
  const imageX = (portraitX + 0.5) * CAMERA_RGB_SCALE - 0.5;
  const imageY = (portraitY + 0.5) * CAMERA_RGB_SCALE - 0.5;
  const x0 = Math.floor(imageX);
  const y0 = Math.floor(imageY);
  const tx = imageX - x0;
  const ty = imageY - y0;
  const clampX = (value: number) => Math.max(0, Math.min(image.width - 1, value));
  const clampY = (value: number) => Math.max(0, Math.min(image.height - 1, value));
  const channel = (x: number, y: number, component: number) =>
    image.data[(clampY(y) * image.width + clampX(x)) * 3 + component];
  return [0, 1, 2].map(component => {
    const top = channel(x0, y0, component) * (1 - tx) + channel(x0 + 1, y0, component) * tx;
    const bottom =
      channel(x0, y0 + 1, component) * (1 - tx) + channel(x0 + 1, y0 + 1, component) * tx;
    return top * (1 - ty) + bottom * ty;
  }) as [number, number, number];
}

function sampleGrbg(
  data: Uint8Array,
  frame: CameraFrame,
  portraitX: number,
  portraitY: number
): [number, number, number] {
  // X300 stores the sensor landscape; the calibrated image is a 90° clockwise
  // rotation (portrait). Map calibrated pixels back into the raw Bayer plane.
  const rawX = portraitY;
  const rawY = frame.rawHeight - 1 - portraitX;
  const redX = nearestParity(rawX, 1, frame.rawWidth);
  const redY = nearestParity(rawY, 0, frame.rawHeight);
  const blueX = nearestParity(rawX, 0, frame.rawWidth);
  const blueY = nearestParity(rawY, 1, frame.rawHeight);
  const greenX = nearestParity(rawX, Math.round(rawY) & 1 ? 1 : 0, frame.rawWidth);
  const greenY = nearestParity(rawY, Math.round(rawY) & 1 ? 1 : 0, frame.rawHeight);
  // Raw sensor values: white balance is applied later by stonexColorCorrection.
  const red = data[frame.pixelsOffset + redY * frame.rawWidth + redX];
  const green = data[frame.pixelsOffset + greenY * frame.rawWidth + greenX];
  const blue = data[frame.pixelsOffset + blueY * frame.rawWidth + blueX];
  return [red, green, blue];
}

function cameraFrameMetadata(data: Uint8Array, frame: CameraFrame): StonexCameraFrameMetadata {
  const previewScale = 8;
  const previewWidth = frame.preview?.width ?? Math.ceil(frame.calibration.width / previewScale);
  const previewHeight = frame.preview?.height ?? Math.ceil(frame.calibration.height / previewScale);
  const previewRgba = frame.preview?.rgba ?? new Uint8Array(previewWidth * previewHeight * 4);
  if (!frame.preview) {
    for (let y = 0; y < previewHeight; y++) {
      const portraitY = Math.min(
        frame.calibration.height - 1,
        ((y + 0.5) * frame.calibration.height) / previewHeight
      );
      for (let x = 0; x < previewWidth; x++) {
        const portraitX = Math.min(
          frame.calibration.width - 1,
          ((x + 0.5) * frame.calibration.width) / previewWidth
        );
        const color = sampleCameraRgb(data, frame, portraitX, portraitY);
        const offset = (y * previewWidth + x) * 4;
        previewRgba[offset] = Math.round(color[0]);
        previewRgba[offset + 1] = Math.round(color[1]);
        previewRgba[offset + 2] = Math.round(color[2]);
        previewRgba[offset + 3] = 255;
      }
    }
  }
  const calibration = frame.calibration;
  return {
    name: frame.member.name,
    // Which station shot this frame. Without it the viewer has no way to place
    // panoramas from different stations anywhere but on top of each other.
    scanStem: frame.scanStem,
    type: frame.type,
    panDegrees: frame.panDegrees,
    imageWidth: calibration.width,
    imageHeight: calibration.height,
    fx: calibration.fx,
    fy: calibration.fy,
    cx: calibration.cx,
    cy: calibration.cy,
    distortionCoefficients: [...calibration.distortionCoefficients],
    modelToCamera: [...calibration.modelToCamera],
    previewWidth,
    previewHeight,
    previewRgba,
  };
}

function invertRigidRowMajor(matrix: readonly number[]): number[] {
  const tx = matrix[3];
  const ty = matrix[7];
  const tz = matrix[11];
  return [
    matrix[0],
    matrix[4],
    matrix[8],
    -(matrix[0] * tx + matrix[4] * ty + matrix[8] * tz),
    matrix[1],
    matrix[5],
    matrix[9],
    -(matrix[1] * tx + matrix[5] * ty + matrix[9] * tz),
    matrix[2],
    matrix[6],
    matrix[10],
    -(matrix[2] * tx + matrix[6] * ty + matrix[10] * tz),
    0,
    0,
    0,
    1,
  ];
}

function viewerToCameraTransform(
  frame: CameraFrame,
  diagnostic: StonexProjectionDiagnostic = 'normal'
): number[] {
  const panSign = diagnostic === 'reverse-pan' ? -1 : 1;
  const pan = panSign * frame.panDegrees * (Math.PI / 180);
  const cosPan = Math.cos(pan);
  const sinPan = Math.sin(pan);
  const calibrated = frame.calibration.modelToCamera;
  const m = diagnostic === 'invert-extrinsic' ? invertRigidRowMajor(calibrated) : calibrated;
  const result = new Array<number>(16).fill(0);
  for (let row = 0; row < 4; row++) {
    const offset = row * 4;
    result[offset] = -m[offset] * sinPan + m[offset + 1] * cosPan;
    result[offset + 1] = m[offset] * cosPan + m[offset + 1] * sinPan;
    result[offset + 2] = m[offset + 2];
    result[offset + 3] = m[offset + 3];
  }
  return result;
}

function angularDifference(a: number, b: number): number {
  return Math.abs(((a - b + 540) % 360) - 180);
}

/**
 * Turns the whole archive into one registered, fully coloured scene.
 *
 * Off by default: it costs a registration per scan and a second colouring pass,
 * and most archives are a single station where neither buys anything.
 */
export interface StonexStationPipelineOptions {
  /**
   * Per-scan placement to colour with, keyed by scan stem, column-major.
   *
   * Normally this is whatever the viewer already has — from "align all", from
   * a hand-built matrix, or from an archive that was already in one frame. It
   * takes precedence over `register`, because re-deriving a placement the user
   * has already established (and possibly corrected) would throw their work
   * away.
   */
  transforms?: Record<string, number[]>;
  /** Register every scan onto the largest photographed one first. */
  register?: boolean;
  /** Colour scans that no camera of their own station covered. */
  colorUncolored?: boolean;
  /** Also replace colour a scan already got from its own station's camera. */
  recolorAlreadyColored?: boolean;
  /** Vertical axis for the 4-DoF sweep; terrestrial scans are level about it. */
  upAxis?: UpAxis;
  /** Controlled camera-model variant used to diagnose projection misalignment. */
  projectionDiagnostic?: StonexProjectionDiagnostic;
  /**
   * Restrict a reprocessing run to these X3R stems and their photographs.
   * Unselected archive members are skipped before geometry decode/demosaic.
   */
  scopeScanStems?: string[];
  /**
   * Called as each scan finishes colouring, with the slice of the archive's
   * colour arrays that belongs to it, so a host can publish progress instead of
   * holding everything back until the end.
   */
  onScanColored?: (update: {
    scanStem: string;
    rawColors: Uint8Array;
    frameIndices: Uint16Array;
  }) => void | Promise<void>;
}

export class StonexX3aParser {
  constructor(private readonly cameraProjector?: StonexCameraBatchProjector) {}

  async parse(
    data: Uint8Array,
    fileName = '',
    timingCallback?: (message: string) => void,
    /**
     * Fired once the points exist and before any photograph is touched.
     *
     * Colour is the majority of an X3A load - measured at 81% on a 27M-point
     * archive, where geometry was ready at 5.9 s and the coloured result at
     * 31.4 s - so handing the geometry over at this point puts the scene on
     * screen roughly five times sooner, with colour arriving behind it.
     */
    onGeometryReady?: (geometry: StonexX3aData) => void | Promise<void>,
    /** Internal member scope supplied by `parseAll` for a pipeline rerun. */
    scopeScanStems?: readonly string[]
  ): Promise<StonexX3aData> {
    const startedAt = performance.now();
    // Phase timings, reported at the end. Added because a load that "feels
    // slow" is not evidence about *which* part is slow, and a measurement taken
    // on a code path the real load does not follow is worse than none: an
    // earlier attempt profiled the parser with no camera projector attached,
    // which skips the demosaic entirely, and drew exactly the wrong conclusion.
    const phases: Array<[string, number]> = [];
    const counters: Record<string, number> = {};
    // Declared up front and filled at the end: the result builder captures this
    // reference, and it also runs for the geometry snapshot handed over before
    // colouring, which is naturally reported as empty.
    const parsePhases: Record<string, unknown> = {};
    let phaseStart = startedAt;
    const markPhase = (name: string) => {
      const now = performance.now();
      phases.push([name, now - phaseStart]);
      phaseStart = now;
    };
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const members: ArchiveMember[] = [];
    const isArchive =
      data.byteLength >= ARCHIVE_HEADER_BYTES && ascii(data, 0, 4) === ARCHIVE_MAGIC;
    if (isArchive) {
      const memberCount = view.getUint32(80, true);
      if (memberCount === 0 || memberCount > 100_000) {
        throw new Error(`Invalid Stonex X3A file: unreasonable member count ${memberCount}.`);
      }
      const directoryEnd = ARCHIVE_HEADER_BYTES + memberCount * ARCHIVE_ENTRY_BYTES;
      if (directoryEnd > data.byteLength) {
        throw new Error('Invalid Stonex X3A file: truncated member directory.');
      }
      for (let index = 0; index < memberCount; index++) {
        const entryOffset = ARCHIVE_HEADER_BYTES + index * ARCHIVE_ENTRY_BYTES;
        const offset = Number(view.getBigUint64(entryOffset, true));
        const size = Number(view.getBigUint64(entryOffset + 8, true));
        let nameLength = 0;
        while (nameLength < ARCHIVE_NAME_BYTES && data[entryOffset + 16 + nameLength] !== 0) {
          nameLength++;
        }
        const name = ascii(data, entryOffset + 16, nameLength);
        if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(size) || offset < directoryEnd) {
          throw new Error(
            `Invalid Stonex X3A file: bad bounds for archive member ${name || index}.`
          );
        }
        if (size < 0 || offset + size > data.byteLength) {
          throw new Error(`Invalid Stonex X3A file: truncated archive member ${name || index}.`);
        }
        members.push({ name, offset, size });
      }
    } else if (data.byteLength >= 64 && ascii(data, 0, 4) === X3R_MAGIC) {
      members.push({ name: fileName || 'scan.x3r', offset: 0, size: data.byteLength });
    } else {
      throw new Error('Invalid Stonex X3A/X3R file: missing CRAX or 003X signature.');
    }

    const scope = scopeScanStems?.length ? new Set(scopeScanStems) : null;
    const scanMembers = members.filter(member => {
      if (!member.name.toLowerCase().endsWith('.x3r') || member.size < 64) {
        return false;
      }
      return !scope || scope.has(stemOf(member.name));
    });
    if (scanMembers.length === 0) {
      throw new Error(
        scope
          ? 'Stonex X3A: none of the selected scans exist in the archive.'
          : 'Invalid Stonex X3A file: archive contains no X3R scan records.'
      );
    }

    const calibrations = new Map<'U' | 'D', CameraCalibration>();
    for (const member of members.filter(member => member.name.toLowerCase().endsWith('.cal'))) {
      const calibration = parseCalibration(data, member);
      if (calibration) {
        calibrations.set(calibration.type, calibration);
      }
    }
    markPhase('archive directory');
    const parsedCameras = parseCameraFrames(data, view, members, calibrations);
    const cameraFrames = scope
      ? parsedCameras.frames.filter(frame => scope.has(frame.scanStem))
      : parsedCameras.frames;
    const bandGains = parsedCameras.bandGains;

    markPhase(`camera frame discovery (${cameraFrames.length} found)`);
    timingCallback?.(`Stonex X3A: inspecting ${scanMembers.length} embedded scan records...`);
    let sourcePointCount = 0;
    let vertexCount = 0;
    const layouts: ScanLayout[] = [];

    // First pass validates the layout and counts valid returns so output arrays
    // are allocated once instead of retaining a worst-case organized grid.
    for (const member of scanMembers) {
      if (
        ascii(data, member.offset, 4) !== X3R_MAGIC ||
        ascii(data, member.offset + 8, 4) !== 'DESC'
      ) {
        throw new Error(`Stonex X3A: unsupported X3R header in ${member.name}.`);
      }
      const columns = view.getUint32(member.offset + 32, true);
      const rows = view.getUint32(member.offset + 44, true);
      if (columns === 0 || rows === 0 || columns > 100_000 || rows > 100_000) {
        throw new Error(
          `Stonex X3A: invalid scan dimensions ${columns} x ${rows} in ${member.name}.`
        );
      }
      const columnOffset = findColumnOffset(data, member);
      const columnStride = X3R_COLUMN_HEADER_BYTES + rows * 8;
      const requiredEnd = columnOffset + columns * columnStride;
      if (requiredEnd > member.offset + member.size) {
        throw new Error(`Stonex X3A: truncated XCOL data in ${member.name}.`);
      }

      let validPoints = 0;
      for (let column = 0; column < columns; column++) {
        const blockOffset = columnOffset + column * columnStride;
        if (ascii(data, blockOffset, 4) !== COLUMN_MAGIC) {
          throw new Error(`Stonex X3A: invalid column ${column} in ${member.name}.`);
        }
        let sampleOffset = blockOffset + X3R_COLUMN_HEADER_BYTES;
        for (let row = 0; row < rows; row++, sampleOffset += 8) {
          const rawRange = view.getInt32(sampleOffset, true);
          if (rawRange > 0 && rawRange < INVALID_RANGE_MAX) {
            validPoints++;
          }
        }
      }
      sourcePointCount += columns * rows;
      vertexCount += validPoints;
      layouts.push({ ...member, columns, rows, columnOffset, columnStride, validPoints });
    }

    markPhase('scan layout scan');
    const positions = new Float32Array(vertexCount * 3);
    const intensity = new Float32Array(vertexCount);
    const photographicColor = cameraFrames.length > 0 && this.cameraProjector;
    const deferColorCorrection = photographicColor && !!onGeometryReady;
    // Raw (un-white-balanced) samples plus the frame each point came from. Both
    // are kept so colour correction stays switchable; `colors` is the corrected
    // array the GPU attribute shares.
    const rawColors = photographicColor ? new Uint8Array(vertexCount * 3).fill(255) : null;
    // Geometry-first hosts send raw RGB once and correct it in the webview.
    // Aliasing avoids a second 3-byte-per-point array that would never cross
    // the process boundary; traditional parse callers still receive the
    // corrected array they expect.
    const colors = photographicColor
      ? deferColorCorrection
        ? rawColors
        : new Uint8Array(vertexCount * 3).fill(255)
      : null;
    const frameIndices = photographicColor
      ? new Uint16Array(vertexCount).fill(STONEX_NO_FRAME)
      : null;
    const candidateIndices = new Map<CameraFrame, number[]>();
    if (colors) {
      for (const frame of cameraFrames) {
        candidateIndices.set(frame, []);
      }
    }
    const photographicScanStems = new Set(cameraFrames.map(frame => frame.scanStem));
    // Per scan, one azimuth and one point count per column. The Rust colour
    // pass selects candidates by column rather than by point, so this is all it
    // needs to know which points face which frame - and the loop below reads
    // both values anyway.
    const scanColumns: Array<{
      frames: CameraFrame[];
      azimuths: Float64Array;
      counts: Uint32Array;
      pointOffset: number;
    }> = [];
    let outputIndex = 0;
    let photographicallyColoredPoints = 0;
    const scanPointRanges: ScanPointRange[] = [];

    // Points in Rust when it is available: same byte-for-byte output, checked
    // against this loop on a real archive in src/test/suite/stonexScan.test.ts.
    const scanWasm = await loadStonexWasm();

    for (const layout of layouts) {
      const pointOffset = outputIndex;
      if (scanWasm) {
        const scanStemRust = layout.name.replace(/\.x3r$/i, '');
        const exactRust = cameraFrames.filter(frame => frame.scanStem === scanStemRust);
        const framesRust =
          exactRust.length > 0 ? exactRust : photographicScanStems.size === 1 ? cameraFrames : [];
        const record = data.subarray(layout.offset, layout.offset + layout.size);
        const decoded = scanWasm.stonex_decode_scan_known_layout(
          record,
          layout.columns,
          layout.rows,
          layout.columnOffset - layout.offset,
          layout.columnStride,
          layout.validPoints
        );
        const decodedPositions = decoded.take_positions();
        const decodedIntensity = decoded.take_intensity();
        const azimuths = decoded.take_column_azimuths();
        const counts = decoded.take_points_per_column();
        decoded.free?.();

        positions.set(decodedPositions, pointOffset * 3);
        intensity.set(decodedIntensity, pointOffset);
        outputIndex += decodedIntensity.length;

        scanColumns.push({
          frames: framesRust,
          azimuths,
          counts,
          pointOffset,
        });
        scanPointRanges.push({
          name: layout.name,
          memberSize: layout.size,
          sourcePointCount: layout.columns * layout.rows,
          pointOffset,
          pointCount: outputIndex - pointOffset,
          photographicallyColoredPoints: 0,
        });
        continue;
      }
      const scanStem = layout.name.replace(/\.x3r$/i, '');
      const exactFrames = cameraFrames.filter(frame => frame.scanStem === scanStem);
      // Abschnitt_A contains several scan passes in one scanner coordinate
      // frame, but photographs only carry the final scan's stem. If an archive
      // has exactly one photographic stem, reuse that station's calibrated
      // panorama for its other co-located X3R grids.
      const layoutFrames =
        exactFrames.length > 0 ? exactFrames : photographicScanStems.size === 1 ? cameraFrames : [];
      const columnAzimuths = new Float64Array(layout.columns);
      const columnCounts = new Uint32Array(layout.columns);
      const verticalStep = VERTICAL_SPAN_DEGREES / layout.rows;
      const verticalSin = new Float64Array(layout.rows);
      const verticalCos = new Float64Array(layout.rows);
      for (let row = 0; row < layout.rows; row++) {
        // X3R rows follow the vertically rotating mirror from its upper limit
        // downwards: low row indices see sky, high indices see the ground.
        const elevation = (VERTICAL_MAX_DEGREES - row * verticalStep) * (Math.PI / 180);
        verticalSin[row] = Math.sin(elevation);
        verticalCos[row] = Math.cos(elevation);
      }

      for (let column = 0; column < layout.columns; column++) {
        const blockOffset = layout.columnOffset + column * layout.columnStride;
        const azimuthDegrees = view.getInt32(blockOffset + 20, true) * 1e-6;
        columnAzimuths[column] = azimuthDegrees;
        const columnStart = outputIndex;
        const azimuth = azimuthDegrees * (Math.PI / 180);
        const sinAzimuth = Math.sin(azimuth);
        const cosAzimuth = Math.cos(azimuth);
        const columnFrames = layoutFrames.filter(
          frame =>
            angularDifference(frame.panDegrees, azimuthDegrees) <= 30 &&
            (CAMERA_COLOR_DIAGNOSTIC_TYPE === null || frame.type === CAMERA_COLOR_DIAGNOSTIC_TYPE)
        );
        let sampleOffset = blockOffset + X3R_COLUMN_HEADER_BYTES;
        for (let row = 0; row < layout.rows; row++, sampleOffset += 8) {
          const rawRange = view.getInt32(sampleOffset, true);
          if (rawRange <= 0 || rawRange >= INVALID_RANGE_MAX) {
            continue;
          }
          const range = rawRange * RANGE_SCALE_METRES;
          const horizontalRange = range * verticalCos[row];
          const modelX = horizontalRange * sinAzimuth;
          const modelY = horizontalRange * cosAzimuth;
          const modelZ = range * verticalSin[row];
          const positionOffset = outputIndex * 3;
          // Preserve the original viewer orientation while retaining the
          // X300 model convention (X lateral, Y forward, Z up) for calibration.
          positions[positionOffset] = modelY;
          positions[positionOffset + 1] = modelX;
          positions[positionOffset + 2] = modelZ;
          const normalizedIntensity = Math.min(
            1,
            view.getUint32(sampleOffset + 4, true) / PULSE_WIDTH_MAX
          );
          intensity[outputIndex] = normalizedIntensity;
          if (colors) {
            for (const frame of columnFrames) {
              candidateIndices.get(frame)!.push(outputIndex);
            }
          }
          outputIndex++;
        }
        columnCounts[column] = outputIndex - columnStart;
      }
      scanColumns.push({
        frames: layoutFrames,
        azimuths: columnAzimuths,
        counts: columnCounts,
        pointOffset,
      });
      scanPointRanges.push({
        name: layout.name,
        memberSize: layout.size,
        sourcePointCount: layout.columns * layout.rows,
        pointOffset,
        pointCount: outputIndex - pointOffset,
        photographicallyColoredPoints: 0,
      });
    }

    /**
     * Assembles the returned shape. Shared so the geometry snapshot handed over
     * before colouring and the finished result cannot drift apart.
     */
    const buildResult = (colour: {
      colors: Uint8Array | null;
      rawColors: Uint8Array | null;
      frameIndices: Uint16Array | null;
      colorCalibration: StonexColorCalibration | undefined;
      photographicallyColoredPoints: number;
      stationSources: {
        data: Uint8Array;
        frames: CameraFrame[];
        projector?: StonexCameraBatchProjector;
      } | null;
      /** Camera metadata is absent from the early geometry snapshot. */
      cameraFrames: StonexCameraFrameMetadata[];
    }): StonexX3aData => ({
      vertexCount,
      sourcePointCount,
      faceCount: 0,
      hasColors: colour.colors !== null,
      hasNormals: false,
      hasIntensity: true,
      format: 'binary_little_endian',
      version: '1.0',
      fileName,
      comments: [
        'Experimental Stonex X300 X3A/X3R decoder',
        `Embedded scans: ${scanMembers.map(member => member.name).join(', ')}`,
        cameraFrames.length === 0
          ? 'No usable X3I camera frames and calibration were found'
          : colour.colors === null
            ? `Photographic color pending for ${cameraFrames.length} X3I frames`
            : `Photographic color: ${colour.photographicallyColoredPoints.toLocaleString()} points from ${cameraFrames.length} X3I frames`,
      ],
      vertices: [],
      faces: [],
      positionsArray: positions,
      colorsArray: colour.colors,
      normalsArray: null,
      intensityArray: intensity,
      scalarFields: { intensity },
      useTypedArrays: true,
      metadata: {
        container: isArchive ? 'Stonex X300 RAW Archive (CRAX)' : 'Stonex X300 scan record',
        embeddedScans: scanMembers.map(member => member.name),
        embeddedScanPointRanges: scanPointRanges,
        // Live decode/projection sources for the optional station pipeline.
        // Not serializable and not transferable: parseAll consumes them and
        // strips the key before any result leaves this module.
        stonexStationSources: colour.stationSources,
        cameraFrames: cameraFrames.map(frame => frame.member.name),
        cameraCalibrations: [...calibrations.keys()],
        stonexCameraFrames: colour.cameraFrames,
        scannerPosition: [0, 0, 0],
        scannerCoordinateConvention: 'viewer X=model Y, viewer Y=model X, viewer Z=model Z',
        sharedScannerFrameAssumed: photographicScanStems.size === 1 && scanMembers.length > 1,
        photographicallyColoredPoints: colour.photographicallyColoredPoints,
        stonexRawColors: colour.rawColors,
        stonexFrameIndices: colour.frameIndices,
        stonexColorCalibration: colour.colorCalibration,
        stonexColorCorrection: { ...DEFAULT_STONEX_COLOR_CORRECTION },
        cameraOverlapPolicy: 'best-centered valid frame (no color averaging)',
        cameraColorDiagnostic: null,
        cameraProjectionDomain: 'CAL FOV guard before OpenCV distortion',
        cameraProjectionKernel: 'shared Rust/WASM OpenCV pinhole batch projector',
        // X300 archives cover hundreds of metres, where the viewer's generic
        // 1 mm default projects to far below one pixel. 25 mm stays visible at
        // range without turning into blobs near the scanner, where the initial
        // view now starts.
        recommendedPointSize: 0.025,
        stonexParsePhases: parsePhases,
        rangeScaleMetres: RANGE_SCALE_METRES,
        verticalFieldOfViewDegrees: [
          VERTICAL_MIN_DEGREES,
          VERTICAL_MIN_DEGREES + VERTICAL_SPAN_DEGREES,
        ],
      },
    });

    markPhase('point decode');
    if (onGeometryReady) {
      counters.geometryReadyMs = performance.now() - startedAt;
      // The same shape the call returns, minus colour: positions, intensity and
      // the scan ranges are all final by now.
      await onGeometryReady(
        buildResult({
          colors: null,
          rawColors: null,
          frameIndices: null,
          colorCalibration: undefined,
          photographicallyColoredPoints: 0,
          stationSources: null,
          cameraFrames: [],
        })
      );
      markPhase('geometry delivery');
    }

    // Rust colour pass. Points, raw planes and frame descriptions cross once;
    // candidate selection, projection, scoring and sampling all happen on the
    // far side. The previous arrangement carried the whole point cloud into
    // WASM once per frame - thirty times on a large archive - and scored and
    // sampled the results back in JavaScript, which together was ~80% of a
    // parse.
    const projectionStarted = performance.now();
    const stonexWasm = rawColors && frameIndices ? await loadStonexWasm() : null;
    let colourSession: StonexColourSession | null = null;
    let usedRustColour = false;
    if (rawColors && colors && frameIndices && stonexWasm) {
      usedRustColour = true;
      const framePixelOffsets = new Map<CameraFrame, number>();
      let pixelBytes = 0;
      for (const frame of cameraFrames) {
        framePixelOffsets.set(frame, pixelBytes);
        pixelBytes += frame.rawWidth * frame.rawHeight;
      }
      // One buffer of every frame's raw plane, built once and reused for each
      // scan rather than re-sliced per call.
      let framePixels = new Uint8Array(pixelBytes);
      for (const frame of cameraFrames) {
        framePixels.set(
          data.subarray(frame.pixelsOffset, frame.pixelsOffset + frame.rawWidth * frame.rawHeight),
          framePixelOffsets.get(frame)!
        );
      }

      // One session for the archive: the pixels cross once and each panorama
      // is demosaiced once, however many scans draw on it.
      const descriptors = cameraFrames.map(frame =>
        stonexFrameDescriptor(frame, framePixelOffsets.get(frame)!)
      );
      const session = new stonexWasm.StonexColourSession(framePixels, JSON.stringify(descriptors));
      colourSession = session;

      for (const scan of scanColumns) {
        if (scan.frames.length === 0) {
          continue;
        }
        const range = scanPointRanges.find(entry => entry.pointOffset === scan.pointOffset);
        const pointCount = range?.pointCount ?? 0;
        if (pointCount === 0) {
          continue;
        }
        const result = session.colour_scan(
          positions.subarray(scan.pointOffset * 3, (scan.pointOffset + pointCount) * 3),
          scan.azimuths,
          scan.counts,
          Uint32Array.from(scan.frames.map(frame => cameraFrames.indexOf(frame)))
        );
        const scanColours = result.take_colours() as Uint8Array;
        const scanFrames = result.take_frame_indices() as Uint16Array;
        // The Rust session sees only scoped frames and returns its compact
        // indices. Point-colour updates are applied to an already-loaded
        // archive whose calibration keeps the complete X3I order, so preserve
        // those stable archive IDs across the boundary.
        for (let index = 0; index < scanFrames.length; index++) {
          const localFrame = scanFrames[index];
          if (localFrame !== STONEX_NO_FRAME) {
            scanFrames[index] = cameraFrames[localFrame]?.archiveFrameIndex ?? STONEX_NO_FRAME;
          }
        }
        const coloured = result.coloured_points as number;
        counters.candidateTotal =
          (counters.candidateTotal ?? 0) + (result.candidate_total as number);
        counters.pixelsInFrame = (counters.pixelsInFrame ?? 0) + (result.pixels_in_frame as number);
        counters.samplesTaken = (counters.samplesTaken ?? 0) + coloured;
        result.free?.();

        rawColors.set(scanColours, scan.pointOffset * 3);
        // Indices already address the archive's frame list.
        frameIndices.set(scanFrames, scan.pointOffset);
        if (range) {
          range.photographicallyColoredPoints = coloured;
        }
        photographicallyColoredPoints += coloured;
      }
    } else if (rawColors && colors && frameIndices) {
      // No JavaScript colour pass any more. There used to be one that marshalled
      // candidate indices, called the Rust batch projector per frame, and then
      // scored and sampled every projected pixel back in JavaScript - about 80%
      // of a parse, and a second implementation of what the colour session now
      // does entirely in Rust. It was kept while the two were compared on a real
      // archive; that comparison is done, and `stonex::colour`'s own tests cover
      // the logic.
      throw new Error(
        'Stonex X3A photographic colouring requires the Rust/WASM colour session, which failed to load'
      );
    }

    if (usedRustColour) {
      counters.projectMs = performance.now() - projectionStarted;
      counters.marshalMs = 0;
      counters.sampleMs = 0;
    }

    markPhase('projection + sampling');
    const colorCalibration = buildStonexColorCalibration(
      // Keep the full archive calibration in scoped runs. Besides retaining
      // stable frame IDs, this keeps optional exposure matching referenced to
      // the same captured set rather than changing when visibility changes.
      parsedCameras.frames.map((frame): StonexFrameCalibration => ({
        type: frame.type,
        grayRedGain: frame.grayRedGain,
        grayBlueGain: frame.grayBlueGain,
        meanGreen: frame.meanGreen,
      })),
      bandGains
    );
    if (rawColors && colors && frameIndices && !deferColorCorrection) {
      // Seed the shipped default so a freshly opened file looks unchanged.
      applyStonexColorCorrectionToPoints(
        rawColors,
        frameIndices,
        computeStonexFrameMultipliers(colorCalibration, DEFAULT_STONEX_COLOR_CORRECTION),
        DEFAULT_STONEX_COLOR_CORRECTION,
        colors
      );
    }

    markPhase(deferColorCorrection ? 'colour correction deferred' : 'colour correction');
    if (colourSession) {
      for (let index = 0; index < cameraFrames.length; index++) {
        const preview = colourSession.frame_preview(index, 8);
        cameraFrames[index].preview = {
          width: preview.width,
          height: preview.height,
          rgba: preview.take_rgba(),
        };
        preview.free?.();
      }
      colourSession.free?.();
    }
    const cameraMetadata = cameraFrames.map(frame => cameraFrameMetadata(data, frame));
    markPhase(`camera previews (${cameraFrames.length})`);

    const result = buildResult({
      colors,
      rawColors,
      frameIndices,
      colorCalibration,
      photographicallyColoredPoints,
      stationSources: { data, frames: cameraFrames, projector: this.cameraProjector },
      cameraFrames: cameraMetadata,
    });
    markPhase('result construction');
    const total = performance.now() - startedAt;
    Object.assign(parsePhases, {
      totalMs: total,
      points: vertexCount,
      sourcePoints: sourcePointCount,
      scans: scanMembers.length,
      frames: cameraFrames.length,
      archiveBytes: data.byteLength,
      phases: phases.map(([name, ms]) => ({ name, ms })),
      ...counters,
    });
    timingCallback?.(
      `Stonex X3A: parsed ${vertexCount.toLocaleString()} valid returns from ${scanMembers.length} scans in ${total.toFixed(1)} ms`
    );
    timingCallback?.(
      `Stonex X3A phases: ${phases
        .filter(([, ms]) => ms >= 1)
        .map(
          ([name, ms]) => `${name} ${(ms / 1000).toFixed(1)}s (${((ms / total) * 100).toFixed(0)}%)`
        )
        .join(' · ')}`
    );

    return result;
  }

  /** Decode an archive into one viewer object per embedded X3R member. */
  async parseAll(
    data: Uint8Array,
    fileName = '',
    timingCallback?: (message: string) => void,
    pipeline?: StonexStationPipelineOptions,
    /** Per-scan geometry, handed over before any photograph is decoded. */
    onGeometryReady?: (scans: StonexX3aData[]) => void | Promise<void>
  ): Promise<StonexX3aData[]> {
    const combined = await this.parse(
      data,
      fileName,
      timingCallback,
      geometry => onGeometryReady?.(splitByScan(geometry, null, true)),
      pipeline?.scopeScanStems
    );
    const stationTransforms = await this.runStationPipeline(combined, pipeline, timingCallback);
    delete (combined.metadata as Record<string, unknown>).stonexStationSources;
    const ranges = combined.metadata.embeddedScanPointRanges as ScanPointRange[] | undefined;
    if (!ranges || (ranges.length <= 1 && !pipeline?.scopeScanStems?.length)) {
      return [combined];
    }

    const splitStartedAt = performance.now();
    // When geometry was already handed to the host, these final objects only
    // feed colour updates. Views avoid copying every positions/intensity/color
    // array a second time; the update sender slices only its bounded chunks.
    const scans = splitByScan(
      combined,
      stationTransforms,
      !onGeometryReady,
      !!pipeline?.scopeScanStems?.length
    );
    const splitMs = performance.now() - splitStartedAt;
    const report = combined.metadata.stonexParsePhases as
      { totalMs?: number; phases?: Array<{ name: string; ms: number }> } | undefined;
    if (report) {
      report.phases ??= [];
      report.phases.push({ name: 'scan split', ms: splitMs });
      report.totalMs = (report.totalMs ?? 0) + splitMs;
    }
    return scans;
  }

  /**
   * Registers every scan onto the largest photographed one, then colours from
   * every station's cameras.
   *
   * Registration comes first and colouring second for the obvious reason: the
   * composition that maps another scan's points into a camera is only
   * meaningful once the scans share a frame.
   *
   * Returns the per-scan transforms, or null when the pipeline was not asked
   * for or the archive holds nothing to do it with.
   */
  private async runStationPipeline(
    combined: StonexX3aData,
    options: StonexStationPipelineOptions | undefined,
    timingCallback?: (message: string) => void
  ): Promise<Map<string, number[]> | null> {
    const sources = combined.metadata.stonexStationSources as
      | { data: Uint8Array; frames: CameraFrame[]; projector?: StonexCameraBatchProjector }
      | undefined;
    const ranges = combined.metadata.embeddedScanPointRanges as ScanPointRange[] | undefined;
    const supplied = options?.transforms;
    if ((!options?.register && !supplied) || !sources || !ranges || ranges.length === 0) {
      return null;
    }

    // Placement the caller already has beats anything derived here.
    if (supplied) {
      const transforms = new Map<string, number[]>();
      for (const range of ranges) {
        const stem = stemOf(range.name);
        const matrix = supplied[stem];
        if (matrix?.length === 16) {
          transforms.set(stem, matrix);
        }
      }
      if (transforms.size > 0) {
        timingCallback?.(
          `Stonex X3A: colouring with the ${transforms.size} placements already in the viewer`
        );
        await this.colorAcrossStations(
          combined,
          sources,
          ranges,
          transforms,
          options,
          timingCallback
        );
        return transforms;
      }
    }

    const photographicStems = new Set(sources.frames.map(frame => frame.scanStem));
    // Anchor: the biggest scan that has its own photographs, so the common
    // frame is one that already carries colour and camera geometry.
    const anchor =
      ranges
        .filter(range => photographicStems.has(stemOf(range.name)))
        .sort((a, b) => b.pointCount - a.pointCount)[0] ??
      ranges.slice().sort((a, b) => b.pointCount - a.pointCount)[0];

    // Strided, not whole. A station scan is up to twenty million points and the
    // solver voxel-downsamples everything it is handed anyway, so passing the
    // full slice buys no accuracy and costs the copy, the robust-extent pass
    // and the downsample on twenty million points instead of four hundred
    // thousand — the difference between a couple of seconds per pair and most
    // of a minute. The viewer's own path has always strided; this one did not,
    // which is what made the archive pipeline feel hung.
    const slice = (range: ScanPointRange) => {
      const step = Math.max(1, Math.ceil(range.pointCount / REGISTRATION_SAMPLE_LIMIT));
      const kept = Math.ceil(range.pointCount / step);
      const out = new Float32Array(kept * 3);
      let write = 0;
      for (let i = 0; i < range.pointCount; i += step) {
        const source = (range.pointOffset + i) * 3;
        out[write++] = combined.positionsArray[source];
        out[write++] = combined.positionsArray[source + 1];
        out[write++] = combined.positionsArray[source + 2];
      }
      return out.subarray(0, write);
    };
    const anchorPoints = slice(anchor);

    const transforms = new Map<string, number[]>();
    transforms.set(stemOf(anchor.name), identityMatrix());
    for (const range of ranges) {
      if (range === anchor || range.pointCount < 100) {
        continue;
      }
      timingCallback?.(`Stonex X3A: registering ${range.name} onto ${anchor.name}...`);
      const result = await registerPair(slice(range), Float32Array.from(anchorPoints), {
        coarse: { upAxis: options.upAxis ?? 'z' },
      });
      if (result?.icp) {
        transforms.set(stemOf(range.name), Array.from(result.matrix.elements));
        timingCallback?.(
          `Stonex X3A: ${range.name} aligned, RMS ${result.icp.inlierRmse.toFixed(3)} at ` +
            `${(result.icp.fitness * 100).toFixed(0)}% overlap`
        );
      } else {
        timingCallback?.(`Stonex X3A: ${range.name} could not be registered; left in place`);
      }
    }

    if (!options.colorUncolored && !options.recolorAlreadyColored) {
      return transforms;
    }
    await this.colorAcrossStations(combined, sources, ranges, transforms, options, timingCallback);
    return transforms;
  }

  /** The colouring half, once every scan has a placement. */
  private async colorAcrossStations(
    combined: StonexX3aData,
    sources: { data: Uint8Array; frames: CameraFrame[]; projector?: StonexCameraBatchProjector },
    ranges: ScanPointRange[],
    transforms: Map<string, number[]>,
    options: StonexStationPipelineOptions,
    timingCallback?: (message: string) => void
  ): Promise<void> {
    if (!options.colorUncolored && !options.recolorAlreadyColored) {
      return;
    }
    const rawColors = combined.metadata.stonexRawColors as Uint8Array | null;
    const frameIndices = combined.metadata.stonexFrameIndices as Uint16Array | null;
    if (!rawColors || !frameIndices || !sources.projector) {
      return;
    }

    const diagnostic = options.projectionDiagnostic ?? 'normal';
    if (diagnostic !== 'normal') {
      // A controlled comparison must not inherit pixels or winning-frame IDs
      // from the normal first pass. Any point the selected variant cannot see
      // stays white, which makes its actual coverage and errors unambiguous.
      rawColors.fill(255);
      frameIndices.fill(STONEX_NO_FRAME);
    }

    // A point counts as coloured exactly when the first pass gave it a frame.
    const colored = new Uint8Array(combined.vertexCount);
    for (let i = 0; i < colored.length; i++) {
      colored[i] = frameIndices[i] === STONEX_NO_FRAME ? 0 : 1;
    }

    const scans: StationScan[] = ranges
      .filter(range => transforms.has(stemOf(range.name)))
      .map(range => ({
        scanStem: stemOf(range.name),
        pointOffset: range.pointOffset,
        pointCount: range.pointCount,
        transform: transforms.get(stemOf(range.name))!,
      }));

    const selectedFrames = sources.frames.filter(
      frame =>
        (diagnostic !== 'u-only' || frame.type === 'U') &&
        (diagnostic !== 'd-only' || frame.type === 'D')
    );
    const frames: StationFrame[] = selectedFrames.map(frame => ({
      // Keep the original archive index: colour correction and the camera list
      // address that complete list even when a diagnostic temporarily filters it.
      frameNumber: frame.archiveFrameIndex,
      scanStem: frame.scanStem,
      panDegrees: frame.panDegrees,
      imageWidth: frame.calibration.width,
      imageHeight: frame.calibration.height,
      fx: frame.calibration.fx,
      fy: frame.calibration.fy,
      cx: frame.calibration.cx,
      cy: frame.calibration.cy,
      distortionCoefficients:
        diagnostic === 'ideal-pinhole'
          ? frame.calibration.distortionCoefficients.map(() => 0)
          : frame.calibration.distortionCoefficients,
      viewerToCamera: viewerToCameraTransform(frame, diagnostic),
      maxNormalizedX: Math.tan((frame.calibration.fovX * Math.PI) / 360),
      maxNormalizedY: Math.tan((frame.calibration.fovY * Math.PI) / 360),
      sample: (pixelX, pixelY) => sampleCameraRgb(sources.data, frame, pixelX, pixelY),
    }));

    const changed = new Uint8Array(combined.vertexCount);
    const result = await colorFromAllStations(
      combined.positionsArray,
      rawColors,
      frameIndices,
      colored,
      changed,
      scans,
      frames,
      sources.projector,
      {
        recolorAlreadyColored: options.recolorAlreadyColored,
        ownStationOnly: diagnostic === 'own-station-only',
        onScanColored: scan =>
          options.onScanColored?.({
            scanStem: scan.scanStem,
            rawColors: rawColors.subarray(
              scan.pointOffset * 3,
              (scan.pointOffset + scan.pointCount) * 3
            ),
            frameIndices: frameIndices.subarray(
              scan.pointOffset,
              scan.pointOffset + scan.pointCount
            ),
          }),
      }
    );
    timingCallback?.(
      `Stonex X3A: coloured ${result.newlyColored.toLocaleString()} previously grey points ` +
        `(${result.recolored.toLocaleString()} improved, ` +
        `${result.occludedSamples.toLocaleString()} point-camera pairs rejected as hidden)`
    );

    // The GPU array is the corrected copy; re-derive it from the new raw values.
    const colors = combined.colorsArray;
    const calibration = combined.metadata.stonexColorCalibration as
      StonexColorCalibration | undefined;
    if (colors && calibration) {
      applyStonexColorCorrectionToPoints(
        rawColors,
        frameIndices,
        computeStonexFrameMultipliers(calibration, DEFAULT_STONEX_COLOR_CORRECTION),
        DEFAULT_STONEX_COLOR_CORRECTION,
        colors
      );
    }
    let total = 0;
    const changedScans = new Set<string>();
    for (const range of ranges) {
      let count = 0;
      let touched = false;
      const end = range.pointOffset + range.pointCount;
      for (let index = range.pointOffset; index < end; index++) {
        count += colored[index];
        touched ||= changed[index] === 1;
      }
      range.photographicallyColoredPoints = count;
      total += count;
      if (touched) {
        changedScans.add(stemOf(range.name));
      }
    }
    (combined.metadata as Record<string, unknown>).stationColorChangedScans = changedScans;
    (combined.metadata as Record<string, unknown>).photographicallyColoredPoints = total;
    (combined.metadata as Record<string, unknown>).stationColoringResult = {
      newlyColored: result.newlyColored,
      recolored: result.recolored,
      occludedSamples: result.occludedSamples,
    };
  }
}

/** Matches the cap the viewer's own registration path uses. */
const REGISTRATION_SAMPLE_LIMIT = 400_000;

/**
 * Splits a combined archive result into one object per embedded scan.
 *
 * Shared by the geometry hand-over and the finished parse so the two cannot
 * describe the archive differently.
 */
function splitByScan(
  combined: StonexX3aData,
  stationTransforms: Map<string, number[]> | null,
  copyArrays = true,
  forceSingle = false
): StonexX3aData[] {
  const fileName = combined.fileName ?? '';
  const ranges = combined.metadata.embeddedScanPointRanges as ScanPointRange[] | undefined;
  if (!ranges || (ranges.length <= 1 && !forceSingle)) {
    return [combined];
  }
  const cameraFrames = combined.metadata.stonexCameraFrames;
  const rawColors = combined.metadata.stonexRawColors as Uint8Array | null;
  const frameIndices = combined.metadata.stonexFrameIndices as Uint16Array | null;
  return ranges.map((range, index) => {
    const pointEnd = range.pointOffset + range.pointCount;
    const componentStart = range.pointOffset * 3;
    const componentEnd = pointEnd * 3;
    const segment = <T extends Float32Array | Uint8Array | Uint16Array>(
      values: T,
      start: number,
      end: number
    ): T => (copyArrays ? values.slice(start, end) : values.subarray(start, end)) as T;
    const intensityArray = segment(combined.intensityArray, range.pointOffset, pointEnd);
    return {
      ...combined,
      vertexCount: range.pointCount,
      sourcePointCount: range.sourcePointCount,
      fileName: range.name,
      comments: [
        'Experimental Stonex X300 X3A/X3R decoder',
        `Embedded scan ${range.name} from ${fileName}`,
        combined.hasColors
          ? `Photographic color: ${range.photographicallyColoredPoints.toLocaleString()} points`
          : 'No usable X3I camera frames and calibration were found',
      ],
      positionsArray: segment(combined.positionsArray, componentStart, componentEnd),
      colorsArray: combined.colorsArray
        ? segment(combined.colorsArray, componentStart, componentEnd)
        : null,
      intensityArray,
      scalarFields: { intensity: intensityArray },
      metadata: {
        ...combined.metadata,
        containerFileName: fileName,
        embeddedScans: [range.name],
        embeddedScanName: range.name,
        embeddedMemberSize: range.memberSize,
        embeddedScanPointRanges: [range],
        photographicallyColoredPoints: range.photographicallyColoredPoints,
        // Colour correction runs per scan, so these must be sliced alongside
        // colorsArray rather than inherited whole from the combined result.
        stonexRawColors: rawColors ? segment(rawColors, componentStart, componentEnd) : null,
        stonexFrameIndices: frameIndices
          ? segment(frameIndices, range.pointOffset, pointEnd)
          : null,
        // All members share a scanner station. Register its camera rig once,
        // after the final cloud so sequential extension transfers cannot shift
        // the camera entry's unified UI index as later clouds arrive.
        stonexCameraFrames: index === ranges.length - 1 ? cameraFrames : [],
        stonexCameraProfileName: fileName,
        // Applied by the loader so registered scans open in the common frame.
        stationTransform: stationTransforms?.get(stemOf(range.name)) ?? null,
        stationColorChanged:
          (combined.metadata.stationColorChangedScans as Set<string> | undefined)?.has(
            stemOf(range.name)
          ) ?? false,
      },
    };
  });
}

/** `Stohl_1_A_0004.x3r` -> `Stohl_1_A_0004`, matching the camera frame stems. */
function stemOf(memberName: string): string {
  return memberName.replace(/\.x3r$/i, '');
}

function identityMatrix(): number[] {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}
