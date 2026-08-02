/**
 * Experimental reader for Stonex X300 RAW archives (.x3a).
 *
 * X3A is a proprietary CRAX container.  X300 scan records inside it use the
 * X3R layout observed in firmware v14: a descriptor followed by XCOL blocks,
 * each containing an azimuth and an organized column of range/pulse-width
 * samples. Camera (.x3i) and calibration (.cal) members are intentionally
 * ignored; decoding those is not required to recover point geometry.
 */

export interface StonexX3aData {
  vertexCount: number;
  sourcePointCount: number;
  faceCount: 0;
  hasColors: false;
  hasNormals: false;
  hasIntensity: true;
  format: 'binary_little_endian';
  version: '1.0';
  fileName: string;
  comments: string[];
  vertices: never[];
  faces: never[];
  positionsArray: Float32Array;
  colorsArray: null;
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

export class StonexX3aParser {
  async parse(
    data: Uint8Array,
    fileName = '',
    timingCallback?: (message: string) => void
  ): Promise<StonexX3aData> {
    const startedAt = performance.now();
    if (data.byteLength < ARCHIVE_HEADER_BYTES || ascii(data, 0, 4) !== ARCHIVE_MAGIC) {
      throw new Error('Invalid Stonex X3A file: missing CRAX archive signature.');
    }

    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const memberCount = view.getUint32(80, true);
    if (memberCount === 0 || memberCount > 100_000) {
      throw new Error(`Invalid Stonex X3A file: unreasonable member count ${memberCount}.`);
    }
    const directoryEnd = ARCHIVE_HEADER_BYTES + memberCount * ARCHIVE_ENTRY_BYTES;
    if (directoryEnd > data.byteLength) {
      throw new Error('Invalid Stonex X3A file: truncated member directory.');
    }

    const members: ArchiveMember[] = [];
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
        throw new Error(`Invalid Stonex X3A file: bad bounds for archive member ${name || index}.`);
      }
      if (size < 0 || offset + size > data.byteLength) {
        throw new Error(`Invalid Stonex X3A file: truncated archive member ${name || index}.`);
      }
      members.push({ name, offset, size });
    }

    const scanMembers = members.filter(
      member => member.name.toLowerCase().endsWith('.x3r') && member.size >= 64
    );
    if (scanMembers.length === 0) {
      throw new Error('Invalid Stonex X3A file: archive contains no X3R scan records.');
    }

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
    let outputIndex = 0;

    for (const layout of layouts) {
      const verticalStep = VERTICAL_SPAN_DEGREES / layout.rows;
      const verticalSin = new Float64Array(layout.rows);
      const verticalCos = new Float64Array(layout.rows);
      for (let row = 0; row < layout.rows; row++) {
        const elevation = (VERTICAL_MIN_DEGREES + row * verticalStep) * (Math.PI / 180);
        verticalSin[row] = Math.sin(elevation);
        verticalCos[row] = Math.cos(elevation);
      }

      for (let column = 0; column < layout.columns; column++) {
        const blockOffset = layout.columnOffset + column * layout.columnStride;
        const azimuth = view.getInt32(blockOffset + 20, true) * 1e-6 * (Math.PI / 180);
        const sinAzimuth = Math.sin(azimuth);
        const cosAzimuth = Math.cos(azimuth);
        let sampleOffset = blockOffset + X3R_COLUMN_HEADER_BYTES;
        for (let row = 0; row < layout.rows; row++, sampleOffset += 8) {
          const rawRange = view.getInt32(sampleOffset, true);
          if (rawRange <= 0 || rawRange >= INVALID_RANGE_MAX) {
            continue;
          }
          const range = rawRange * RANGE_SCALE_METRES;
          const horizontalRange = range * verticalCos[row];
          const positionOffset = outputIndex * 3;
          positions[positionOffset] = horizontalRange * cosAzimuth;
          positions[positionOffset + 1] = horizontalRange * sinAzimuth;
          positions[positionOffset + 2] = range * verticalSin[row];
          intensity[outputIndex] = Math.min(
            1,
            view.getUint32(sampleOffset + 4, true) / PULSE_WIDTH_MAX
          );
          outputIndex++;
        }
      }
    }

    timingCallback?.(
      `Stonex X3A: parsed ${vertexCount.toLocaleString()} valid returns from ${scanMembers.length} scans in ${(performance.now() - startedAt).toFixed(1)} ms`
    );

    return {
      vertexCount,
      sourcePointCount,
      faceCount: 0,
      hasColors: false,
      hasNormals: false,
      hasIntensity: true,
      format: 'binary_little_endian',
      version: '1.0',
      fileName,
      comments: [
        'Experimental Stonex X300 X3A/X3R decoder',
        `Embedded scans: ${scanMembers.map(member => member.name).join(', ')}`,
        'Raw camera images and camera calibration are not decoded',
      ],
      vertices: [],
      faces: [],
      positionsArray: positions,
      colorsArray: null,
      normalsArray: null,
      intensityArray: intensity,
      scalarFields: { intensity },
      useTypedArrays: true,
      metadata: {
        container: 'Stonex X300 RAW Archive (CRAX)',
        embeddedScans: scanMembers.map(member => member.name),
        ignoredCameraImages: members.filter(member => member.name.toLowerCase().endsWith('.x3i'))
          .length,
        rangeScaleMetres: RANGE_SCALE_METRES,
        verticalFieldOfViewDegrees: [
          VERTICAL_MIN_DEGREES,
          VERTICAL_MIN_DEGREES + VERTICAL_SPAN_DEGREES,
        ],
      },
    };
  }
}
