import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import path from 'path';
import {
  SAMPLE_CAMERAS,
  SAMPLE_IMAGES,
  SAMPLE_POINTS,
  camerasText,
  imagesText,
  points3DText,
  writeCamerasBinary,
  writeImagesBinary,
  writePoints3DBinary,
} from './helpers/colmapFixture';

/**
 * End-to-end COLMAP loading: selecting the files of a sparse model together
 * produces one point cloud entry and one camera profile, with the cameras
 * placed where the poses say.
 *
 * The fixtures are written here rather than committed: `testfiles/` is
 * gitignored, so a checked-in model would go missing on a fresh clone. Writing
 * them from the same encoder the parser specs use also means the fixture and
 * the expectations cannot drift apart.
 */

const BIN_DIR = path.resolve('../testfiles/colmap/sparse/0');
const TXT_DIR = path.resolve('../testfiles/colmap/sparse_txt');
const ROWS = '#file-list .file-item:not(.file-item-loading)';

const binaryModel = ['cameras.bin', 'images.bin', 'points3D.bin'].map(name =>
  path.join(BIN_DIR, name)
);
const textModel = ['cameras.txt', 'images.txt', 'points3D.txt'].map(name =>
  path.join(TXT_DIR, name)
);

test.beforeAll(() => {
  fs.mkdirSync(BIN_DIR, { recursive: true });
  fs.mkdirSync(TXT_DIR, { recursive: true });
  fs.writeFileSync(path.join(BIN_DIR, 'cameras.bin'), writeCamerasBinary(SAMPLE_CAMERAS));
  fs.writeFileSync(path.join(BIN_DIR, 'images.bin'), writeImagesBinary(SAMPLE_IMAGES));
  fs.writeFileSync(path.join(BIN_DIR, 'points3D.bin'), writePoints3DBinary(SAMPLE_POINTS));
  fs.writeFileSync(path.join(TXT_DIR, 'cameras.txt'), camerasText());
  fs.writeFileSync(path.join(TXT_DIR, 'images.txt'), imagesText());
  fs.writeFileSync(path.join(TXT_DIR, 'points3D.txt'), points3DText());
});

async function load(page: import('@playwright/test').Page, files: string[]) {
  await page.goto('/3d-visualizer/');
  await page.waitForSelector('#three-canvas');
  await page.locator('#hiddenFileInput').setInputFiles(files);
  await expect(page.locator(ROWS)).toHaveCount(2);
}

test('a binary sparse model loads as a cloud plus a camera profile', async ({ page }) => {
  await load(page, binaryModel);

  const names = await page.locator(`${ROWS} .file-name`).allInnerTexts();
  expect(names[0]).toContain('COLMAP');
  expect(names[1]).toContain('cameras');

  // Four points3D entries, three registered images.
  const stats = await page.evaluate(() => {
    const visualizer = (window as any).visualizer;
    return {
      vertexCount: visualizer.spatialFiles[0].vertexCount,
      cameraChildren: visualizer.cameraGroups[0].children.length,
    };
  });
  expect(stats.vertexCount).toBe(4);
  expect(stats.cameraChildren).toBe(3);
});

test('the text encoding produces the same reconstruction', async ({ page }) => {
  await load(page, textModel);
  const stats = await page.evaluate(() => {
    const visualizer = (window as any).visualizer;
    return {
      vertexCount: visualizer.spatialFiles[0].vertexCount,
      cameraChildren: visualizer.cameraGroups[0].children.length,
    };
  });
  expect(stats.vertexCount).toBe(4);
  expect(stats.cameraChildren).toBe(3);
});

test('cameras are placed at the inverted pose, not the raw translation', async ({ page }) => {
  await load(page, binaryModel);

  const positions = await page.evaluate(() => {
    const profile = (window as any).visualizer.cameraGroups[0];
    return profile.children.map((child: any) => ({
      name: child.name,
      position: [child.position.x, child.position.y, child.position.z],
    }));
  });

  const byName = new Map(positions.map((entry: any) => [entry.name, entry.position]));

  // frame_0001: identity rotation, zero translation -> origin. (Compared
  // numerically: negating a zero vector yields -0, which is not `toEqual` 0.)
  const first = byName.get('camera_frame_0001.jpg') as number[];
  expect(first[0]).toBeCloseTo(0, 5);
  expect(first[1]).toBeCloseTo(0, 5);
  expect(first[2]).toBeCloseTo(0, 5);

  // frame_0002: identity rotation, t = (1, 2, 3) -> C = -t. Reading t as the
  // position would put this at (1, 2, 3).
  const second = byName.get('camera_frame_0002.jpg') as number[];
  expect(second[0]).toBeCloseTo(-1, 5);
  expect(second[1]).toBeCloseTo(-2, 5);
  expect(second[2]).toBeCloseTo(-3, 5);

  // frame_0003: +90 degrees about Y with t = (0, 0, 1) -> C = (1, 0, 0).
  const third = byName.get('camera_frame_0003.jpg') as number[];
  expect(third[0]).toBeCloseTo(1, 5);
  expect(third[1]).toBeCloseTo(0, 5);
  expect(third[2]).toBeCloseTo(0, 5);
});

test('the camera list shows every registered image with its intrinsics', async ({ page }) => {
  await load(page, binaryModel);

  const disclosure = page.getByRole('button', { name: /Individual cameras/ });
  await expect(disclosure).toHaveText(/Individual cameras \(3\)/);
  await disclosure.click();
  await expect(page.getByRole('button', { name: 'View' })).toHaveCount(3);

  // The third frame uses camera 2 (OPENCV, 800x600); the details come from the
  // model rather than being invented per frame.
  await page.getByText('frame_0003.jpg', { exact: false }).first().click();
  await expect(page.getByText(/OPENCV \(id 2\)/)).toBeVisible();
  await expect(page.getByText(/800 x 600/)).toBeVisible();
});

test('reprojection error is available as a scalar field', async ({ page }) => {
  await load(page, binaryModel);
  const fields = await page.evaluate(() =>
    Object.keys((window as any).visualizer.spatialFiles[0].scalarFields ?? {})
  );
  expect(fields).toContain('reprojection_error');
});

test('a model without cameras and images is left to the normal pipelines', async ({ page }) => {
  // points3D alone is not a reconstruction; it must not be silently swallowed.
  await page.goto('/3d-visualizer/');
  await page.waitForSelector('#three-canvas');
  await page.locator('#hiddenFileInput').setInputFiles([path.join(BIN_DIR, 'points3D.bin')]);
  // `.bin` is KITTI by extension, so this either fails to parse or loads as a
  // KITTI scan - either way it must not produce a COLMAP camera profile.
  await page.waitForTimeout(1500);
  const cameraGroups = await page.evaluate(() => (window as any).visualizer.cameraGroups.length);
  expect(cameraGroups).toBe(0);
});
