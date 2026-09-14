import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import { zipSync, strToU8 } from 'three/examples/jsm/libs/fflate.module.js';

const root = path.resolve(__dirname, '../../testfiles/scene-models');
const cases = [
  { file: '3mf/cube_gears.3mf' },
  { file: '3mf/multipletextures.3mf', textured: true },
  { file: 'amf/rook.amf' },
  { file: 'vrml/house.wrl' },
  { file: 'vrml/meshWithTexture.wrl', assets: ['vrml/map.gif'], textured: true },
  { file: 'vrml/points.wrl', primitive: 'points' },
  { file: 'vrml/lines.wrl', primitive: 'lines' },
  { file: 'step/Schenkel.step', step: true },
  { file: 'step/as1-ac-214.stp', step: true },
  { file: 'iges/RLF_12545.iges', units: 'millimeter', dimensions: [12.5, 12.5, 4.7] },
  { file: 'iges/SOD_323.igs', units: 'millimeter' },
  { file: 'brep/filletBox.brep', units: 'unspecified', dimensions: [10, 10, 17] },
  { file: 'brep/Y_Rod_Mount.brep', units: 'unspecified' },
];

for (const fixture of cases) {
  test(`additional model: ${fixture.file}`, async ({ page }) => {
    expect(
      fs.existsSync(path.join(root, fixture.file)),
      'Run node scripts/download-additional-model-fixtures.mjs'
    ).toBe(true);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-visualizer-ready', 'true');
    await page
      .locator('#hiddenFileInput')
      .setInputFiles([fixture.file, ...(fixture.assets || [])].map(file => path.join(root, file)));
    await expect
      .poll(() => page.evaluate(() => (window as any).visualizer.spatialFiles.length), {
        timeout: 45_000,
      })
      .toBe(1);
    const stats = await page.evaluate(() => {
      const host = (window as any).visualizer;
      const data = host.spatialFiles[0];
      let meshes = 0,
        lines = 0,
        points = 0,
        textures = 0;
      data.sceneModel.root.traverse((object: any) => {
        meshes += Number(!!object.isMesh);
        lines += Number(!!object.isLine);
        points += Number(!!object.isPoints);
        for (const material of object.material
          ? Array.isArray(object.material)
            ? object.material
            : [object.material]
          : []) {
          textures += Number(!!material.map?.image);
        }
      });
      const min = [Infinity, Infinity, Infinity];
      const max = [-Infinity, -Infinity, -Infinity];
      (data.positionsArray as Float32Array).forEach((value, index) => {
        min[index % 3] = Math.min(min[index % 3], value);
        max[index % 3] = Math.max(max[index % 3], value);
      });
      return {
        dimensions: max.map((value, index) => value - min[index]),
        meshes,
        lines,
        points,
        textures,
        vertices: data.vertexCount,
        faces: data.faceCount,
        finite: Array.from(data.positionsArray as Float32Array).every(Number.isFinite),
        units: data.sceneModel.root.userData.units,
        warnings: data.sceneModel.warnings,
        visible: host.meshes[0].visible,
        maxCoordinate: (data.positionsArray as Float32Array).reduce(
          (max, value) => Math.max(max, Math.abs(value)),
          0
        ),
      };
    });
    expect(stats.vertices).toBeGreaterThan(0);
    expect(stats.finite).toBe(true);
    expect(stats.visible).toBe(true);
    if (fixture.primitive === 'points') {expect(stats.points).toBeGreaterThan(0);}
    else if (fixture.primitive === 'lines') {expect(stats.lines).toBeGreaterThan(0);}
    else {expect(stats.faces).toBeGreaterThan(0);}
    if (fixture.textured) {expect(stats.textures).toBeGreaterThan(0);}
    if (fixture.step) {expect(stats.units).toBe('millimeter');}
    if (fixture.units) {expect(stats.units).toBe(fixture.units);}
    // The IGES sample declares INCH units: its 12.5 mm body must not shrink to
    // 0.492 units. The BREP box must retain its original 10 x 10 x 17 coordinates.
    fixture.dimensions?.forEach((value, index) =>
      expect(stats.dimensions[index]).toBeCloseTo(value, 3)
    );
    expect(stats.warnings).toEqual([]);
    if (fixture.file === 'vrml/house.wrl') {expect(stats.maxCoordinate).toBeLessThan(1000);}
    await page.screenshot({ path: test.info().outputPath('model.png') });
    if (process.env.SAVE_MODEL_PREVIEWS) {
      await page.screenshot({ path: path.join(root, fixture.file + '.png') });
    }
    await page.locator('#file-0').uncheck();
    expect(await page.evaluate(() => (window as any).visualizer.meshes[0].visible)).toBe(false);
    await page.evaluate(() => (window as any).visualizer.removeFileByIndex(0));
    expect(await page.evaluate(() => (window as any).visualizer.spatialFiles.length)).toBe(0);
    expect(errors).toEqual([]);
  });
}

for (const [extension, recoveryFile] of [
  ['step', 'step/as1-ac-214.stp'],
  ['iges', 'iges/RLF_12545.iges'],
  ['brep', 'brep/filletBox.brep'],
]) {
  test(`invalid ${extension.toUpperCase()} reports an error and a later model still opens`, async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-visualizer-ready', 'true');
    await page.locator('#hiddenFileInput').setInputFiles({
      name: `invalid.${extension}`,
      mimeType: 'application/octet-stream',
      buffer: Buffer.from('not a CAD file'),
    });
    await expect(page.locator('body')).toContainText(
      `${extension.toUpperCase()} contains no supported`,
      {
        timeout: 30_000,
      }
    );
    expect(await page.evaluate(() => (window as any).visualizer.spatialFiles.length)).toBe(0);
    await page.locator('#hiddenFileInput').setInputFiles(path.join(root, recoveryFile));
    await expect
      .poll(() => page.evaluate(() => (window as any).visualizer.spatialFiles.length), {
        timeout: 30_000,
      })
      .toBe(1);
  });
}

for (const zipped of [false, true]) {
  test(`AMF warns about unsupported arrangements (${zipped ? 'ZIP' : 'XML'})`, async ({ page }) => {
    const xml = `<?xml version="1.0"?><amf unit="millimeter">
      <object id="1"><mesh><vertices>
        <vertex><coordinates><x>0</x><y>0</y><z>0</z></coordinates></vertex>
        <vertex><coordinates><x>1</x><y>0</y><z>0</z></coordinates></vertex>
        <vertex><coordinates><x>0</x><y>1</y><z>0</z></coordinates></vertex>
      </vertices><volume><triangle><v1>0</v1><v2>1</v2><v3>2</v3></triangle></volume></mesh></object>
      <constellation id="2"><instance objectid="1"><deltax>30</deltax></instance></constellation>
    </amf>`;
    const bytes = strToU8(xml);
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-visualizer-ready', 'true');
    await page.locator('#hiddenFileInput').setInputFiles({
      name: 'arrangement.amf',
      mimeType: 'application/octet-stream',
      buffer: Buffer.from(zipped ? zipSync({ 'model.amf': bytes }) : bytes),
    });
    await expect
      .poll(() => page.evaluate(() => (window as any).visualizer.spatialFiles.length))
      .toBe(1);
    expect(
      await page.evaluate(() => (window as any).visualizer.spatialFiles[0].sceneModel.warnings)
    ).toEqual(['AMF object arrangements (constellations) are not supported.']);
  });
}
