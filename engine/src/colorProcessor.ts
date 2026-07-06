/**
 * ColorProcessor - Handles color space conversion and color mapping for point clouds
 *
 * Features:
 * - sRGB to linear color space conversion (gamma correction)
 * - Rebuilding color attributes for all meshes
 * - Mapping color images to depth-derived point clouds
 * - Managing color removal from depth point clouds
 */

import * as THREE from 'three';
import { SpatialData, CameraParams, DepthConversionResult } from './interfaces';

export class ColorProcessor {
  private srgbToLinearLUT: Float32Array | null = null;

  /**
   * Ensure sRGB to linear LUT is created (lazy initialization)
   * Returns the LUT for use
   */
  ensureSrgbLUT(): Float32Array {
    if (this.srgbToLinearLUT) {
      return this.srgbToLinearLUT;
    }
    const lut = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const s = i / 255;
      lut[i] = s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    }
    this.srgbToLinearLUT = lut;
    return lut;
  }

  /**
   * Rebuild color attributes for a single mesh with current gamma settings
   */
  rebuildColorAttributes(
    spatialData: SpatialData,
    geometry: THREE.BufferGeometry,
    convertSrgbToLinear: boolean
  ): boolean {
    if (!spatialData.hasColors) {
      return false;
    }

    const positionAttr = geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
    if (!positionAttr) {
      return false;
    }

    const vertexCount = positionAttr.count;
    const colorsFloat = new Float32Array(vertexCount * 3);
    let filled = false;

    // Prefer original byte colors when available (typed arrays path)
    const typedColors: Uint8Array | null = (spatialData as any).colorsArray || null;
    if (typedColors && typedColors.length === colorsFloat.length) {
      if (convertSrgbToLinear) {
        const lut = this.ensureSrgbLUT();
        for (let j = 0; j < typedColors.length; j++) {
          colorsFloat[j] = lut[typedColors[j]];
        }
      } else {
        for (let j = 0; j < typedColors.length; j++) {
          colorsFloat[j] = typedColors[j] / 255;
        }
      }
      filled = true;
    }

    // Fallback: derive from per-vertex properties if present
    if (!filled && Array.isArray((spatialData as any).vertices)) {
      const verts: any[] = (spatialData as any).vertices;
      const count = Math.min(vertexCount, verts.length);
      const isDepthDerived = (spatialData as any).isDepthDerived;

      // Depth-derived colors are already linear, so don't apply gamma correction
      if (isDepthDerived) {
        for (let v = 0, o = 0; v < count; v++, o += 3) {
          const vert = verts[v];
          colorsFloat[o] = ((vert.red || 0) & 255) / 255;
          colorsFloat[o + 1] = ((vert.green || 0) & 255) / 255;
          colorsFloat[o + 2] = ((vert.blue || 0) & 255) / 255;
        }
      } else if (convertSrgbToLinear) {
        const lut = this.ensureSrgbLUT();
        for (let v = 0, o = 0; v < count; v++, o += 3) {
          const vert = verts[v];
          const r8 = (vert.red || 0) & 255;
          const g8 = (vert.green || 0) & 255;
          const b8 = (vert.blue || 0) & 255;
          colorsFloat[o] = lut[r8];
          colorsFloat[o + 1] = lut[g8];
          colorsFloat[o + 2] = lut[b8];
        }
      } else {
        for (let v = 0, o = 0; v < count; v++, o += 3) {
          const vert = verts[v];
          colorsFloat[o] = ((vert.red || 0) & 255) / 255;
          colorsFloat[o + 1] = ((vert.green || 0) & 255) / 255;
          colorsFloat[o + 2] = ((vert.blue || 0) & 255) / 255;
        }
      }
      filled = true;
    }

    if (filled) {
      geometry.setAttribute('color', new THREE.BufferAttribute(colorsFloat, 3));
      const colorAttr = geometry.getAttribute('color');
      if (colorAttr) {
        (colorAttr as any).needsUpdate = true;
      }
      return true;
    }

    return false;
  }

  /**
   * Apply color image data to depth conversion result
   * Maps colors from ImageData to 3D point cloud using pixel coordinates or reprojection
   */
  applyColorToDepthResult(
    result: DepthConversionResult,
    imageData: ImageData,
    cameraParams: CameraParams
  ): void {
    const colorData = imageData.data;
    const width = imageData.width;
    const height = imageData.height;

    // Create color array for vertices - use Uint8Array for memory efficiency (1/4 of Float32Array)
    // ImageData is always 8-bit per channel, so we keep it as Uint8Array
    const colors = new Uint8Array(result.pointCount * 3);
    let colorIndex = 0;

    // Default gray value for out-of-bounds or invalid points
    const defaultGray = 128;

    // Use stored pixel coordinates instead of reprojecting 3D points
    if (result.pixelCoords && result.pixelCoords.length === result.pointCount * 2) {
      console.log('🎨 Using stored pixel coordinates for color mapping');

      for (let i = 0; i < result.pointCount; i++) {
        const pixelIndex = i * 2;
        const u = Math.round(result.pixelCoords[pixelIndex]);
        const v = Math.round(result.pixelCoords[pixelIndex + 1]);

        // Check bounds and get color from original 2D pixel position
        if (u >= 0 && u < width && v >= 0 && v < height) {
          const colorPixelIndex = (v * width + u) * 4;
          colors[colorIndex++] = colorData[colorPixelIndex]; // R
          colors[colorIndex++] = colorData[colorPixelIndex + 1]; // G
          colors[colorIndex++] = colorData[colorPixelIndex + 2]; // B
        } else {
          // Default gray for out-of-bounds (shouldn't happen with stored coords)
          colors[colorIndex++] = defaultGray;
          colors[colorIndex++] = defaultGray;
          colors[colorIndex++] = defaultGray;
        }
      }
    } else {
      // Fallback: use 3D-to-2D reprojection method
      // Determine coordinate convention (default to 'opengl' as that's the standard for Three.js)
      const convention = cameraParams.convention || 'opengl';
      const isOpenGL = convention === 'opengl';

      console.log(
        `⚠️ Falling back to 3D-to-2D reprojection for color mapping (convention: ${convention})`
      );

      // Get camera intrinsics
      const fx = cameraParams.fx;
      const fy = cameraParams.fy || cameraParams.fx;
      const cx = cameraParams.cx!;
      const cy = cameraParams.cy!;

      for (let i = 0; i < result.pointCount; i++) {
        const vertexIndex = i * 3;
        let x = result.vertices[vertexIndex];
        let y = result.vertices[vertexIndex + 1];
        let z = result.vertices[vertexIndex + 2];

        // Skip invalid points (NaN, ±Infinity)
        if (isNaN(x) || isNaN(y) || isNaN(z) || !isFinite(x) || !isFinite(y) || !isFinite(z)) {
          colors[colorIndex++] = defaultGray;
          colors[colorIndex++] = defaultGray;
          colors[colorIndex++] = defaultGray;
          continue;
        }

        // Check for valid depth based on convention
        // OpenGL: -Z is forward (valid Z < 0), OpenCV: +Z is forward (valid Z > 0)
        const validDepth = isOpenGL ? z < 0 : z > 0;
        if (!validDepth) {
          colors[colorIndex++] = defaultGray;
          colors[colorIndex++] = defaultGray;
          colors[colorIndex++] = defaultGray;
          continue;
        }

        // Convert to OpenCV convention for reprojection if needed
        // OpenGL → OpenCV: flip Y (up→down) and Z (backward→forward)
        let xCV = x;
        let yCV = isOpenGL ? -y : y;
        let zCV = isOpenGL ? -z : z;

        // Project 3D point to image coordinates
        let u, v;
        if (cameraParams.cameraModel === 'fisheye-equidistant') {
          // Fisheye equidistant projection: r = f * theta
          const r = Math.sqrt(xCV * xCV + yCV * yCV);
          const theta = Math.atan2(r, zCV);
          const phi = Math.atan2(yCV, xCV);

          const rFish = fx * theta;
          u = Math.round(cx + rFish * Math.cos(phi));
          v = Math.round(cy + rFish * Math.sin(phi));
        } else {
          // Pinhole projection (ideal, no distortion)
          // For distorted models, pixelCoords should be used instead
          u = Math.round(fx * (xCV / zCV) + cx);
          v = Math.round(fy * (yCV / zCV) + cy);
        }

        // Check bounds and get color
        if (u >= 0 && u < width && v >= 0 && v < height) {
          const pixelIndex = (v * width + u) * 4;
          colors[colorIndex++] = colorData[pixelIndex]; // R
          colors[colorIndex++] = colorData[pixelIndex + 1]; // G
          colors[colorIndex++] = colorData[pixelIndex + 2]; // B
        } else {
          // Default gray for out-of-bounds
          colors[colorIndex++] = defaultGray;
          colors[colorIndex++] = defaultGray;
          colors[colorIndex++] = defaultGray;
        }
      }
    }

    result.colors = colors;
  }

  /**
   * Convert color array (0-255) to vertex colors with optional gamma correction
   */
  convertColorsToVertexFormat(colors: Uint8Array, convertSrgbToLinear: boolean): Float32Array {
    const colorsFloat = new Float32Array(colors.length);

    if (convertSrgbToLinear) {
      const lut = this.ensureSrgbLUT();
      for (let i = 0; i < colors.length; i++) {
        colorsFloat[i] = lut[colors[i]];
      }
    } else {
      for (let i = 0; i < colors.length; i++) {
        colorsFloat[i] = colors[i] / 255;
      }
    }

    return colorsFloat;
  }
}
