import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
const root = path.resolve(__dirname, '../../testfiles/scene-models');
const cases = [
  {
    name: 'GLB skeletal animations',
    file: 'gltf/RobotExpressive/RobotExpressive.glb',
    animated: true,
  },
  {
    name: 'GLTF morph animations and external buffer',
    file: 'gltf/AnimatedMorphSphere/glTF/AnimatedMorphSphere.gltf',
    assets: ['gltf/AnimatedMorphSphere/glTF/AnimatedMorphSphere.bin'],
    animated: true,
  },
  { name: 'FBX skeletal animations', file: 'fbx/Samba Dancing.fbx', animated: true },
  { name: 'FBX embedded textures', file: 'fbx/monkey_embedded_texture.fbx', textured: true },
  {
    name: 'Collada scene and texture',
    file: 'collada/stormtrooper/stormtrooper.dae',
    assets: ['collada/stormtrooper/Stormtrooper_D.jpg'],
    textured: true,
  },
  {
    name: '3DS textured scene',
    file: '3ds/portalgun/portalgun.3ds',
    assets: ['3ds/portalgun/textures/color.jpg', '3ds/portalgun/textures/normal.jpg'],
    textured: true,
  },
  {
    name: 'Collada animation',
    file: 'collada/pump/pump.dae',
    assets: [
      'collada/pump/pump_body.jpg',
      'collada/pump/pump_gears.jpg',
      'collada/pump/pump_metalreflect.jpg',
    ],
    animated: true,
  },
  { name: 'OBJ mesh', file: 'obj/male02/male02.obj' },
  { name: 'ASCII STL mesh', file: 'stl/ascii/slotted_disk.stl' },
  { name: 'binary STL mesh', file: 'stl/binary/pr2_head_pan.stl' },
];
for (const fixture of cases) {
  test(fixture.name, async ({ page }) => {
    expect(
      fs.existsSync(path.join(root, fixture.file)),
      'Run node scripts/download-model-fixtures.mjs first'
    ).toBe(true);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-visualizer-ready', 'true');
    await page
      .locator('#hiddenFileInput')
      .setInputFiles([fixture.file, ...(fixture.assets || [])].map(file => path.join(root, file)));
    await expect(page.locator('#file-list')).toContainText(path.basename(fixture.file));
    await expect
      .poll(() => page.evaluate(() => (window as any).visualizer.spatialFiles.length))
      .toBe(1);
    const summary = await page.evaluate(() => {
      const host = (window as any).visualizer;
      const data = host.spatialFiles[0];
      let textures = 0,
        skins = 0,
        meshes = 0;
      data.sceneModel?.root.traverse((object: any) => {
        if (object.isMesh) {
          meshes++;
        }
        if (object.isSkinnedMesh) {
          skins++;
        }
        for (const material of object.material
          ? Array.isArray(object.material)
            ? object.material
            : [object.material]
          : []) {
          if (material.map?.image) {
            textures++;
          }
        }
      });
      return {
        vertices: data.vertexCount,
        textures,
        skins,
        meshes,
        clips: data.sceneModel?.clips.length || 0,
        warnings: data.sceneModel?.warnings || [],
        camera: host.camera.position.toArray(),
      };
    });
    expect(summary.vertices).toBeGreaterThan(0);
    expect(summary.camera.every(Number.isFinite)).toBe(true);
    if (fixture.textured) {
      expect(summary.textures, JSON.stringify(summary)).toBeGreaterThan(0);
    }
    if (fixture.animated) {
      expect(summary.clips).toBeGreaterThan(0);
      const initial = await page.evaluate(() => {
        const out: number[] = [];
        (window as any).visualizer.spatialFiles[0].sceneModel.root.traverse((o: any) =>
          out.push(...o.matrixWorld.elements, ...(o.morphTargetInfluences || []))
        );
        return out;
      });
      await page.getByRole('button', { name: 'Play animation', exact: true }).click();
      await expect
        .poll(() =>
          page.evaluate(() => (window as any).visualizer.spatialFiles[0].sceneModel.ui.time)
        )
        .toBeGreaterThan(0.15);
      await page.getByRole('button', { name: 'Pause animation', exact: true }).click();
      const moved = await page.evaluate(() => {
        const out: number[] = [];
        (window as any).visualizer.spatialFiles[0].sceneModel.root.traverse((o: any) =>
          out.push(...o.matrixWorld.elements, ...(o.morphTargetInfluences || []))
        );
        return out;
      });
      expect(moved).not.toEqual(initial);
      await page.getByLabel('Animation time', { exact: true }).dblclick();
      expect(
        await page.evaluate(() => (window as any).visualizer.spatialFiles[0].sceneModel.ui.time)
      ).toBe(0);
    }
    await page.locator('#file-0').uncheck();
    expect(await page.evaluate(() => (window as any).visualizer.meshes[0].visible)).toBe(false);
    await page.locator('#file-0').check();
    await page.screenshot({ path: test.info().outputPath('model.png') });
    await page.evaluate(() => (window as any).visualizer.removeFileByIndex(0));
    await expect
      .poll(() => page.evaluate(() => (window as any).visualizer.spatialFiles.length))
      .toBe(0);
    expect(errors).toEqual([]);
  });
}

test('remote GLTF resolves its buffer relative to the final URL and survives reload', async ({
  page,
}) => {
  const directory = 'gltf/AnimatedMorphSphere/glTF/';
  const url = 'https://models.example.test/assets/AnimatedMorphSphere.gltf';
  const requested: string[] = [];
  await page.route('https://models.example.test/**', route => {
    const name = new URL(route.request().url()).pathname.split('/').pop()!;
    requested.push(name);
    return route.fulfill({ body: fs.readFileSync(path.join(root, directory, name)) });
  });
  await page.goto(`/?source=${encodeURIComponent(url)}`);
  await expect(page.getByLabel('Animation clip', { exact: true })).toBeVisible();
  expect(requested).toContain('AnimatedMorphSphere.bin');
  expect(new URL(page.url()).searchParams.get('source')).toBe(url);
  await page.reload();
  await expect(page.getByLabel('Animation clip', { exact: true })).toBeVisible();
});

test('removing one model retains the second model and its playback', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-visualizer-ready', 'true');
  await page
    .locator('#hiddenFileInput')
    .setInputFiles([
      path.join(root, 'gltf/RobotExpressive/RobotExpressive.glb'),
      path.join(root, 'fbx/Samba Dancing.fbx'),
    ]);
  await expect
    .poll(() => page.evaluate(() => (window as any).visualizer.spatialFiles.length))
    .toBe(2);
  await page.evaluate(() => (window as any).visualizer.removeFileByIndex(0));
  await expect(page.locator('#file-list')).toContainText('Samba Dancing.fbx');
  await expect(page.locator('#file-list')).not.toContainText('RobotExpressive.glb');
  await page.getByRole('button', { name: 'Play animation', exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => (window as any).visualizer.spatialFiles[0].sceneModel.ui.time))
    .toBeGreaterThan(0.15);
  expect(
    await page.evaluate(() => {
      const host = (window as any).visualizer;
      return host.meshes[0].children.includes(host.spatialFiles[0].sceneModel.root);
    })
  ).toBe(true);
});

test('remote 3DS finds textures in the neighboring textures directory', async ({ page }) => {
  const base = 'https://models.example.test/portalgun/';
  const requested: string[] = [];
  await page.route(base + '**', route => {
    const relative = new URL(route.request().url()).pathname.replace('/portalgun/', '');
    requested.push(relative);
    const file = path.join(root, '3ds/portalgun', relative);
    return fs.existsSync(file)
      ? route.fulfill({ body: fs.readFileSync(file) })
      : route.fulfill({ status: 404 });
  });
  await page.goto(`/?source=${encodeURIComponent(base + 'portalgun.3ds')}`);
  await expect(page.locator('#file-list')).toContainText('portalgun.3ds');
  expect(requested).toContain('textures/color.jpg');
  expect(
    await page.evaluate(() => (window as any).visualizer.spatialFiles[0].sceneModel.warnings)
  ).toEqual([]);
});
