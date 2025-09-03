import { CameraModel, DepthImage, DepthMetadata } from "./types";

export interface PointCloudResult {
  vertices: Float32Array;
  colors?: Float32Array;
  pointCount: number;
  width?: number;
  height?: number;
}

export function projectToPointCloud(
  image: DepthImage,
  meta: Required<
    Pick<DepthMetadata, "fx" | "cx" | "cy" | "cameraModel">
  > &
    Partial<DepthMetadata> & {
      k1?: number; k2?: number; k3?: number; k4?: number; k5?: number;
      p1?: number; p2?: number;
    }
): PointCloudResult {
  const { width, height, data } = image;
  const { fx, cx, cy, cameraModel } = meta;
  const fy = meta.fy || fx; // Use fx if fy is not provided

  const points: number[] = [];
  const colors: number[] = [];
  const logDepths: number[] = [];
  let minDepth = Infinity;
  let maxDepth = -Infinity;

  const isZDepth = meta.kind === "z";

  if (cameraModel === "pinhole-ideal") {
    // Standard ideal pinhole camera model (undistorted)
    for (let v = 0; v < height; v++) {
      for (let u = 0; u < width; u++) {
        const idx = v * width + u;
        const val = data[idx];
        if (!isFinite(val) || val <= 0) continue;

        if (isZDepth) {
          const Z = val;
          const X = ((u - cx) / fx) * Z;
          const Y = ((v - cy) / fy) * Z;
          points.push(X, Y, Z);
          minDepth = Math.min(minDepth, Z);
          maxDepth = Math.max(maxDepth, Z);
          logDepths.push(Math.log(Z));
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
          minDepth = Math.min(minDepth, depth);
          maxDepth = Math.max(maxDepth, depth);
          logDepths.push(Math.log(depth));
        }
      }
    }
  } else if (cameraModel === "pinhole-opencv") {
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
        if (!isFinite(val) || val <= 0) continue;

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

        if (isZDepth) {
          const Z = val;
          const X = xCorrected * Z;
          const Y = yCorrected * Z;
          points.push(X, Y, Z);
          minDepth = Math.min(minDepth, Z);
          maxDepth = Math.max(maxDepth, Z);
          logDepths.push(Math.log(Z));
        } else {
          const norm = Math.hypot(xCorrected, yCorrected, 1.0);
          const dirX = xCorrected / norm;
          const dirY = yCorrected / norm;
          const dirZ = 1.0 / norm;
          const depth = val;
          points.push(dirX * depth, dirY * depth, dirZ * depth);
          minDepth = Math.min(minDepth, depth);
          maxDepth = Math.max(maxDepth, depth);
          logDepths.push(Math.log(depth));
        }
      }
    }
  } else if (cameraModel === "fisheye-equidistant") {
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

        // Track depth range and store log-depth for later normalized color mapping
        minDepth = Math.min(minDepth, depth);
        maxDepth = Math.max(maxDepth, depth);
        logDepths.push(Math.log(depth));
      }
    }
  } else if (cameraModel === "fisheye-opencv") {
    // OpenCV fisheye model with distortion correction
    const k1 = meta.k1 || 0;
    const k2 = meta.k2 || 0;
    const k3 = meta.k3 || 0;
    const k4 = meta.k4 || 0;
    
    for (let v = 0; v < height; v++) {
      for (let u = 0; u < width; u++) {
        const idx = v * width + u;
        const depth = data[idx];
        if (!isFinite(depth) || depth <= 0) continue;

        const du = u - cx;
        const dv = v - cy;
        const r2 = (du * du + dv * dv) / (fx * fx); // Normalized radius squared
        const r = Math.sqrt(r2);
        
        if (r === 0) {
          points.push(0, 0, depth);
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

          points.push(xNorm * depth, yNorm * depth, zNorm * depth);
        }

        minDepth = Math.min(minDepth, depth);
        maxDepth = Math.max(maxDepth, depth);
        logDepths.push(Math.log(depth));
      }
    }
  } else if (cameraModel === "fisheye-kannala-brandt") {
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
        if (!isFinite(depth) || depth <= 0) continue;

        const du = u - cx;
        const dv = v - cy;
        const r = Math.hypot(du, dv);
        
        if (r === 0) {
          points.push(0, 0, depth);
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
            
            const f = k1 * theta + k2 * theta * theta2 + k3 * theta * theta4 + 
                     k4 * theta * theta6 + k5 * theta * theta8 - r / fx;
            const df = k1 + 3 * k2 * theta2 + 5 * k3 * theta4 + 
                      7 * k4 * theta6 + 9 * k5 * theta8;
            
            if (Math.abs(df) < 1e-12) break;
            theta = theta - f / df;
            if (Math.abs(f) < 1e-12) break;
          }
          
          const uNorm = du / r;
          const vNorm = dv / r;
          const xNorm = uNorm * Math.sin(theta);
          const yNorm = vNorm * Math.sin(theta);
          const zNorm = Math.cos(theta);

          points.push(xNorm * depth, yNorm * depth, zNorm * depth);
        }

        minDepth = Math.min(minDepth, depth);
        maxDepth = Math.max(maxDepth, depth);
        logDepths.push(Math.log(depth));
      }
    }
  } else {
    // Fallback to standard ideal pinhole
    for (let v = 0; v < height; v++) {
      for (let u = 0; u < width; u++) {
        const idx = v * width + u;
        const val = data[idx];
        if (!isFinite(val) || val <= 0) continue;

        if (isZDepth) {
          const Z = val;
          const X = ((u - cx) / fx) * Z;
          const Y = ((v - cy) / fy) * Z;
          points.push(X, Y, Z);
          // Track depth range and store log-depth for later normalized color mapping
          minDepth = Math.min(minDepth, Z);
          maxDepth = Math.max(maxDepth, Z);
          logDepths.push(Math.log(Z));
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
          // Track depth range and store log-depth for later normalized color mapping
          minDepth = Math.min(minDepth, depth);
          maxDepth = Math.max(maxDepth, depth);
          logDepths.push(Math.log(depth));
        }
      }
    }
  }

  // Compute log-normalized, gamma-corrected grayscale colors
  if (logDepths.length > 0) {
    const logMin = Math.log(minDepth);
    const logMax = Math.log(maxDepth);
    const denom = logMax - logMin;
    const invDenom = denom > 0 ? 1 / denom : 0;
    const gamma = 1.0; //2.2; // standard display gamma
    const minGray = 0.2; // lift darkest values to 0.2
    for (let i = 0; i < logDepths.length; i++) {
      const s = denom > 0 ? (logDepths[i] - logMin) * invDenom : 1.0;
      const g = Math.pow(s, 1 / gamma);
      const mapped = minGray + (1 - minGray) * g;
      colors.push(mapped, mapped, mapped);
    }
  }

  let vertices = new Float32Array(points);
  if (meta.convention === "opengl") {
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
  if (
    (meta.kind === "depth" || meta.kind === "z") &&
    (meta.unit || meta.scale)
  ) {
    const scale =
      (meta.unit === "millimeter" ? 1 / 1000 : 1) * (meta.scale ?? 1);
    for (let i = 0; i < data.length; i++) data[i] = data[i] * scale;
  }

  // Apply depth scale and bias for mono depth networks (before type-specific conversions)
  if (meta.depthScale !== undefined || meta.depthBias !== undefined) {
    const scale = meta.depthScale ?? 1.0;
    const bias = meta.depthBias ?? 0.0;
    for (let i = 0; i < data.length; i++) {
      if (isFinite(data[i])) {
        data[i] = data[i] * scale + bias;
      }
    }
  }

  // Convert disparity/inv_depth to depth in meters if possible
  if (meta.kind === "disparity") {
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
      meta.kind = "depth";
      meta.unit = "meter";
    }
  } else if (meta.kind === "inverse_depth") {
    const scale =
      (meta.unit === "millimeter" ? 1 / 1000 : 1) * (meta.scale ?? 1);
    for (let i = 0; i < data.length; i++) {
      const id = data[i] * scale;
      data[i] = id > 0 ? 1.0 / id : NaN;
    }
    meta.kind = "depth";
    meta.unit = "meter";
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
