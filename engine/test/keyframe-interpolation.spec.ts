import { test, expect } from '@playwright/test';
import * as THREE from 'three';
import { CameraKeyframe, sampleTimeline } from '../src/film/keyframes';

function orbitKeyframes(count: number, radius: number): CameraKeyframe[] {
  return Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2;
    const position = new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
    const camera = new THREE.PerspectiveCamera();
    camera.position.copy(position);
    camera.lookAt(0, 0, 0);
    return {
      name: `Keyframe ${index + 1}`,
      position: position.toArray() as [number, number, number],
      target: [0, 0, 0],
      quaternion: camera.quaternion.toArray() as [number, number, number, number],
      fov: 75,
      duration: 1,
      dwell: 0,
    };
  });
}

test('pure rotational keyframes preserve their orbit radius', () => {
  const radius = 5;
  const keys = orbitKeyframes(10, radius);

  for (let t = 0; t < keys.length; t += 0.025) {
    const sample = sampleTimeline(keys, t, true);
    expect(sample.position.distanceTo(sample.target)).toBeCloseTo(radius, 8);
  }
});

test('a deliberate camera dolly still changes distance', () => {
  const keys = orbitKeyframes(2, 5);
  keys[1].position = [3, 0, 0];

  const sample = sampleTimeline(keys, 0.5, false);
  expect(sample.position.distanceTo(sample.target)).toBeLessThan(5);
  expect(sample.position.distanceTo(sample.target)).toBeGreaterThan(3);
});
