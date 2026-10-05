import { test, expect } from '@playwright/test';

for (const operation of ['pair', 'all', 'complex']) {
  for (const mutation of [
    'remove-earlier',
    'remove-source',
    'replace',
    'transform',
    'session',
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
        if (mutation === 'session') {
          w.registrationFeature.beginSession(v, 0, 2);
        }
        const before = v.fileEntries.all.map((entry: any) => [...entry.transform.elements]);
        w.solverReply();
        const timer = mutation === 'unchanged' ? setInterval(() => w.solverReply(), 10) : undefined;
        await w.alignment;
        clearInterval(timer);
        return {
          before,
          after: v.fileEntries.all.map((entry: any) => [...entry.transform.elements]),
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
        expect(result.message).toContain('scene changed');
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
