import { expect, test } from '@playwright/test';
import {
  handleLargeFileChunk,
  handleLargeFileComplete,
  handleStartLargeFile,
  LargeFileChunkingHost,
} from '../src/largeFileChunking';
import { SpatialData } from '../src/interfaces';

test('typed LiDAR chunks preserve packed arrays, scalar fields, and metadata', async () => {
  Object.defineProperty(globalThis, 'document', {
    value: { getElementById: () => null },
    configurable: true,
  });
  let received: SpatialData | undefined;
  const host: LargeFileChunkingHost = {
    isFileLoading: false,
    chunkedFileState: new Map(),
    updateWelcomeMessageVisibility: () => undefined,
    addNewFiles: files => {
      received = files[0];
    },
    displayFiles: async files => {
      received = files[0];
    },
  };
  const header = {
    transferId: 'scan-1',
    fileName: 'survey.laz',
    totalVertices: 3,
    totalChunks: 2,
    hasColors: true,
    hasNormals: false,
    hasIntensity: true,
    useTypedArrays: true,
    scalarFieldNames: ['intensity', 'classification'],
    faces: [],
    format: 'binary_little_endian',
    comments: [],
    messageType: 'multiSpatialData',
    sourcePointCount: 3,
    sourceOrigin: [4_000_000, 500_000, 100],
    metadata: { format: 'LAZ' },
  };
  handleStartLargeFile(host, header);

  const sendChunk = (
    chunkIndex: number,
    startIndex: number,
    positions: number[],
    colors: number[],
    intensity: number[],
    classification: number[]
  ) =>
    handleLargeFileChunk(host, {
      transferId: 'scan-1',
      fileName: 'survey.laz',
      chunkIndex,
      startIndex,
      totalChunks: 2,
      vertexCount: intensity.length,
      positionBuffer: new Float32Array(positions).buffer,
      colorBuffer: new Uint8Array(colors).buffer,
      scalarFieldBuffers: {
        intensity: new Float32Array(intensity).buffer,
        classification: new Float32Array(classification).buffer,
      },
    });

  sendChunk(0, 0, [1, 2, 3, 4, 5, 6], [255, 0, 0, 0, 255, 0], [10, 20], [2, 6]);
  sendChunk(1, 2, [7, 8, 9], [0, 0, 255], [30], [9]);
  await handleLargeFileComplete(host, {
    transferId: 'scan-1',
    fileName: 'survey.laz',
    messageType: 'multiSpatialData',
  });

  expect(Array.from(received?.positionsArray ?? [])).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  expect(Array.from(received?.colorsArray ?? [])).toEqual([255, 0, 0, 0, 255, 0, 0, 0, 255]);
  expect(Array.from(received?.scalarFields?.intensity ?? [])).toEqual([10, 20, 30]);
  expect(Array.from(received?.scalarFields?.classification ?? [])).toEqual([2, 6, 9]);
  expect(received?.sourceOrigin).toEqual([4_000_000, 500_000, 100]);
  expect(received?.metadata?.format).toBe('LAZ');
  expect(host.chunkedFileState.size).toBe(0);
});
