import * as THREE from 'three';
import type { E57EmbeddedImage } from '../interfaces';

/**
 * Optional alignment fix for E57 embedded imagery.
 *
 * The projection itself follows the E57 spec exactly (libe57.org/bestCoordinates.html:
 * spherical `Ximage = imageWidth/2 - θ/pixelWidth`, pinhole
 * `Ximage = principalPointX - (x/z)(focalLength/pixelWidth)`), and files that honour it
 * need nothing here. Several do not, and the deviations we can measure against a
 * cloud's own RGB are consistent per representation:
 *
 * - spherical: Station018.e57 sits exactly 90 degrees off (mean squared colour
 *   error 1,806 at -90 versus 33,686 at 0, and half a degree away already costs 50%).
 * - pinhole: openpitmine.e57 is flipped top-to-bottom, i.e. the rows run the
 *   opposite way from the spec's "(0,0) is the top, left corner" (error 1,278 -> 168).
 *
 * Neither is universal, so this stays a user-facing correction with those
 * defaults rather than a change to the projection. It is applied to the drawn
 * image planes and to the colours sampled for the points, so both agree.
 */
export interface E57ImageCorrection {
  enabled: boolean;
  /** Rotation about the image's vertical axis, degrees. Panoramas only. */
  azimuthDegrees: number;
  /** Mirror the image top-to-bottom. Pinhole only. */
  flipVertical: boolean;
  /** Mirror the image left-to-right. Pinhole only. */
  flipHorizontal: boolean;
}

export const DEFAULT_E57_IMAGE_CORRECTION: E57ImageCorrection = {
  enabled: true,
  azimuthDegrees: -90,
  flipVertical: true,
  flipHorizontal: false,
};

export function normalizeE57ImageCorrection(
  value: Partial<E57ImageCorrection> | undefined
): E57ImageCorrection {
  return { ...DEFAULT_E57_IMAGE_CORRECTION, ...(value ?? {}) };
}

export function e57ImageCorrectionEquals(a: E57ImageCorrection, b: E57ImageCorrection): boolean {
  return (
    a.enabled === b.enabled &&
    a.azimuthDegrees === b.azimuthDegrees &&
    a.flipVertical === b.flipVertical &&
    a.flipHorizontal === b.flipHorizontal
  );
}

/** The part of a correction that applies to one image's representation. */
interface ResolvedCorrection {
  azimuth: number;
  flipX: boolean;
  flipY: boolean;
}

function resolve(
  correction: E57ImageCorrection,
  representation: E57EmbeddedImage['representation']
): ResolvedCorrection {
  if (!correction.enabled) {
    return { azimuth: 0, flipX: false, flipY: false };
  }
  // Azimuth is meaningless for a pinhole frame and mirroring a panorama would
  // break its wrap, so each representation only takes the fix that fits it.
  if (representation === 'pinhole') {
    return { azimuth: 0, flipX: correction.flipHorizontal, flipY: correction.flipVertical };
  }
  return {
    azimuth: THREE.MathUtils.degToRad(correction.azimuthDegrees),
    flipX: false,
    flipY: false,
  };
}

export function isCorrectionActiveFor(
  correction: E57ImageCorrection,
  representation: E57EmbeddedImage['representation']
): boolean {
  const resolved = resolve(correction, representation);
  return resolved.azimuth !== 0 || resolved.flipX || resolved.flipY;
}

/**
 * Corrects a ray unprojected from a pixel, i.e. the display direction.
 * Mirrors are self-inverse; the rotation runs opposite to the projection side.
 */
export function correctUnprojectedRay(
  point: THREE.Vector3,
  correction: E57ImageCorrection,
  representation: E57EmbeddedImage['representation']
): THREE.Vector3 {
  const { azimuth, flipX, flipY } = resolve(correction, representation);
  if (flipX) {
    point.x = -point.x;
  }
  if (flipY) {
    point.y = -point.y;
  }
  if (azimuth !== 0) {
    point.applyAxisAngle(new THREE.Vector3(0, 0, 1), -azimuth);
  }
  return point;
}

/**
 * The same correction for the projection direction, as a matrix applied to a
 * point already in the image frame. Used when sampling colours for points, so
 * they land where the drawn plane says they should.
 */
export function correctionMatrixForProjection(
  correction: E57ImageCorrection,
  representation: E57EmbeddedImage['representation']
): THREE.Matrix4 {
  const { azimuth, flipX, flipY } = resolve(correction, representation);
  const matrix = new THREE.Matrix4();
  if (flipX || flipY) {
    matrix.multiply(new THREE.Matrix4().makeScale(flipX ? -1 : 1, flipY ? -1 : 1, 1));
  }
  if (azimuth !== 0) {
    matrix.premultiply(new THREE.Matrix4().makeRotationZ(azimuth));
  }
  return matrix;
}

export function describeE57ImageCorrection(
  correction: E57ImageCorrection,
  representation: E57EmbeddedImage['representation']
): string {
  if (!correction.enabled) {
    return 'off — E57 pose and projection used exactly as stored';
  }
  const { azimuth, flipX, flipY } = resolve(correction, representation);
  const parts: string[] = [];
  if (azimuth !== 0) {
    const degrees = THREE.MathUtils.radToDeg(azimuth);
    parts.push(`${degrees > 0 ? '+' : ''}${degrees.toFixed(1)}° azimuth`);
  }
  if (flipY) {
    parts.push('flipped vertically');
  }
  if (flipX) {
    parts.push('flipped horizontally');
  }
  return parts.length ? parts.join(', ') : 'on, but nothing to change for this representation';
}
