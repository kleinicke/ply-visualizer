import { StereoCalibration, CameraIntrinsics } from './types';

export class CalibrationParser {
  static parseMiddleburyCalib(content: string): StereoCalibration {
    const lines = content.trim().split('\n');
    const result: Partial<StereoCalibration> = {};

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      if (trimmed.startsWith('cam0=')) {
        result.cam0 = this.parseCameraMatrix(trimmed.substring(5));
      } else if (trimmed.startsWith('cam1=')) {
        result.cam1 = this.parseCameraMatrix(trimmed.substring(5));
      } else if (trimmed.startsWith('baseline=')) {
        result.baseline = parseFloat(trimmed.substring(9));
      } else if (trimmed.startsWith('doffs=')) {
        result.doffs = parseFloat(trimmed.substring(6));
      } else if (trimmed.startsWith('width=')) {
        result.width = parseInt(trimmed.substring(6));
      } else if (trimmed.startsWith('height=')) {
        result.height = parseInt(trimmed.substring(7));
      } else if (trimmed.startsWith('ndisp=')) {
        result.ndisp = parseInt(trimmed.substring(6));
      } else if (trimmed.startsWith('vmin=')) {
        result.vmin = parseInt(trimmed.substring(5));
      } else if (trimmed.startsWith('vmax=')) {
        result.vmax = parseInt(trimmed.substring(5));
      }
    }

    // Validate required fields
    if (!result.cam0 || !result.cam1 || result.baseline === undefined || 
        result.width === undefined || result.height === undefined) {
      throw new Error('Invalid calibration file: missing required camera parameters');
    }

    return result as StereoCalibration;
  }

  private static parseCameraMatrix(matrixStr: string): CameraIntrinsics {
    // Parse matrix format: [fx 0 cx; 0 fy cy; 0 0 1]
    const cleanStr = matrixStr.replace(/[\[\];]/g, '').trim();
    const values = cleanStr.split(/\s+/).map(v => parseFloat(v));
    
    if (values.length !== 9) {
      throw new Error('Invalid camera matrix format');
    }

    // Extract intrinsic parameters from 3x3 matrix
    // [fx  0 cx]
    // [ 0 fy cy]
    // [ 0  0  1]
    return {
      fx: values[0],  // [0,0]
      fy: values[4],  // [1,1]  
      cx: values[2],  // [0,2]
      cy: values[5]   // [1,2]
    };
  }

  static convertToDepthParameters(calib: StereoCalibration): {
    fx: number;
    fy: number;
    cx: number;
    cy: number;
    baseline: number;
    doffs: number;
  } {
    // Use cam0 parameters for depth projection
    return {
      fx: calib.cam0.fx,
      fy: calib.cam0.fy,
      cx: calib.cam0.cx,
      cy: calib.cam0.cy,
      baseline: calib.baseline,
      doffs: calib.doffs
    };
  }
}