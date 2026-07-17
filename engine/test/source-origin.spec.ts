import { expect, test } from '@playwright/test';
import { SpatialData } from '../src/interfaces';
import { alignSourceOrigin } from '../src/utils/sourceOrigin';

const cloud = (origin: [number, number, number], x: number): SpatialData => ({
  vertices: [],
  faces: [],
  format: 'binary_little_endian',
  version: '1.0',
  comments: [],
  vertexCount: 1,
  faceCount: 0,
  hasColors: false,
  hasNormals: false,
  useTypedArrays: true,
  positionsArray: new Float32Array([x, 0, 0]),
  sourceOrigin: origin,
});

test('multiple georeferenced files share a precise scene origin', () => {
  const first = cloud([4_000_000, 500_000, 100], 1);
  const second = cloud([4_000_010, 500_000, 100], 2);
  alignSourceOrigin(first, []);
  alignSourceOrigin(second, [first]);
  expect(Array.from(first.positionsArray!)).toEqual([1, 0, 0]);
  expect(Array.from(second.positionsArray!)).toEqual([12, 0, 0]);
  expect(second.sourceOrigin).toEqual(first.sourceOrigin);
});
