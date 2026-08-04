import { test, expect } from '@playwright/test';
import * as THREE from 'three';
import {
  cameraCentre,
  placementFor,
  verticalFovDegrees,
  viewDirection,
  worldToCameraQuaternion,
} from '../src/formats/colmap/colmapPose';
import type { ColmapImage } from '../src/formats/colmap/colmapModel';

/**
 * COLMAP pose conversion, checked against hand-computed values.
 *
 * These run in Node with no page: the maths is pure, and a rendered check
 * cannot tell a correct pose from a plausible-looking wrong one. Both classic
 * mistakes are covered explicitly - using the stored translation as a position
 * instead of inverting, and mixing up the quaternion component order.
 */

function image(
  qvec: ColmapImage['qvec'],
  tvec: ColmapImage['tvec'],
  overrides: Partial<ColmapImage> = {}
): ColmapImage {
  return { id: 1, qvec, tvec, cameraId: 1, name: 'test.jpg', ...overrides };
}

const IDENTITY: ColmapImage['qvec'] = [1, 0, 0, 0];

test('quaternion component order is COLMAP wxyz, not three xyzw', () => {
  // A 180 degrees rotation about X: COLMAP writes [qw, qx, qy, qz] = [0, 1, 0, 0].
  const q = worldToCameraQuaternion([0, 1, 0, 0]);
  expect(q.x).toBeCloseTo(1, 12);
  expect(q.y).toBeCloseTo(0, 12);
  expect(q.z).toBeCloseTo(0, 12);
  expect(q.w).toBeCloseTo(0, 12);
});

test('identity rotation puts the camera at minus the translation', () => {
  // With R = I the inverse is trivial, so C = -t. Reading t as the position
  // directly would give (1, 2, 3) and is the mistake this pins down.
  const centre = cameraCentre(image(IDENTITY, [1, 2, 3]));
  expect(centre.x).toBeCloseTo(-1, 12);
  expect(centre.y).toBeCloseTo(-2, 12);
  expect(centre.z).toBeCloseTo(-3, 12);
});

test('rotated pose inverts through the rotation, not around it', () => {
  // World-to-camera is +90 degrees about Y; t = (0, 0, 1).
  // R^T is -90 degrees about Y, so R^T * t = (-1, 0, 0) and C = (1, 0, 0).
  const halfRoot2 = Math.SQRT1_2;
  const centre = cameraCentre(image([halfRoot2, 0, halfRoot2, 0], [0, 0, 1]));
  expect(centre.x).toBeCloseTo(1, 12);
  expect(centre.y).toBeCloseTo(0, 12);
  expect(centre.z).toBeCloseTo(0, 12);
});

test('the camera centre maps to the origin of camera space', () => {
  // The defining property of the inverse: R * C + t = 0 for any pose. This is
  // the invariant that catches a transposed or half-applied inversion.
  const cases: Array<{ qvec: ColmapImage['qvec']; tvec: ColmapImage['tvec'] }> = [
    { qvec: [0.5, 0.5, 0.5, 0.5], tvec: [1.5, -2.25, 0.75] },
    { qvec: [0.9239, 0.3827, 0, 0], tvec: [-3, 4, 5] },
    { qvec: [0.7071, 0, 0, 0.7071], tvec: [0.1, 0.2, 0.3] },
  ];

  for (const { qvec, tvec } of cases) {
    const subject = image(qvec, tvec);
    const inCameraSpace = cameraCentre(subject)
      .applyQuaternion(worldToCameraQuaternion(qvec))
      .add(new THREE.Vector3(...tvec));
    expect(inCameraSpace.length()).toBeCloseTo(0, 9);
  }
});

test('an identity-pose camera looks along world +Z', () => {
  // COLMAP's optical axis is camera-space +Z (X right, Y down, Z forward).
  const direction = viewDirection(image(IDENTITY, [0, 0, 0]));
  expect(direction.x).toBeCloseTo(0, 12);
  expect(direction.y).toBeCloseTo(0, 12);
  expect(direction.z).toBeCloseTo(1, 12);
});

test('a camera rotated about Y looks sideways', () => {
  // Same +90 degrees about Y as above: R^T maps +Z to -X.
  const halfRoot2 = Math.SQRT1_2;
  const direction = viewDirection(image([halfRoot2, 0, halfRoot2, 0], [0, 0, 0]));
  expect(direction.x).toBeCloseTo(-1, 9);
  expect(direction.z).toBeCloseTo(0, 9);
});

test('placement rotation carries the camera-to-world orientation', () => {
  const subject = image([0.9239, 0.3827, 0, 0], [1, 2, 3]);
  const { quaternion } = placementFor(subject);
  // Applying it to +Z must agree with viewDirection, which is derived the
  // same way - a guard against the two drifting apart.
  const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(quaternion);
  const direction = viewDirection(subject);
  expect(forward.distanceTo(direction)).toBeCloseTo(0, 9);
});

test('vertical FOV reads fy from the right slot per model', () => {
  // PINHOLE is fx, fy, cx, cy - fy is params[1].
  const pinhole = verticalFovDegrees('PINHOLE', [1000, 500, 320, 240], 500);
  expect(pinhole).toBeCloseTo((2 * Math.atan(500 / 1000) * 180) / Math.PI, 9);

  // SIMPLE_PINHOLE is f, cx, cy - the single focal length serves both axes.
  const simple = verticalFovDegrees('SIMPLE_PINHOLE', [500, 320, 240], 500);
  expect(simple).toBeCloseTo((2 * Math.atan(500 / 1000) * 180) / Math.PI, 9);
});

test('vertical FOV is undefined for degenerate intrinsics', () => {
  expect(verticalFovDegrees('PINHOLE', [1000, 0, 320, 240], 500)).toBeUndefined();
  expect(verticalFovDegrees('PINHOLE', [1000, 500, 320, 240], 0)).toBeUndefined();
});
