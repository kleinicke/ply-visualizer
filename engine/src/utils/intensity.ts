import { SpatialData } from '../interfaces';

export function getIntensityArray(data: SpatialData): Float32Array | null {
  const direct = (data as any).intensityArray as Float32Array | null | undefined;
  if (direct) {
    return direct;
  }

  const scalarFields = (data as any).scalarFields as Record<string, Float32Array> | undefined;
  if (scalarFields) {
    return (
      scalarFields.intensity ||
      scalarFields.reflectivity ||
      scalarFields.reflectance ||
      scalarFields.remission ||
      null
    );
  }

  if ((data as any).hasIntensity && data.vertices?.length) {
    const values = new Float32Array(data.vertices.length);
    for (let i = 0; i < data.vertices.length; i++) {
      values[i] = data.vertices[i].intensity ?? 0;
    }
    (data as any).intensityArray = values;
    (data as any).scalarFields = {
      ...((data as any).scalarFields || {}),
      intensity: values,
    };
    return values;
  }

  return null;
}

export function hasIntensityData(data: SpatialData): boolean {
  return !!getIntensityArray(data);
}

/**
 * Colormap stops, flattened.
 *
 * Flat rather than nested because the mapping runs once per point: the previous
 * shape returned a fresh three-element array per call, so colouring an 8M-point
 * cloud allocated eight million throwaway arrays. Measured at 8M points, that
 * allocation was half the cost of the whole pass (116ms to 60ms without it) —
 * more than a WASM port could have saved, since the colours have to be copied
 * back out to a JavaScript array for Three.js either way.
 */
const VIRIDIS_STOPS = new Float64Array([
  0.267004, 0.004874, 0.329415, 0.282623, 0.140926, 0.457517, 0.253935, 0.265254, 0.529983,
  0.206756, 0.371758, 0.553117, 0.163625, 0.471133, 0.558148, 0.127568, 0.566949, 0.550556,
  0.134692, 0.658636, 0.517649, 0.266941, 0.748751, 0.440573, 0.477504, 0.821444, 0.318195,
  0.741388, 0.873449, 0.149561, 0.993248, 0.906157, 0.143936,
]);

const COLORS_STOPS = new Float64Array([0.0, 0.0, 1.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0, 0.0, 0.0]);

export function mapIntensityValue(
  value: number,
  mapName: 'grayscale' | 'viridis' | 'colors'
): [number, number, number] {
  if (mapName === 'grayscale') {
    return [value, value, value];
  }
  const stops = mapName === 'viridis' ? VIRIDIS_STOPS : COLORS_STOPS;
  const count = stops.length / 3;
  const scaled = value * (count - 1);
  let index = Math.floor(scaled);
  index = index < 0 ? 0 : index > count - 2 ? count - 2 : index;
  const t = scaled - index;
  const a = index * 3;
  const b = a + 3;
  return [
    stops[a] + (stops[b] - stops[a]) * t,
    stops[a + 1] + (stops[b + 1] - stops[a + 1]) * t,
    stops[a + 2] + (stops[b + 2] - stops[a + 2]) * t,
  ];
}

export function buildIntensityColorArrayForMode(
  values: Float32Array,
  pointCount: number,
  colorMode: string
): Float32Array {
  const mapName =
    colorMode === 'intensity-viridis'
      ? 'viridis'
      : colorMode === 'intensity-colors'
        ? 'colors'
        : 'grayscale';
  return buildScalarColorArray(values, pointCount, mapName);
}

/**
 * Map any scalar field to vertex colors, auto-normalized to the field's
 * finite min/max (non-finite values render at 0.75 like missing intensity).
 */
export function buildScalarColorArray(
  values: Float32Array,
  pointCount: number,
  mapName: 'grayscale' | 'viridis' | 'colors'
): Float32Array {
  const colors = new Float32Array(pointCount * 3);
  let min = Infinity;
  let max = -Infinity;

  for (let i = 0; i < pointCount && i < values.length; i++) {
    const value = values[i];
    if (Number.isFinite(value)) {
      if (value < min) {
        min = value;
      }
      if (value > max) {
        max = value;
      }
    }
  }

  const hasRange = Number.isFinite(min) && Number.isFinite(max) && max > min;
  const inverseRange = hasRange ? 1 / (max - min) : 0;

  // Written out rather than calling `mapIntensityValue` per point: this loop
  // re-runs on every colormap change over the whole cloud, and returning a
  // triple per point was allocating one array per point.
  const grayscale = mapName === 'grayscale';
  const stops = mapName === 'viridis' ? VIRIDIS_STOPS : COLORS_STOPS;
  const lastStop = stops.length / 3 - 1;

  for (let i = 0; i < pointCount; i++) {
    const value = i < values.length ? values[i] : 0;
    let normalized = hasRange && Number.isFinite(value) ? (value - min) * inverseRange : 0.75;
    normalized = normalized < 0 ? 0 : normalized > 1 ? 1 : normalized;

    const i3 = i * 3;
    if (grayscale) {
      colors[i3] = normalized;
      colors[i3 + 1] = normalized;
      colors[i3 + 2] = normalized;
      continue;
    }
    const scaled = normalized * lastStop;
    let index = Math.floor(scaled);
    index = index < 0 ? 0 : index > lastStop - 1 ? lastStop - 1 : index;
    const t = scaled - index;
    const a = index * 3;
    const b = a + 3;
    colors[i3] = stops[a] + (stops[b] - stops[a]) * t;
    colors[i3 + 1] = stops[a + 1] + (stops[b + 1] - stops[a + 1]) * t;
    colors[i3 + 2] = stops[a + 2] + (stops[b + 2] - stops[a + 2]) * t;
  }

  return colors;
}
