import { test, expect } from '@playwright/test';
import * as THREE from 'three';
import { projectedPointPixels } from '../src/visualization/PointCloudRenderer';

test('projected point size follows a visible surface instead of the cloud centre', () => {
  const camera = new THREE.PerspectiveCamera(60, 1, 0.001, 1000);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();

  const positions = new Float32Array(1000 * 3);
  for (let index = 0; index < 1000; index++) {
    // Twenty percent of the cloud forms a close surface. Its shape should be
    // resolvable even though the remaining points pull the cloud centre far away.
    positions[index * 3 + 2] = index < 200 ? -1 : -100;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const viewportHeight = 500;
  const material = new THREE.PointsMaterial({
    size: 5 / (viewportHeight * 0.5),
    sizeAttenuation: true,
  });
  const points = new THREE.Points(geometry, material);

  expect(projectedPointPixels(points, camera, viewportHeight)).toBeCloseTo(5, 8);
});
