import { expect, test } from '@playwright/test';
import path from 'path';
import * as THREE from 'three';
import {
  coordinateTicks,
  formatCoordinate,
  projectCoordinateGrid,
} from '../src/visualization/coordinateGrid';

test('coordinate ticks handle flat, negative, and tiny ranges', () => {
  for (const [min, max] of [
    [0, 0],
    [-12, -2],
    [1e-8, 6e-8],
    [1234567, 1234568],
  ]) {
    const ticks = coordinateTicks(min, max);
    expect(ticks.length).toBeGreaterThan(1);
    expect(ticks.length).toBeLessThanOrEqual(12);
    expect(ticks[0]).toBeLessThanOrEqual(min);
    expect(ticks.at(-1)).toBeGreaterThanOrEqual(max);
    expect(new Set(ticks.map(formatCoordinate)).size).toBe(ticks.length);
  }
});

test('optional grid and legend follow the visible scene', async ({ page }) => {
  await page.goto('/');
  await page
    .locator('#hiddenFileInput')
    .setInputFiles([
      path.resolve('../testfiles/ply/test_small_mesh.ply'),
      path.resolve('../testfiles/ply/test_ascii.ply'),
    ]);
  await expect(page.locator('#file-list .file-item')).toHaveCount(2);
  await expect(page.getByTestId('coordinate-grid')).toHaveCount(0);
  await expect(page.getByRole('complementary', { name: 'Legend' })).toHaveCount(0);
  await page.locator('#color-0').selectOption('1');
  await page.locator('[data-tab="controls"]').click();
  await page.locator('#toggle-coordinate-grid').click();
  await page.locator('#toggle-legend').click();
  const grid = page.getByTestId('coordinate-grid');
  await expect(grid.locator('text').first()).toBeVisible();
  const legend = page.getByRole('complementary', { name: 'Legend' });
  await expect(legend.locator('.legend-entry')).toHaveCount(2);
  await expect(legend).toContainText('Red');
  const before = await grid.locator('line').first().getAttribute('x1');
  await page.evaluate(() => {
    const host = (window as any).visualizer;
    host.camera.position.x += 3;
    host.camera.lookAt(host.controls.target);
    host.requestRender();
  });
  await expect(grid.locator('line').first()).not.toHaveAttribute('x1', before!);
  await page.locator('[data-tab="files"]').click();
  await page.locator('#file-0').uncheck();
  await expect(legend.locator('.legend-entry')).toHaveCount(1);
  await page.locator('[data-tab="controls"]').click();
  await page.locator('#fit-camera').click();
  await page.screenshot({ path: '/tmp/ply-scene-guides.png' });
  await page.locator('#toggle-coordinate-grid').click();
  await page.locator('#toggle-legend').click();
  await expect(grid).toHaveCount(0);
  await expect(legend).toHaveCount(0);
});

test('grid respects object transforms and hides with the last object', () => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2));
  const camera = new THREE.PerspectiveCamera(60, 1, 0.01, 1000);
  camera.position.set(8, 6, 10);
  camera.lookAt(0, 0, 0);
  const host = { meshes: [mesh], fileVisibility: [true], camera };
  const original = projectCoordinateGrid(host, 800, 800);
  expect(original.lines.length).toBeGreaterThan(0);
  mesh.position.set(2, 0, 0);
  const moved = projectCoordinateGrid(host, 800, 800);
  expect(moved.lines).not.toEqual(original.lines);
  host.fileVisibility[0] = false;
  expect(projectCoordinateGrid(host, 800, 800)).toEqual({ lines: [], labels: [] });
  mesh.geometry.dispose();
  mesh.material.dispose();
});
