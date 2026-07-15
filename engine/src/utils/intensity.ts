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

export function mapIntensityValue(
  value: number,
  mapName: 'grayscale' | 'viridis' | 'colors'
): [number, number, number] {
  if (mapName === 'grayscale') {
    return [value, value, value];
  }

  const viridis: [number, number, number][] = [
    [0.267004, 0.004874, 0.329415],
    [0.282623, 0.140926, 0.457517],
    [0.253935, 0.265254, 0.529983],
    [0.206756, 0.371758, 0.553117],
    [0.163625, 0.471133, 0.558148],
    [0.127568, 0.566949, 0.550556],
    [0.134692, 0.658636, 0.517649],
    [0.266941, 0.748751, 0.440573],
    [0.477504, 0.821444, 0.318195],
    [0.741388, 0.873449, 0.149561],
    [0.993248, 0.906157, 0.143936],
  ];

  const colors: [number, number, number][] = [
    [0.0, 0.0, 1.0],
    [0.0, 1.0, 0.0],
    [1.0, 1.0, 0.0],
    [1.0, 0.0, 0.0],
  ];

  const stops = mapName === 'viridis' ? viridis : colors;
  const scaled = value * (stops.length - 1);
  const index = Math.min(stops.length - 2, Math.max(0, Math.floor(scaled)));
  const t = scaled - index;
  const a = stops[index];
  const b = stops[index + 1];
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
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
      min = Math.min(min, value);
      max = Math.max(max, value);
    }
  }

  const hasRange = Number.isFinite(min) && Number.isFinite(max) && max > min;

  for (let i = 0; i < pointCount; i++) {
    const value = i < values.length ? values[i] : 0;
    const normalized = hasRange && Number.isFinite(value) ? (value - min) / (max - min) : 0.75;
    const clamped = Math.min(1, Math.max(0, normalized));
    const [r, g, b] = mapIntensityValue(clamped, mapName);
    const i3 = i * 3;
    colors[i3] = r;
    colors[i3 + 1] = g;
    colors[i3 + 2] = b;
  }

  return colors;
}
