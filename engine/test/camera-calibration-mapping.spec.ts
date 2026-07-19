import { expect, test } from '@playwright/test';
import { ColmapParser } from '../src/depth/ColmapParser';
import { YamlCalibrationParser } from '../src/depth/YamlCalibrationParser';

test('COLMAP registry preserves exact OpenCV model identity and coefficient order', () => {
  const parsed = ColmapParser.parse(`
1 RADIAL 640 480 500 320 240 0.1 -0.02
2 OPENCV_FISHEYE 800 600 510 470 400 300 0.08 -0.02 0.004 -0.0005
`);
  const cameras = ColmapParser.toCameraFormat(parsed).cameras;
  expect(cameras.camera_1.camera_model).toBe('pinhole-opencv');
  expect(cameras.camera_1.coefficients).toEqual([0.1, -0.02, 0, 0, 0]);
  expect(cameras.camera_2.camera_model).toBe('fisheye-opencv');
  expect(cameras.camera_2.coefficients).toEqual([0.08, -0.02, 0.004, -0.0005]);
  expect(cameras.camera_2.source_camera_model).toBe('opencv_fisheye');
});

test('ROS equidistant calibration is not misread as pinhole distortion', () => {
  const result = YamlCalibrationParser.parse(
    `
image_width: 640
image_height: 480
camera_name: fisheye
camera_matrix: { rows: 3, cols: 3, data: [510, 0, 320, 0, 470, 240, 0, 0, 1] }
distortion_model: equidistant
distortion_coefficients: { rows: 1, cols: 4, data: [0.08, -0.02, 0.004, -0.0005] }
`,
    'camera_info.yaml'
  );
  const camera = YamlCalibrationParser.toCameraFormat(result).cameras.fisheye;
  expect(camera.camera_model).toBe('fisheye-opencv');
  expect(camera.coefficients).toEqual([0.08, -0.02, 0.004, -0.0005]);
});

test('Kalibr radtan ordering is converted to the explicit OpenCV layout', () => {
  const result = YamlCalibrationParser.parse(
    `
cam0:
  camera_model: pinhole
  intrinsics: [500, 490, 320, 240]
  distortion_model: radtan
  distortion_coeffs: [0.1, -0.02, 0.003, -0.004]
  resolution: [640, 480]
`,
    'camchain.yaml'
  );
  const camera = YamlCalibrationParser.toCameraFormat(result).cameras.cam0;
  expect(camera.camera_model).toBe('pinhole-opencv');
  expect(camera.coefficients).toEqual([0.1, -0.02, 0.003, -0.004, 0]);
});
