import type { VolumeData } from '../parsers/nrrdParser';

export interface VolumeWindow {
  center: number;
  width: number;
}

export interface VolumeValueRange {
  min: number;
  max: number;
}

export type VolumeBrightnessMode = 'slice-auto' | 'dicom-window' | 'volume-range';

export interface VolumeBrightnessRequest {
  brightnessMode?: VolumeBrightnessMode;
  windowCenter?: number;
  windowWidth?: number;
  volumeRange?: VolumeValueRange;
  sliceRanges?: readonly VolumeValueRange[];
}

/** The 2D image viewer defaults DICOM to actual min/max normalization per image. */
export function defaultVolumeBrightnessMode(volume: VolumeData): VolumeBrightnessMode {
  return volume.header['dicom series number'] || volume.header['modality']
    ? 'slice-auto'
    : 'dicom-window';
}

/** Actual scalar range of each original k layer, matching the 2D image viewer. */
export function volumeSliceRanges(volume: VolumeData): VolumeValueRange[] {
  const [nx, ny, nz] = volume.sizes;
  const sliceSize = nx * ny;
  return Array.from({ length: nz }, (_, k) => {
    let min = Infinity;
    let max = -Infinity;
    const end = (k + 1) * sliceSize;
    for (let index = k * sliceSize; index < end; index++) {
      const value = volume.samples[index];
      if (!Number.isFinite(value)) {continue;}
      if (value < min) {min = value;}
      if (value > max) {max = value;}
    }
    return Number.isFinite(min) && Number.isFinite(max) ? { min, max } : { min: 0, max: 1 };
  });
}

/** Resolve the DICOM/NRRD presentation window, falling back to the sample range. */
export function resolveVolumeWindow(
  volume: VolumeData,
  fallbackRange: { min: number; max: number }
): VolumeWindow {
  const declaredCenter = Number(volume.header['window center']);
  const declaredWidth = Number(volume.header['window width']);
  return {
    center: Number.isFinite(declaredCenter)
      ? declaredCenter
      : (fallbackRange.min + fallbackRange.max) / 2,
    width:
      Number.isFinite(declaredWidth) && declaredWidth > 0
        ? declaredWidth
        : Math.max(Number.EPSILON, fallbackRange.max - fallbackRange.min),
  };
}

/** Map one original single-channel voxel value to the displayed 8-bit grey. */
export function volumeGreyByte(
  value: number,
  windowCenter: number,
  windowWidth: number,
  photometricInterpretation = 'MONOCHROME2'
): number {
  const width = Math.max(Number.EPSILON, windowWidth);
  const low = windowCenter - width / 2;
  let mapped = Math.max(0, Math.min(1, (value - low) / width));
  if (photometricInterpretation.trim().toUpperCase() === 'MONOCHROME1') {
    mapped = 1 - mapped;
  }
  return Math.round(mapped * 255);
}

/** Map a voxel using the selected presentation without changing its scalar value. */
export function volumeGreyByteForSlice(
  value: number,
  k: number,
  request: VolumeBrightnessRequest,
  photometricInterpretation = 'MONOCHROME2'
): number {
  const mode = request.brightnessMode ?? 'dicom-window';
  if (mode === 'dicom-window') {
    return volumeGreyByte(
      value,
      request.windowCenter ?? 0,
      request.windowWidth ?? 1,
      photometricInterpretation
    );
  }

  const range =
    mode === 'slice-auto' ? request.sliceRanges?.[k] : request.volumeRange;
  if (!range || !Number.isFinite(range.min) || !Number.isFinite(range.max)) {
    return volumeGreyByte(
      value,
      request.windowCenter ?? 0,
      request.windowWidth ?? 1,
      photometricInterpretation
    );
  }
  const width = range.max - range.min;
  // The 2D viewer renders a constant-valued image as black after auto
  // normalization, including MONOCHROME1 images.
  if (!(width > 0)) {return 0;}
  let mapped = Math.max(0, Math.min(1, (value - range.min) / width));
  if (photometricInterpretation.trim().toUpperCase() === 'MONOCHROME1') {
    mapped = 1 - mapped;
  }
  return Math.round(mapped * 255);
}
