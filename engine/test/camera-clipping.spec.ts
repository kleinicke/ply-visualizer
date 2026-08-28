import { test, expect } from '@playwright/test';
import * as THREE from 'three';
import { applyFixedClipPlanes, FIXED_CAMERA_FAR, FIXED_CAMERA_NEAR } from '../src/cameraClipping';

test('restores the fixed viewer clipping planes', () => {
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1_000_000);

  applyFixedClipPlanes(camera);

  expect(camera.near).toBe(FIXED_CAMERA_NEAR);
  expect(camera.far).toBe(FIXED_CAMERA_FAR);
});
