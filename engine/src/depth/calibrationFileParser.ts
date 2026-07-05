import { CalibTxtParser } from './CalibTxtParser';
import { YamlCalibrationParser } from './YamlCalibrationParser';
import { ColmapParser } from './ColmapParser';
import { ZedParser } from './ZedParser';
import { RealSenseParser } from './RealSenseParser';
import { TumParser } from './TumParser';

/**
 * Parse calibration file content based on format
 */
export function parseCalibrationFile(content: string, fileName: string): any {
  const lowerFileName = fileName.toLowerCase();

  try {
    // Try different parsers based on file extension and content

    // JSON formats (3D Visualizer, RealSense)
    if (lowerFileName.endsWith('.json')) {
      // Check if it's RealSense format
      if (RealSenseParser.isRealSenseFormat(content)) {
        console.log('🔍 Detected RealSense JSON format');
        const result = RealSenseParser.parse(content);
        return RealSenseParser.toCameraFormat(result);
      } else {
        // Standard 3D Visualizer JSON format
        console.log('🔍 Detected 3D Visualizer JSON format');
        return JSON.parse(content);
      }
    }

    // YAML formats (OpenCV, ROS, Stereo, Kalibr)
    else if (lowerFileName.endsWith('.yml') || lowerFileName.endsWith('.yaml')) {
      console.log('🔍 Detected YAML format');
      const result = YamlCalibrationParser.parse(content, fileName);
      return YamlCalibrationParser.toCameraFormat(result);
    }

    // XML formats (OpenCV)
    else if (lowerFileName.endsWith('.xml')) {
      alert(
        'XML format parsing is not yet implemented. Please use YAML format for OpenCV calibrations.'
      );
      return null;
    }

    // Conf formats (ZED)
    else if (lowerFileName.endsWith('.conf')) {
      console.log('🔍 Detected ZED .conf format');
      const result = ZedParser.parse(content);
      return ZedParser.toCameraFormat(result);
    }

    // Text formats (TXT)
    else if (lowerFileName.endsWith('.txt')) {
      // Try different TXT parsers

      // Check for Middlebury calib.txt format
      if (
        lowerFileName.includes('calib') ||
        content.includes('cam0=') ||
        content.includes('baseline=')
      ) {
        console.log('🔍 Detected Middlebury calib.txt format');
        const calibTxtData = CalibTxtParser.parse(content);
        CalibTxtParser.validate(calibTxtData);

        const calibrationData = CalibTxtParser.toCameraFormat(calibTxtData);
        (calibrationData as any)._calibTxtData = calibTxtData;

        console.log(
          `✅ Loaded calib.txt with cameras: ${Object.keys(calibrationData.cameras).join(', ')}\n📏 Baseline: ${calibTxtData.baseline} mm\n🔍 Image size: ${calibTxtData.width}x${calibTxtData.height}`
        );

        return calibrationData;
      }

      // Check for COLMAP format
      else if (ColmapParser.validate(content)) {
        console.log('🔍 Detected COLMAP cameras.txt format');
        const result = ColmapParser.parse(content);
        return ColmapParser.toCameraFormat(result);
      }

      // Check for TUM format
      else if (TumParser.isTumFormat(content, fileName)) {
        console.log('🔍 Detected TUM camera.txt format');
        const result = TumParser.parse(content, fileName);
        return TumParser.toCameraFormat(result);
      } else {
        alert(
          'Unknown TXT calibration format. Supported TXT formats: Middlebury calib.txt, COLMAP cameras.txt, TUM camera.txt'
        );
        return null;
      }
    }

    // INI formats
    else if (lowerFileName.endsWith('.ini')) {
      alert('INI format parsing is not yet implemented.');
      return null;
    } else {
      alert(
        `Unsupported calibration file format: ${fileName}\n\nSupported formats:\n• JSON (.json) - 3D Visualizer, RealSense\n• YAML (.yml, .yaml) - OpenCV, ROS, Stereo, Kalibr\n• TXT (.txt) - Middlebury calib.txt, COLMAP cameras.txt, TUM camera.txt\n• CONF (.conf) - ZED calibration`
      );
      return null;
    }
  } catch (error) {
    console.error('Error parsing calibration file:', error);
    alert(
      `Failed to parse calibration file: ${error instanceof Error ? error.message : String(error)}`
    );
    return null;
  }
}
