import { ScalarArray, SpatialData } from '../interfaces';

// Properties consumed by geometry/color/normal handling — everything else
// numeric is an "extra" scalar field the user can color by.
const CONSUMED_PROPS = new Set(['x', 'y', 'z', 'red', 'green', 'blue', 'alpha', 'nx', 'ny', 'nz']);

// Aliases already surfaced through the dedicated intensity color modes
// (keep in sync with PlyParser.intensityAliases / getIntensityArray).
const INTENSITY_ALIASES = new Set(['intensity', 'reflectivity', 'reflectance', 'remission']);

// 3D Gaussian Splatting: degree-0 spherical-harmonics basis constant. Color
// channel = 0.5 + SH_C0 * f_dc_i (INRIA reference implementation).
export const SH_C0 = 0.28209479177387814;

/** Convert one SH DC coefficient to an 8-bit color channel. */
export function shDcToU8(v: number): number {
  const c = (0.5 + SH_C0 * v) * 255;
  return c <= 0 ? 0 : c >= 255 ? 255 : Math.round(c);
}

/**
 * True when vertex property names follow the 3D Gaussian Splatting PLY layout
 * (INRIA reference implementation and its exporters: gsplat, Nerfstudio,
 * SuperSplat): color lives in f_dc_0..2 instead of red/green/blue. Explicit
 * rgb wins when a file carries both.
 */
export function isGaussianSplatLayout(propNames: string[]): boolean {
  let dc = 0;
  for (const raw of propNames) {
    const name = raw.toLowerCase();
    if (name === 'red' || name === 'green' || name === 'blue') {
      return false;
    }
    if (name === 'f_dc_0' || name === 'f_dc_1' || name === 'f_dc_2') {
      dc++;
    }
  }
  return dc === 3;
}

/**
 * Splat properties that must not become scalar fields: f_dc_* is consumed as
 * the color source, rot_* is meaningless as a per-point scalar, and f_rest_*
 * (45 properties at SH degree 3) would allocate a Float32Array each — ~180 MB
 * of useless fields for a 1M-splat file. opacity and scale_0..2 stay: coloring
 * by them is genuinely useful (e.g. spotting floaters by opacity).
 */
export function isSplatConsumedProperty(name: string): boolean {
  const n = name.toLowerCase();
  return n.startsWith('f_dc_') || n.startsWith('f_rest_') || n.startsWith('rot_');
}

/**
 * True for a non-list vertex property that isn't position/color/normal and
 * isn't handled by the intensity pipeline — i.e. one worth collecting into
 * data.scalarFields during parsing. Pass gaussianSplat=true for files with
 * the 3DGS layout so SH/rotation properties are excluded too.
 */
export function isExtraScalarProperty(name: string, type: string, gaussianSplat = false): boolean {
  if (type === 'list') {
    return false;
  }
  const normalized = name.toLowerCase();
  return (
    !CONSUMED_PROPS.has(normalized) &&
    !INTENSITY_ALIASES.has(normalized) &&
    !(gaussianSplat && isSplatConsumedProperty(normalized))
  );
}

/** Field names offered as scalar color modes for a loaded file. */
export function getExtraScalarFieldNames(data: SpatialData): string[] {
  const fields = data.scalarFields;
  if (!fields) {
    return [];
  }
  return Object.keys(fields).filter(name => !INTENSITY_ALIASES.has(name.toLowerCase()));
}

/**
 * Color modes of the form `scalar:<field>:<map>`. Field names come from PLY
 * headers; they can't contain whitespace but may contain anything else except
 * the ':' separator (unheard of in practice).
 */
export function parseScalarColorMode(
  colorMode: string
): { field: string; map: 'grayscale' | 'viridis' | 'colors' } | null {
  if (!colorMode.startsWith('scalar:')) {
    return null;
  }
  const sep = colorMode.lastIndexOf(':');
  const field = colorMode.slice('scalar:'.length, sep);
  const map = colorMode.slice(sep + 1);
  if (!field || (map !== 'grayscale' && map !== 'viridis' && map !== 'colors')) {
    return null;
  }
  return { field, map };
}

export function getScalarFieldForColorMode(
  data: SpatialData,
  colorMode: string
): ScalarArray | null {
  const parsed = parseScalarColorMode(colorMode);
  if (!parsed) {
    return null;
  }
  return data.scalarFields?.[parsed.field] ?? null;
}

/**
 * Store each scalar field at the narrowest type that holds it exactly.
 *
 * Decoders hand every extra field over as Float32, but most lidar attributes
 * are small whole numbers: LAS classification, return number, number of
 * returns, user data (0-255), point source ID (0-65535), scan angle rank.
 * Kept as floats they cost four bytes a point each - for a LAS file more than
 * the positions and colours together. A field whose every value is a finite
 * integer in range becomes Uint8, Uint16 or Int16; the values are unchanged,
 * so colour modes, legends and exports read the same numbers. Intensity stays
 * Float32: the intensity modes and depth tools read it as floats.
 */
export function compactScalarFields(
  fields: Record<string, ScalarArray> | undefined
): Record<string, ScalarArray> | undefined {
  if (!fields) {
    return fields;
  }
  for (const [name, values] of Object.entries(fields)) {
    if (!(values instanceof Float32Array) || INTENSITY_ALIASES.has(name.toLowerCase())) {
      continue;
    }
    let min = Infinity;
    let max = -Infinity;
    let whole = true;
    for (let i = 0; i < values.length; i++) {
      const value = values[i];
      if (!Number.isInteger(value)) {
        whole = false;
        break;
      }
      if (value < min) {
        min = value;
      }
      if (value > max) {
        max = value;
      }
    }
    if (!whole || values.length === 0) {
      continue;
    }
    // In range, so the typed-array conversion copies every value exactly.
    if (min >= 0 && max <= 255) {
      fields[name] = new Uint8Array(values);
    } else if (min >= 0 && max <= 65535) {
      fields[name] = new Uint16Array(values);
    } else if (min >= -32768 && max <= 32767) {
      fields[name] = new Int16Array(values);
    }
  }
  return fields;
}

/**
 * Scalar fields cross postMessage as bare buffers, so the array type travels
 * beside them: a compacted classification field is a Uint8Array, and reading
 * its buffer as floats would be garbage (or throw, for a length not divisible
 * by four).
 */
const SCALAR_ARRAY_TYPES = { Float32Array, Uint8Array, Uint16Array, Int16Array };
export type ScalarArrayType = keyof typeof SCALAR_ARRAY_TYPES;

export function scalarArrayType(values: ScalarArray): ScalarArrayType {
  return values instanceof Uint8Array
    ? 'Uint8Array'
    : values instanceof Uint16Array
      ? 'Uint16Array'
      : values instanceof Int16Array
        ? 'Int16Array'
        : 'Float32Array';
}

export function scalarArrayTypes(
  fields: Record<string, ScalarArray> | undefined
): Record<string, ScalarArrayType> {
  return Object.fromEntries(
    Object.entries(fields ?? {}).map(([name, values]) => [name, scalarArrayType(values)])
  );
}

function scalarConstructor(type: string | undefined) {
  return SCALAR_ARRAY_TYPES[(type ?? 'Float32Array') as ScalarArrayType] ?? Float32Array;
}

/** View a transferred buffer as the type it was sent as (floats when unnamed). */
export function scalarArrayFromBuffer(buffer: ArrayBuffer, type?: string): ScalarArray {
  return new (scalarConstructor(type))(buffer);
}

/** An empty field of the named type, for assembling chunks. */
export function allocateScalarArray(type: string | undefined, length: number): ScalarArray {
  return new (scalarConstructor(type))(length);
}
