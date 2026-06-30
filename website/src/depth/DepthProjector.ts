import { CameraModel, DepthImage, DepthMetadata } from './types';

export interface PointCloudResult {
  vertices: Float32Array;
  colors?: Float32Array | Uint8Array;
  pointCount: number;
  width?: number;
  height?: number;
  /** Original pixel coordinates (u,v) for each point - used for color mapping with distorted camera models */
  pixelCoords?: Uint16Array;
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
  const { fx, cx, cy, cameraModel } = meta;
  const fy = meta.fy || fx; // Use fx if fy is not provided

  const totalPixels = width * height;

  // Count valid pixels in a single cheap pass so we can allocate the output
  // arrays to their exact final size. This avoids over-allocating for every
  // pixel (3N+3N+N floats ≈ hundreds of MB on large depth maps) and avoids the
  // full-size .slice() copy at the end. The validity predicate here MUST match
  // the per-model loops below (isFinite(val) && val > 0).
  let validCount = 0;
  let minDepth = Infinity;
  let maxDepth = -Infinity;
  for (let i = 0; i < totalPixels; i++) {
    const v = data[i];
    if (isFinite(v) && v > 0) {
      validCount++;
      if (v < minDepth) {
        minDepth = v;
      }
      if (v > maxDepth) {
        maxDepth = v;
      }
    }
  }

  // Pre-allocate typed arrays at the exact valid-point count
  const tempVertices = new Float32Array(validCount * 3);
  const tempColors = new Uint8Array(validCount * 3);

  // For distorted camera models, store pixel coordinates for accurate color mapping
  // Reprojection is error-prone for distorted models, so we store the original (u,v)
  const needsPixelCoords =
    cameraModel === 'pinhole-opencv' ||
    cameraModel === 'fisheye-opencv' ||
    cameraModel === 'fisheye-kannala-brandt';
  const tempPixelCoords = needsPixelCoords ? new Uint16Array(validCount * 2) : null;

  let pointIndex = 0;

  const isZDepth = meta.kind === 'z';
  const conventionSign = meta.convention === 'opengl' ? -1 : 1;
  const logMin = validCount > 0 ? Math.log(minDepth) : 0;
  const logMax = validCount > 0 ? Math.log(maxDepth) : 0;
  const denom = logMax - logMin;
  const invDenom = denom > 0 ? 1 / denom : 0;
  const minGrayByte = 51; // lift darkest values to 0.2 * 255
  const grayRangeByte = 204;

  if (cameraModel === 'pinhole-ideal') {
    // Standard ideal pinhole camera model (undistorted)
    for (let v = 0; v < height; v++) {
      for (let u = 0; u < width; u++) {
        const idx = v * width + u;
        const val = data[idx];
        if (!isFinite(val) || val <= 0) {
          continue;
        }

        const pointBase = pointIndex * 3;

        if (isZDepth) {
          const Z = val;
          const X = ((u - cx) / fx) * Z;
          const Y = ((v - cy) / fy) * Z;
          tempVertices[pointBase] = X;
          tempVertices[pointBase + 1] = Y * conventionSign;
          tempVertices[pointBase + 2] = Z * conventionSign;
        } else {
          const X = (u - cx) / fx;
          const Y = (v - cy) / fy;
          const Z = 1.0;
          const norm = Math.hypot(X, Y, Z);
          const dirX = X / norm;
          const dirY = Y / norm;
          const dirZ = Z / norm;
          const depth = val;
          tempVertices[pointBase] = dirX * depth;
          tempVertices[pointBase + 1] = dirY * depth * conventionSign;
          tempVertices[pointBase + 2] = dirZ * depth * conventionSign;
        }
        const s = denom > 0 ? (Math.log(val) - logMin) * invDenom : 1.0;
        const mapped = (minGrayByte + 0.5 + grayRangeByte * s) | 0;
        tempColors[pointBase] = mapped;
        tempColors[pointBase + 1] = mapped;
        tempColors[pointBase + 2] = mapped;
        pointIndex++;
      }
    }
  } else if (cameraModel === 'pinhole-opencv') {
    // Pinhole camera model with OpenCV distortion correction
    const k1 = meta.k1 || 0;
    const k2 = meta.k2 || 0;
    const p1 = meta.p1 || 0;
    const p2 = meta.p2 || 0;
    const k3 = meta.k3 || 0;

    for (let v = 0; v < height; v++) {
      for (let u = 0; u < width; u++) {
        const idx = v * width + u;
        const val = data[idx];
        if (!isFinite(val) || val <= 0) {
          continue;
        }

        // Convert pixel coordinates to normalized coordinates
        let xn = (u - cx) / fx;
        let yn = (v - cy) / fy;

        // Apply distortion correction (undistortion)
        const r2 = xn * xn + yn * yn;
        const r4 = r2 * r2;
        const r6 = r4 * r2;

        // Radial distortion correction
        const radialCorrection = 1 + k1 * r2 + k2 * r4 + k3 * r6;

        // Tangential distortion correction
        const tangentialX = 2 * p1 * xn * yn + p2 * (r2 + 2 * xn * xn);
        const tangentialY = p1 * (r2 + 2 * yn * yn) + 2 * p2 * xn * yn;

        // Apply corrections
        const xCorrected = xn * radialCorrection + tangentialX;
        const yCorrected = yn * radialCorrection + tangentialY;

        const pointBase = pointIndex * 3;

        if (isZDepth) {
          const Z = val;
          const X = xCorrected * Z;
          const Y = yCorrected * Z;
          tempVertices[pointBase] = X;
          tempVertices[pointBase + 1] = Y * conventionSign;
          tempVertices[pointBase + 2] = Z * conventionSign;
        } else {
          const norm = Math.hypot(xCorrected, yCorrected, 1.0);
          const dirX = xCorrected / norm;
          const dirY = yCorrected / norm;
          const dirZ = 1.0 / norm;
          const depth = val;
          tempVertices[pointBase] = dirX * depth;
          tempVertices[pointBase + 1] = dirY * depth * conventionSign;
          tempVertices[pointBase + 2] = dirZ * depth * conventionSign;
        }
        const s = denom > 0 ? (Math.log(val) - logMin) * invDenom : 1.0;
        const mapped = (minGrayByte + 0.5 + grayRangeByte * s) | 0;
        tempColors[pointBase] = mapped;
        tempColors[pointBase + 1] = mapped;
        tempColors[pointBase + 2] = mapped;
        // Store pixel coordinates for color mapping (distorted model)
        if (tempPixelCoords) {
          const pixelBase = pointIndex * 2;
          tempPixelCoords[pixelBase] = u;
          tempPixelCoords[pixelBase + 1] = v;
        }
        pointIndex++;
      }
    }
  } else if (cameraModel === 'fisheye-equidistant') {
    // Equidistant fisheye model
    for (let v = 0; v < height; v++) {
      for (let u = 0; u < width; u++) {
        const idx = v * width + u;
        const depth = data[idx];
        if (!isFinite(depth) || depth <= 0) {
          continue;
        }

        const du = u - cx;
        const dv = v - cy;
        const r = Math.hypot(du, dv);

        const pointBase = pointIndex * 3;

        if (r === 0) {
          tempVertices[pointBase] = 0;
          tempVertices[pointBase + 1] = 0;
          tempVertices[pointBase + 2] = depth * conventionSign;
        } else {
          const uNorm = du / r;
          const vNorm = dv / r;
          const theta = r / fx;
          const xNorm = uNorm * Math.sin(theta);
          const yNorm = vNorm * Math.sin(theta);
          const zNorm = Math.cos(theta);

          tempVertices[pointBase] = xNorm * depth;
          tempVertices[pointBase + 1] = yNorm * depth * conventionSign;
          tempVertices[pointBase + 2] = zNorm * depth * conventionSign;
        }

        const s = denom > 0 ? (Math.log(depth) - logMin) * invDenom : 1.0;
        const mapped = (minGrayByte + 0.5 + grayRangeByte * s) | 0;
        tempColors[pointBase] = mapped;
        tempColors[pointBase + 1] = mapped;
        tempColors[pointBase + 2] = mapped;
        pointIndex++;
      }
    }
  } else if (cameraModel === 'fisheye-opencv') {
    // OpenCV fisheye model with distortion correction
    const k1 = meta.k1 || 0;
    const k2 = meta.k2 || 0;
    const k3 = meta.k3 || 0;
    const k4 = meta.k4 || 0;

    for (let v = 0; v < height; v++) {
      for (let u = 0; u < width; u++) {
        const idx = v * width + u;
        const depth = data[idx];
        if (!isFinite(depth) || depth <= 0) {
          continue;
        }

        const du = u - cx;
        const dv = v - cy;
        const r2 = (du * du + dv * dv) / (fx * fx); // Normalized radius squared
        const r = Math.sqrt(r2);

        const pointBase = pointIndex * 3;

        if (r === 0) {
          tempVertices[pointBase] = 0;
          tempVertices[pointBase + 1] = 0;
          tempVertices[pointBase + 2] = depth * conventionSign;
        } else {
          // Apply fisheye distortion correction
          const r4 = r2 * r2;
          const r6 = r4 * r2;
          const r8 = r6 * r2;
          const radialCorrection = 1 + k1 * r2 + k2 * r4 + k3 * r6 + k4 * r8;
          const rCorrected = r * radialCorrection;

          // Convert back to angle
          const theta = rCorrected;

          const uNorm = du / (r * fx);
          const vNorm = dv / (r * fx);
          const xNorm = uNorm * Math.sin(theta);
          const yNorm = vNorm * Math.sin(theta);
          const zNorm = Math.cos(theta);

          tempVertices[pointBase] = xNorm * depth;
          tempVertices[pointBase + 1] = yNorm * depth * conventionSign;
          tempVertices[pointBase + 2] = zNorm * depth * conventionSign;
        }

        const s = denom > 0 ? (Math.log(depth) - logMin) * invDenom : 1.0;
        const mapped = (minGrayByte + 0.5 + grayRangeByte * s) | 0;
        tempColors[pointBase] = mapped;
        tempColors[pointBase + 1] = mapped;
        tempColors[pointBase + 2] = mapped;
        // Store pixel coordinates for color mapping (distorted model)
        if (tempPixelCoords) {
          const pixelBase = pointIndex * 2;
          tempPixelCoords[pixelBase] = u;
          tempPixelCoords[pixelBase + 1] = v;
        }
        pointIndex++;
      }
    }
  } else if (cameraModel === 'fisheye-kannala-brandt') {
    // Kannala-Brandt polynomial fisheye model
    const k1 = meta.k1 || 0;
    const k2 = meta.k2 || 0;
    const k3 = meta.k3 || 0;
    const k4 = meta.k4 || 0;
    const k5 = meta.k5 || 0;

    for (let v = 0; v < height; v++) {
      for (let u = 0; u < width; u++) {
        const idx = v * width + u;
        const depth = data[idx];
        if (!isFinite(depth) || depth <= 0) {
          continue;
        }

        const du = u - cx;
        const dv = v - cy;
        const r = Math.hypot(du, dv);

        const pointBase = pointIndex * 3;

        if (r === 0) {
          tempVertices[pointBase] = 0;
          tempVertices[pointBase + 1] = 0;
          tempVertices[pointBase + 2] = depth * conventionSign;
        } else {
          // Kannala-Brandt: r = k1*θ + k2*θ³ + k3*θ⁵ + k4*θ⁷ + k5*θ⁹
          // We need to solve for θ given r (undistortion)
          let theta = r / fx; // Initial guess

          // Newton-Raphson iteration to solve for theta
          for (let iter = 0; iter < 10; iter++) {
            const theta2 = theta * theta;
            const theta4 = theta2 * theta2;
            const theta6 = theta4 * theta2;
            const theta8 = theta6 * theta2;

            const f =
              k1 * theta +
              k2 * theta * theta2 +
              k3 * theta * theta4 +
              k4 * theta * theta6 +
              k5 * theta * theta8 -
              r / fx;
            const df = k1 + 3 * k2 * theta2 + 5 * k3 * theta4 + 7 * k4 * theta6 + 9 * k5 * theta8;

            if (Math.abs(df) < 1e-12) {
              break;
            }
            theta = theta - f / df;
            if (Math.abs(f) < 1e-12) {
              break;
            }
          }

          const uNorm = du / r;
          const vNorm = dv / r;
          const xNorm = uNorm * Math.sin(theta);
          const yNorm = vNorm * Math.sin(theta);
          const zNorm = Math.cos(theta);

          tempVertices[pointBase] = xNorm * depth;
          tempVertices[pointBase + 1] = yNorm * depth * conventionSign;
          tempVertices[pointBase + 2] = zNorm * depth * conventionSign;
        }

        const s = denom > 0 ? (Math.log(depth) - logMin) * invDenom : 1.0;
        const mapped = (minGrayByte + 0.5 + grayRangeByte * s) | 0;
        tempColors[pointBase] = mapped;
        tempColors[pointBase + 1] = mapped;
        tempColors[pointBase + 2] = mapped;
        // Store pixel coordinates for color mapping (distorted model)
        if (tempPixelCoords) {
          const pixelBase = pointIndex * 2;
          tempPixelCoords[pixelBase] = u;
          tempPixelCoords[pixelBase + 1] = v;
        }
        pointIndex++;
      }
    }
  } else {
    // Fallback to standard ideal pinhole
    for (let v = 0; v < height; v++) {
      for (let u = 0; u < width; u++) {
        const idx = v * width + u;
        const val = data[idx];
        if (!isFinite(val) || val <= 0) {
          continue;
        }

        const pointBase = pointIndex * 3;

        if (isZDepth) {
          const Z = val;
          const X = ((u - cx) / fx) * Z;
          const Y = ((v - cy) / fy) * Z;
          tempVertices[pointBase] = X;
          tempVertices[pointBase + 1] = Y * conventionSign;
          tempVertices[pointBase + 2] = Z * conventionSign;
        } else {
          const X = (u - cx) / fx;
          const Y = (v - cy) / fy;
          const Z = 1.0;
          const norm = Math.hypot(X, Y, Z);
          const dirX = X / norm;
          const dirY = Y / norm;
          const dirZ = Z / norm;
          const depth = val;
          tempVertices[pointBase] = dirX * depth;
          tempVertices[pointBase + 1] = dirY * depth * conventionSign;
          tempVertices[pointBase + 2] = dirZ * depth * conventionSign;
        }
        const s = denom > 0 ? (Math.log(val) - logMin) * invDenom : 1.0;
        const mapped = (minGrayByte + 0.5 + grayRangeByte * s) | 0;
        tempColors[pointBase] = mapped;
        tempColors[pointBase + 1] = mapped;
        tempColors[pointBase + 2] = mapped;
        pointIndex++;
      }
    }
  }

  // The temp arrays were allocated at the exact valid-point count, so in the
  // common case they're already correctly sized and we return them directly
  // (no copy). Fall back to a slice only if the per-model validity count
  // diverged from the pre-count (shouldn't happen — predicates match).
  const exact = pointIndex === validCount;
  const vertices = exact ? tempVertices : tempVertices.slice(0, pointIndex * 3);
  const colors =
    pointIndex > 0 ? (exact ? tempColors : tempColors.slice(0, pointIndex * 3)) : undefined;
  const pixelCoords =
    tempPixelCoords && pointIndex > 0
      ? exact
        ? tempPixelCoords
        : tempPixelCoords.slice(0, pointIndex * 2)
      : undefined;

  return {
    vertices,
    colors,
    pointCount: pointIndex,
    width,
    height,
    pixelCoords,
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

  const data = new Float32Array(image.data); // copy for safe transform

  // Apply unit/scale to convert to meters when kind is depth/z. Skip the
  // per-pixel loop entirely when the scale is a no-op (e.g. depth already in
  // meters), which is the common case for depth TIFFs.
  if (unitScale !== 1) {
    for (let i = 0; i < data.length; i++) {
      data[i] = data[i] * unitScale;
    }
  }

  // Apply depth scale and bias for mono depth networks (before type-specific conversions)
  if (hasDepthScaleBias) {
    for (let i = 0; i < data.length; i++) {
      if (isFinite(data[i])) {
        data[i] = data[i] * depthScale + depthBias;
      }
    }
  }

  // Convert disparity/inv_depth to depth in meters if possible
  if (meta.kind === 'disparity') {
    const fx = meta.fx ?? 0;
    const baseline = meta.baseline ?? 0;
    const disparityOffset = meta.disparityOffset ?? 0;
    const eps = 1e-8;
    if (fx > 0 && baseline > 0) {
      for (let i = 0; i < data.length; i++) {
        const d = data[i];
        const dWithOffset = d + disparityOffset;
        data[i] = dWithOffset > eps ? (fx * baseline) / dWithOffset : NaN;
      }
      meta.kind = 'depth';
      meta.unit = 'meter';
    }
  } else if (meta.kind === 'inverse_depth') {
    const scale = (meta.unit === 'millimeter' ? 1 / 1000 : 1) * (meta.scale ?? 1);
    for (let i = 0; i < data.length; i++) {
      const id = data[i] * scale;
      data[i] = id > 0 ? 1.0 / id : NaN;
    }
    meta.kind = 'depth';
    meta.unit = 'meter';
  }

  if (needsClamp && meta.depthClamp) {
    const { min, max } = meta.depthClamp;
    for (let i = 0; i < data.length; i++) {
      const z = data[i];
      if (min !== undefined && z < min) {
        data[i] = NaN;
      }
      if (max !== undefined && z > max) {
        data[i] = NaN;
      }
    }
  }

  return { width: image.width, height: image.height, data };
}
