import type { SpatialData } from './interfaces';
import { getColorName, getRecoloredColors } from './colorMode';
import { getExtraScalarFieldNames } from './utils/scalarFields';

export interface PointCloudColorOption {
  value: string;
  label: string;
}

export interface PointCloudColorOptionsHost {
  fileColors: { length: number };
  hasIntensityData(data: SpatialData): boolean;
}

export function hasProjectedSourceColor(data: SpatialData): boolean {
  return !!data.metadata?.stonexRawColors || !!data.metadata?.e57PhotographicallyColoredPoints;
}

/** The exact choices shown by one point-cloud row. */
export function getPointCloudColorOptions(
  host: PointCloudColorOptionsHost,
  data: SpatialData,
  fileIndex: number,
  includeUnavailableOriginal = false
): PointCloudColorOption[] {
  const options: PointCloudColorOption[] = [];

  if (data.hasColors || includeUnavailableOriginal) {
    options.push({
      value: 'original',
      label: hasProjectedSourceColor(data) ? 'Camera colour (projected)' : 'Original',
    });
  }
  if (getRecoloredColors(data)) {
    options.push({ value: 'recolored', label: 'Camera (all stations)' });
  }
  if (host.hasIntensityData(data)) {
    options.push(
      { value: 'intensity', label: 'Intensity' },
      { value: 'intensity-viridis', label: 'Intensity (Viridis)' },
      { value: 'intensity-colors', label: 'Intensity (Colors)' }
    );
  }
  for (const fieldName of getExtraScalarFieldNames(data)) {
    options.push(
      { value: `scalar:${fieldName}:viridis`, label: `${fieldName} (Viridis)` },
      { value: `scalar:${fieldName}:grayscale`, label: `${fieldName} (Gray)` }
    );
  }

  options.push({ value: 'assigned', label: `Assigned (${getColorName(fileIndex)})` });
  for (let colorIndex = 0; colorIndex < host.fileColors.length; colorIndex++) {
    options.push({ value: colorIndex.toString(), label: getColorName(colorIndex) });
  }
  return options;
}
