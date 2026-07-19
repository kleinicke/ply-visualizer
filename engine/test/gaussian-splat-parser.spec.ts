import { expect, test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { PlyParser } from '../src/parsers/plyParser';
import { handleUltimateRawBinaryData } from '../src/binaryDataHandlers';
import { SpatialData } from '../src/interfaces';

const SPLATS_DIR = path.resolve(__dirname, '../../testfiles/splats');

function readSplatFile(name: string): Uint8Array {
  return new Uint8Array(fs.readFileSync(path.join(SPLATS_DIR, name)));
}

// Anchor gaussians written by generate_3dgs.py: exact colors at exact positions.
const ANCHORS = [
  { pos: [0, 0, 0], rgb: [204, 51, 51] },
  { pos: [1, 0, 0], rgb: [51, 204, 51] },
  { pos: [0, 1, 0], rgb: [51, 51, 204] },
  { pos: [0, 0, 1], rgb: [128, 128, 128] },
];

function expectAnchors(data: SpatialData) {
  const positions = data.positionsArray!;
  const colors = data.colorsArray!;
  ANCHORS.forEach((anchor, i) => {
    expect(Array.from(positions.slice(i * 3, i * 3 + 3))).toEqual(anchor.pos);
    expect(Array.from(colors.slice(i * 3, i * 3 + 3))).toEqual(anchor.rgb);
  });
}

test('parses a binary 3DGS PLY: DC colors, scalar fields, no f_rest blow-up', async () => {
  const result = await new PlyParser().parse(readSplatFile('3dgs_small_binary.ply'), () => {});

  expect(result.isGaussianSplat).toBe(true);
  expect(result.hasColors).toBe(true);
  // 3DGS nx/ny/nz are always all zeros — dropped so no no-op Normals button.
  expect(result.hasNormals).toBe(false);
  expect(result.vertexCount).toBe(2000);
  expect(result.useTypedArrays).toBe(true);
  expectAnchors(result);

  const fields = Object.keys(result.scalarFields ?? {});
  expect(fields).toEqual(expect.arrayContaining(['opacity', 'scale_0', 'scale_1', 'scale_2']));
  for (const field of fields) {
    expect(field).not.toMatch(/^f_dc_|^f_rest_|^rot_/);
  }
  // Opacity logits span linspace(-4, 6).
  expect(result.scalarFields!.opacity[0]).toBeCloseTo(-4, 4);
  expect(result.scalarFields!.opacity[1999]).toBeCloseTo(6, 4);
});

test('parses an ascii 3DGS PLY with the same colors', async () => {
  const result = await new PlyParser().parse(readSplatFile('3dgs_small_ascii.ply'), () => {});

  expect(result.isGaussianSplat).toBe(true);
  expect(result.hasColors).toBe(true);
  expect(result.hasNormals).toBe(false);
  expect(result.vertexCount).toBe(60);
  expectAnchors(result);
  expect(Object.keys(result.scalarFields ?? {})).toContain('opacity');
  expect(Object.keys(result.scalarFields ?? {})).not.toContain('f_rest_0');
});

test('detects the minimal deg-0 layout without f_rest or normals', async () => {
  const result = await new PlyParser().parse(readSplatFile('3dgs_no_rest.ply'), () => {});

  expect(result.isGaussianSplat).toBe(true);
  expect(result.hasColors).toBe(true);
  expect(result.hasNormals).toBe(false);
  expect(result.vertexCount).toBe(500);
  expectAnchors(result);
});

test('ultimate binary path (parseHeaderOnly + webview reader) synthesizes DC colors', async () => {
  const bytes = readSplatFile('3dgs_small_binary.ply');
  const parser = new PlyParser();
  const header = await parser.parseHeaderOnly(bytes, () => {});

  expect(header.headerInfo.isGaussianSplat).toBe(true);
  expect(header.headerInfo.hasColors).toBe(true);

  const captured: SpatialData[] = [];
  const host = {
    vscode: { postMessage: () => {} },
    lastAbsoluteMs: 0,
    addNewFiles: (files: SpatialData[]) => captured.push(...files),
    displayFiles: async () => {},
    handleUltimateRawBinaryData: async () => {},
  };
  const vertexBytes = bytes.slice(header.binaryDataStart);
  await handleUltimateRawBinaryData(host, {
    messageType: 'addFiles',
    fileName: '3dgs_small_binary.ply',
    fileSizeInBytes: bytes.byteLength,
    rawBinaryData: vertexBytes.buffer,
    vertexCount: header.headerInfo.vertexCount,
    faceCount: header.headerInfo.faceCount,
    hasColors: header.headerInfo.hasColors,
    hasNormals: header.headerInfo.hasNormals,
    hasIntensity: header.headerInfo.hasIntensity,
    format: header.headerInfo.format,
    comments: header.headerInfo.comments,
    vertexStride: header.vertexStride,
    propertyOffsets: Array.from(header.propertyOffsets.entries()),
    littleEndian: true,
    splatHeaderData: bytes.slice(0, header.binaryDataStart).buffer,
  });

  expect(captured).toHaveLength(1);
  const data = captured[0];
  expect(data.isGaussianSplat).toBe(true);
  expect(data.splatSource?.bytes).toBeDefined();
  expect(new TextDecoder().decode(data.splatSource!.bytes!.slice(0, 3))).toBe('ply');
  expect(data.splatSource!.bytes!.byteLength).toBe(bytes.byteLength);
  expectAnchors(data);
  const fields = Object.keys(data.scalarFields ?? {});
  expect(fields).toEqual(expect.arrayContaining(['opacity', 'scale_0']));
  for (const field of fields) {
    expect(field).not.toMatch(/^f_dc_|^f_rest_|^rot_/);
  }
});

test('explicit rgb wins over f_dc when a file carries both', async () => {
  const ascii = [
    'ply',
    'format ascii 1.0',
    'element vertex 1',
    'property float x',
    'property float y',
    'property float z',
    'property uchar red',
    'property uchar green',
    'property uchar blue',
    'property float f_dc_0',
    'property float f_dc_1',
    'property float f_dc_2',
    'end_header',
    '0 0 0 10 20 30 5.0 5.0 5.0',
    '',
  ].join('\n');
  const result = await new PlyParser().parse(new TextEncoder().encode(ascii), () => {});

  expect(result.isGaussianSplat).toBe(false);
  expect(Array.from(result.colorsArray!.slice(0, 3))).toEqual([10, 20, 30]);
});

test('clamps out-of-range DC coefficients to 0..255', async () => {
  const ascii = [
    'ply',
    'format ascii 1.0',
    'element vertex 2',
    'property float x',
    'property float y',
    'property float z',
    'property float f_dc_0',
    'property float f_dc_1',
    'property float f_dc_2',
    'end_header',
    '0 0 0 50.0 50.0 50.0',
    '0 0 0 -50.0 -50.0 -50.0',
    '',
  ].join('\n');
  const result = await new PlyParser().parse(new TextEncoder().encode(ascii), () => {});

  expect(result.isGaussianSplat).toBe(true);
  expect(Array.from(result.colorsArray!.slice(0, 6))).toEqual([255, 255, 255, 0, 0, 0]);
});

test('legacy non-3DGS splat dialect (uchar rgb + scale_x) stays a plain point cloud', async () => {
  const result = await new PlyParser().parse(readSplatFile('test_splats.ply'), () => {});

  expect(result.isGaussianSplat).toBe(false);
  expect(result.hasColors).toBe(true);
  expect(result.vertexCount).toBe(5);
  expect(Array.from(result.colorsArray!.slice(0, 3))).toEqual([0, 127, 204]);
  // Its scale_x/rot_* props are ordinary extra scalars for this dialect.
  expect(Object.keys(result.scalarFields ?? {})).toContain('scale_x');
});
