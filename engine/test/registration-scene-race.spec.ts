import { test, expect } from '@playwright/test';

for (const operation of ['pair', 'all', 'complex']) {
  for (const mutation of [
    'remove-earlier',
    'remove-source',
    'replace',
    'transform',
    'session',
    'cancel',
    'dispose',
    'unchanged',
  ]) {
    test(`${operation} validates a pending result after ${mutation}`, async ({ page }) => {
      await page.goto('/');
      await page.waitForFunction(() => document.documentElement.dataset.visualizerReady === 'true');
      await page.evaluate(
        ({ operation }) => {
          const w = window as any;
          const viewer = w.visualizer;
          viewer.addNewFiles(
            Array.from({ length: 3 }, (_, index) => ({
              vertices: Array.from({ length: 60 }, (_, n) => ({
                x: n % 5,
                y: Math.floor(n / 5),
                z: n % 3,
              })),
              faces: [],
              vertexCount: 60,
              faceCount: 0,
              format: 'ascii',
              version: '1.0',
              comments: [],
              hasColors: false,
              hasNormals: false,
              fileName: `${index}.ply`,
            }))
          );
          w.terminated = 0;
          const terminate = Worker.prototype.terminate;
          Worker.prototype.terminate = function () {
            w.terminated++;
            terminate.call(this);
          };
          const original = Worker.prototype.postMessage;
          Worker.prototype.postMessage = function (message: any, ...args: any[]) {
            if (message.kind && message.source && message.target) {
              w.solverReply = () =>
                this.dispatchEvent(
                  new MessageEvent('message', {
                    data: {
                      id: message.id,
                      matrix: new Float64Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 10, 0, 0, 1]),
                      stats: JSON.stringify({
                        icp: {
                          fitness: 1,
                          inlierCount: 60,
                          inlierRmse: 0,
                          iterations: 1,
                          converged: true,
                        },
                        startedFrom: 'given',
                      }),
                    },
                  })
                );
            } else {
              (original as any).call(this, message, ...args);
            }
          };
          w.registrationFeature.beginSession(viewer, 1, 2);
          w.alignment =
            operation === 'pair'
              ? w.registrationFeature.refineIcp(viewer)
              : w.registrationFeature.alignAllTo(viewer, 2, {
                  refineOnly: operation === 'all',
                  complex: operation === 'complex',
                });
        },
        { operation }
      );
      await page.waitForFunction(() => !!(window as any).solverReply);
      const result = await page.evaluate(async mutation => {
        const w = window as any;
        const v = w.visualizer;
        if (mutation === 'remove-earlier') {
          v.removeFileByIndex(0);
        }
        if (mutation === 'remove-source') {
          v.removeFileByIndex(1);
        }
        if (mutation === 'replace') {
          const entry = v.fileEntries.require(1);
          entry.spatial = { ...entry.spatial, data: { ...entry.spatial.data } };
        }
        if (mutation === 'transform') {
          const matrix = v.fileEntries.require(1).transform.clone();
          matrix.elements[12] = 3;
          v.setTransformationMatrix(1, matrix);
        }
        if (mutation === 'cancel') {
          w.registrationFeature.cancelAlignment(v);
        }
        if (mutation === 'dispose') {
          v.dispose();
        }
        if (mutation === 'session') {
          w.registrationFeature.beginSession(v, 0, 2);
        }
        const before = v.fileEntries.all.map((entry: any) => [...entry.transform.elements]);
        if (mutation === 'unchanged') {
          w.solverReply();
        }
        const timer = mutation === 'unchanged' ? setInterval(() => w.solverReply(), 10) : undefined;
        await w.alignment;
        clearInterval(timer);
        w.solverReply(); // Late replies from the terminated worker cannot apply anything.
        return {
          before,
          after: v.fileEntries.all.map((entry: any) => [...entry.transform.elements]),
          terminated: w.terminated,
          busy: w.__plyRegistrationState.busy,
          message: w.__plyRegistrationState.result,
        };
      }, mutation);
      if (mutation === 'unchanged') {
        expect(result.after).not.toEqual(result.before);
      } else {
        expect(result.after).toEqual(result.before);
      }
      expect(result.busy).toBe(false);
      if (mutation !== 'unchanged') {
        expect(result.terminated).toBeGreaterThan(0);
        expect(result.message).toContain(mutation === 'cancel' ? 'cancelled' : 'scene changed');
      }
      if (mutation === 'unchanged' && operation === 'all') {
        const translations = await page.evaluate(() => {
          const w = window as any;
          w.visualizer.removeFileByIndex(0);
          w.registrationFeature.undoAlignAll(w.visualizer);
          return w.visualizer.fileEntries.all.map((entry: any) => entry.transform.elements[12]);
        });
        expect(translations).toEqual([0, 0]);
      }
    });
  }
}

test('undo includes unattached clouds moved during group recovery', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => document.documentElement.dataset.visualizerReady === 'true');
  const result = await page.evaluate(async () => {
    const w = window as any;
    const v = w.visualizer;
    v.addNewFiles(
      Array.from({ length: 3 }, (_, index) => ({
        vertices: Array.from({ length: 60 }, (_, n) => ({
          x: n % 5,
          y: Math.floor(n / 5),
          z: n % 3,
        })),
        faces: [],
        vertexCount: 60,
        faceCount: 0,
        format: 'ascii',
        version: '1.0',
        comments: [],
        hasColors: false,
        hasNormals: false,
        fileName: `${index}.ply`,
      }))
    );
    let calls = 0;
    const original = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function (message: any, ...args: any[]) {
      if (!message.kind) {
        return (original as any).call(this, message, ...args);
      }
      calls++;
      // Both clouds fail against the anchor, overlap each other, then recover
      // as a separate group. Neither belongs to the initial placement undo list.
      const fitness = calls === 3 || calls === 4 ? 0.5 : 0.01;
      queueMicrotask(() =>
        this.dispatchEvent(
          new MessageEvent('message', {
            data: {
              id: message.id,
              matrix: new Float64Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 10, 0, 0, 1]),
              stats: JSON.stringify({
                icp: { fitness, inlierCount: 60, inlierRmse: 0, iterations: 1, converged: true },
                startedFrom: 'given',
              }),
            },
          })
        )
      );
    };
    await w.registrationFeature.alignAllTo(v, 0, { complex: true });
    const moved = v.fileEntries.all.map((entry: any) => entry.transform.elements[12]);
    const canUndo = w.__plyRegistrationState.canUndoAll;
    w.registrationFeature.undoAlignAll(v);
    return {
      calls,
      moved,
      canUndo,
      restored: v.fileEntries.all.map((entry: any) => entry.transform.elements[12]),
    };
  });
  expect(result.calls).toBe(6);
  expect(result.moved).toEqual([0, 0, 10]);
  expect(result.canUndo).toBe(true);
  expect(result.restored).toEqual([0, 0, 0]);
});

test('the Cancel alignment button stops a pending solve and permits another run', async ({
  page,
}) => {
  await page.goto('/');
  await page.waitForFunction(() => document.documentElement.dataset.visualizerReady === 'true');
  await page.evaluate(() => {
    const w = window as any;
    w.visualizer.addNewFiles(
      Array.from({ length: 2 }, (_, index) => ({
        vertices: [
          { x: 0, y: 0, z: 0 },
          { x: 1, y: 0, z: 0 },
          { x: 0, y: 1, z: 0 },
        ],
        faces: [],
        vertexCount: 3,
        faceCount: 0,
        format: 'ascii',
        version: '1.0',
        comments: [],
        hasColors: false,
        hasNormals: false,
        fileName: `${index}.ply`,
      }))
    );
    const original = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function (message: any, ...args: any[]) {
      if (message.kind) {
        w.heldRequests = (w.heldRequests ?? 0) + 1;
      } else {
        (original as any).call(this, message, ...args);
      }
    };
  });
  await page.locator('#global-align-toggle').click();
  await page.locator('#tools-align').click();
  for (let run = 1; run <= 2; run++) {
    await page.locator('.global-align-refine').click();
    await page.waitForFunction(run => (window as any).heldRequests === run, run);
    await page.getByRole('button', { name: 'Cancel alignment', exact: true }).click();
    await expect(page.locator('.global-align-refine')).toBeEnabled();
    await expect
      .poll(() => page.evaluate(() => (window as any).__plyRegistrationState.result))
      .toContain('cancelled');
  }
});

test('completed alignment groups and colouring keep file identity after deletion', async ({
  page,
}) => {
  await page.goto('/');
  await page.waitForFunction(() => document.documentElement.dataset.visualizerReady === 'true');
  const ids = await page.evaluate(() => {
    const w = window as any;
    const v = w.visualizer;
    v.addNewFiles(
      Array.from({ length: 4 }, (_, index) => ({
        vertices: [
          { x: 0, y: 0, z: 0 },
          { x: 1, y: 0, z: 0 },
          { x: 0, y: 1, z: 0 },
        ],
        faces: [],
        vertexCount: 3,
        faceCount: 0,
        format: 'ascii',
        version: '1.0',
        comments: [],
        hasColors: false,
        hasNormals: false,
        fileName: `${index}.ply`,
        metadata: index ? { containerFileName: 'test.x3a', embeddedScanName: `${index}.x3r` } : {},
      }))
    );
    const ids = v.fileEntries.all.map((entry: any) => entry.id);
    const s = w.__plyRegistrationState;
    s.alignmentAnchorId = ids[1];
    s.alignedIds = [ids[1], ids[3]];
    s.alignEntries = [
      { id: ids[2], name: '2.ply', state: 'failed', detail: '' },
      { id: ids[3], name: '3.ply', state: 'aligned', detail: '' },
    ];
    s.alignDone = 2;
    s.unattachedGroups = [
      {
        ids: [ids[2]],
        names: ['2.ply'],
        suggestion: {
          movingId: ids[2],
          fixedId: ids[1],
          movingName: '2.ply',
          fixedName: '1.ply',
          overlapPercent: 10,
        },
      },
    ];
    v.runningInVSCode = true;
    w.sent = [];
    v.vscode.postMessage = (message: any) => w.sent.push(message);
    v.removeFileByIndex(0);
    return ids;
  });
  await page.locator('#global-align-toggle').click();
  await page.locator('#tools-align').click();
  await page.locator('#global-align-anchor').selectOption('2');
  await page.locator('.global-align-recolor').click();
  expect(
    await page.evaluate(() =>
      Object.keys(
        (window as any).sent.find((m: any) => m.type === 'stationPipeline').options.transforms
      )
    )
  ).toEqual(['1', '3']);
  await page.getByRole('button', { name: 'Place this group by hand' }).click();
  expect(
    await page.evaluate(() => {
      const s = (window as any).__plyRegistrationState;
      return [s.sourceIndex, s.targetIndex];
    })
  ).toEqual([1, 0]);
  await page.evaluate(() => (window as any).visualizer.removeFileByIndex(1));
  await expect(page.locator('#global-align-anchor')).toHaveValue('1');
  expect(
    await page.evaluate(() => {
      const s = (window as any).__plyRegistrationState;
      return {
        aligned: s.alignedIds,
        groups: s.unattachedGroups,
        rows: s.alignEntries.map((e: any) => e.id),
      };
    })
  ).toEqual({ aligned: [ids[1], ids[3]], groups: [], rows: [ids[3]] });
  await page.evaluate(() => (window as any).visualizer.removeFileByIndex(0));
  expect(
    await page.evaluate(() => {
      const s = (window as any).__plyRegistrationState;
      return [s.alignmentAnchorId, s.alignedIds, s.alignEntries, s.unattachedGroups];
    })
  ).toEqual([null, [], [], []]);
});
