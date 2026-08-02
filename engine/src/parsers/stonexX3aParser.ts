/**
 * Experimental reader for Stonex X300 RAW archives (.x3a).
 *
 * X3A is a proprietary CRAX container.  X300 scan records inside it use the
 * X3R layout observed in firmware v14: a descriptor followed by XCOL blocks,
 * each containing an azimuth and an organized column of range/pulse-width
 * samples. X3I members are uncompressed 8-bit GRBG Bayer frames; the paired
 * XML calibration files contain OpenCV intrinsics and model-to-camera poses.
 */

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
  fx: number;
  fy: number;
  cx: number;
  cy: number;
  k1: number;
  k2: number;
  k3: number;
  p1: number;
  p2: number;
  modelToCamera: number[];
}

interface CameraFrame {
  member: ArchiveMember;
  scanStem: string;
  type: 'U' | 'D';
  panDegrees: number;
  rawWidth: number;
  rawHeight: number;
  pixelsOffset: number;
  redGain: number;
  blueGain: number;
  calibration: CameraCalibration;
}

export interface StonexCameraFrameMetadata {
  name: string;
  type: 'U' | 'D';
  panDegrees: number;
  imageWidth: number;
  imageHeight: number;
  fx: number;
  fy: number;
  cx: number;
  cy: number;
  modelToCamera: number[];
  previewWidth: number;
  previewHeight: number;
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
  const calibration: CameraCalibration = {
    type,
    width: xmlAttribute(root, 'Width'),
    height: xmlAttribute(root, 'Height'),
    fx: xmlAttribute(intrinsics, 'fx'),
    fy: xmlAttribute(intrinsics, 'fy'),
    cx: xmlAttribute(intrinsics, 'cx'),
    cy: xmlAttribute(intrinsics, 'cy'),
    k1: xmlAttribute(intrinsics, 'k1'),
    k2: xmlAttribute(intrinsics, 'k2'),
    k3: xmlAttribute(intrinsics, 'k3'),
    p1: xmlAttribute(intrinsics, 'p1'),
    p2: xmlAttribute(intrinsics, 'p2'),
    modelToCamera,
  };
  return modelToCamera.length === 16 &&
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
): { redGain: number; blueGain: number } {
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
    return { redGain: 1, blueGain: 1 };
  }
  return { redGain: green / red, blueGain: green / blue };
}

function parseCameraFrames(
  data: Uint8Array,
  view: DataView,
  members: ArchiveMember[],
  calibrations: Map<'U' | 'D', CameraCalibration>
): CameraFrame[] {
  const frames: CameraFrame[] = [];
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
        redGain: typedFrames.reduce((sum, frame) => sum + frame.redGain, 0) / typedFrames.length,
        blueGain: typedFrames.reduce((sum, frame) => sum + frame.blueGain, 0) / typedFrames.length,
      };
      const references = typedFrames
        .map(frame => portraitTopLeftWhiteBalance(data, frame))
        .filter((value): value is { redGain: number; blueGain: number; score: number } => !!value)
        .sort((a, b) => b.score - a.score);
      const balance = references[0] ?? fallback;
      for (const frame of typedFrames) {
        frame.redGain = balance.redGain;
        frame.blueGain = balance.blueGain;
      }
    }
  }
  return frames;
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
  const red = data[frame.pixelsOffset + redY * frame.rawWidth + redX] * frame.redGain;
  const green = data[frame.pixelsOffset + greenY * frame.rawWidth + greenX];
  const blue = data[frame.pixelsOffset + blueY * frame.rawWidth + blueX] * frame.blueGain;
  return [Math.min(255, red), green, Math.min(255, blue)];
}

function cameraFrameMetadata(data: Uint8Array, frame: CameraFrame): StonexCameraFrameMetadata {
  const previewScale = 8;
  const previewWidth = Math.ceil(frame.calibration.width / previewScale);
  const previewHeight = Math.ceil(frame.calibration.height / previewScale);
  const previewRgba = new Uint8Array(previewWidth * previewHeight * 4);
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
      const color = sampleGrbg(data, frame, portraitX, portraitY);
      const offset = (y * previewWidth + x) * 4;
      previewRgba[offset] = Math.round(color[0]);
      previewRgba[offset + 1] = Math.round(color[1]);
      previewRgba[offset + 2] = Math.round(color[2]);
      previewRgba[offset + 3] = 255;
    }
  }
  const calibration = frame.calibration;
  return {
    name: frame.member.name,
    type: frame.type,
    panDegrees: frame.panDegrees,
    imageWidth: calibration.width,
    imageHeight: calibration.height,
    fx: calibration.fx,
    fy: calibration.fy,
    cx: calibration.cx,
    cy: calibration.cy,
    modelToCamera: [...calibration.modelToCamera],
    previewWidth,
    previewHeight,
    previewRgba,
  };
}

function projectIntoFrame(
  data: Uint8Array,
  frame: CameraFrame,
  modelX: number,
  modelY: number,
  modelZ: number
): { color: [number, number, number]; score: number } | null {
  const pan = frame.panDegrees * (Math.PI / 180);
  const cosPan = Math.cos(pan);
  const sinPan = Math.sin(pan);
  const x = cosPan * modelX - sinPan * modelY;
  const y = sinPan * modelX + cosPan * modelY;
  const m = frame.calibration.modelToCamera;
  const cameraX = m[0] * x + m[1] * y + m[2] * modelZ + m[3];
  const cameraY = m[4] * x + m[5] * y + m[6] * modelZ + m[7];
  const cameraZ = m[8] * x + m[9] * y + m[10] * modelZ + m[11];
  if (cameraZ <= 0.05) {
    return null;
  }
  const normalizedX = cameraX / cameraZ;
  const normalizedY = cameraY / cameraZ;
  const radius2 = normalizedX * normalizedX + normalizedY * normalizedY;
  const c = frame.calibration;
  const radial = 1 + c.k1 * radius2 + c.k2 * radius2 ** 2 + c.k3 * radius2 ** 3;
  const distortedX =
    normalizedX * radial +
    2 * c.p1 * normalizedX * normalizedY +
    c.p2 * (radius2 + 2 * normalizedX ** 2);
  const distortedY =
    normalizedY * radial +
    c.p1 * (radius2 + 2 * normalizedY ** 2) +
    2 * c.p2 * normalizedX * normalizedY;
  const pixelX = c.fx * distortedX + c.cx;
  const pixelY = c.fy * distortedY + c.cy;
  if (pixelX < 1 || pixelY < 1 || pixelX >= c.width - 1 || pixelY >= c.height - 1) {
    return null;
  }
  const centerX = (pixelX - c.cx) / (c.width * 0.5);
  const centerY = (pixelY - c.cy) / (c.height * 0.5);
  return {
    color: sampleGrbg(data, frame, pixelX, pixelY),
    score: centerX * centerX + centerY * centerY,
  };
}

function angularDifference(a: number, b: number): number {
  return Math.abs(((a - b + 540) % 360) - 180);
}

export class StonexX3aParser {
  async parse(
    data: Uint8Array,
    fileName = '',
    timingCallback?: (message: string) => void
  ): Promise<StonexX3aData> {
    const startedAt = performance.now();
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

    const scanMembers = members.filter(
      member => member.name.toLowerCase().endsWith('.x3r') && member.size >= 64
    );
    if (scanMembers.length === 0) {
      throw new Error('Invalid Stonex X3A file: archive contains no X3R scan records.');
    }

    const calibrations = new Map<'U' | 'D', CameraCalibration>();
    for (const member of members.filter(member => member.name.toLowerCase().endsWith('.cal'))) {
      const calibration = parseCalibration(data, member);
      if (calibration) {
        calibrations.set(calibration.type, calibration);
      }
    }
    const cameraFrames = parseCameraFrames(data, view, members, calibrations);

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

    const positions = new Float32Array(vertexCount * 3);
    const intensity = new Float32Array(vertexCount);
    const colors = cameraFrames.length > 0 ? new Uint8Array(vertexCount * 3) : null;
    const photographicScanStems = new Set(cameraFrames.map(frame => frame.scanStem));
    let outputIndex = 0;
    let photographicallyColoredPoints = 0;
    const scanPointRanges: ScanPointRange[] = [];

    for (const layout of layouts) {
      const pointOffset = outputIndex;
      const coloredPointOffset = photographicallyColoredPoints;
      const scanStem = layout.name.replace(/\.x3r$/i, '');
      const exactFrames = cameraFrames.filter(frame => frame.scanStem === scanStem);
      // Abschnitt_A contains several scan passes in one scanner coordinate
      // frame, but photographs only carry the final scan's stem. If an archive
      // has exactly one photographic stem, reuse that station's calibrated
      // panorama for its other co-located X3R grids.
      const layoutFrames =
        exactFrames.length > 0 ? exactFrames : photographicScanStems.size === 1 ? cameraFrames : [];
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
        const azimuth = azimuthDegrees * (Math.PI / 180);
        const sinAzimuth = Math.sin(azimuth);
        const cosAzimuth = Math.cos(azimuth);
        const columnFrames = layoutFrames.filter(
          frame => angularDifference(frame.panDegrees, azimuthDegrees) <= 30
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
            const fallback = Math.round(normalizedIntensity * 255);
            colors[positionOffset] = fallback;
            colors[positionOffset + 1] = fallback;
            colors[positionOffset + 2] = fallback;
            let red = 0;
            let green = 0;
            let blue = 0;
            let totalWeight = 0;
            for (const frame of columnFrames) {
              const projection = projectIntoFrame(data, frame, modelX, modelY, modelZ);
              if (projection) {
                const weight = 1 / (0.05 + projection.score) ** 2;
                red += projection.color[0] * weight;
                green += projection.color[1] * weight;
                blue += projection.color[2] * weight;
                totalWeight += weight;
              }
            }
            if (totalWeight > 0) {
              colors[positionOffset] = Math.round(red / totalWeight);
              colors[positionOffset + 1] = Math.round(green / totalWeight);
              colors[positionOffset + 2] = Math.round(blue / totalWeight);
              photographicallyColoredPoints++;
            }
          }
          outputIndex++;
        }
      }
      scanPointRanges.push({
        name: layout.name,
        memberSize: layout.size,
        sourcePointCount: layout.columns * layout.rows,
        pointOffset,
        pointCount: outputIndex - pointOffset,
        photographicallyColoredPoints: photographicallyColoredPoints - coloredPointOffset,
      });
    }

    timingCallback?.(
      `Stonex X3A: parsed ${vertexCount.toLocaleString()} valid returns from ${scanMembers.length} scans in ${(performance.now() - startedAt).toFixed(1)} ms`
    );

    return {
      vertexCount,
      sourcePointCount,
      faceCount: 0,
      hasColors: colors !== null,
      hasNormals: false,
      hasIntensity: true,
      format: 'binary_little_endian',
      version: '1.0',
      fileName,
      comments: [
        'Experimental Stonex X300 X3A/X3R decoder',
        `Embedded scans: ${scanMembers.map(member => member.name).join(', ')}`,
        cameraFrames.length > 0
          ? `Photographic color: ${photographicallyColoredPoints.toLocaleString()} points from ${cameraFrames.length} X3I frames`
          : 'No usable X3I camera frames and calibration were found',
      ],
      vertices: [],
      faces: [],
      positionsArray: positions,
      colorsArray: colors,
      normalsArray: null,
      intensityArray: intensity,
      scalarFields: { intensity },
      useTypedArrays: true,
      metadata: {
        container: isArchive ? 'Stonex X300 RAW Archive (CRAX)' : 'Stonex X300 scan record',
        embeddedScans: scanMembers.map(member => member.name),
        embeddedScanPointRanges: scanPointRanges,
        cameraFrames: cameraFrames.map(frame => frame.member.name),
        cameraCalibrations: [...calibrations.keys()],
        stonexCameraFrames: cameraFrames.map(frame => cameraFrameMetadata(data, frame)),
        scannerPosition: [0, 0, 0],
        scannerCoordinateConvention: 'viewer X=model Y, viewer Y=model X, viewer Z=model Z',
        sharedScannerFrameAssumed: photographicScanStems.size === 1 && scanMembers.length > 1,
        photographicallyColoredPoints,
        // X300 archives cover hundreds of metres. The viewer's generic 1 mm
        // default projects to far below one pixel at the initial overview.
        recommendedPointSize: 0.25,
        rangeScaleMetres: RANGE_SCALE_METRES,
        verticalFieldOfViewDegrees: [
          VERTICAL_MIN_DEGREES,
          VERTICAL_MIN_DEGREES + VERTICAL_SPAN_DEGREES,
        ],
      },
    };
  }

  /** Decode an archive into one viewer object per embedded X3R member. */
  async parseAll(
    data: Uint8Array,
    fileName = '',
    timingCallback?: (message: string) => void
  ): Promise<StonexX3aData[]> {
    const combined = await this.parse(data, fileName, timingCallback);
    const ranges = combined.metadata.embeddedScanPointRanges as ScanPointRange[] | undefined;
    if (!ranges || ranges.length <= 1) {
      return [combined];
    }

    const cameraFrames = combined.metadata.stonexCameraFrames;
    return ranges.map((range, index) => {
      const pointEnd = range.pointOffset + range.pointCount;
      const componentStart = range.pointOffset * 3;
      const componentEnd = pointEnd * 3;
      const intensityArray = combined.intensityArray.slice(range.pointOffset, pointEnd);
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
        positionsArray: combined.positionsArray.slice(componentStart, componentEnd),
        colorsArray: combined.colorsArray?.slice(componentStart, componentEnd) ?? null,
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
          // All members share a scanner station. Register its camera rig once,
          // after the final cloud so sequential extension transfers cannot shift
          // the camera entry's unified UI index as later clouds arrive.
          stonexCameraFrames: index === ranges.length - 1 ? cameraFrames : [],
          stonexCameraProfileName: fileName,
        },
      };
    });
  }
}
