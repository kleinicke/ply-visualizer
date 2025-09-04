export interface CalibTxtData {
  cam0: {
    f: number;      // focal length in pixels
    cx: number;     // principal point x
    cy: number;     // principal point y
  };
  cam1: {
    f: number;      // focal length in pixels  
    cx: number;     // principal point x
    cy: number;     // principal point y
  };
  doffs: number;    // x-difference of principal points (cx1 - cx0)
  baseline: number; // camera baseline in mm
  width: number;    // image width in pixels
  height: number;   // image height in pixels
  ndisp: number;    // conservative bound on disparity levels
  isint: number;    // whether GT disparities have integer precision (0 or 1)
  vmin: number;     // minimum disparity for visualization
  vmax: number;     // maximum disparity for visualization  
  dyavg: number;    // average absolute y-disparity
  dymax: number;    // maximum absolute y-disparity
}

export interface CalibTxtCamera {
  name: string;
  fx: number;
  fy: number;
  cx: number;
  cy: number;
  baseline?: number; // only present for stereo pairs
}

/**
 * Parses a calib.txt file containing stereo camera calibration parameters.
 * 
 * Format:
 * cam0=[f 0 cx; 0 f cy; 0 0 1]
 * cam1=[f 0 cx; 0 f cy; 0 0 1] 
 * doffs=131.111
 * baseline=193.001
 * width=2964
 * height=1988
 * ndisp=280
 * isint=0
 * vmin=31
 * vmax=257
 * dyavg=0.918
 * dymax=1.516
 */
export class CalibTxtParser {
  /**
   * Parses calib.txt content and returns structured calibration data
   */
  static parse(content: string): CalibTxtData {
    const lines = content.trim().split('\n').map(line => line.trim());
    const result: Partial<CalibTxtData> = {};

    for (const line of lines) {
      if (line.startsWith('#') || line.length === 0) {
        continue; // Skip comments and empty lines
      }

      if (line.startsWith('cam0=')) {
        result.cam0 = this.parseCamera(line.substring(5));
      } else if (line.startsWith('cam1=')) {
        result.cam1 = this.parseCamera(line.substring(5));
      } else if (line.includes('=')) {
        const [key, value] = line.split('=', 2);
        const numValue = parseFloat(value);
        
        if (isNaN(numValue)) {
          throw new Error(`Invalid numeric value for ${key}: ${value}`);
        }

        switch (key.trim()) {
          case 'doffs':
            result.doffs = numValue;
            break;
          case 'baseline':
            result.baseline = numValue;
            break;
          case 'width':
            result.width = Math.round(numValue);
            break;
          case 'height':
            result.height = Math.round(numValue);
            break;
          case 'ndisp':
            result.ndisp = Math.round(numValue);
            break;
          case 'isint':
            result.isint = Math.round(numValue);
            break;
          case 'vmin':
            result.vmin = numValue;
            break;
          case 'vmax':
            result.vmax = numValue;
            break;
          case 'dyavg':
            result.dyavg = numValue;
            break;
          case 'dymax':
            result.dymax = numValue;
            break;
          default:
            console.warn(`Unknown calibration parameter: ${key}`);
        }
      }
    }

    // Validate required fields
    const requiredFields = ['cam0', 'cam1', 'doffs', 'baseline', 'width', 'height'];
    for (const field of requiredFields) {
      if (!(field in result)) {
        throw new Error(`Missing required calibration parameter: ${field}`);
      }
    }

    return result as CalibTxtData;
  }

  /**
   * Parses camera matrix in format [f 0 cx; 0 f cy; 0 0 1]
   */
  private static parseCamera(matrixStr: string): { f: number; cx: number; cy: number } {
    // Remove brackets and split by semicolons
    const cleaned = matrixStr.replace(/[\[\]]/g, '').trim();
    const rows = cleaned.split(';').map(row => row.trim());
    
    if (rows.length !== 3) {
      throw new Error(`Invalid camera matrix format: expected 3 rows, got ${rows.length}`);
    }

    // Parse first row: [f 0 cx]
    const row1 = rows[0].split(/\s+/).map(parseFloat);
    if (row1.length !== 3) {
      throw new Error(`Invalid camera matrix first row: expected 3 values, got ${row1.length}`);
    }
    const f = row1[0];
    const cx = row1[2];

    // Parse second row: [0 f cy] - verify f matches and extract cy
    const row2 = rows[1].split(/\s+/).map(parseFloat);
    if (row2.length !== 3) {
      throw new Error(`Invalid camera matrix second row: expected 3 values, got ${row2.length}`);
    }
    const fy = row2[1]; 
    const cy = row2[2];

    // Verify that fx == fy (as specified in the format)
    if (Math.abs(f - fy) > 1e-6) {
      console.warn(`Focal lengths differ: fx=${f}, fy=${fy}. Using fx=${f}`);
    }

    // Parse third row: [0 0 1] - just verify format
    const row3 = rows[2].split(/\s+/).map(parseFloat);
    if (row3.length !== 3 || row3[0] !== 0 || row3[1] !== 0 || row3[2] !== 1) {
      throw new Error(`Invalid camera matrix third row: expected [0 0 1], got [${row3.join(' ')}]`);
    }

    return { f, cx, cy };
  }

  /**
   * Converts CalibTxtData to a format compatible with the existing calibration system
   * Returns cameras as an object with cam0 and cam1 entries
   */
  static toCameraFormat(calibData: CalibTxtData): { cameras: Record<string, CalibTxtCamera> } {
    return {
      cameras: {
        cam0: {
          name: 'cam0',
          fx: calibData.cam0.f,
          fy: calibData.cam0.f, // fx == fy in this format
          cx: calibData.cam0.cx,
          cy: calibData.cam0.cy,
          baseline: calibData.baseline
        },
        cam1: {
          name: 'cam1', 
          fx: calibData.cam1.f,
          fy: calibData.cam1.f, // fx == fy in this format
          cx: calibData.cam1.cx,
          cy: calibData.cam1.cy,
          baseline: calibData.baseline
        }
      }
    };
  }

  /**
   * Validates that the calibration data is consistent
   */
  static validate(calibData: CalibTxtData): void {
    // Check that doffs matches the difference in principal points
    const computedDoffs = calibData.cam1.cx - calibData.cam0.cx;
    const tolerance = 1e-3;
    
    if (Math.abs(calibData.doffs - computedDoffs) > tolerance) {
      console.warn(
        `doffs inconsistency: specified=${calibData.doffs}, computed=${computedDoffs.toFixed(3)} ` +
        `(difference: ${Math.abs(calibData.doffs - computedDoffs).toFixed(3)})`
      );
    }

    // Check that baseline is positive
    if (calibData.baseline <= 0) {
      throw new Error(`Invalid baseline: ${calibData.baseline}. Must be positive.`);
    }

    // Check that focal lengths are positive
    if (calibData.cam0.f <= 0 || calibData.cam1.f <= 0) {
      throw new Error('Invalid focal lengths. Must be positive.');
    }

    // Check image dimensions
    if (calibData.width <= 0 || calibData.height <= 0) {
      throw new Error('Invalid image dimensions. Must be positive.');
    }
  }

  /**
   * Creates disparity-to-depth conversion function from calibration data
   * Z = baseline * f / (d + doffs)
   */
  static createDisparityToDepthConverter(calibData: CalibTxtData, cameraIndex: 0 | 1 = 0) {
    const camera = cameraIndex === 0 ? calibData.cam0 : calibData.cam1;
    const baseline = calibData.baseline; // in mm
    const f = camera.f; // focal length in pixels
    const doffs = calibData.doffs; // disparity offset

    return (disparity: number): number => {
      const dWithOffset = disparity + doffs;
      if (dWithOffset <= 0) {
        return NaN; // Invalid disparity
      }
      return (baseline * f) / dWithOffset; // Returns depth in mm
    };
  }
}