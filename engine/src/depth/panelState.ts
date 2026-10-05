import type { CameraParams, SpatialData } from '../interfaces';
import type { FileEntryRegistry } from '../state/fileEntries';
import type { CameraModel } from './types';
import {
  coefficientsFromGroups,
  groupsFromCoefficients,
  normalizeToOfferedCameraModel,
} from './cameraModels';
import * as comments from './commentSettings';

export interface CameraCalibration {
  fx?: number;
  fy?: number;
  cx?: number;
  cy?: number;
  baseline?: number;
  k1?: number;
  k2?: number;
  k3?: number;
  k4?: number;
  p1?: number;
  p2?: number;
  camera_model?: string;
  coefficients?: number[];
}
export interface DepthCalibration {
  fileName: string;
  selectedCamera: string;
  data: { cameras: Record<string, CameraCalibration>; _calibTxtData?: { doffs: number } };
}
export type DepthForm = Omit<CameraParams, 'fx'> & {
  fx: number | undefined;
  coefficientGroups: string[];
  calibration?: DepthCalibration;
};
export interface DepthFormHost {
  fileEntries: FileEntryRegistry;
  spatialFiles: readonly SpatialData[];
  defaultDepthSettings: CameraParams;
}
const optionalNumber = (value: string): number | undefined =>
  value.trim() ? Number(value) : undefined;

export function getDepthForm(host: DepthFormHost, index: number): DepthForm {
  const state = host.fileEntries.require(index).state;
  if (!state.depthForm) {
    state.depthForm = createDepthForm(host, host.spatialFiles[index], index);
    state.liveDepth = true;
  }
  return state.depthForm;
}

export function createDepthForm(host: DepthFormHost, data: SpatialData, index: number): DepthForm {
  const model = normalizeToOfferedCameraModel(
    comments.getDepthSetting(host, data, 'camera') as CameraModel,
    data.depthSource?.cameraParams.coefficients ?? host.defaultDepthSettings.coefficients ?? []
  );
  return {
    ...host.defaultDepthSettings,
    cameraModel: model.model as import('../interfaces').CameraParams['cameraModel'],
    depthType: comments.getDepthSetting(host, data, 'depth') as CameraParams['depthType'],
    fx: comments.getDepthFx(host, data),
    fy: optionalNumber(comments.getDepthFy(host, data)),
    cx: optionalNumber(comments.getDepthCx(host, data, index)),
    cy: optionalNumber(comments.getDepthCy(host, data, index)),
    baseline: comments.getDepthBaseline(host, data),
    convention: comments.getDepthConvention(host, data),
    pngScaleFactor: comments.getPngScaleFactor(data),
    rgb24ScaleFactor: comments.getRgb24ScaleFactor(data),
    rgb24ConversionMode: comments.getRgb24ConversionMode(data),
    disparityOffset: 0,
    depthScale: host.defaultDepthSettings.depthScale ?? 1,
    depthBias: host.defaultDepthSettings.depthBias ?? 0,
    coefficientGroups: groupsFromCoefficients(model.model, model.coefficients),
  };
}

export function depthParams(form: DepthForm): CameraParams {
  const { coefficientGroups, calibration: _calibration, ...values } = form;
  const fx = values.fx ?? 1000;
  for (const [key, value] of Object.entries(values)) {
    if (typeof value === 'number' && !Number.isFinite(value)) {
      throw new Error(`Invalid ${key}: enter a finite number`);
    }
  }
  if (fx <= 0 || (values.fy !== undefined && values.fy <= 0)) {
    throw new Error('Focal lengths must be positive');
  }
  if (values.depthType === 'disparity' && (values.baseline ?? 120) <= 0) {
    throw new Error('Baseline must be positive');
  }
  for (const group of coefficientGroups) {
    if (group && group.split(',').some(value => !Number.isFinite(Number(value.trim())))) {
      throw new Error('Invalid distortion coefficient');
    }
  }
  return {
    ...values,
    fx,
    coefficients: coefficientsFromGroups(values.cameraModel, coefficientGroups),
    baseline: values.depthType === 'disparity' ? (values.baseline ?? 120) : undefined,
    disparityOffset: values.depthType === 'disparity' ? (values.disparityOffset ?? 0) : undefined,
  };
}

export function resetFormDefaults(form: DepthForm, defaults: CameraParams): void {
  const offered = normalizeToOfferedCameraModel(defaults.cameraModel, defaults.coefficients ?? []);
  Object.assign(form, defaults, {
    cameraModel: offered.model,
    coefficientGroups: groupsFromCoefficients(offered.model, offered.coefficients),
    cx: form.cx,
    cy: form.cy,
    fy: defaults.fy === defaults.fx ? undefined : defaults.fy,
  });
}
