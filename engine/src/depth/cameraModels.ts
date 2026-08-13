import type { CameraModel } from './types';
import { projectCameraRayWasmSync, unprojectCameraPixelWasmSync } from './readers/tiffWasm';

export const CAMERA_MODEL_COEFFICIENTS: Readonly<Record<CameraModel, readonly string[]>> = {
  'pinhole-ideal': [],
  'pinhole-opencv': [
    'k1',
    'k2',
    'p1',
    'p2',
    'k3',
    'k4',
    'k5',
    'k6',
    's1',
    's2',
    's3',
    's4',
    'tauX',
    'tauY',
  ],
  'fisheye-equidistant': [],
  'fisheye-opencv': ['k1', 'k2', 'k3', 'k4'],
  'fisheye-kb3': ['k0', 'k1', 'k2', 'k3'],
  fisheye624: ['k0', 'k1', 'k2', 'k3', 'k4', 'k5', 'p0', 'p1', 's0', 's1', 's2', 's3'],
  'e57-pinhole': [],
  'e57-spherical': [],
  'e57-cylindrical': [],
};

export interface CameraModelParameters {
  cameraModel: CameraModel;
  fx: number;
  fy?: number;
  cx?: number;
  cy?: number;
  /** Coefficients in the exact model-specific order declared above. */
  coefficients?: readonly number[];
  /** True when input pixels were already rectified and distortion must not be applied. */
  imageRectified?: boolean;
}

/**
 * Coefficient-list lengths the kernel accepts, per model. OpenCV's pinhole is
 * the only one with a choice: its 4, 5, 8, 12 and 14 coefficient layouts are
 * all valid, and a shorter list means the higher terms are zero.
 */
const ACCEPTED_COEFFICIENT_COUNTS: Readonly<Record<CameraModel, readonly number[]>> = {
  'pinhole-ideal': [0],
  'pinhole-opencv': [4, 5, 8, 12, 14],
  'fisheye-equidistant': [0],
  'fisheye-opencv': [4],
  'fisheye-kb3': [4],
  fisheye624: [12],
  'e57-pinhole': [0],
  'e57-spherical': [0],
  'e57-cylindrical': [0],
};

/**
 * Makes a coefficient list one the model actually accepts.
 *
 * The UI keeps distortion values across a change of camera model — switching
 * from OpenCV fisheye to ideal pinhole leaves four k's behind — and the kernel
 * refuses a list whose length does not match the model. That used to be
 * invisible: the projection failed and a JavaScript fallback silently produced
 * an undistorted result instead. With no fallback left it is an error, so the
 * list is fitted here, where the model is known, rather than passed on and
 * rejected: a model that takes no coefficients gets none, and a short or long
 * list is padded with zeros or truncated to the nearest accepted length.
 */
export function fitCoefficientsToModel(
  model: CameraModel,
  coefficients: readonly number[]
): number[] {
  const accepted = ACCEPTED_COEFFICIENT_COUNTS[model] ?? [0];
  if (accepted.includes(coefficients.length)) {
    return [...coefficients];
  }
  const target =
    accepted.find(count => count >= coefficients.length) ?? accepted[accepted.length - 1];
  const fitted = coefficients.slice(0, target).map(value => (Number.isFinite(value) ? value : 0));
  while (fitted.length < target) {
    fitted.push(0);
  }
  return fitted;
}

export function cameraCoefficientsFromParameters(
  params: CameraModelParameters & Record<string, any>
): number[] {
  return resolveCameraModel(params).coefficients;
}

export interface CameraSolveResult<T extends readonly number[]> {
  value: T;
  valid: boolean;
  converged: boolean;
  iterations: number;
}

/**
 * The undistorted model each distorted one collapses to when every coefficient
 * is zero. Exact, not an approximation: with zero coefficients the OpenCV
 * pinhole distortion is the identity, and the fisheye radial polynomial reduces
 * to `radius = theta`, which is the equidistant model by definition.
 */
const UNDISTORTED_EQUIVALENT: Readonly<Partial<Record<CameraModel, CameraModel>>> = {
  'pinhole-opencv': 'pinhole-ideal',
  'fisheye-opencv': 'fisheye-equidistant',
  'fisheye-kb3': 'fisheye-equidistant',
  fisheye624: 'fisheye-equidistant',
};

/**
 * The model and coefficients the kernel should actually be given.
 *
 * Two reductions happen here, and both matter for speed as much as for
 * correctness:
 *
 * 1. A rectified image has had its distortion removed already, so it is an
 *    ideal pinhole whatever the file says.
 * 2. **All-zero coefficients mean no distortion**, so the distorted model is
 *    replaced by its undistorted equivalent. This is not a nicety: the
 *    distorted models have no closed-form unprojection, so every pixel runs a
 *    Newton solve, and a 5120x5120 depth image at `fisheye624` with twelve
 *    zeros spent about twenty seconds iterating — much of it on pixels outside
 *    the model domain, which only fail after exhausting their iterations — to
 *    produce exactly what the equidistant closed form gives immediately.
 */
export function resolveCameraModel(params: CameraModelParameters & Record<string, any>): {
  model: CameraModel;
  coefficients: number[];
} {
  if (params.imageRectified) {
    return { model: 'pinhole-ideal', coefficients: [] };
  }
  const declared = params.cameraModel;
  const coefficients = coefficientsForModel(declared, params);
  if (coefficients.every(value => value === 0)) {
    const undistorted = UNDISTORTED_EQUIVALENT[declared];
    if (undistorted) {
      return { model: undistorted, coefficients: [] };
    }
  }
  // Fisheye624 carrying only its first four radial terms *is* Kannala-Brandt:
  // the radial polynomial is the same one with two further terms, and the
  // tangential and thin-prism parts are what the extra six coefficients are
  // for. Saying so costs a third of the time, because the radial inversion is
  // a bisection over up to 512 steps and each one evaluates the polynomial —
  // six terms instead of four, per step, per pixel.
  if (declared === 'fisheye624' && coefficients.slice(4).every(value => value === 0)) {
    return { model: 'fisheye-kb3', coefficients: coefficients.slice(0, 4) };
  }
  return { model: declared, coefficients };
}

export function effectiveCameraModel(params: CameraModelParameters): CameraModel {
  return resolveCameraModel(params).model;
}

/**
 * The camera models the depth panel offers, and the coefficient count each one
 * shows. Every other model is a special case of one of these two: an ideal
 * pinhole is an OpenCV pinhole with zero distortion, and the equidistant,
 * OpenCV and Kannala-Brandt fisheyes are all the general fisheye with terms
 * left at zero (see `radial`, where OpenCV fisheye and KB3 share one code path
 * and Fisheye624 is that same polynomial with two further terms).
 *
 * The list is short because unused coefficients now cost nothing:
 * `resolveCameraModel` reduces a configuration to the cheapest model that is
 * exactly equivalent before it reaches the kernel.
 */
export const OFFERED_CAMERA_MODELS: Readonly<Record<'pinhole' | 'fisheye', CameraModel>> = {
  pinhole: 'pinhole-opencv',
  fisheye: 'fisheye624',
};

/**
 * Maps any camera model onto one the panel offers, moving the coefficients to
 * the slots the general model expects.
 *
 * Calibration files and saved settings still name the specific models -
 * COLMAP, ZED, RealSense and the YAML parsers all do - and a `<select>` with no
 * matching option silently falls back to its first entry, which would change
 * the model behind the user's back. Nothing is lost in the mapping: the values
 * land in the same polynomial positions they had.
 */
export function normalizeToOfferedCameraModel(
  model: CameraModel,
  coefficients: readonly number[] = []
): { model: CameraModel; coefficients: number[] } {
  const pad = (values: readonly number[], length: number): number[] => {
    const out = values.slice(0, length).map(value => (Number.isFinite(value) ? value : 0));
    while (out.length < length) {
      out.push(0);
    }
    return out;
  };

  switch (model) {
    case 'pinhole-ideal':
      return { model: OFFERED_CAMERA_MODELS.pinhole, coefficients: pad([], 14) };
    case 'pinhole-opencv':
      return { model: OFFERED_CAMERA_MODELS.pinhole, coefficients: pad(coefficients, 14) };
    case 'fisheye-equidistant':
      return { model: OFFERED_CAMERA_MODELS.fisheye, coefficients: pad([], 12) };
    // The four radial terms occupy the same first four slots either way; only
    // the labels differ (OpenCV counts from k1, KB3 and the general model from
    // k0).
    case 'fisheye-opencv':
    case 'fisheye-kb3':
      return { model: OFFERED_CAMERA_MODELS.fisheye, coefficients: pad(coefficients, 12) };
    case 'fisheye624':
      return { model: OFFERED_CAMERA_MODELS.fisheye, coefficients: pad(coefficients, 12) };
    // The E57 panoramas belong to a file format rather than to this panel.
    default:
      return { model, coefficients: [...coefficients] };
  }
}

/** The coefficient list for a model, before the all-zero reduction. */
function coefficientsForModel(
  model: CameraModel,
  params: CameraModelParameters & Record<string, any>
): number[] {
  if (params.coefficients) {
    return fitCoefficientsToModel(model, params.coefficients);
  }
  if (model === 'pinhole-opencv') {
    return [params.k1 ?? 0, params.k2 ?? 0, params.p1 ?? 0, params.p2 ?? 0, params.k3 ?? 0];
  }
  if (model === 'fisheye-opencv' || model === 'fisheye-kb3') {
    return [params.k1 ?? 0, params.k2 ?? 0, params.k3 ?? 0, params.k4 ?? 0];
  }
  return fitCoefficientsToModel(model, []);
}

export function validateCameraModelParameters(params: CameraModelParameters): string[] {
  const errors: string[] = [];
  const model = effectiveCameraModel(params);
  if (!Number.isFinite(params.fx) || params.fx <= 0) {
    errors.push('fx must be finite and positive');
  }
  const fy = params.fy ?? params.fx;
  if (!Number.isFinite(fy) || fy <= 0) {
    errors.push('fy must be finite and positive');
  }
  if (!Number.isFinite(params.cx) || !Number.isFinite(params.cy)) {
    errors.push('cx and cy must be finite');
  }
  const coefficients = params.imageRectified ? [] : (params.coefficients ?? []);
  const expected = CAMERA_MODEL_COEFFICIENTS[model].length;
  const validCoefficientCount =
    model === 'pinhole-opencv'
      ? [4, 5, 8, 12, 14].includes(coefficients.length)
      : coefficients.length === expected;
  if (!validCoefficientCount) {
    const expectedDescription = model === 'pinhole-opencv' ? '4, 5, 8, 12, or 14' : `${expected}`;
    errors.push(
      `${model} requires ${expectedDescription} coefficients (${CAMERA_MODEL_COEFFICIENTS[model].join(', ') || 'none'}), got ${coefficients.length}`
    );
  }
  if (coefficients.some(value => !Number.isFinite(value))) {
    errors.push('camera coefficients must be finite');
  }
  return errors;
}

export function projectCameraRay(
  params: CameraModelParameters,
  ray: readonly [number, number, number]
): CameraSolveResult<readonly [number, number]> {
  const errors = validateCameraModelParameters(params);
  if (errors.length) {
    throw new Error(errors.join('; '));
  }
  const result = projectCameraRayWasmSync(ray, {
    ...params,
    cameraModel: effectiveCameraModel(params),
    coefficients: params.imageRectified ? [] : [...(params.coefficients ?? [])],
    fy: params.fy ?? params.fx,
    cx: params.cx!,
    cy: params.cy!,
  });
  if (!result) {
    throw new Error('The Rust/WASM camera-model kernel is not initialized');
  }
  return result;
}

export function unprojectCameraPixel(
  params: CameraModelParameters,
  pixel: readonly [number, number]
): CameraSolveResult<readonly [number, number, number]> {
  const errors = validateCameraModelParameters(params);
  if (errors.length) {
    throw new Error(errors.join('; '));
  }
  const result = unprojectCameraPixelWasmSync(pixel, {
    ...params,
    cameraModel: effectiveCameraModel(params),
    coefficients: params.imageRectified ? [] : [...(params.coefficients ?? [])],
    fy: params.fy ?? params.fx,
    cx: params.cx!,
    cy: params.cy!,
  });
  if (!result) {
    throw new Error('The Rust/WASM camera-model kernel is not initialized');
  }
  return result;
}
