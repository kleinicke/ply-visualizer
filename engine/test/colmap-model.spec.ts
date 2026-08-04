import { test, expect } from '@playwright/test';
import {
  looksLikeBinary,
  parseCamerasBinary,
  parseCamerasText,
  parseImagesBinary,
  parseImagesText,
  parsePoints3DBinary,
  parsePoints3DText,
} from '../src/formats/colmap/colmapModel';
import { verticalFovDegrees } from '../src/formats/colmap/colmapPose';
import {
  SAMPLE_CAMERAS,
  SAMPLE_IMAGES,
  SAMPLE_POINTS,
  camerasText,
  imagesText,
  points3DText,
  writeCamerasBinary,
  writeImagesBinary,
  writePoints3DBinary,
} from './helpers/colmapFixture';

/**
 * COLMAP model readers. The strongest check is that the two encodings of the
 * same reconstruction produce identical results - a field read in the wrong
 * order or a mis-sized skip shows up immediately as a mismatch against the
 * text form, which is trivially verifiable by eye.
 */

test('binary and text cameras agree', () => {
  const fromBinary = parseCamerasBinary(writeCamerasBinary(SAMPLE_CAMERAS));
  const fromText = parseCamerasText(camerasText());

  expect([...fromBinary.keys()].sort()).toEqual([1, 2]);
  expect([...fromText.keys()].sort()).toEqual([1, 2]);

  for (const id of [1, 2]) {
    expect(fromBinary.get(id)).toEqual(fromText.get(id));
  }

  expect(fromBinary.get(1)!.model).toBe('PINHOLE');
  expect(fromBinary.get(2)!.model).toBe('OPENCV');
  expect(fromBinary.get(2)!.params).toHaveLength(8);
});

test('binary and text images agree, including names and poses', () => {
  const fromBinary = parseImagesBinary(writeImagesBinary(SAMPLE_IMAGES));
  const fromText = parseImagesText(imagesText());

  expect(fromBinary).toEqual(fromText);
  expect(fromBinary).toHaveLength(3);
  expect(fromBinary[2].name).toBe('frame_0003.jpg');
  expect(fromBinary[2].cameraId).toBe(2);
  // Per-image 2D observations must be skipped, not misread as the next image.
  expect(fromBinary[1].tvec).toEqual([1, 2, 3]);
});

test('binary and text points agree, including colour and error', () => {
  const fromBinary = parsePoints3DBinary(writePoints3DBinary(SAMPLE_POINTS));
  const fromText = parsePoints3DText(points3DText());

  expect(fromBinary).toEqual(fromText);
  expect(fromBinary).toHaveLength(4);
  expect(fromBinary[0].rgb).toEqual([255, 0, 0]);
  expect(fromBinary[1].error).toBeCloseTo(1.25, 12);
});

test('image names containing spaces survive the text reader', () => {
  const images = parseImagesText(
    ['1 1 0 0 0 0 0 0 1 front left/0001.jpg', '0 0 -1', ''].join('\n')
  );
  expect(images).toHaveLength(1);
  expect(images[0].name).toBe('front left/0001.jpg');
});

test('encoding is detected from content, not the file name', () => {
  expect(looksLikeBinary(writeCamerasBinary(SAMPLE_CAMERAS))).toBe(true);
  expect(looksLikeBinary(new TextEncoder().encode(camerasText()))).toBe(false);
  expect(looksLikeBinary(new TextEncoder().encode(imagesText()))).toBe(false);
});

test('COLMAP 4.x camera models are known, including equirectangular', () => {
  // A 360 reconstruction from COLMAP 4.1 uses model id 17. Before these were
  // added the binary reader threw and the whole model failed to load.
  const bytes = writeCamerasBinary([
    { id: 1, modelId: 17, width: 4096, height: 2048, params: [4096, 2048] },
    { id: 2, modelId: 16, width: 640, height: 480, params: [500, 500, 320, 240, 0.5, 1.1] },
    {
      id: 3,
      modelId: 11,
      width: 640,
      height: 480,
      params: [500, 500, 320, 240, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    },
  ]);
  const cameras = parseCamerasBinary(bytes);
  expect(cameras.get(1)!.model).toBe('EQUIRECTANGULAR');
  expect(cameras.get(2)!.model).toBe('EUCM');
  expect(cameras.get(3)!.model).toBe('RAD_TAN_THIN_PRISM_FISHEYE');
  // Parameter counts must be exact or every camera after the first desyncs.
  expect(cameras.get(3)!.params).toHaveLength(16);
});

test('an equirectangular camera has no vertical FOV to report', () => {
  // It is parameterised by image size, not focal length; look-through must
  // fall back to the viewer FOV rather than dividing by a width.
  expect(verticalFovDegrees('EQUIRECTANGULAR', [4096, 2048], 2048)).toBeUndefined();
  // EUCM does carry fx, fy - fy is params[1].
  expect(verticalFovDegrees('EUCM', [500, 400, 320, 240, 0.5, 1.1], 480)).toBeCloseTo(
    (2 * Math.atan(480 / 800) * 180) / Math.PI,
    9
  );
});

test('an unknown binary camera model fails loudly', () => {
  // The parameter count is unknown, so the stream cannot be resynchronised -
  // silently skipping would misread every camera after it.
  const bytes = writeCamerasBinary([{ id: 1, modelId: 99, width: 10, height: 10, params: [1] }]);
  expect(() => parseCamerasBinary(bytes)).toThrow(/unknown camera model id 99/);
});

test('an unknown text camera model skips just that camera', () => {
  const cameras = parseCamerasText(
    ['1 NOT_A_MODEL 640 480 1 2 3', '2 PINHOLE 640 480 500 520 320 240'].join('\n')
  );
  expect([...cameras.keys()]).toEqual([2]);
});
