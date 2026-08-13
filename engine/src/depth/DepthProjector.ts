import { CameraModel, DepthImage, DepthMetadata } from './types';
import { normalizeDepthWasmSync, projectDepthWasmSync } from './readers/tiffWasm';
import { resolveCameraModel } from './cameraModels';

export interface PointCloudResult {
  vertices: Float32Array;
  colors?: Float32Array | Uint8Array;
  pointCount: number;
  width?: number;
  height?: number;
  /** Original pixel coordinates (u,v) for each point - used for color mapping with distorted camera models */
  pixelCoords?: Uint16Array;
  projectionDiagnostics?: { rejectedCount: number; nonConvergedCount: number };
}

export function projectToPointCloud(
  image: DepthImage,
  meta: Required<Pick<DepthMetadata, 'fx' | 'cx' | 'cy' | 'cameraModel'>> &
    Partial<DepthMetadata> & {
      k1?: number;
      k2?: number;
      k3?: number;
      k4?: number;
      k5?: number;
      p1?: number;
      p2?: number;
    }
): PointCloudResult {
  const { width, height, data } = image;
  const { fx, cx, cy } = meta;
  // One resolution for both, so the model asked for and the coefficients sent
  // with it cannot disagree — and so an all-zero distortion drops to the
  // closed-form model instead of iterating per pixel.
  const { model: cameraModel, coefficients } = resolveCameraModel(meta as any);
  const fy = meta.fy || fx; // Use fx if fy is not provided

  const wasmResult = projectDepthWasmSync(data, width, height, {
    kind: meta.kind,
    cameraModel,
    convention: meta.convention || 'opengl',
    fx,
    fy,
    cx,
    cy,
    coefficients,
  });
  if (!wasmResult) {
    // No JavaScript projection any more. There used to be one for
    // `pinhole-ideal` and `fisheye-equidistant` only, which meant a file
    // projected differently — or not at all — depending on whether the wasm
    // had loaded and which camera model it used. Callers make sure the module
    // is ready (`initTiffWasm`) before they get here.
    throw new Error(
      `Depth projection requires the Rust/WASM camera-model kernel (model: ${cameraModel})`
    );
  }
  return {
    ...wasmResult,
    projectionDiagnostics: {
      rejectedCount: wasmResult.rejectedCount,
      nonConvergedCount: wasmResult.nonConvergedCount,
    },
  };
}

export function normalizeDepth(image: DepthImage, meta: DepthMetadata): DepthImage {
  const unitScale =
    meta.kind === 'depth' || meta.kind === 'z'
      ? (meta.unit === 'millimeter' ? 1 / 1000 : 1) * (meta.scale ?? 1)
      : 1;
  const depthScale = meta.depthScale ?? 1.0;
  const depthBias = meta.depthBias ?? 0.0;
  const hasDepthScaleBias =
    (meta.depthScale !== undefined || meta.depthBias !== undefined) &&
    (depthScale !== 1 || depthBias !== 0);
  const canConvertDisparity =
    meta.kind === 'disparity' && (meta.fx ?? 0) > 0 && (meta.baseline ?? 0) > 0;
  const needsClamp =
    !!meta.depthClamp && (meta.depthClamp.min !== undefined || meta.depthClamp.max !== undefined);
  const needsTransform =
    unitScale !== 1 ||
    hasDepthScaleBias ||
    canConvertDisparity ||
    meta.kind === 'inverse_depth' ||
    needsClamp;

  if (!needsTransform) {
    return image;
  }

  const wasmResult = normalizeDepthWasmSync(image.data, image.width, image.height, {
    kind: meta.kind || 'depth',
    unit: meta.unit || 'meter',
    scale: meta.scale ?? 1,
    depthScale,
    depthBias,
    fx: meta.fx ?? 0,
    baseline: meta.baseline ?? 0,
    disparityOffset: meta.disparityOffset ?? 0,
    depthClamp: meta.depthClamp,
  });
  if (!wasmResult) {
    throw new Error('Depth normalization requires the Rust/WASM kernel');
  }
  meta.kind = wasmResult.kind as DepthMetadata['kind'];
  meta.unit = wasmResult.unit as DepthMetadata['unit'];
  return { width: wasmResult.width, height: wasmResult.height, data: wasmResult.data };
}
