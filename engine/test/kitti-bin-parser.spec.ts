import { expect, test } from '@playwright/test';
import { KittiBinParser } from '../src/parsers/kittiBinParser';

function encodePoints(points: number[][], byteOffset = 0): Uint8Array {
  const buffer = new ArrayBuffer(byteOffset + points.length * 16);
  const view = new DataView(buffer);
  let offset = byteOffset;
  for (const [x, y, z, reflectance] of points) {
    view.setFloat32(offset, x, true);
    view.setFloat32(offset + 4, y, true);
    view.setFloat32(offset + 8, z, true);
    view.setFloat32(offset + 12, reflectance, true);
    offset += 16;
  }
  return new Uint8Array(buffer, byteOffset, points.length * 16);
}

test('decodes little-endian KITTI positions and reflectance', async () => {
  const result = await new KittiBinParser().parse(
    encodePoints([
      [1.25, -2.5, 3.75, 0.2],
      [-4, 5, -6, 0.8],
    ])
  );

  expect(result.vertexCount).toBe(2);
  expect(Array.from(result.positionsArray)).toEqual([1.25, -2.5, 3.75, -4, 5, -6]);
  expect(result.intensityArray[0]).toBeCloseTo(0.2, 5);
  expect(result.intensityArray[1]).toBeCloseTo(0.8, 5);
  expect(result.scalarFields.intensity).toBe(result.intensityArray);
});

test('accepts a KITTI scan stored at a misaligned byte offset', async () => {
  const result = await new KittiBinParser().parse(encodePoints([[1, 2, 3, 0.5]], 1));
  expect(Array.from(result.positionsArray)).toEqual([1, 2, 3]);
  expect(result.intensityArray[0]).toBeCloseTo(0.5);
});

test('rejects empty, mis-sized and non-finite KITTI scans', async () => {
  const parser = new KittiBinParser();

  await expect(parser.parse(new Uint8Array())).rejects.toThrow(/empty/i);
  await expect(parser.parse(new Uint8Array(17))).rejects.toThrow(/multiple of 16/i);
  await expect(parser.parse(encodePoints([[Number.NaN, 0, 0, 1]]))).rejects.toThrow(/non-finite/i);
});
