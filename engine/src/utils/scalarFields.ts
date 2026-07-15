import { SpatialData } from '../interfaces';

// Properties consumed by geometry/color/normal handling — everything else
// numeric is an "extra" scalar field the user can color by.
const CONSUMED_PROPS = new Set(['x', 'y', 'z', 'red', 'green', 'blue', 'alpha', 'nx', 'ny', 'nz']);

// Aliases already surfaced through the dedicated intensity color modes
// (keep in sync with PlyParser.intensityAliases / getIntensityArray).
const INTENSITY_ALIASES = new Set(['intensity', 'reflectivity', 'reflectance', 'remission']);

/**
 * True for a non-list vertex property that isn't position/color/normal and
 * isn't handled by the intensity pipeline — i.e. one worth collecting into
 * data.scalarFields during parsing.
 */
export function isExtraScalarProperty(name: string, type: string): boolean {
  if (type === 'list') {
    return false;
  }
  const normalized = name.toLowerCase();
  return !CONSUMED_PROPS.has(normalized) && !INTENSITY_ALIASES.has(normalized);
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
): Float32Array | null {
  const parsed = parseScalarColorMode(colorMode);
  if (!parsed) {
    return null;
  }
  return data.scalarFields?.[parsed.field] ?? null;
}
