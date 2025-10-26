import { CameraParams, DepthConversionResult, SpatialVertex } from '../interfaces';
import { registerDefaultReaders, readDepth, registerReader } from './DepthRegistry';
import { normalizeDepth, projectToPointCloud } from './DepthProjector';
import { PngReader } from './readers/PngReader';
import { TifReader } from './readers/TifReader';

/**
 * Handles depth image to point cloud conversion
 * Extracted from main.ts to reduce file bloat
 */
export class DepthConverter {
  /**
   * Convert DepthConversionResult (Float32Arrays) to SpatialVertex array
   * This is a utility method used by various parts of the depth processing pipeline
   */
  static convertResultToVertices(result: DepthConversionResult): SpatialVertex[] {
    const vertices: SpatialVertex[] = [];

    for (let i = 0; i < result.pointCount; i++) {
      const i3 = i * 3;
      const vertex: SpatialVertex = {
        x: result.vertices[i3],
        y: result.vertices[i3 + 1],
        z: result.vertices[i3 + 2],
      };

      if (result.colors) {
        vertex.red = Math.round(result.colors[i3] * 255);
        vertex.green = Math.round(result.colors[i3 + 1] * 255);
        vertex.blue = Math.round(result.colors[i3 + 2] * 255);
      }

      vertices.push(vertex);
    }

    return vertices;
  }
  /**
   * Convert depth image data to point cloud
   * This is the main entry point for depth conversion
   */
  async processDepthToPointCloud(
    depthData: ArrayBuffer,
    fileName: string,
    cameraParams: CameraParams
  ): Promise<DepthConversionResult> {
    try {
      console.log(
        `[2025-10-25T${new Date().toISOString().split('T')[1]}] Converting depth image to point cloud...`
      );

      registerDefaultReaders();

      // RGB24 conversion settings from user
      const rgb24ConversionMode = cameraParams.rgb24ConversionMode || 'shift';
      const rgb24ScaleFactor = cameraParams.rgb24ScaleFactor || 1000;
      const rgb24InvalidValue = cameraParams.rgb24InvalidValue;

      // Configure PNG reader with user settings
      if (/\.png$/i.test(fileName)) {
        const pngReader = new PngReader();
        pngReader.setConfig({
          pngScaleFactor: cameraParams.pngScaleFactor || 1000,
          invalidValue: 0,
          rgb24ConversionMode,
          rgb24ScaleFactor,
          rgb24InvalidValue,
        });
        registerReader(pngReader);
        console.log(
          `[DepthConverter] Configured PngReader: pngScale=${cameraParams.pngScaleFactor || 1000}, rgb24Scale=${rgb24ScaleFactor}, rgb24Mode=${rgb24ConversionMode}`
        );
      }

      // Configure TIF reader with user settings
      if (/\.tif(f)?$/i.test(fileName)) {
        const tifReader = new TifReader();
        tifReader.setConfig({
          rgb24ConversionMode,
          rgb24ScaleFactor,
          rgb24InvalidValue,
        });
        registerReader(tifReader);
        console.log(
          `[DepthConverter] Configured TifReader: rgb24Scale=${rgb24ScaleFactor}, rgb24Mode=${rgb24ConversionMode}`
        );
      }

      const { image, meta: baseMeta } = await readDepth(fileName, depthData);

      // Auto-calculate cx/cy if not provided
      const computedCx = (image.width - 1) / 2;
      const computedCy = (image.height - 1) / 2;

      if (cameraParams.cx === undefined) {
        cameraParams.cx = computedCx;
      }
      if (cameraParams.cy === undefined) {
        cameraParams.cy = computedCy;
      }

      // Set up camera parameters
      const fx = cameraParams.fx;
      const fy = cameraParams.fy || cameraParams.fx;
      const cx = cameraParams.cx !== undefined ? cameraParams.cx : computedCx;
      const cy = cameraParams.cy !== undefined ? cameraParams.cy : computedCy;

      // Override depth kind based on UI selection
      const meta: any = { ...baseMeta };

      if (cameraParams.depthType === 'disparity') {
        const fxOk = !!cameraParams.fx && cameraParams.fx > 0;
        const blOk = !!cameraParams.baseline && cameraParams.baseline > 0;
        if (fxOk && blOk) {
          meta.kind = 'disparity';
          meta.baseline = cameraParams.baseline! / 1000; // Convert mm to meters
          meta.disparityOffset = cameraParams.disparityOffset || 0;
        } else {
          console.warn(
            'Disparity mode requires baseline and focal length; using original depth type'
          );
        }
      } else if (cameraParams.depthType === 'orthogonal') {
        meta.kind = 'z';
      } else if (cameraParams.depthType === 'euclidean') {
        meta.kind = 'depth';
      } else if (cameraParams.depthType === 'inverse_depth') {
        meta.kind = 'inverse_depth';
      }

      const norm = normalizeDepth(image, {
        ...meta,
        fx,
        fy,
        cx,
        cy,
        baseline: meta.baseline,
        depthScale: cameraParams.depthScale,
        depthBias: cameraParams.depthBias,
      });

      // Prepare projection parameters
      const projectionParams = {
        kind: meta.kind,
        fx,
        fy,
        cx,
        cy,
        cameraModel: cameraParams.cameraModel,
        convention: cameraParams.convention || 'opengl',
        k1: cameraParams.k1 ? parseFloat(cameraParams.k1.toString()) : undefined,
        k2: cameraParams.k2 ? parseFloat(cameraParams.k2.toString()) : undefined,
        k3: cameraParams.k3 ? parseFloat(cameraParams.k3.toString()) : undefined,
        k4: cameraParams.k4 ? parseFloat(cameraParams.k4.toString()) : undefined,
        k5: cameraParams.k5 ? parseFloat(cameraParams.k5.toString()) : undefined,
        p1: cameraParams.p1 ? parseFloat(cameraParams.p1.toString()) : undefined,
        p2: cameraParams.p2 ? parseFloat(cameraParams.p2.toString()) : undefined,
      };

      // Single consolidated log for conversion parameters
      console.log(`🚀 DEPTH-TO-POINT-CLOUD CONVERSION
📁 File: ${fileName}
📏 Image Dimensions: ${norm.width}×${norm.height}
🎯 Depth Type (kind): ${meta.kind}
📷 Camera Model: ${projectionParams.cameraModel}
🔧 Coordinate Convention: ${projectionParams.convention}
🔍 Intrinsic Parameters:
  - fx (focal length x): ${fx}
  - fy (focal length y): ${fy}
  - cx (principal point x): ${cx}
  - cy (principal point y): ${cy}
📐 Distortion Coefficients:
  - k1 (radial): ${projectionParams.k1 ?? 'not set'}
  - k2 (radial): ${projectionParams.k2 ?? 'not set'}
  - k3 (radial): ${projectionParams.k3 ?? 'not set'}
  - k4 (radial): ${projectionParams.k4 ?? 'not set'}
  - k5 (radial): ${projectionParams.k5 ?? 'not set'}
  - p1 (tangential): ${projectionParams.p1 ?? 'not set'}
  - p2 (tangential): ${projectionParams.p2 ?? 'not set'}
💾 Normalization Parameters:
  - baseline: ${meta.baseline ?? 'not set'}
  - depthScale: ${cameraParams.depthScale ?? 'not set'}
  - depthBias: ${cameraParams.depthBias ?? 'not set'}`);

      const result = projectToPointCloud(norm, projectionParams);

      console.log(`TIF to PLY conversion complete: ${result.pointCount} points`);

      return result as unknown as DepthConversionResult;
    } catch (error) {
      throw new Error(
        `Failed to process depth file: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
