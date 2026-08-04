import { test, expect } from '@playwright/test';
import * as THREE from 'three';
import { boundsAreOutlierDominated, robustPointBounds } from '../src/visualization/robustBounds';

/**
 * Framing bounds that survive stray points.
 *
 * The guarantee that matters in both directions: an outlier-stretched box gets
 * replaced, and a clean one does not - so existing formats keep the framing
 * they had.
 */

function cube(count: number, half: number): Float32Array {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    // Deterministic spread across the cube, no RNG so the test cannot flake.
    positions[i * 3] = ((i % 10) / 9) * 2 * half - half;
    positions[i * 3 + 1] = (((i / 10) % 10) / 9) * 2 * half - half;
    positions[i * 3 + 2] = (((i / 100) % 10) / 9) * 2 * half - half;
  }
  return positions;
}

test('a clean cloud keeps essentially its full extent', () => {
  const positions = cube(1000, 5);
  const robust = robustPointBounds(positions)!;
  const full = new THREE.Box3().setFromArray(Array.from(positions));

  expect(robust).not.toBeNull();
  expect(boundsAreOutlierDominated(full, robust)).toBe(false);
});

test('a single far outlier is trimmed away', () => {
  const positions = cube(1000, 5);
  // One point a hundred times further out than everything else.
  positions[0] = 500;
  positions[1] = 500;
  positions[2] = 500;

  const robust = robustPointBounds(positions)!;
  const full = new THREE.Box3().setFromArray(Array.from(positions));

  expect(full.max.x).toBeCloseTo(500, 3);
  expect(robust.max.x).toBeLessThan(10);
  expect(boundsAreOutlierDominated(full, robust)).toBe(true);
});

test('the trimmed centre lands on the bulk of the points, not between them', () => {
  const positions = cube(1000, 5);
  positions[0] = 1000;
  positions[1] = 1000;
  positions[2] = 1000;

  const full = new THREE.Box3().setFromArray(Array.from(positions));
  const robust = robustPointBounds(positions)!;

  // The full box centre is dragged halfway to the outlier; the trimmed one
  // stays near the origin where the cloud actually is.
  expect(full.getCenter(new THREE.Vector3()).length()).toBeGreaterThan(100);
  expect(robust.getCenter(new THREE.Vector3()).length()).toBeLessThan(2);
});

test('too few points to trim returns null rather than a guess', () => {
  expect(robustPointBounds(new Float32Array(30))).toBeNull();
});
