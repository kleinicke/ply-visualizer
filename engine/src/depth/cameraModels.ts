import type { CameraModel } from './types';
import { projectCameraRayWasmSync, unprojectCameraPixelWasmSync } from './readers/tiffWasm';

export const CAMERA_MODEL_COEFFICIENTS: Readonly<Record<CameraModel, readonly string[]>> = {
  'pinhole-ideal': [],
  'pinhole-opencv': ['k1', 'k2', 'p1', 'p2', 'k3'],
  'fisheye-equidistant': [],
  'fisheye-opencv': ['k1', 'k2', 'k3', 'k4'],
  'fisheye-kb3': ['k0', 'k1', 'k2', 'k3'],
  fisheye624: ['k0', 'k1', 'k2', 'k3', 'k4', 'k5', 'p0', 'p1', 's0', 's1', 's2', 's3'],
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

export function cameraCoefficientsFromParameters(
  params: CameraModelParameters & Record<string, any>
): number[] {
  if (params.imageRectified) {return [];}
  if (params.coefficients) {return [...params.coefficients];}
  if (params.cameraModel === 'pinhole-opencv') {
    return [params.k1 ?? 0, params.k2 ?? 0, params.p1 ?? 0, params.p2 ?? 0, params.k3 ?? 0];
  }
  if (params.cameraModel === 'fisheye-opencv') {
    return [params.k1 ?? 0, params.k2 ?? 0, params.k3 ?? 0, params.k4 ?? 0];
  }
  return [];
}

export interface CameraSolveResult<T extends readonly number[]> {
  value: T;
  valid: boolean;
  converged: boolean;
  iterations: number;
}

export function effectiveCameraModel(params: CameraModelParameters): CameraModel {
  return params.imageRectified ? 'pinhole-ideal' : params.cameraModel;
}

export function validateCameraModelParameters(params: CameraModelParameters): string[] {
  const errors: string[] = [];
  const model = effectiveCameraModel(params);
  if (!Number.isFinite(params.fx) || params.fx <= 0) {errors.push('fx must be finite and positive');}
  const fy = params.fy ?? params.fx;
  if (!Number.isFinite(fy) || fy <= 0) {errors.push('fy must be finite and positive');}
  if (!Number.isFinite(params.cx) || !Number.isFinite(params.cy)) {
    errors.push('cx and cy must be finite');
  }
  const coefficients = params.imageRectified ? [] : (params.coefficients ?? []);
  const expected = CAMERA_MODEL_COEFFICIENTS[model].length;
  if (coefficients.length !== expected) {
    errors.push(
      `${model} requires ${expected} coefficients (${CAMERA_MODEL_COEFFICIENTS[model].join(', ') || 'none'}), got ${coefficients.length}`
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
  if (errors.length) {throw new Error(errors.join('; '));}
  const result = projectCameraRayWasmSync(ray, {
    ...params,
    cameraModel: effectiveCameraModel(params),
    coefficients: params.imageRectified ? [] : [...(params.coefficients ?? [])],
    fy: params.fy ?? params.fx,
    cx: params.cx!,
    cy: params.cy!,
  });
  if (!result) {throw new Error('The Rust/WASM camera-model kernel is not initialized');}
  return result;
}

export function unprojectCameraPixel(
  params: CameraModelParameters,
  pixel: readonly [number, number]
): CameraSolveResult<readonly [number, number, number]> {
  const errors = validateCameraModelParameters(params);
  if (errors.length) {throw new Error(errors.join('; '));}
  const result = unprojectCameraPixelWasmSync(pixel, {
    ...params,
    cameraModel: effectiveCameraModel(params),
    coefficients: params.imageRectified ? [] : [...(params.coefficients ?? [])],
    fy: params.fy ?? params.fx,
    cx: params.cx!,
    cy: params.cy!,
  });
  if (!result) {throw new Error('The Rust/WASM camera-model kernel is not initialized');}
  return result;
}
