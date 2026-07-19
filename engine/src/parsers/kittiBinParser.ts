/**
 * Parser for KITTI BIN and SemanticKITTI scan files.
 *
 * Headerless little-endian float32 records: [x, y, z, reflectance] repeated.
 * No metadata of any kind — validity is inferred purely from file size being
 * a multiple of 16 bytes (4 floats × 4 bytes).
 */

export interface KittiBinData {
  vertexCount: number;
  hasColors: false;
  hasNormals: false;
  hasIntensity: true;
  format: 'kitti-bin';
  fileName: string;
  fileIndex?: number;
  comments: string[];
  detectedFormat: string;
  // Typed array output — always populated
  positionsArray: Float32Array;
  colorsArray: null;
  normalsArray: null;
  intensityArray: Float32Array;
  scalarFields: Record<string, Float32Array>;
  useTypedArrays: true;
  // Legacy — always empty
  vertices: never[];
}

const RECORD_BYTES = 16; // x, y, z, reflectance — each a float32

export class KittiBinParser {
  async parse(data: Uint8Array, timingCallback?: (message: string) => void): Promise<KittiBinData> {
    const startTime = performance.now();
    timingCallback?.('🔍 KITTI BIN: Validating file size...');

    if (data.byteLength % RECORD_BYTES !== 0) {
      throw new Error(
        `Invalid KITTI BIN file: size ${data.byteLength} bytes is not a multiple of ${RECORD_BYTES} ` +
          `(4 × float32 for x, y, z, reflectance). This does not look like a KITTI BIN scan.`
      );
    }

    if (data.byteLength === 0) {
      throw new Error('Invalid KITTI BIN file: the scan is empty.');
    }

    const vertexCount = data.byteLength / RECORD_BYTES;

    // Float32Array requires a 4-byte-aligned byteOffset into the underlying
    // ArrayBuffer. When the incoming Uint8Array is a view into a larger
    // buffer (e.g. sliced from a postMessage transfer) at a misaligned
    // offset, copy the bytes first rather than risk a thrown RangeError.
    const aligned = data.byteOffset % 4 === 0 ? data : data.slice();
    const floats = new Float32Array(aligned.buffer, aligned.byteOffset, vertexCount * 4);

    const positions = new Float32Array(vertexCount * 3);
    const intensity = new Float32Array(vertexCount);

    for (let i = 0; i < vertexCount; i++) {
      const f4 = i * 4;
      const p3 = i * 3;
      const x = floats[f4];
      const y = floats[f4 + 1];
      const z = floats[f4 + 2];
      const reflectance = floats[f4 + 3];
      if (
        !Number.isFinite(x) ||
        !Number.isFinite(y) ||
        !Number.isFinite(z) ||
        !Number.isFinite(reflectance)
      ) {
        throw new Error(
          `Invalid KITTI BIN file: point ${i} contains a non-finite x, y, z or reflectance value.`
        );
      }
      positions[p3] = x;
      positions[p3 + 1] = y;
      positions[p3 + 2] = z;
      intensity[i] = reflectance;
    }

    const elapsed = (performance.now() - startTime).toFixed(1);
    timingCallback?.(
      `✅ KITTI BIN: parsed ${vertexCount.toLocaleString()} points in ${elapsed} ms`
    );

    return {
      vertexCount,
      hasColors: false,
      hasNormals: false,
      hasIntensity: true,
      format: 'kitti-bin',
      fileName: '',
      comments: [],
      detectedFormat: 'KITTI BIN',
      positionsArray: positions,
      colorsArray: null,
      normalsArray: null,
      intensityArray: intensity,
      scalarFields: { intensity },
      useTypedArrays: true,
      vertices: [],
    };
  }
}
