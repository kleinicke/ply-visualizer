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
  format: 'ascii' | 'binary' | 'binary_compressed';
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
    let format: 'ascii' | 'binary' | 'binary_compressed' = 'ascii';
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
          format = parts[1].toLowerCase() as 'ascii' | 'binary' | 'binary_compressed';
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
    if (format === 'binary_compressed') {
      const uncompressed = this.decompressBinaryCompressed(data, dataOffset, vertexCount);
      this.parseBinaryCompressedColumns(
        uncompressed,
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
    } else if (format === 'binary') {
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

    // ── 5. Strip NaN points (PCL marks invalid depth pixels with NaN coords) ───
    const finalVertexCount = this.compactNaN(
      positionsArray,
      colorsArray,
      normalsArray,
      vertexCount
    );

    // Trim to exact valid size so Three.js BufferAttribute gets the correct length
    const finalPositions = positionsArray.slice(0, finalVertexCount * 3);
    const finalColors = colorsArray ? colorsArray.slice(0, finalVertexCount * 3) : null;
    const finalNormals = normalsArray ? normalsArray.slice(0, finalVertexCount * 3) : null;

    const elapsed = (performance.now() - startTime).toFixed(1);
    timingCallback?.(
      `✅ PCD: ${finalVertexCount.toLocaleString()} valid points (${(vertexCount - finalVertexCount).toLocaleString()} NaN filtered) in ${elapsed} ms`
    );

    return {
      vertexCount: finalVertexCount,
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
      positionsArray: finalPositions,
      colorsArray: finalColors,
      normalsArray: finalNormals,
      useTypedArrays: true,
      vertices: [],
    };
  }

  // ── Binary-compressed parsing ───────────────────────────────────────────────

  /**
   * LZF decompressor used by PCL's binary_compressed format.
   * After the DATA line the file has:
   *   uint32 compressed_size
   *   uint32 uncompressed_size
   *   <compressed bytes>
   * The decompressed output is in column-major order (all values for field 0,
   * then all values for field 1, …).
   */
  private decompressBinaryCompressed(
    data: Uint8Array,
    dataOffset: number,
    vertexCount: number
  ): Uint8Array {
    if (data.length < dataOffset + 8) {
      throw new Error('PCD binary_compressed: header too short');
    }
    const dv = new DataView(data.buffer, data.byteOffset + dataOffset);
    const compressedSize = dv.getUint32(0, true);
    const uncompressedSize = dv.getUint32(4, true);

    const input = data.subarray(dataOffset + 8, dataOffset + 8 + compressedSize);
    const output = new Uint8Array(uncompressedSize);

    let ip = 0; // input position
    let op = 0; // output position

    while (ip < input.length) {
      const ctrl = input[ip++];

      if (ctrl < 32) {
        // Literal run: copy ctrl+1 bytes
        const len = ctrl + 1;
        for (let i = 0; i < len; i++) {
          output[op++] = input[ip++];
        }
      } else {
        // Back-reference
        let len = ctrl >> 5;
        if (len === 7) {
          len += input[ip++];
        }
        len += 2; // minimum match is 2

        // Distance is 1-based
        const dist = ((ctrl & 0x1f) << 8) | input[ip++];
        let ref = op - dist - 1;

        for (let i = 0; i < len; i++) {
          output[op++] = output[ref++];
        }
      }
    }

    if (op !== uncompressedSize) {
      throw new Error(
        `PCD binary_compressed: decompressed ${op} bytes, expected ${uncompressedSize}`
      );
    }

    return output;
  }

  /**
   * Parse decompressed binary_compressed data.
   * Layout: column-major — all values for field 0, then field 1, …
   * Each field block is size[f] * count[f] * vertexCount bytes.
   */
  private parseBinaryCompressedColumns(
    data: Uint8Array,
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
    // Compute byte offset of each field's column block
    const fieldStart: number[] = [];
    let offset = 0;
    for (let f = 0; f < fields.length; f++) {
      fieldStart.push(offset);
      offset += size[f] * (count[f] || 1) * vertexCount;
    }

    const readValue = (fieldIdx: number, pointIdx: number): number => {
      if (fieldIdx < 0) {return 0;}
      const s = size[fieldIdx];
      const t = type[fieldIdx];
      const byteOff = fieldStart[fieldIdx] + pointIdx * s;
      const dv = new DataView(data.buffer, data.byteOffset + byteOff, s);
      if (t === 'F') {return s === 4 ? dv.getFloat32(0, true) : dv.getFloat64(0, true);}
      if (t === 'U') {
        if (s === 1) {return dv.getUint8(0);}
        if (s === 2) {return dv.getUint16(0, true);}
        return dv.getUint32(0, true);
      }
      if (t === 'I') {
        if (s === 1) {return dv.getInt8(0);}
        if (s === 2) {return dv.getInt16(0, true);}
        return dv.getInt32(0, true);
      }
      return 0;
    };

    for (let i = 0; i < vertexCount; i++) {
      const i3 = i * 3;

      positions[i3] = readValue(xI, i);
      positions[i3 + 1] = readValue(yI, i);
      positions[i3 + 2] = readValue(zI, i);

      if (colors) {
        if (rgbI !== -1) {
          const raw = readValue(rgbI, i);
          let packed: number;
          if (type[rgbI] === 'F') {
            const buf = new ArrayBuffer(4);
            new Float32Array(buf)[0] = raw;
            packed = new Uint32Array(buf)[0];
          } else {
            packed = raw >>> 0;
          }
          colors[i3] = (packed >> 16) & 0xff;
          colors[i3 + 1] = (packed >> 8) & 0xff;
          colors[i3 + 2] = packed & 0xff;
        } else {
          colors[i3] = Math.min(255, Math.max(0, Math.round(readValue(rI, i))));
          colors[i3 + 1] = Math.min(255, Math.max(0, Math.round(readValue(gI, i))));
          colors[i3 + 2] = Math.min(255, Math.max(0, Math.round(readValue(bI, i))));
        }
      }

      if (normals) {
        normals[i3] = readValue(nxI, i);
        normals[i3 + 1] = readValue(nyI, i);
        normals[i3 + 2] = readValue(nzI, i);
      }
    }
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
          const raw = readField(base, rgbI);
          // Type 'F': float bits encode packed RGB. Type 'U'/'I': already a packed uint32.
          let packed: number;
          if (type[rgbI] === 'F') {
            const buf = new ArrayBuffer(4);
            new Float32Array(buf)[0] = raw;
            packed = new Uint32Array(buf)[0];
          } else {
            packed = raw >>> 0;
          }
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

  // ── NaN compaction ─────────────────────────────────────────────────────────

  /**
   * Remove points where any coordinate is NaN (PCL invalid-point sentinel).
   * Compacts positionsArray, colorsArray, and normalsArray in-place and
   * returns the new valid point count.
   */
  private compactNaN(
    positions: Float32Array,
    colors: Uint8Array | null,
    normals: Float32Array | null,
    vertexCount: number
  ): number {
    let writeIdx = 0;
    for (let i = 0; i < vertexCount; i++) {
      const i3 = i * 3;
      if (isNaN(positions[i3]) || isNaN(positions[i3 + 1]) || isNaN(positions[i3 + 2])) {
        continue;
      }
      if (writeIdx !== i) {
        const w3 = writeIdx * 3;
        positions[w3] = positions[i3];
        positions[w3 + 1] = positions[i3 + 1];
        positions[w3 + 2] = positions[i3 + 2];
        if (colors) {
          colors[w3] = colors[i3];
          colors[w3 + 1] = colors[i3 + 1];
          colors[w3 + 2] = colors[i3 + 2];
        }
        if (normals) {
          normals[w3] = normals[i3];
          normals[w3 + 1] = normals[i3 + 1];
          normals[w3 + 2] = normals[i3 + 2];
        }
      }
      writeIdx++;
    }
    return writeIdx;
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
