/**
 * Parser for PTS format (point cloud with optional intensity/colour/normals).
 *
 * Supported column layouts (auto-detected from first data line):
 *   3  → x y z
 *   4  → x y z intensity
 *   6  → x y z r g b
 *   7  → x y z intensity r g b   ← Open3D default
 *   9  → x y z r g b nx ny nz
 *
 * Uses ByteLineReader to process lines one at a time — no full-file decode.
 * Output is typed arrays (positionsArray / colorsArray / normalsArray).
 */

import { ByteLineReader } from '../utils/byteLineReader';

export interface PtsData {
  vertexCount: number;
  hasColors: boolean;
  hasNormals: boolean;
  hasIntensity: boolean;
  format: 'pts';
  fileName: string;
  fileIndex?: number;
  comments: string[];
  detectedFormat: string;
  // Typed array output — always populated
  positionsArray: Float32Array;
  colorsArray: Uint8Array | null;
  normalsArray: Float32Array | null;
  useTypedArrays: true;
  // Legacy — always empty
  vertices: never[];
}

export class PtsParser {
  async parse(data: Uint8Array, timingCallback?: (message: string) => void): Promise<PtsData> {
    const startTime = performance.now();
    timingCallback?.('🔍 PTS: Scanning header...');

    const reader = new ByteLineReader(data);
    const comments: string[] = [];

    // ── 1. Skip comment / count lines ───────────────────────────────────────
    let knownCount = -1; // point count declared in file header, if any
    let firstDataLine: string | null = null;

    while (!reader.done) {
      const line = reader.nextLine();
      if (line === null) {
        break;
      }
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }

      if (trimmed.startsWith('#') || trimmed.startsWith('//')) {
        comments.push(trimmed.slice(1).trim());
        continue;
      }

      // A lone integer on its own line is the point count
      if (/^\d+$/.test(trimmed)) {
        knownCount = parseInt(trimmed, 10);
        continue;
      }

      // This is the first real data line
      firstDataLine = trimmed;
      break;
    }

    if (!firstDataLine) {
      throw new Error('PTS file contains no data lines');
    }

    // ── 2. Detect column layout from first data line ─────────────────────────
    const colCount = firstDataLine.split(/\s+/).length;

    let hasColors = false;
    let hasNormals = false;
    let hasIntensity = false;
    let detectedFormat: string;

    switch (colCount) {
      case 3:
        detectedFormat = 'x y z';
        break;
      case 4:
        detectedFormat = 'x y z intensity';
        hasIntensity = true;
        break;
      case 6:
        detectedFormat = 'x y z r g b';
        hasColors = true;
        break;
      case 7:
        detectedFormat = 'x y z intensity r g b';
        hasIntensity = true;
        hasColors = true;
        break;
      case 9:
        detectedFormat = 'x y z r g b nx ny nz';
        hasColors = true;
        hasNormals = true;
        break;
      default:
        detectedFormat =
          colCount >= 6 ? `x y z r g b (${colCount} cols)` : `x y z (${colCount} cols)`;
        hasColors = colCount >= 6;
        hasNormals = colCount >= 9;
    }

    timingCallback?.(`🎯 PTS: detected format "${detectedFormat}"`);

    // ── 3. Allocate typed arrays ─────────────────────────────────────────────
    // Use knownCount if available, otherwise grow dynamically.
    const INITIAL_CAPACITY = knownCount > 0 ? knownCount : 1_000_000;

    let capacity = INITIAL_CAPACITY;
    let positions = new Float32Array(capacity * 3);
    let colors = hasColors ? new Uint8Array(capacity * 3) : null;
    let normals = hasNormals ? new Float32Array(capacity * 3) : null;
    let parsed = 0;

    const grow = () => {
      capacity *= 2;
      const p2 = new Float32Array(capacity * 3);
      p2.set(positions);
      positions = p2;
      if (colors) {
        const c2 = new Uint8Array(capacity * 3);
        c2.set(colors);
        colors = c2;
      }
      if (normals) {
        const n2 = new Float32Array(capacity * 3);
        n2.set(normals);
        normals = n2;
      }
    };

    // ── 4. Parse helper ──────────────────────────────────────────────────────
    const parseLine = (trimmed: string) => {
      const parts = trimmed.split(/\s+/);
      if (parts.length < 3) {
        return;
      }

      if (parsed >= capacity) {
        grow();
      }

      const i3 = parsed * 3;
      positions[i3] = parseFloat(parts[0]);
      positions[i3 + 1] = parseFloat(parts[1]);
      positions[i3 + 2] = parseFloat(parts[2]);

      if (colors) {
        let rCol: number, gCol: number, bCol: number;
        if (colCount === 6) {
          rCol = parseFloat(parts[3]);
          gCol = parseFloat(parts[4]);
          bCol = parseFloat(parts[5]);
        } else {
          // 7-column: intensity at index 3, rgb at 4-5-6
          // 9-column: rgb at 3-4-5
          const base = colCount === 7 ? 4 : 3;
          rCol = parseFloat(parts[base]);
          gCol = parseFloat(parts[base + 1]);
          bCol = parseFloat(parts[base + 2]);
        }
        colors[i3] = Math.min(255, Math.max(0, Math.round(rCol)));
        colors[i3 + 1] = Math.min(255, Math.max(0, Math.round(gCol)));
        colors[i3 + 2] = Math.min(255, Math.max(0, Math.round(bCol)));
      }

      if (normals) {
        // 9-column: normals at indices 6-7-8
        normals[i3] = parseFloat(parts[6]);
        normals[i3 + 1] = parseFloat(parts[7]);
        normals[i3 + 2] = parseFloat(parts[8]);
      }

      parsed++;
    };

    // Process the first data line we already read
    parseLine(firstDataLine);

    const logEvery = Math.max(1, knownCount > 0 ? Math.floor(knownCount / 10) : 500_000);

    while (!reader.done) {
      const line = reader.nextLine();
      if (line === null) {
        break;
      }
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }

      parseLine(trimmed);

      if (parsed % logEvery === 0) {
        timingCallback?.(`📊 PTS: ${parsed.toLocaleString()} points...`);
      }
    }

    // ── 5. Trim typed arrays to actual size ──────────────────────────────────
    const finalPositions = positions.subarray(0, parsed * 3);
    const finalColors = colors ? colors.subarray(0, parsed * 3) : null;
    const finalNormals = normals ? normals.subarray(0, parsed * 3) : null;

    const elapsed = (performance.now() - startTime).toFixed(1);
    timingCallback?.(`✅ PTS: parsed ${parsed.toLocaleString()} points in ${elapsed} ms`);

    return {
      vertexCount: parsed,
      hasColors,
      hasNormals,
      hasIntensity,
      format: 'pts',
      fileName: '',
      comments,
      detectedFormat,
      positionsArray: finalPositions,
      colorsArray: finalColors,
      normalsArray: finalNormals,
      useTypedArrays: true,
      vertices: [],
    };
  }
}
