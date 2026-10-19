import { test, expect, type Page } from '@playwright/test';

const frame =
  'ply\nformat ascii 1.0\nelement vertex 1\nproperty float x\nproperty float y\nproperty float z\nend_header\n0 0 0\n';
async function reply(page: Page, request: { index: number; requestId: string; path: string }) {
  await page.evaluate(
    ({ request, frame }) =>
      window.postMessage(
        {
          type: 'sequence:file',
          index: request.index,
          requestId: request.requestId,
          fileName: request.path,
          data: new TextEncoder().encode(frame),
        },
        '*'
      ),
    { request, frame }
  );
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => document.documentElement.dataset.visualizerReady === 'true');
  await page.evaluate(() => {
    (window as any).visualizer.setupMessageHandler();
    (window as any).requests = [];
    (window as any).visualizer.vscode.postMessage = (message: any) => {
      if (message.type === 'sequence:requestFile') {
        (window as any).requests.push(message);
      }
    };
  });
});

test('requests deduplicate, the visible frame survives eviction, and restart rejects old replies', async ({
  page,
}) => {
  await page.evaluate(() => {
    const viewer = (window as any).visualizer;
    viewer.maxSequenceCache = 1;
    viewer.initializeSequence(['a.ply', 'b.ply', 'c.ply'], '*.ply');
    viewer.seekSequence(0);
    viewer.seekSequence(0);
  });
  const requests = () => page.evaluate(() => (window as any).requests);
  expect(await requests()).toHaveLength(1);
  const first = (await requests())[0];
  await reply(page, first);
  await expect.poll(async () => (await requests()).length).toBe(2);
  await page.evaluate(() => {
    const viewer = (window as any).visualizer;
    (window as any).disposed = 0;
    viewer.sequenceCache
      .get(0)
      .spatial.object.geometry.addEventListener('dispose', () => (window as any).disposed++);
  });
  // Prefetching into a full cache must never dispose the displayed frame.
  await reply(page, (await requests())[1]);
  await expect
    .poll(() => page.evaluate(() => (window as any).visualizer.sequencePending.size))
    .toBe(0);
  expect(
    await page.evaluate(() => {
      const v = (window as any).visualizer;
      return [
        v.fileEntries.length,
        v.sequenceCache.size,
        v.sequenceCache.get(0).spatial.object.parent === v.scene,
        (window as any).disposed,
      ];
    })
  ).toEqual([0, 1, true, 0]);
  await page.evaluate(() => {
    const v = (window as any).visualizer;
    v.seekSequence(1);
    v.seekSequence(1);
  });
  expect(await requests()).toHaveLength(3);
  await reply(page, (await requests())[2]);
  await expect.poll(() => page.evaluate(() => (window as any).visualizer.sequenceIndex)).toBe(1);
  expect(await page.evaluate(() => (window as any).disposed)).toBe(1);
  const oldPrefetch = (await requests()).at(-1);
  await page.evaluate(() => (window as any).visualizer.initializeSequence(['new.ply'], '*.ply'));
  const fresh = (await requests()).at(-1);
  await reply(page, oldPrefetch);
  await reply(page, first);
  await reply(page, fresh);
  await expect
    .poll(() =>
      page.evaluate(() => (window as any).visualizer.sequenceCache.get(0)?.spatial.data.fileName)
    )
    .toBe('new.ply');
  expect(await page.evaluate(() => (window as any).visualizer.sequenceCache.size)).toBe(1);
  await page.evaluate(() => (window as any).visualizer.initializeSequence([], ''));
  expect(await page.evaluate(() => (window as any).visualizer.sequenceCache.size)).toBe(0);
});

test('restart cancels an in-flight depth frame and errors allow a request to be retried', async ({
  page,
}) => {
  await page.evaluate(() => {
    const v = (window as any).visualizer;
    v.processDepthToPointCloud = (
      _bytes: unknown,
      _name: string,
      _params: unknown,
      _color: unknown,
      signal: AbortSignal
    ) =>
      new Promise(resolve => {
        (window as any).depthSignal = signal;
        (window as any).finishDepth = () =>
          resolve({ pointCount: 1, vertices: new Float32Array([0, 0, 0]) });
      });
    v.initializeSequence(['old.pfm'], '*.pfm');
  });
  const old = await page.evaluate(() => (window as any).requests[0]);
  await reply(page, old);
  await page.waitForFunction(() => !!(window as any).finishDepth);
  await page.evaluate(() => {
    (window as any).visualizer.initializeSequence(['new.ply'], '*.ply');
    (window as any).finishDepth();
  });
  expect(await page.evaluate(() => (window as any).depthSignal.aborted)).toBe(true);
  const fresh = await page.evaluate(() => (window as any).requests.at(-1));
  await page.evaluate(
    request =>
      window.postMessage(
        {
          type: 'sequence:file:error',
          index: request.index,
          requestId: request.requestId,
          error: 'read failed',
        },
        '*'
      ),
    fresh
  );
  await expect
    .poll(() => page.evaluate(() => (window as any).visualizer.sequencePending.size))
    .toBe(0);
  await page.evaluate(() => (window as any).visualizer.seekSequence(0));
  const retry = await page.evaluate(() => (window as any).requests.at(-1));
  expect(retry.requestId).not.toBe(fresh.requestId);
  await reply(page, retry);
  await expect
    .poll(() => page.evaluate(() => (window as any).visualizer.sequenceCache.size))
    .toBe(1);
  expect(
    await page.evaluate(() => (window as any).visualizer.sequenceCache.get(0).spatial.data.fileName)
  ).toBe('new.ply');
});

test('the shared sequence decoder loads binary PLY, mesh, point and depth frames', async ({
  page,
}) => {
  const binaryPly = Buffer.concat([
    Buffer.from(
      'ply\nformat binary_little_endian 1.0\nelement vertex 1\nproperty float x\nproperty float y\nproperty float z\nend_header\n'
    ),
    Buffer.alloc(12),
  ]);
  const depthValue = Buffer.alloc(4);
  depthValue.writeFloatLE(1);
  const fixtures = [
    { name: 'binary.ply', bytes: binaryPly, vertices: 1, faces: 0 },
    {
      name: 'mesh.obj',
      bytes: Buffer.from('v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n'),
      vertices: 3,
      faces: 1,
    },
    { name: 'points.xyz', bytes: Buffer.from('0 0 0\n1 0 0\n0 1 0\n'), vertices: 3, faces: 0 },
    { name: 'points.pts', bytes: Buffer.from('2\n0 0 0 10\n1 0 0 20\n'), vertices: 2, faces: 0 },
    {
      name: 'points.pcd',
      bytes: Buffer.concat([
        Buffer.from(
          'VERSION .7\nFIELDS x y z\nSIZE 4 4 4\nTYPE F F F\nCOUNT 1 1 1\nWIDTH 1\nHEIGHT 1\nPOINTS 1\nDATA binary\n'
        ),
        Buffer.alloc(12),
      ]),
      vertices: 1,
      faces: 0,
    },
    {
      name: 'depth.pfm',
      bytes: Buffer.concat([Buffer.from('Pf\n1 1\n-1.0\n'), depthValue]),
      vertices: 1,
      faces: 0,
    },
  ];
  for (const fixture of fixtures) {
    await page.evaluate(
      ({ name, bytes }) => {
        const viewer = (window as any).visualizer;
        viewer.initializeSequence([name], '*');
        const request = (window as any).requests.at(-1);
        window.postMessage(
          {
            type: 'sequence:file',
            index: 0,
            requestId: request.requestId,
            fileName: name,
            data: new Uint8Array(bytes),
          },
          '*'
        );
      },
      { name: fixture.name, bytes: [...fixture.bytes] }
    );
    await expect
      .poll(() =>
        page.evaluate(() => {
          const data = (window as any).visualizer.sequenceCache.get(0)?.spatial.data;
          return data ? [data.fileName, data.vertexCount, data.faceCount] : null;
        })
      )
      .toEqual([fixture.name, fixture.vertices, fixture.faces]);
    await expect(page.locator('#file-list .file-name')).toHaveText(fixture.name);
    if (fixture.name === 'depth.pfm') {
      expect(
        await page.evaluate(() => (window as any).visualizer.sequenceCache.get(0).state.colorMode)
      ).toBe('0');
    }
    if (fixture.name === 'points.pts') {
      expect(
        await page.evaluate(() => (window as any).visualizer.sequenceCache.get(0).state.colorMode)
      ).toBe('intensity');
    }
  }
});

test('a reduced byte budget evicts in-flight prefetch and keeps the visible frame', async ({
  page,
}) => {
  await page.evaluate(() => {
    const v = (window as any).visualizer;
    v.maxSequenceCache = 6;
    v.initializeSequence(['a.ply', 'b.ply', 'c.ply'], '*.ply');
  });
  const requests = () => page.evaluate(() => (window as any).requests);
  await reply(page, (await requests())[0]);
  await expect.poll(async () => (await requests()).length).toBe(2);
  await page.evaluate(() => ((window as any).visualizer.maxSequenceCacheBytes = 1));
  await reply(page, (await requests())[1]);
  await expect
    .poll(() => page.evaluate(() => (window as any).visualizer.sequencePending.size))
    .toBe(0);
  expect(await page.evaluate(() => [...(window as any).visualizer.sequenceCache.keys()])).toEqual([
    0,
  ]);
  await page.evaluate(() => (window as any).visualizer.seekSequence(1));
  await reply(page, (await requests()).at(-1));
  await expect
    .poll(() => page.evaluate(() => [...(window as any).visualizer.sequenceCache.keys()]))
    .toEqual([1]);
  expect(
    await page.evaluate(() => {
      const v = (window as any).visualizer;
      return v.sequenceCache.get(1).spatial.object.parent === v.scene;
    })
  ).toBe(true);
});

test('rapid seeks keep one decode and only the latest queued frame', async ({ page }) => {
  await page.evaluate(() => {
    const w = window as any;
    const v = w.visualizer;
    w.depthCalls = [];
    w.depthFinishes = [];
    v.processDepthToPointCloud = (
      _bytes: unknown,
      name: string,
      _params: unknown,
      _color: unknown,
      signal: AbortSignal
    ) =>
      new Promise(resolve => {
        w.depthCalls.push({ name, signal });
        w.depthFinishes.push(() =>
          resolve({ pointCount: 1, vertices: new Float32Array([0, 0, 0]) })
        );
      });
    v.initializeSequence(
      Array.from({ length: 11 }, (_, index) => `${index}.pfm`),
      '*.pfm'
    );
  });
  const requests = () => page.evaluate(() => (window as any).requests);
  await reply(page, (await requests())[0]);
  await page.waitForFunction(() => (window as any).depthCalls.length === 1);
  for (let index = 1; index <= 10; index++) {
    await page.evaluate(index => (window as any).visualizer.seekSequence(index), index);
    await reply(page, (await requests()).at(-1));
    await expect
      .poll(() => page.evaluate(() => (window as any).visualizer.sequenceQueuedFrame?.index))
      .toBe(index);
  }
  expect(
    await page.evaluate(() => {
      const w = window as any;
      return [
        w.depthCalls.length,
        w.depthCalls[0].signal.aborted,
        w.visualizer.sequencePending.size,
      ];
    })
  ).toEqual([1, true, 1]);
  await page.evaluate(() => (window as any).depthFinishes[0]());
  await page.waitForFunction(() => (window as any).depthCalls.length === 2);
  expect(await page.evaluate(() => (window as any).depthCalls[1].name)).toBe('10.pfm');
  await page.evaluate(() => (window as any).depthFinishes[1]());
  await expect.poll(() => page.evaluate(() => (window as any).visualizer.sequenceIndex)).toBe(10);
  expect(await page.evaluate(() => [...(window as any).visualizer.sequenceCache.keys()])).toEqual([
    10,
  ]);
});

test('an oversized visible frame skips prefetch but explicit navigation still loads', async ({
  page,
}) => {
  await page.evaluate(() => {
    const v = (window as any).visualizer;
    v.maxSequenceCacheBytes = 1;
    v.initializeSequence(['a.ply', 'b.ply'], '*.ply');
  });
  const requests = () => page.evaluate(() => (window as any).requests);
  await reply(page, (await requests())[0]);
  await expect
    .poll(() => page.evaluate(() => (window as any).visualizer.sequencePending.size))
    .toBe(0);
  expect(await requests()).toHaveLength(1);
  await page.evaluate(() => (window as any).visualizer.seekSequence(1));
  expect(await requests()).toHaveLength(2);
  await reply(page, (await requests())[1]);
  await expect.poll(() => page.evaluate(() => (window as any).visualizer.sequenceIndex)).toBe(1);
  await expect
    .poll(() => page.evaluate(() => (window as any).visualizer.sequencePending.size))
    .toBe(0);
  expect(await requests()).toHaveLength(2);
  expect(await page.evaluate(() => [...(window as any).visualizer.sequenceCache.keys()])).toEqual([
    1,
  ]);
});
