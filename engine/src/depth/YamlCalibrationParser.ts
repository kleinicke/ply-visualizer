import * as yaml from 'js-yaml';

export interface YamlCameraData {
  name: string;
  fx: number;
  fy: number;
  cx: number;
  cy: number;
  k1?: number;
  k2?: number;
  k3?: number;
  p1?: number;
  p2?: number;
  baseline?: number;
  width?: number;
  height?: number;
}

export interface YamlCalibrationResult {
  cameras: Record<string, YamlCameraData>;
  stereoBaseline?: number;
}

/**
 * Parses YAML calibration files in various formats:
 * - OpenCV camera_matrix format
 * - ROS camera_info format
 * - Stereo calibration format
 * - Kalibr camchain format
 */
export class YamlCalibrationParser {
  /**
   * Parse YAML content and detect format automatically
   */
  static parse(content: string, fileName: string): YamlCalibrationResult {
    try {
      const data = yaml.load(content) as any;

      if (!data || typeof data !== 'object') {
        throw new Error('Invalid YAML format');
      }

      // Detect format based on content structure
      if (data.camera_matrix || data.distortion_coefficients) {
        return this.parseOpenCVFormat(data, fileName);
      } else if (data.image_width && data.camera_matrix && data.distortion_model) {
        return this.parseROSFormat(data, fileName);
      } else if (data.left_camera_matrix || data.right_camera_matrix) {
        return this.parseStereoFormat(data, fileName);
      } else if (data.cam0 || data.cam1) {
        return this.parseKalibrFormat(data, fileName);
      } else {
        throw new Error('Unknown YAML calibration format');
      }
    } catch (error) {
      throw new Error(
        `Failed to parse YAML: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Parse OpenCV camera_matrix.yml format
   */
  private static parseOpenCVFormat(data: any, fileName: string): YamlCalibrationResult {
    const matrix = this.parseOpenCVMatrix(data.camera_matrix);
    const distortion = data.distortion_coefficients
      ? this.parseOpenCVMatrix(data.distortion_coefficients)
      : null;

    const fx = matrix[0];
    const fy = matrix[4];
    const cx = matrix[2];
    const cy = matrix[5];

    const camera: YamlCameraData = {
      name: 'camera',
      fx,
      fy,
      cx,
      cy,
    };

    if (distortion && distortion.length >= 5) {
      camera.k1 = distortion[0];
      camera.k2 = distortion[1];
      camera.p1 = distortion[2];
      camera.p2 = distortion[3];
      camera.k3 = distortion[4];
    }

    if (data.image_width) {
      camera.width = data.image_width;
    }
    if (data.image_height) {
      camera.height = data.image_height;
    }

    return {
      cameras: { camera },
    };
  }

  /**
   * Parse ROS camera_info.yaml format
   */
  private static parseROSFormat(data: any, fileName: string): YamlCalibrationResult {
    const matrixData = data.camera_matrix.data;
    const fx = matrixData[0];
    const fy = matrixData[4];
    const cx = matrixData[2];
    const cy = matrixData[5];

    const camera: YamlCameraData = {
      name: data.camera_name || 'camera',
      fx,
      fy,
      cx,
      cy,
      width: data.image_width,
      height: data.image_height,
    };

    if (data.distortion_coefficients && data.distortion_coefficients.data) {
      const distortion = data.distortion_coefficients.data;
      if (distortion.length >= 5) {
        camera.k1 = distortion[0];
        camera.k2 = distortion[1];
        camera.p1 = distortion[2];
        camera.p2 = distortion[3];
        camera.k3 = distortion[4];
      }
    }

    return {
      cameras: { [camera.name]: camera },
    };
  }

  /**
   * Parse stereo_calibration.yml format
   */
  private static parseStereoFormat(data: any, fileName: string): YamlCalibrationResult {
    const cameras: Record<string, YamlCameraData> = {};

    // Parse left camera
    if (data.left_camera_matrix) {
      const leftMatrix = this.parseOpenCVMatrix(data.left_camera_matrix);
      const leftDistortion = data.left_distortion
        ? this.parseOpenCVMatrix(data.left_distortion)
        : null;

      cameras.left = {
        name: 'left',
        fx: leftMatrix[0],
        fy: leftMatrix[4],
        cx: leftMatrix[2],
        cy: leftMatrix[5],
      };

      if (leftDistortion && leftDistortion.length >= 5) {
        cameras.left.k1 = leftDistortion[0];
        cameras.left.k2 = leftDistortion[1];
        cameras.left.p1 = leftDistortion[2];
        cameras.left.p2 = leftDistortion[3];
        cameras.left.k3 = leftDistortion[4];
      }
    }

    // Parse right camera
    if (data.right_camera_matrix) {
      const rightMatrix = this.parseOpenCVMatrix(data.right_camera_matrix);
      const rightDistortion = data.right_distortion
        ? this.parseOpenCVMatrix(data.right_distortion)
        : null;

      cameras.right = {
        name: 'right',
        fx: rightMatrix[0],
        fy: rightMatrix[4],
        cx: rightMatrix[2],
        cy: rightMatrix[5],
      };

      if (rightDistortion && rightDistortion.length >= 5) {
        cameras.right.k1 = rightDistortion[0];
        cameras.right.k2 = rightDistortion[1];
        cameras.right.p1 = rightDistortion[2];
        cameras.right.p2 = rightDistortion[3];
        cameras.right.k3 = rightDistortion[4];
      }
    }

    // Add baseline to both cameras if available
    const baseline = data.baseline;
    if (baseline && cameras.left && cameras.right) {
      cameras.left.baseline = baseline;
      cameras.right.baseline = baseline;
    }

    return {
      cameras,
      stereoBaseline: baseline,
    };
  }

  /**
   * Parse Kalibr camchain.yaml format
   */
  private static parseKalibrFormat(data: any, fileName: string): YamlCalibrationResult {
    const cameras: Record<string, YamlCameraData> = {};
    let baseline: number | undefined;

    // Parse each camera
    for (const [camName, camData] of Object.entries(data)) {
      const cam = camData as any;

      if (cam.camera_model && cam.intrinsics) {
        const intrinsics = cam.intrinsics;

        const camera: YamlCameraData = {
          name: camName,
          fx: intrinsics[0],
          fy: intrinsics[1],
          cx: intrinsics[2],
          cy: intrinsics[3],
        };

        if (cam.distortion_coeffs && cam.distortion_coeffs.length >= 4) {
          camera.k1 = cam.distortion_coeffs[0];
          camera.k2 = cam.distortion_coeffs[1];
          camera.p1 = cam.distortion_coeffs[2];
          camera.p2 = cam.distortion_coeffs[3];
          if (cam.distortion_coeffs.length > 4) {
            camera.k3 = cam.distortion_coeffs[4];
          }
        }

        if (cam.resolution) {
          camera.width = cam.resolution[0];
          camera.height = cam.resolution[1];
        }

        // Extract baseline from transform matrix if available
        if (cam.T_cn_cnm1) {
          const transform = cam.T_cn_cnm1;
          if (Array.isArray(transform) && transform.length >= 1) {
            // Baseline is typically the translation in X direction (mm)
            baseline = Math.abs(transform[0][3] * 1000); // Convert m to mm
            camera.baseline = baseline;
          }
        }

        cameras[camName] = camera;
      }
    }

    // Add baseline to all cameras if found
    if (baseline) {
      for (const camera of Object.values(cameras)) {
        camera.baseline = baseline;
      }
    }

    return {
      cameras,
      stereoBaseline: baseline,
    };
  }

  /**
   * Parse OpenCV matrix format
   */
  private static parseOpenCVMatrix(matrix: any): number[] {
    if (!matrix || !matrix.data) {
      throw new Error('Invalid OpenCV matrix format');
    }

    return matrix.data as number[];
  }

  /**
   * Convert to 3D Visualizer camera format
   */
  static toCameraFormat(result: YamlCalibrationResult): { cameras: Record<string, any> } {
    const cameras: Record<string, any> = {};

    for (const [name, cam] of Object.entries(result.cameras)) {
      cameras[name] = {
        name: cam.name,
        fx: cam.fx,
        fy: cam.fy,
        cx: cam.cx,
        cy: cam.cy,
        baseline: cam.baseline,
        k1: cam.k1,
        k2: cam.k2,
        k3: cam.k3,
        p1: cam.p1,
        p2: cam.p2,
        width: cam.width,
        height: cam.height,
      };
    }

    return { cameras };
  }
}
