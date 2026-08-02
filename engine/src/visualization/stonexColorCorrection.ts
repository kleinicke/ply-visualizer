/**
 * Post-load colour correction for Stonex X300 photographic colour.
 *
 * The X3A parser decodes the GRBG sensor into *raw* RGB and keeps the white
 * balance / exposure decision out of the pixels. Everything here is a per-frame
 * channel multiply, so switching modes is one O(n) pass over the colour array
 * with no reprojection and no re-parse.
 *
 * Green is the reference channel: the raw sensor is green-heavy, so red and
 * blue gains are normally >= 1 and green is left alone unless exposure moves it.
 */

/** Sentinel in the per-point frame index for points no camera frame coloured. */
export const STONEX_NO_FRAME = 0xffff;

export interface StonexFrameCalibration {
  type: 'U' | 'D';
  /** Per-frame gray-world gains measured on the raw Bayer plane. */
  grayRedGain: number;
  grayBlueGain: number;
  /** Mean green level of the frame; the exposure proxy. */
  meanGreen: number;
}

export interface StonexBandGains {
  redGain: number;
  blueGain: number;
}

export interface StonexColorCalibration {
  frames: StonexFrameCalibration[];
  /** Reference-patch gains, one pair per camera band. */
  bandGains: Partial<Record<'U' | 'D', StonexBandGains>>;
  /** Median of `frames[].meanGreen`, the exposure-matching target. */
  targetGreen: number;
}

export type StonexWhiteBalanceMode = 'off' | 'per-frame' | 'band' | 'manual';
export type StonexExposureMode = 'off' | 'match' | 'manual';
/** How to handle channels that exceed 255 after gain. */
export type StonexHighlightMode = 'clip' | 'preserve-hue';

export interface StonexColorCorrection {
  whiteBalance: StonexWhiteBalanceMode;
  exposure: StonexExposureMode;
  highlight: StonexHighlightMode;
  manualRedGain: number;
  manualBlueGain: number;
  exposureStops: number;
}

/** Matches the behaviour shipped before correction was switchable. */
export const DEFAULT_STONEX_COLOR_CORRECTION: StonexColorCorrection = {
  whiteBalance: 'band',
  exposure: 'off',
  highlight: 'clip',
  manualRedGain: 1,
  manualBlueGain: 1,
  exposureStops: 0,
};

export function normalizeStonexColorCorrection(
  value: Partial<StonexColorCorrection> | undefined
): StonexColorCorrection {
  return { ...DEFAULT_STONEX_COLOR_CORRECTION, ...(value ?? {}) };
}

function median(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const middle = sorted.length >> 1;
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) * 0.5 : sorted[middle];
}

export function buildStonexColorCalibration(
  frames: StonexFrameCalibration[],
  bandGains: Partial<Record<'U' | 'D', StonexBandGains>>
): StonexColorCalibration {
  return {
    frames,
    bandGains,
    targetGreen: median(frames.map(frame => frame.meanGreen).filter(value => value > 0)),
  };
}

/**
 * Per-frame [red, green, blue] multipliers for the given settings.
 * Length is `calibration.frames.length * 3`.
 */
export function computeStonexFrameMultipliers(
  calibration: StonexColorCalibration,
  settings: StonexColorCorrection
): Float32Array {
  const multipliers = new Float32Array(calibration.frames.length * 3);
  const exposureScale = settings.exposure === 'manual' ? Math.pow(2, settings.exposureStops) : 1;

  for (let index = 0; index < calibration.frames.length; index++) {
    const frame = calibration.frames[index];
    let redGain = 1;
    let blueGain = 1;

    switch (settings.whiteBalance) {
      case 'per-frame':
        redGain = frame.grayRedGain;
        blueGain = frame.grayBlueGain;
        break;
      case 'band': {
        const band = calibration.bandGains[frame.type];
        redGain = band?.redGain ?? frame.grayRedGain;
        blueGain = band?.blueGain ?? frame.grayBlueGain;
        break;
      }
      case 'manual':
        redGain = settings.manualRedGain;
        blueGain = settings.manualBlueGain;
        break;
      case 'off':
        break;
    }

    // Exposure lifts all three channels together so it cannot shift hue.
    let exposure = exposureScale;
    if (settings.exposure === 'match' && frame.meanGreen > 0 && calibration.targetGreen > 0) {
      exposure = calibration.targetGreen / frame.meanGreen;
    }

    const offset = index * 3;
    multipliers[offset] = redGain * exposure;
    multipliers[offset + 1] = exposure;
    multipliers[offset + 2] = blueGain * exposure;
  }
  return multipliers;
}

function writeCorrected(
  out: Uint8Array,
  offset: number,
  red: number,
  green: number,
  blue: number,
  preserveHue: boolean
): void {
  if (preserveHue) {
    // Scaling all three by the same factor keeps the hue of blown highlights,
    // instead of clipping red and blue first and leaving a green cast.
    const peak = Math.max(red, green, blue);
    if (peak > 255) {
      const scale = 255 / peak;
      red *= scale;
      green *= scale;
      blue *= scale;
    }
  }
  out[offset] = red < 0 ? 0 : red > 255 ? 255 : Math.round(red);
  out[offset + 1] = green < 0 ? 0 : green > 255 ? 255 : Math.round(green);
  out[offset + 2] = blue < 0 ? 0 : blue > 255 ? 255 : Math.round(blue);
}

/**
 * Apply per-frame multipliers to a raw point-colour array.
 * `out` may alias nothing else; passing the live `colorsArray` mutates the
 * buffer the GPU attribute already shares, so only `needsUpdate` is required.
 */
export function applyStonexColorCorrectionToPoints(
  raw: Uint8Array,
  frameIndex: Uint16Array,
  multipliers: Float32Array,
  settings: StonexColorCorrection,
  out: Uint8Array
): void {
  const preserveHue = settings.highlight === 'preserve-hue';
  const pointCount = frameIndex.length;
  const frameCount = multipliers.length / 3;

  for (let point = 0; point < pointCount; point++) {
    const offset = point * 3;
    const frame = frameIndex[point];
    if (frame >= frameCount) {
      // Uncoloured points keep the parser's neutral fill.
      out[offset] = raw[offset];
      out[offset + 1] = raw[offset + 1];
      out[offset + 2] = raw[offset + 2];
      continue;
    }
    const gain = frame * 3;
    writeCorrected(
      out,
      offset,
      raw[offset] * multipliers[gain],
      raw[offset + 1] * multipliers[gain + 1],
      raw[offset + 2] * multipliers[gain + 2],
      preserveHue
    );
  }
}

/** Apply one frame's multipliers to that frame's raw RGBA preview thumbnail. */
export function applyStonexColorCorrectionToPreview(
  rawRgba: Uint8Array,
  multipliers: Float32Array,
  frameIndex: number,
  settings: StonexColorCorrection,
  out: Uint8Array
): void {
  const preserveHue = settings.highlight === 'preserve-hue';
  const gain = frameIndex * 3;
  const redMultiplier = multipliers[gain] ?? 1;
  const greenMultiplier = multipliers[gain + 1] ?? 1;
  const blueMultiplier = multipliers[gain + 2] ?? 1;

  for (let offset = 0; offset + 3 < rawRgba.length; offset += 4) {
    writeCorrected(
      out,
      offset,
      rawRgba[offset] * redMultiplier,
      rawRgba[offset + 1] * greenMultiplier,
      rawRgba[offset + 2] * blueMultiplier,
      preserveHue
    );
    out[offset + 3] = rawRgba[offset + 3];
  }
}
