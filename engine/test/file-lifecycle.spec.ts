import { test, expect } from '@playwright/test';

test('failed load leaves the scene usable; repeated add/remove returns to its baseline', async ({
  page,
}) => {
  await page.goto('/');
  await page.waitForFunction(() => !!(window as any).visualizer);
  const result = await page.evaluate(() => {
    const viewer = (window as any).visualizer;
    const makeData = () => ({
      vertices: [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
      ],
      faces: [],
      vertexCount: 2,
      faceCount: 0,
      format: 'ascii',
      version: '1.0',
      comments: [],
      hasColors: false,
      hasNormals: false,
      fileName: 'test.ply',
    });
    const before = viewer.scene.children.length;
    const material = viewer.createMaterialForFile;
    viewer.createMaterialForFile = () => {
      throw new Error('Injected build failure');
    };
    let failed = false;
    try {
      viewer.addNewFiles([makeData()]);
    } catch {
      failed = true;
    } finally {
      viewer.createMaterialForFile = material;
    }
    const afterFailure = [
      viewer.fileEntries.length,
      viewer.spatialFiles.length,
      viewer.meshes.length,
      viewer.scene.children.length,
    ];
    for (let i = 0; i < 5; i++) {
      viewer.addNewFiles([makeData()]);
      viewer.removeFileByIndex(0);
    }
    return {
      failed,
      before,
      afterFailure,
      after: [
        viewer.fileEntries.length,
        viewer.spatialFiles.length,
        viewer.meshes.length,
        viewer.scene.children.length,
      ],
    };
  });
  expect(result.failed).toBe(true);
  expect(result.afterFailure).toEqual([0, 0, 0, result.before]);
  expect(result.after).toEqual([0, 0, 0, result.before]);
});

test('malformed messages do not break later loads and removed-entry replies are ignored', async ({
  page,
}) => {
  await page.goto('/');
  await page.waitForFunction(() => !!(window as any).visualizer);
  await page.evaluate(() => {
    window.postMessage(null, '*');
    window.postMessage({ type: 'fileRemoved', fileIndex: -1 }, '*');
  });
  await page.locator('#hiddenFileInput').setInputFiles({
    name: 'tiny.off',
    mimeType: 'text/plain',
    buffer: Buffer.from('OFF\n3 1 0\n0 0 0\n1 0 0\n0 1 0\n3 0 1 2\n'),
  });
  await expect(page.locator('#file-list .file-item')).toHaveCount(1);
  await page.evaluate(() =>
    window.postMessage({ type: 'fileRemoved', fileIndex: 0, entryId: 99999 }, '*')
  );
  await page.waitForTimeout(50);
  await expect(page.locator('#file-list .file-item')).toHaveCount(1);
});

test('reactive depth forms retain edits, calibration and resets after removing an earlier file', async ({
  page,
}) => {
  await page.goto('/');
  await page.waitForFunction(() => !!(window as any).visualizer);
  const header = Buffer.from('Pf\n2 2\n-1.0\n');
  const values = Buffer.alloc(16);
  [1, 2, 3, 4].forEach((v, i) => values.writeFloatLE(v, i * 4));
  for (const name of ['first.pfm', 'second.pfm']) {
    await page.locator('#hiddenFileInput').setInputFiles({
      name,
      mimeType: 'application/octet-stream',
      buffer: Buffer.concat([header, values]),
    });
    await expect(page.locator('#depth-ok')).toBeVisible();
    await page.locator('#depth-ok').click();
    await expect(page.locator('#file-list .file-item')).toHaveCount(name === 'first.pfm' ? 1 : 2);
  }
  await page.locator('.depth-settings-toggle[data-file-index="1"]').click();
  await page.locator('#fx-1').fill('700');
  await page.evaluate(() => (window as any).visualizer.removeFileByIndex(0));
  await expect(page.locator('#fx-0')).toHaveValue('700');
  await page.evaluate(() =>
    (window as any).visualizer.populateFormFromCalibration(
      { fx: 250, fy: 200, camera_model: 'fisheye-opencv', coefficients: [0.1, 0.2, 0.3, 0.4] },
      0
    )
  );
  await expect(page.locator('#fx-0')).toHaveValue('250');
  await expect(page.locator('#camera-model-0')).toHaveValue('fisheye624');
  const parameters = await page.evaluate(() => (window as any).visualizer.getDepthSettings(0));
  expect(parameters.coefficients.slice(0, 4)).toEqual([0.1, 0.2, 0.3, 0.4]);
  await page.evaluate(() => (window as any).visualizer.resetToDefaultSettings(0));
  await expect(page.locator('#camera-model-0')).toHaveValue('pinhole-opencv');
});

test('multi-material OBJ has one file root and inherits its transform exactly once', async ({
  page,
}) => {
  await page.goto('/');
  await page.waitForFunction(() => !!(window as any).visualizer);
  await page.evaluate(async () => {
    const vertices = [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 },
    ];
    const faces = [{ indices: [0, 1, 2] }, { indices: [2, 1, 0] }];
    await (window as any).visualizer.handleObjData({
      type: 'objData',
      fileName: 'groups.obj',
      data: {
        vertices,
        faces,
        normals: [],
        points: [],
        lines: [],
        textureCoords: [],
        vertexCount: 3,
        faceCount: 2,
        lineCount: 0,
        pointCount: 0,
        hasNormals: false,
        hasTextures: false,
        materialGroups: faces.map((face, i) => ({
          material: String(i),
          faces: [face],
          lines: [],
          points: [],
        })),
      },
    });
  });
  await expect(page.locator('#file-list .file-item')).toHaveCount(1);
  const state = await page.evaluate(() => {
    const viewer = (window as any).visualizer;
    const entry = viewer.fileEntries.require(0);
    entry.transform.makeTranslation(10, 0, 0);
    viewer.applyTransformationMatrix(0);
    viewer.meshes[0].updateMatrixWorld(true);
    const group = entry.resources.materialGroup;
    const offset = group.matrixWorld.elements[12];
    viewer.setFileEntryVisibility(0, false);
    const hidden = !viewer.meshes[0].visible;
    viewer.setFileEntryVisibility(0, true);
    return {
      meshes: viewer.meshes.length,
      offset,
      hidden,
      shown: viewer.meshes[0].visible,
      materials: group.children.length,
    };
  });
  expect(state).toEqual({ meshes: 1, offset: 10, hidden: true, shown: true, materials: 2 });
});

test('removing a pose after a cloud preserves the next pose settings', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => !!(window as any).visualizer);
  const result = await page.evaluate(async () => {
    const viewer = (window as any).visualizer;
    viewer.addNewFiles([
      {
        vertices: [{ x: 0, y: 0, z: 0 }],
        faces: [],
        vertexCount: 1,
        faceCount: 0,
        format: 'ascii',
        version: '1.0',
        comments: [],
        hasColors: false,
        hasNormals: false,
      },
    ]);
    for (const fileName of ['first.json', 'second.json']) {
      await viewer.handlePoseData({
        type: 'poseData',
        fileName,
        data: {
          points: [
            [0, 0, 0],
            [1, 1, 0],
          ],
          connections: [[0, 1]],
        },
      });
    }
    viewer.poseShowLabels[0] = false;
    viewer.poseShowLabels[1] = true;
    viewer.poseMinScoreThreshold[1] = 0.7;
    viewer.removeFileByIndex(1);
    return {
      kinds: viewer.fileEntries.all.map((entry: any) => entry.kind),
      labels: viewer.poseShowLabels,
      scores: viewer.poseMinScoreThreshold,
    };
  });
  expect(result).toEqual({ kinds: ['spatial', 'pose'], labels: [true], scores: [0.7] });
});
