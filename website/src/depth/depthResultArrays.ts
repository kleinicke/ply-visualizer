import { DepthConversionResult, SpatialData } from '../interfaces';

export function colorsToUint8(colors: DepthConversionResult['colors']): Uint8Array | null {
  if (!colors) {
    return null;
  }

  if (colors instanceof Uint8Array) {
    return colors;
  }

  const out = new Uint8Array(colors.length);
  for (let i = 0; i < colors.length; i++) {
    out[i] = Math.round(colors[i] * 255);
  }
  return out;
}

export function applyDepthResultTypedArrays(
  spatialData: SpatialData,
  result: DepthConversionResult
): void {
  spatialData.vertices = [];
  spatialData.vertexCount = result.pointCount;
  spatialData.hasColors = !!result.colors;
  spatialData.useTypedArrays = true;
  spatialData.positionsArray = result.vertices;
  spatialData.colorsArray = colorsToUint8(result.colors);
  spatialData.normalsArray = null;
  spatialData.intensityArray = null;
  spatialData.scalarFields = {};
}
