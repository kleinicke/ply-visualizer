import type { VolumeData } from '../parsers/nrrdParser';

export interface VolumeWindow {
  center: number;
  width: number;
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
