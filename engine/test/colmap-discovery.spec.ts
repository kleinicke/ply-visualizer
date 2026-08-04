import { test, expect } from '@playwright/test';
import { isColmapModelFile } from '../src/formats/colmap/colmapFiles';

/**
 * File-name recognition used by the extension to find a model.
 * The folder walk itself lives in extension.ts (vscode APIs, not testable
 * here); this pins the predicate it depends on.
 */
test('recognises COLMAP model files in either encoding', () => {
  for (const name of [
    'cameras.txt',
    'images.txt',
    'points3D.txt',
    'cameras.bin',
    'images.bin',
    'points3D.bin',
    'sparse/0/cameras.bin',
    'south-building/sparse/points3D.txt',
  ]) {
    expect(isColmapModelFile(name), name).toBe(true);
  }
});

test('does not claim unrelated files', () => {
  for (const name of [
    'database.db',
    'project.ini',
    'my_cameras.txt',
    'points3D_backup.txt',
    'scan.ply',
    'notes.txt',
    'images/P1180141.JPG',
  ]) {
    expect(isColmapModelFile(name), name).toBe(false);
  }
});
