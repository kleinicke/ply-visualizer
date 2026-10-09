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
    // The packed shape the Rust OBJ parser produces: two triangles, each with
    // its own material (ids 1 and 2; id 0 is "no usemtl").
    await (window as any).visualizer.handleObjData({
      type: 'objData',
      fileName: 'groups.obj',
      data: {
        vertexCount: 3,
        positionsArray: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
        normalsArray: null,
        normalCount: 0,
        textureCoordCount: 0,
        hasNormals: false,
        hasTextures: false,
        indicesArray: new Uint32Array([0, 1, 2, 2, 1, 0]),
        faceCount: 2,
        faceSizes: null,
        faceMaterials: new Uint32Array([1, 2]),
        lineIndices: new Uint32Array(0),
        lineMaterials: null,
        lineCount: 0,
        pointIndices: new Uint32Array(0),
        pointMaterials: null,
        pointCount: 0,
        materialNames: ['', '0', '1'],
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
    viewer.fileEntries.pose(0).showLabels = false;
    viewer.fileEntries.pose(1).showLabels = true;
    viewer.fileEntries.pose(1).minScoreThreshold = 0.7;
    viewer.removeFileByIndex(1);
    return {
      kinds: viewer.fileEntries.all.map((entry: any) => entry.kind),
      labels: viewer.poseShowLabels,
      scores: viewer.poseMinScoreThreshold,
    };
  });
  expect(result).toEqual({ kinds: ['spatial', 'pose'], labels: [true], scores: [0.7] });
});

test('disposed viewer stops rendering and responding, and a replacement viewer works', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.waitForFunction(() => document.documentElement.dataset.visualizerReady === 'true');
  await page.evaluate(async () => {
    const old = (window as any).visualizer;
    let callbacks = 0;
    old.requestRender = () => callbacks++;
    old.dispose();
    old.dispose();
    document.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    window.dispatchEvent(new Event('resize'));
    (window as any).__disposedViewer = { old, callbacks: () => callbacks };
    await Promise.resolve();
    (window as any).visualizer = new (window as any).PointCloudVisualizer();
  });
  await page.waitForFunction(() => document.documentElement.dataset.visualizerReady === 'true');
  await page.locator('#hiddenFileInput').setInputFiles({
    name: 'recreated.off',
    mimeType: 'text/plain',
    buffer: Buffer.from('OFF\n3 1 0\n0 0 0\n1 0 0\n0 1 0\n3 0 1 2\n'),
  });
  await expect(page.locator('#file-list .file-item')).toHaveCount(1);
  await expect(page.locator('#three-canvas')).toHaveCount(1);
  const state = await page.evaluate(() => {
    const { old, callbacks } = (window as any).__disposedViewer;
    return {
      animation: old.animationId,
      files: old.fileEntries.length,
      callbacks: callbacks(),
      ready: (window as any).visualizer.meshes.length,
    };
  });
  expect(state).toEqual({ animation: null, files: 0, callbacks: 0, ready: 1 });
  expect(errors).toEqual([]);
});

test('depth worker cancellation skips queued jobs, stops active work and recovers without fallback', async ({
  page,
}) => {
  await page.goto('/');
  await page.waitForFunction(() => document.documentElement.dataset.visualizerReady === 'true');
  const result = await page.evaluate(async () => {
    const NativeWorker = window.Worker;
    const workers: any[] = [];
    let fallback = 0;
    class FakeWorker {
      messages: any[] = [];
      terminated = false;
      onmessage: any;
      constructor() {
        workers.push(this);
      }
      postMessage(message: any) {
        this.messages.push(message);
      }
      terminate() {
        this.terminated = true;
      }
      finish() {
        this.onmessage({
          data: {
            id: this.messages.at(-1).id,
            ok: true,
            result: { vertices: new Float32Array(3), pointCount: 1 },
          },
        });
      }
    }
    (window as any).Worker = FakeWorker;
    const Client = (window as any).visualizer.depthWorkerClient.constructor;
    const client = new Client({
      processDepthToPointCloud: () => {
        fallback++;
        throw new Error('Unexpected fallback');
      },
    });
    const params = { cameraModel: 'pinhole-ideal', depthType: 'orthogonal', fx: 1 };
    const tick = () => new Promise(resolve => setTimeout(resolve, 0));
    // Starting a worker is asynchronous (the page compiles the kernel once and
    // hands it over), so wait for the post itself rather than one tick.
    const posted = async (count: number) => {
      for (let i = 0; i < 500; i++) {
        if (workers.reduce((sum, worker) => sum + worker.messages.length, 0) >= count) {
          return;
        }
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      throw new Error(`expected ${count} posted depth jobs`);
    };
    try {
      const active = new AbortController(),
        queued = new AbortController();
      const first = client
        .processDepthToPointCloud(new ArrayBuffer(4), 'same.pfm', params, undefined, active.signal)
        .catch((e: Error) => e.name);
      const skipped = client
        .processDepthToPointCloud(new ArrayBuffer(4), 'same.pfm', params, undefined, queued.signal)
        .catch((e: Error) => e.name);
      const next = client.processDepthToPointCloud(new ArrayBuffer(4), 'same.pfm', params);
      await posted(1);
      queued.abort();
      active.abort();
      await posted(2);
      await tick();
      const started = workers.reduce((sum, worker) => sum + worker.messages.length, 0);
      workers.at(-1).finish();
      const completed = await next;
      const firstKey = workers.at(-1).messages[0].cacheKey;
      const other = client.processDepthToPointCloud(new ArrayBuffer(4), 'same.pfm', params);
      await posted(3);
      const secondKey = workers.at(-1).messages.at(-1).cacheKey;
      workers.at(-1).finish();
      await other;
      const pending = client
        .processDepthToPointCloud(new ArrayBuffer(4), 'pending.pfm', params)
        .catch((e: Error) => e.name);
      await posted(4);
      client.dispose();
      return {
        first: await first,
        skipped: await skipped,
        pending: await pending,
        started,
        completed: completed.pointCount,
        stopped: workers.every(worker => worker.terminated),
        fallback,
        distinctSources: firstKey !== secondKey,
      };
    } finally {
      client.dispose();
      window.Worker = NativeWorker;
    }
  });
  expect(result).toEqual({
    first: 'AbortError',
    skipped: 'AbortError',
    pending: 'AbortError',
    started: 2,
    completed: 1,
    stopped: true,
    fallback: 0,
    distinctSources: true,
  });
});

test('invalid geometry reports a useful error without allocating or publishing an object', async ({
  page,
}) => {
  await page.goto('/');
  await page.waitForFunction(() => document.documentElement.dataset.visualizerReady === 'true');
  const result = await page.evaluate(() => {
    const viewer = (window as any).visualizer;
    const baseline = viewer.scene.children.length;
    let message = '';
    try {
      viewer.addNewFiles([
        {
          vertices: [],
          faces: [],
          vertexCount: 2,
          faceCount: 0,
          format: 'ascii',
          version: '1.0',
          comments: [],
          hasColors: false,
          hasNormals: false,
          useTypedArrays: true,
          positionsArray: new Float32Array(3),
        },
      ]);
    } catch (error) {
      message = (error as Error).message;
    }
    return {
      message,
      entries: viewer.fileEntries.length,
      unchanged: baseline === viewer.scene.children.length,
    };
  });
  expect(result.message).toContain('positionsArray has 3 values; expected 6');
  expect(result.entries).toBe(0);
  expect(result.unchanged).toBe(true);
});

test('failed volume and depth replacements preserve the displayed file and allow retry', async ({
  page,
}) => {
  await page.goto('/');
  await page.waitForFunction(() => document.documentElement.dataset.visualizerReady === 'true');
  const result = await page.evaluate(async () => {
    const viewer = (window as any).visualizer;
    const initial = {
      vertices: [{ x: 0, y: 0, z: 0 }],
      faces: [],
      vertexCount: 1,
      faceCount: 0,
      hasColors: false,
      hasNormals: false,
      format: 'ascii',
      version: '1.0',
      comments: [],
      fileName: 'depth.pfm',
      depthSource: {
        originalData: new ArrayBuffer(0),
        fileName: 'depth.pfm',
        cameraParams: { fx: 1, cameraModel: 'pinhole-ideal', depthType: 'euclidean' },
        depthDimensions: { width: 1, height: 1 },
        colorImageName: 'old.png',
      },
    };
    viewer.addNewFiles([initial]);
    const entry = viewer.fileEntries.at(0);
    const old = entry.spatial.object;
    let disposed = 0;
    old.geometry.addEventListener('dispose', () => disposed++);
    viewer.processDepthToPointCloud = async () => ({
      pointCount: 1,
      vertices: new Float32Array([1, 2, 3]),
    });
    const material = viewer.createMaterialForFile;
    viewer.createMaterialForFile = () => {
      throw new Error('Injected replacement failure');
    };
    const unchanged = () =>
      entry.spatial.data === initial &&
      entry.spatial.object === old &&
      old.parent === viewer.scene &&
      disposed === 0;
    await viewer.handleVolumeData({
      data: { ...initial, metadata: { volumeRenderMode: 'points' } },
      fileName: 'volume.nrrd',
      replaceFileIndex: 0,
    });
    const volume = unchanged();
    await viewer.removeColorImageFromDepth(0);
    const color = unchanged() && initial.depthSource.colorImageName === 'old.png';
    await viewer.applyDepthSettings(0);
    const depth = unchanged();
    viewer.createMaterialForFile = material;
    await viewer.removeColorImageFromDepth(0);
    return {
      volume,
      color,
      depth,
      disposed,
      replaced: entry.spatial.object !== old,
      colorCleared: !entry.spatial.data.depthSource.colorImageName,
    };
  });
  expect(result).toEqual({
    volume: true,
    color: true,
    depth: true,
    disposed: 1,
    replaced: true,
    colorCleared: true,
  });
});
