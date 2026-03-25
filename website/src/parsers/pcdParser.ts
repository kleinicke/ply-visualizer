/**
 * Parser for Point Cloud Data (PCD) format.
 * Supports ASCII and binary PCD files.
 *
 * Uses typed arrays throughout — no JS object per point — and decodes only the
 * header as text, leaving binary payloads untouched.
 */

import { ByteLineReader, findPcdDataOffset } from '../utils/byteLineReader';

export interface PcdData {
  vertexCount: number;
  hasColors: boolean;
  hasNormals: boolean;
  format: 'ascii' | 'binary';
  fileName: string;
  fileIndex?: number;
  comments: string[];
  width: number;
  height: number;
  fields: string[];
  size: number[];
  type: string[];
  count: number[];
  viewpoint: number[];
  // Typed array output — always populated
  positionsArray: Float32Array;
  colorsArray: Uint8Array | null;
  normalsArray: Float32Array | null;
  useTypedArrays: true;
  // Legacy — always empty
  vertices: never[];
}

export class PcdParser {
  async parse(data: Uint8Array, timingCallback?: (message: string) => void): Promise<PcdData> {
    const startTime = performance.now();
    timingCallback?.('🔍 PCD: Scanning header...');

    // ── 1. Find the DATA line in raw bytes and decode only the header ────────
    const dataOffset = findPcdDataOffset(data);
    if (dataOffset === -1) {
      throw new Error('Invalid PCD file: DATA section not found');
    }

    const headerText = new TextDecoder('utf-8').decode(data.subarray(0, dataOffset));
    const headerLines = headerText.split('\n');

    // ── 2. Parse header fields ───────────────────────────────────────────────
    let width = 0;
    let height = 1;
    let points = 0;
    let fields: string[] = [];
    let size: number[] = [];
    let type: string[] = [];
    let count: number[] = [];
    let viewpoint: number[] = [0, 0, 0, 1, 0, 0, 0];
    let format: 'ascii' | 'binary' = 'ascii';
    const comments: string[] = [];

    for (const rawLine of headerLines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) {
        if (line.startsWith('#')) {
          comments.push(line.slice(1).trim());
        }
        continue;
      }

      const parts = line.split(/\s+/);
      switch (parts[0].toUpperCase()) {
        case 'FIELDS':
          fields = parts.slice(1);
          break;
        case 'SIZE':
          size = parts.slice(1).map(Number);
          break;
        case 'TYPE':
          type = parts.slice(1);
          break;
        case 'COUNT':
          count = parts.slice(1).map(Number);
          break;
        case 'WIDTH':
          width = parseInt(parts[1]);
          break;
        case 'HEIGHT':
          height = parseInt(parts[1]);
          break;
        case 'VIEWPOINT':
          viewpoint = parts.slice(1).map(Number);
          break;
        case 'POINTS':
          points = parseInt(parts[1]);
          break;
        case 'DATA':
          format = parts[1].toLowerCase() as 'ascii' | 'binary';
          break;
      }
    }

    const vertexCount = points || width * height;
    if (vertexCount <= 0) {
      throw new Error('PCD file reports 0 points');
    }

    // Map field indices
    const fIdx = (name: string) => fields.findIndex(f => f.toLowerCase() === name);

    const xI = fIdx('x');
    const yI = fIdx('y');
    const zI = fIdx('z');
    const rgbI = fields.findIndex(f => ['rgb', 'rgba'].includes(f.toLowerCase()));
    const rI = fIdx('r') === -1 ? fIdx('red') : fIdx('r');
    const gI = fIdx('g') === -1 ? fIdx('green') : fIdx('g');
    const bI = fIdx('b') === -1 ? fIdx('blue') : fIdx('b');
    const nxI = fIdx('normal_x') === -1 ? fIdx('nx') : fIdx('normal_x');
    const nyI = fIdx('normal_y') === -1 ? fIdx('ny') : fIdx('normal_y');
    const nzI = fIdx('normal_z') === -1 ? fIdx('nz') : fIdx('normal_z');

    const hasColors = rgbI !== -1 || (rI !== -1 && gI !== -1 && bI !== -1);
    const hasNormals = nxI !== -1 && nyI !== -1 && nzI !== -1;

    timingCallback?.(
      `📊 PCD: ${vertexCount.toLocaleString()} points, ${format}, fields: ${fields.join(' ')}`
    );

    // ── 3. Allocate typed arrays ─────────────────────────────────────────────
    const positionsArray = new Float32Array(vertexCount * 3);
    const colorsArray = hasColors ? new Uint8Array(vertexCount * 3) : null;
    const normalsArray = hasNormals ? new Float32Array(vertexCount * 3) : null;

    // ── 4. Parse data ────────────────────────────────────────────────────────
    if (format === 'binary') {
      this.parseBinary(
        data,
        dataOffset,
        vertexCount,
        fields,
        size,
        type,
        count,
        xI,
        yI,
        zI,
        rgbI,
        rI,
        gI,
        bI,
        nxI,
        nyI,
        nzI,
        positionsArray,
        colorsArray,
        normalsArray
      );
    } else {
      this.parseAscii(
        data,
        dataOffset,
        vertexCount,
        fields,
        xI,
        yI,
        zI,
        rgbI,
        rI,
        gI,
        bI,
        nxI,
        nyI,
        nzI,
        positionsArray,
        colorsArray,
        normalsArray,
        timingCallback
      );
    }

    const elapsed = (performance.now() - startTime).toFixed(1);
    timingCallback?.(`✅ PCD: parsed ${vertexCount.toLocaleString()} points in ${elapsed} ms`);

    return {
      vertexCount,
      hasColors,
      hasNormals,
      format,
      fileName: '',
      comments,
      width,
      height,
      fields,
      size,
      type,
      count,
      viewpoint,
      positionsArray,
      colorsArray,
      normalsArray,
      useTypedArrays: true,
      vertices: [],
    };
  }

  // ── Binary parsing ──────────────────────────────────────────────────────────

  private parseBinary(
    data: Uint8Array,
    dataOffset: number,
    vertexCount: number,
    fields: string[],
    size: number[],
    type: string[],
    count: number[],
    xI: number,
    yI: number,
    zI: number,
    rgbI: number,
    rI: number,
    gI: number,
    bI: number,
    nxI: number,
    nyI: number,
    nzI: number,
    positions: Float32Array,
    colors: Uint8Array | null,
    normals: Float32Array | null
  ): void {
    // Byte stride per point
    let stride = 0;
    const fieldOffsets: number[] = [];
    for (let f = 0; f < fields.length; f++) {
      fieldOffsets.push(stride);
      stride += size[f] * (count[f] || 1);
    }

    const binaryData = data.subarray(dataOffset);
    if (binaryData.length < stride * vertexCount) {
      throw new Error(
        `PCD binary data too short: need ${stride * vertexCount} bytes, have ${binaryData.length}`
      );
    }

    const dv = new DataView(binaryData.buffer, binaryData.byteOffset, binaryData.byteLength);

    const readField = (pointBase: number, fieldIdx: number): number => {
      if (fieldIdx < 0) {
        return 0;
      }
      const off = pointBase + fieldOffsets[fieldIdx];
      const t = type[fieldIdx];
      const s = size[fieldIdx];
      if (t === 'F') {
        return s === 4 ? dv.getFloat32(off, true) : dv.getFloat64(off, true);
      }
      if (t === 'U') {
        if (s === 1) {
          return dv.getUint8(off);
        }
        if (s === 2) {
          return dv.getUint16(off, true);
        }
        return dv.getUint32(off, true);
      }
      if (t === 'I') {
        if (s === 1) {
          return dv.getInt8(off);
        }
        if (s === 2) {
          return dv.getInt16(off, true);
        }
        return dv.getInt32(off, true);
      }
      return 0;
    };

    for (let i = 0; i < vertexCount; i++) {
      const base = i * stride;
      const i3 = i * 3;

      positions[i3] = readField(base, xI);
      positions[i3 + 1] = readField(base, yI);
      positions[i3 + 2] = readField(base, zI);

      if (colors) {
        if (rgbI !== -1) {
          // Packed float RGB — reinterpret float bits as uint32
          const rawFloat = readField(base, rgbI);
          const buf = new ArrayBuffer(4);
          new Float32Array(buf)[0] = rawFloat;
          const packed = new Uint32Array(buf)[0];
          colors[i3] = (packed >> 16) & 0xff;
          colors[i3 + 1] = (packed >> 8) & 0xff;
          colors[i3 + 2] = packed & 0xff;
        } else {
          colors[i3] = Math.min(255, Math.max(0, Math.round(readField(base, rI))));
          colors[i3 + 1] = Math.min(255, Math.max(0, Math.round(readField(base, gI))));
          colors[i3 + 2] = Math.min(255, Math.max(0, Math.round(readField(base, bI))));
        }
      }

      if (normals) {
        normals[i3] = readField(base, nxI);
        normals[i3 + 1] = readField(base, nyI);
        normals[i3 + 2] = readField(base, nzI);
      }
    }
  }

  // ── ASCII parsing ───────────────────────────────────────────────────────────

  private parseAscii(
    data: Uint8Array,
    dataOffset: number,
    vertexCount: number,
    fields: string[],
    xI: number,
    yI: number,
    zI: number,
    rgbI: number,
    rI: number,
    gI: number,
    bI: number,
    nxI: number,
    nyI: number,
    nzI: number,
    positions: Float32Array,
    colors: Uint8Array | null,
    normals: Float32Array | null,
    timingCallback?: (msg: string) => void
  ): void {
    const reader = new ByteLineReader(data, dataOffset);
    let parsed = 0;
    const logEvery = Math.max(1, Math.floor(vertexCount / 10));

    while (!reader.done && parsed < vertexCount) {
      const line = reader.nextLine();
      if (!line || line.trim() === '') {
        continue;
      }

      const parts = line.trim().split(/\s+/);
      if (parts.length < fields.length) {
        continue;
      }

      const i3 = parsed * 3;
      positions[i3] = parseFloat(parts[xI] ?? '0');
      positions[i3 + 1] = parseFloat(parts[yI] ?? '0');
      positions[i3 + 2] = parseFloat(parts[zI] ?? '0');

      if (colors) {
        if (rgbI !== -1) {
          // ASCII packed RGB: value is a float whose bits encode a uint32 RGB.
          // Reinterpret float bits → uint32, same as binary path.
          const buf = new ArrayBuffer(4);
          new Float32Array(buf)[0] = parseFloat(parts[rgbI]);
          const packed = new Uint32Array(buf)[0];
          colors[i3] = (packed >> 16) & 0xff;
          colors[i3 + 1] = (packed >> 8) & 0xff;
          colors[i3 + 2] = packed & 0xff;
        } else {
          colors[i3] = Math.min(255, Math.max(0, Math.round(parseFloat(parts[rI]))));
          colors[i3 + 1] = Math.min(255, Math.max(0, Math.round(parseFloat(parts[gI]))));
          colors[i3 + 2] = Math.min(255, Math.max(0, Math.round(parseFloat(parts[bI]))));
        }
      }

      if (normals) {
        normals[i3] = parseFloat(parts[nxI] ?? '0');
        normals[i3 + 1] = parseFloat(parts[nyI] ?? '0');
        normals[i3 + 2] = parseFloat(parts[nzI] ?? '0');
      }

      parsed++;
      if (parsed % logEvery === 0) {
        timingCallback?.(
          `📊 PCD: ${parsed.toLocaleString()} / ${vertexCount.toLocaleString()} points...`
        );
      }
    }
  }
}
