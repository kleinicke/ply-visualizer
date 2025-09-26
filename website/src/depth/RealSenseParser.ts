export interface RealSenseIntrinsics {
  fx: number;
  fy: number;
  ppx: number; // Principal point x
  ppy: number; // Principal point y
  coeffs: number[]; // Distortion coefficients
}

export interface RealSenseStream {
  width: number;
  height: number;
  fps: number;
  format: string;
  intrinsics: RealSenseIntrinsics;
}

export interface RealSenseExtrinsics {
  rotation: number[]; // 3x3 rotation matrix as flat array
  translation: number[]; // 3x1 translation vector
}

export interface RealSenseProfile {
  device?: {
    serial_number: string;
    firmware_version: string;
  };
  color_stream?: RealSenseStream;
  depth_stream?: RealSenseStream;
  extrinsics?: RealSenseExtrinsics;
}

export interface RealSenseCalibrationResult {
  cameras: Record<string, any>;
  baseline?: number;
}

/**
 * Parses Intel RealSense camera profile JSON files
 */
export class RealSenseParser {
  /**
   * Parse RealSense JSON profile content
   */
  static parse(content: string): RealSenseCalibrationResult {
    let data: RealSenseProfile;

    try {
      data = JSON.parse(content);
    } catch (error) {
      throw new Error(
        `Invalid JSON format: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    const cameras: Record<string, any> = {};
    let baseline: number | undefined;

    // Parse color stream
    if (data.color_stream && data.color_stream.intrinsics) {
      const colorCam = this.parseStreamToCamera('color', data.color_stream);
      cameras.color = colorCam;
    }

    // Parse depth stream
    if (data.depth_stream && data.depth_stream.intrinsics) {
      const depthCam = this.parseStreamToCamera('depth', data.depth_stream);
      cameras.depth = depthCam;
    }

    // Calculate baseline from extrinsics if available
    if (data.extrinsics && data.extrinsics.translation) {
      // Baseline is typically the magnitude of translation (in mm)
      const translation = data.extrinsics.translation;
      baseline =
        Math.sqrt(
          translation[0] * translation[0] +
            translation[1] * translation[1] +
            translation[2] * translation[2]
        ) * 1000; // Convert m to mm

      // Add baseline to depth camera (typically used for stereo depth)
      if (cameras.depth) {
        cameras.depth.baseline = baseline;
      }
    }

    if (Object.keys(cameras).length === 0) {
      throw new Error('No valid camera streams found in RealSense profile');
    }

    return {
      cameras,
      baseline,
    };
  }

  /**
   * Convert stream to camera format
   */
  private static parseStreamToCamera(name: string, stream: RealSenseStream): any {
    const intrinsics = stream.intrinsics;

    const camera = {
      name,
      fx: intrinsics.fx,
      fy: intrinsics.fy,
      cx: intrinsics.ppx,
      cy: intrinsics.ppy,
      width: stream.width,
      height: stream.height,
      camera_model: 'pinhole-ideal' as string,
    };

    // Add distortion coefficients if present
    if (intrinsics.coeffs && intrinsics.coeffs.length >= 5) {
      camera.camera_model = 'pinhole-opencv';
      const coeffs = intrinsics.coeffs;

      // RealSense typically uses Brown-Conrady model: [k1, k2, p1, p2, k3]
      if (
        coeffs[0] !== 0 ||
        coeffs[1] !== 0 ||
        coeffs[2] !== 0 ||
        coeffs[3] !== 0 ||
        coeffs[4] !== 0
      ) {
        (camera as any).k1 = coeffs[0];
        (camera as any).k2 = coeffs[1];
        (camera as any).p1 = coeffs[2];
        (camera as any).p2 = coeffs[3];
        (camera as any).k3 = coeffs[4];
      }
    }

    return camera;
  }

  /**
   * Convert to 3D Visualizer camera format
   */
  static toCameraFormat(result: RealSenseCalibrationResult): { cameras: Record<string, any> } {
    return { cameras: result.cameras };
  }

  /**
   * Validate RealSense JSON format
   */
  static validate(content: string): boolean {
    try {
      const data = JSON.parse(content);

      // Check for RealSense-specific structure
      const hasRealSenseStructure =
        data.color_stream?.intrinsics ||
        data.depth_stream?.intrinsics ||
        data.device?.serial_number;

      // Check for intrinsics format
      const hasIntrinsics =
        data.color_stream?.intrinsics?.fx !== undefined ||
        data.depth_stream?.intrinsics?.fx !== undefined;

      return hasRealSenseStructure && hasIntrinsics;
    } catch {
      return false;
    }
  }

  /**
   * Check if JSON content is likely a RealSense profile
   */
  static isRealSenseFormat(content: string): boolean {
    try {
      const data = JSON.parse(content);
      return !!(
        data.color_stream ||
        data.depth_stream ||
        (data.device && data.device.serial_number)
      );
    } catch {
      return false;
    }
  }
}
