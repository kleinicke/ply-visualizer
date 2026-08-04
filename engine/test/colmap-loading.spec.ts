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

test('frames are frustums, not the old pyramid body', async ({ page }) => {
  await load(page, binaryModel);
  const shapes = await page.evaluate(() => {
    const frame = (window as any).visualizer.cameraGroups[0].children[0];
    return frame.children.map((child: any) => ({ name: child.name, type: child.type }));
  });
  // A wireframe frustum plus the (hidden) label. No Mesh pyramid.
  expect(shapes.some((s: any) => s.name === 'cameraFrustum' && s.type === 'LineSegments')).toBe(
    true
  );
  expect(shapes.some((s: any) => s.type === 'Mesh')).toBe(false);
});

test('removing the cloud takes its camera profile with it', async ({ page }) => {
  await load(page, binaryModel);
  await expect(page.locator(ROWS)).toHaveCount(2);

  await page.evaluate(() => (window as any).visualizer.removeFileByIndex(0));

  // Both rows go, and the camera group leaves the scene rather than lingering
  // with no row to control it.
  await expect(page.locator(ROWS)).toHaveCount(0);
  const groups = await page.evaluate(() => (window as any).visualizer.cameraGroups.length);
  expect(groups).toBe(0);
});

test('View keeps the camera upright instead of rolling it a quarter turn', async ({ page }) => {
  await load(page, binaryModel);
  await page.getByRole('button', { name: /Individual cameras/ }).click();

  // frame_0003 is rotated 90 degrees about Y. Its true up is world (0, -1, 0);
  // snapping the roll towards world +Z used to pick (0, 0, 1) instead, which
  // is the sideways view. COLMAP's world frame has no defined vertical axis,
  // so no snapping should happen at all.
  // Frames are listed sorted by name, so index 2 is frame_0003.
  await page.getByRole('button', { name: 'View' }).nth(2).click();

  const up = await page.evaluate(() => {
    const camera = (window as any).visualizer.camera;
    return [camera.up.x, camera.up.y, camera.up.z];
  });
  expect(up[0]).toBeCloseTo(0, 5);
  expect(up[1]).toBeCloseTo(-1, 5);
  expect(up[2]).toBeCloseTo(0, 5);
});

test('the camera row reports image progress from the first render', async ({ page }) => {
  await load(page, binaryModel);

  // Nothing has been decoded yet - the browser path never receives an images
  // folder - so the counter must already say 0 of 3 rather than being absent.
  // Otherwise a reconstruction whose photographs are still coming looks like
  // one that simply has none.
  const cameraRow = page.locator(ROWS).nth(1);
  await expect(cameraRow).toContainText('3 cameras');
  await expect(cameraRow).toContainText('images 0 / 3');
});

test('the progress counter clears once every image has arrived', async ({ page }) => {
  await load(page, binaryModel);

  await page.evaluate(() => {
    const visualizer = (window as any).visualizer;
    const profile = visualizer.cameraGroups[0];
    profile.userData.imageProgress = { done: 2, total: 3 };
    (window as any).__plyFilesState.renderTick += 1;
  });
  await expect(page.locator(ROWS).nth(1)).toContainText('images 2 / 3');

  await page.evaluate(() => {
    const visualizer = (window as any).visualizer;
    visualizer.cameraGroups[0].userData.imageProgress = null;
    (window as any).__plyFilesState.renderTick += 1;
  });
  await expect(page.locator(ROWS).nth(1)).not.toContainText('images');
  await expect(page.locator(ROWS).nth(1)).toContainText('3 cameras');
});
