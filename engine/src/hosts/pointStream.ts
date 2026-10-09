/**
 * Point clouds that arrive in parts while the host is still parsing.
 *
 * The extension host parses large text clouds on several threads
 * (src/providerHandlers/parallelTextParse.ts). Sending the whole cloud only
 * after the last thread finished left the copy into the webview - a few
 * hundred milliseconds for eight million points - waiting behind the parse.
 * Instead each finished slice is posted at once, in file order, and the
 * closing message carries everything else. The parts are joined here, once,
 * into the arrays the ordinary point-data path expects.
 */

export interface PointStreamPart {
  positions: Float32Array;
  colors?: Uint8Array | null;
  normals?: Float32Array | null;
  intensity?: Float32Array | null;
}

export interface PointStreamArrays {
  positionsArray: Float32Array;
  colorsArray: Uint8Array | null;
  normalsArray: Float32Array | null;
  intensityArray: Float32Array | null;
}

const streams = new Map<string, PointStreamPart[]>();

/** Keep one part; the first part of an id opens its stream. */
export function addPointStreamPart(streamId: string, part: PointStreamPart): void {
  let parts = streams.get(streamId);
  if (!parts) {
    parts = [];
    streams.set(streamId, parts);
  }
  parts.push(part);
}

/** Drop a stream the host abandoned (it fell back to another parser). */
export function cancelPointStream(streamId: string): void {
  streams.delete(streamId);
}

function join<T extends Float32Array | Uint8Array>(
  parts: PointStreamPart[],
  pick: (part: PointStreamPart) => T | null | undefined,
  make: (length: number) => T
): T | null {
  const present = parts.map(pick);
  if (present.length === 0 || present.some(array => !array)) {
    return null;
  }
  if (present.length === 1) {
    return present[0]!;
  }
  const out = make(present.reduce((sum, array) => sum + array!.length, 0));
  let offset = 0;
  for (const array of present) {
    out.set(array!, offset);
    offset += array!.length;
  }
  return out;
}

/**
 * The joined arrays of a finished stream, which is then forgotten. Null when
 * no part arrived under this id (an empty cloud sends none).
 */
export function finishPointStream(streamId: string): PointStreamArrays | null {
  const parts = streams.get(streamId);
  streams.delete(streamId);
  if (!parts) {
    return null;
  }
  return {
    positionsArray: join(
      parts,
      part => part.positions,
      n => new Float32Array(n)
    )!,
    colorsArray: join(
      parts,
      part => part.colors,
      n => new Uint8Array(n)
    ),
    normalsArray: join(
      parts,
      part => part.normals,
      n => new Float32Array(n)
    ),
    intensityArray: join(
      parts,
      part => part.intensity,
      n => new Float32Array(n)
    ),
  };
}
