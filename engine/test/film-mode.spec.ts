import { test, expect, Page } from '@playwright/test';
import path from 'path';

// Video mode (film/FilmManager.ts): camera keyframes captured from the
// current view, smooth playback through them, JSON save/load round-trip, and
// canvas recording via MediaRecorder.

async function setup(page: Page) {
  await page.goto('/3d-visualizer/');
  await page.waitForSelector('#three-canvas');
  await page.waitForTimeout(1000);

  await page.click('[data-tab="files"]');
  const plyPath = path.resolve('../testfiles/open3d/sample_mesh.ply');
  await page.locator('#hiddenFileInput').setInputFiles(plyPath);
  await page.waitForTimeout(1500);

  await page.click('[data-tab="camera"]');
  await page.waitForTimeout(300);
}

async function setCameraPose(page: Page, pos: [number, number, number]) {
  await page.evaluate(p => {
    const v: any = (window as any).visualizer;
    v.controls.target.set(0, 0, 0);
    v.camera.position.set(p[0], p[1], p[2]);
    v.camera.up.set(0, 1, 0);
    v.camera.lookAt(0, 0, 0);
    v.controls.update();
    v.requestRender();
  }, pos);
  await page.waitForTimeout(100);
}

async function camPos(page: Page): Promise<number[]> {
  return page.evaluate(() => {
    const v: any = (window as any).visualizer;
    return v.camera.position.toArray() as number[];
  });
}

test('keyframes, playback, and camera restoration', async ({ page }) => {
  await setup(page);

  // Two keyframes from two different poses, captured through the panel button.
  await setCameraPose(page, [3, 0, 0]);
  await page.click('#film-add-keyframe');
  await setCameraPose(page, [0, 0, 3]);
  await page.click('#film-add-keyframe');
  await page.waitForTimeout(200);

  // Keep the timeline short for the test.
  await page.evaluate(() => {
    const v: any = (window as any).visualizer;
    v.filmManager.updateKeyframe(0, { duration: 0.8 });
  });

  const rows = page.locator('#film-keyframe-list input[type="number"]');
  await expect(rows.first()).toHaveValue('0.8');

  const preplay = await camPos(page);
  expect(preplay).toEqual([0, 0, 3]);

  await page.click('#film-play');
  await page.waitForTimeout(400);

  // Mid-playback the camera is on the path (moved off the pre-play pose) and
  // user controls are disabled.
  const mid = await page.evaluate(() => {
    const v: any = (window as any).visualizer;
    return {
      pos: v.camera.position.toArray() as number[],
      playing: v.filmManager.isPlaying(),
      controlsEnabled: v.controls.enabled,
    };
  });
  expect(mid.playing).toBe(true);
  expect(mid.controlsEnabled).toBe(false);
  const movedFromEnd = Math.hypot(mid.pos[0] - 0, mid.pos[1] - 0, mid.pos[2] - 3);
  const movedFromStart = Math.hypot(mid.pos[0] - 3, mid.pos[1] - 0, mid.pos[2] - 0);
  expect(Math.min(movedFromEnd, movedFromStart)).toBeGreaterThan(0.05);

  // The playback keeps the camera at a sane distance (spline through two
  // keyframes at radius 3 stays in the same order of magnitude).
  const dist = Math.hypot(mid.pos[0], mid.pos[1], mid.pos[2]);
  expect(dist).toBeGreaterThan(1);
  expect(dist).toBeLessThan(6);

  // After the timeline ends, playback stops, controls re-enable, and the
  // pre-playback camera is restored.
  await page.waitForTimeout(1500);
  const done = await page.evaluate(() => {
    const v: any = (window as any).visualizer;
    return {
      pos: v.camera.position.toArray() as number[],
      playing: v.filmManager.isPlaying(),
      controlsEnabled: v.controls.enabled,
    };
  });
  expect(done.playing).toBe(false);
  expect(done.controlsEnabled).toBe(true);
  for (let i = 0; i < 3; i++) {
    expect(Math.abs(done.pos[i] - preplay[i])).toBeLessThan(1e-6);
  }
});

test('keyframe project JSON round-trips', async ({ page }) => {
  await setup(page);

  await setCameraPose(page, [3, 0, 0]);
  await page.click('#film-add-keyframe');
  await setCameraPose(page, [0, 3, 0]);
  await page.click('#film-add-keyframe');
  await page.waitForTimeout(200);

  const result = await page.evaluate(() => {
    const v: any = (window as any).visualizer;
    const json = v.filmManager.buildProjectJson();
    // Clear and reload from the serialized text.
    v.filmManager.removeKeyframe(1);
    v.filmManager.removeKeyframe(0);
    const countAfterClear = v.filmManager.getKeyframes().length;
    const loaded = v.filmManager.loadProject(json);
    const keys = v.filmManager.getKeyframes();
    return {
      countAfterClear,
      loaded,
      count: keys.length,
      firstPos: keys[0].position,
      version: JSON.parse(json).version,
    };
  });

  expect(result.countAfterClear).toBe(0);
  expect(result.loaded).toBe(true);
  expect(result.count).toBe(2);
  expect(result.version).toBe(1);
  expect(result.firstPos[0]).toBeCloseTo(3, 5);

  // Malformed input is rejected without clobbering the loaded path.
  const bad = await page.evaluate(() => {
    const v: any = (window as any).visualizer;
    const rejected = !v.filmManager.loadProject('{"keyframes": [{"position": "nope"}]}');
    return { rejected, count: v.filmManager.getKeyframes().length };
  });
  expect(bad.rejected).toBe(true);
  expect(bad.count).toBe(2);
});

test('recording produces a video file download', async ({ page }) => {
  await setup(page);

  await setCameraPose(page, [3, 0, 0]);
  await page.click('#film-add-keyframe');
  await setCameraPose(page, [0, 0, 3]);
  await page.click('#film-add-keyframe');
  await page.evaluate(() => {
    const v: any = (window as any).visualizer;
    v.filmManager.updateKeyframe(0, { duration: 0.8 });
  });

  const downloadPromise = page.waitForEvent('download', { timeout: 15000 });
  await page.click('#film-record');
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toMatch(/^camera-path-.*\.(webm|mp4)$/);
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk as Buffer);
  }
  expect(Buffer.concat(chunks).length).toBeGreaterThan(1000);
});
