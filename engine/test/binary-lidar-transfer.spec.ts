import { expect, test } from '@playwright/test';
import { handleBinarySpatialData } from '../src/binaryDataHandlers';
import { SpatialData } from '../src/interfaces';

test('extension binary transfer preserves typed LiDAR arrays and metadata', async () => {
  Object.defineProperty(globalThis, 'window', {
    value: { loadingStartTime: performance.now(), absoluteStartTime: performance.now() },
    configurable: true,
  });
  let received: SpatialData | undefined;
  const positions = new Float32Array([1, 2, 3, 4, 5, 6]);
  const colors = new Uint8Array([255, 0, 0, 0, 255, 0]);
  const classification = new Float32Array([2, 6]);
  await handleBinarySpatialData(
    {
      vscode: { postMessage: () => undefined },
      lastAbsoluteMs: 0,
      addNewFiles: files => {
        received = files[0];
      },
      displayFiles: async files => {
        received = files[0];
      },
      handleUltimateRawBinaryData: async () => undefined,
    },
    {
      messageType: 'multiSpatialData',
      fileName: 'survey.las',
      shortPath: 'survey.las',
      format: 'binary_little_endian',
      comments: [],
      vertexCount: 2,
      faceCount: 0,
      hasColors: true,
      hasNormals: false,
      hasIntensity: true,
      positionBuffer: positions.buffer,
      colorBuffer: colors.buffer,
      normalBuffer: null,
      indexBuffer: null,
      scalarFieldBuffers: { classification: classification.buffer },
      sourcePointCount: 2,
      sourceOrigin: [4_000_000, 500_000, 100],
      metadata: { format: 'LAS' },
      fileSizeInBytes: 100,
    }
  );

  expect(received?.useTypedArrays).toBe(true);
  expect(Array.from(received?.positionsArray ?? [])).toEqual(Array.from(positions));
  expect(Array.from(received?.colorsArray ?? [])).toEqual(Array.from(colors));
  expect(Array.from(received?.scalarFields?.classification ?? [])).toEqual([2, 6]);
  expect(received?.sourceOrigin).toEqual([4_000_000, 500_000, 100]);
  expect(received?.metadata?.format).toBe('LAS');
});
