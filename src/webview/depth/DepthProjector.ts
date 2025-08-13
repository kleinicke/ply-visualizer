import { CameraModel, DepthImage, DepthMetadata } from './types';

export interface PointCloudResult {
  vertices: Float32Array;
  colors?: Float32Array;
  pointCount: number;
  width?: number;
  height?: number;
}

export function projectToPointCloud(
  image: DepthImage,
  meta: Required<Pick<DepthMetadata, 'fx' | 'fy' | 'cx' | 'cy' | 'cameraModel'>> & Partial<DepthMetadata>
): PointCloudResult {
  const { width, height, data } = image;
  const { fx, fy, cx, cy, cameraModel } = meta;

  const points: number[] = [];
  const colors: number[] = [];

  const isZDepth = meta.kind === 'z';

  if (cameraModel === 'fisheye') {
    // Equidistant fisheye model
    for (let v = 0; v < height; v++) {
      for (let u = 0; u < width; u++) {
        const idx = v * width + u;
        const depth = data[idx];
        if (!isFinite(depth) || depth <= 0) continue;

        const du = u - cx;
        const dv = v - cy;
        const r = Math.hypot(du, dv);
        if (r === 0) {
          points.push(0, 0, depth);
        } else {
          const uNorm = du / r;
          const vNorm = dv / r;
          const theta = r / fx;
          const xNorm = uNorm * Math.sin(theta);
          const yNorm = vNorm * Math.sin(theta);
          const zNorm = Math.cos(theta);

          points.push(xNorm * depth, yNorm * depth, zNorm * depth);
        }

        const nd = Math.min(depth / 10, 1);
        colors.push(nd, nd, nd);
      }
    }
  } else {
    // Pinhole
    for (let v = 0; v < height; v++) {
      for (let u = 0; u < width; u++) {
        const idx = v * width + u;
        const val = data[idx];
        if (!isFinite(val) || val <= 0) continue;

        if (isZDepth) {
          const Z = val;
          const X = (u - cx) / fx * Z;
          const Y = (v - cy) / fy * Z;
          points.push(X, Y, Z);
          const nd = Math.min(Z / 10, 1);
          colors.push(nd, nd, nd);
        } else {
          const X = (u - cx) / fx;
          const Y = (v - cy) / fy;
          const Z = 1.0;
          const norm = Math.hypot(X, Y, Z);
          const dirX = X / norm;
          const dirY = Y / norm;
          const dirZ = Z / norm;
          const depth = val;
          points.push(dirX * depth, dirY * depth, dirZ * depth);
          const nd = Math.min(depth / 10, 1);
          colors.push(nd, nd, nd);
        }
      }
    }
  }

  let vertices = new Float32Array(points);
  if (meta.convention === 'opengl') {
    for (let i = 0; i < vertices.length; i += 3) {
      vertices[i + 1] = -vertices[i + 1];
      vertices[i + 2] = -vertices[i + 2];
    }
  }

  return {
    vertices,
    colors: colors.length ? new Float32Array(colors) : undefined,
    pointCount: points.length / 3,
    width,
    height,
  };
}

export function normalizeDepth(
  image: DepthImage,
  meta: DepthMetadata
): DepthImage {
  const data = new Float32Array(image.data); // copy for safe transform

  // Apply unit/scale to convert to meters when kind is depth/z
  if ((meta.kind === 'depth' || meta.kind === 'z') && (meta.unit || meta.scale)) {
    const scale = (meta.unit === 'millimeter' ? 1 / 1000 : 1) * (meta.scale ?? 1);
    for (let i = 0; i < data.length; i++) data[i] = data[i] * scale;
  }

  // Convert disparity/inv_depth to depth in meters if possible
  if (meta.kind === 'disparity') {
    const fx = meta.fx ?? 0;
    const baseline = meta.baseline ?? 0;
    const eps = 1e-8;
    if (fx > 0 && baseline > 0) {
      for (let i = 0; i < data.length; i++) {
        const d = data[i];
        data[i] = d > eps ? (fx * baseline) / d : NaN;
      }
      meta.kind = 'depth';
      meta.unit = 'meter';
    }
  } else if (meta.kind === 'inv_depth') {
    const scale = (meta.unit === 'millimeter' ? 1 / 1000 : 1) * (meta.scale ?? 1);
    for (let i = 0; i < data.length; i++) {
      const id = data[i] * scale;
      data[i] = id > 0 ? 1.0 / id : NaN;
    }
    meta.kind = 'depth';
    meta.unit = 'meter';
  }

  if (meta.depthClamp) {
    const { min, max } = meta.depthClamp;
    for (let i = 0; i < data.length; i++) {
      const z = data[i];
      if (min !== undefined && z < min) data[i] = NaN;
      if (max !== undefined && z > max) data[i] = NaN;
    }
  }

  return { width: image.width, height: image.height, data };
}


